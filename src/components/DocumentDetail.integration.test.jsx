// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DocumentDetail } from "./DocumentDetail";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function renderDetail(props) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);

  act(() => {
    root.render(<DocumentDetail {...props} />);
  });

  return {
    host,
    rerender(nextProps) {
      act(() => {
        root.render(<DocumentDetail {...nextProps} />);
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

describe("DocumentDetail popup and panel toggles", () => {
  const baseProps = {
    document: {
      title: "Example Note",
      fileName: "example-note.md",
      filePath: "C:/notes/example-note.md",
      header: "Title: Example Note",
      rawNotes: "# Heading\nBody",
      cleansed: "Formal",
      metadata: {},
    },
    history: [
      {
        versionPath: "C:/notes/.notes-app/versions/example-note/2026-06-20_12-00-00.md",
        createdAt: "2026-06-20T12:00:00.000Z",
        reason: "manual-save",
      },
    ],
    activeTab: "raw",
    setActiveTab: vi.fn(),
    mode: "edit",
    setMode: vi.fn(),
    onChange: vi.fn(),
    onSave: vi.fn(),
    onRefreshHistory: vi.fn(),
    saving: false,
    dirty: false,
    onNotify: vi.fn(),
    menuAction: null,
  };

  it("opens versions popup from menu action", () => {
    const view = renderDetail(baseProps);
    act(() => {
      view.rerender({
        ...baseProps,
        menuAction: { action: "manage-versions", nonce: Date.now() },
      });
    });

    const popup = view.host.querySelector('[aria-label="Versions"]');
    expect(popup).toBeTruthy();
    expect(popup.textContent).toContain("manual-save");

    view.unmount();
  });

  it("requests outline toggle from menu action", () => {
    const view = renderDetail(baseProps);
    const onOutlineEnabledChange = vi.fn();

    expect(onOutlineEnabledChange).not.toHaveBeenCalled();

    act(() => {
      view.rerender({
        ...baseProps,
        menuAction: { action: "toggle-outline-enabled", nonce: Date.now() },
        outlineEnabled: true,
        onOutlineEnabledChange,
      });
    });

    expect(onOutlineEnabledChange).toHaveBeenCalledTimes(1);

    view.unmount();
  });

  it("does not process the same menu nonce twice", () => {
    const view = renderDetail(baseProps);
    const onOutlineEnabledChange = vi.fn();
    const nonce = Date.now();

    act(() => {
      view.rerender({
        ...baseProps,
        menuAction: { action: "toggle-outline-enabled", nonce },
        onOutlineEnabledChange,
      });
    });

    act(() => {
      view.rerender({
        ...baseProps,
        menuAction: { action: "toggle-outline-enabled", nonce },
        onOutlineEnabledChange,
      });
    });

    expect(onOutlineEnabledChange).toHaveBeenCalledTimes(1);

    view.unmount();
  });

  it("opens find panel from menu action", () => {
    const view = renderDetail(baseProps);

    act(() => {
      view.rerender({
        ...baseProps,
        menuAction: { action: "find-replace", nonce: Date.now() },
      });
    });

    expect(view.host.querySelector('[aria-label="Find and replace"]')).toBeTruthy();

    view.unmount();
  });

  it("toggles split mode from menu action", () => {
    const setMode = vi.fn();
    const view = renderDetail({
      ...baseProps,
      setMode,
      menuAction: { action: "toggle-split-preview", nonce: Date.now() },
    });

    expect(setMode).toHaveBeenCalled();

    view.unmount();
  });

  it("keeps remove action out of document topbar", () => {
    const view = renderDetail(baseProps);
    const removeButton = view.host.querySelector('button[title="Move note to removed folder"]');

    expect(removeButton).toBeFalsy();

    view.unmount();
  });

  it("hides outline panel when outline is disabled", () => {
    const view = renderDetail({
      ...baseProps,
      outlineEnabled: false,
      onOutlineEnabledChange: vi.fn(),
    });

    const workspace = view.host.querySelector(".workspace");
    expect(workspace?.className).toContain("outline-panel-disabled");
    expect(view.host.querySelector("aside.outline-panel")).toBeFalsy();

    view.unmount();
  });

  it("keeps AI sidebar while outline is disabled", () => {
    const view = renderDetail({
      ...baseProps,
      outlineEnabled: false,
      onOutlineEnabledChange: vi.fn(),
      aiSidebar: <section data-testid="ai-sidebar">AI</section>,
    });

    const workspace = view.host.querySelector(".workspace");
    expect(workspace?.className).toContain("outline-panel-disabled");
    expect(workspace?.className).toContain("with-ai-chat");
    expect(view.host.querySelector("aside.outline-panel")).toBeFalsy();
    expect(view.host.querySelector('[data-testid="ai-sidebar"]')).toBeTruthy();

    view.unmount();
  });

  it("supports Ctrl+S save shortcut with notification", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onNotify = vi.fn();
    const view = renderDetail({
      ...baseProps,
      onSave,
      onNotify,
      dirty: true,
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true }));
    });

    expect(onSave).toHaveBeenCalled();
    expect(onNotify).toHaveBeenCalledWith("Note saved.", "success");

    view.unmount();
  });
});