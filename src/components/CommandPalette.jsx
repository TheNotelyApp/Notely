import { useEffect, useMemo, useRef, useState } from "react";
import { OverlayDialog } from "./OverlayDialog";

function matchesQuery(command, query) {
  const needle = String(query || "").trim().toLowerCase();
  if (!needle) return true;
  const label = String(command.label || "").toLowerCase();
  const haystack = `${label} ${command.group || ""} ${command.keywords || ""} ${command.aliases || ""}`.toLowerCase();
  if (haystack.includes(needle)) return true;
  return fuzzySubsequenceScore(label, needle) > 0 || fuzzySubsequenceScore(String(command.keywords || "").toLowerCase(), needle) > 0;
}

function fuzzySubsequenceScore(haystack, needle) {
  const source = String(haystack || "");
  const target = String(needle || "");
  if (!target) return 0;
  let cursor = 0;
  let score = 0;
  let previousIndex = -2;

  for (let index = 0; index < target.length; index += 1) {
    const expected = target[index];
    let foundAt = -1;
    for (let scan = cursor; scan < source.length; scan += 1) {
      if (source[scan] === expected) {
        foundAt = scan;
        break;
      }
    }
    if (foundAt < 0) return -1;

    score += 5;
    if (foundAt === previousIndex + 1) {
      score += 6;
    }
    previousIndex = foundAt;
    cursor = foundAt + 1;
  }

  if (source.startsWith(target)) {
    score += 20;
  }
  return score;
}

function getCommandScore(command, query) {
  const needle = String(query || "").trim().toLowerCase();
  const label = String(command.label || "").toLowerCase();
  const group = String(command.group || "").toLowerCase();
  const keywords = String(command.keywords || "").toLowerCase();
  const aliases = String(command.aliases || "").toLowerCase();
  const priority = Number.isFinite(command.priority) ? command.priority : 100;
  const usageBoost = Number.isFinite(command.usageBoost) ? command.usageBoost : 0;

  if (!needle) {
    return (usageBoost * 5) - priority;
  }

  let score = 0;
  if (label.startsWith(needle)) score += 60;
  if (label.includes(needle)) score += 30;
  if (keywords.includes(needle)) score += 35;
  if (aliases.includes(needle)) score += 28;
  if (group.includes(needle)) score += 10;
  score += Math.max(0, fuzzySubsequenceScore(label, needle));
  score += Math.max(0, fuzzySubsequenceScore(keywords, needle));
  score += Math.max(0, fuzzySubsequenceScore(aliases, needle));
  return score + (usageBoost * 4) - priority;
}

