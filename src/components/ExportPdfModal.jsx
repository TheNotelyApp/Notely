import { useCallback } from "react";
import { X, FileDown, Sparkles, Layers, Zap, Check } from "lucide-react";
import OverlayDialog from "./OverlayDialog";
import AppButton from "./AppButton";
import AppIconButton from "./AppIconButton";
import "../styles/ExportPdfModal.css";

const PRESET_OPTIONS = [
  {
    id: "full",
    title: "Full quality",
    icon: Sparkles,
  },
  {
    id: "balanced",
    title: "Balanced size",
    isRecommended: true,
    icon: Layers,
  },
  {
    id: "compact",
    title: "Compact file",
    icon: Zap,
  },
];

export function ExportPdfModal({
  open,
  onClose,
  pdfQualityPreset = "full",
  onSelectPreset,
  onExport,
  isExporting = false,
}) {
  const handleKeyDown = useCallback(
    (e, currentId) => {
      const currentIndex = PRESET_OPTIONS.findIndex((p) => p.id === currentId);
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        const next = PRESET_OPTIONS[(currentIndex + 1) % PRESET_OPTIONS.length];
        onSelectPreset?.(next.id);
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        const prev = PRESET_OPTIONS[(currentIndex - 1 + PRESET_OPTIONS.length) % PRESET_OPTIONS.length];
        onSelectPreset?.(prev.id);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelectPreset?.(currentId);
      }
    },
    [onSelectPreset]
  );

  if (!open) return null;

  return (
    <OverlayDialog
      open={open}
      onClose={onClose}
      ariaLabel="Export PDF"
      size="sm"
    >
      <div className="overlay-dialog-header">
        <h2>Export PDF</h2>
        <AppIconButton onClick={onClose} aria-label="Close export dialog">
          <X size={16} />
        </AppIconButton>
      </div>

      <div className="overlay-dialog-field">
        <span id="pdf-quality-group-label">Quality preset</span>

        <div
          className="export-pdf-preset-list"
          role="radiogroup"
          aria-labelledby="pdf-quality-group-label"
          id="pdf-export-quality"
        >
          {PRESET_OPTIONS.map((preset) => {
            const isSelected = pdfQualityPreset === preset.id;
            const Icon = preset.icon;

            return (
              <div
                key={preset.id}
                role="radio"
                aria-checked={isSelected}
                tabIndex={isSelected ? 0 : -1}
                data-preset-id={preset.id}
                className={`export-pdf-option${isSelected ? " selected" : ""}`}
                onClick={() => onSelectPreset?.(preset.id)}
                onKeyDown={(e) => handleKeyDown(e, preset.id)}
              >
                <Icon size={18} className="export-pdf-icon" aria-hidden="true" />
                <div className="export-pdf-option-info">
                  <span className="export-pdf-option-title">{preset.title}</span>
                  {preset.isRecommended && (
                    <span className="export-pdf-recommended-tag">Recommended</span>
                  )}
                </div>
                <div className="export-pdf-check-slot" aria-hidden="true">
                  {isSelected && <Check size={16} className="export-pdf-check" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="overlay-dialog-actions">
        <AppButton variant="small" onClick={onClose} disabled={isExporting}>
          <X size={14} />
          Cancel
        </AppButton>
        <AppButton
          variant="primary"
          onClick={onExport}
          disabled={isExporting}
          data-testid="export-pdf-confirm"
        >
          <FileDown size={14} />
          {isExporting ? "Exporting..." : "Export"}
        </AppButton>
      </div>
    </OverlayDialog>
  );
}

export default ExportPdfModal;
