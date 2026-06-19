// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MarkdownToolbar } from "./MarkdownToolbar";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function renderToolbar(props) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);

  act(() => {
    root.render(<MarkdownToolbar {...props} />);
  });

  return {
    host,
    rerender(nextProps) {
      act(() => {
        root.render(<MarkdownToolbar {...nextProps} />);
      });
    },
    unmount() {
      act(() => {
        root.unmount();
      });
      host.remove();
    },
  };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("MarkdownToolbar validation panel interactions", () => {
  it("opens validation panel and handles go-to-line + quick-fix actions", () => {
    const onChange = vi.fn();
    const onNotify = vi.fn();
    const onJumpToLine = vi.fn();

    const validationIssues = [
      {
        line: 2,
        column: 1,
        message: "Malformed table separator row.",
        ruleId: "table-separator",
      },
    ];

    const view = renderToolbar({
      value: "| A | B |\n| --- |\n| 1 | 2 |",
      onChange,
      textareaRef: { current: null },
      basePath: "",
      onNotify,
      validationStatus: "ready",
      validationIssues,
      onJumpToLine,
    });

    const validateButton = view.host.querySelector('button[title="Validate markdown syntax"]');
    expect(validateButton).toBeTruthy();

    act(() => {
      validateButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const panel = view.host.querySelector('.validation-panel[aria-label="Markdown validation"]');
    expect(panel).toBeTruthy();
    expect(panel.textContent).toContain("Malformed table separator row.");

    const goToLineButton = Array.from(panel.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Go to line")
    );
    expect(goToLineButton).toBeTruthy();

    act(() => {
      goToLineButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onJumpToLine).toHaveBeenCalledWith(2);

    const quickFixButton = Array.from(panel.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Quick fix")
    );
    expect(quickFixButton).toBeTruthy();

    act(() => {
      quickFixButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onNotify).toHaveBeenCalledWith("Fixed table separator.", "success");

    view.unmount();
  });
});
