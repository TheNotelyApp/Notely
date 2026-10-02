import { useState, useEffect, useCallback, useMemo } from "react";
import {
  GitBranch,
  GitCommit,
  Cloud,
  ArrowUpDown,
  RefreshCw,
  Plus,
  Trash2,
  Check,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Upload,
  Download,
  FileEdit,
  FilePlus2,
} from "lucide-react";
import AppButton from "./AppButton";
import AppInput from "./AppInput";
import AppTextarea from "./AppTextarea";
import SubpageHeader from "./layout/SubpageHeader";
import { OverlayDialog } from "./OverlayDialog";
import { GitCommitTimeline } from "./GitCommitTimeline";
import { GitCommitDialog } from "./GitCommitDialog";
import {
  gitDetect,
  gitGetRepoInfo,
  gitInitRepo,
  gitGetStatus,
  gitGetLog,
  gitCommit,
  gitListRemotes,
  gitAddRemote,
  gitRemoveRemote,
  gitPush,
  gitPull,
  gitFetch,
  gitGetCommitFiles,
} from "../services/electronService";

// ── Tab Config ────────────────────────────────────────────────────────────────

const TABS = [
  { id: "changes", label: "Pending Changes", icon: FileEdit },
  { id: "history", label: "Milestones Log", icon: GitCommit },
  { id: "sync", label: "Cloud Sync & Backup", icon: Cloud },
];

function normalizeTabId(tabId) {
  if (!tabId) return "changes";
  if (tabId === "status" || tabId === "commit") return "changes";
  if (tabId === "remotes") return "sync";
  if (tabId === "compare" || tabId === "branches" || tabId === "tags" || tabId === "stashes") return "history";
  return tabId;
}

// ── Empty States ──────────────────────────────────────────────────────────────

function NoGitState() {
  return (
    <div className="git-vc-empty">
      <AlertTriangle size={20} className="git-vc-empty__icon git-vc-empty__icon--warn" aria-hidden="true" />
      <h2 className="git-vc-empty__title">Git not detected</h2>
      <p className="git-vc-empty__desc">
        Git is not installed or not found on your system PATH.
        Install Git to enable version history, milestones, and cloud sync.
      </p>
      <AppButton
        variant="primary"
        onClick={() => window.open("https://git-scm.com/download/win", "_blank")}
        className="git-vc-empty__action"
      >
        <ExternalLink size={14} />
        Install Git for Windows
      </AppButton>
    </div>
  );
}

function NoRepoState({ onInit, initializing }) {
  return (
    <div className="git-vc-empty">
      <GitBranch size={20} className="git-vc-empty__icon" aria-hidden="true" />
      <h2 className="git-vc-empty__title">Workspace not initialized</h2>
      <p className="git-vc-empty__desc">
        This workspace is not tracking revision history yet.
        Initialize version control to create milestones and sync notes to the cloud.
      </p>
      <AppButton
        variant="primary"
        onClick={onInit}
        disabled={initializing}
        className="git-vc-empty__action"
        aria-busy={initializing}
      >
        <GitCommit size={14} />
        {initializing ? "Initializing…" : "Enable Version Tracking"}
      </AppButton>
    </div>
  );
}

// ── Changes & Commit Tab ──────────────────────────────────────────────────────

