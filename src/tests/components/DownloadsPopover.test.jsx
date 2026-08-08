// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DownloadsPopover } from "../../components/DownloadsPopover";

const openExportFileMock = vi.fn();
const showInFolderMock = vi.fn();

vi.mock("../../services/electronService.js", () => ({
  openExportFile: (...args) => openExportFileMock(...args),
  showInFolder: (...args) => showInFolderMock(...args),
}));

describe("DownloadsPopover interaction tests", () => {
  let container = null;
  let root = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    openExportFileMock.mockClear();
    showInFolderMock.mockClear();
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root.unmount();
      });
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  function renderPopover(props) {
    act(() => {
      root.render(<DownloadsPopover {...props} />);
    });
  }

  it("calls openExportFile when clicking a download item directly", () => {
    const recent = [
      {
        id: "1",
        filename: "test-doc.pdf",
        filePath: "/downloads/test-doc.pdf",
        fileSize: 1024,
        timestamp: new Date().toISOString(),
        exportType: "pdf",
      },
    ];

    renderPopover({
      isOpen: true,
      onClose: vi.fn(),
      recentDownloads: recent,
    });

    const itemEl = container.querySelector(".downloads-popover-item");
    expect(itemEl).not.toBeNull();

    act(() => {
      itemEl.click();
    });

    expect(openExportFileMock).toHaveBeenCalledWith("/downloads/test-doc.pdf");
    expect(showInFolderMock).not.toHaveBeenCalled();
  });

  it("calls showInFolder without calling openExportFile when folder button is clicked", () => {
    const recent = [
      {
        id: "1",
        filename: "test-doc.pdf",
        filePath: "/downloads/test-doc.pdf",
        fileSize: 1024,
        timestamp: new Date().toISOString(),
        exportType: "pdf",
      },
    ];

    renderPopover({
      isOpen: true,
      onClose: vi.fn(),
      recentDownloads: recent,
    });

    const folderBtn = container.querySelector(".downloads-popover-action-btn");
    expect(folderBtn).not.toBeNull();
    expect(folderBtn.getAttribute("title")).toBe("Show in Folder");

    act(() => {
      folderBtn.click();
    });

    expect(showInFolderMock).toHaveBeenCalledWith("/downloads/test-doc.pdf");
    expect(openExportFileMock).not.toHaveBeenCalled();
  });

  it("does not render a separate Open File button on download items", () => {
    const recent = [
      {
        id: "1",
        filename: "test-doc.pdf",
        filePath: "/downloads/test-doc.pdf",
        fileSize: 1024,
        timestamp: new Date().toISOString(),
        exportType: "pdf",
      },
    ];

    renderPopover({
      isOpen: true,
      onClose: vi.fn(),
      recentDownloads: recent,
    });

    const openBtn = container.querySelector('[title="Open File"]');
    expect(openBtn).toBeNull();

    const actionBtns = container.querySelectorAll(".downloads-popover-action-btn");
    expect(actionBtns.length).toBe(1);
  });
});
