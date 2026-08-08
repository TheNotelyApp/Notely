import React, { useEffect, useState, useMemo } from "react";
import {
  FolderOpen,
  Trash2,
  Download,
  FileText,
  FileCode,
  Archive,
  Image,
  RefreshCw,
  Search,
  ExternalLink,
  Folder,
  X,
  Loader2,
} from "lucide-react";
import {
  getExportHistory,
  clearExportHistory,
  removeExportRecord,
  openExportFile,
  showInFolder,
  getDefaultDownloadDir,
  onExportRecordAdded,
} from "../services/electronService.js";
import AppButton from "./AppButton.jsx";
import { AppCard } from "./AppCard.jsx";
import useConfirm from "../hooks/useConfirm.js";
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
  const { confirm } = useConfirm();
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
    getDefaultDownloadDir()
      .then((dir) => {
        if (dir) setDefaultDir(dir);
      })
      .catch(() => {});

    const unsubscribeIpc = onExportRecordAdded((newRecord) => {
      setHistory((prev) => [newRecord, ...prev.filter((item) => item.id !== newRecord.id)]);
    });

    const handleCustomEvent = (e) => {
      if (e.detail) {
        setHistory((prev) => [e.detail, ...prev.filter((item) => item.id !== e.detail.id)]);
      }
    };
    window.addEventListener("app:download-complete", handleCustomEvent);

    return () => {
      if (typeof unsubscribeIpc === "function") unsubscribeIpc();
      window.removeEventListener("app:download-complete", handleCustomEvent);
    };
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
    const isConfirmed = await confirm({
      title: "Clear Export History",
      message:
        "Are you sure you want to clear export history? (Exported files on disk will not be deleted)",
      confirmText: "Clear History",
      cancelText: "Cancel",
      danger: true,
    });
    if (!isConfirmed) return;

    await clearExportHistory();
    setHistory([]);
  };

  const handleOpenDownloadsFolder = async () => {
    if (defaultDir) {
      await showInFolder(defaultDir);
    }
  };

  const docCount = useMemo(() => {
    return history.filter((i) =>
      ["pdf", "html", "note_package", "markdown"].includes(i.exportType)
    ).length;
  }, [history]);

  const diagramCount = useMemo(() => {
    return history.filter((i) =>
      ["diagram_excalidraw", "diagram_drawio"].includes(i.exportType)
    ).length;
  }, [history]);

  const mediaCount = useMemo(() => {
    return history.filter(
      (i) => ["image", "media"].includes(i.exportType) || i.category === "media"
    ).length;
  }, [history]);

  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      if (
        activeTab === "documents" &&
        !["pdf", "html", "note_package", "markdown"].includes(item.exportType)
      ) {
        return false;
      }
      if (
        activeTab === "diagrams" &&
        !["diagram_excalidraw", "diagram_drawio"].includes(item.exportType)
      ) {
        return false;
      }
      if (
        activeTab === "media" &&
        !["image", "media"].includes(item.exportType) &&
        item.category !== "media"
      ) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return item.filename?.toLowerCase().includes(q) || item.filePath?.toLowerCase().includes(q);
      }

      return true;
    });
  }, [history, activeTab, searchQuery]);

  return (
    <div className="downloads-page">
      <div className="detail-topbar">
        <nav className="detail-breadcrumb" aria-label="Downloads location">
          <span className="detail-breadcrumb-part">
            <button className="detail-breadcrumb-link" type="button" onClick={onBack}>
              Workspace
            </button>
            <span className="detail-breadcrumb-separator" aria-hidden="true">
              /
            </span>
          </span>
          <span className="detail-breadcrumb-current">Downloads & Export History</span>
        </nav>

        <div className="detail-topbar-actions">
          <div className="task-stats-pill" title="Exported items">
            <Download size={12} />
            <span>{filteredHistory.length} items</span>
          </div>

          {defaultDir && (
            <AppButton
              variant="small"
              onClick={handleOpenDownloadsFolder}
              title={`Default folder: ${defaultDir}`}
            >
              <FolderOpen size={14} />
              <span>Downloads Folder</span>
            </AppButton>
          )}

          {history.length > 0 && (
            <AppButton
              variant="small"
              danger
              onClick={handleClearAll}
              title="Clear export history records"
            >
              <Trash2 size={14} />
              <span>Clear History</span>
            </AppButton>
          )}

          <AppButton variant="small" onClick={loadHistory} title="Refresh history">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </AppButton>
        </div>
      </div>

      <div className="downloads-body">
        <div className="downloads-controls">
          <div className="downloads-tabs" role="tablist" aria-label="Export history categories">
            <button
              type="button"
              className={`downloads-tab ${activeTab === "all" ? "active" : ""}`}
              onClick={() => setActiveTab("all")}
              role="tab"
              aria-selected={activeTab === "all"}
            >
              <span>All</span>
              <span className="downloads-tab-count">{history.length}</span>
            </button>
            <button
              type="button"
              className={`downloads-tab ${activeTab === "documents" ? "active" : ""}`}
              onClick={() => setActiveTab("documents")}
              role="tab"
              aria-selected={activeTab === "documents"}
            >
              <span>Documents</span>
              <span className="downloads-tab-count">{docCount}</span>
            </button>
            <button
              type="button"
              className={`downloads-tab ${activeTab === "diagrams" ? "active" : ""}`}
              onClick={() => setActiveTab("diagrams")}
              role="tab"
              aria-selected={activeTab === "diagrams"}
            >
              <span>Diagrams</span>
              <span className="downloads-tab-count">{diagramCount}</span>
            </button>
            <button
              type="button"
              className={`downloads-tab ${activeTab === "media" ? "active" : ""}`}
              onClick={() => setActiveTab("media")}
              role="tab"
              aria-selected={activeTab === "media"}
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
              aria-label="Search exports"
            />
            {searchQuery && (
              <button
                type="button"
                className="downloads-search-clear"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                title="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {loading && history.length === 0 ? (
          <div className="downloads-loading">
            <Loader2 size={20} className="animate-spin downloads-loading-icon" />
            <span>Loading export history...</span>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="downloads-empty">
            {searchQuery ? (
              <>
                <Search size={20} className="downloads-empty-icon" />
                <h3>No matching exports</h3>
                <p>No export history items found matching &ldquo;{searchQuery}&rdquo;</p>
                <AppButton variant="small" onClick={() => setSearchQuery("")} style={{ marginTop: "12px" }}>
                  Clear Search
                </AppButton>
              </>
            ) : (
              <>
                <Archive size={20} className="downloads-empty-icon" />
                <h3>No exports found</h3>
                <p>Exported notes, workspace zip archives, diagrams, and rendered files will appear here.</p>
              </>
            )}
          </div>
        ) : (
          <div className="downloads-list">
            {filteredHistory.map((item) => (
              <AppCard key={item.id} className="downloads-card">
                <div className="downloads-card-icon">{getIconForType(item.exportType)}</div>

                <div className="downloads-card-info">
                  <div className="downloads-card-header-row">
                    <div className="downloads-card-name" title={item.filename}>
                      {item.filename}
                    </div>
                    <span className={`downloads-tag downloads-tag-${item.exportType}`}>
                      {item.exportType ? item.exportType.replace("_", " ") : "file"}
                    </span>
                  </div>
                  <div className="downloads-card-meta">
                    <span>{formatBytes(item.fileSize)}</span>
                    <span className="downloads-meta-dot">•</span>
                    <span>{formatTimestamp(item.timestamp)}</span>
                    {item.sourceNote && (
                      <>
                        <span className="downloads-meta-dot">•</span>
                        <span title={`Source: ${item.sourceNote}`}>Note: {item.sourceNote}</span>
                      </>
                    )}
                  </div>
                  <div className="downloads-card-path" title={item.filePath}>
                    {item.filePath}
                  </div>
                </div>

                <div className="downloads-card-actions">
                  <AppButton
                    variant="small"
                    onClick={() => handleShowInFolder(item.filePath)}
                    title="Show in File Explorer"
                  >
                    <Folder size={14} />
                    <span>Show in Folder</span>
                  </AppButton>

                  <AppButton
                    variant="primary"
                    onClick={() => handleOpenFile(item.filePath)}
                    title="Open File"
                  >
                    <ExternalLink size={14} />
                    <span>Open</span>
                  </AppButton>

                  <AppButton
                    variant="small"
                    danger
                    onClick={() => handleRemove(item.id)}
                    title="Remove from history"
                  >
                    <Trash2 size={14} />
                    <span>Remove</span>
                  </AppButton>
                </div>
              </AppCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default DownloadsPage;
