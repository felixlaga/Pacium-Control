import type { KeyboardEvent } from "react";

const MODAL_FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not(:disabled)",
  "input:not(:disabled)",
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

export type ModalKeyAction = "close" | "focus-first" | "focus-last" | null;

export function resolveModalKeyAction(input: {
  activeIndex: number;
  focusableCount: number;
  key: string;
  shiftKey: boolean;
}): ModalKeyAction {
  if (input.key === "Escape") {
    return "close";
  }
  if (input.key !== "Tab" || input.focusableCount === 0) {
    return null;
  }
  if (input.activeIndex < 0) {
    return input.shiftKey ? "focus-last" : "focus-first";
  }
  if (input.shiftKey && input.activeIndex === 0) {
    return "focus-last";
  }
  if (!input.shiftKey && input.activeIndex === input.focusableCount - 1) {
    return "focus-first";
  }
  return null;
}

export function handleModalKeyDown(
  event: KeyboardEvent<HTMLElement>,
  container: HTMLElement | null,
  onClose: () => void,
): void {
  const focusable =
    container === null
      ? []
      : [...container.querySelectorAll<HTMLElement>(MODAL_FOCUSABLE_SELECTOR)];
  const action = resolveModalKeyAction({
    activeIndex: focusable.findIndex(
      (element) => element === document.activeElement,
    ),
    focusableCount: focusable.length,
    key: event.key,
    shiftKey: event.shiftKey,
  });

  if (action === null) {
    return;
  }
  event.preventDefault();
  if (action === "close") {
    onClose();
    return;
  }
  if (action === "focus-first") {
    focusable[0]?.focus();
    return;
  }
  focusable.at(-1)?.focus();
}
