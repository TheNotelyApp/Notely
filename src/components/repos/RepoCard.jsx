import { useState } from "react";
import {
  FolderGit2,
  GitBranch,
  GitCommit,
  FolderOpen,
  Trash2,
  Copy,
  Check
} from "lucide-react";
import AppIconButton from "../AppIconButton";
import RepoStatusBadge from "./RepoStatusBadge";

function VscodeIcon({ size = 14, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 14.861L10.826 12l7.178-5.448v10.896z" />
    </svg>
  );
}

export function RepoCard({
  repo,
  referencingCount = 0,
  onDetach,
  onOpenFolder,
  onOpenInIDE,
  onCopyLink
}) {
  const [copied, setCopied] = useState(false);
  if (!repo) return null;

  const handleCopy = (e) => {
    e.stopPropagation();
    const linkText = `[[${repo.name}]]`;
    navigator.clipboard.writeText(linkText);
    setCopied(true);
    if (typeof onCopyLink === "function") onCopyLink(repo.name);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="arp-card">
      <div className="arp-card-main">
        <div className="arp-card-icon-box">
          <FolderGit2 size={18} />
        </div>
        <div className="arp-card-content">
          <div className="arp-card-header">
            <span className="arp-card-title">{repo.name}</span>
            <div className="arp-card-badges">
              <RepoStatusBadge status={repo.status} symbolCount={repo.symbolCount} />
              {repo.branch && (
                <span className="arp-branch-pill">
                  <GitBranch size={12} />
                  <span>{repo.branch}</span>
                </span>
              )}
            </div>
          </div>
          <div className="arp-card-path" title={repo.path}>
            {repo.path}
          </div>
          {(repo.headCommit || referencingCount > 0) && (
            <div className="arp-card-meta-row">
              {repo.headCommit && (
                <div className="arp-card-commit">
                  <GitCommit size={12} />
                  <span>{repo.headCommit.slice(0, 7)}</span>
                </div>
              )}
              {referencingCount > 0 && (
                <div className="arp-card-ref-count">
                  <span>{referencingCount} {referencingCount === 1 ? "note ref" : "note refs"}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="arp-card-actions">
        <AppIconButton
          size="sm"
          onClick={handleCopy}
          title={copied ? "Copied wikilink!" : `Copy wikilink [[${repo.name}]]`}
          aria-label={copied ? "Copied wikilink" : "Copy wikilink"}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </AppIconButton>

        <AppIconButton
          size="sm"
          onClick={() => {
            if (typeof onOpenFolder === "function") onOpenFolder(repo.path);
          }}
          title="Open folder in File Explorer"
          aria-label="Open folder in File Explorer"
        >
          <FolderOpen size={14} />
        </AppIconButton>

        <AppIconButton
          size="sm"
          onClick={() => {
            if (typeof onOpenInIDE === "function") onOpenInIDE(repo.path);
          }}
          title="Open in VS Code"
          aria-label="Open in VS Code"
        >
          <VscodeIcon size={14} />
        </AppIconButton>

        <AppIconButton
          size="sm"
          className="danger"
          onClick={() => {
            if (typeof onDetach === "function") onDetach(repo.id, repo.name);
          }}
          title="Detach repository from workspace"
          aria-label="Detach repository from workspace"
        >
          <Trash2 size={14} />
        </AppIconButton>
      </div>
    </div>
  );
}

export default RepoCard;
