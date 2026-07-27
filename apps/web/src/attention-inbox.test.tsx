import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  AttentionCursorHeader,
  UnreadAttentionMarker,
} from "./attention-inbox.js";

describe("attention inbox controls", () => {
  it("renders unread state in text and does not render a seen marker", () => {
    expect(renderToStaticMarkup(<UnreadAttentionMarker unread />)).toContain(
      "Unread attention",
    );
    expect(renderToStaticMarkup(<UnreadAttentionMarker unread={false} />)).toBe(
      "",
    );
  });

  it("labels mute state without relying on color", () => {
    const muted = renderToStaticMarkup(
      <AttentionCursorHeader muted onToggleMuted={() => {}} unread={false} />,
    );
    expect(muted).toContain("Seen");
    expect(muted).toContain("Unmute alerts");
    expect(muted).toContain('aria-pressed="true"');
  });
});
