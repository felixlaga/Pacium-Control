import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  HarnessLoginButton,
  HarnessLoginPopover,
  submitHarnessConnect,
  TailscaleLoginBanner,
} from "./harness-login.js";

function collectElements(
  node: ReactNode,
  found: ReactElement[] = [],
): ReactElement[] {
  if (Array.isArray(node)) {
    for (const child of node) {
      collectElements(child as ReactNode, found);
    }
    return found;
  }
  if (!isValidElement(node)) {
    return found;
  }
  found.push(node);
  collectElements((node.props as { children?: ReactNode }).children, found);
  return found;
}

function findByType(root: ReactElement, type: string): ReactElement {
  const match = collectElements(root).find((element) => element.type === type);
  if (match === undefined) {
    throw new Error(`No <${type}> element found`);
  }
  return match;
}

function propsOf(element: ReactElement): Record<string, unknown> {
  return element.props as Record<string, unknown>;
}

describe("HarnessLoginButton", () => {
  it("renders a compact labeled trigger with the popover closed", () => {
    const markup = renderToStaticMarkup(
      <HarnessLoginButton
        disabled={false}
        onConnect={() => undefined}
        onTargetChange={() => undefined}
        target=""
      />,
    );

    expect(markup).toContain(">Harness</span>");
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('aria-haspopup="dialog"');
    expect(markup).not.toContain('role="dialog"');
    expect(markup).not.toContain("SSH target");
  });
});

describe("HarnessLoginPopover", () => {
  function render(target: string, disabled = false): string {
    return renderToStaticMarkup(
      <HarnessLoginPopover
        disabled={disabled}
        onClose={() => undefined}
        onConnect={() => undefined}
        onTargetChange={() => undefined}
        target={target}
      />,
    );
  }

  it("renders the dialog with target field, helper text, and action", () => {
    const markup = render("root@harness");

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-label="Log in to harness"');
    expect(markup).toContain(">SSH target</span>");
    expect(markup).toContain('placeholder="user@host"');
    expect(markup).toContain(
      "Opens a terminal, connects over SSH, and starts Tailscale login when the harness is signed out.",
    );
    expect(markup).toContain("Connect &amp; log in");
  });

  it("disables the connect action for invalid targets or a disabled app", () => {
    expect(render("root@")).toContain(
      '<button class="harness-connect" disabled=""',
    );
    expect(render("root@harness", true)).toContain(
      '<button class="harness-connect" disabled=""',
    );
    expect(render("root@harness")).not.toContain("disabled");
  });

  it("connects with the target and closes, only when valid", () => {
    const onConnect = vi.fn();
    const onClose = vi.fn();
    const popover = HarnessLoginPopover({
      disabled: false,
      onClose,
      onConnect,
      onTargetChange: () => undefined,
      target: "root@harness",
    });
    const connect = propsOf(findByType(popover, "button")).onClick as
      (() => void) | undefined;

    connect?.();

    expect(onConnect).toHaveBeenCalledOnce();
    expect(onConnect).toHaveBeenCalledWith("root@harness");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("forwards typed values and closes on Escape", () => {
    const onTargetChange = vi.fn();
    const onClose = vi.fn();
    const popover = HarnessLoginPopover({
      disabled: false,
      onClose,
      onConnect: () => undefined,
      onTargetChange,
      target: "",
    });

    const onChange = propsOf(findByType(popover, "input")).onChange as (event: {
      target: { value: string };
    }) => void;
    onChange({ target: { value: "op@host" } });
    expect(onTargetChange).toHaveBeenCalledWith("op@host");

    const onKeyDown = propsOf(popover).onKeyDown as (event: {
      key: string;
      shiftKey: boolean;
      preventDefault: () => void;
      currentTarget: { querySelectorAll: () => HTMLElement[] };
    }) => void;
    onKeyDown({
      key: "Escape",
      shiftKey: false,
      preventDefault: () => undefined,
      currentTarget: { querySelectorAll: () => [] },
    });
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe("submitHarnessConnect", () => {
  it("fires only for a valid target on an enabled control", () => {
    const onConnect = vi.fn();

    expect(submitHarnessConnect("root@harness", false, onConnect)).toBe(true);
    expect(onConnect).toHaveBeenCalledWith("root@harness");

    onConnect.mockClear();
    expect(submitHarnessConnect("root@", false, onConnect)).toBe(false);
    expect(submitHarnessConnect("root@harness", true, onConnect)).toBe(false);
    expect(onConnect).not.toHaveBeenCalled();
  });
});

describe("TailscaleLoginBanner", () => {
  it("renders a calm status banner whose anchor is the primary action", () => {
    const markup = renderToStaticMarkup(
      <TailscaleLoginBanner
        onDismiss={() => undefined}
        url="https://login.tailscale.com/a/abc123"
      />,
    );

    expect(markup).toContain('role="status"');
    expect(markup).toContain("Tailscale needs you to sign in.");
    expect(markup).toContain(
      '<a class="harness-banner-open" href="https://login.tailscale.com/a/abc123" rel="noreferrer noopener" target="_blank">Open login page</a>',
    );
    expect(markup).toContain(">Dismiss</button>");
  });

  it("keeps the href exactly as given and fires onDismiss", () => {
    const onDismiss = vi.fn();
    const banner = TailscaleLoginBanner({
      onDismiss,
      url: "https://login.tailscale.com/a/abc?x=1&y=2",
    });

    expect(propsOf(findByType(banner, "a")).href).toBe(
      "https://login.tailscale.com/a/abc?x=1&y=2",
    );

    const dismiss = propsOf(findByType(banner, "button")).onClick as
      (() => void) | undefined;
    dismiss?.();
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
