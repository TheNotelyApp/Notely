import { useEffect, useMemo, useRef, useState } from "react";

const RECENT_SEARCHES_KEY = "notely:recent-searches";
const RECENT_SEARCHES_LIMIT = 6;

function loadRecentSearches() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENT_SEARCHES_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => typeof item === "string" && item.trim()).slice(0, RECENT_SEARCHES_LIMIT);
  } catch {
    return [];
  }
}

function saveRecentSearches(nextValues) {
  try {
    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(nextValues.slice(0, RECENT_SEARCHES_LIMIT)));
  } catch {
    // Ignore storage failures.
  }
}

function buildSearchResults({ documents, currentDocument, query, typeFilter }) {
  const needle = String(query || "").trim().toLowerCase();

  const docResults = documents
    .filter((entry) => {
      if (typeFilter === "notes" && entry.entryType !== "file") return false;
      if (typeFilter === "folders" && entry.entryType !== "folder") return false;
      if (!needle) return true;

      const haystack = [
        entry.title,
        entry.filePath,
        entry.metadata?.time,
        entry.metadata?.location,
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(needle);
    })
    .map((entry) => ({
      id: `doc:${entry.filePath}`,
      kind: "document",
      entry,
      label: entry.title,
      subtitle: entry.entryType === "folder" ? "Folder" : "Note",
    }));

  const contentResults = [];
  if (currentDocument && needle && (typeFilter === "all" || typeFilter === "current")) {
    const source = `${currentDocument.rawNotes || ""}\n${currentDocument.cleansed || ""}`.toLowerCase();
    if (source.includes(needle)) {
      contentResults.push({
        id: `current:${currentDocument.filePath}`,
        kind: "current-note-match",
        label: `Find \"${query}\" in ${currentDocument.title}`,
        subtitle: "Current note content",
      });
    }
  }

  if (typeFilter === "current") {
    return contentResults;
  }

  return [...contentResults, ...docResults];
}

export function GlobalSearchOverlay({
  isOpen,
  documents = [],
  currentDocument = null,
  onClose,
  onOpenResult,
}) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [typeFilter, setTypeFilter] = useState("all");
  const [recentSearches, setRecentSearches] = useState(() => loadRecentSearches());
  const inputRef = useRef(null);

  const results = useMemo(() => buildSearchResults({
    documents,
    currentDocument,
    query,
    typeFilter,
  }), [documents, currentDocument, query, typeFilter]);

  useEffect(() => {
    if (!isOpen) return;
    setActiveIndex(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [isOpen]);

  useEffect(() => {
    setActiveIndex((index) => Math.min(index, Math.max(0, results.length - 1)));
  }, [results]);

  function trackRecentSearch(value) {
    const trimmed = String(value || "").trim();
    if (!trimmed) return;
    const next = [trimmed, ...recentSearches.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())]
      .slice(0, RECENT_SEARCHES_LIMIT);
    setRecentSearches(next);
    saveRecentSearches(next);
  }

  if (!isOpen) return null;

  return (
    <div
      className="overlay-dialog"
      role="dialog"
      aria-modal="true"
      aria-label="Global search"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="overlay-dialog-card global-search-card">
        <div className="global-search-header">
          <input
            ref={inputRef}
            className="global-search-input"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                onClose();
                return;
              }

              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
                return;
              }

              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((index) => Math.max(index - 1, 0));
                return;
              }

              if (event.key === "Enter") {
                event.preventDefault();
                const selected = results[activeIndex];
                if (!selected) return;
                trackRecentSearch(query);
                onOpenResult(selected, query);
              }
            }}
            placeholder="Search notes, folders, and current note content"
            aria-label="Search"
          />
        </div>

        <div className="global-search-filters" role="group" aria-label="Search filters">
          <button
            type="button"
            className={typeFilter === "all" ? "active" : ""}
            onClick={() => setTypeFilter("all")}
          >
            All
          </button>
          <button
            type="button"
            className={typeFilter === "notes" ? "active" : ""}
            onClick={() => setTypeFilter("notes")}
          >
            Notes
          </button>
          <button
            type="button"
            className={typeFilter === "folders" ? "active" : ""}
            onClick={() => setTypeFilter("folders")}
          >
            Folders
          </button>
          <button
            type="button"
            className={typeFilter === "current" ? "active" : ""}
            onClick={() => setTypeFilter("current")}
            disabled={!currentDocument}
          >
            Current Note
          </button>
        </div>

        {!query.trim() && recentSearches.length ? (
          <div className="global-search-recents">
            <span>Recent searches</span>
            <div>
              {recentSearches.map((item) => (
                <button key={item} type="button" onClick={() => setQuery(item)}>{item}</button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="global-search-results" role="listbox" aria-label="Search results">
          {!results.length ? (
            <div className="global-search-empty">No matches found.</div>
          ) : (
            results.map((result, index) => (
              <button
                key={result.id}
                className={`global-search-item${index === activeIndex ? " active" : ""}`}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => {
                  trackRecentSearch(query);
                  onOpenResult(result, query);
                }}
              >
                <span className="global-search-item-label">{result.label}</span>
                <small>{result.subtitle}</small>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}