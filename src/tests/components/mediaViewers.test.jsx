// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { MediaPreviewHeader } from "../../components/media/MediaPreviewHeader";
import { SpreadsheetViewer } from "../../components/media/SpreadsheetViewer";
import { PresentationViewer } from "../../components/media/PresentationViewer";
import { TextViewer } from "../../components/media/TextViewer";
import { getDocumentKind, dataUrlToUint8Array } from "../../components/media/mediaUtils";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("Media Viewers & Standardized Header", () => {
  let host;
  let root;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    host.remove();
    host = null;
    root = null;
  });

  it("classifies document extensions correctly in getDocumentKind", () => {
    expect(getDocumentKind("xlsx").type).toBe("spreadsheet");
    expect(getDocumentKind("csv").type).toBe("spreadsheet");
    expect(getDocumentKind("pptx").type).toBe("presentation");
    expect(getDocumentKind("pdf").type).toBe("pdf");
    expect(getDocumentKind("png").type).toBe("image");
    expect(getDocumentKind("mp4").type).toBe("video");
    expect(getDocumentKind("mp3").type).toBe("audio");
    expect(getDocumentKind("txt").type).toBe("text");
    expect(getDocumentKind("json").type).toBe("text");
  });

  it("renders standardized MediaPreviewHeader with actions and triggers callbacks", async () => {
    const onOpenInDefaultApp = vi.fn();
    const onRevealInExplorer = vi.fn();
    const onDownload = vi.fn();
    const onClose = vi.fn();

    await act(async () => {
      root.render(
        <MediaPreviewHeader
          fileName="Quarterly_Report.xlsx"
          fileExtension="xlsx"
          fileSize="1.2 MB"
          mediaType="document"
          onOpenInDefaultApp={onOpenInDefaultApp}
          onRevealInExplorer={onRevealInExplorer}
          onDownload={onDownload}
          onClose={onClose}
        />
      );
    });

    expect(host.textContent).toContain("Quarterly_Report.xlsx");
    expect(host.textContent).toContain("XLSX");
    expect(host.textContent).toContain("1.2 MB");

    const openInAppBtn = host.querySelector('button[aria-label="Open in default application"]');
    expect(openInAppBtn).not.toBeNull();
    openInAppBtn.click();
    expect(onOpenInDefaultApp).toHaveBeenCalledTimes(1);

    const revealBtn = host.querySelector('button[aria-label="Reveal in File Explorer"]');
    expect(revealBtn).not.toBeNull();
    revealBtn.click();
    expect(onRevealInExplorer).toHaveBeenCalledTimes(1);

    const downloadBtn = host.querySelector('button[aria-label="Download file"]');
    expect(downloadBtn).not.toBeNull();
    downloadBtn.click();
    expect(onDownload).toHaveBeenCalledTimes(1);

    const closeBtn = host.querySelector('button[aria-label="Close media preview"]');
    expect(closeBtn).not.toBeNull();
    closeBtn.click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders SpreadsheetViewer with sheet tabs, rows and search filter", async () => {
    // Generate a real sample XLSX workbook using SheetJS
    const wb = XLSX.utils.book_new();
    const wsData = [
      ["Product", "Revenue", "Units"],
      ["Widget A", 1200, 50],
      ["Gadget B", 3400, 80],
      ["Widget C", 2100, 30],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Sales 2026");

    const ws2Data = [
      ["Region", "Target"],
      ["North", 5000],
      ["South", 4000],
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(ws2Data);
    XLSX.utils.book_append_sheet(wb, ws2, "Targets");

    const wbBytes = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const b64 = btoa(String.fromCharCode(...new Uint8Array(wbBytes)));
    const dataUrl = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${b64}`;

    await act(async () => {
      root.render(<SpreadsheetViewer dataUrl={dataUrl} fileName="report.xlsx" />);
    });

    expect(host.textContent).toContain("Widget A");
    expect(host.textContent).toContain("Gadget B");
    expect(host.textContent).toContain("Sales 2026");
    expect(host.textContent).toContain("Targets");

    // Search filter
    const searchInput = host.querySelector(".spreadsheet-search-input");
    expect(searchInput).not.toBeNull();

    await act(async () => {
      searchInput.value = "Gadget";
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
      searchInput.dispatchEvent(new Event("change", { bubbles: true }));
    });
  });

  it("renders PresentationViewer and navigates slides", async () => {
    // Generate sample PPTX zip structure using JSZip
    const zip = new JSZip();
    zip.file("ppt/presentation.xml", "<p:presentation></p:presentation>");
    zip.file(
      "ppt/slides/slide1.xml",
      `<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
        <p:cSld><p:spTree><p:sp><p:txBody>
          <a:p><a:t>Executive Summary</a:t></a:p>
          <a:p><a:t>Key performance metrics for Q3</a:t></a:p>
        </p:txBody></p:sp></p:spTree></p:cSld>
      </p:sld>`
    );
    zip.file(
      "ppt/slides/slide2.xml",
      `<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
        <p:cSld><p:spTree><p:sp><p:txBody>
          <a:p><a:t>Financial Roadmap</a:t></a:p>
          <a:p><a:t>Projected runway and ARR growth</a:t></a:p>
        </p:txBody></p:sp></p:spTree></p:cSld>
      </p:sld>`
    );

    const pptxBytes = await zip.generateAsync({ type: "uint8array" });
    const b64 = btoa(String.fromCharCode(...pptxBytes));
    const dataUrl = `data:application/vnd.openxmlformats-officedocument.presentationml.presentation;base64,${b64}`;

    await act(async () => {
      root.render(<PresentationViewer dataUrl={dataUrl} fileName="deck.pptx" />);
    });

    // Wait for async parsing
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(host.textContent).toContain("Executive Summary");
    expect(host.textContent).toContain("1 / 2");

    // Click next slide
    const nextBtn = host.querySelector('button[aria-label="Next slide"]');
    expect(nextBtn).not.toBeNull();

    await act(async () => {
      nextBtn.click();
    });

    expect(host.textContent).toContain("Financial Roadmap");
    expect(host.textContent).toContain("2 / 2");
  });

  it("renders TextViewer with line numbers and content", async () => {
    const rawText = "Line 1: Hello world\nLine 2: Server started\nLine 3: 200 OK";
    const b64 = btoa(rawText);
    const dataUrl = `data:text/plain;base64,${b64}`;

    await act(async () => {
      root.render(<TextViewer dataUrl={dataUrl} fileName="server.log" />);
    });

    expect(host.textContent).toContain("Line 1: Hello world");
    expect(host.textContent).toContain("Line 2: Server started");
    expect(host.textContent).toContain("Line 3: 200 OK");
    expect(host.textContent).toContain("3 lines");
  });
});
