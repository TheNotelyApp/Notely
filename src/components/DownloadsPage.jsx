import React, { useState, useEffect, useMemo } from "react";
import {
  Download,
  Folder,
  FileText,
  FileCode,
  Image,
  Archive,
  Search,
  Trash2,
  ExternalLink,
  RefreshCw,
  FolderOpen
} from "lucide-react";
import {
  getExportHistory,
  removeExportRecord,
  clearExportHistory,
  showInFolder,
  openExportFile,
  getDefaultDownloadDir
} from "../services/electronService.js";
import "../styles/DownloadsPage.css";

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatTimestamp(isoString) {
  if (!isoString) return "";
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return isoString;
  }
}

function getIconForType(type) {
  switch (type) {
    case "pdf":
      return <FileText size={18} className="downloads-type-icon pdf" />;
    case "note_package":
      return <Archive size={18} className="downloads-type-icon note-pkg" />;
    case "html":
      return <FileCode size={18} className="downloads-type-icon html" />;
    case "diagram_excalidraw":
    case "diagram_drawio":
      return <Image size={18} className="downloads-type-icon diagram" />;
    case "image":
    case "media":
      return <Image size={18} className="downloads-type-icon media" />;
    case "zip":
      return <Archive size={18} className="downloads-type-icon zip" />;
    default:
      return <FileText size={18} className="downloads-type-icon default" />;
  }
}

