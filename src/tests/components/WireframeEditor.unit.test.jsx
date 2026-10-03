// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { WireframeEditor } from "../../components/WireframeEditor";

// Mock services
vi.mock("../../services/wireframeService", () => ({
  readWireframeSource: vi.fn().mockResolvedValue(null),
  writeWireframeSource: vi.fn().mockResolvedValue(true),
  writeWireframeImage: vi.fn().mockResolvedValue(true),
  readWireframeImage: vi.fn().mockResolvedValue(null)
}));

vi.mock("../../services/electronService", () => ({
  runExport: vi.fn().mockResolvedValue({ success: true })
}));

vi.mock("../../components/wireframe/exportUtils", () => ({
  exportWireframeToPng: vi.fn().mockResolvedValue("data:image/png;base64,mock")
}));

// Mock GrapesJS
const mockBlockManager = {
  add: vi.fn()
};
const mockUndoManager = {
  undo: vi.fn(),
  redo: vi.fn()
};
const mockCanvas = {
  setZoom: vi.fn()
};

const mockEditor = {
  BlockManager: mockBlockManager,
  UndoManager: mockUndoManager,
  Canvas: mockCanvas,
  on: vi.fn(),
  setDevice: vi.fn(),
  runCommand: vi.fn(),
  loadProjectData: vi.fn(),
  getProjectData: vi.fn().mockReturnValue({ pages: [] }),
  destroy: vi.fn(),
  getSelected: vi.fn(),
  addComponents: vi.fn().mockReturnValue([]),
  select: vi.fn(),
  getWrapper: vi.fn(() => ({
    set: vi.fn(),
    find: vi.fn(() => [])
  })),
  LayerManager: {
    render: vi.fn()
  }
};

vi.mock("grapesjs", () => ({
  default: {
    init: vi.fn(() => mockEditor)
  }
}));

function renderEditor(props) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);

  act(() => {
    root.render(<WireframeEditor {...props} />);
  });

  return {
    host,
    unmount() {
      act(() => {
        root.unmount();
      });
      host.remove();
    }
  };
}

function waitFor(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function changeInputValue(input, value) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  )?.set;
  nativeInputValueSetter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("WireframeEditor UI & Inspector", () => {
  let view;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    view?.unmount();
    document.body.innerHTML = "";
  });

  it("renders Wireframe Studio modal with toolbar, viewport switchers, and component search", async () => {
    view = renderEditor({
      diagramId: "wf-test-1",
      documentPath: "test.md",
      onClose: vi.fn(),
      onSave: vi.fn(),
      onNotify: vi.fn()
    });

    await waitFor(100);

    expect(view.host.textContent).toContain("Wireframe Studio");
    expect(view.host.textContent).toContain("Desktop");
    expect(view.host.textContent).toContain("Tablet");
    expect(view.host.textContent).toContain("Mobile");
    expect(view.host.textContent).toContain("Save");
    expect(view.host.textContent).toContain("Export PNG");
    expect(view.host.querySelector(".wireframe-search-input")).toBeTruthy();
  });

  it("filters stencil components by search query", async () => {
    view = renderEditor({
      diagramId: "wf-test-1",
      documentPath: "test.md",
      onClose: vi.fn(),
      onSave: vi.fn(),
      onNotify: vi.fn()
    });

    await waitFor(100);

    const searchInput = view.host.querySelector(".wireframe-search-input");
    act(() => {
      changeInputValue(searchInput, "Sidebar");
    });

    await waitFor(50);

    expect(view.host.textContent).toContain("Sidebar");
    expect(view.host.textContent).toContain("Icon-Only Sidebar");
    expect(view.host.textContent).not.toContain("Breadcrumb");
  });

  it("switches viewport device when device buttons are clicked", async () => {
    view = renderEditor({
      diagramId: "wf-test-1",
      documentPath: "test.md",
      onClose: vi.fn(),
      onSave: vi.fn(),
      onNotify: vi.fn()
    });

    await waitFor(100);

    const tabletBtn = view.host.querySelector('button[aria-label="Tablet viewport"]');
    act(() => {
      tabletBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(50);
    expect(mockEditor.setDevice).toHaveBeenCalledWith("Tablet");
  });

  it("switches between Properties, Structure, and Annotations inspector tabs", async () => {
    view = renderEditor({
      diagramId: "wf-test-1",
      documentPath: "test.md",
      onClose: vi.fn(),
      onSave: vi.fn(),
      onNotify: vi.fn()
    });

    await waitFor(100);

    expect(view.host.textContent).toContain("Properties");
    expect(view.host.textContent).toContain("Structure");
    expect(view.host.textContent).toContain("Annotations");
    expect(view.host.textContent).toContain("Select any element on canvas to inspect & configure");

    // Toggle Structure section
    const headers = view.host.querySelectorAll(".wireframe-section-header");
    const structureHeader = Array.from(headers).find((t) => t.textContent.includes("Structure"));
    const annotationsHeader = Array.from(headers).find((t) => t.textContent.includes("Annotations"));

    expect(view.host.querySelector(".wireframe-layers-container")).toBeTruthy();

    act(() => {
      structureHeader?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await waitFor(50);

    act(() => {
      annotationsHeader?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await waitFor(50);
    expect(view.host.textContent).toContain("No annotations yet");
  });
});

