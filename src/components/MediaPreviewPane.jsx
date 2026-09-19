/**
 * MediaPreviewPane - Standardized viewer for all media & documents
 * (Images, PDFs, Excel spreadsheets, PPT presentations, Audio, Video, Text)
 */

import { useEffect, useRef, useState } from "react";
import AppButton from "./AppButton";
import { ImageCropModal } from "./ImageCropModal";
import { MediaPreviewHeader } from "./media/MediaPreviewHeader";
import { SpreadsheetViewer } from "./media/SpreadsheetViewer";
import { PresentationViewer } from "./media/PresentationViewer";
import { TextViewer } from "./media/TextViewer";
import { PdfViewer } from "./media/PdfViewer";
import { ImageViewer } from "./media/ImageViewer";
import { AudioVideoViewer } from "./media/AudioVideoViewer";
import { getDocumentKind, dataUrlToUint8Array } from "./media/mediaUtils";

import {
  getImageDimensions,
  getImageFileSize,
  formatFileSize,
} from "../utils/imageProcessingUtils";
import {
  readImage,
  replaceImage,
  getImageAnnotation,
  setImageAnnotation,
  getImageOriginalStatus,
  restoreImageOriginal,
  openMediaInDefaultApp,
  revealMediaInExplorer,
  runExport,
} from "../services/electronService";
import useConfirm from "../hooks/useConfirm";
import "../styles/mediaPreview.css";

