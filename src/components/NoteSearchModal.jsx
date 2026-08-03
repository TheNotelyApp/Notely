import React, { useMemo, useState, useEffect, useRef } from "react";
import { Search, X, FileText, FolderOpen } from "lucide-react";
import * as LucideIcons from "lucide-react";
import AppIconButton from "./AppIconButton";
import OverlayDialog from "./OverlayDialog";
import AppSelect from "./AppSelect";
import AppInput from "./AppInput";
import { listWorkspaceTaskDocuments, listDocuments } from "../services/electronService";

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

function getWorkspaceRelativePath(filePath, documents) {
  if (!filePath) return "";
  const normalized = String(filePath).replace(/\\/g, "/");

  const allPaths = (documents || [])
    .filter((d) => d.entryType === "file" && d.filePath)
    .map((d) => d.filePath.replace(/\\/g, "/"));

  if (allPaths.length > 0) {
    const firstDir = allPaths[0].substring(0, allPaths[0].lastIndexOf("/"));
    const dirParts = firstDir.split("/");
    let commonLen = dirParts.length;

    for (const p of allPaths) {
      const pParts = p.split("/");
      for (let i = 0; i < commonLen; i += 1) {
        if (pParts[i] !== dirParts[i]) {
          commonLen = i;
          break;
        }
      }
    }

    const rootDir = dirParts.slice(0, commonLen).join("/");
    if (rootDir && normalized.startsWith(rootDir + "/")) {
      return normalized.slice(rootDir.length + 1);
    }
  }

  if (Array.isArray(documents)) {
    const matched = documents.find((d) => d.filePath && d.filePath.replace(/\\/g, "/") === normalized);
    if (matched?.relativePath) return matched.relativePath.replace(/\\/g, "/");
    if (matched?.displayPath) return matched.displayPath.replace(/\\/g, "/");
  }

  return normalized.split("/").pop() || "";
}

