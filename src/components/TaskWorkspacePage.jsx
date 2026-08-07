import { useState, useRef, useCallback, useEffect } from "react";
import {
  Plus, Search, CheckCircle2, Circle, Clock, AlertTriangle,
  ChevronRight, ExternalLink, MessageSquare, User, Calendar,
  Trash2, Edit3, Check, X, Flag, AlarmClock, FileText,
  ListChecks, CheckCheck, List, Columns, Database
} from "lucide-react";
import "../styles/TaskWorkspacePage.css";
import { useTaskWorkspace } from "../hooks/useTaskWorkspace";
import { listWorkspaceTaskDocuments } from "../services/electronService";
import { OverlayDialog } from "./OverlayDialog";
import AppButton from "./AppButton";
import AppSelect from "./AppSelect";
import useConfirm from "../hooks/useConfirm";

const PRIORITY_LABELS = { 0: "None", 1: "Low", 2: "Medium", 3: "High" };
const PRIORITY_COLORS = { 0: "none", 1: "low", 2: "medium", 3: "high" };

const VIEW_META = {
  today:    { label: "Today",     Icon: Clock,         desc: "Due today" },
  upcoming: { label: "Upcoming",  Icon: Calendar,      desc: "Upcoming tasks" },
  overdue:  { label: "Overdue",   Icon: AlertTriangle, desc: "Past due" },
  done:     { label: "Completed", Icon: CheckCheck,    desc: "Completed tasks" },
  all:      { label: "All Tasks", Icon: ListChecks,    desc: "Every task" },
};

const KANBAN_COLUMNS = [
  { id: "open", label: "To Do", color: "var(--accent-solid)", icon: Circle },
  { id: "in_progress", label: "In Progress", color: "#f59e0b", icon: Clock },
  { id: "done", label: "Completed", color: "#10b981", icon: CheckCircle2 },
];

function TaskStatusIcon({ status }) {
  if (status === "done") return <CheckCircle2 size={16} className="task-icon done" />;
  if (status === "in_progress") return <Clock size={16} className="task-icon in-progress" />;
  return <Circle size={16} className="task-icon open" />;
}

function PriorityBadge({ priority }) {
  const label = PRIORITY_LABELS[priority] ?? "None";
  const cls = PRIORITY_COLORS[priority] ?? "none";
  if (priority === 0) return null;
  return <span className={`task-priority-badge priority-${cls}`}><Flag size={12} />{label}</span>;
}

function TaskRow({ task, isSelected, onSelect, onComplete, onOpenNote }) {
  const isOverdue = task.due_date && task.status !== "done" && task.due_date < new Date().toISOString().slice(0, 10);

  return (
    <div
      className={`task-row${isSelected ? " selected" : ""}${task.status === "done" ? " done" : ""}${isOverdue ? " overdue" : ""}`}
      onClick={() => onSelect(task.id)}
      role="row"
      aria-selected={isSelected}
      tabIndex={0}
      onKeyDown={e => e.key === "Enter" && onSelect(task.id)}
    >
      <button
        className="task-row-check"
        type="button"
        aria-label={task.status === "done" ? "Mark open" : "Mark done"}
        onClick={e => { e.stopPropagation(); onComplete(task.id, task.status === "done" ? "open" : "done"); }}
      >
        <TaskStatusIcon status={task.status} />
      </button>
      <div className="task-row-body">
        <span className="task-row-title">{task.title || "Untitled"}</span>
        <div className="task-row-meta">
          {task.due_date && (
            <span className={`task-row-due${isOverdue ? " overdue" : ""}`}>
              <Clock size={12} />{task.due_date}
            </span>
          )}
          <PriorityBadge priority={task.priority} />
          {task.status === "in_progress" && (
            <span className="task-status-pill in-progress">In Progress</span>
          )}
          {task.source_path && (
            <button
              className="task-row-note-link"
              type="button"
              aria-label="Open source note"
              onClick={e => { e.stopPropagation(); onOpenNote?.(task.source_path); }}
            >
              <FileText size={12} />
              <span>{task.source_path.split(/[/\\]/).pop()?.replace(/\.md$/i, "")}</span>
            </button>
          )}
        </div>
      </div>
      <ChevronRight size={14} className="task-row-chevron" />
    </div>
  );
}

