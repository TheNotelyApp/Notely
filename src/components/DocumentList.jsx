import { formatDate } from "../utils/dateUtils";
import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { readImage, listDocuments } from "../services/electronService";
import { DocumentEntryActions } from "./DocumentEntryActions";
import { getDocumentDensityProfile, normalizeDocumentDensity } from "./documentDensityProfiles";
import { useWorkspaceMetadata } from "../hooks/useWorkspaceMetadata";
import { getContrastColor } from "../utils/colorUtils";
import { IconColorPickerModal } from "./IconColorPickerModal";
import * as LucideIcons from "lucide-react";
import { useNoteDragDrop } from "../utils/noteDragDrop";

function EntryIcon({ entryType, icon }) {
  const className = `document-kind-icon ${entryType} ${icon ? 'custom-avatar' : ''}`;
  
  if (icon && LucideIcons[icon]) {
    const IconComp = LucideIcons[icon];
    return <IconComp className={className} />;
  }

  if (entryType === "folder") {
    return (
      <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <path d="M2.5 5.5A1.5 1.5 0 0 1 4 4h4.1a2 2 0 0 1 1.4.58l1.02 1.02A1 1 0 0 0 11.24 6H16a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 16 16H4a1.5 1.5 0 0 1-1.5-1.5z" />
      </svg>
    );
  }

  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M5 2.5h6.6a2 2 0 0 1 1.4.58l2.92 2.92A2 2 0 0 1 16.5 7.4V15A2.5 2.5 0 0 1 14 17.5H5A2.5 2.5 0 0 1 2.5 15V5A2.5 2.5 0 0 1 5 2.5m0 1.5A1 1 0 0 0 4 5v10a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V7.6a.5.5 0 0 0-.15-.36l-2.9-2.9a.5.5 0 0 0-.35-.14z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className="document-calendar-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M6 2.5a.75.75 0 0 1 .75.75V4h6.5v-.75a.75.75 0 1 1 1.5 0V4H15a2.5 2.5 0 0 1 2.5 2.5V15A2.5 2.5 0 0 1 15 17.5H5A2.5 2.5 0 0 1 2.5 15V6.5A2.5 2.5 0 0 1 5 4h.25v-.75A.75.75 0 0 1 6 2.5M4 8v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V8zm1-2.5a1 1 0 0 0-1 1V6.5h12a1 1 0 0 0-1-1h-.25v.75a.75.75 0 1 1-1.5 0V5.5h-6.5v.75a.75.75 0 1 1-1.5 0V5.5z" />
    </svg>
  );
}

