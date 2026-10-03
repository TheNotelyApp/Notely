// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useToast } from "../../hooks/useToast";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function TestToastHarness({ onHook }) {
  const toastState = useToast(2000);
  onHook(toastState);
  return null;
}

describe("useToast hook", () => {
  let host;
  let root;

  beforeEach(() => {
    vi.useFakeTimers();
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    host.remove();
    vi.restoreAllMocks();
  });

  it("adds a toast and auto-dismisses after duration", () => {
    let hookState;
    act(() => {
      root.render(<TestToastHarness onHook={(h) => (hookState = h)} />);
    });

    act(() => {
      hookState.notify("Hello World", "info");
    });

    expect(hookState.toasts).toHaveLength(1);
    expect(hookState.toasts[0].message).toBe("Hello World");
    expect(hookState.toasts[0].type).toBe("info");

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(hookState.toasts).toHaveLength(0);
  });

  it("deduplicates identical message within deduplication window", () => {
    let hookState;
    act(() => {
      root.render(<TestToastHarness onHook={(h) => (hookState = h)} />);
    });

    act(() => {
      hookState.notify("Note saved.", "success");
    });

    expect(hookState.toasts).toHaveLength(1);

    // Call notify again within 500ms with same text & type
    act(() => {
      vi.advanceTimersByTime(500);
      hookState.notify("Note saved.", "success");
    });

    // Should still be only 1 toast
    expect(hookState.toasts).toHaveLength(1);
  });

  it("allows different messages within dedupe window", () => {
    let hookState;
    act(() => {
      root.render(<TestToastHarness onHook={(h) => (hookState = h)} />);
    });

    act(() => {
      hookState.notify("Message 1", "info");
      hookState.notify("Message 2", "info");
    });

    expect(hookState.toasts).toHaveLength(2);
  });

  it("caps maximum visible toasts at 3", () => {
    let hookState;
    act(() => {
      root.render(<TestToastHarness onHook={(h) => (hookState = h)} />);
    });

    act(() => {
      hookState.notify("Toast 1", "info");
      hookState.notify("Toast 2", "info");
      hookState.notify("Toast 3", "info");
      hookState.notify("Toast 4", "info");
    });

    expect(hookState.toasts).toHaveLength(3);
    expect(hookState.toasts.map((t) => t.message)).toEqual(["Toast 2", "Toast 3", "Toast 4"]);
  });

  it("manually dismisses a toast", () => {
    let hookState;
    act(() => {
      root.render(<TestToastHarness onHook={(h) => (hookState = h)} />);
    });

    let id;
    act(() => {
      id = hookState.notify("To dismiss", "warning");
    });

    expect(hookState.toasts).toHaveLength(1);

    act(() => {
      hookState.dismiss(id);
    });

    expect(hookState.toasts).toHaveLength(0);
  });
});
