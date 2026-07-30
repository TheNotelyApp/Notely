import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FileText, X, ExternalLink } from "lucide-react";
import OverlayDialog from "./OverlayDialog";
import AppButton from "./AppButton";
import { MarkdownPreview } from "./MarkdownPreview";
import { readDocument } from "../services/electronService";

export function NotePreviewModal({
  open = false,
  filePath = null,
  lineNum = null,
  title = null,
  onClose,
  onOpenDocument
}) {
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Normalize path & line number
  let targetPath = filePath || "";
  let targetLine = lineNum;

  if (targetPath && targetPath.includes("#L")) {
    const parts = targetPath.split("#L");
    targetPath = parts[0];
    if (!targetLine && parts[1]) {
      targetLine = parseInt(parts[1], 10);
    }
  }

  if (targetPath.startsWith("file:///")) {
    targetPath = decodeURIComponent(targetPath.replace("file:///", ""));
    if (navigator.platform.indexOf("Win") !== -1) {
      targetPath = targetPath.replace(/\//g, "\\");
    }
  } else if (targetPath.startsWith("file://")) {
    targetPath = decodeURIComponent(targetPath.replace("file://", ""));
    if (navigator.platform.indexOf("Win") !== -1) {
      targetPath = targetPath.replace(/\//g, "\\");
    }
  }

  const fileName = title || targetPath.split(/[\\/]/).pop() || "Note Preview";

  useEffect(() => {
    if (!open || !targetPath) {
      setContent("");
      setError(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    async function loadNoteContent() {
      try {
        let noteText = "";

        try {
          const res = await readDocument(targetPath);
          noteText = typeof res === "string" ? res : res?.content || res?.text || "";
        } catch (apiErr) {
          console.warn("[NotePreviewModal] readDocument IPC fallback:", apiErr?.message);
        }

        if (!noteText && window.notesApi?.readMarkdownSource) {
          try {
            const res = await window.notesApi.readMarkdownSource(targetPath);
            noteText = typeof res === "string" ? res : res?.content || res?.text || "";
          } catch { /* ignore */ }
        }

        if (!noteText && typeof window !== "undefined" && window.require) {
          try {
            const fs = window.require("fs");
            if (fs && fs.existsSync && fs.existsSync(targetPath)) {
              noteText = fs.readFileSync(targetPath, "utf8");
            }
          } catch { /* ignore */ }
        }

        if (isMounted) {
          if (noteText) {
            setContent(noteText);
            setError(null);
          } else {
            setError(`Unable to read note file: "${targetPath}"`);
          }
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          console.error("[NotePreviewModal] Error reading note:", err);
          setError(`Failed to load note content: ${err.message}`);
          setIsLoading(false);
        }
      }
    }

    loadNoteContent();

    return () => {
      isMounted = false;
    };
  }, [open, targetPath]);

  if (!open) return null;

  const modalElement = (
    <OverlayDialog
      open={open}
      onClose={onClose}
      ariaLabel={`Preview of ${fileName}`}
      useDefaultCardClass={false}
      size=""
      cardClassName="note-preview-modal-card"
    >
      <div className="note-preview-modal-wrapper">
        <div className="note-preview-modal-header">
          <div className="note-preview-modal-title">
            <FileText size={16} style={{ color: "var(--accent-solid)", flexShrink: 0 }} />
            <span className="note-preview-modal-filename">
              {fileName}
            </span>
            {targetLine ? (
              <span className="note-preview-modal-line-badge">
                Line {targetLine}
              </span>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="note-preview-modal-close-btn"
            title="Close Preview"
            aria-label="Close Preview"
          >
            <X size={16} />
          </button>
        </div>

        <div className="note-preview-modal-body">
          {isLoading ? (
            <div className="note-preview-modal-loading">
              Loading note content…
            </div>
          ) : error ? (
            <div className="note-preview-modal-error">
              {error}
            </div>
          ) : content ? (
            <MarkdownPreview
              content={content}
              basePath={targetPath}
              readOnly
            />
          ) : (
            <div className="note-preview-modal-empty">
              Note is empty.
            </div>
          )}
        </div>

        <div className="note-preview-modal-footer">
          <AppButton variant="small" onClick={onClose}>
            Close
          </AppButton>

          <AppButton
            variant="primary"
            onClick={() => {
              onOpenDocument?.(targetPath, targetLine);
              onClose?.();
            }}
          >
            <ExternalLink size={14} />
            <span>Open in Editor</span>
          </AppButton>
        </div>
      </div>
    </OverlayDialog>
  );

  return typeof document !== "undefined"
    ? createPortal(modalElement, document.body)
    : modalElement;
}

export default NotePreviewModal;
