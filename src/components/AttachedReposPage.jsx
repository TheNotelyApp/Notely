import { useState, useMemo, useEffect, useCallback } from "react";
import {
  FolderGit2,
  GitBranch,
  Search,
  Plus,
  RefreshCw,
  X
} from "lucide-react";
import {
  getAttachedRepos,
  addAttachedRepo,
  removeAttachedRepo,
  onAttachedReposChanged,
  openFolder,
  openExternal,
  aiBuildGraph
} from "../services/electronService";
import AppButton from "./AppButton";
import {
  RepoCard,
  AttachRepoModal
} from "./repos";
import { showToast } from "../utils/notificationUtils";
import "../styles/AttachedReposPage.css";

export function AttachedReposPage({
  _notesFolderPath,
  documents = [],
  onBack,
  onClose,
  onNotify
}) {
  const handleBack = onBack || onClose;
  const [repos, setRepos] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [attachModalOpen, setAttachModalOpen] = useState(false);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (attachModalOpen) {
          setAttachModalOpen(false);
        } else if (typeof handleBack === "function") {
          handleBack();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [attachModalOpen, handleBack]);

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

  // Detach Repo
  const handleDetachRepo = async (repoId, repoName) => {
    if (window.confirm(`Detach repository "${repoName}" from workspace?`)) {
      try {
        await removeAttachedRepo(repoId);
        notifyUser("Repository detached", "info");
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
    try {
      await aiBuildGraph();
      notifyUser("Knowledge Graph updated", "success");
      loadRepos();
    } catch (err) {
      notifyUser("Scan failed: " + err.message, "error");
    } finally {
      setIsScanning(false);
    }
  };

  // Submit Attach Repo
  const handleAttachSubmit = async ({ path: repoPath, name: repoName, branch: repoBranch }) => {
    try {
      await addAttachedRepo({
        path: repoPath,
        name: repoName,
        branch: repoBranch
      });
      notifyUser("Repository attached successfully", "success");
      setAttachModalOpen(false);
      loadRepos();
      handleRescanGraph();
    } catch (err) {
      notifyUser("Failed attaching repository: " + err.message, "error");
    }
  };

  // Filtered Repos
  const filteredRepos = useMemo(() => {
    return repos.filter((r) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        (r.name && r.name.toLowerCase().includes(q)) ||
        (r.path && r.path.toLowerCase().includes(q)) ||
        (r.branch && r.branch.toLowerCase().includes(q))
      );
    });
  }, [repos, searchQuery]);

  // Map of repo name to reference counts in documents
  const referenceCounts = useMemo(() => {
    if (!documents.length) return {};
    const counts = {};
    for (const repo of repos) {
      if (!repo.name) continue;
      const count = documents.filter((doc) => {
        if (doc.entryType !== "file") return false;
        const c = doc.content || "";
        return c.includes(`[[${repo.name}]]`) || c.includes(`@${repo.name}`);
      }).length;
      counts[repo.id] = count;
    }
    return counts;
  }, [repos, documents]);

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

        <div className="detail-topbar-actions">
          <div className="topbar-stat-pill" title="Total attached repositories">
            <GitBranch size={12} />
            <span>{repos.length} {repos.length === 1 ? "Repo" : "Repos"}</span>
          </div>

          <AppButton
            onClick={handleRescanGraph}
            disabled={isScanning}
            title="Rescan and rebuild Code Knowledge Graph"
          >
            <RefreshCw size={14} className={isScanning ? "spin arp-btn-icon-mr" : "arp-btn-icon-mr"} />
            <span>{isScanning ? "Scanning..." : "Rescan"}</span>
          </AppButton>

          <AppButton
            variant="primary"
            onClick={() => setAttachModalOpen(true)}
            title="Attach an external Git repository"
          >
            <Plus size={14} className="arp-btn-icon-mr" />
            <span>Attach Repo</span>
          </AppButton>
        </div>
      </div>

      <div className="arp-container">
        {/* Toolbar: Search input */}
        {repos.length > 0 && (
          <div className="arp-toolbar">
            <div className="arp-search-wrapper">
              <Search size={14} className="arp-search-icon" />
              <input
                type="text"
                className="arp-search-input"
                placeholder="Search attached repositories, branches, paths…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="arp-search-clear"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search query"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Main Body */}
        <div className="arp-body">
          <div className="arp-canvas-wrapper">
            {repos.length === 0 ? (
              <div className="arp-empty-state">
                <FolderGit2 className="arp-empty-icon" />
                <div className="arp-empty-title">
                  No Repositories Attached Yet
                </div>
                <div className="arp-empty-desc">
                  Attach your project&apos;s local Git repositories to index code symbols, classes, and functions into your workspace graph.
                </div>
                <AppButton
                  variant="primary"
                  className="arp-empty-btn"
                  onClick={() => setAttachModalOpen(true)}
                >
                  <Plus size={14} className="arp-btn-icon-mr" />
                  <span>Attach First Repository</span>
                </AppButton>
              </div>
            ) : filteredRepos.length === 0 ? (
              <div className="arp-empty-state">
                <Search className="arp-empty-icon" />
                <div className="arp-empty-title">No Matching Repositories</div>
                <div className="arp-empty-desc">
                  No attached repositories matched &quot;{searchQuery}&quot;.
                </div>
                <AppButton
                  className="arp-empty-btn"
                  onClick={() => setSearchQuery("")}
                >
                  <span>Clear Filter</span>
                </AppButton>
              </div>
            ) : (
              <div className="arp-grid">
                {filteredRepos.map((repo) => (
                  <RepoCard
                    key={repo.id}
                    repo={repo}
                    referencingCount={referenceCounts[repo.id] || 0}
                    onDetach={handleDetachRepo}
                    onOpenFolder={openFolder}
                    onOpenInIDE={handleOpenInIDE}
                    onCopyLink={(name) => notifyUser(`Copied [[${name}]] to clipboard`, "info")}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Attach Repo Dialog */}
      <AttachRepoModal
        open={attachModalOpen}
        onClose={() => setAttachModalOpen(false)}
        onAttach={handleAttachSubmit}
      />
    </div>
  );
}

export default AttachedReposPage;
