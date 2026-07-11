import { useState, useEffect } from "react";
import { GitCompare, ChevronDown, Filter } from "lucide-react";
import AppButton from "./AppButton";

/**
 * Parse the internal note format into { header, rawNotes, cleansed } sections.
 * Mirrors parseVersionDocumentContent in DocumentDetail.
 */
function parseNoteContent(value, fallback = {}) {
  const lines = String(value || "").split(/\r?\n/);
  const rawIndex = lines.findIndex((l) => l.trim().toLowerCase() === "# rawnotes");
  const cleansedIndex = lines.findIndex((l) => l.trim().toLowerCase() === "# cleansed");

  if (rawIndex === -1 && cleansedIndex === -1) {
    return {
      header: fallback.header || "",
      rawNotes: fallback.rawNotes || "",
      cleansed: String(value || "").trim(),
    };
  }

  const firstIdx = Math.min(
    rawIndex === -1 ? Infinity : rawIndex,
    cleansedIndex === -1 ? Infinity : cleansedIndex
  );
  const header = lines.slice(0, firstIdx).join("\n").trim();
  const rawEnd = cleansedIndex > rawIndex && rawIndex !== -1 ? cleansedIndex : lines.length;

  return {
    header,
    rawNotes: rawIndex === -1 ? (fallback.rawNotes || "") : lines.slice(rawIndex + 1, rawEnd).join("\n").trim(),
    cleansed: cleansedIndex === -1 ? (fallback.cleansed || "") : lines.slice(cleansedIndex + 1).join("\n").trim(),
  };
}

/**
 * Compute word-level diff tokens between two strings.
 * Returns an array of { text, status: "same"|"added"|"removed" }.
 */
function diffWords(a, b) {
  const wordsA = String(a || "").split(/(\s+)/);
  const wordsB = String(b || "").split(/(\s+)/);

  // Simple LCS-based word diff
  const m = wordsA.length;
  const n = wordsB.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (wordsA[i - 1] === wordsB[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const tokens = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && wordsA[i - 1] === wordsB[j - 1]) {
      tokens.unshift({ text: wordsA[i - 1], status: "same" });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      tokens.unshift({ text: wordsB[j - 1], status: "added" });
      j--;
    } else {
      tokens.unshift({ text: wordsA[i - 1], status: "removed" });
      i--;
    }
  }

  return tokens;
}

/**
 * Build line-level diff rows between two texts.
 */
function buildLineDiff(latestText, previousText) {
  const latest = String(latestText || "").replace(/\r\n/g, "\n").split("\n");
  const previous = String(previousText || "").replace(/\r\n/g, "\n").split("\n");
  const max = Math.max(latest.length, previous.length);
  const rows = [];

  for (let i = 0; i < max; i++) {
    const l = latest[i] ?? null;
    const p = previous[i] ?? null;

    let status = "same";
    if (p === null) status = "added";
    else if (l === null) status = "removed";
    else if (l !== p) status = "changed";

    rows.push({ index: i, latest: l, previous: p, status });
  }

  return rows;
}