function ChangesTab({ status, workspacePath, onRefresh, onCommitSuccess }) {
  const { files = [], branch = "", ahead = 0, behind = 0 } = status || {};
  const [selectedPaths, setSelectedPaths] = useState([]);
  const [message, setMessage] = useState("");
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState(null);

  // Auto-select all changed files when status updates
  useEffect(() => {
    setSelectedPaths(files.map((f) => f.path));
  }, [files]);

  function togglePath(filePath) {
    setSelectedPaths((prev) =>
      prev.includes(filePath) ? prev.filter((p) => p !== filePath) : [...prev, filePath]
    );
  }

  async function handleCommit() {
    const trimmed = message.trim();
    if (!trimmed) {
      setError("Please provide a milestone description.");
      return;
    }
    if (selectedPaths.length === 0) {
      setError("Select at least one note to include in this milestone.");
      return;
    }

    setCommitting(true);
    setError(null);

    try {
      const result = await gitCommit({
        workspacePath,
        message: trimmed,
        filePaths: selectedPaths,
      });
      if (!result?.ok) throw new Error(result?.error || "Commit failed.");

      setMessage("");
      onCommitSuccess?.();
      onRefresh?.();
    } catch (err) {
      setError(err?.message || "Failed to save milestone.");
    } finally {
      setCommitting(false);
    }
  }

  const canCommit = message.trim().length > 0 && selectedPaths.length > 0 && !committing;

  const [filterText, setFilterText] = useState("");

  const filteredFiles = useMemo(() => {
    if (!filterText.trim()) return files;
    const q = filterText.toLowerCase();
    return files.filter((f) => f.path.toLowerCase().includes(q));
  }, [files, filterText]);

  const allFilteredSelected = filteredFiles.length > 0 && filteredFiles.every((f) => selectedPaths.includes(f.path));
  const someFilteredSelected = filteredFiles.some((f) => selectedPaths.includes(f.path)) && !allFilteredSelected;

  function toggleSelectAllFiltered() {
    if (allFilteredSelected) {
      const filteredPathSet = new Set(filteredFiles.map((f) => f.path));
      setSelectedPaths((prev) => prev.filter((p) => !filteredPathSet.has(p)));
    } else {
      const newSelected = new Set([...selectedPaths, ...filteredFiles.map((f) => f.path)]);
      setSelectedPaths(Array.from(newSelected));
    }
  }

  function splitPath(filePath) {
    const normalized = (filePath || "").replace(/\\/g, "/");
    const lastSlash = normalized.lastIndexOf("/");
    if (lastSlash === -1) return { dir: "", file: normalized };
    return {
      dir: normalized.slice(0, lastSlash + 1),
      file: normalized.slice(lastSlash + 1),
    };
  }

  return (
    <div className="git-vc-status" style={{ width: "100%" }}>
      {/* Branch & Sync Status Banner */}
      <div className="git-vc-status__header" style={{ padding: "var(--space-2) 0", borderBottom: "1px solid var(--border-soft)", marginBottom: "var(--space-4)" }}>
        <div className="git-vc-status__branch">
          <GitBranch size={16} aria-hidden="true" />
          <span>Branch: <strong>{branch || "main"}</strong></span>
          {(ahead > 0 || behind > 0) && (
            <span className="git-vc-status__sync" style={{ marginLeft: "var(--space-2)" }}>
              {ahead > 0 && <span className="git-vc-status__ahead">↑ {ahead} to push</span>}
              {behind > 0 && <span className="git-vc-status__behind">↓ {behind} to pull</span>}
            </span>
          )}
        </div>
      </div>

      {files.length === 0 ? (
        <div className="git-vc-empty git-vc-empty--inline" style={{ textAlign: "center", padding: "var(--space-8) var(--space-4)" }}>
          <Check size={20} className="git-vc-empty__icon git-vc-empty__icon--success" style={{ margin: "0 auto var(--space-3)" }} />
          <h3 style={{ margin: "0 0 var(--space-2)", color: "var(--text-strong)", fontSize: "var(--font-size-heading-md)" }}>All notes up to date</h3>
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "var(--font-size-body-sm)" }}>No uncommitted note modifications found in this workspace.</p>
        </div>
      ) : (
        <div className="git-vc-status__body" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {/* Milestone Composer Card */}
          <div
            className="panel-card"
            style={{
              background: "var(--surface-bg)",
              border: "1px solid var(--border-soft)",
              borderRadius: "var(--radius-lg)",
              padding: "var(--space-4)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-2)" }}>
              <span style={{ fontWeight: 600, fontSize: "var(--font-size-body)", color: "var(--text-strong)" }}>
                Save Milestone Checkpoint
              </span>
              <span style={{ fontSize: "var(--font-size-caption)", color: "var(--text-muted)" }}>
                {selectedPaths.length} of {files.length} notes selected
              </span>
            </div>

            <AppTextarea
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Describe your milestone (e.g. Completed docs restructure, updated getting started guide)…"
              rows={3}
              disabled={committing}
              style={{ width: "100%", minHeight: "68px", boxSizing: "border-box" }}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                  e.preventDefault();
                  handleCommit();
                }
              }}
            />

            {error && (
              <p style={{ color: "var(--status-danger-text, #ef4444)", fontSize: "var(--font-size-caption)", marginTop: "var(--space-2)", marginBottom: 0 }}>
                {error}
              </p>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "var(--space-3)" }}>
              <span style={{ fontSize: "var(--font-size-caption)", color: "var(--text-muted)" }}>
                Press <strong>Ctrl+Enter</strong> to save
              </span>
              <AppButton
                variant="primary"
                onClick={handleCommit}
                disabled={!canCommit}
                aria-busy={committing}
              >
                <GitCommit size={14} />
                {committing ? "Saving…" : "Save Milestone"}
              </AppButton>
            </div>
          </div>

          {/* Structured Notes Activity Card */}
          <div
            className="panel-card"
            style={{
              background: "var(--surface-bg)",
              border: "1px solid var(--border-soft)",
              borderRadius: "var(--radius-lg)",
              padding: "var(--space-3)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            {/* Header / Filter Toolbar */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "var(--space-2) var(--space-3)",
                gap: "var(--space-3)",
                flexWrap: "wrap",
                marginBottom: "var(--space-2)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer", fontSize: "var(--font-size-body-sm)", fontWeight: 600, color: "var(--text-strong)", userSelect: "none" }}>
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someFilteredSelected;
                    }}
                    onChange={toggleSelectAllFiltered}
                    disabled={committing || filteredFiles.length === 0}
                    style={{ cursor: "pointer", accentColor: "var(--accent-solid, #6366f1)" }}
                  />
                  <span>Modified Notes</span>
                </label>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: "var(--radius-pill)",
                    background: "var(--surface-accent)",
                    color: "var(--accent-strong, #6366f1)",
                  }}
                >
                  {selectedPaths.length} / {files.length}
                </span>
              </div>

              {/* Quick Filter Search */}
              <div style={{ width: "220px" }}>
                <AppInput
                  type="text"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  placeholder="Filter modified notes…"
                  aria-label="Filter modified notes"
                  style={{ height: "28px", fontSize: "var(--font-size-caption)" }}
                />
              </div>
            </div>

            {/* Note List */}
            <div style={{ minHeight: "120px" }}>
              {filteredFiles.length === 0 ? (
                <div style={{ padding: "var(--space-6) var(--space-4)", textAlign: "center", color: "var(--text-muted)", fontSize: "var(--font-size-body-sm)" }}>
                  No modified notes matching &ldquo;{filterText}&rdquo;
                </div>
              ) : (
                <ul
                  className="git-vc-file-list"
                  aria-label="Changed notes"
                  style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "2px" }}
                >
                  {filteredFiles.map((f) => {
                    const isSelected = selectedPaths.includes(f.path);
                    const isUntracked = f.status === "untracked";
                    const { dir, file } = splitPath(f.path);

                    return (
                      <li
                        key={f.path}
                        onClick={() => togglePath(f.path)}
                        className={`git-vc-file-row ${isSelected ? "selected" : ""}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "var(--space-3)",
                          padding: "6px 10px",
                          borderRadius: "var(--radius-md)",
                          cursor: "pointer",
                          userSelect: "none",
                          background: isSelected ? "var(--surface-subtle)" : "transparent",
                          transition: "background var(--motion-fast)",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => togglePath(f.path)}
                          disabled={committing}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Select ${f.path}`}
                          style={{ cursor: "pointer", accentColor: "var(--accent-solid, #6366f1)" }}
                        />
                        {isUntracked ? (
                          <FilePlus2 size={14} style={{ color: "var(--status-success-text, #22c55e)", minWidth: "14px", flexShrink: 0 }} />
                        ) : (
                          <FileEdit size={14} style={{ color: "var(--accent-solid, #6366f1)", minWidth: "14px", flexShrink: 0 }} />
                        )}
                        <div style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "var(--font-size-body-sm)" }} title={f.path}>
                          {dir && <span style={{ color: "var(--text-muted)", fontSize: "var(--font-size-caption)", marginRight: "4px" }}>{dir}</span>}
                          <strong style={{ color: "var(--text-strong)", fontWeight: 500 }}>{file}</strong>
                        </div>
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            letterSpacing: "0.03em",
                            textTransform: "uppercase",
                            padding: "2px 7px",
                            borderRadius: "var(--radius-pill)",
                            background: isUntracked ? "var(--status-success-bg, rgba(34, 197, 94, 0.15))" : "var(--surface-accent)",
                            color: isUntracked ? "var(--status-success-text, #22c55e)" : "var(--accent-strong, #6366f1)",
                            flexShrink: 0,
                          }}
                        >
                          {isUntracked ? "NEW" : "MODIFIED"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Milestones / History Tab ──────────────────────────────────────────────────

function HistoryTab({ commits, loading, error }) {
  return (
    <div className="git-vc-history" style={{ width: "100%" }}>
      <GitCommitTimeline
        commits={commits}
        loading={loading}
        error={error}
        searchable
        emptyMessage="No milestones saved yet. Use the Pending Changes tab to save your first milestone."
      />
    </div>
  );
}

// ── Cloud Sync & Backup Tab ───────────────────────────────────────────────────

function SyncTab({ workspacePath, onNotify, status, onRefresh }) {
  const [remotes, setRemotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("origin");
  const [newUrl, setNewUrl] = useState("");
  const [newToken, setNewToken] = useState("");
  const [adding, setAdding] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);

  const loadRemotes = useCallback(async () => {
    setLoading(true);
    try {
      const result = await gitListRemotes(workspacePath);
      if (result?.ok) setRemotes(result.data || []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [workspacePath]);

  useEffect(() => {
    loadRemotes();
  }, [loadRemotes]);

  async function handleAdd() {
    if (!newName.trim() || !newUrl.trim()) return;
    setAdding(true);
    const result = await gitAddRemote({ workspacePath, name: newName.trim(), url: newUrl.trim() });
    setAdding(false);
    if (result?.ok) {
      onNotify?.(`Cloud target "${newName}" configured.`, "success");
      setNewName("origin");
      setNewUrl("");
      setNewToken("");
      loadRemotes();
      onRefresh?.();
    } else {
      onNotify?.(result?.error || "Failed to add remote.", "error");
    }
  }

  async function handleRemove(name) {
    if (!window.confirm(`Remove remote target "${name}"?`)) return;
    const result = await gitRemoveRemote({ workspacePath, name });
    if (result?.ok) {
      onNotify?.(`Remote "${name}" removed.`, "success");
      loadRemotes();
      onRefresh?.();
    } else {
      onNotify?.(result?.error || "Failed to remove remote.", "error");
    }
  }

  async function handleFullSync(remote) {
    setSyncBusy(true);
    const auth = newToken.trim() ? { type: "pat", token: newToken.trim() } : { type: "ssh" };
    try {
      const pullRes = await gitPull({ workspacePath, remote: remote.name, auth });
      if (!pullRes?.ok) {
        throw new Error(pullRes?.error || "Pull from cloud failed.");
      }

      const pushRes = await gitPush({ workspacePath, remote: remote.name, auth });
      if (!pushRes?.ok) {
        throw new Error(pushRes?.error || "Push to cloud failed.");
      }

      onNotify?.("Workspace synced with cloud successfully.", "success");
      onRefresh?.();
    } catch (err) {
      onNotify?.(err?.message || "Sync failed.", "error");
    } finally {
      setSyncBusy(false);
    }
  }

  async function handleIndividualAction(remote, action) {
    setSyncBusy(true);
    const auth = newToken.trim() ? { type: "pat", token: newToken.trim() } : { type: "ssh" };
    try {
      let result;
      if (action === "push") {
        result = await gitPush({ workspacePath, remote: remote.name, auth });
      } else if (action === "pull") {
        result = await gitPull({ workspacePath, remote: remote.name, auth });
      } else {
        result = await gitFetch({ workspacePath, remote: remote.name, auth });
      }

      if (result?.ok) {
        onNotify?.(`${action.toUpperCase()} with "${remote.name}" succeeded.`, "success");
        onRefresh?.();
      } else {
        onNotify?.(result?.error || `${action} failed.`, "error");
      }
    } catch (err) {
      onNotify?.(err?.message || `${action} failed.`, "error");
    } finally {
      setSyncBusy(false);
    }
  }

  const { ahead = 0, behind = 0 } = status || {};

  return (
    <div className="git-vc-remotes" style={{ width: "100%", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {/* Cloud Sync Status Card */}
      {remotes.length > 0 ? (
        <div
          className="panel-card"
          style={{
            background: "var(--surface-bg)",
            border: "1px solid var(--border-soft)",
            borderRadius: "var(--radius-lg)",
            padding: "var(--space-4)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
            <h3 style={{ margin: 0, fontSize: "var(--font-size-body)", fontWeight: 600, color: "var(--text-strong)" }}>
              Cloud Backup & Sync
            </h3>
            {(ahead > 0 || behind > 0) ? (
              <p style={{ margin: 0, fontSize: "var(--font-size-caption)" }}>
                {ahead > 0 && <span style={{ color: "var(--status-success-text, #22c55e)", marginRight: "var(--space-2)" }}>↑ {ahead} to push</span>}
                {behind > 0 && <span style={{ color: "var(--status-warning-text, #f59e0b)" }}>↓ {behind} to pull</span>}
              </p>
            ) : (
              <span style={{ fontSize: "var(--font-size-caption)", color: "var(--status-success-text, #22c55e)", fontWeight: 600 }}>
                ✓ Up to date with cloud
              </span>
            )}
          </div>

          <div style={{ marginBottom: "var(--space-3)" }}>
            <label htmlFor="remote-pat" style={{ fontSize: "var(--font-size-caption)", color: "var(--text-muted)", display: "block", marginBottom: "var(--space-1)" }}>
              Personal Access Token (HTTPS, optional)
            </label>
            <AppInput
              id="remote-pat"
              type="password"
              value={newToken}
              onChange={(e) => setNewToken(e.target.value)}
              placeholder="Leave blank for SSH authentication"
              aria-label="Personal Access Token"
            />
          </div>

          <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", flexWrap: "wrap" }}>
            {remotes.map((r) => (
              <div key={r.name} style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
                <AppButton variant="primary" onClick={() => handleFullSync(r)} disabled={syncBusy} aria-busy={syncBusy}>
                  <RefreshCw size={14} className={syncBusy ? "animate-spin" : ""} />
                  {syncBusy ? "Syncing…" : `Sync with ${r.name}`}
                </AppButton>
                <AppButton variant="small" onClick={() => handleIndividualAction(r, "push")} disabled={syncBusy}>
                  <Upload size={14} />
                  Push
                </AppButton>
                <AppButton variant="small" onClick={() => handleIndividualAction(r, "pull")} disabled={syncBusy}>
                  <Download size={14} />
                  Pull
                </AppButton>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="git-vc-empty git-vc-empty--inline" style={{ textAlign: "center", padding: "var(--space-6)" }}>
          <Cloud size={20} className="git-vc-empty__icon" style={{ margin: "0 auto var(--space-2)" }} />
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "var(--font-size-body-sm)" }}>
            No remote repository connected. Add a GitHub or GitLab target below to enable cloud backup.
          </p>
        </div>
      )}

      {/* Configured Targets List */}
      <div
        className="panel-card"
        style={{
          background: "var(--surface-bg)",
          border: "1px solid var(--border-soft)",
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-4)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <h3 style={{ margin: "0 0 var(--space-3)", fontSize: "var(--font-size-body)", fontWeight: 600, color: "var(--text-strong)" }}>
          Connected Backup Targets
        </h3>
        {loading ? (
          <div style={{ fontSize: "var(--font-size-body-sm)", color: "var(--text-muted)" }}>Loading remotes…</div>
        ) : remotes.length === 0 ? (
          <p style={{ fontSize: "var(--font-size-body-sm)", color: "var(--text-muted)", margin: 0 }}>None</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "var(--space-2)" }} aria-label="Remotes">
            {remotes.map((r) => (
              <li key={r.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "var(--space-2) var(--space-3)", borderRadius: "var(--radius-default)", background: "var(--surface-muted)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", overflow: "hidden" }}>
                  <Cloud size={14} aria-hidden="true" />
                  <strong>{r.name}</strong>
                  <span style={{ fontSize: "var(--font-size-caption)", color: "var(--text-muted)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                    {r.fetchUrl}
                  </span>
                </div>
                <AppButton variant="small" danger onClick={() => handleRemove(r.name)} data-tooltip="Remove remote">
                  <Trash2 size={12} />
                </AppButton>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add Remote Card */}
      <div
        className="panel-card"
        style={{
          background: "var(--surface-bg)",
          border: "1px solid var(--border-soft)",
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-4)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <h3 style={{ margin: "0 0 var(--space-3)", fontSize: "var(--font-size-body)", fontWeight: 600, color: "var(--text-strong)" }}>
          Connect Remote Target
        </h3>
        <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", flexWrap: "wrap" }}>
          <AppInput
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name (e.g. origin)"
            aria-label="Remote name"
            style={{ width: "130px" }}
          />
          <AppInput
            type="text"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="Git URL (e.g. https://github.com/user/notes.git)"
            aria-label="Remote URL"
            style={{ flex: 1, minWidth: "220px" }}
          />
          <AppButton variant="primary" onClick={handleAdd} disabled={!newName.trim() || !newUrl.trim() || adding} aria-busy={adding}>
            <Plus size={14} />
            {adding ? "Adding…" : "Add Target"}
          </AppButton>
        </div>
      </div>
    </div>
  );
}

// ── Main Page Component ───────────────────────────────────────────────────────

export function GitVersionControlPage({
  workspacePath,
  onBack,
  onNotify,
  initialTab = "changes",
  onGitStateChange,
}) {
  const [activeTab, setActiveTab] = useState(() => normalizeTabId(initialTab));
  useEffect(() => {
    setActiveTab(normalizeTabId(initialTab));
  }, [initialTab]);

  const [gitAvailable, setGitAvailable] = useState(null);
  const [isRepo, setIsRepo] = useState(null);
  const [initializing, setInitializing] = useState(false);
  const [status, setStatus] = useState(null);
  const [commits, setCommits] = useState([]);
  const [commitsLoading, setCommitsLoading] = useState(false);
  const [commitsError, setCommitsError] = useState(null);
  const [commitDialogOpen, setCommitDialogOpen] = useState(false);
  const [syncConfirmOpen, setSyncConfirmOpen] = useState(false);

  const refreshStatus = useCallback(async (triggerFetch = false) => {
    if (!workspacePath) return;
    try {
      if (triggerFetch) {
        try {
          await gitFetch({ workspacePath });
        } catch { /* ignore fetch errors in background */ }
      }
      const result = await gitGetStatus(workspacePath);
      if (result?.ok) {
        setStatus(result.data);
        onGitStateChange?.({
          branch: result.data.branch,
          pendingCount: result.data.files.length,
          ahead: result.data.ahead || 0,
          behind: result.data.behind || 0,
          repoRoot: result.data.repoRoot,
        });
      }
    } catch { /* ignore */ }
  }, [workspacePath, onGitStateChange]);

  const refreshCommits = useCallback(async () => {
    if (!workspacePath) return;
    setCommitsLoading(true);
    setCommitsError(null);
    try {
      const result = await gitGetLog({ workspacePath, limit: 200 });
      if (result?.ok) {
        const enriched = await Promise.all(
          (result.data || []).map(async (c) => {
            try {
              const fileResult = await gitGetCommitFiles({ workspacePath, commitHash: c.hash });
              return { ...c, files: fileResult?.ok ? fileResult.data : [] };
            } catch { return c; }
          })
        );
        setCommits(enriched);
      } else {
        setCommitsError(result?.error || "Failed to load milestones.");
      }
    } catch (err) {
      setCommitsError(err?.message);
    } finally {
      setCommitsLoading(false);
    }
  }, [workspacePath]);

  const checkGitAndRepo = useCallback(async () => {
    try {
      const detection = await gitDetect();
      if (!detection?.ok || !detection.data.available) {
        setGitAvailable(false);
        return;
      }
      setGitAvailable(true);

      const repoInfo = await gitGetRepoInfo(workspacePath);
      if (repoInfo?.ok) {
        setIsRepo(repoInfo.data.isRepo);

        if (repoInfo.data.isRepo) {
          refreshStatus();
          refreshCommits();
        }
      }
    } catch { /* ignore */ }
  }, [workspacePath, refreshStatus, refreshCommits]);

  useEffect(() => {
    checkGitAndRepo();
  }, [checkGitAndRepo]);

  async function handleInit() {
    setInitializing(true);
    try {
      const result = await gitInitRepo(workspacePath);
      if (result?.ok) {
        onNotify?.("Version tracking enabled for this workspace.", "success");
        checkGitAndRepo();
      } else {
        onNotify?.(result?.error || "Initialization failed.", "error");
      }
    } catch (err) {
      onNotify?.(err?.message || "Initialization failed.", "error");
    } finally {
      setInitializing(false);
    }
  }

  function handleCommitSuccess() {
    handleRefresh();
    setSyncConfirmOpen(true);
  }

  async function handleGlobalCommit(payload) {
    const result = await gitCommit({ workspacePath, ...payload });
    if (!result?.ok) throw new Error(result?.error || "Commit failed.");
    refreshStatus();
    refreshCommits();
    setSyncConfirmOpen(true);
  }

  const [globalSyncing, setGlobalSyncing] = useState(false);

  async function handleQuickSync() {
    if (!workspacePath) return;
    setGlobalSyncing(true);
    try {
      const remotesRes = await gitListRemotes(workspacePath);
      const remotesList = remotesRes?.ok ? remotesRes.data : [];
      if (!remotesList || remotesList.length === 0) {
        onNotify?.("No remote connected. Configure a target in Cloud Sync.", "info");
        setActiveTab("sync");
        return;
      }
      const primaryRemote = remotesList[0].name || "origin";
      const pullRes = await gitPull({ workspacePath, remote: primaryRemote });
      if (!pullRes?.ok) {
        throw new Error(pullRes?.error || "Pull from cloud failed.");
      }
      const pushRes = await gitPush({ workspacePath, remote: primaryRemote });
      if (!pushRes?.ok) {
        throw new Error(pushRes?.error || "Push to cloud failed.");
      }
      onNotify?.("Workspace synced with cloud successfully.", "success");
      handleRefresh();
    } catch (err) {
      onNotify?.(err?.message || "Cloud sync failed.", "error");
    } finally {
      setGlobalSyncing(false);
    }
  }

  function handleRefresh() {
    refreshStatus();
    refreshCommits();
  }

  if (gitAvailable === null) {
    return (
      <div className="git-vc-page" aria-label="Revisions and Sync">
        <SubpageHeader currentTitle="Revisions & Sync" onBack={onBack} />
        <div className="git-vc-checking" aria-live="polite">
          <span className="git-timeline-spinner" aria-label="Checking Git" />
          Checking version tracking…
        </div>
      </div>
    );
  }

  return (
    <div className="git-vc-page" aria-label="Revisions and Sync">
      {/* Standard Unified Header */}
      <SubpageHeader
        currentTitle="Revisions & Sync"
        onBack={onBack}
        actions={
          isRepo ? (
            <>
              {status?.branch && (
                <div className="topbar-stat-pill" style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
                    <GitBranch size={12} />
                    <span>{status.branch}</span>
                    {status.files?.length > 0 && (
                      <span className="git-status-bar__badge" style={{ marginLeft: "2px" }}>{status.files.length}</span>
                    )}
                  </div>
                  {(status.ahead > 0 || status.behind > 0) && (
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", fontWeight: 700 }}>
                      {status.ahead > 0 && (
                        <span style={{ color: "var(--status-success-text, #22c55e)" }}>↑ {status.ahead} push</span>
                      )}
                      {status.behind > 0 && (
                        <span style={{ color: "var(--status-warning-text, #f59e0b)" }}>↓ {status.behind} pull</span>
                      )}
                    </div>
                  )}
                </div>
              )}
              <AppButton
                variant="small"
                onClick={handleQuickSync}
                disabled={globalSyncing}
                aria-busy={globalSyncing}
                data-tooltip="Sync changes (pull & push) with cloud"
                aria-label="Sync"
              >
                <ArrowUpDown size={14} className={globalSyncing ? "animate-spin" : ""} />
                {globalSyncing ? "Syncing…" : "Sync"}
              </AppButton>
              <AppButton
                variant="small"
                onClick={handleRefresh}
                data-tooltip="Refresh changes"
                aria-label="Refresh"
              >
                <RefreshCw size={14} />
              </AppButton>
            </>
          ) : null
        }
      />

      {/* Empty states */}
      {!gitAvailable && <NoGitState />}
      {gitAvailable && isRepo === false && (
        <NoRepoState
          onInit={handleInit}
          initializing={initializing}
        />
      )}

      {/* Main 3-Tab Interface */}
      {gitAvailable && isRepo && (
        <div className="git-vc-content">
          {/* Tab Navigation Strip */}
          <div className="git-vc-tabs" role="tablist" aria-label="Revisions and sync views">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`git-tab-${id}`}
                aria-controls={`git-panel-${id}`}
                aria-selected={activeTab === id}
                className={`git-vc-tab${activeTab === id ? " git-vc-tab--active" : ""}`}
                onClick={() => setActiveTab(id)}
              >
                <Icon size={14} aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>

          {/* Panel Container */}
          <div
            className="git-vc-panel"
            id={`git-panel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`git-tab-${activeTab}`}
          >
            {activeTab === "changes" && (
              <ChangesTab
                status={status}
                workspacePath={workspacePath}
                onRefresh={handleRefresh}
                onNotify={onNotify}
                onCommitSuccess={handleCommitSuccess}
                onSync={handleQuickSync}
              />
            )}
            {activeTab === "history" && (
              <HistoryTab
                commits={commits}
                loading={commitsLoading}
                error={commitsError}
              />
            )}
            {activeTab === "sync" && (
              <SyncTab
                workspacePath={workspacePath}
                onNotify={onNotify}
                status={status}
                onRefresh={handleRefresh}
              />
            )}
          </div>
        </div>
      )}

      {/* Global Milestone Dialog */}
      {isRepo && (
        <GitCommitDialog
          open={commitDialogOpen}
          onClose={() => setCommitDialogOpen(false)}
          onCommit={handleGlobalCommit}
          stagedFiles={status?.files || []}
          workspacePath={workspacePath}
        />
      )}

      {/* Post-Commit Remote Sync Confirmation Dialog */}
      {syncConfirmOpen && (
        <OverlayDialog
          open={syncConfirmOpen}
          onClose={() => setSyncConfirmOpen(false)}
          ariaLabel="Remote Sync Confirmation"
          size="sm"
        >
          <div style={{ padding: "var(--space-4)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "var(--radius-pill)",
                  background: "var(--status-success-bg, rgba(34, 197, 94, 0.15))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <CheckCircle2 size={20} style={{ color: "var(--status-success-text, #22c55e)" }} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "var(--font-size-heading-sm)", fontWeight: 600, color: "var(--text-strong)" }}>
                  Milestone Saved
                </h3>
                <p style={{ margin: 0, fontSize: "var(--font-size-caption)", color: "var(--text-muted)" }}>
                  Branch: <strong>{status?.branch || "main"}</strong>
                </p>
              </div>
            </div>

            <p style={{ margin: "0 0 var(--space-4)", fontSize: "var(--font-size-body-sm)", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Your milestone checkpoint was saved to local history. Would you like to perform a remote sync now?
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-2)" }}>
              <AppButton
                variant="secondary"
                onClick={() => setSyncConfirmOpen(false)}
              >
                Not Now
              </AppButton>
              <AppButton
                variant="primary"
                onClick={() => {
                  setSyncConfirmOpen(false);
                  handleQuickSync();
                }}
              >
                <ArrowUpDown size={14} />
                Remote Sync
              </AppButton>
            </div>
          </div>
        </OverlayDialog>
      )}
    </div>
  );
}

export default GitVersionControlPage;
