import { Download, Copy, X } from "lucide-react";
import OverlayDialog from "./OverlayDialog";
import AppButton from "./AppButton";
import AppIconButton from "./AppIconButton";

/**
 * Modal to view and play video recordings following Notely app standards.
 * Props:
 *   open        - boolean
 *   src         - video source URL / path
 *   title       - title / label for header
 *   onClose()   - callback when closed
 */
export function VideoPlayerModal({ open, src, title, onClose }) {
  if (!open || !src) return null;

  const fileName = src.split(/[\\/]/).pop() || "Screen Recording";

  function handleCopyPath() {
    navigator.clipboard.writeText(src);
  }

  return (
    <OverlayDialog
      open={open}
      onClose={onClose}
      ariaLabel="Video Player"
      size="lg"
      closeOnClickOutside
    >
      {/* Header */}
      <div className="overlay-dialog-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "16px" }}>🎥</span>
          <h3 className="overlay-dialog-title" style={{ margin: 0 }}>
            {title || fileName}
          </h3>
        </div>
        <AppIconButton onClick={onClose} title="Close (Esc)">
          <X size={16} />
        </AppIconButton>
      </div>

      {/* Video Content Body */}
      <div
        style={{
          width: "100%",
          maxHeight: "68vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000",
          borderRadius: "var(--radius-lg, 8px)",
          overflow: "hidden",
          margin: "12px 0 16px",
        }}
      >
        <video
          controls
          autoPlay
          src={src}
          style={{ width: "100%", maxHeight: "68vh", objectFit: "contain", display: "block" }}
        />
      </div>

      {/* Actions Footer */}
      <div
        className="overlay-dialog-actions"
        style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px" }}
      >
        <AppButton variant="small" onClick={handleCopyPath} title="Copy file path to clipboard">
          <Copy size={14} style={{ marginRight: "4px" }} />
          Copy Path
        </AppButton>
        <a href={src} download={fileName} style={{ textDecoration: "none" }}>
          <AppButton variant="primary" title="Download video file">
            <Download size={14} style={{ marginRight: "4px" }} />
            Download
          </AppButton>
        </a>
      </div>
    </OverlayDialog>
  );
}

export default VideoPlayerModal;