export function MediaPreviewPane({
  mediaPath,
  mediaType,
  basePath,
  showOriginalImages = false,
  onClose,
  onMediaChanged,
}) {
  const { confirm } = useConfirm();
  const [error, setError] = useState(null);
  const [displayedImage, setDisplayedImage] = useState(null);
  const [imageInfo, setImageInfo] = useState(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [editImageSrc, setEditImageSrc] = useState("");
  const [annotationOnly, setAnnotationOnly] = useState(false);
  const [imageAnnotation, setImageAnnotationState] = useState(null);
  const [originalStatus, setOriginalStatus] = useState({ hasOriginal: false });
  const [restoringOriginal, setRestoringOriginal] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);

  const menuRef = useRef(null);

  const [resolvedPath, setResolvedPath] = useState(null);
  const [mediaBlobUrl, setMediaBlobUrl] = useState(null);
  const [openingExternal, setOpeningExternal] = useState(false);
  const [revealingInExplorer, setRevealingInExplorer] = useState(false);

  const fileName = (mediaPath || "").split(/[\\/]/).pop() || mediaPath;
  const fileExtension = String(fileName || "").split(".").pop()?.toLowerCase() || "";
  const docKind = getDocumentKind(fileExtension);

  // 1. Resolve media source
  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      if (!mediaPath) {
        if (!cancelled) setResolvedPath(null);
        return;
      }

      if (/^(data:|blob:|https?:)/i.test(mediaPath)) {
        if (!cancelled) setResolvedPath(mediaPath);
        return;
      }

      if (!basePath) {
        if (!cancelled) setResolvedPath(mediaPath);
        return;
      }

      try {
        const result = await readImage(basePath, mediaPath, { thumbnail: false });
        if (!cancelled) setResolvedPath(result || mediaPath);
      } catch {
        if (!cancelled) setResolvedPath(mediaPath);
      }
    }

    resolve();
    return () => {
      cancelled = true;
    };
  }, [basePath, mediaPath, mediaType, showOriginalImages]);

  // 2. Handle blob URL for video/audio if needed
  useEffect(() => {
    if ((mediaType === "video" || mediaType === "audio") && resolvedPath) {
      if (typeof resolvedPath === "string" && resolvedPath.startsWith("data:")) {
        const blob = dataUrlToUint8Array(resolvedPath);
        if (blob) {
          const mimeMatch = resolvedPath.slice(0, resolvedPath.indexOf(",")).match(/data:(.*?);/);
          const mimeType = mimeMatch ? mimeMatch[1] : (mediaType === "video" ? "video/mp4" : "audio/mpeg");
          const mediaBlob = new Blob([blob], { type: mimeType });
          const objectUrl = URL.createObjectURL(mediaBlob);
          setMediaBlobUrl(objectUrl);
          return () => {
            URL.revokeObjectURL(objectUrl);
          };
        }
      }
      setMediaBlobUrl(resolvedPath);
    } else {
      setMediaBlobUrl(null);
    }
  }, [resolvedPath, mediaType]);

  // 3. Load image details when resolved
  useEffect(() => {
    setError(null);
    setDisplayedImage(null);
    setImageInfo(null);
    setShowCropModal(false);
    setEditImageSrc("");
    setAnnotationOnly(false);
    setImageAnnotationState(null);
    setOriginalStatus({ hasOriginal: false });
    setRestoringOriginal(false);
    setContextMenu(null);

    if (!resolvedPath) return;

    if ((mediaType === "image" || docKind.type === "image") && mediaPath) {
      loadImage(resolvedPath);
      loadImageAnnotation();
      loadOriginalStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaPath, mediaType, resolvedPath, showOriginalImages]);

  const loadImageAnnotation = async () => {
    if (!basePath || !mediaPath || /^(data:|blob:|https?:)/i.test(mediaPath)) {
      setImageAnnotationState(null);
      return;
    }

    try {
      setImageAnnotationState(await getImageAnnotation(basePath, mediaPath));
    } catch {
      setImageAnnotationState(null);
    }
  };

  const loadOriginalStatus = async () => {
    if (!basePath || !mediaPath || /^(data:|blob:|https?:)/i.test(mediaPath)) {
      setOriginalStatus({ hasOriginal: false });
      return;
    }

    try {
      setOriginalStatus(await getImageOriginalStatus(basePath, mediaPath));
    } catch {
      setOriginalStatus({ hasOriginal: false });
    }
  };

  const loadImage = async (path) => {
    try {
      setDisplayedImage(path);
      try {
        const dimensions = await getImageDimensions(path);
        const fileSize = getImageFileSize(path);
        setImageInfo({
          dimensions,
          fileSize,
          formattedSize: formatFileSize(fileSize),
        });
      } catch {
        setImageInfo(null);
      }
    } catch (err) {
      setError(`Failed to load image: ${err.message}`);
    }
  };

  const readFullImage = async () => {
    if (!basePath || !mediaPath || /^(data:|blob:|https?:)/i.test(mediaPath)) {
      return displayedImage || resolvedPath;
    }
    return await readImage(basePath, mediaPath);
  };

  const handleDownloadMedia = async () => {
    try {
      const downloadSrc = resolvedPath || mediaPath;
      if (!downloadSrc) return;
      const rawName = String(fileName || mediaPath || "download").replace(/\\/g, "/");
      const name = rawName.split("/").pop() || "download";

      let dataUrl;
      let srcPath;

      if (typeof downloadSrc === "string" && downloadSrc.startsWith("data:")) {
        dataUrl = downloadSrc;
      } else if (typeof downloadSrc === "string" && (downloadSrc.startsWith("blob:") || downloadSrc.startsWith("http"))) {
        const resp = await fetch(downloadSrc);
        const blob = await resp.blob();
        dataUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
      } else if (resolvedPath || mediaPath) {
        srcPath = resolvedPath || mediaPath;
      }

      await runExport("media", {
        dataUrl,
        srcPath,
        filename: name,
        customExportType: mediaType === "pdf" ? "pdf" : mediaType === "video" ? "video" : mediaType === "audio" ? "audio" : mediaType === "image" ? "image" : fileExtension || "media",
        category: mediaType === "pdf" || mediaType === "document" ? "document" : "media",
      });
    } catch (err) {
      console.error("[MediaPreviewPane] Download media error:", err);
    }
  };

  const handleOpenInDefaultApp = async () => {
    if (!basePath || !mediaPath || /^(data:|blob:|https?:)/i.test(mediaPath)) return;
    try {
      setOpeningExternal(true);
      await openMediaInDefaultApp(basePath, mediaPath);
    } catch (err) {
      setError(`Failed to open file: ${err?.message || "Unknown error"}`);
    } finally {
      setOpeningExternal(false);
    }
  };

  const handleRevealInExplorer = async () => {
    if (!basePath || !mediaPath || /^(data:|blob:|https?:)/i.test(mediaPath)) return;
    try {
      setRevealingInExplorer(true);
      await revealMediaInExplorer(basePath, mediaPath);
    } catch (err) {
      setError(`Failed to locate file: ${err?.message || "Unknown error"}`);
    } finally {
      setRevealingInExplorer(false);
    }
  };

  const handleOpenCrop = async (options = {}) => {
    try {
      const fullImage = await readFullImage();
      setEditImageSrc(fullImage || displayedImage || resolvedPath || "");
      setAnnotationOnly(Boolean(options.annotationOnly));
      await loadImageAnnotation();
      setShowCropModal(true);
      setContextMenu(null);
    } catch (err) {
      setError(`Failed to open full image: ${err.message}`);
    }
  };

  const handleSaveCrop = async (editedDataUrl, annotation) => {
    try {
      setShowCropModal(false);
      if (basePath && mediaPath && !/^(data:|blob:|https?:)/i.test(mediaPath)) {
        if (editedDataUrl) {
          setDisplayedImage(editedDataUrl);
          const dimensions = await getImageDimensions(editedDataUrl);
          setImageInfo({
            ...imageInfo,
            dimensions,
            fileSize: getImageFileSize(editedDataUrl),
            formattedSize: formatFileSize(getImageFileSize(editedDataUrl)),
          });
          await replaceImage(basePath, mediaPath, editedDataUrl);
        }

        const savedAnnotation = await setImageAnnotation(basePath, mediaPath, annotation);
        setImageAnnotationState(savedAnnotation);
        await loadOriginalStatus();
        onMediaChanged?.(mediaPath);
      }
    } catch (err) {
      setError(`Failed to save image edit: ${err.message}`);
    }
  };

  const handleRestoreOriginal = async () => {
    if (!basePath || !mediaPath || restoringOriginal || !originalStatus?.hasOriginal) return;

    const approved = await confirm({
      title: "Restore Original Image",
      message: "Restore the original image from backup? This will overwrite current edits.",
      confirmLabel: "Restore Original",
      variant: "warning",
    });
    if (!approved) return;

    try {
      setRestoringOriginal(true);
      await restoreImageOriginal(basePath, mediaPath);
      const fullImage = await readImage(basePath, mediaPath);
      setDisplayedImage(fullImage || mediaPath);

      if (fullImage) {
        setEditImageSrc(fullImage);
      }

      try {
        const dimensions = await getImageDimensions(fullImage || mediaPath);
        const fileSize = getImageFileSize(fullImage || mediaPath);
        setImageInfo({
          dimensions,
          fileSize,
          formattedSize: formatFileSize(fileSize),
        });
      } catch {
        setImageInfo(null);
      }

      await loadOriginalStatus();
      onMediaChanged?.(mediaPath);
    } catch (err) {
      setError(`Failed to restore original image: ${err.message}`);
    } finally {
      setRestoringOriginal(false);
    }
  };

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;

    const handlePointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setContextMenu(null);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [contextMenu]);

  if (!mediaPath) {
    return null;
  }

  const isImage = mediaType === "image" || docKind.type === "image";
  const isPdf = mediaType === "pdf" || docKind.type === "pdf";
  const isSpreadsheet = docKind.type === "spreadsheet";
  const isPresentation = docKind.type === "presentation";
  const isText = docKind.type === "text";
  const isAudioVideo = mediaType === "video" || mediaType === "audio" || docKind.type === "video" || docKind.type === "audio";

  return (
    <div className="media-preview-pane">
      <MediaPreviewHeader
        fileName={fileName}
        fileExtension={fileExtension}
        fileSize={imageInfo?.formattedSize}
        mediaType={mediaType}
        onOpenInDefaultApp={basePath && !/^(data:|blob:|https?:)/i.test(mediaPath) ? handleOpenInDefaultApp : null}
        openingExternal={openingExternal}
        onRevealInExplorer={basePath && !/^(data:|blob:|https?:)/i.test(mediaPath) ? handleRevealInExplorer : null}
        revealingInExplorer={revealingInExplorer}
        onDownload={handleDownloadMedia}
        onEditImage={isImage ? () => handleOpenCrop({ annotationOnly: false }) : null}
        onAnnotateImage={isImage ? () => handleOpenCrop({ annotationOnly: true }) : null}
        onRestoreOriginal={isImage && originalStatus?.hasOriginal ? handleRestoreOriginal : null}
        hasOriginal={originalStatus?.hasOriginal}
        restoringOriginal={restoringOriginal}
        onClose={onClose}
      />

      <div className={`media-preview-content ${isPdf ? "pdf-mode" : ""}`}>
        {error && <div className="media-preview-error">{error}</div>}

        {isImage && !error && (
          <ImageViewer
            src={displayedImage || resolvedPath}
            annotation={imageAnnotation}
            dimensions={imageInfo?.dimensions}
            fileSize={imageInfo?.formattedSize}
            onError={() => setError("Failed to load image")}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu({ x: e.clientX, y: e.clientY });
            }}
          />
        )}

        {isPdf && !error && (
          <PdfViewer src={resolvedPath} />
        )}

        {isSpreadsheet && !error && (
          <SpreadsheetViewer dataUrl={resolvedPath} />
        )}

        {isPresentation && !error && (
          <PresentationViewer dataUrl={resolvedPath} />
        )}

        {isText && !error && (
          <TextViewer dataUrl={resolvedPath} />
        )}

        {isAudioVideo && !error && (
          <AudioVideoViewer
            src={mediaBlobUrl || resolvedPath}
            mediaType={mediaType || docKind.type}
            fileName={fileName}
          />
        )}

        {!isImage && !isPdf && !isSpreadsheet && !isPresentation && !isText && !isAudioVideo && !error && (
          <div className="media-preview-document-container">
            <div className="document-icon">{docKind.icon}</div>
            <p className="document-family">{docKind.family}</p>
            <p className="document-filename">{fileName}</p>
            <div style={{ display: "flex", gap: "8px", marginTop: "14px" }}>
              <AppButton
                variant="small"
                onClick={handleOpenInDefaultApp}
                disabled={!basePath || openingExternal}
              >
                {openingExternal ? "Opening..." : "Open in App"}
              </AppButton>
              <AppButton
                variant="small"
                onClick={handleRevealInExplorer}
                disabled={!basePath || revealingInExplorer}
              >
                {revealingInExplorer ? "Locating..." : "Show in Explorer"}
              </AppButton>
            </div>
          </div>
        )}
      </div>

      {showCropModal && editImageSrc && (
        <ImageCropModal
          open={showCropModal}
          imageSrc={editImageSrc}
          imageLabel={fileName}
          initialAnnotation={imageAnnotation}
          annotationOnly={annotationOnly}
          restoreOriginalAvailable={originalStatus?.hasOriginal}
          restoringOriginal={restoringOriginal}
          onClose={() => {
            setShowCropModal(false);
            setEditImageSrc("");
            setAnnotationOnly(false);
          }}
          onRestoreOriginal={handleRestoreOriginal}
          onSave={handleSaveCrop}
        />
      )}

      {contextMenu && (
        <div
          ref={menuRef}
          className="media-context-menu"
          style={{
            position: "fixed",
            top: `${contextMenu.y}px`,
            left: `${contextMenu.x}px`,
            zIndex: 10000,
          }}
        >
          <button
            className="media-context-menu-item"
            onClick={() => handleOpenCrop({ annotationOnly: false })}
          >
            ✏️ Edit image
          </button>
        </div>
      )}
    </div>
  );
}