function escapeRegExp(text) {
  return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderHighlightedLabel(label, query) {
  const source = String(label || "");
  const needle = String(query || "").trim();
  if (!needle) return source;

  const matcher = new RegExp(`(${escapeRegExp(needle)})`, "ig");
  const parts = source.split(matcher);
  if (parts.length <= 1) return source;

  return parts.map((part, index) => {
    if (part.toLowerCase() === needle.toLowerCase()) {
      return <mark className="command-palette-match" key={`${part}-${index}`}>{part}</mark>;
    }
    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

function findEnabledFrom(commands, startIndex, direction, options = {}) {
  const includeStart = Boolean(options.includeStart);
  let index = includeStart ? startIndex : startIndex + direction;
  while (index >= 0 && index < commands.length) {
    if (!commands[index]?.disabled) {
      return index;
    }
    index += direction;
  }
  return -1;
}

export function CommandPalette({ isOpen, commands = [], pinnedCommandKeys = [], onClose, onRun, onTogglePinCommand }) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const resultsRef = useRef(null);
  const pinnedKeySet = useMemo(() => new Set((pinnedCommandKeys || []).map((item) => String(item))), [pinnedCommandKeys]);

  const filtered = useMemo(() => {
    return commands
      .map((command, index) => ({ command, index, score: getCommandScore(command, query) }))
      .filter(({ command }) => matchesQuery(command, query))
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        return left.index - right.index;
      })
      .map(({ command }) => command);
  }, [commands, query]);

  const groupedResults = useMemo(() => {
    const groups = [];
    const byKey = new Map();
    filtered.forEach((command, index) => {
      const group = command.group || "Other";
      if (!byKey.has(group)) {
        const next = { key: group, title: group, items: [] };
        byKey.set(group, next);
        groups.push(next);
      }
      byKey.get(group).items.push({ command, index });
    });
    return groups;
  }, [filtered]);

  useEffect(() => {
    if (!isOpen) return;
    setQuery("");
    const firstEnabled = findEnabledFrom(commands, 0, 1, { includeStart: true });
    setActiveIndex(firstEnabled >= 0 ? firstEnabled : 0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [isOpen, commands]);

  useEffect(() => {
    if (!isOpen) return;
    setActiveIndex((index) => {
      if (!filtered.length) return 0;
      const clamped = Math.min(index, Math.max(filtered.length - 1, 0));
      if (!filtered[clamped]?.disabled) return clamped;
      const next = findEnabledFrom(filtered, clamped, 1, { includeStart: true });
      if (next >= 0) return next;
      const previous = findEnabledFrom(filtered, clamped, -1, { includeStart: true });
      return previous >= 0 ? previous : clamped;
    });
  }, [filtered, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const container = resultsRef.current;
    if (!container) return;
    const activeElement = container.querySelector(`[data-command-index="${activeIndex}"]`);
    if (activeElement && typeof activeElement.scrollIntoView === "function") {
      activeElement.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex, isOpen, filtered.length]);

  if (!isOpen) return null;

  return (
    <OverlayDialog
      open={isOpen}
      onClose={onClose}
      ariaLabel="Command palette"
      cardClassName="command-palette-card"
      initialFocusRef={inputRef}
    >
        <div className="command-palette-header">
          <input
            ref={inputRef}
            className="command-palette-input"
            type="text"
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
                setActiveIndex((index) => {
                  const next = findEnabledFrom(filtered, index, 1);
                  return next >= 0 ? next : index;
                });
                return;
              }

              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((index) => {
                  const previous = findEnabledFrom(filtered, index, -1);
                  return previous >= 0 ? previous : index;
                });
                return;
              }

              if (event.key === "PageDown") {
                event.preventDefault();
                const pageSize = 8;
                setActiveIndex((index) => {
                  const maxIndex = Math.max(filtered.length - 1, 0);
                  const target = Math.min(index + pageSize, maxIndex);
                  const next = findEnabledFrom(filtered, target, 1, { includeStart: true });
                  if (next >= 0) return next;
                  const fallback = findEnabledFrom(filtered, target, -1, { includeStart: true });
                  return fallback >= 0 ? fallback : index;
                });
                return;
              }

              if (event.key === "PageUp") {
                event.preventDefault();
                const pageSize = 8;
                setActiveIndex((index) => {
                  const target = Math.max(index - pageSize, 0);
                  const previous = findEnabledFrom(filtered, target, -1, { includeStart: true });
                  if (previous >= 0) return previous;
                  const fallback = findEnabledFrom(filtered, target, 1, { includeStart: true });
                  return fallback >= 0 ? fallback : index;
                });
                return;
              }

              if (event.key === "Home") {
                event.preventDefault();
                const firstEnabled = findEnabledFrom(filtered, 0, 1, { includeStart: true });
                setActiveIndex(firstEnabled >= 0 ? firstEnabled : 0);
                return;
              }

              if (event.key === "End") {
                event.preventDefault();
                const lastEnabled = findEnabledFrom(filtered, Math.max(filtered.length - 1, 0), -1, { includeStart: true });
                setActiveIndex(lastEnabled >= 0 ? lastEnabled : Math.max(filtered.length - 1, 0));
                return;
              }

              if (event.key === "Enter") {
                event.preventDefault();
                const selected = filtered[activeIndex];
                if (selected && !selected.disabled) onRun(selected.id);
                return;
              }

              if (event.altKey && event.key.toLowerCase() === "p") {
                event.preventDefault();
                const selected = filtered[activeIndex];
                if (selected && typeof onTogglePinCommand === "function") {
                  onTogglePinCommand(selected.pinKey || selected.id);
                }
              }
            }}
            placeholder="Search commands and actions"
            aria-label="Filter commands"
          />
          <span className="command-palette-hint">Esc</span>
        </div>

        <div className="command-palette-results" role="listbox" aria-label="Command results" ref={resultsRef}>
          {!filtered.length ? (
            <div className="command-palette-empty">No matching commands</div>
          ) : (
            groupedResults.map((group) => (
              <section className="command-palette-group" key={group.key} aria-label={`${group.title} commands`}>
                <header className="command-palette-group-header">{group.title}</header>
                {group.items.map(({ command, index }) => {
                  const isPinned = pinnedKeySet.has(String(command.pinKey || command.id));
                  return (
                  <button
                    key={command.id}
                    className={`command-palette-item${index === activeIndex ? " active" : ""}`}
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    aria-disabled={command.disabled ? "true" : "false"}
                    disabled={Boolean(command.disabled)}
                    data-command-index={index}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => onRun(command.id)}
                  >
                    <span className="command-palette-item-text">
                      <strong>{renderHighlightedLabel(command.label, query)}</strong>
                    </span>
                    <span className="command-palette-item-meta">
                      {isPinned ? <span className="command-palette-pin-tag">Pinned</span> : null}
                      {command.shortcut ? <kbd>{command.shortcut}</kbd> : null}
                    </span>
                  </button>
                  );
                })}
              </section>
            ))
          )}
        </div>

        <footer className="command-palette-footer" aria-label="Keyboard shortcuts">
          <span className="command-palette-footer-item"><kbd>↑</kbd><kbd>↓</kbd> Move</span>
          <span className="command-palette-footer-item"><kbd>PgUp</kbd><kbd>PgDn</kbd> Jump</span>
          <span className="command-palette-footer-item"><kbd>Home</kbd><kbd>End</kbd> First/Last</span>
          <span className="command-palette-footer-item"><kbd>Alt+P</kbd> Pin/Unpin</span>
          <span className="command-palette-footer-item"><kbd>Enter</kbd> Run</span>
          <span className="command-palette-footer-item"><kbd>Esc</kbd> Close</span>
        </footer>
    </OverlayDialog>
  );
}