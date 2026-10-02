import { useState, useRef, useEffect } from "react";
import {
  GitBranch,
  GitCommit,
  ArrowUpDown,
  RefreshCw,
  X,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import AppButton from "./AppButton";

/**
 * GitStatusBar — shown in the bottom terminal-status-bar right section.
 * Renders branch info, uncommitted changes, ahead/behind sync counts,
 * and a flyout popover for quick status overview & actions.
 */
export function GitStatusBar({ gitState, onClick, onOpenVC, onSaveMilestone, onSync }) {
  const {
    gitAvailable,
    isRepo,
    branch,
    pendingCount = 0,
    ahead = 0,
    behind = 0,
    loading,
  } = gitState || {};

  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const wrapperRef = useRef(null);
  const hoverTimerRef = useRef(null);

  // Close flyout when clicking outside
  useEffect(() => {
    if (!flyoutOpen) return undefined;
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setFlyoutOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [flyoutOpen]);

  const handleMouseEnter = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setFlyoutOpen(true);
  };

  const handleMouseLeave = () => {
    hoverTimerRef.current = setTimeout(() => {
      setFlyoutOpen(false);
    }, 250);
  };

  const handleClose = (e) => {
    e?.stopPropagation?.();
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setFlyoutOpen(false);
  };

  const handleOpenVCPage = (tab) => {
    handleClose();
    if (onOpenVC) {
      onOpenVC(tab);
    } else if (onClick) {
      onClick();
    }
  };

  const handleTriggerSync = async () => {
    if (onSync) {
      setSyncing(true);
      try {
        await onSync();
      } finally {
        setSyncing(false);
      }
    } else {
      handleOpenVCPage("sync");
    }
  };

  if (loading) {
    return (
      <div className="git-status-bar-wrapper" ref={wrapperRef}>
        <button
          type="button"
          className="terminal-meta-pill git-status-bar git-status-bar--loading"
          disabled
          aria-label="Git loading"
        >
          <GitBranch size={12} />
          <span>Git…</span>
        </button>
      </div>
    );
  }

  if (!gitAvailable) {
    return (
      <div className="git-status-bar-wrapper" ref={wrapperRef}>
        <button
          type="button"
          className="terminal-meta-pill git-status-bar git-status-bar--warn"
          onClick={() => handleOpenVCPage("changes")}
          data-tooltip="Git not detected — click to install"
          aria-label="Git not detected"
        >
          <GitBranch size={12} />
          <span>Git not found</span>
        </button>
      </div>
    );
  }

  if (!isRepo) {
    return (
      <div className="git-status-bar-wrapper" ref={wrapperRef}>
        <button
          type="button"
          className="terminal-meta-pill git-status-bar git-status-bar--warn"
          onClick={() => handleOpenVCPage("changes")}
          data-tooltip="Workspace is not a Git repository — click to initialize"
          aria-label="Not a Git repository"
        >
          <GitBranch size={12} />
          <span>No repo</span>
        </button>
      </div>
    );
  }

  const hasChanges = Number(pendingCount) > 0;
  const hasAhead = Number(ahead) > 0;
  const hasBehind = Number(behind) > 0;

  return (
    <div
      className="git-status-bar-wrapper"
      ref={wrapperRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
    >
      <button
        type="button"
        className={`terminal-meta-pill git-status-bar${hasChanges ? " git-status-bar--pending" : " git-status-bar--clean"}`}
        onClick={() => setFlyoutOpen((prev) => !prev)}
        data-tooltip={`Branch: ${branch || "main"}${hasChanges ? ` · ${pendingCount} modified` : ""}${hasAhead ? ` · ↑${ahead} to push` : ""}${hasBehind ? ` · ↓${behind} to pull` : ""}`}
        aria-label={`Git: ${branch || "unknown"}${hasChanges ? `, ${pendingCount} changes` : ""}`}
        aria-expanded={flyoutOpen}
      >
        <GitBranch size={12} />
        <span className="git-status-bar__branch">{branch || "main"}</span>
        {hasChanges && (
          <span className="git-status-bar__badge" aria-hidden="true" style={{ marginLeft: "2px" }}>
            {pendingCount}
          </span>
        )}
        {hasAhead && (
          <span
            className="git-status-bar__ahead"
            style={{ color: "var(--status-success-text, #22c55e)", fontSize: "10px", fontWeight: 700, marginLeft: "3px" }}
            aria-label={`${ahead} commits to push`}
          >
            ↑{ahead}
          </span>
        )}
        {hasBehind && (
          <span
            className="git-status-bar__behind"
            style={{ color: "var(--status-warning-text, #f59e0b)", fontSize: "10px", fontWeight: 700, marginLeft: "3px" }}
            aria-label={`${behind} commits to pull`}
          >
            ↓{behind}
          </span>
        )}
      </button>

      {/* Flyout Popover */}
      {flyoutOpen && (
        <div
          className="vscode-status-flyout"
          role="dialog"
          aria-label="Git Status and Sync"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            right: 0,
            width: "290px",
            background: "var(--surface-bg)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-xl)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 12px",
              background: "var(--surface-subtle)",
              borderBottom: "1px solid var(--border-soft)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <GitBranch size={14} style={{ color: "var(--accent-solid)" }} />
              <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>
                Revisions & Sync
              </span>
            </div>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close flyout"
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                padding: "2px",
                display: "flex",
                alignItems: "center",
                borderRadius: "var(--radius-sm)",
              }}
            >
              <X size={14} />
            </button>
          </div>

          {/* Details Body */}
          <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px" }}>
              <span style={{ color: "var(--text-muted)" }}>Active Branch:</span>
              <strong style={{ color: "var(--text-strong)" }}>{branch || "main"}</strong>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px" }}>
              <span style={{ color: "var(--text-muted)" }}>Modified Notes:</span>
              {hasChanges ? (
                <span style={{ color: "var(--accent-strong, #6366f1)", fontWeight: 600 }}>
                  {pendingCount} uncommitted
                </span>
              ) : (
                <span style={{ color: "var(--status-success-text, #22c55e)", display: "flex", alignItems: "center", gap: "3px", fontSize: "11px" }}>
                  <CheckCircle2 size={12} /> All notes saved
                </span>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px" }}>
              <span style={{ color: "var(--text-muted)" }}>To Push:</span>
              {hasAhead ? (
                <strong style={{ color: "var(--status-success-text, #22c55e)" }}>
                  ↑ {ahead} commit{ahead === 1 ? "" : "s"}
                </strong>
              ) : (
                <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>0 ahead</span>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px" }}>
              <span style={{ color: "var(--text-muted)" }}>To Pull:</span>
              {hasBehind ? (
                <strong style={{ color: "var(--status-warning-text, #f59e0b)" }}>
                  ↓ {behind} commit{behind === 1 ? "" : "s"}
                </strong>
              ) : (
                <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>0 behind</span>
              )}
            </div>
          </div>

          {/* Actions Footer */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              padding: "10px 12px",
              background: "var(--surface-subtle)",
              borderTop: "1px solid var(--border-soft)",
            }}
          >
            <div style={{ display: "flex", gap: "6px" }}>
              <AppButton
                variant="primary"
                onClick={handleTriggerSync}
                disabled={syncing}
                aria-busy={syncing}
                style={{ flex: 1, height: "30px", fontSize: "12px" }}
              >
                <ArrowUpDown size={14} className={syncing ? "animate-spin" : ""} />
                {syncing ? "Syncing…" : "Sync"}
              </AppButton>
              {hasChanges && onSaveMilestone && (
                <AppButton
                  variant="secondary"
                  onClick={() => {
                    setFlyoutOpen(false);
                    onSaveMilestone();
                  }}
                  style={{ flex: 1, height: "30px", fontSize: "12px" }}
                >
                  <GitCommit size={14} />
                  Milestone
                </AppButton>
              )}
            </div>

            <AppButton
              variant="small"
              onClick={() => handleOpenVCPage("changes")}
              style={{ width: "100%", justifyContent: "center", fontSize: "11px" }}
            >
              <ExternalLink size={12} />
              Open Version Control Hub
            </AppButton>
          </div>
        </div>
      )}
    </div>
  );
}

export default GitStatusBar;

