// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DownloadsPage } from "../../components/DownloadsPage";
import * as electronService from "../../services/electronService";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../../services/electronService", () => ({
  getExportHistory: vi.fn(),
  clearExportHistory: vi.fn(),
  removeExportRecord: vi.fn(),
  openExportFile: vi.fn(),
  showInFolder: vi.fn(),
  getDefaultDownloadDir: vi.fn(),
  onExportRecordAdded: vi.fn(() => () => {}),
}));

const mockRecords = [
  {
    id: "exp-1",
    filename: "Summary_Report.pdf",
    filePath: "C:/Users/test/Downloads/Summary_Report.pdf",
    exportType: "pdf",
    fileSize: 1048576,
    timestamp: new Date().toISOString(),
    sourceNote: "Quarterly Summary",
  },
  {
    id: "exp-2",
    filename: "Architecture.excalidraw",
    filePath: "C:/Users/test/Downloads/Architecture.excalidraw",
    exportType: "diagram_excalidraw",
    fileSize: 524288,
    timestamp: new Date().toISOString(),
    sourceNote: "System Design",
  },
];

function renderDownloadsPage(props = {}) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);

  const defaultProps = {
    onBack: vi.fn(),
    ...props,
  };

  act(() => {
    root.render(<DownloadsPage {...defaultProps} />);
  });

  return {
    host,
    props: defaultProps,
    unmount() {
      act(() => {
        root.unmount();
      });
      host.remove();
    },
  };
}

describe("DownloadsPage component", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    electronService.getExportHistory.mockResolvedValue(mockRecords);
    electronService.getDefaultDownloadDir.mockResolvedValue("C:/Users/test/Downloads");
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders export history list and topbar controls", async () => {
    const view = renderDownloadsPage();

    await act(async () => {
      await Promise.resolve();
    });

    expect(view.host.querySelector(".detail-breadcrumb-current")?.textContent).toBe(
      "Downloads & Export History"
    );

    const cards = view.host.querySelectorAll(".downloads-card");
    expect(cards.length).toBe(2);
    expect(cards[0].textContent).toContain("Summary_Report.pdf");
    expect(cards[1].textContent).toContain("Architecture.excalidraw");

    view.unmount();
  });

  it("filters history by category tabs and search input", async () => {
    const view = renderDownloadsPage();

    await act(async () => {
      await Promise.resolve();
    });

    const tabs = view.host.querySelectorAll(".downloads-tab");
    const docsTab = Array.from(tabs).find((t) => t.textContent.includes("Documents"));
    expect(docsTab).toBeTruthy();

    act(() => {
      docsTab.click();
    });

    let cards = view.host.querySelectorAll(".downloads-card");
    expect(cards.length).toBe(1);
    expect(cards[0].textContent).toContain("Summary_Report.pdf");

    const allTab = Array.from(tabs).find((t) => t.textContent.includes("All"));
    act(() => {
      allTab.click();
    });

    const searchInput = view.host.querySelector(".downloads-search input");
    act(() => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )?.set;
      nativeInputValueSetter?.call(searchInput, "Architecture");
      searchInput.dispatchEvent(new Event("change", { bubbles: true }));
    });

    cards = view.host.querySelectorAll(".downloads-card");
    expect(cards.length).toBe(1);
    expect(cards[0].textContent).toContain("Architecture.excalidraw");

    view.unmount();
  });
});
