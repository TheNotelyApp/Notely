import { useState, useEffect, useMemo, useRef, forwardRef } from "react";
import {
  Upload,
  Music,
  Film,
  FileDigit,
  MessageSquareText,
  Image as ImageIcon,
  FileText,
  Search,
  X,
  LayoutGrid,
  List,
  Globe,
  FolderOpen,
  UploadCloud,
  Paperclip,
  Plus,
} from "lucide-react";
import { AppSelect } from "./AppSelect";
import { listImages, listDocuments, readImage } from "../services/electronService";
import { insertMediaFromFile } from "../services/imageService";
import { MEDIA_FILE_INPUT_ACCEPT } from "../utils/mediaTypeUtils";
import {
  getAssetMediaType,
  decodePathForDisplay,
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
  const searchInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState("workspace"); // "workspace" | "web" | "upload"
  const [viewMode, setViewMode] = useState("grid"); // "grid" | "list"
  const [assetSearch, setAssetSearch] = useState("");
  const [assetFilter, setAssetFilter] = useState("all");
  const [linkText, setLinkText] = useState("");
  const [assetUrl, setAssetUrl] = useState("");
  const [internalAssets, setInternalAssets] = useState([]);
  const [internalLoading, setInternalLoading] = useState(false);
  const [internalError, setInternalError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [thumbnailMap, setThumbnailMap] = useState({});

  const rawAvailableAssets = propAvailableAssets !== undefined ? propAvailableAssets : internalAssets;
  const availableAssets = useMemo(() => {
    return rawAvailableAssets.map((asset) => {
      const rawNormalized = String(asset.path || asset.filePath || "").replace(/\\/g, "/").trim();
      const withoutQuery = rawNormalized.split(/[?#]/)[0];
      const parts = withoutQuery.split("/").filter(Boolean);
      const rawFileName = parts.length ? parts[parts.length - 1] : rawNormalized;
      const decodedFileName = decodePathForDisplay(rawFileName) || rawFileName;

      let folderDir = "";
      if (parts.length > 1) {
        const dirParts = parts.slice(0, -1).filter((p) => p !== ".");
        folderDir = dirParts.length ? `${dirParts.join("/")}/` : "";
      }

      const title = asset.type === "document"
        ? (asset.title || asset.fileName || decodedFileName || "Untitled note").trim()
        : (asset.title && asset.title !== rawNormalized && !asset.title.includes("/")
            ? asset.title
            : decodedFileName);

      let displayPath = asset.displayPath || folderDir || "";
      if (displayPath === title || displayPath === decodedFileName) {
        displayPath = folderDir;
      }

      return {
        ...asset,
        title,
        displayPath: displayPath.replace(/^\.\//, ""),
      };
    });
  }, [rawAvailableAssets]);

  const assetsLoading = propAssetsLoading !== undefined ? propAssetsLoading : internalLoading;
  const [localError, setLocalError] = useState("");
  const assetsError = propAssetsError || internalError || localError;

  useEffect(() => {
    if (!isOpen) {
      setAssetSearch("");
      setLinkText("");
      setAssetUrl("");
      setLocalError("");
      setActiveTab("workspace");
      setSelectedIndex(-1);
      setSelectedAsset(null);
      setThumbnailMap({});
      return;
    }

    searchInputRef.current?.focus();

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
        ? imagesResult.value.map((pathValue) => {
            const rawNormalized = String(pathValue || "").replace(/\\/g, "/").trim();
            const withoutQuery = rawNormalized.split(/[?#]/)[0];
            const parts = withoutQuery.split("/").filter(Boolean);
            const rawFileName = parts.length ? parts[parts.length - 1] : rawNormalized;
            const decodedTitle = decodePathForDisplay(rawFileName) || rawFileName;

            let folderDir = "";
            if (parts.length > 1) {
              const dirParts = parts.slice(0, -1).filter((p) => p !== ".");
              folderDir = dirParts.length ? `${dirParts.join("/")}/` : "";
            }

            return {
              type: "media",
              path: pathValue,
              fileName: rawFileName,
              mediaType: getAssetMediaType(pathValue),
              title: decodedTitle,
              displayPath: folderDir,
            };
          })
        : [];

      const currentPathLower = String(basePath || "").trim().toLowerCase();
      const docsList = docsResult.status === "fulfilled" && Array.isArray(docsResult.value)
        ? docsResult.value
            .filter((doc) => String(doc?.filePath || "").trim().toLowerCase() !== currentPathLower)
            .map((doc) => {
              const fileNameLower = String(doc.fileName || "").toLowerCase();
              const titleLower = String(doc.title || "").toLowerCase();
              const pathLower = String(doc.filePath || "").toLowerCase();
              const isTranscriptDoc =
                fileNameLower.includes("transcript") ||
                titleLower.includes("transcript") ||
                pathLower.includes("transcript");

              const title = (doc.title || doc.fileName || "Untitled note").trim();
              let displayPath = doc.displayPath || "";
              if (!displayPath || displayPath === title || displayPath === doc.fileName) {
                const normPath = String(doc.filePath || "").replace(/\\/g, "/");
                const parts = normPath.split("/").filter(Boolean);
                displayPath = parts.length > 1 ? `${parts.slice(0, -1).join("/")}/` : "";
              }

              return {
                type: "document",
                path: doc.filePath,
                fileName: doc.fileName,
                title,
                displayPath,
                mediaType: isTranscriptDoc ? "transcript" : "document",
              };
            })
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

  // Resolve disk thumbnails for images & videos via IPC
  useEffect(() => {
    let isCancelled = false;
    if (!isOpen || !availableAssets.length) return;

    const visualMedia = availableAssets.filter(
      (a) => a.type === "media" && (a.mediaType === "image" || a.mediaType === "video")
    );

    if (!visualMedia.length) return;

    Promise.allSettled(
      visualMedia.map(async (asset) => {
        try {
          if (
            asset.path.startsWith("http://") ||
            asset.path.startsWith("https://") ||
            asset.path.startsWith("data:")
          ) {
            return { path: asset.path, src: asset.path };
          }
          const src = await readImage(basePath || "", asset.path, { thumbnail: true });
          return { path: asset.path, src };
        } catch {
          return { path: asset.path, src: null };
        }
      })
    ).then((results) => {
      if (isCancelled) return;
      const newMap = {};
      for (const r of results) {
        if (r.status === "fulfilled" && r.value?.src) {
          newMap[r.value.path] = r.value.src;
        }
      }
      setThumbnailMap((prev) => ({ ...prev, ...newMap }));
    });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, availableAssets, basePath]);

  const hasValidAssetUrl = isValidHttpUrl(assetUrl.trim());

  // Category item counts
  const categoryCounts = useMemo(() => {
    const counts = {
      all: availableAssets.length,
      image: 0,
      audio: 0,
      transcript: 0,
      video: 0,
      pdf: 0,
      document: 0,
    };
    for (const asset of availableAssets) {
      if (asset.mediaType === "transcript") {
        counts.transcript += 1;
      }
      if (asset.type === "document") {
        counts.document += 1;
      } else if (counts[asset.mediaType] !== undefined && asset.mediaType !== "transcript") {
        counts[asset.mediaType] += 1;
      }
    }
    return counts;
  }, [availableAssets]);

  const filteredAssets = useMemo(() => {
    return availableAssets.filter((asset) => {
      if (assetFilter !== "all" && assetFilter !== "All Media") {
        const f = assetFilter.toLowerCase();
        if (f === "document" || f === "documents" || f === "notes") {
          if (asset.type !== "document" && asset.mediaType !== "document") return false;
        } else if (f === "transcript" || f === "transcripts") {
          const isTranscript =
            asset.mediaType === "transcript" ||
            (asset.title && asset.title.toLowerCase().includes("transcript")) ||
            (asset.fileName && asset.fileName.toLowerCase().includes("transcript")) ||
            (asset.path && asset.path.toLowerCase().includes("transcript"));
          if (!isTranscript) return false;
        } else {
          const norm = f.replace(/s$/, "");
          if (asset.mediaType !== norm && asset.mediaType !== f) {
            return false;
          }
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

  // Reset selected asset & index when filter or tab changes
  useEffect(() => {
    setSelectedIndex(-1);
    setSelectedAsset(null);
  }, [assetFilter, assetSearch, activeTab]);

  const handleProcessFile = async (file) => {
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
    }
  };

  const handleFileInputChange = async (event) => {
    const file = event.target.files?.[0];
    await handleProcessFile(file);
    if (event.target) event.target.value = "";
  };

  const handleDrop = async (event) => {
    event.preventDefault();
    setIsDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      await handleProcessFile(file);
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    setIsDragOver(false);
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

  const handleSelectAsset = (asset, idx) => {
    setSelectedAsset(asset);
    if (typeof idx === "number") {
      setSelectedIndex(idx);
    }
  };

  const handleInsertAsset = (asset) => {
    const targetAsset = asset || selectedAsset;
    if (!targetAsset) return;

    if (targetAsset.type === "document") {
      const text = linkText.trim() || targetAsset.title || targetAsset.fileName || "Linked note";
      let relativePath = toRelativeDocPath(basePath, targetAsset.path);
      if (relativePath && !hasMarkdownExtension(relativePath) && hasMarkdownExtension(targetAsset.fileName)) {
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

    const label = linkText.trim() || targetAsset.title || targetAsset.fileName || "Media";
    const markdown = createMediaMarkdown(label, targetAsset.path);
    onInsert?.(markdown, label);
    onClose?.();
  };

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      onClose?.();
      return;
    }

    if (activeTab !== "workspace" || !filteredAssets.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      const next = selectedIndex < 0 ? 0 : (selectedIndex + 1) % filteredAssets.length;
      setSelectedIndex(next);
      setSelectedAsset(filteredAssets[next]);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const prev = selectedIndex <= 0 ? filteredAssets.length - 1 : selectedIndex - 1;
      setSelectedIndex(prev);
      setSelectedAsset(filteredAssets[prev]);
    } else if (event.key === "Enter") {
      const target = selectedAsset || (selectedIndex >= 0 ? filteredAssets[selectedIndex] : null);
      if (target) {
        event.preventDefault();
        handleInsertAsset(target);
      }
    }
  };

  const getMediaIcon = (mediaType, type) => {
    if (type === "document") return <FileText size={16} />;
    switch (mediaType) {
      case "image": return <ImageIcon size={16} />;
      case "audio": return <Music size={16} />;
      case "video": return <Film size={16} />;
      case "transcript": return <MessageSquareText size={16} />;
      case "pdf": return <FileDigit size={16} />;
      default: return <FileText size={16} />;
    }
  };

  const renderCardVisual = (asset) => {
    const resolvedSrc = thumbnailMap[asset.path];
    const fallbackSrc = asset.path.startsWith("http")
      ? asset.path
      : `file://${asset.path.replace(/\\/g, "/")}`;
    const imageSrc = resolvedSrc || fallbackSrc;

    if (asset.mediaType === "image") {
      return (
        <>
          <img
            src={imageSrc}
            alt={asset.title}
            loading="lazy"
            onError={(e) => {
              e.target.style.display = "none";
              const fallback = e.target.parentElement?.querySelector(".media-picker-card-preview-fallback");
              if (fallback) fallback.style.display = "flex";
            }}
          />
          <div className="media-picker-card-preview-fallback" style={{ display: "none" }}>
            <ImageIcon size={20} />
          </div>
        </>
      );
    }

    if (asset.mediaType === "video") {
      if (resolvedSrc) {
        return (
          <video
            src={resolvedSrc}
            muted
            preload="metadata"
            playsInline
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        );
      }
      return (
        <div className="media-picker-video-preview">
          <Film size={20} className="media-picker-video-icon" />
        </div>
      );
    }

    if (asset.mediaType === "audio") {
      return (
        <div className="media-picker-audio-preview">
          <Music size={20} className="media-picker-audio-icon" />
          <div className="media-picker-audio-wave">
            <span /><span /><span /><span /><span />
          </div>
        </div>
      );
    }

    if (asset.mediaType === "pdf") {
      return (
        <div className="media-picker-pdf-preview">
          <FileDigit size={20} className="media-picker-pdf-icon" />
          <span className="media-picker-pdf-badge">PDF</span>
        </div>
      );
    }

    if (asset.type === "document" || asset.mediaType === "document") {
      return (
        <div className="media-picker-doc-preview">
          <FileText size={20} className="media-picker-doc-icon" />
          <div className="media-picker-doc-lines">
            <span /><span /><span />
          </div>
        </div>
      );
    }

    return (
      <div className="media-picker-card-preview-icon">
        {getMediaIcon(asset.mediaType, asset.type)}
      </div>
    );
  };

  return (
    <div
      className="image-linker media-picker-popover"
      ref={ref}
      role="dialog"
      aria-label="Media & attachments picker"
      onKeyDown={handleKeyDown}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={MEDIA_FILE_INPUT_ACCEPT}
        style={{ display: "none" }}
        onChange={handleFileInputChange}
      />

      {/* Header */}
      <div className="media-picker-header">
        <div className="media-picker-title-group">
          <div className="media-picker-title-icon">
            <Paperclip size={16} />
          </div>
          <h3 className="media-picker-title">Insert Media & Attachments</h3>
        </div>
        <button
          className="media-picker-close-btn"
          onClick={onClose}
          data-tooltip="Close"
          type="button"
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>

      {/* 3-Tab Segmented Control */}
      <div className="media-picker-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "workspace"}
          className={`media-picker-tab-btn ${activeTab === "workspace" ? "active" : ""}`}
          onClick={() => setActiveTab("workspace")}
        >
          <FolderOpen size={14} />
          <span>Workspace Assets</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "web"}
          className={`media-picker-tab-btn ${activeTab === "web" ? "active" : ""}`}
          onClick={() => setActiveTab("web")}
        >
          <Globe size={14} />
          <span>Web URL</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "upload"}
          className={`media-picker-tab-btn ${activeTab === "upload" ? "active" : ""}`}
          onClick={() => setActiveTab("upload")}
        >
          <UploadCloud size={14} />
          <span>Upload & Drop</span>
        </button>
      </div>

      {/* TAB 1: WORKSPACE ASSETS */}
      {activeTab === "workspace" && (
        <>
          {/* Search bar & Type Dropdown */}
          <div className="media-picker-search-row">
            <div className="media-picker-search-field">
              <Search size={14} className="media-picker-search-icon" />
              <input
                ref={searchInputRef}
                className="media-picker-search-input"
                value={assetSearch}
                onChange={(e) => setAssetSearch(e.target.value)}
                placeholder="Search files, notes, transcripts, diagrams..."
              />
              {assetSearch && (
                <button
                  type="button"
                  className="media-picker-search-clear"
                  onClick={() => setAssetSearch("")}
                  aria-label="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <AppSelect
              aria-label="Filter workspace assets"
              value={assetFilter}
              onChange={(e) => setAssetFilter(e.target.value)}
              className="media-picker-select"
            >
              <option value="all">All Media</option>
              <option value="Images">Images</option>
              <option value="Audio">Audio</option>
              <option value="Transcripts">Transcripts</option>
              <option value="Videos">Videos</option>
              <option value="PDFs">PDFs</option>
              <option value="Documents">Documents</option>
            </AppSelect>
          </div>

          {/* View controls */}
          <div className="media-picker-view-controls">
            <span>{filteredAssets.length} item{filteredAssets.length === 1 ? "" : "s"} found</span>
            <div className="media-picker-view-toggle">
              <button
                type="button"
                className={`media-picker-view-btn ${viewMode === "grid" ? "active" : ""}`}
                onClick={() => setViewMode("grid")}
                title="Grid view"
                aria-label="Grid view"
              >
                <LayoutGrid size={14} />
              </button>
              <button
                type="button"
                className={`media-picker-view-btn ${viewMode === "list" ? "active" : ""}`}
                onClick={() => setViewMode("list")}
                title="List view"
                aria-label="List view"
              >
                <List size={14} />
              </button>
            </div>
          </div>

          {/* Error / Loading States */}
          {assetsError && <p className="toolbar-inline-error">{assetsError}</p>}
          {assetsLoading ? <p className="toolbar-inline-note">Loading workspace assets...</p> : null}

          {/* Assets Grid / List View */}
          {!assetsLoading && !filteredAssets.length ? (
            <p className="toolbar-inline-note">No matching media or notes found.</p>
          ) : viewMode === "grid" ? (
            <div className="image-linker-list compact media-picker-grid">
              {filteredAssets.map((asset, idx) => (
                <button
                  key={asset.path}
                  className={`media-picker-card ${selectedAsset?.path === asset.path ? "selected" : ""}`}
                  onClick={() => handleSelectAsset(asset, idx)}
                  onDoubleClick={() => handleInsertAsset(asset)}
                  data-tooltip={asset.path}
                  type="button"
                >
                  <div className="media-picker-card-preview">
                    {renderCardVisual(asset)}
                    <span className="media-picker-card-badge">
                      {asset.type === "document" ? "NOTE" : asset.mediaType}
                    </span>
                  </div>
                  <div className="media-picker-card-info">
                    <span className="media-picker-card-title" title={asset.title}>{asset.title}</span>
                    {asset.displayPath && asset.displayPath !== asset.title ? (
                      <span className="media-picker-card-sub" title={asset.displayPath}>{asset.displayPath}</span>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="image-linker-list compact">
              {filteredAssets.map((asset, idx) => (
                <button
                  key={asset.path}
                  className={`image-linker-note-item ${selectedAsset?.path === asset.path ? "selected" : ""}`}
                  onClick={() => handleSelectAsset(asset, idx)}
                  onDoubleClick={() => handleInsertAsset(asset)}
                  data-tooltip={asset.path}
                  type="button"
                >
                  <span className="image-linker-note-icon">
                    {getMediaIcon(asset.mediaType, asset.type)}
                  </span>
                  <div className="image-linker-note-info">
                    <span className="image-linker-note-title" title={asset.title}>{asset.title}</span>
                    {asset.displayPath && asset.displayPath !== asset.title ? (
                      <span className="image-linker-note-path" title={asset.displayPath}>{asset.displayPath}</span>
                    ) : null}
                  </div>
                  <span className="image-linker-note-badge">
                    {asset.type === "document" ? "NOTE" : asset.mediaType.toUpperCase()}
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* TAB 2: WEB URL */}
      {activeTab === "web" && (
        <div className="media-picker-form">
          <div className="media-picker-form-field">
            <label className="media-picker-form-label">
              Web URL (Image, Audio, Video, or Document)
            </label>
            <input
              className="media-picker-form-input"
              value={assetUrl}
              onChange={(e) => {
                setAssetUrl(e.target.value);
                setLocalError("");
              }}
              placeholder="https://example.com/media.png"
              autoFocus
            />
          </div>
          <div className="media-picker-form-field">
            <label className="media-picker-form-label">
              Link Text / Alt Label (optional)
            </label>
            <input
              className="media-picker-form-input"
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              placeholder="Defaults to URL or item name"
            />
          </div>

          {assetUrl.trim() && !hasValidAssetUrl ? (
            <p className="toolbar-inline-error">Use a valid http/https URL.</p>
          ) : null}

          <div className="media-picker-form-actions">
            <button
              type="button"
              onClick={handleLinkAssetFromUrl}
              disabled={!hasValidAssetUrl}
              className="primary-button"
            >
              <Plus size={14} />
              <span>Insert Web Link</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: UPLOAD & DROPZONE */}
      {activeTab === "upload" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div
            className={`media-picker-dropzone ${isDragOver ? "drag-active" : ""}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="media-picker-dropzone-icon">
              <UploadCloud size={20} />
            </div>
            <div className="media-picker-dropzone-title">
              {uploading ? "Uploading file..." : "Drop file here or click to browse"}
            </div>
            <div className="media-picker-dropzone-hint">
              Images, Audio, Videos, PDFs, Transcripts, Documents
            </div>
          </div>

          <div className="media-picker-upload-actions">
            <button
              type="button"
              className="small-button"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Upload size={14} />
              <span>Browse Computer</span>
            </button>
          </div>
        </div>
      )}

      {/* Footer / Actions */}
      {activeTab === "workspace" && (
        <div className="media-picker-footer" style={{ justifyContent: "flex-end" }}>
          <button
            type="button"
            className="primary-button"
            disabled={!selectedAsset}
            onClick={() => handleInsertAsset(selectedAsset)}
            style={{ height: "28px", padding: "0 14px", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <Plus size={14} />
            <span>Insert</span>
          </button>
        </div>
      )}
    </div>
  );
});

export default MediaAttachmentPicker;
