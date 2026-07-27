import { Buffer } from "node:buffer";

import { MAX_VERIFICATION_OUTPUT_BYTES } from "@pacium/contracts";

const TRUNCATION_MARKER = Buffer.from(
  "\n… Pacium omitted bounded verification output …\n",
  "utf8",
);

export interface CapturedVerificationOutput {
  text: string;
  truncated: boolean;
}

export class VerificationOutputCapture {
  private readonly edgeBytes = Math.floor(
    (MAX_VERIFICATION_OUTPUT_BYTES - TRUNCATION_MARKER.byteLength) / 2,
  );
  private complete: Buffer | null = Buffer.alloc(0);
  private prefix = Buffer.alloc(0);
  private tail = Buffer.alloc(0);

  public append(chunk: Uint8Array | string): void {
    const bytes =
      typeof chunk === "string"
        ? Buffer.from(chunk, "utf8")
        : Buffer.from(chunk);
    if (bytes.byteLength === 0) {
      return;
    }

    if (this.complete !== null) {
      if (
        this.complete.byteLength + bytes.byteLength <=
        MAX_VERIFICATION_OUTPUT_BYTES
      ) {
        this.complete = Buffer.concat([this.complete, bytes]);
        return;
      }
      this.prefix = Buffer.concat([
        this.complete,
        bytes.subarray(0, this.edgeBytes),
      ]).subarray(0, this.edgeBytes);
      this.tail = appendTail(this.complete, bytes, this.edgeBytes);
      this.complete = null;
      return;
    }

    this.tail = appendTail(this.tail, bytes, this.edgeBytes);
  }

  public finish(): CapturedVerificationOutput {
    const truncated = this.complete === null;
    const raw =
      this.complete ??
      Buffer.concat([this.prefix, TRUNCATION_MARKER, this.tail]);
    return {
      text: boundUtf8Text(normalizeOutput(raw.toString("utf8"))),
      truncated,
    };
  }
}

function appendTail(
  previous: Buffer,
  chunk: Buffer,
  maximumBytes: number,
): Buffer {
  if (chunk.byteLength >= maximumBytes) {
    return chunk.subarray(chunk.byteLength - maximumBytes);
  }
  const combined = Buffer.concat([previous, chunk]);
  return combined.byteLength <= maximumBytes
    ? combined
    : combined.subarray(combined.byteLength - maximumBytes);
}

function normalizeOutput(value: string): string {
  return [...value.replaceAll("\r\n", "\n").replaceAll("\r", "\n")]
    .map((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint !== undefined &&
        codePoint !== 0x09 &&
        codePoint !== 0x0a &&
        (codePoint <= 0x1f || codePoint === 0x7f)
        ? " "
        : character;
    })
    .join("");
}

function boundUtf8Text(value: string): string {
  const encoded = Buffer.from(value, "utf8");
  if (encoded.byteLength <= MAX_VERIFICATION_OUTPUT_BYTES) {
    return value;
  }

  let usedBytes = 0;
  let bounded = "";
  for (const character of value) {
    const characterBytes = Buffer.byteLength(character, "utf8");
    if (usedBytes + characterBytes > MAX_VERIFICATION_OUTPUT_BYTES) {
      break;
    }
    bounded += character;
    usedBytes += characterBytes;
  }
  return bounded;
}
