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
  private prefix = Buffer.alloc(0);
  private tail = Buffer.alloc(0);
  private receivedBytes = 0;

  public append(chunk: Uint8Array | string): void {
    const bytes =
      typeof chunk === "string"
        ? Buffer.from(chunk, "utf8")
        : Buffer.from(chunk);
    if (bytes.byteLength === 0) {
      return;
    }
    this.receivedBytes += bytes.byteLength;

    if (this.prefix.byteLength < this.edgeBytes) {
      const missing = this.edgeBytes - this.prefix.byteLength;
      this.prefix = Buffer.concat([this.prefix, bytes.subarray(0, missing)]);
    }

    this.tail = Buffer.concat([this.tail, bytes]);
    if (this.tail.byteLength > this.edgeBytes) {
      this.tail = this.tail.subarray(this.tail.byteLength - this.edgeBytes);
    }
  }

  public finish(): CapturedVerificationOutput {
    const truncated = this.receivedBytes > MAX_VERIFICATION_OUTPUT_BYTES;
    const raw = truncated
      ? Buffer.concat([this.prefix, TRUNCATION_MARKER, this.tail])
      : this.completeUntruncatedBuffer();
    return {
      text: boundUtf8Text(normalizeOutput(raw.toString("utf8"))),
      truncated,
    };
  }

  private completeUntruncatedBuffer(): Buffer {
    if (this.receivedBytes <= this.edgeBytes) {
      return this.prefix;
    }
    const bytesAfterPrefix = this.receivedBytes - this.prefix.byteLength;
    return Buffer.concat([
      this.prefix,
      this.tail.subarray(this.tail.byteLength - bytesAfterPrefix),
    ]);
  }
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
