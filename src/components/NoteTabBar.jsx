import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { X, Plus, ChevronDown, FolderOpen, ExternalLink, Edit2, RefreshCw, Search, FileText, FilePlus } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { useWorkspaceMetadata } from "../hooks/useWorkspaceMetadata";
import { IconColorPickerModal } from "./IconColorPickerModal";
import { getContrastColor } from "../utils/colorUtils";
import OverlayDialog from "./OverlayDialog";

function formatRelativeTime(timestamp) {
  if (!timestamp) return "";
  const date = typeof timestamp === "number" ? timestamp : Date.parse(timestamp);
  if (!Number.isFinite(date)) return "";
  const diffMs = Date.now() - date;
  if (diffMs < 60000) return "Just now";
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

function NoteSearchModal({ isOpen, onClose, documents, getMetadata, onSelectNote }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  const allNotes = useMemo(() => {
    return (documents || []).filter((doc) => doc.entryType === "file");
  }, [documents]);

  const filteredNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allNotes;
    return allNotes.filter((doc) => {
      const title = (doc.title || "").toLowerCase();
      const path = (doc.filePath || "").toLowerCase();
      return title.includes(q) || path.includes(q);
    });
  }, [allNotes, searchQuery]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (filteredNotes.length ? (prev + 1) % filteredNotes.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (filteredNotes.length ? (prev - 1 + filteredNotes.length) % filteredNotes.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = filteredNotes[selectedIndex];
      if (selected) {
        onSelectNote?.(selected.filePath);
        onClose?.();
      }
    } else if (e.key === "Escape") {
      onClose?.();
    }
  };

  if (!isOpen) return null;

  return (
    <OverlayDialog onClose={onClose} ariaLabel="Search All Notes" cardClassName="note-search-modal-card">
      <div className="note-search-modal-header" onKeyDown={handleKeyDown}>
        <div className="note-search-input-wrapper">
          <Search size={16} className="note-search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="note-search-input"
            placeholder="Search all notes in workspace..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <AppIconButton className="note-search-close" onClick={onClose} aria-label="Close search">
            <X size={16} />
          </AppIconButton>
        </div>
      </div>
      <div className="note-search-modal-body" onKeyDown={handleKeyDown}>
        {filteredNotes.length > 0 ? (
          <div className="note-search-results-list" role="listbox">
            {filteredNotes.map((doc, idx) => {
              const meta = getMetadata?.(doc.filePath) || {};
              const ItemIcon = meta.icon && LucideIcons[meta.icon] ? LucideIcons[meta.icon] : FileText;
              const title = doc.title || doc.filePath.split(/[\\/]/).pop().replace(/\.md$/i, "");
              const isSelected = idx === selectedIndex;
              const relTime = formatRelativeTime(doc.mtime || doc.updatedAt || doc.lastModified);

              return (
                <button
                  key={doc.filePath}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`note-search-result-item ${isSelected ? "selected" : ""}`}
                  onClick={() => {
                    onSelectNote?.(doc.filePath);
                    onClose?.();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <ItemIcon size={16} className="note-search-item-icon" />
                  <div className="note-search-item-details">
                    <span className="note-search-item-title">{title}</span>
                    <span className="note-search-item-path">{doc.filePath}</span>
                  </div>
                  {relTime && <span className="note-search-item-time">{relTime}</span>}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="note-search-empty">No notes match "{searchQuery}"</div>
        )}
      </div>
    </OverlayDialog>
  );
}

export function NoteTabBar({
  openTabs = [],
  onReorderTabs,
  activeTabPath = null,
  tabStates = {},
  documents = [],
  onSelectTab,
  onCloseTab,
  onNewTab,
  onNewFolder,
  onCloseOthers,
  onCloseToRight,
  onCloseSaved,
  onCloseAll,
  onOpenInEditor,
  onRevealInExplorer,
  onCopyLinkPath,
  onReloadFromDisk,
}) {
  const barRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const [contextMenu, setContextMenu] = useState(null); // { x, y, filePath }
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [addDropdownOpen, setAddDropdownOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [pickerState, setPickerState] = useState({ isOpen: false, entry: null });
  const { getMetadata, updateMetadata } = useWorkspaceMetadata();

  // Measure container width
  useEffect(() => {
    if (!barRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(barRef.current);
    return () => observer.disconnect();
  }, []);

  // Close menus on click-away
  useEffect(() => {
    const handleGlobalClick = () => {
      setContextMenu(null);
      setDropdownOpen(false);
      setAddDropdownOpen(false);
    };
    window.addEventListener("click", handleGlobalClick);
    window.addEventListener("contextmenu", handleGlobalClick);
    return () => {
      window.removeEventListener("click", handleGlobalClick);
      window.removeEventListener("contextmenu", handleGlobalClick);
    };
  }, []);

  const docMap = useMemo(() => {
    return new Map((documents || []).map((doc) => [doc.filePath, doc]));
  }, [documents]);

  const closedNotes = useMemo(() => {
    return (documents || [])
      .filter((doc) => doc.entryType === "file" && !openTabs.includes(doc.filePath))
      .sort((a, b) => {
        const timeA = a.mtime || a.updatedAt || a.lastModified || 0;
        const timeB = b.mtime || b.updatedAt || b.lastModified || 0;
        return timeB - timeA;
      });
  }, [documents, openTabs]);

  const getTabTitle = useCallback((filePath) => {
    const cachedDoc = tabStates[filePath]?.doc;
    if (cachedDoc?.title) return cachedDoc.title;
    const metaDoc = docMap.get(filePath);
    if (metaDoc?.title) return metaDoc.title;
    const parts = filePath.split(/[\\/]/);
    const basename = parts[parts.length - 1] || filePath;
    return basename.replace(/\.md$/i, "");
  }, [tabStates, docMap]);

  // Listen for set-icon-and-color action from main menu
  useEffect(() => {
    const handleSetIcon = () => {
      if (activeTabPath) {
        setPickerState({ isOpen: true, entry: { filePath: activeTabPath, title: getTabTitle(activeTabPath) } });
      }
    };
    window.addEventListener("app:set-icon-and-color", handleSetIcon);
    return () => window.removeEventListener("app:set-icon-and-color", handleSetIcon);
  }, [activeTabPath, getTabTitle]);

  const isTabDirty = (filePath) => {
    const state = tabStates[filePath];
    if (!state) return false;
    const { doc, savedHash } = state;
    if (!doc) return false;
    const currentHash = JSON.stringify({
      header: doc.header || "",
      rawNotes: doc.rawNotes || "",
      cleansed: doc.cleansed || "",
    });
    return currentHash !== savedHash;
  };

  // Calculate visible vs overflow tabs
  // Subtract space for: + button (30px), overflow dropdown (80px), paddings (20px) -> ~130px
  const availableWidth = Math.max(200, containerWidth - 130);
  const maxTabs = Math.max(1, Math.floor(availableWidth / 125));

  let visibleTabs = [...openTabs];
  let overflowTabs = [];

  if (openTabs.length > maxTabs) {
    const limit = Math.max(1, maxTabs - 1);
    const activeIndex = openTabs.indexOf(activeTabPath);

    if (activeIndex >= limit && activeIndex !== -1) {
      // Active tab is in overflow section; bubble it to the visible section
      const reordered = [
        activeTabPath,
        ...openTabs.filter((p) => p !== activeTabPath),
      ];
      visibleTabs = reordered.slice(0, limit);
      overflowTabs = reordered.slice(limit);
    } else {
      visibleTabs = openTabs.slice(0, limit);
      overflowTabs = openTabs.slice(limit);
    }
  }

  const handleContextMenu = (e, filePath) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      filePath,
    });
    setDropdownOpen(false);
    setAddDropdownOpen(false);
  };

  const [draggedTabPath, setDraggedTabPath] = useState(null);

  const handleTabDragStart = (e, filePath) => {
    setDraggedTabPath(filePath);
    e.dataTransfer.setData("text/plain", filePath);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleTabDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleTabDrop = (e, targetPath) => {
    e.preventDefault();
    if (!draggedTabPath || draggedTabPath === targetPath) return;

    const fromIdx = openTabs.indexOf(draggedTabPath);
    const toIdx = openTabs.indexOf(targetPath);

    if (fromIdx !== -1 && toIdx !== -1) {
      const nextTabs = [...openTabs];
      const [moved] = nextTabs.splice(fromIdx, 1);
      nextTabs.splice(toIdx, 0, moved);
      onReorderTabs?.(nextTabs);
    }
    setDraggedTabPath(null);
  };

  if (!openTabs.length) return null;

  const visibleClosedNotes = closedNotes.slice(0, 8);
  const remainingClosedCount = closedNotes.length - 8;

  return (
    <div className="note-tab-bar" ref={barRef} role="tablist" aria-label="Open notes">
      <div className="note-tab-list">
        {visibleTabs.map((filePath) => {
          const isActive = filePath === activeTabPath;
          const isDirty = isTabDirty(filePath);
          const title = getTabTitle(filePath);
          const meta = getMetadata(filePath) || {};
          const TabIcon = meta.icon && LucideIcons[meta.icon] ? LucideIcons[meta.icon] : null;

          return (
            <div
              key={filePath}
              className={`note-tab${isActive ? " active" : ""}${isDirty ? " dirty" : ""}${meta.color ? " custom-colored-item" : ""}`}
              role="tab"
              aria-selected={isActive}
              title={filePath}
              draggable={true}
              onDragStart={(e) => handleTabDragStart(e, filePath)}
              onDragOver={handleTabDragOver}
              onDrop={(e) => handleTabDrop(e, filePath)}
              onContextMenu={(e) => handleContextMenu(e, filePath)}
              style={meta.color ? {
                "--custom-bg-color": meta.color,
                "--custom-text-color": getContrastColor(meta.color)
              } : {}}
            >
              <button
                className="note-tab-title-btn"
                type="button"
                onClick={() => onSelectTab?.(filePath)}
                style={meta.color ? { color: 'inherit' } : {}}
              >
                {TabIcon && <TabIcon size={14} style={{ marginRight: 6 }} />}
                <span className="note-tab-text">
                  {title}
                </span>
                {isDirty && <span className="note-tab-dirty-dot" aria-label="Unsaved changes" style={meta.color ? { backgroundColor: 'currentColor' } : {}} />}
              </button>
              <button
                className="note-tab-close-btn"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab?.(filePath);
                }}
                aria-label={`Close ${title}`}
                style={meta.color ? { color: 'inherit' } : {}}
              >
                <X size={12} />
              </button>
            </div>
          );
        })}

        {/* "+" New Tab Button immediately after last tab chip */}
        <div
          className="note-tab-add-container"
          onMouseEnter={() => {
            setAddDropdownOpen(true);
            setContextMenu(null);
            setDropdownOpen(false);
          }}
          onMouseLeave={() => {
            setAddDropdownOpen(false);
          }}
        >
          <button
            className="note-tab-add-btn"
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            title="Create or open note"
            data-tooltip="Create or open note"
            aria-label="Create or open note"
            aria-haspopup="true"
            aria-expanded={addDropdownOpen}
          >
            <Plus size={14} />
          </button>

          {addDropdownOpen && (
            <div className="note-tab-add-dropdown" role="menu" onClick={(e) => e.stopPropagation()}>
              <div className="note-tab-add-section">
                <button
                  type="button"
                  role="menuitem"
                  className="note-tab-add-menu-btn"
                  onClick={() => {
                    onNewTab?.();
                    setAddDropdownOpen(false);
                  }}
                >
                  <FilePlus size={14} />
                  <span>Create New Note</span>
                </button>
              </div>

              {closedNotes.length > 0 && (
                <>
                  <div className="note-tab-add-dropdown-separator" />
                  <div className="note-tab-add-dropdown-header">Recently Edited Notes</div>
                  <div className="note-tab-add-dropdown-scroll">
                    {visibleClosedNotes.map((note) => {
                      const meta = getMetadata?.(note.filePath) || {};
                      const ItemIcon = meta.icon && LucideIcons[meta.icon] ? LucideIcons[meta.icon] : FileText;
                      const title = note.title || note.filePath.split(/[\\/]/).pop().replace(/\.md$/i, "");
                      const relTime = formatRelativeTime(note.mtime || note.updatedAt || note.lastModified);

                      return (
                        <button
                          key={note.filePath}
                          type="button"
                          role="menuitem"
                          className="note-tab-add-dropdown-item"
                          title={note.filePath}
                          onClick={() => {
                            onSelectTab?.(note.filePath);
                            setAddDropdownOpen(false);
                          }}
                        >
                          <ItemIcon size={14} className="note-tab-add-item-icon" />
                          <span className="note-tab-add-item-title">{title}</span>
                          {relTime && <span className="note-tab-add-item-time">{relTime}</span>}
                        </button>
                      );
                    })}
                  </div>
                  {remainingClosedCount > 0 && (
                    <button
                      type="button"
                      className="note-tab-add-more-btn"
                      onClick={() => {
                        setAddDropdownOpen(false);
                        setSearchModalOpen(true);
                      }}
                    >
                      <Search size={14} />
                      <span>+{remainingClosedCount} More...</span>
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Overflow container when tabs overflow */}
      {overflowTabs.length > 0 && (
        <div className="note-tab-overflow-container">
          <button
            className="note-tab-overflow-btn"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setDropdownOpen(!dropdownOpen);
              setContextMenu(null);
              setAddDropdownOpen(false);
            }}
            aria-haspopup="true"
            aria-expanded={dropdownOpen}
          >
            <span>+{overflowTabs.length} more</span>
            <ChevronDown size={12} />
          </button>

          {dropdownOpen && (
            <div className="note-tab-overflow-dropdown" role="menu">
              {overflowTabs.map((filePath) => {
                const isDirty = isTabDirty(filePath);
                const title = getTabTitle(filePath);
                const isActive = filePath === activeTabPath;
                const meta = getMetadata(filePath) || {};
                const TabIcon = meta.icon && LucideIcons[meta.icon] ? LucideIcons[meta.icon] : null;

                return (
                  <button
                    key={filePath}
                    className={`note-tab-overflow-item${isActive ? " active" : ""}${isDirty ? " dirty" : ""}${meta.color ? " custom-colored-item" : ""}`}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onSelectTab?.(filePath);
                      setDropdownOpen(false);
                    }}
                    onContextMenu={(e) => handleContextMenu(e, filePath)}
                    title={filePath}
                    style={meta.color ? {
                      "--custom-bg-color": meta.color,
                      "--custom-text-color": getContrastColor(meta.color)
                    } : {}}
                  >
                    {TabIcon && <TabIcon size={14} style={{ marginRight: 6 }} />}
                    <span className="note-tab-text">{title}</span>
                    {isDirty && <span className="note-tab-dirty-dot" style={meta.color ? { backgroundColor: 'currentColor' } : {}} />}
                  </button>
                );
              })}

              <div className="note-tab-add-dropdown-separator" style={{ margin: "4px 0" }} />
              
              <button
                className="note-tab-overflow-item note-tab-add-overflow-item"
                type="button"
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  setDropdownOpen(false);
                  setAddDropdownOpen(true);
                }}
                style={{ fontWeight: 600, color: "var(--accent-solid)" }}
              >
                <Plus size={14} style={{ marginRight: 6 }} />
                <span className="note-tab-text">Create / Open Note...</span>
              </button>
            </div>
          )}

          {addDropdownOpen && (
            <div className="note-tab-add-dropdown" role="menu" onClick={(e) => e.stopPropagation()}>
              <div className="note-tab-add-section">
                <button
                  type="button"
                  role="menuitem"
                  className="note-tab-add-menu-btn"
                  onClick={() => {
                    onNewTab?.();
                    setAddDropdownOpen(false);
                  }}
                >
                  <FilePlus size={14} />
                  <span>Create New Note</span>
                </button>
              </div>

              {closedNotes.length > 0 && (
                <>
                  <div className="note-tab-add-dropdown-separator" />
                  <div className="note-tab-add-dropdown-header">Recently Edited Notes</div>
                  <div className="note-tab-add-dropdown-scroll">
                    {visibleClosedNotes.map((note) => {
                      const meta = getMetadata?.(note.filePath) || {};
                      const ItemIcon = meta.icon && LucideIcons[meta.icon] ? LucideIcons[meta.icon] : FileText;
                      const title = note.title || note.filePath.split(/[\\/]/).pop().replace(/\.md$/i, "");
                      const relTime = formatRelativeTime(note.mtime || note.updatedAt || note.lastModified);

                      return (
                        <button
                          key={note.filePath}
                          type="button"
                          role="menuitem"
                          className="note-tab-add-dropdown-item"
                          title={note.filePath}
                          onClick={() => {
                            onSelectTab?.(note.filePath);
                            setAddDropdownOpen(false);
                          }}
                        >
                          <ItemIcon size={14} className="note-tab-add-item-icon" />
                          <span className="note-tab-add-item-title">{title}</span>
                          {relTime && <span className="note-tab-add-item-time">{relTime}</span>}
                        </button>
                      );
                    })}
                  </div>
                  {remainingClosedCount > 0 && (
                    <button
                      type="button"
                      className="note-tab-add-more-btn"
                      onClick={() => {
                        setAddDropdownOpen(false);
                        setSearchModalOpen(true);
                      }}
                    >
                      <Search size={14} />
                      <span>+{remainingClosedCount} More...</span>
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Searchable Modal for All Notes */}
      <NoteSearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        documents={documents}
        getMetadata={getMetadata}
        onSelectNote={onSelectTab}
      />

      {/* Right-click Context Menu */}
      {contextMenu && (
        <div
          className="tab-context-menu"
          style={{
            top: `${contextMenu.y}px`,
            left: `${contextMenu.x}px`,
          }}
          role="menu"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onCloseTab?.(contextMenu.filePath);
              setContextMenu(null);
            }}
          >
            <X size={14} />
            Close Tab
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onCloseOthers?.(contextMenu.filePath);
              setContextMenu(null);
            }}
          >
            Close Other Tabs
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onCloseToRight?.(contextMenu.filePath);
              setContextMenu(null);
            }}
          >
            Close Tabs to the Right
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onCloseSaved?.();
              setContextMenu(null);
            }}
          >
            Close Saved Tabs
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onCloseAll?.();
              setContextMenu(null);
            }}
          >
            Close All Tabs
          </button>
          <div className="tab-context-menu-separator" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onReloadFromDisk?.(contextMenu.filePath);
              setContextMenu(null);
            }}
          >
            <RefreshCw size={14} />
            Reload from Disk
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onOpenInEditor?.(contextMenu.filePath);
              setContextMenu(null);
            }}
          >
            <ExternalLink size={14} />
            Open in VS Code
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onRevealInExplorer?.(contextMenu.filePath);
              setContextMenu(null);
            }}
          >
            <FolderOpen size={14} />
            Reveal in File Explorer
          </button>
          <div className="tab-context-menu-separator" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setPickerState({ isOpen: true, entry: { filePath: contextMenu.filePath, title: getTabTitle(contextMenu.filePath) } });
              setContextMenu(null);
            }}
          >
            <Edit2 size={14} />
            Set Icon & Color
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onCopyLinkPath?.(contextMenu.filePath);
              setContextMenu(null);
            }}
          >
            <LucideIcons.Link size={14} />
            Copy Link Path
          </button>
        </div>
      )}
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
    </div>
  );
}

