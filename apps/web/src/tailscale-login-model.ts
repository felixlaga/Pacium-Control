/**
 * Incremental scanner that finds the Tailscale login URL inside untrusted
 * terminal output. Chunks may contain ANSI escapes and may split the URL at
 * any byte boundary, so unmatched raw text is carried (bounded) between calls.
 */

export interface TailscaleUrlScan {
  carry: string;
}

export const INITIAL_TAILSCALE_URL_SCAN: TailscaleUrlScan = { carry: "" };

const LOGIN_URL =
  /https:\/\/login\.tailscale\.com\/[A-Za-z0-9._~!$&'()*+,;=:@%/?#-]+/g;
const MAX_CARRY = 512;
const MAX_URL_LENGTH = 2_048;
const ESCAPE = 27;
const BELL = 7;
const DELETE = 127;

export function scanForTailscaleLoginUrl(
  scan: TailscaleUrlScan,
  chunk: string,
): { scan: TailscaleUrlScan; url: string | null } {
  const raw = scan.carry + chunk;
  const text = sanitizeTerminalText(raw);
  LOGIN_URL.lastIndex = 0;
  let match = LOGIN_URL.exec(text);
  while (match !== null) {
    const candidate = match[0];
    if (isValidLoginUrl(candidate)) {
      LOGIN_URL.lastIndex = 0;
      return {
        scan: {
          carry: text.slice(match.index + candidate.length).slice(-MAX_CARRY),
        },
        url: candidate,
      };
    }
    match = LOGIN_URL.exec(text);
  }
  return { scan: { carry: raw.slice(-MAX_CARRY) }, url: null };
}

function isValidLoginUrl(candidate: string): boolean {
  if (candidate.length > MAX_URL_LENGTH) {
    return false;
  }
  try {
    const url = new URL(candidate);
    return (
      url.protocol === "https:" &&
      url.hostname === "login.tailscale.com" &&
      url.username === "" &&
      url.password === ""
    );
  } catch {
    return false;
  }
}

/**
 * Removes complete ANSI CSI/OSC/two-character escape sequences and replaces
 * remaining control characters with spaces so URL boundaries survive. An
 * incomplete trailing sequence is dropped here; the raw carry preserves it so
 * the next chunk can complete it.
 */
function sanitizeTerminalText(raw: string): string {
  let text = "";
  let index = 0;
  while (index < raw.length) {
    const code = raw.charCodeAt(index);
    if (code === ESCAPE) {
      const next = raw[index + 1];
      if (next === "[") {
        let cursor = index + 2;
        while (cursor < raw.length) {
          const inner = raw.charCodeAt(cursor);
          if (inner >= 0x40 && inner <= 0x7e) {
            cursor += 1;
            break;
          }
          if (inner >= 0x20 && inner <= 0x3f) {
            cursor += 1;
            continue;
          }
          break;
        }
        index = cursor;
        continue;
      }
      if (next === "]") {
        let cursor = index + 2;
        while (cursor < raw.length) {
          const inner = raw.charCodeAt(cursor);
          if (inner === BELL) {
            cursor += 1;
            break;
          }
          if (inner === ESCAPE && raw[cursor + 1] === "\\") {
            cursor += 2;
            break;
          }
          cursor += 1;
        }
        index = cursor;
        continue;
      }
      index += next === undefined ? 1 : 2;
      continue;
    }
    if (code <= 31 || code === DELETE) {
      text += " ";
      index += 1;
      continue;
    }
    text += raw[index];
    index += 1;
  }
  return text;
}