export function DocumentList({
  documents,
  onOpen,
  onRemove,
  onMoveDocument,
  loading,
  viewMode = "tile",
  density = "comfortable",
  favorites = [],
  onToggleFavorite,
  emptyMessage,
  onCopyLinkPath,
  _onTransferWorkspace,
}) {
  const { getMetadata, updateMetadata } = useWorkspaceMetadata();
  const [pickerState, setPickerState] = useState({ isOpen: false, entry: null });
  const [contextMenu, setContextMenu] = useState(null);
  const menuRef = useRef(null);
  const [resolvedPreviewImages, setResolvedPreviewImages] = useState({});

  const [expandedFolders, setExpandedFolders] = useState({});
  const [folderChildren, setFolderChildren] = useState({});
  const [loadingFolders, setLoadingFolders] = useState({});

  const refreshFolder = useCallback(async (folderPath) => {
    if (!folderPath) return;
    setLoadingFolders((l) => ({ ...l, [folderPath]: true }));
    try {
      const children = await listDocuments(folderPath);
      setFolderChildren((fc) => ({
        ...fc,
        [folderPath]: Array.isArray(children) ? children : []
      }));
    } catch (err) {
      console.error("Failed to load subfolder documents:", err);
    } finally {
      setLoadingFolders((l) => ({ ...l, [folderPath]: false }));
    }
  }, []);

  const toggleFolder = useCallback((folderPath) => {
    setExpandedFolders((prev) => {
      const isCurrentlyExpanded = Boolean(prev[folderPath]);
      const nextExpanded = !isCurrentlyExpanded;

      if (nextExpanded && !(folderPath in folderChildren)) {
        refreshFolder(folderPath);
      }

      return { ...prev, [folderPath]: nextExpanded };
    });
  }, [folderChildren, refreshFolder]);

  useEffect(() => {
    Object.keys(expandedFolders).forEach((folderPath) => {
      if (expandedFolders[folderPath] && !(folderPath in folderChildren) && !loadingFolders[folderPath]) {
        refreshFolder(folderPath);
      }
    });
  }, [expandedFolders, folderChildren, loadingFolders, refreshFolder]);

  const {
    draggedPath,
    dragTargetFolder,
    dropLine,
    bindDraggableNote,
    bindFolderDrop,
  } = useNoteDragDrop({
    onMove: async (sourcePath, targetFolder) => {
      setExpandedFolders((prev) => ({ ...prev, [targetFolder]: true }));
      setLoadingFolders((l) => ({ ...l, [targetFolder]: true }));

      try {
        await onMoveDocument?.(sourcePath, targetFolder);
      } catch (err) {
        console.error("Failed to move document:", err);
      }

      await refreshFolder(targetFolder);

      const sourceFolder = sourcePath ? sourcePath.replace(/[\\/][^\\/]+$/, "") : null;
      if (sourceFolder && sourceFolder !== targetFolder) {
        await refreshFolder(sourceFolder);
      }
    },
  });
  const normalizedDensity = normalizeDocumentDensity(density);
  const densityProfile = getDocumentDensityProfile(normalizedDensity);
  const densityStyle = {
    "--doc-table-cell-pad-y": `${densityProfile.tableCellPaddingY}px`,
    "--doc-table-cell-pad-x": `${densityProfile.tableCellPaddingX}px`,
    "--doc-table-cell-font-size": `${densityProfile.tableCellFontSize}px`,
    "--doc-card-min-height": `${densityProfile.cardMinHeight}px`,
    "--doc-card-padding": `${densityProfile.cardPadding}px`,
    "--doc-card-gap": `${densityProfile.cardGap}px`,
    "--doc-meta-font-size": `${densityProfile.metaFontSize}px`,
    "--doc-thumb-height": `${densityProfile.thumbHeight}px`,
  };
  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);

  const previewRequests = useMemo(() => {
    return documents.flatMap((doc) => (doc.previewImages || []).slice(0, 4).map((image, index) => ({
      key: `${doc.filePath}:${index}:${image.sourceFilePath || doc.filePath}:${image.path}`,
      basePath: image.sourceFilePath || doc.filePath,
      path: image.path,
      name: image.name || image.path,
    })));
  }, [documents]);

  useEffect(() => {
    let cancelled = false;

    async function loadPreviewImages() {
      if (!previewRequests.length) {
        setResolvedPreviewImages({});
        return;
      }

      const entries = await Promise.all(previewRequests.map(async (request) => {
        try {
          const src = await readImage(request.basePath, request.path, { thumbnail: true });
          return [request.key, { src, name: request.name }];
        } catch {
          return [request.key, null];
        }
      }));

      if (!cancelled) {
        setResolvedPreviewImages(Object.fromEntries(entries.filter(([, value]) => value)));
      }
    }

    loadPreviewImages();

    return () => {
      cancelled = true;
    };
  }, [previewRequests]);

  useEffect(() => {
    if (!contextMenu) return undefined;

    const handlePointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setContextMenu(null);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setContextMenu(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [contextMenu]);

  if (loading) {
    if (viewMode === "table") {
      return (
        <div
          className={`document-table-wrap ${normalizedDensity}`}
          style={densityStyle}
          data-density={normalizedDensity}
        >
          <table className="document-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Metadata</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, idx) => (
                <tr key={idx} className="skeleton">
                  <td>
                    <span className="document-name-cell">
                      <span className="skeleton-icon skeleton-shimmer" />
                      <span className="skeleton-text skeleton-shimmer" style={{ width: "120px", display: "inline-block" }} />
                    </span>
                  </td>
                  <td>
                    <span className="skeleton-text skeleton-shimmer" style={{ width: "180px", display: "inline-block" }} />
                  </td>
                  <td>
                    <span className="skeleton-text skeleton-shimmer" style={{ width: "80px", display: "inline-block" }} />
                  </td>
                  <td>
                    <span className="skeleton-text skeleton-shimmer" style={{ width: "40px", display: "inline-block" }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    return (
      <div
        className={`document-grid ${normalizedDensity}`}
        style={densityStyle}
        data-density={normalizedDensity}
      >
        {Array.from({ length: 6 }).map((_, idx) => (
          <div className="document-card skeleton" key={idx}>
            <span className="document-card-header">
              <span className="document-title-wrap" style={{ display: "flex", alignItems: "center", width: "100%" }}>
                <span className="skeleton-icon skeleton-shimmer" />
                <span className="skeleton-title skeleton-shimmer" />
              </span>
            </span>
            <span className="skeleton-meta skeleton-shimmer" />
            <span className="skeleton-updated skeleton-shimmer" />
            <span className="skeleton-thumb-strip">
              <span className="skeleton-thumb skeleton-shimmer" />
              <span className="skeleton-thumb skeleton-shimmer" />
              <span className="skeleton-thumb skeleton-shimmer" />
              <span className="skeleton-thumb skeleton-shimmer" />
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (!documents.length) {
    return <div className="empty-state">{emptyMessage || "No folders or markdown files found here yet. Create a folder or add a note to get started."}</div>;
  }

  const renderModals = () => (
    <>
      {pickerState.isOpen && (
        <IconColorPickerModal
          isOpen={true}
          onClose={() => setPickerState({ isOpen: false, entry: null })}
          initialIcon={getMetadata(pickerState.entry?.filePath)?.icon}
          initialColor={getMetadata(pickerState.entry?.filePath)?.color}
          targetName={pickerState.entry?.title}
          onSave={(updates) => updateMetadata(pickerState.entry?.filePath, updates)}
        />
      )}
      {contextMenu && createPortal(
        <div
          ref={menuRef}
          className="editor-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setPickerState({ isOpen: true, entry: contextMenu.entry });
              setContextMenu(null);
            }}
          >
            <LucideIcons.Palette size={14} /> Customize icon & color...
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onCopyLinkPath?.(contextMenu.entry);
              setContextMenu(null);
            }}
          >
            <LucideIcons.Link size={14} /> Copy Link Path
          </button>
        </div>,
        document.getElementById('root') || document.body
      )}
    </>
  );

  const renderTreeNode = (entry, depth = 0, parentFolderPath = null) => {
    const meta = getMetadata(entry.filePath);
    const isFolder = entry.entryType === "folder";
    const isExpanded = Boolean(expandedFolders[entry.filePath]);
    const isLoading = Boolean(loadingFolders[entry.filePath]);
    const hasLoaded = entry.filePath in folderChildren;
    const children = folderChildren[entry.filePath] || [];
    const isTarget = dragTargetFolder === entry.filePath && isFolder;
    const isDraggingThis = draggedPath === entry.filePath;
    const isDropLineTop = dropLine?.filePath === entry.filePath && dropLine?.position === "top";
    const isDropLineBottom = dropLine?.filePath === entry.filePath && dropLine?.position === "bottom";
    const dragDropProps = isFolder
      ? bindFolderDrop(entry, { onExpand: toggleFolder, isExpanded })
      : bindDraggableNote(entry, { parentFolderPath });

    return (
      <div key={entry.filePath} style={{ display: "flex", flexDirection: "column" }}>
        <div
          className={`document-tree-row${isTarget ? " drop-target-active" : ""}${isDropLineTop ? " drop-line-top" : ""}${isDropLineBottom ? " drop-line-bottom" : ""}${isDraggingThis ? " is-dragging" : ""}${meta.color ? " custom-colored-item" : ""}`}
          style={{
            paddingLeft: `${12 + depth * 20}px`,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            height: "36px",
            borderRadius: "var(--radius-md)",
            cursor: "pointer",
            background: meta.color ? "var(--custom-bg-color)" : undefined,
            color: meta.color ? "var(--custom-text-color)" : undefined,
            ...(meta.color ? {
              "--custom-bg-color": meta.color,
              "--custom-text-color": getContrastColor(meta.color)
            } : {})
          }}
          {...dragDropProps}
          onClick={() => {
            if (isFolder) {
              toggleFolder(entry.filePath);
            } else {
              onOpen(entry);
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setContextMenu({ x: e.clientX, y: e.clientY, entry });
          }}
        >
          {isFolder ? (
            <span
              onClick={(e) => {
                e.stopPropagation();
                toggleFolder(entry.filePath);
              }}
              style={{ display: "inline-flex", cursor: "pointer", opacity: 0.7, padding: "2px" }}
              aria-label={isExpanded ? "Collapse folder" : "Expand folder"}
            >
              {isExpanded ? <LucideIcons.ChevronDown size={14} /> : <LucideIcons.ChevronRight size={14} />}
            </span>
          ) : (
            <span style={{ width: "18px", display: "inline-block" }} />
          )}

          <EntryIcon entryType={entry.entryType} icon={meta.icon} color={meta.color} />

          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: isFolder ? 600 : 400 }}>
            {entry.title}
          </span>

          <span style={{ width: "160px", fontSize: "11px", opacity: 0.6, flexShrink: 0 }}>
            {formatDate(entry.updatedAt)}
          </span>

          <span style={{ width: "80px", display: "flex", justifyContent: "flex-end", flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
            <DocumentEntryActions
              entry={entry}
              isFavorite={favoriteSet.has(entry.filePath)}
              onToggleFavorite={onToggleFavorite}
              onRemove={onRemove}
              showFavorite={!isFolder}
            />
          </span>
        </div>

        {isFolder && isExpanded && (
          <div
            style={{ display: "flex", flexDirection: "column" }}
            {...bindFolderDrop(entry, { onExpand: toggleFolder, isExpanded: true })}
          >
            {isLoading || !hasLoaded ? (
              <div style={{ paddingLeft: `${36 + depth * 20}px`, fontSize: "11px", opacity: 0.5, padding: "4px 0" }}>
                Loading folder…
              </div>
            ) : children.length === 0 ? (
              <div style={{ paddingLeft: `${36 + depth * 20}px`, fontSize: "11px", opacity: 0.5, padding: "8px 0" }}>
                (Empty folder)
              </div>
            ) : (
              children.map((child) => renderTreeNode(child, depth + 1, entry.filePath))
            )}
          </div>
        )}
      </div>
    );
  };

  if (viewMode === "tree") {
    return (
      <div
        className={`document-tree-wrap ${normalizedDensity}`}
        style={densityStyle}
        data-density={normalizedDensity}
      >
        <div style={{
          display: "flex",
          alignItems: "center",
          padding: "6px 12px",
          borderBottom: "1px solid var(--border-soft)",
          fontSize: "var(--font-size-caption, 11px)",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "var(--text-subtle)",
          marginBottom: "4px"
        }}>
          <span style={{ flex: 1 }}>Name</span>
          <span style={{ width: "160px" }}>Updated</span>
          <span style={{ width: "80px", textAlign: "right" }}>Actions</span>
        </div>
        {documents.map((doc) => renderTreeNode(doc, 0))}
        {renderModals()}
      </div>
    );
  }

  if (viewMode === "table") {
    return (
      <div
        className={`document-table-wrap ${normalizedDensity}`}
        style={densityStyle}
        data-density={normalizedDensity}
        data-density-target-rows={densityProfile.targetRowsPerViewport}
      >
        <table className="document-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Metadata</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => {
              const meta = getMetadata(doc.filePath);
              const isFolder = doc.entryType === "folder";
              const isTarget = dragTargetFolder === doc.filePath && isFolder;
              const isDraggingThis = draggedPath === doc.filePath;
              const isDropLineTop = dropLine?.filePath === doc.filePath && dropLine?.position === "top";
              const isDropLineBottom = dropLine?.filePath === doc.filePath && dropLine?.position === "bottom";
              const dragDropProps = isFolder
                ? bindFolderDrop(doc, { onExpand: toggleFolder, isExpanded: Boolean(expandedFolders[doc.filePath]) })
                : bindDraggableNote(doc);

              return (
              <tr
                key={doc.filePath}
                className={`${meta.color ? "custom-colored-item" : ""}${isTarget ? " drop-target-active" : ""}${isDropLineTop ? " drop-line-top" : ""}${isDropLineBottom ? " drop-line-bottom" : ""}${isDraggingThis ? " is-dragging" : ""}`}
                style={meta.color ? {
                  "--custom-bg-color": meta.color,
                  "--custom-text-color": getContrastColor(meta.color)
                } : {}}
                {...dragDropProps}
                onClick={() => onOpen(doc)}
                onDoubleClick={() => onOpen(doc)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setContextMenu({ x: e.clientX, y: e.clientY, entry: doc });
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpen(doc);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={doc.entryType === "folder" ? `Open folder ${doc.title}` : `Open note ${doc.title}`}
              >
                <td>
                  <span className="document-name-cell">
                    <EntryIcon entryType={doc.entryType} icon={meta.icon} color={meta.color} />
                    <span style={meta.color ? { fontWeight: '500' } : {}}>{doc.title}</span>
                    {doc.entryType === "file" ? (
                      <DocumentEntryActions
                        entry={doc}
                        isFavorite={favoriteSet.has(doc.filePath)}
                        onToggleFavorite={onToggleFavorite}
                        onRemove={onRemove}
                        showFavorite={false}
                        showRemove={false}
                      />
                    ) : null}
                  </span>
                </td>
                <td>
                  {doc.entryType === "folder"
                    ? "Contains notes and subfolders"
                    : ([doc.metadata?.time, doc.metadata?.location].filter(Boolean).join(" - ") ||
                      "No meeting metadata")}
                </td>
                <td>{formatDate(doc.updatedAt)}</td>
                <td>
                  {doc.entryType === "folder" ? (
                    <DocumentEntryActions
                      entry={doc}
                      isFavorite={false}
                      onToggleFavorite={onToggleFavorite}
                      onRemove={onRemove}
                      showFavorite={false}
                    />
                  ) : (
                    <DocumentEntryActions
                      entry={doc}
                      isFavorite={favoriteSet.has(doc.filePath)}
                      onToggleFavorite={onToggleFavorite}
                      onRemove={onRemove}
                    />
                  )}
                </td>
              </tr>
            )})}
          </tbody>
        </table>
        {renderModals()}
      </div>
    );
  }

  return (
    <div
      className={`document-grid ${normalizedDensity}`}
      style={densityStyle}
      data-density={normalizedDensity}
      data-density-target-cards={densityProfile.targetCardsPerViewport}
    >
      {documents.map((doc) => {
        const meta = getMetadata(doc.filePath);
        const isFolder = doc.entryType === "folder";
        const isTarget = dragTargetFolder === doc.filePath;
        const isDraggingThis = draggedPath === doc.filePath;
        const dragDropProps = isFolder
          ? bindFolderDrop(doc, { onExpand: toggleFolder, isExpanded: Boolean(expandedFolders[doc.filePath]) })
          : bindDraggableNote(doc);

        const previewTiles = (doc.previewImages || []).slice(0, 4).map((image, index) => {
          const key = `${doc.filePath}:${index}:${image.sourceFilePath || doc.filePath}:${image.path}`;
          const resolved = resolvedPreviewImages[key];
          return resolved ? <img src={resolved.src} alt="" data-tooltip={resolved.name} key={key} /> : null;
        });
        const hasPreview = previewTiles.some(Boolean);

        return (
          <button 
            className={`document-card${meta.color ? " custom-colored-item" : ""}${isTarget ? " drop-target-active" : ""}${isDraggingThis ? " is-dragging" : ""}`} 
            key={doc.filePath} 
            style={meta.color ? {
              "--custom-bg-color": meta.color,
              "--custom-text-color": getContrastColor(meta.color)
            } : {}}
            {...dragDropProps}
            onClick={() => onOpen(doc)} 
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, entry: doc }); }}>
            <span className="document-card-header">
              <span className="document-title-wrap">
                <EntryIcon entryType={doc.entryType} icon={meta.icon} color={meta.color} />
                <span className="document-title" style={meta.color ? { fontWeight: '500' } : {}}>{doc.title}</span>
              </span>
              <DocumentEntryActions
                entry={doc}
                isFavorite={favoriteSet.has(doc.filePath)}
                onToggleFavorite={onToggleFavorite}
                onRemove={onRemove}
                useButtonElements={false}
              />
            </span>
            <span className="document-meta">
              {doc.entryType === "folder"
                ? "Contains notes and subfolders"
                : ([doc.metadata?.time, doc.metadata?.location].filter(Boolean).join(" - ") ||
                  "No meeting metadata")}
            </span>
            <span className="document-updated">
              <CalendarIcon />
              <span>{formatDate(doc.updatedAt)}</span>
            </span>
            <span className={`document-thumb-strip${hasPreview ? "" : " is-empty"}`} aria-hidden="true">
              {hasPreview ? previewTiles : <span className="document-thumb-empty">No media</span>}
            </span>
          </button>
        );
      })}
      {renderModals()}
    </div>
  );
}
