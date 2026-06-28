import { useEffect, useMemo, useRef, useState } from "react";

function matchesQuery(command, query) {
  const needle = String(query || "").trim().toLowerCase();
  if (!needle) return true;
  const haystack = `${command.label} ${command.group || ""} ${command.keywords || ""}`.toLowerCase();
  return haystack.includes(needle);
}

function getCommandScore(command, query) {
  const needle = String(query || "").trim().toLowerCase();
  const label = String(command.label || "").toLowerCase();
  const group = String(command.group || "").toLowerCase();
  const keywords = String(command.keywords || "").toLowerCase();
  const priority = Number.isFinite(command.priority) ? command.priority : 100;

  if (!needle) {
    return -priority;
  }

  let score = 0;
  if (label.startsWith(needle)) score += 60;
  if (label.includes(needle)) score += 30;
  if (keywords.includes(needle)) score += 35;
  if (group.includes(needle)) score += 10;
  return score - priority;
}

export function CommandPalette({ isOpen, commands = [], onClose, onRun }) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);

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
    setActiveIndex(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setActiveIndex((index) => Math.min(index, Math.max(filtered.length - 1, 0)));
  }, [filtered, isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="overlay-dialog"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="overlay-dialog-card command-palette-card">
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
                setActiveIndex((index) => Math.min(index + 1, Math.max(filtered.length - 1, 0)));
                return;
              }

              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((index) => Math.max(index - 1, 0));
                return;
              }

              if (event.key === "Enter") {
                event.preventDefault();
                const selected = filtered[activeIndex];
                if (selected && !selected.disabled) onRun(selected.id);
              }
            }}
            placeholder="Type a command or action"
            aria-label="Filter commands"
          />
          <span className="command-palette-hint">Esc</span>
        </div>

        <div className="command-palette-results" role="listbox" aria-label="Command results">
          {!filtered.length ? (
            <div className="command-palette-empty">No matching command</div>
          ) : (
            groupedResults.map((group) => (
              <section className="command-palette-group" key={group.key} aria-label={`${group.title} commands`}>
                <header className="command-palette-group-header">{group.title}</header>
                {group.items.map(({ command, index }) => (
                  <button
                    key={command.id}
                    className={`command-palette-item${index === activeIndex ? " active" : ""}`}
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    aria-disabled={command.disabled ? "true" : "false"}
                    disabled={Boolean(command.disabled)}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => onRun(command.id)}
                  >
                    <span className="command-palette-item-text">
                      <strong>{command.label}</strong>
                    </span>
                    {command.shortcut ? <kbd>{command.shortcut}</kbd> : null}
                  </button>
                ))}
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
}