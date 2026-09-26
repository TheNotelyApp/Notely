import { useState, useEffect, useMemo, useRef, forwardRef } from "react";
import {
  Upload,
  ExternalLink,
  Music,
  Film,
  FileDigit,
  MessageSquareText,
  Image as ImageIcon,
  FileText,
} from "lucide-react";
import { AppSelect } from "./AppSelect";
import { listImages, listDocuments } from "../services/electronService";
import { insertMediaFromFile } from "../services/imageService";
import { MEDIA_FILE_INPUT_ACCEPT } from "../utils/mediaTypeUtils";
import {
  getAssetMediaType,
  getAssetPathDisplayLabel,
  createMediaMarkdown,
  toRelativeDocPath,
  normalizeImagePathForMarkdown,
  hasMarkdownExtension,
} from "../utils/markdownUtils";

function isValidHttpUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export const MediaAttachmentPicker = forwardRef(function MediaAttachmentPicker(
  {
    isOpen,
    onClose,
    basePath,
    availableAssets: propAvailableAssets,
    assetsLoading: propAssetsLoading,
    assetsError: propAssetsError,
    onInsert,
    onNotify,
  },
  ref
) {
  const fileInputRef = useRef(null);
  const [assetSearch, setAssetSearch] = useState("");
  const [assetFilter, setAssetFilter] = useState("all");
  const [linkText, setLinkText] = useState("");
  const [assetUrl, setAssetUrl] = useState("");
  const [internalAssets, setInternalAssets] = useState([]);
  const [internalLoading, setInternalLoading] = useState(false);
  const [internalError, setInternalError] = useState("");
  const [uploading, setUploading] = useState(false);

  const availableAssets = propAvailableAssets !== undefined ? propAvailableAssets : internalAssets;
  const assetsLoading = propAssetsLoading !== undefined ? propAssetsLoading : internalLoading;
  const [localError, setLocalError] = useState("");
  const assetsError = propAssetsError || internalError || localError;

  useEffect(() => {
    if (!isOpen) {
      setAssetSearch("");
      setLinkText("");
      setAssetUrl("");
      setLocalError("");
      return;
    }

    if (propAvailableAssets !== undefined) return;

    if (!basePath) {
      setInternalAssets([]);
      setInternalError("Save or open a note file before linking workspace assets.");
      return;
    }

    let isCancelled = false;
    setInternalLoading(true);
    setInternalError("");

    Promise.allSettled([
      listImages(basePath),
      listDocuments(),
    ]).then(([imagesResult, docsResult]) => {
      if (isCancelled) return;
      const mediaList = imagesResult.status === "fulfilled" && Array.isArray(imagesResult.value)
        ? imagesResult.value.map((pathValue) => ({
            type: "media",
            path: pathValue,
            mediaType: getAssetMediaType(pathValue),
            title: getAssetPathDisplayLabel(pathValue) || pathValue,
          }))
        : [];

      const currentPathLower = String(basePath || "").trim().toLowerCase();
      const docsList = docsResult.status === "fulfilled" && Array.isArray(docsResult.value)
        ? docsResult.value
            .filter((doc) => String(doc?.filePath || "").trim().toLowerCase() !== currentPathLower)
            .map((doc) => ({
              type: "document",
              path: doc.filePath,
              fileName: doc.fileName,
              title: (doc.title || doc.fileName || "Untitled note").trim(),
              displayPath: doc.displayPath || doc.filePath,
              mediaType: "document",
            }))
        : [];

      setInternalAssets([...mediaList, ...docsList]);
      setInternalLoading(false);
    }).catch((err) => {
      if (isCancelled) return;
      setInternalAssets([]);
      setInternalError(err?.message || "Unable to load workspace assets.");
      setInternalLoading(false);
    });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, basePath, propAvailableAssets]);

  const hasValidAssetUrl = isValidHttpUrl(assetUrl.trim());

  const filteredAssets = useMemo(() => {
    return availableAssets.filter((asset) => {
      if (assetFilter !== "all" && assetFilter !== "all-types") {
        if (assetFilter === "document") {
          if (asset.type !== "document") return false;
        } else if (asset.mediaType !== assetFilter) {
          return false;
        }
      }

      const search = assetSearch.trim().toLowerCase();
      if (!search) return true;
      const label = [asset.title, asset.path, asset.fileName, asset.displayPath]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return label.includes(search);
    });
  }, [availableAssets, assetFilter, assetSearch]);

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { mediaPath, altText } = await insertMediaFromFile(file);
      const markdown = createMediaMarkdown(altText, mediaPath);
      onInsert?.(markdown, altText);
      onNotify?.("Media uploaded and inserted.", "success");
      onClose?.();
    } catch (error) {
      console.error("Upload failed:", error);
      setLocalError(error?.message || "Failed to upload file.");
      onNotify?.(error?.message || "Failed to upload file.", "error");
    } finally {
      setUploading(false);
      if (event.target) event.target.value = "";
    }
  };

  if (!isOpen) return null;

  const handleLinkAssetFromUrl = () => {
    const rawUrl = assetUrl.trim();
    if (!isValidHttpUrl(rawUrl)) {
      setLocalError("Use a valid http/https URL.");
      return;
    }
    const label = linkText.trim() || "Web link";
    const markdown = `[${label}](${rawUrl})`;
    onInsert?.(markdown, label);
    onClose?.();
  };

  const handleSelectAsset = (asset) => {
    if (asset.type === "document") {
      const text = linkText.trim() || asset.title || asset.fileName || "Linked note";
      let relativePath = toRelativeDocPath(basePath, asset.path);
      if (relativePath && !hasMarkdownExtension(relativePath) && hasMarkdownExtension(asset.fileName)) {
        relativePath = `${relativePath}.md`;
      }
      const normalizedPath = normalizeImagePathForMarkdown(relativePath);
      if (!normalizedPath || normalizedPath === "./" || normalizedPath === ".") {
        setLocalError("Choose a different note. Linking current note is not supported.");
        return;
      }
      onInsert?.(`[${text}](${normalizedPath})`, text);
      onClose?.();
      return;
    }

    const label = linkText.trim() || getAssetPathDisplayLabel(asset.path) || "Media";
    const markdown = createMediaMarkdown(label, asset.path);
    onInsert?.(markdown, label);
    onClose?.();
  };

  return (
    <div className="image-linker" ref={ref} role="dialog" aria-label="Media & attachments picker">
      <input
        ref={fileInputRef}
        type="file"
        accept={MEDIA_FILE_INPUT_ACCEPT}
        style={{ display: "none" }}
        onChange={handleFileUpload}
      />

      <div className="mermaid-builder-header">
        <strong>Insert Media & Attachments</strong>
        <button className="mermaid-close" onClick={onClose} data-tooltip="Close">
          x
        </button>
      </div>

      <div style={{ display: "flex", gap: "8px", margin: "10px 0 12px" }}>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", height: "28px", fontSize: "12px" }}
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <Upload size={14} />
          <span>{uploading ? "Uploading..." : "Upload from Computer"}</span>
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", height: "28px", fontSize: "12px" }}
          onClick={() => {
            window.dispatchEvent(new CustomEvent("notely:open-media-gallery"));
            onClose?.();
          }}
          title="Open full Media Gallery"
        >
          <ExternalLink size={14} />
          <span>Media Gallery</span>
        </button>
      </div>

      <div className="mermaid-fields">
        <label>
          Search media & files
          <input
            value={assetSearch}
            onChange={(event) => setAssetSearch(event.target.value)}
            placeholder="Type file name or path"
          />
        </label>
        <label>
          Category
          <AppSelect
            value={assetFilter}
            onChange={(event) => setAssetFilter(event.target.value)}
          >
            <option value="all">All Media</option>
            <option value="image">Images</option>
            <option value="audio">Audio</option>
            <option value="video">Videos</option>
            <option value="transcript">Transcripts</option>
            <option value="pdf">PDFs</option>
            <option value="document">Documents</option>
          </AppSelect>
        </label>
        <label>
          Link label (optional)
          <input
            value={linkText}
            onChange={(event) => setLinkText(event.target.value)}
            placeholder="Defaults to item name"
          />
        </label>
        <label>
          External URL (optional)
          <input
            value={assetUrl}
            onChange={(event) => {
              setAssetUrl(event.target.value);
              setAssetsError("");
            }}
            placeholder="https://example.com/file"
          />
        </label>
      </div>

      <div className="image-linker-url-actions">
        <button onClick={handleLinkAssetFromUrl} disabled={!hasValidAssetUrl}>Insert Web Media URL</button>
      </div>

      {assetUrl.trim() && !hasValidAssetUrl ? (
        <p className="toolbar-inline-error">Use a valid http/https URL.</p>
      ) : null}

      {assetsError && <p className="toolbar-inline-error">{assetsError}</p>}
      {assetsLoading ? <p className="toolbar-inline-note">Loading workspace assets...</p> : null}

      {!assetsLoading && !filteredAssets.length ? (
        <p className="toolbar-inline-note">No matching media or files found.</p>
      ) : (
        <div className="image-linker-list compact">
          {filteredAssets.map((asset) => (
            <button
              key={asset.path}
              className="image-linker-note-item"
              onClick={() => handleSelectAsset(asset)}
              data-tooltip={asset.path}
              type="button"
            >
              <span className="image-linker-note-title" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ opacity: 0.7, display: "inline-flex" }}>
                  {asset.mediaType === "audio" ? <Music size={14} /> :
                   asset.mediaType === "video" ? <Film size={14} /> :
                   asset.mediaType === "pdf" ? <FileDigit size={14} /> :
                   asset.mediaType === "transcript" ? <MessageSquareText size={14} /> :
                   asset.type === "document" ? <FileText size={14} /> :
                   <ImageIcon size={14} />}
                </span>
                <span>{asset.title}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

export default MediaAttachmentPicker;
