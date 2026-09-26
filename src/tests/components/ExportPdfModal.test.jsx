// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExportPdfModal } from "../../components/ExportPdfModal";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("ExportPdfModal component", () => {
  let host;
  let root;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root.unmount();
      });
    }
    document.body.innerHTML = "";
  });

  it("renders all preset quality cards and target document name", async () => {
    const handleSelect = vi.fn();
    const handleExport = vi.fn();
    const handleClose = vi.fn();

    await act(async () => {
      root.render(
        <ExportPdfModal
          open={true}
          documentTitle="Architecture Design.md"
          pdfQualityPreset="full"
          onSelectPreset={handleSelect}
          onExport={handleExport}
          onClose={handleClose}
        />
      );
    });

    expect(host.textContent).toContain("Full quality");
    expect(host.textContent).toContain("Balanced size");
    expect(host.textContent).toContain("Compact file");

    const fullCard = host.querySelector('[data-preset-id="full"]');
    const balancedCard = host.querySelector('[data-preset-id="balanced"]');
    const compactCard = host.querySelector('[data-preset-id="compact"]');

    expect(fullCard.getAttribute("aria-checked")).toBe("true");
    expect(balancedCard.getAttribute("aria-checked")).toBe("false");
    expect(compactCard.getAttribute("aria-checked")).toBe("false");
  });

  it("triggers preset selection on click", async () => {
    const handleSelect = vi.fn();
    const handleExport = vi.fn();

    await act(async () => {
      root.render(
        <ExportPdfModal
          open={true}
          documentTitle="Guide.md"
          pdfQualityPreset="full"
          onSelectPreset={handleSelect}
          onExport={handleExport}
          onClose={vi.fn()}
        />
      );
    });

    const balancedCard = host.querySelector('[data-preset-id="balanced"]');
    act(() => {
      balancedCard.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(handleSelect).toHaveBeenCalledWith("balanced");
  });

  it("supports keyboard navigation with arrow keys", async () => {
    const handleSelect = vi.fn();

    await act(async () => {
      root.render(
        <ExportPdfModal
          open={true}
          documentTitle="Guide.md"
          pdfQualityPreset="full"
          onSelectPreset={handleSelect}
          onExport={vi.fn()}
          onClose={vi.fn()}
        />
      );
    });

    const fullCard = host.querySelector('[data-preset-id="full"]');
    act(() => {
      fullCard.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    });

    expect(handleSelect).toHaveBeenCalledWith("balanced");
  });

  it("triggers export on button click", async () => {
    const handleExport = vi.fn();

    await act(async () => {
      root.render(
        <ExportPdfModal
          open={true}
          documentTitle="Guide.md"
          pdfQualityPreset="balanced"
          onSelectPreset={vi.fn()}
          onExport={handleExport}
          onClose={vi.fn()}
        />
      );
    });

    const exportBtn = host.querySelector('[data-testid="export-pdf-confirm"]');
    expect(exportBtn).toBeTruthy();

    act(() => {
      exportBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(handleExport).toHaveBeenCalled();
  });
});
