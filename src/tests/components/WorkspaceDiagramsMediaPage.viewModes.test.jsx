// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WorkspaceDiagramsMediaPage from "../../components/WorkspaceDiagramsMediaPage";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../../services/electronService", () => ({
  listDiskMediaAssets: vi.fn().mockResolvedValue([
    { name: "architecture.png", path: "assets/architecture.png", size: 10240, category: "image" },
    { name: "recording.mp3", path: "assets/recording.mp3", size: 204800, category: "audio" },
  ]),
  readImage: vi.fn().mockResolvedValue("data:image/png;base64,mock"),
  openMediaInDefaultApp: vi.fn().mockResolvedValue(true),
  deleteImage: vi.fn().mockResolvedValue(true),
  runExport: vi.fn().mockResolvedValue(true),
}));

vi.mock("../../services/documentExtractionService", () => ({
  getAllExtractionRecords: vi.fn().mockResolvedValue([]),
  forceReextract: vi.fn().mockResolvedValue(null),
  subscribeExtractionStatus: vi.fn().mockReturnValue(() => {}),
}));

describe("WorkspaceDiagramsMediaPage View Modes (Cards, Icons, List)", () => {
  let host;
  let root;

  const mockDocuments = [
    {
      filePath: "/test/workspace/Note1.md",
      title: "Note 1",
      content: "![Architecture](assets/architecture.png)\n```mermaid\ngraph TD; A-->B;\n```",
    },
  ];

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    localStorage.clear();
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root.unmount();
      });
    }
    if (host) {
      host.remove();
    }
    vi.restoreAllMocks();
  });

  it("renders Cards view by default and allows switching to Icons and List views", async () => {
    await act(async () => {
      root.render(
        <WorkspaceDiagramsMediaPage
          documents={mockDocuments}
          workspacePath="/test/workspace"
          onBack={vi.fn()}
        />
      );
    });

    // Check view switcher is present with 3 modes
    const viewButtons = host.querySelectorAll(".wdm-view-mode-btn");
    expect(viewButtons.length).toBe(3);

    // Initial default view mode is cards
    expect(host.querySelector(".wdm-cards-grid")).toBeTruthy();

    // Click Icon View button
    const iconBtn = Array.from(viewButtons).find((b) => b.textContent.includes("Icons"));
    expect(iconBtn).toBeTruthy();

    await act(async () => {
      iconBtn.click();
    });

    // Icons grid should now be rendered
    expect(host.querySelector(".wdm-icons-grid")).toBeTruthy();
    expect(host.querySelector(".wdm-cards-grid")).toBeNull();
    expect(host.querySelector(".wdm-table")).toBeNull();

    // Click List View button
    const listBtn = Array.from(viewButtons).find((b) => b.textContent.includes("List"));
    expect(listBtn).toBeTruthy();

    await act(async () => {
      listBtn.click();
    });

    // Table view should now be rendered
    expect(host.querySelector(".wdm-table")).toBeTruthy();
    expect(host.querySelector(".wdm-icons-grid")).toBeNull();
    expect(host.querySelector(".wdm-cards-grid")).toBeNull();
  });
});