function KanbanCard({ task, isSelected, onSelect, onStatusChange, onOpenNote }) {
  const isOverdue = task.due_date && task.status !== "done" && task.due_date < new Date().toISOString().slice(0, 10);

  const handleDragStart = (e) => {
    e.dataTransfer.setData("text/plain", task.id);
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div
      className={`kanban-card${isSelected ? " selected" : ""}${task.status === "done" ? " done" : ""}${isOverdue ? " overdue" : ""}`}
      onClick={() => onSelect(task.id)}
      draggable
      onDragStart={handleDragStart}
      tabIndex={0}
    >
      <div className="kanban-card-header">
        <span className="kanban-card-title">{task.title || "Untitled"}</span>
        <PriorityBadge priority={task.priority} />
      </div>

      {task.description && (
        <p className="kanban-card-desc">{task.description}</p>
      )}

      {(task.due_date || task.source_path) && (
        <div className="kanban-card-footer">
          <div className="kanban-card-meta">
            {task.due_date && (
              <span className={`kanban-due${isOverdue ? " overdue" : ""}`} title={`Due ${task.due_date}`}>
                <Clock size={12} />{task.due_date}
              </span>
            )}
            {task.source_path && (
              <button
                type="button"
                className="kanban-note-link"
                onClick={e => { e.stopPropagation(); onOpenNote?.(task.source_path); }}
                title="Open source note"
              >
                <FileText size={12} />
                <span>{task.source_path.split(/[/\\]/).pop()?.replace(/\.md$/i, "")}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function KanbanBoard({ tasks, selectedId, onSelect, onStatusChange, onOpenNote, onNewTask }) {
  const [dragOverCol, setDragOverCol] = useState(null);

  const handleDragOver = (e, colId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCol(colId);
  };

  const handleDragLeave = () => {
    setDragOverCol(null);
  };

  const handleDrop = (e, colId) => {
    e.preventDefault();
    setDragOverCol(null);
    const taskId = e.dataTransfer.getData("text/plain");
    if (taskId) {
      onStatusChange(taskId, colId);
    }
  };

  return (
    <div className="kanban-board">
      {KANBAN_COLUMNS.map(col => {
        const colTasks = tasks.filter(t => {
          if (col.id === "open") return t.status === "open" || !t.status;
          return t.status === col.id;
        });
        const ColumnIcon = col.icon;
        const isTarget = dragOverCol === col.id;

        return (
          <div
            key={col.id}
            className={`kanban-column${isTarget ? " drag-over" : ""}`}
            onDragOver={e => handleDragOver(e, col.id)}
            onDragLeave={handleDragLeave}
            onDrop={e => handleDrop(e, col.id)}
          >
            <div className="kanban-column-header">
              <div className="kanban-column-title">
                <ColumnIcon size={14} style={{ color: col.color }} />
                <span>{col.label}</span>
                <span className="kanban-count-badge">{colTasks.length}</span>
              </div>
              <button
                type="button"
                className="kanban-add-btn icon-button"
                onClick={() => onNewTask(col.id)}
                title={`Add task to ${col.label}`}
              >
                <Plus size={14} />
              </button>
            </div>

            <div className="kanban-column-body">
              {colTasks.length === 0 ? (
                <div className="kanban-column-empty">
                  <span>No tasks</span>
                </div>
              ) : (
                colTasks.map(task => (
                  <KanbanCard
                    key={task.id}
                    task={task}
                    isSelected={task.id === selectedId}
                    onSelect={onSelect}
                    onStatusChange={onStatusChange}
                    onOpenNote={onOpenNote}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TaskDetail({ task, comments, commentsLoading, persons, onUpdate, onDelete, onAddComment, onOpenNote, onDirtyChange }) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title || "");
  const [descDraft, setDescDraft] = useState(task.description || "");
  const [statusDraft, setStatusDraft] = useState(task.status || "open");
  const [dueDateDraft, setDueDateDraft] = useState(task.due_date || "");
  const [scheduledStartDraft, setScheduledStartDraft] = useState(task.scheduled_start ? task.scheduled_start.slice(0, 16) : "");
  const [scheduledEndDraft, setScheduledEndDraft] = useState(task.scheduled_end ? task.scheduled_end.slice(0, 16) : "");
  const [priorityDraft, setPriorityDraft] = useState(task.priority ?? 0);
  const [personTagsDraft, setPersonTagsDraft] = useState(task.personTags || []);
  const [commentDraft, setCommentDraft] = useState("");
  const titleRef = useRef(null);

  // Sync drafts when selected task changes
  useEffect(() => {
    setTitleDraft(task.title || "");
    setDescDraft(task.description || "");
    setStatusDraft(task.status || "open");
    setDueDateDraft(task.due_date || "");
    setScheduledStartDraft(task.scheduled_start ? task.scheduled_start.slice(0, 16) : "");
    setScheduledEndDraft(task.scheduled_end ? task.scheduled_end.slice(0, 16) : "");
    setPriorityDraft(task.priority ?? 0);
    setPersonTagsDraft(task.personTags || []);
    setEditingTitle(false);
  }, [task.id, task.title, task.description, task.status, task.due_date, task.scheduled_start, task.scheduled_end, task.priority, task.personTags]);

  const isDirty = (
    titleDraft.trim() !== (task.title || "") ||
    descDraft !== (task.description || "") ||
    statusDraft !== (task.status || "open") ||
    dueDateDraft !== (task.due_date || "") ||
    (scheduledStartDraft || "") !== (task.scheduled_start ? task.scheduled_start.slice(0, 16) : "") ||
    (scheduledEndDraft || "") !== (task.scheduled_end ? task.scheduled_end.slice(0, 16) : "") ||
    Number(priorityDraft) !== (task.priority ?? 0) ||
    JSON.stringify(personTagsDraft) !== JSON.stringify(task.personTags || [])
  );

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const handleSave = () => {
    onUpdate(task.id, {
      title: titleDraft.trim() || "Untitled",
      description: descDraft,
      status: statusDraft,
      dueDate: dueDateDraft || null,
      scheduledStart: scheduledStartDraft || null,
      scheduledEnd: scheduledEndDraft || null,
      priority: Number(priorityDraft),
      personTags: personTagsDraft,
    });
    onDirtyChange?.(false);
  };

  const submitComment = (e) => {
    e.preventDefault();
    if (!commentDraft.trim()) return;
    onAddComment(task.id, commentDraft.trim());
    setCommentDraft("");
  };

  const isOverdue = dueDateDraft && statusDraft !== "done" && dueDateDraft < new Date().toISOString().slice(0, 10);

  return (
    <div className="task-detail">
      {/* Title Header with Inline Save and Delete Buttons */}
      <div className="task-detail-header">
        <div className="task-detail-title-col">
          {editingTitle ? (
            <input
              ref={titleRef}
              className="task-detail-title-input"
              value={titleDraft}
              onChange={e => setTitleDraft(e.target.value)}
              onBlur={() => setEditingTitle(false)}
              onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") setEditingTitle(false); }}
              autoFocus
            />
          ) : (
            <h2 className="task-detail-title" onClick={() => setEditingTitle(true)}>
              {titleDraft || "Untitled"}
              <Edit3 size={12} className="task-detail-edit-hint" />
            </h2>
          )}

          {task.source_path && (
            <div className="task-detail-title-subtitle">
              <button type="button" className="task-source-link" onClick={() => onOpenNote?.(task.source_path)}>
                <FileText size={12} />
                <span>{task.source_path.split(/[/\\]/).pop()?.replace(/\.md$/i, "")}</span>
                <ExternalLink size={12} />
              </button>
            </div>
          )}
        </div>

        {/* Header Inline Actions */}
        <div className="task-detail-header-actions">
          <AppButton
            variant="primary"
            disabled={!isDirty}
            onClick={handleSave}
            title={isDirty ? "Save changes to this task" : "No unsaved changes"}
            className="task-header-save-btn"
          >
            <Check size={12} /> Save
          </AppButton>
          <AppButton
            variant="small"
            danger
            onClick={() => { if (window.confirm("Delete this task?")) onDelete(task.id); }}
            title="Delete task"
            className="task-header-delete-btn"
          >
            <Trash2 size={12} /> Delete
          </AppButton>
        </div>
      </div>

      <div className="task-detail-scroll-content">
        {/* Meta fields */}
        <div className="task-detail-fields">
          {/* Status */}
          <div className="task-field-row">
            <label className="task-field-label"><CheckCircle2 size={12} /> Status</label>
            <div className="task-status-selector" role="radiogroup" aria-label="Task status">
              <button
                type="button"
                className={`task-status-btn status-open${statusDraft === "open" ? " active" : ""}`}
                onClick={() => setStatusDraft("open")}
                role="radio"
                aria-checked={statusDraft === "open"}
              >
                <Circle size={12} />
                <span>To Do</span>
              </button>
              <ChevronRight size={12} className="status-progress-arrow" />
              <button
                type="button"
                className={`task-status-btn status-in-progress${statusDraft === "in_progress" ? " active" : ""}`}
                onClick={() => setStatusDraft("in_progress")}
                role="radio"
                aria-checked={statusDraft === "in_progress"}
              >
                <Clock size={12} />
                <span>In Progress</span>
              </button>
              <ChevronRight size={12} className="status-progress-arrow" />
              <button
                type="button"
                className={`task-status-btn status-done${statusDraft === "done" ? " active" : ""}`}
                onClick={() => setStatusDraft("done")}
                role="radio"
                aria-checked={statusDraft === "done"}
              >
                <CheckCircle2 size={12} />
                <span>Completed</span>
              </button>
            </div>
          </div>
          {/* Due date */}
          <div className="task-field-row">
            <label className="task-field-label"><Clock size={12} /> Due Date</label>
            <input
              type="date"
              className={`task-field-input${isOverdue ? " overdue" : ""}`}
              value={dueDateDraft}
              onChange={e => setDueDateDraft(e.target.value)}
            />
          </div>
          {/* Scheduled Start & End */}
          <div className="task-field-row task-schedule-grid-row">
            <label className="task-field-label"><AlarmClock size={12} /> Schedule</label>
            <div className="task-schedule-inputs-grid">
              <div className="task-schedule-col">
                <span className="task-sublabel">Start</span>
                <input
                  type="datetime-local"
                  className="task-field-input"
                  value={scheduledStartDraft}
                  onChange={e => setScheduledStartDraft(e.target.value)}
                />
              </div>
              <div className="task-schedule-col">
                <span className="task-sublabel">End</span>
                <input
                  type="datetime-local"
                  className="task-field-input"
                  value={scheduledEndDraft}
                  onChange={e => setScheduledEndDraft(e.target.value)}
                />
              </div>
            </div>
          </div>
          {/* Priority */}
          <div className="task-field-row">
            <label className="task-field-label"><Flag size={12} /> Priority</label>
            <div className="task-priority-selector" role="radiogroup" aria-label="Priority level">
              {Object.entries(PRIORITY_LABELS).map(([val, label]) => {
                const numVal = Number(val);
                const isSelected = Number(priorityDraft) === numVal;
                const cls = PRIORITY_COLORS[numVal] ?? "none";
                return (
                  <button
                    key={val}
                    type="button"
                    className={`task-priority-btn priority-${cls}${isSelected ? " active" : ""}`}
                    onClick={() => setPriorityDraft(numVal)}
                    aria-checked={isSelected}
                    role="radio"
                  >
                    {numVal > 0 && <Flag size={12} />}
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          {/* Person tags */}
          <div className="task-field-row">
            <label className="task-field-label"><User size={12} /> Assignees</label>
            <div className="task-field-tags">
              {personTagsDraft.map(pid => {
                const person = (persons.persons || []).find(p => p.id === pid);
                return person ? (
                  <span key={pid} className="task-person-tag">
                    {person.name}
                    <button type="button" onClick={() => setPersonTagsDraft(prev => prev.filter(id => id !== pid))}>
                      <X size={12} />
                    </button>
                  </span>
                ) : null;
              })}
              <AppSelect
                className="task-field-select task-person-add"
                value=""
                onChange={e => {
                  if (!e.target.value) return;
                  setPersonTagsDraft(prev => [...new Set([...prev, e.target.value])]);
                }}
              >
                <option value="">+ Add person</option>
                {(persons.persons || []).map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
                {(persons.suggestions || []).map((s, i) => (
                  <option key={`s-${i}`} value={`suggestion:${s.name}`}>+ {s.name}</option>
                ))}
              </AppSelect>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="task-detail-section">
          <h4 className="task-detail-section-title">Description</h4>
          <textarea
            className="task-detail-textarea"
            value={descDraft}
            onChange={e => setDescDraft(e.target.value)}
            placeholder="Add a description…"
            rows={4}
          />
        </div>
      </div>

      {/* Comments */}
      <div className="task-detail-section task-comments-section">
        <h4 className="task-detail-section-title"><MessageSquare size={12} /> Comments</h4>
        <div className="task-comments-list">
          {commentsLoading && <p className="task-comments-loading">Loading…</p>}
          {!commentsLoading && comments.length === 0 && (
            <p className="task-comments-empty">No comments yet.</p>
          )}
          {comments.map(c => (
            <div key={c.id} className="task-comment">
              <div className="task-comment-header">
                <span className="task-comment-author">{c.author}</span>
                <span className="task-comment-time">{c.createdAt ? new Date(c.createdAt).toLocaleString() : ""}</span>
              </div>
              <p className="task-comment-body">{c.body}</p>
            </div>
          ))}
        </div>
        <form className="task-comment-form" onSubmit={submitComment}>
          <textarea
            className="task-comment-input"
            value={commentDraft}
            onChange={e => setCommentDraft(e.target.value)}
            placeholder="Add a comment…"
            rows={2}
            onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitComment(e); }}
          />
          <AppButton type="submit" variant="small" className="task-comment-submit primary-button" disabled={!commentDraft.trim()}>
            <Check size={12} /> Post
          </AppButton>
        </form>
      </div>
    </div>
  );
}

function NewTaskModal({ onCreate, onClose, defaultStatus = "open", defaultNoteFilter }) {
  const now = new Date();
  const roundedStart = new Date(Math.ceil(now.getTime() / (30 * 60000)) * 30 * 60000);
  const roundedEnd = new Date(roundedStart.getTime() + 60 * 60000);
  const toDatetimeLocal = d => d.toISOString().slice(0, 16);

  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState(now.toISOString().slice(0, 10));
  const [scheduledStart, setScheduledStart] = useState(toDatetimeLocal(roundedStart));
  const [scheduledEnd, setScheduledEnd] = useState(toDatetimeLocal(roundedEnd));
  const [priority, setPriority] = useState(0);
  const [status, setStatus] = useState(defaultStatus);
  const [isAllDay, setIsAllDay] = useState(true);
  const [targetNotePath, setTargetNotePath] = useState(defaultNoteFilter || "");
  const [workspaceNotes, setWorkspaceNotes] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function loadWorkspaceNotes() {
      try {
        const docs = await listWorkspaceTaskDocuments();
        if (!cancelled && Array.isArray(docs)) {
          setWorkspaceNotes(docs);
        }
      } catch (err) {
        console.error("Failed to load workspace notes for task modal:", err);
      }
    }
    loadWorkspaceNotes();
    return () => { cancelled = true; };
  }, []);

  const handleSubmit = e => {
    e.preventDefault();
    if (!title.trim()) return;
    onCreate({
      title: title.trim(),
      status: status || "open",
      dueDate: dueDate || null,
      scheduledStart: isAllDay ? null : scheduledStart,
      scheduledEnd: isAllDay ? null : scheduledEnd,
      priority: Number(priority),
      isAllDay: isAllDay ? 1 : 0,
      sourcePath: targetNotePath || "none",
      standalone: !targetNotePath,
    });
    onClose();
  };

  return (
    <OverlayDialog open={true} onClose={onClose} ariaLabel="Create task" cardClassName="task-modal-card">
      <div className="task-modal-header">
        <h3>New Task</h3>
        <button className="task-detail-close icon-button" onClick={onClose} type="button" aria-label="Cancel">
          <X size={14} />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="task-modal-form">
        <div className="task-modal-form-body">
          <div className="task-modal-field">
            <label className="task-modal-label">Title</label>
            <input
              className="task-modal-title-input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              autoFocus
              required
            />
          </div>

          {/* Target Note Selection */}
          <div className="task-modal-field">
            <label className="task-modal-label">Target Note</label>
            <AppSelect
              value={targetNotePath}
              onChange={e => setTargetNotePath(e.target.value)}
              aria-label="Target note for task"
            >
              <option value="">(None - Standalone Task)</option>
              {workspaceNotes.map(n => {
                const notePath = n.path || n.filePath || n.id || n;
                const label = n.relativePath || n.title || (typeof notePath === "string" ? notePath.split(/[/\\]/).pop()?.replace(/\.md$/i, "") : String(notePath));
                return (
                  <option key={notePath} value={notePath}>
                    {label}
                  </option>
                );
              })}
            </AppSelect>
          </div>
          <div className="task-modal-fields-grid">
            <div className="task-modal-field task-modal-status-field">
              <label className="task-modal-label">Status</label>
              <div className="task-status-selector" role="radiogroup" aria-label="Task status">
                <button
                  type="button"
                  className={`task-status-btn status-open${status === "open" ? " active" : ""}`}
                  onClick={() => setStatus("open")}
                  role="radio"
                  aria-checked={status === "open"}
                >
                  <Circle size={12} />
                  <span>To Do</span>
                </button>
                <ChevronRight size={12} className="status-progress-arrow" />
                <button
                  type="button"
                  className={`task-status-btn status-in-progress${status === "in_progress" ? " active" : ""}`}
                  onClick={() => setStatus("in_progress")}
                  role="radio"
                  aria-checked={status === "in_progress"}
                >
                  <Clock size={12} />
                  <span>In Progress</span>
                </button>
                <ChevronRight size={12} className="status-progress-arrow" />
                <button
                  type="button"
                  className={`task-status-btn status-done${status === "done" ? " active" : ""}`}
                  onClick={() => setStatus("done")}
                  role="radio"
                  aria-checked={status === "done"}
                >
                  <CheckCircle2 size={12} />
                  <span>Completed</span>
                </button>
              </div>
            </div>
            <div className="task-modal-field task-modal-priority-field">
              <label className="task-modal-label">Priority</label>
              <div className="task-priority-selector" role="radiogroup" aria-label="Priority level">
                {Object.entries(PRIORITY_LABELS).map(([val, label]) => {
                  const numVal = Number(val);
                  const isSelected = Number(priority) === numVal;
                  const cls = PRIORITY_COLORS[numVal] ?? "none";
                  return (
                    <button
                      key={val}
                      type="button"
                      className={`task-priority-btn priority-${cls}${isSelected ? " active" : ""}`}
                      onClick={() => setPriority(numVal)}
                      aria-checked={isSelected}
                      role="radio"
                    >
                      {numVal > 0 && <Flag size={12} />}
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="task-modal-field">
              <label className="task-modal-label">Due Date</label>
              <input type="date" className="task-field-input" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
            <div className="task-modal-field task-modal-checkbox-field">
              <label className="task-modal-checkbox-label">
                <input type="checkbox" checked={isAllDay} onChange={e => setIsAllDay(e.target.checked)} />
                <span>All day event</span>
              </label>
            </div>
            {!isAllDay && (
              <>
                <div className="task-modal-field">
                  <label className="task-modal-label">Start</label>
                  <input type="datetime-local" className="task-field-input" value={scheduledStart} onChange={e => setScheduledStart(e.target.value)} />
                </div>
                <div className="task-modal-field">
                  <label className="task-modal-label">End</label>
                  <input type="datetime-local" className="task-field-input" value={scheduledEnd} onChange={e => setScheduledEnd(e.target.value)} />
                </div>
              </>
            )}
          </div>
        </div>
        <div className="task-modal-actions">
          <AppButton type="button" onClick={onClose} variant="small">
            Cancel
          </AppButton>
          <AppButton type="submit" variant="primary" disabled={!title.trim()}>
            <Plus size={14} /> Create Task
          </AppButton>
        </div>
      </form>
    </OverlayDialog>
  );
}

export function TaskWorkspacePage({ onBack, onOpenNote, noteFilter = null }) {
  const ws = useTaskWorkspace({ noteFilter });
  const { confirm } = useConfirm();
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTaskInitialStatus, setNewTaskInitialStatus] = useState("open");
  const [isTaskDirty, setIsTaskDirty] = useState(false);
  const searchDebounceRef = useRef(null);

  const handleSearchChange = useCallback(value => {
    clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => ws.setSearch(value), 300);
  }, [ws]);

  const checkUnsavedGuard = useCallback(async () => {
    if (!isTaskDirty) return true;
    const confirmed = await confirm({
      title: "Unsaved Task Changes",
      message: "You have unsaved changes to this task. Do you want to discard your changes?",
      confirmLabel: "Discard Changes",
      cancelLabel: "Keep Editing",
      variant: "warning",
    });
    if (confirmed) {
      setIsTaskDirty(false);
      return true;
    }
    return false;
  }, [isTaskDirty, confirm]);

  const handleSelectTask = useCallback(async (id) => {
    if (id === ws.selectedId) return;
    const canProceed = await checkUnsavedGuard();
    if (canProceed) {
      ws.setSelectedId(id);
    }
  }, [ws, checkUnsavedGuard]);

  const handleViewChange = useCallback(async (newView) => {
    if (newView === ws.view) return;
    const canProceed = await checkUnsavedGuard();
    if (canProceed) {
      ws.setView(newView);
    }
  }, [ws, checkUnsavedGuard]);

  const handleBackGuard = useCallback(async () => {
    const canProceed = await checkUnsavedGuard();
    if (canProceed) {
      onBack();
    }
  }, [onBack, checkUnsavedGuard]);

  const handleOpenNewTaskModal = async (initialStatus = "open") => {
    const canProceed = await checkUnsavedGuard();
    if (canProceed) {
      setNewTaskInitialStatus(initialStatus);
      setShowNewTask(true);
    }
  };

  return (
    <div className="knowledge-graph-page task-workspace-root">
      {/* Unified App-Standard Topbar Navigation & Actions */}
      <div className="detail-topbar">
        <nav className="detail-breadcrumb" aria-label="Tasks location">
          <span className="detail-breadcrumb-part">
            <button className="detail-breadcrumb-link" type="button" onClick={handleBackGuard}>
              Notes
            </button>
            <span className="detail-breadcrumb-separator" aria-hidden="true">/</span>
          </span>
          <span className="detail-breadcrumb-current">Tasks</span>
        </nav>

        {noteFilter && (
          <div className="task-sidebar-context">
            <span>From: {noteFilter.split(/[/\\]/).pop()?.replace(/\.md$/i, "")}</span>
            <button type="button" onClick={() => { /* clear filter */ }} aria-label="Clear note filter">
              <X size={12} />
            </button>
          </div>
        )}

        <div className="detail-topbar-actions">
          {/* View Filter Dropdown */}
          <AppSelect
            className="task-header-filter-select"
            value={ws.view}
            onChange={e => handleViewChange(e.target.value)}
            aria-label="Filter tasks view"
          >
            {ws.views.map(v => (
              <option key={v} value={v}>
                {VIEW_META[v]?.label ?? v}
              </option>
            ))}
          </AppSelect>

          <div className="task-stats-pill">
            <Database size={12} />
            <span>{ws.tasks.length}</span>
          </div>

          {/* Search box */}
          <div className="task-search-box">
            <Search size={14} />
            <input
              type="search"
              placeholder={`Search ${VIEW_META[ws.view]?.desc ?? "tasks"}…`}
              onChange={e => handleSearchChange(e.target.value)}
              aria-label="Search tasks"
            />
          </div>

          {/* View mode toggle using standard tab-bar pattern */}
          <div className="tab-bar task-view-toggle-tabbar" role="tablist">
            <button
              type="button"
              className={`tab-item${ws.layoutMode === "list" ? " active" : ""}`}
              onClick={() => ws.setLayoutMode("list")}
              title="List View"
              role="tab"
              aria-selected={ws.layoutMode === "list"}
            >
              <List size={14} />
              <span>List</span>
            </button>
            <button
              type="button"
              className={`tab-item${ws.layoutMode === "kanban" ? " active" : ""}`}
              onClick={() => ws.setLayoutMode("kanban")}
              title="Kanban Board View"
              role="tab"
              aria-selected={ws.layoutMode === "kanban"}
            >
              <Columns size={14} />
              <span>Kanban</span>
            </button>
          </div>

          {/* New task primary app button */}
          <AppButton
            variant="small"
            className="task-header-new-btn primary-button"
            onClick={() => handleOpenNewTaskModal("open")}
          >
            <Plus size={14} /> New Task
          </AppButton>
        </div>
      </div>

      {/* Workspace Main Body */}
      <div className="task-workspace-body">
        <main className="task-main">
          {ws.layoutMode === "kanban" ? (
            <KanbanBoard
              tasks={ws.tasks}
              selectedId={ws.selectedId}
              onSelect={handleSelectTask}
              onStatusChange={(id, status) => ws.handleUpdate(id, { status })}
              onOpenNote={onOpenNote}
              onNewTask={status => handleOpenNewTaskModal(status)}
            />
          ) : (
            <div className="task-list-split-view">
              {/* Left: Compact Task List (50% width) */}
              <div className="task-list-area" role="grid" aria-label="Task list">
                {ws.loading && <div className="task-list-loading"><div className="task-spinner" /></div>}
                {!ws.loading && ws.tasks.length === 0 && (
                  <div className="task-list-empty">
                    <ListChecks size={20} />
                    <p>No tasks in this view.</p>
                    <AppButton variant="primary" onClick={() => handleOpenNewTaskModal("open")}>
                      <Plus size={14} /> Create task
                    </AppButton>
                  </div>
                )}
                {!ws.loading && ws.tasks.map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    isSelected={task.id === ws.selectedId}
                    onSelect={handleSelectTask}
                    onComplete={ws.handleComplete}
                    onOpenNote={onOpenNote}
                  />
                ))}
              </div>

              {/* Right: Persistent Detail Pane (50% width) */}
              <div className="task-persistent-detail-pane">
                {ws.selectedTask ? (
                  <TaskDetail
                    task={ws.selectedTask}
                    comments={ws.comments}
                    commentsLoading={ws.commentsLoading}
                    persons={ws.persons}
                    onUpdate={ws.handleUpdate}
                    onDelete={ws.handleDelete}
                    onAddComment={ws.handleAddComment}
                    onOpenNote={onOpenNote}
                    onDirtyChange={setIsTaskDirty}
                  />
                ) : (
                  <div className="task-detail-empty-state">
                    <FileText size={20} className="task-detail-empty-icon" />
                    <h3>No Task Selected</h3>
                    <p>Select a task from the list to view and edit its details.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* New task modal dialog */}
      {showNewTask && (
        <NewTaskModal
          onCreate={ws.handleCreate}
          onClose={() => setShowNewTask(false)}
          defaultStatus={newTaskInitialStatus}
          defaultNoteFilter={noteFilter}
        />
      )}
    </div>
  );
}