function DiffSection({ title, latestText, previousText, showOnlyChanges }) {
  const rows = buildLineDiff(latestText, previousText);
  const visible = showOnlyChanges ? rows.filter((r) => r.status !== "same") : rows;

  if (!latestText && !previousText) return null;

  return (
    <div className="git-diff-section">
      <h3 className="git-diff-section__title">{title}</h3>
      <div className="git-diff-lines" aria-label={`${title} diff`}>
        {visible.length === 0 ? (
          <div className="git-diff-no-changes">No changes in this section.</div>
        ) : visible.map((row, idx) => {
          if (row.status === "changed") {
            const tokens = diffWords(row.previous ?? "", row.latest ?? "");
            return (
              <div key={idx} className="git-diff-row git-diff-row--changed">
                <span className="git-diff-row__gutter">{row.index + 1}</span>
                <span className="git-diff-row__content">
                  {tokens.map((token, ti) => (
                    token.status === "same"
                      ? <span key={ti}>{token.text}</span>
                      : token.status === "added"
                      ? <mark key={ti} className="git-diff-token--added">{token.text}</mark>
                      : <del key={ti} className="git-diff-token--removed">{token.text}</del>
                  ))}
                </span>
              </div>
            );
          }

          if (row.status === "added") {
            return (
              <div key={idx} className="git-diff-row git-diff-row--added">
                <span className="git-diff-row__gutter">{row.index + 1}</span>
                <span className="git-diff-row__content">{row.latest}</span>
              </div>
            );
          }

          if (row.status === "removed") {
            return (
              <div key={idx} className="git-diff-row git-diff-row--removed">
                <span className="git-diff-row__gutter">{row.previous !== null ? row.index + 1 : ""}</span>
                <del className="git-diff-row__content">{row.previous}</del>
              </div>
            );
          }

          return (
            <div key={idx} className="git-diff-row git-diff-row--same">
              <span className="git-diff-row__gutter">{row.index + 1}</span>
              <span className="git-diff-row__content">{row.latest}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * GitDiffViewer — renders a human-readable diff between two note versions.
 *
 * Sections are labeled "Quick Notes" (rawNotes) and "Formal Notes" (cleansed).
 * Never exposes raw `# RawNotes` / `# Cleansed` markers.
 *
 * Props:
 *  latestContent   — string: raw file content of the newer version
 *  previousContent — string: raw file content of the older version
 *  fromLabel       — string: label for the older version (e.g. commit hash + date)
 *  toLabel         — string: label for the newer version
 *  loading         — bool
 *  error           — string|null
 */
export function GitDiffViewer({
  latestContent,
  previousContent,
  fromLabel = "Previous",
  toLabel = "Current",
  loading = false,
  error = null,
}) {
  const [showOnlyChanges, setShowOnlyChanges] = useState(false);
  const [activeSection, setActiveSection] = useState("all");

  const latest = parseNoteContent(latestContent);
  const previous = parseNoteContent(previousContent);

  if (loading) {
    return (
      <div className="git-diff-viewer git-diff-viewer--loading" aria-live="polite">
        <span className="git-timeline-spinner" aria-label="Loading diff" />
        <span>Loading diff…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="git-diff-viewer git-diff-viewer--error" role="alert">
        <span>{error}</span>
      </div>
    );
  }

  if (!latestContent && !previousContent) {
    return (
      <div className="git-diff-viewer git-diff-viewer--empty">
        <GitCompare size={32} className="git-diff-viewer__empty-icon" aria-hidden="true" />
        <p>Select two commits to compare.</p>
      </div>
    );
  }

  return (
    <div className="git-diff-viewer">
      <div className="git-diff-header">

        <div className="git-diff-controls" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", borderBottom: "1px solid var(--border-default)", paddingBottom: "var(--space-2, 0.5rem)", marginBottom: "var(--space-4, 1rem)" }}>
          <div className="p2p-tab-bar" role="tablist" aria-label="Diff section" style={{ borderBottom: "none", background: "none", padding: 0 }}>
            {[
              { key: "all", label: "All" },
              { key: "quick", label: "Quick Notes" },
              { key: "formal", label: "Formal Notes" },
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                role="tab"
                className={`p2p-tab-btn${activeSection === key ? " active" : ""}`}
                onClick={() => setActiveSection(key)}
                aria-pressed={activeSection === key}
              >
                {label}
              </button>
            ))}
          </div>

          <AppButton
            variant="small"
            onClick={() => setShowOnlyChanges((v) => !v)}
            aria-pressed={showOnlyChanges}
            data-tooltip="Toggle between showing all lines and only changed lines"
          >
            <Filter size={13} style={{ marginRight: 4 }} />
            {showOnlyChanges ? "Show all" : "Changes only"}
          </AppButton>
        </div>
      </div>

      <div className="git-diff-body">
        {(activeSection === "all" || activeSection === "quick") && (
          <DiffSection
            title="Quick Notes"
            latestText={latest.rawNotes}
            previousText={previous.rawNotes}
            showOnlyChanges={showOnlyChanges}
          />
        )}

        {(activeSection === "all" || activeSection === "formal") && (
          <DiffSection
            title="Formal Notes"
            latestText={latest.cleansed}
            previousText={previous.cleansed}
            showOnlyChanges={showOnlyChanges}
          />
        )}
      </div>
    </div>
  );
}

export default GitDiffViewer;
