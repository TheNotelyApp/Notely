import { ExternalLink, Folder, Download, Pencil, Brush, X, RotateCcw } from "lucide-react";
import AppButton from "../AppButton";
import AppIconButton from "../AppIconButton";
import { getDocumentKind } from "./mediaUtils";

export function MediaPreviewHeader({
  fileName,
  fileExtension,
  fileSize,
  mediaType,
  onOpenInDefaultApp,
  openingExternal = false,
  onRevealInExplorer = null,
  revealingInExplorer = false,
  onDownload,
  onEditImage,
  onAnnotateImage,
  onRestoreOriginal,
  hasOriginal = false,
  restoringOriginal = false,
  onClose,
  children,
}) {
  const kind = getDocumentKind(fileExtension);
  const extBadge = (fileExtension || mediaType || "").toUpperCase();

  return (
    <header className="media-preview-header" role="toolbar" aria-label="Media controls">
      <div className="media-preview-title-area">
        <span className="media-preview-icon" aria-hidden="true">{kind.icon}</span>
        <div className="media-preview-name-wrap">
          <span className="media-preview-filename" title={fileName}>{fileName}</span>
          <div className="media-preview-meta-row">
            {extBadge && <span className="media-preview-badge">{extBadge}</span>}
            {fileSize && <span className="media-preview-size">{fileSize}</span>}
          </div>
        </div>
      </div>

      <div className="media-preview-center-controls">
        {children}
      </div>

      <div className="media-preview-actions">
        {hasOriginal && onRestoreOriginal && (
          <AppButton
            variant="small"
            onClick={onRestoreOriginal}
            disabled={restoringOriginal}
            title="Restore original unedited image"
            aria-label="Restore original image"
          >
            <RotateCcw size={14} />
            <span>{restoringOriginal ? "Restoring..." : "Restore"}</span>
          </AppButton>
        )}

        {onEditImage && (
          <AppButton
            variant="small"
            onClick={onEditImage}
            title="Crop and resize image"
            aria-label="Edit image"
          >
            <Pencil size={14} />
            <span>Edit</span>
          </AppButton>
        )}

        {onAnnotateImage && (
          <AppButton
            variant="small"
            onClick={onAnnotateImage}
            title="Annotate and draw on image"
            aria-label="Annotate image"
          >
            <Brush size={14} />
            <span>Annotate</span>
          </AppButton>
        )}

        {onOpenInDefaultApp && (
          <AppButton
            variant="small"
            onClick={onOpenInDefaultApp}
            disabled={openingExternal}
            title="Open in default system application"
            aria-label="Open in default application"
          >
            <ExternalLink size={14} />
            <span>{openingExternal ? "Opening..." : "Open in App"}</span>
          </AppButton>
        )}

        {onRevealInExplorer && (
          <AppButton
            variant="small"
            onClick={onRevealInExplorer}
            disabled={revealingInExplorer}
            title="Show in File Explorer"
            aria-label="Reveal in File Explorer"
          >
            <Folder size={14} />
            <span>{revealingInExplorer ? "Locating..." : "Reveal"}</span>
          </AppButton>
        )}

        {onDownload && (
          <AppButton
            variant="small"
            onClick={onDownload}
            title="Save to Downloads folder"
            aria-label="Download file"
          >
            <Download size={14} />
            <span>Download</span>
          </AppButton>
        )}

        {onClose && (
          <AppIconButton
            size="sm"
            onClick={onClose}
            title="Close preview (Esc)"
            aria-label="Close media preview"
          >
            <X size={16} />
          </AppIconButton>
        )}
      </div>
    </header>
  );
}
