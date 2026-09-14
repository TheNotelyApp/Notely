import React, { useMemo, useState } from "react";
import { Clock, Folder, FolderOpen, ArrowRight, Search, X, Check } from "lucide-react";
import { OverlayDialog } from "../OverlayDialog";
import AppButton from "../AppButton";

function getWorkspaceDetails(workspacePath) {
  if (!workspacePath) return { name: "Workspace", parentDir: "", fullPath: "" };
  const raw = String(workspacePath).trim();
  const normalized = raw.replace(/\\/g, "/").replace(/\/+$/, "");
  const parts = normalized.split("/").filter(Boolean);
  const name = parts[parts.length - 1] || raw;
  const parentDir = parts.length > 1 ? parts.slice(0, -1).join("/") : "";
  return { name, parentDir, fullPath: raw };
}

export function RecentWorkspacesModal({
  isOpen,
  onClose,
  recentWorkspacePaths = [],
  currentWorkspacePath = "",
  onSelectWorkspace,
  onBrowseWorkspace,
  saving = false,
}) {
  const [query, setQuery] = useState("");

  const normalizedCurrent = (currentWorkspacePath || "").toLowerCase().trim();

  const workspaceItems = useMemo(() => {
    if (!Array.isArray(recentWorkspacePaths)) return [];
    return recentWorkspacePaths
      .filter((p) => typeof p === "string" && p.trim())
      .map((path) => ({
        path,
        ...getWorkspaceDetails(path),
        isCurrent: path.toLowerCase().trim() === normalizedCurrent,
      }));
  }, [recentWorkspacePaths, normalizedCurrent]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return workspaceItems;
    return workspaceItems.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.path.toLowerCase().includes(q)
    );
  }, [workspaceItems, query]);

  if (!isOpen) return null;

  return (
    <OverlayDialog
      open={isOpen}
      onClose={onClose}
      ariaLabel="Open recent workspace"
      cardClassName="recent-workspaces-card"
    >
      <div className="recent-workspaces-header">
        <div className="recent-workspaces-header-content">
          <span className="recent-workspaces-icon-badge" aria-hidden="true">
            <Clock size={16} />
          </span>
          <div className="recent-workspaces-title-group">
            <h2>Open Recent Workspace</h2>
            <p className="recent-workspaces-subtitle">
              Switch to a previously opened project or browse a folder
            </p>
          </div>
        </div>
        <button
          className="recent-workspaces-close-btn"
          onClick={onClose}
          type="button"
          aria-label="Close recent workspaces dialog"
        >
          <X size={14} />
        </button>
      </div>

      <div className="recent-workspaces-body">
        {workspaceItems.length > 3 && (
          <div className="recent-workspaces-search-wrap">
            <Search size={14} className="recent-workspaces-search-icon" aria-hidden="true" />
            <input
              type="search"
              className="recent-workspaces-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search recent workspaces..."
              aria-label="Filter recent workspaces"
              autoFocus
            />
          </div>
        )}

        {filteredItems.length > 0 ? (
          <div className="recent-workspaces-list" role="listbox" aria-label="Recent workspaces list">
            {filteredItems.map((item) => (
              <button
                key={item.path}
                className={`recent-workspace-item-button${item.isCurrent ? " current-active" : ""}`}
                onClick={() => {
                  if (!saving) {
                    onSelectWorkspace?.(item.path);
                  }
                }}
                disabled={saving}
                data-tooltip={item.fullPath}
                type="button"
                role="option"
                aria-selected={item.isCurrent}
              >
                <span className="recent-workspace-item-icon" aria-hidden="true">
                  <Folder size={14} />
                </span>
                <span className="recent-workspace-item-text">
                  <span className="recent-workspace-item-name-row">
                    <span className="recent-workspace-item-name">{item.name}</span>
                    {item.isCurrent && (
                      <span className="recent-workspace-badge">
                        <Check size={12} style={{ marginRight: 3 }} /> Current
                      </span>
                    )}
                  </span>
                  <span className="recent-workspace-item-path" title={item.fullPath}>
                    {item.parentDir ? `${item.parentDir}/` : item.fullPath}
                  </span>
                </span>
                <ArrowRight size={14} className="recent-workspace-item-arrow" aria-hidden="true" />
              </button>
            ))}
          </div>
        ) : (
          <div className="recent-workspaces-empty">
            <span className="recent-workspaces-empty-icon" aria-hidden="true">
              <FolderOpen size={20} />
            </span>
            <p>
              {query.trim()
                ? "No workspaces match your search."
                : "No recent workspaces found. Open a workspace folder to get started."}
            </p>
            {onBrowseWorkspace && !query.trim() && (
              <AppButton variant="primary" onClick={onBrowseWorkspace}>
                <FolderOpen size={14} style={{ marginRight: 6 }} />
                Open Workspace...
              </AppButton>
            )}
          </div>
        )}
      </div>

      {onBrowseWorkspace && (
        <div className="recent-workspaces-footer">
          <AppButton onClick={onBrowseWorkspace} title="Browse a new workspace folder from disk">
            <FolderOpen size={14} style={{ marginRight: 6 }} />
            Browse Workspace from Disk...
          </AppButton>
        </div>
      )}
    </OverlayDialog>
  );
}

export default RecentWorkspacesModal;
