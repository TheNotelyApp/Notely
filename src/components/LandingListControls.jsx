import AppSelect from "./AppSelect";
import { Grid2X2, Rows3, FolderTree } from "lucide-react";

export function LandingListControls({
  query,
  onQueryChange,
  typeFilter,
  onTypeFilterChange,
  sortBy,
  onSortByChange,
  viewMode = "tile",
  onViewModeChange,
  visibleCount,
  totalCount,
  totalFolderCount,
  totalNoteCount,
}) {
  return (
    <div className="landing-list-controls" aria-label="List controls">
      <label className="landing-list-search" htmlFor="landing-list-query">
        <span>Search</span>
        <input
          id="landing-list-query"
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Filter notes and folders"
        />
      </label>

      <label className="landing-list-select" htmlFor="landing-list-type-filter">
        <span>Type</span>
        <AppSelect
          id="landing-list-type-filter"
          value={typeFilter}
          onChange={(event) => onTypeFilterChange(event.target.value)}
        >
          <option value="all">All</option>
          <option value="notes">Notes</option>
          <option value="folders">Folders</option>
        </AppSelect>
      </label>

      <label className="landing-list-select" htmlFor="landing-list-sort">
        <span>Sort</span>
        <AppSelect
          id="landing-list-sort"
          value={sortBy}
          onChange={(event) => onSortByChange(event.target.value)}
        >
          <option value="updated-desc">Updated (Newest)</option>
          <option value="updated-asc">Updated (Oldest)</option>
          <option value="title-asc">Title (A-Z)</option>
          <option value="title-desc">Title (Z-A)</option>
        </AppSelect>
      </label>

      <div className="landing-list-view-modes" style={{ display: "grid", gap: "4px" }}>
        <span style={{ fontSize: "var(--font-size-caption)", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-subtle)" }}>View</span>
        <div className="segmented-view-control" style={{ display: "flex", background: "var(--surface-bg)", border: "1px solid var(--border-soft)", borderRadius: "var(--radius-md)", padding: "2px", height: "32px", boxSizing: "border-box" }}>
          <button
            type="button"
            className={`view-mode-btn ${viewMode === "tile" ? "active" : ""}`}
            onClick={() => onViewModeChange?.("tile")}
            data-tooltip="Tile View"
            aria-label="Tile View"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 8px",
              background: viewMode === "tile" ? "var(--surface-active, rgba(255,255,255,0.12))" : "transparent",
              color: viewMode === "tile" ? "var(--accent-strong, #3b82f6)" : "var(--text-muted)",
              border: "none",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
            }}
          >
            <Grid2X2 size={14} />
          </button>
          <button
            type="button"
            className={`view-mode-btn ${viewMode === "table" ? "active" : ""}`}
            onClick={() => onViewModeChange?.("table")}
            data-tooltip="Table View"
            aria-label="Table View"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 8px",
              background: viewMode === "table" ? "var(--surface-active, rgba(255,255,255,0.12))" : "transparent",
              color: viewMode === "table" ? "var(--accent-strong, #3b82f6)" : "var(--text-muted)",
              border: "none",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
            }}
          >
            <Rows3 size={14} />
          </button>
          <button
            type="button"
            className={`view-mode-btn ${viewMode === "tree" ? "active" : ""}`}
            onClick={() => onViewModeChange?.("tree")}
            data-tooltip="Tree View"
            aria-label="Tree View"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 8px",
              background: viewMode === "tree" ? "var(--surface-active, rgba(255,255,255,0.12))" : "transparent",
              color: viewMode === "tree" ? "var(--accent-strong, #3b82f6)" : "var(--text-muted)",
              border: "none",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
            }}
          >
            <FolderTree size={14} />
          </button>
        </div>
      </div>

      <div className="landing-list-count" aria-live="polite">
        <span className="landing-list-count-item">
          {visibleCount !== totalCount ? (
            <>Showing <strong>{visibleCount}</strong> of <strong>{totalCount}</strong> items</>
          ) : (
            <>
              <strong>{totalFolderCount}</strong> {totalFolderCount === 1 ? "folder" : "folders"}
              <span className="landing-list-count-separator" style={{ margin: "0 6px" }}>·</span>
              <strong>{totalNoteCount}</strong> {totalNoteCount === 1 ? "note" : "notes"}
            </>
          )}
        </span>
      </div>
    </div>
  );
}
