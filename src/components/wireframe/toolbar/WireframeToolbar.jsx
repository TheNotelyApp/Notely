import React from "react";
import {
  Download,
  Eye,
  EyeOff,
  Layout,
  Monitor,
  Redo2,
  Save,
  Smartphone,
  Tablet,
  Undo2,
  X
} from "lucide-react";
import AppButton from "../../AppButton";

export function WireframeToolbar({
  activeDevice,
  onSetDevice,
  gridVisible,
  onToggleBorders,
  onUndo,
  onRedo,
  hasUnsavedChanges,
  isSaving,
  isExporting,
  isLoading,
  onDownload,
  onSave,
  onClose,
  saveButtonRef
}) {
  return (
    <header className="wireframe-studio-header">
      {/* Brand */}
      <div className="wireframe-studio-title-group">
        <div className="wireframe-studio-logo">
          <Layout size={14} color="var(--text-on-accent, #ffffff)" />
        </div>
        <span className="wireframe-studio-title">Wireframe Studio</span>
      </div>

      <div className="wireframe-header-divider" />

      {/* Viewport switchers */}
      <div className="wireframe-viewport-controls">
        <button
          type="button"
          className={`wireframe-vp-btn ${activeDevice === "Desktop" ? "active" : ""}`}
          onClick={() => onSetDevice("Desktop")}
          data-tooltip="Desktop viewport (1200px)"
          aria-label="Desktop viewport"
        >
          <Monitor size={14} />
          <span>Desktop</span>
        </button>
        <button
          type="button"
          className={`wireframe-vp-btn ${activeDevice === "Tablet" ? "active" : ""}`}
          onClick={() => onSetDevice("Tablet")}
          data-tooltip="Tablet viewport (768px)"
          aria-label="Tablet viewport"
        >
          <Tablet size={14} />
          <span>Tablet</span>
        </button>
        <button
          type="button"
          className={`wireframe-vp-btn ${activeDevice === "Mobile" ? "active" : ""}`}
          onClick={() => onSetDevice("Mobile")}
          data-tooltip="Mobile viewport (375px)"
          aria-label="Mobile viewport"
        >
          <Smartphone size={14} />
          <span>Mobile</span>
        </button>
      </div>

      <div className="wireframe-header-divider" />

      {/* Canvas tool icons */}
      <div className="wireframe-canvas-tools">
        <button
          type="button"
          className="wireframe-tool-icon-btn"
          onClick={onUndo}
          data-tooltip="Undo (Ctrl+Z)"
          aria-label="Undo"
        >
          <Undo2 size={14} />
        </button>
        <button
          type="button"
          className="wireframe-tool-icon-btn"
          onClick={onRedo}
          data-tooltip="Redo (Ctrl+Y)"
          aria-label="Redo"
        >
          <Redo2 size={14} />
        </button>
        <span className="wireframe-tool-sep" />
        <button
          type="button"
          className={`wireframe-tool-icon-btn ${gridVisible ? "active" : ""}`}
          onClick={onToggleBorders}
          data-tooltip="Toggle Layout Bounds"
          aria-label="Toggle layout bounds"
        >
          {gridVisible ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
      </div>

      {/* Action buttons */}
      <div className="wireframe-action-buttons">
        {hasUnsavedChanges && <span className="wf-unsaved-dot" title="Unsaved changes" />}
        <AppButton
          variant="small"
          onClick={onDownload}
          disabled={isSaving || isExporting || isLoading}
          title="Export wireframe as PNG"
        >
          <Download size={14} aria-hidden="true" />
          <span>{isExporting ? "Exporting..." : "Export PNG"}</span>
        </AppButton>
        <AppButton
          ref={saveButtonRef}
          variant="primary"
          onClick={onSave}
          disabled={isSaving || isExporting || isLoading}
          title="Save wireframe (Ctrl+S)"
        >
          <Save size={14} aria-hidden="true" />
          <span>{isSaving ? "Saving..." : "Save"}</span>
        </AppButton>
        <AppButton
          variant="small"
          iconOnly
          onClick={onClose}
          disabled={isSaving || isExporting}
          title="Close"
          aria-label="Close"
        >
          <X size={14} aria-hidden="true" />
        </AppButton>
      </div>
    </header>
  );
}
