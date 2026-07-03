import { useMemo, useState } from "react";
import { Clock3, Search, Star, X } from "lucide-react";
import { OverlayDialog } from "./OverlayDialog";
import { formatDate } from "../utils/dateUtils";

function getIcon(type) {
  return type === "favorites" ? <Star size={16} /> : <Clock3 size={16} />;
}

export function NoteListPanel({
  isOpen,
  title,
  notes = [],
  type = "recent",
  emptyMessage,
  onClose,
  onOpenNote,
}) {
  const [filter, setFilter] = useState("");

  const filteredNotes = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return notes;
    return notes.filter((note) => {
      const titleText = String(note?.displayName || note?.title || "").toLowerCase();
      const pathText = String(note?.filePath || "").toLowerCase();
      return titleText.includes(needle) || pathText.includes(needle);
    });
  }, [notes, filter]);

  if (!isOpen) return null;

  return (
    <OverlayDialog open={isOpen} onClose={onClose} ariaLabel={title} cardClassName="tasks-panel-card note-list-panel-card">
      <div className="overlay-dialog-header tasks-panel-header">
        <div className="tasks-panel-title-group">
          {getIcon(type)}
          <h2>{title}</h2>
          <span className="tasks-panel-count">{filteredNotes.length}</span>
        </div>
        <button className="icon-button" onClick={onClose} type="button" aria-label={`Close ${title}`}>
          <X size={16} />
        </button>
      </div>

      <div className="tasks-panel-search">
        <Search size={14} />
        <input
          type="search"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filter notes…"
          aria-label={`Filter ${title}`}
          className="tasks-panel-filter-input"
        />
      </div>

      <div className="tasks-panel-body">
        {!notes.length ? (
          <div className="tasks-panel-empty">
            <p>{emptyMessage}</p>
          </div>
        ) : !filteredNotes.length ? (
          <div className="tasks-panel-empty">
            <p>No notes match your filter.</p>
          </div>
        ) : (
          <ul className="note-list-panel-list" aria-label={title}>
            {filteredNotes.map((note) => (
              <li key={note.filePath}>
                <button
                  type="button"
                  className="note-list-panel-button"
                  onClick={() => {
                    onOpenNote?.(note);
                    onClose?.();
                  }}
                >
                  <span className="note-list-panel-title">{note.displayName || note.title}</span>
                  <small>{formatDate(note.updatedAt)}</small>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </OverlayDialog>
  );
}