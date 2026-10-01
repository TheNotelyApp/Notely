import { useState, useMemo, useEffect, useCallback } from "react";
import {
  FolderGit2,
  GitBranch,
  GitCommit,
  Search,
  Plus,
  RefreshCw,
  Trash2,
  ExternalLink,
  Share2,
  FileText,
  X,
  Copy,
  Check,
  PanelLeftClose,
  PanelLeftOpen,
  FolderOpen,
  Layers
} from "lucide-react";
import {
  getAttachedRepos,
  addAttachedRepo,
  removeAttachedRepo,
  onAttachedReposChanged,
  openFolder,
  openExternal,
  aiBuildGraph,
  onGraphProgress
} from "../services/electronService";
import AppButton from "./AppButton";
import AppIconButton from "./AppIconButton";
import AppInput from "./AppInput";
import OverlayDialog from "./OverlayDialog";
import { showToast } from "../utils/notificationUtils";
import "../styles/AttachedReposPage.css";

export function AttachedReposPage({
  _notesFolderPath,
  documents = [],
  onBack,
  onClose,
  onNotify,
  onOpenKnowledgeGraph,
  onOpenNote
}) {
  const handleBack = onBack || onClose;
  const [repos, setRepos] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRepoId, setSelectedRepoId] = useState("all");
  const [selectedItem, setSelectedItem] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Attach Modal State
  const [attachModalOpen, setAttachModalOpen] = useState(false);
  const [newRepoPath, setNewRepoPath] = useState("");
  const [newRepoName, setNewRepoName] = useState("");
  const [newRepoBranch, setNewRepoBranch] = useState("main");

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (attachModalOpen) {
          setAttachModalOpen(false);
        } else if (selectedItem) {
          setSelectedItem(null);
        } else if (typeof handleBack === "function") {
          handleBack();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [attachModalOpen, selectedItem, handleBack]);

  const notifyUser = useCallback((msg, type = "info") => {
    if (typeof onNotify === "function") {
      onNotify(msg, type);
    } else {
      showToast(msg, type);
    }
  }, [onNotify]);

  // Load attached repos
  const loadRepos = useCallback(async () => {
    try {
      const list = await getAttachedRepos();
      setRepos(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error("[AttachedReposPage] Failed loading repos:", err);
    }
  }, []);

  useEffect(() => {
    loadRepos();
    const unsub = onAttachedReposChanged((nextRepos) => {
      if (Array.isArray(nextRepos)) setRepos(nextRepos);
    });
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [loadRepos]);

  // Browse Directory for new repo
  const handleBrowseRepoFolder = async () => {
    try {
      if (window.notesApi?.showOpenDialog) {
        const result = await window.notesApi.showOpenDialog({
          title: "Select Git Repository Directory",
          properties: ["openDirectory"]
        });
        if (result && !result.canceled && result.filePaths?.length > 0) {
          const selected = result.filePaths[0];
          setNewRepoPath(selected);
          const baseName = selected.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || "repository";
          if (!newRepoName) setNewRepoName(baseName);
        }
      }
    } catch (err) {
      notifyUser("Error opening folder picker: " + err.message, "error");
    }
  };

  // Submit Attach Repo
  const handleAttachSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!newRepoPath.trim()) {
      notifyUser("Repository path is required", "error");
      return;
    }
    try {
      await addAttachedRepo({
        path: newRepoPath.trim(),
        name: newRepoName.trim() || newRepoPath.split(/[\\/]/).pop(),
        branch: newRepoBranch.trim() || "main"
      });
      notifyUser("Repository attached successfully", "success");
      setAttachModalOpen(false);
      setNewRepoPath("");
      setNewRepoName("");
      loadRepos();
    } catch (err) {
      notifyUser("Failed attaching repository: " + err.message, "error");
    }
  };

  // Detach Repo
  const handleDetachRepo = async (repoId, repoName) => {
    if (window.confirm(`Detach repository "${repoName}" from workspace?`)) {
      try {
        await removeAttachedRepo(repoId);
        notifyUser("Repository detached", "info");
        if (selectedRepoId === repoId) setSelectedRepoId("all");
        if (selectedItem?.id === repoId) setSelectedItem(null);
        loadRepos();
      } catch (err) {
        notifyUser("Failed to detach repository: " + err.message, "error");
      }
    }
  };

  // Trigger Knowledge Graph Rebuild / Rescan
  const handleRescanGraph = async () => {
    if (isScanning) return;
    setIsScanning(true);
    setScanProgress("Starting AST scan...");
    try {
      const unsub = onGraphProgress((data) => {
        if (data?.noteName) {
          setScanProgress(`Processing: ${data.noteName} (${data.current}/${data.total})`);
        }
      });
      await aiBuildGraph();
      if (typeof unsub === "function") unsub();
      notifyUser("Code & Notes Knowledge Graph updated!", "success");
      loadRepos();
    } catch (err) {
      notifyUser("Scan failed: " + err.message, "error");
    } finally {
      setIsScanning(false);
      setScanProgress(null);
    }
  };

  // Filtered Repos
  const filteredRepos = useMemo(() => {
    return repos.filter((r) => {
      const q = searchQuery.toLowerCase();
      if (!q) return true;
      return (
        (r.name && r.name.toLowerCase().includes(q)) ||
        (r.path && r.path.toLowerCase().includes(q)) ||
        (r.branch && r.branch.toLowerCase().includes(q))
      );
    });
  }, [repos, searchQuery]);

  // Find Notes referencing selected repo
  const referencingNotes = useMemo(() => {
    if (!selectedItem || !documents.length) return [];
    const name = selectedItem.name || "";
    if (!name) return [];

    return documents.filter((doc) => {
      if (doc.entryType !== "file") return false;
      const content = doc.content || "";
      return (
        content.includes(`[[${name}]]`) ||
        content.includes(`@${name}`) ||
        content.includes(name)
      );
    });
  }, [selectedItem, documents]);

  // Copy Markdown Link
  const handleCopyLink = () => {
    if (!selectedItem) return;
    const linkText = `[[${selectedItem.name}]]`;
    navigator.clipboard.writeText(linkText);
    setCopiedLink(true);
    notifyUser(`Copied ${linkText} to clipboard`, "info");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Open in External IDE (VS Code)
  const handleOpenInIDE = (filePath) => {
    if (!filePath) return;
    openExternal(`vscode://file/${filePath.replace(/\\/g, "/")}`);
  };

  return (
    <div className="attached-repos-page">
      {/* Top Breadcrumb Bar */}
      <div className="detail-topbar">
        <nav className="detail-breadcrumb" aria-label="Attached Repositories navigation">
          <span className="detail-breadcrumb-part">
            <button className="detail-breadcrumb-link" type="button" onClick={handleBack}>
              Workspace
            </button>
            <span className="detail-breadcrumb-separator" aria-hidden="true">
              /
            </span>
          </span>
          <span className="detail-breadcrumb-current">Attached Code Repositories</span>
        </nav>
      </div>

      <div className="arp-container">
        {/* Header Toolbar */}
        <div className="arp-header-actions">
          <AppIconButton
            onClick={() => setSidebarOpen((prev) => !prev)}
            aria-label={sidebarOpen ? "Hide filters sidebar" : "Show filters sidebar"}
            title={sidebarOpen ? "Hide filters sidebar" : "Show filters sidebar"}
          >
            {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
          </AppIconButton>

          <div className="arp-search-wrapper">
            <Search size={14} className="arp-search-icon" />
            <input
              type="text"
              className="arp-search-input"
              placeholder="Search attached repositories, branches, paths…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="arp-stats-pill">
            <GitBranch size={14} style={{ color: "var(--accent-solid, #8b5cf6)" }} />
            <span>
              <strong>{repos.length}</strong> {repos.length === 1 ? "Repository" : "Repositories"} Attached
            </span>
          </div>

          <div className="arp-header-buttons">
            <AppButton
              onClick={handleRescanGraph}
              disabled={isScanning}
              title="Rescan and rebuild Code Knowledge Graph"
            >
              <RefreshCw size={14} className={isScanning ? "spin" : ""} style={{ marginRight: "4px" }} />
              {isScanning ? "Scanning..." : "Rescan Graph"}
            </AppButton>

            {onOpenKnowledgeGraph && (
              <AppButton
                onClick={onOpenKnowledgeGraph}
                title="Open interactive Knowledge Graph"
              >
                <Share2 size={14} style={{ marginRight: "4px" }} />
                Knowledge Graph
              </AppButton>
            )}

            <AppButton
              variant="primary"
              onClick={() => setAttachModalOpen(true)}
              title="Attach an external Git repository"
            >
              <Plus size={14} style={{ marginRight: "4px" }} />
              Attach Repo
            </AppButton>
          </div>
        </div>

        {/* Scanning progress banner */}
        {scanProgress && (
          <div style={{
            background: "var(--surface-accent)",
            borderBottom: "1px solid var(--border-soft)",
            padding: "8px 16px",
            fontSize: "12px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            color: "var(--accent-solid)"
          }}>
            <RefreshCw size={14} className="spin" />
            <span>{scanProgress}</span>
          </div>
        )}

        {/* Main Body */}
        <div className="arp-body">
          {/* Left Sidebar */}
          <div
            className="arp-sidebar"
            style={{
              width: sidebarOpen ? "260px" : "0px",
              minWidth: sidebarOpen ? "260px" : "0px",
              opacity: sidebarOpen ? 1 : 0,
              pointerEvents: sidebarOpen ? "auto" : "none",
              borderRight: sidebarOpen ? "1px solid var(--border-default)" : "none",
              transition: "width 0.22s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.18s ease",
            }}
          >
            <div className="arp-sidebar-section-scroll">
              <div className="arp-sidebar-section">
                <div className="arp-sidebar-section-title">
                  <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                    <Layers size={12} />
                    Repositories
                  </span>
                  <span className="arp-filter-count">{repos.length}</span>
                </div>
                <button
                  type="button"
                  className={`arp-filter-item ${selectedRepoId === "all" ? "active" : ""}`}
                  onClick={() => setSelectedRepoId("all")}
                >
                  <span>All Repositories</span>
                  <span className="arp-filter-count">{repos.length}</span>
                </button>
                {repos.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className={`arp-filter-item ${selectedRepoId === r.id ? "active" : ""}`}
                    onClick={() => {
                      setSelectedRepoId(r.id);
                      setSelectedItem(r);
                    }}
                  >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.name}
                    </span>
                    <span className="arp-filter-count">{r.branch || "main"}</span>
                  </button>
                ))}
              </div>

              <div className="arp-sidebar-section">
                <div className="arp-sidebar-section-title">
                  <span>Knowledge Graph</span>
                </div>
                <div style={{
                  background: "var(--surface-muted, rgba(255, 255, 255, 0.04))",
                  padding: "10px",
                  borderRadius: "var(--radius-md, 6px)",
                  fontSize: "12px",
                  color: "var(--text-secondary)",
                  lineHeight: "1.5"
                }}>
                  <div>AST code symbols are extracted and merged into Notely&apos;s Knowledge Graph.</div>
                  <div style={{ marginTop: "6px" }}>
                    Link from any note with <code>[[SymbolName]]</code> or <code>@repo/path</code>.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Canvas / Main Cards Grid */}
          <div className="arp-canvas-wrapper">
            {filteredRepos.length === 0 ? (
              <div className="arp-empty-state">
                <FolderGit2 className="arp-empty-icon" />
                <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-strong)" }}>
                  No Repositories Attached Yet
                </div>
                <div style={{ fontSize: "13px", maxWidth: "420px" }}>
                  Attach your project&apos;s Git repositories (frontend, backend, microservices) to include code symbols, classes, functions, and routes in your Knowledge Graph.
                </div>
                <AppButton
                  variant="primary"
                  onClick={() => setAttachModalOpen(true)}
                  style={{ marginTop: "12px" }}
                >
                  <Plus size={14} style={{ marginRight: "4px" }} />
                  Attach First Repository
                </AppButton>
              </div>
            ) : (
              <div className="arp-grid">
                {filteredRepos.map((repo) => (
                  <div
                    key={repo.id}
                    className={`arp-card ${selectedItem?.id === repo.id ? "selected" : ""}`}
                    onClick={() => setSelectedItem(repo)}
                  >
                    <div className="arp-card-header">
                      <div className="arp-card-title-group">
                        <FolderGit2 size={18} style={{ color: "var(--accent-solid, #8b5cf6)", flexShrink: 0 }} />
                        <span className="arp-card-title">{repo.name}</span>
                      </div>
                      <span className="arp-branch-pill">
                        <GitBranch size={12} />
                        {repo.branch || "main"}
                      </span>
                    </div>

                    <div className="arp-card-path" title={repo.path}>
                      {repo.path}
                    </div>

                    {repo.headCommit && (
                      <div className="arp-card-commit">
                        <GitCommit size={12} />
                        <span style={{ fontFamily: "monospace" }}>{repo.headCommit.slice(0, 7)}</span>
                        {repo.remoteUrl && (
                          <span style={{ marginLeft: "auto", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "150px" }}>
                            {repo.remoteUrl}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="arp-card-actions">
                      <AppButton
                        onClick={(e) => {
                          e.stopPropagation();
                          openFolder(repo.path);
                        }}
                        title="Open folder in File Explorer"
                      >
                        <FolderOpen size={12} style={{ marginRight: "4px" }} />
                        Folder
                      </AppButton>

                      <AppButton
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenInIDE(repo.path);
                        }}
                        title="Open in VS Code"
                      >
                        <ExternalLink size={12} style={{ marginRight: "4px" }} />
                        VS Code
                      </AppButton>

                      <AppButton
                        danger
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDetachRepo(repo.id, repo.name);
                        }}
                        title="Detach repository from workspace"
                      >
                        <Trash2 size={12} style={{ marginRight: "4px" }} />
                        Detach
                      </AppButton>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Inspector Drawer */}
          {selectedItem && (
            <div className="arp-drawer">
              <div className="arp-drawer-header">
                <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                  <FolderGit2 size={16} style={{ color: "var(--accent-solid, #8b5cf6)", flexShrink: 0 }} />
                  <span style={{ fontWeight: 600, fontSize: "14px", color: "var(--text-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {selectedItem.name}
                  </span>
                </div>
                <AppIconButton
                  onClick={() => setSelectedItem(null)}
                  aria-label="Close drawer"
                  title="Close drawer"
                >
                  <X size={14} />
                </AppIconButton>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>
                  Local Path
                </div>
                <div style={{ fontSize: "12px", fontFamily: "monospace", color: "var(--text-secondary)", wordBreak: "break-all" }}>
                  {selectedItem.path}
                </div>
              </div>

              {selectedItem.branch && (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>
                    Active Branch
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                    <GitBranch size={14} style={{ color: "var(--accent-solid, #8b5cf6)" }} />
                    {selectedItem.branch}
                  </div>
                </div>
              )}

              {/* Referencing Notes Section */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span>Referenced in Notes</span>
                  <span className="arp-filter-count">{referencingNotes.length}</span>
                </div>

                {referencingNotes.length === 0 ? (
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic" }}>
                    No notes currently reference this repository. Mention it in any note with <code>[[{selectedItem.name}]]</code>.
                  </div>
                ) : (
                  <div className="arp-notes-list">
                    {referencingNotes.map((doc) => (
                      <div
                        key={doc.filePath}
                        className="arp-note-item"
                        onClick={() => {
                          if (onOpenNote) onOpenNote(doc.filePath);
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden" }}>
                          <FileText size={14} style={{ color: "var(--accent-solid, #8b5cf6)", flexShrink: 0 }} />
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {doc.title || doc.filePath}
                          </span>
                        </div>
                        <ExternalLink size={12} style={{ opacity: 0.6 }} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "auto" }}>
                <AppButton
                  onClick={handleCopyLink}
                >
                  {copiedLink ? <Check size={14} style={{ marginRight: "4px" }} /> : <Copy size={14} style={{ marginRight: "4px" }} />}
                  {copiedLink ? "Copied Link!" : "Copy WikiLink [[Name]]"}
                </AppButton>

                <AppButton
                  onClick={() => handleOpenInIDE(selectedItem.path)}
                >
                  <ExternalLink size={14} style={{ marginRight: "4px" }} />
                  Open in VS Code
                </AppButton>

                {onOpenKnowledgeGraph && (
                  <AppButton
                    variant="primary"
                    onClick={onOpenKnowledgeGraph}
                  >
                    <Share2 size={14} style={{ marginRight: "4px" }} />
                    View in Knowledge Graph
                  </AppButton>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Attach Repo Dialog */}
      {attachModalOpen && (
        <OverlayDialog
          open={attachModalOpen}
          onClose={() => setAttachModalOpen(false)}
          title="Attach Git Repository"
          size="md"
        >
          <form onSubmit={handleAttachSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "6px", color: "var(--text-strong)" }}>
                Repository Folder Path *
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
                <AppInput
                  type="text"
                  placeholder="C:/Projects/my-service or /home/user/code/my-repo"
                  value={newRepoPath}
                  onChange={(e) => setNewRepoPath(e.target.value)}
                  style={{ flex: 1 }}
                  required
                />
                <AppButton
                  type="button"
                  onClick={handleBrowseRepoFolder}
                >
                  <FolderOpen size={14} style={{ marginRight: "4px" }} />
                  Browse
                </AppButton>
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "6px", color: "var(--text-strong)" }}>
                Display / Alias Name (Optional)
              </label>
              <AppInput
                type="text"
                placeholder="e.g. backend-api, web-frontend"
                value={newRepoName}
                onChange={(e) => setNewRepoName(e.target.value)}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "6px", color: "var(--text-strong)" }}>
                Branch (Optional)
              </label>
              <AppInput
                type="text"
                placeholder="main or develop"
                value={newRepoBranch}
                onChange={(e) => setNewRepoBranch(e.target.value)}
              />
            </div>

            <div style={{
              background: "var(--surface-muted, rgba(255, 255, 255, 0.04))",
              padding: "10px",
              borderRadius: "var(--radius-md, 6px)",
              fontSize: "12px",
              color: "var(--text-secondary)"
            }}>
              Notely will scan this repository for code files, classes, and exported functions and integrate them into your workspace&apos;s Knowledge Graph.
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "10px" }}>
              <AppButton
                type="button"
                onClick={() => setAttachModalOpen(false)}
              >
                Cancel
              </AppButton>
              <AppButton
                type="submit"
                variant="primary"
              >
                <Plus size={14} style={{ marginRight: "4px" }} />
                Attach Repository
              </AppButton>
            </div>
          </form>
        </OverlayDialog>
      )}
    </div>
  );
}

export default AttachedReposPage;