export function NoteSearchModal({ isOpen, onClose, documents = [], getMetadata, onSelectNote }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFolder, setSelectedFolder] = useState("all");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [fetchedWorkspaceDocs, setFetchedWorkspaceDocs] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      (async () => {
        try {
          let docs = await listWorkspaceTaskDocuments();
          if (!docs || !docs.length) {
            docs = await listDocuments("");
          }
          if (Array.isArray(docs) && docs.length > 0) {
            setFetchedWorkspaceDocs(docs);
            return;
          }
        } catch {
          // Fallback to prop documents
        }
      })();
    }
  }, [isOpen]);

  const activeDocuments = useMemo(() => {
    return fetchedWorkspaceDocs.length > 0 ? fetchedWorkspaceDocs : documents;
  }, [fetchedWorkspaceDocs, documents]);

  const allNotes = useMemo(() => {
    return (activeDocuments || [])
      .filter((doc) => doc.entryType === "file")
      .sort((a, b) => {
        const getTimestamp = (docItem) => {
          if (!docItem) return 0;
          const val = docItem.mtime ?? docItem.updatedAt ?? docItem.lastModified ?? docItem.ctime ?? docItem.birthtime;
          if (typeof val === "number" && !isNaN(val)) return val;
          if (typeof val === "string") {
            const parsed = Date.parse(val);
            if (Number.isFinite(parsed)) return parsed;
          }
          return 0;
        };
        return getTimestamp(b) - getTimestamp(a);
      });
  }, [activeDocuments]);

  const folderOptions = useMemo(() => {
    const foldersSet = new Set();

    (activeDocuments || []).forEach((doc) => {
      if (!doc.filePath) return;
      const relPath = doc.relativePath || doc.displayPath || getWorkspaceRelativePath(doc.filePath, activeDocuments);
      const parts = relPath.split("/").filter(Boolean);

      if (doc.entryType === "folder") {
        const folderPath = parts.join("/");
        if (folderPath && folderPath !== "." && folderPath !== "Root") {
          foldersSet.add(folderPath);
        }
      } else {
        parts.pop(); // remove filename
        let currentPath = "";
        parts.forEach((part) => {
          currentPath = currentPath ? `${currentPath}/${part}` : part;
          if (currentPath && currentPath !== "." && currentPath !== "Root") {
            foldersSet.add(currentPath);
          }
        });
      }
    });

    return Array.from(foldersSet).sort((a, b) => a.localeCompare(b));
  }, [activeDocuments]);

  const filteredNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allNotes.filter((doc) => {
      const relPath = doc.relativePath || doc.displayPath || getWorkspaceRelativePath(doc.filePath, activeDocuments);
      const parts = relPath.split("/").filter(Boolean);

      if (selectedFolder !== "all") {
        if (selectedFolder === "Root") {
          if (parts.length > 1) return false;
        } else {
          parts.pop(); // remove filename
          const folder = parts.join("/");
          if (folder !== selectedFolder && !folder.startsWith(selectedFolder + "/")) {
            return false;
          }
        }
      }

      if (!q) return true;
      const title = (doc.title || "").toLowerCase();
      const path = relPath.toLowerCase();
      return title.includes(q) || path.includes(q);
    });
  }, [allNotes, searchQuery, selectedFolder, activeDocuments]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery, selectedFolder]);

  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      setSelectedFolder("all");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      setSelectedIndex((prev) => (filteredNotes.length ? (prev + 1) % filteredNotes.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      setSelectedIndex((prev) => (filteredNotes.length ? (prev - 1 + filteredNotes.length) % filteredNotes.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      const selected = filteredNotes[selectedIndex];
      if (selected) {
        onSelectNote?.(selected.filePath);
        onClose?.();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose?.();
    }
  };

  if (!isOpen) return null;

  return (
    <OverlayDialog onClose={onClose} ariaLabel="Search Workspace Notes" cardClassName="note-search-modal-card">
      <div className="note-search-modal-header" onKeyDown={handleKeyDown}>
        <AppIconButton className="note-search-close" onClick={onClose} aria-label="Close search">
          <X size={16} />
        </AppIconButton>
        <div className="note-search-modal-top-row">
          <div className="note-search-modal-title-group">
            <FolderOpen size={16} className="note-search-modal-icon" />
            <span className="note-search-modal-title">Workspace Notes</span>
          </div>
        </div>
        <div className="note-search-filters">
          <div className="note-search-input-wrapper">
            <Search size={16} className="note-search-icon" />
            <AppInput
              ref={inputRef}
              type="text"
              className="note-search-input"
              placeholder="Search notes by title or path..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="note-search-clear-btn"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="note-search-folder-picker">
            <AppSelect
              value={selectedFolder}
              onChange={(e) => setSelectedFolder(e.target.value)}
              aria-label="Filter by folder"
              className="note-search-folder-app-select"
            >
              <option value="all">All Folders</option>
              <option value="Root">Root Folder</option>
              {folderOptions.map((folder) => (
                <option key={folder} value={folder}>
                  {folder}
                </option>
              ))}
            </AppSelect>
          </div>
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
              const displayRelPath = doc.relativePath || doc.displayPath || getWorkspaceRelativePath(doc.filePath, documents);
              const pathParts = (displayRelPath || "").split("/");
              const folderPath = pathParts.length > 1 ? pathParts.slice(0, -1).join("/") : "";

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
                  <ItemIcon size={14} className="note-search-item-icon" />
                  <span className="note-search-item-title">{title}</span>
                  {folderPath && <span className="note-search-item-folder">in {folderPath}</span>}
                  {relTime && <span className="note-search-item-time">{relTime}</span>}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="note-search-empty">
            <Search size={28} style={{ opacity: 0.35, marginBottom: 8 }} />
            <span>No notes match filter criteria</span>
          </div>
        )}
      </div>
      <div className="note-search-modal-footer">
        <div className="note-search-count-status">
          Showing {filteredNotes.length} of {allNotes.length}
        </div>
      </div>
    </OverlayDialog>
  );
}

export default NoteSearchModal;
