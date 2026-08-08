import React, { useEffect, useRef } from "react";
import {
  Download,
  Folder,
  ExternalLink,
  Archive,
  ChevronRight,
  FileText,
  FileCode,
  Image as ImageIcon,
} from "lucide-react";
import { openExportFile, showInFolder } from "../services/electronService.js";

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

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;

    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return isoString;
  }
}

function getPopoverIconForType(type) {
  switch (type) {
    case "pdf":
      return <FileText size={14} className="downloads-popover-type-icon pdf" />;
    case "note_package":
    case "zip":
      return <Archive size={14} className="downloads-popover-type-icon zip" />;
    case "html":
      return <FileCode size={14} className="downloads-popover-type-icon html" />;
    case "diagram_excalidraw":
    case "diagram_drawio":
    case "image":
    case "media":
      return <ImageIcon size={14} className="downloads-popover-type-icon media" />;
    default:
      return <FileText size={14} className="downloads-popover-type-icon default" />;
  }
}

export function DownloadsPopover({
  isOpen,
  onClose,
  onOpenDownloads,
  recentDownloads = [],
}) {
  const popoverRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose?.();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose?.();
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={popoverRef}
      className="titlebar-downloads-popover"
      role="dialog"
      aria-label="Recent Downloads"
    >
      <div className="downloads-popover-header">
        <div className="downloads-popover-title">
          <Download size={14} />
          <span>Downloads</span>
        </div>
      </div>

      <div className="downloads-popover-body">
        {recentDownloads.length === 0 ? (
          <div className="downloads-popover-empty">
            <Archive size={18} className="downloads-popover-empty-icon" />
            <span>No recent downloads</span>
          </div>
        ) : (
          recentDownloads.slice(0, 5).map((item) => (
            <div key={item.id || item.filePath} className="downloads-popover-item">
              <div className="downloads-popover-item-icon">
                {getPopoverIconForType(item.exportType)}
              </div>
              <div className="downloads-popover-item-info">
                <div className="downloads-popover-item-name" title={item.filename}>
                  {item.filename}
                </div>
                <div className="downloads-popover-item-meta">
                  <span>{formatBytes(item.fileSize)}</span>
                  <span>•</span>
                  <span>{formatTimestamp(item.timestamp)}</span>
                </div>
              </div>
              <div className="downloads-popover-item-actions">
                <button
                  type="button"
                  className="downloads-popover-action-btn"
                  onClick={() => showInFolder(item.filePath)}
                  title="Show in Folder"
                >
                  <Folder size={12} />
                </button>
                <button
                  type="button"
                  className="downloads-popover-action-btn"
                  onClick={() => openExportFile(item.filePath)}
                  title="Open File"
                >
                  <ExternalLink size={13} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="downloads-popover-footer">
        <button
          type="button"
          className="downloads-popover-more-btn"
          onClick={() => {
            onClose?.();
            onOpenDownloads?.();
          }}
        >
          <span>View All Downloads</span>
          <ChevronRight size={12} />
        </button>
      </div>
    </div>
  );
}

export default DownloadsPopover;
