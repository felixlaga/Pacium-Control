import { Buffer } from "node:buffer";

import { MAX_VERIFICATION_OUTPUT_BYTES } from "@pacium/contracts";
import { describe, expect, it } from "vitest";

import { VerificationOutputCapture } from "./verification-output.js";

describe("verification output capture", () => {
  it("preserves ordinary chunked UTF-8 output", () => {
    const capture = new VerificationOutputCapture();
    capture.append("checking λ\n");
    capture.append(Buffer.from("passed 🚀\n"));

    expect(capture.finish()).toEqual({
      text: "checking λ\npassed 🚀\n",
      truncated: false,
    });
  });

  it("normalizes terminal controls without removing readable evidence", () => {
    const capture = new VerificationOutputCapture();
    capture.append("progress\rnext\u001b]52;c;secret\u0007\tdone\u0000\n");

    expect(capture.finish()).toEqual({
      text: "progress\nnext ]52;c;secret \tdone \n",
      truncated: false,
    });
  });

  it("retains bounded beginning and ending evidence when truncated", () => {
    const capture = new VerificationOutputCapture();
    capture.append(`BEGIN\n${"x".repeat(MAX_VERIFICATION_OUTPUT_BYTES)}\nEND`);

    const result = capture.finish();
    expect(result.truncated).toBe(true);
    expect(result.text).toContain("BEGIN");
    expect(result.text).toContain("Pacium omitted bounded verification output");
    expect(result.text).toContain("END");
    expect(Buffer.byteLength(result.text, "utf8")).toBeLessThanOrEqual(
      MAX_VERIFICATION_OUTPUT_BYTES,
    );
  });

  it("preserves every byte at the exact non-truncated limit", () => {
    const capture = new VerificationOutputCapture();
    const exact = `${"a".repeat(MAX_VERIFICATION_OUTPUT_BYTES - 2)}\nZ`;
    capture.append(exact.slice(0, 13_000));
    capture.append(exact.slice(13_000));

    expect(capture.finish()).toEqual({
      text: exact,
      truncated: false,
    });
  });

  it("keeps the final UTF-8 result within the byte contract", () => {
    const capture = new VerificationOutputCapture();
    capture.append("🚀".repeat(MAX_VERIFICATION_OUTPUT_BYTES));

    const result = capture.finish();
    expect(result.truncated).toBe(true);
    expect(result.text).not.toContain("\u0000");
    expect(Buffer.byteLength(result.text, "utf8")).toBeLessThanOrEqual(
      MAX_VERIFICATION_OUTPUT_BYTES,
    );
  });
});