export function DownloadsPage({ onBack }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [defaultDir, setDefaultDir] = useState("");

  const loadHistory = async () => {
    setLoading(true);
    try {
      const records = await getExportHistory();
      setHistory(Array.isArray(records) ? records : []);
    } catch (err) {
      console.error("Failed to load export history:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
    getDefaultDownloadDir().then((dir) => {
      if (dir) setDefaultDir(dir);
    }).catch(() => {});
  }, []);

  const handleShowInFolder = async (filePath) => {
    if (!filePath) return;
    await showInFolder(filePath);
  };

  const handleOpenFile = async (filePath) => {
    if (!filePath) return;
    await openExportFile(filePath);
  };

  const handleRemove = async (id) => {
    await removeExportRecord(id);
    setHistory((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearAll = async () => {
    if (!window.confirm("Are you sure you want to clear export history? (Exported files on disk will not be deleted)")) {
      return;
    }
    await clearExportHistory();
    setHistory([]);
  };

  const handleOpenDownloadsFolder = async () => {
    if (defaultDir) {
      await showInFolder(defaultDir);
    }
  };

  const docCount = useMemo(() => {
    return history.filter((i) => ["pdf", "html", "note_package", "markdown"].includes(i.exportType)).length;
  }, [history]);

  const diagramCount = useMemo(() => {
    return history.filter((i) => ["diagram_excalidraw", "diagram_drawio"].includes(i.exportType)).length;
  }, [history]);

  const mediaCount = useMemo(() => {
    return history.filter((i) => ["image", "media"].includes(i.exportType) || i.category === "media").length;
  }, [history]);

  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      // Category filter
      if (activeTab === "documents" && !["pdf", "html", "note_package", "markdown"].includes(item.exportType)) {
        return false;
      }
      if (activeTab === "diagrams" && !["diagram_excalidraw", "diagram_drawio"].includes(item.exportType)) {
        return false;
      }
      if (activeTab === "media" && !["image", "media"].includes(item.exportType) && item.category !== "media") {
        return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = item.filename?.toLowerCase().includes(q);
        const pathMatch = item.filePath?.toLowerCase().includes(q);
        return nameMatch || pathMatch;
      }

      return true;
    });
  }, [history, activeTab, searchQuery]);

  return (
    <div className="downloads-page">
      {/* Unified App-Standard Topbar Navigation & Actions */}
      <div className="detail-topbar">
        <nav className="detail-breadcrumb" aria-label="Downloads location">
          <span className="detail-breadcrumb-part">
            <button className="detail-breadcrumb-link" type="button" onClick={onBack}>
              Workspace
            </button>
            <span className="detail-breadcrumb-separator" aria-hidden="true">/</span>
          </span>
          <span className="detail-breadcrumb-current">Downloads & Export History</span>
        </nav>

        <div className="detail-topbar-actions">
          <div className="task-stats-pill">
            <Download size={12} />
            <span>{filteredHistory.length} items</span>
          </div>

          {defaultDir && (
            <button
              className="app-button secondary"
              type="button"
              onClick={handleOpenDownloadsFolder}
              title={`Default folder: ${defaultDir}`}
            >
              <FolderOpen size={13} />
              <span>Downloads Folder</span>
            </button>
          )}

          {history.length > 0 && (
            <button className="app-button secondary danger" type="button" onClick={handleClearAll} title="Clear export history records">
              <Trash2 size={13} />
              <span>Clear History</span>
            </button>
          )}

          <button className="icon-button" type="button" onClick={loadHistory} title="Refresh">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      <div className="downloads-body">
        <div className="downloads-controls">
          <div className="downloads-tabs" role="tablist">
            <button
              type="button"
              className={`downloads-tab ${activeTab === "all" ? "active" : ""}`}
              onClick={() => setActiveTab("all")}
              role="tab"
            >
              <span>All</span>
              <span className="downloads-tab-count">{history.length}</span>
            </button>
            <button
              type="button"
              className={`downloads-tab ${activeTab === "documents" ? "active" : ""}`}
              onClick={() => setActiveTab("documents")}
              role="tab"
            >
              <span>Documents</span>
              <span className="downloads-tab-count">{docCount}</span>
            </button>
            <button
              type="button"
              className={`downloads-tab ${activeTab === "diagrams" ? "active" : ""}`}
              onClick={() => setActiveTab("diagrams")}
              role="tab"
            >
              <span>Diagrams</span>
              <span className="downloads-tab-count">{diagramCount}</span>
            </button>
            <button
              type="button"
              className={`downloads-tab ${activeTab === "media" ? "active" : ""}`}
              onClick={() => setActiveTab("media")}
              role="tab"
            >
              <span>Media</span>
              <span className="downloads-tab-count">{mediaCount}</span>
            </button>
          </div>

          <div className="downloads-search">
            <Search className="downloads-search-icon" size={14} />
            <input
              type="text"
              placeholder="Search exports..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {filteredHistory.length === 0 ? (
          <div className="downloads-empty">
            <Archive size={40} className="downloads-empty-icon" />
            <h3>No exports found</h3>
            <p>Exported notes, workspace zip archives, diagrams, and rendered files will appear here.</p>
          </div>
        ) : (
          <div className="downloads-list">
            {filteredHistory.map((item) => (
              <div key={item.id} className="downloads-card">
                <div className="downloads-card-icon">{getIconForType(item.exportType)}</div>

                <div className="downloads-card-info">
                  <div className="downloads-card-name" title={item.filename}>
                    {item.filename}
                  </div>
                  <div className="downloads-card-meta">
                    <span className={`downloads-tag downloads-tag-${item.exportType}`}>
                      {item.exportType ? item.exportType.replace("_", " ") : "file"}
                    </span>
                    <span>{formatBytes(item.fileSize)}</span>
                    <span>•</span>
                    <span>{formatTimestamp(item.timestamp)}</span>
                    {item.sourceNote && (
                      <>
                        <span>•</span>
                        <span title={`Source: ${item.sourceNote}`}>Note: {item.sourceNote}</span>
                      </>
                    )}
                  </div>
                  <div className="downloads-card-path" title={item.filePath}>
                    {item.filePath}
                  </div>
                </div>

                <div className="downloads-card-actions">
                  <button
                    className="app-button secondary"
                    onClick={() => handleShowInFolder(item.filePath)}
                    title="Show in File Explorer"
                  >
                    <Folder size={13} />
                    <span>Show in Folder</span>
                  </button>

                  <button
                    className="app-button primary"
                    onClick={() => handleOpenFile(item.filePath)}
                    title="Open File"
                  >
                    <ExternalLink size={13} />
                    <span>Open</span>
                  </button>

                  <button
                    className="icon-button"
                    onClick={() => handleRemove(item.id)}
                    title="Remove from history"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
