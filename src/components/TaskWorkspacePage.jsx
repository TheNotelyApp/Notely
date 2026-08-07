import { useState, useRef, useCallback } from "react";
import {
  ArrowLeft, Plus, Search, CheckCircle2, Circle, Clock, AlertTriangle,
  ChevronRight, ExternalLink, MessageSquare, User, Calendar,
  Trash2, Edit3, Check, X, Flag, AlarmClock, FileText,
  ListChecks, CheckCheck,
} from "lucide-react";
import "../../src/styles/TaskWorkspacePage.css";
import { useTaskWorkspace } from "../hooks/useTaskWorkspace";
import { OverlayDialog } from "./OverlayDialog";

const PRIORITY_LABELS = { 0: "None", 1: "Low", 2: "Medium", 3: "High" };
const PRIORITY_COLORS = { 0: "none", 1: "low", 2: "medium", 3: "high" };

const VIEW_META = {
  today:    { label: "Today",     Icon: Clock,         desc: "Due today" },
  upcoming: { label: "Upcoming",  Icon: Calendar,      desc: "Upcoming tasks" },
  overdue:  { label: "Overdue",   Icon: AlertTriangle, desc: "Past due" },
  done:     { label: "Completed", Icon: CheckCheck,    desc: "Completed tasks" },
  all:      { label: "All Tasks", Icon: ListChecks,    desc: "Every task" },
};

function TaskStatusIcon({ status }) {
  if (status === "done") return <CheckCircle2 size={16} className="task-icon done" />;
  return <Circle size={16} className="task-icon open" />;
}

function PriorityBadge({ priority }) {
  const label = PRIORITY_LABELS[priority] ?? "None";
  const cls = PRIORITY_COLORS[priority] ?? "none";
  if (priority === 0) return null;
  return <span className={`task-priority-badge priority-${cls}`}><Flag size={10} />{label}</span>;
}

function TaskRow({ task, isSelected, onSelect, onComplete, onOpenNote }) {
  const isOverdue = task.due_date && task.status === "open" && task.due_date < new Date().toISOString().slice(0, 10);

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
              <Clock size={10} />{task.due_date}
            </span>
          )}
          <PriorityBadge priority={task.priority} />
          {task.source_path && (
            <button
              className="task-row-note-link"
              type="button"
              aria-label="Open source note"
              onClick={e => { e.stopPropagation(); onOpenNote?.(task.source_path); }}
            >
              <FileText size={10} />
            </button>
          )}
        </div>
      </div>
      <ChevronRight size={12} className="task-row-chevron" />
    </div>
  );
}

function TaskDetail({ task, comments, commentsLoading, persons, onUpdate, onComplete, onDelete, onAddComment, onOpenNote, onClose }) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [descDraft, setDescDraft] = useState(task.description || "");
  const [commentDraft, setCommentDraft] = useState("");
  const titleRef = useRef(null);

  const saveTitle = () => {
    if (titleDraft.trim() && titleDraft !== task.title) {
      onUpdate(task.id, { title: titleDraft.trim() });
    }
    setEditingTitle(false);
  };

  const saveDesc = () => {
    if (descDraft !== (task.description || "")) {
      onUpdate(task.id, { description: descDraft });
    }
  };

  const submitComment = (e) => {
    e.preventDefault();
    if (!commentDraft.trim()) return;
    onAddComment(task.id, commentDraft.trim());
    setCommentDraft("");
  };

  const isOverdue = task.due_date && task.status === "open" && task.due_date < new Date().toISOString().slice(0, 10);

  return (
    <div className="task-detail">
      <div className="task-detail-header">
        <div className="task-detail-title-row">
          <button
            className="task-detail-check"
            type="button"
            onClick={() => onComplete(task.id, task.status === "done" ? "open" : "done")}
            aria-label={task.status === "done" ? "Reopen task" : "Complete task"}
          >
            <TaskStatusIcon status={task.status} />
          </button>
          {editingTitle ? (
            <input
              ref={titleRef}
              className="task-detail-title-input"
              value={titleDraft}
              onChange={e => setTitleDraft(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={e => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
              autoFocus
            />
          ) : (
            <h2 className="task-detail-title" onClick={() => { setEditingTitle(true); setTitleDraft(task.title); }}>
              {task.title || "Untitled"}
              <Edit3 size={12} className="task-detail-edit-hint" />
            </h2>
          )}
        </div>
        <button className="task-detail-close icon-button" onClick={onClose} type="button" aria-label="Close detail"><X size={14} /></button>
      </div>

      {/* Meta fields */}
      <div className="task-detail-fields">
        {/* Due date */}
        <div className="task-field-row">
          <label className="task-field-label"><Clock size={12} /> Due Date</label>
          <input
            type="date"
            className={`task-field-input${isOverdue ? " overdue" : ""}`}
            value={task.due_date || ""}
            onChange={e => onUpdate(task.id, { dueDate: e.target.value || null })}
          />
        </div>
        {/* Scheduled */}
        <div className="task-field-row">
          <label className="task-field-label"><AlarmClock size={12} /> Start</label>
          <input
            type="datetime-local"
            className="task-field-input"
            value={task.scheduled_start ? task.scheduled_start.slice(0, 16) : ""}
            onChange={e => onUpdate(task.id, { scheduledStart: e.target.value || null, isAllDay: 0 })}
          />
        </div>
        <div className="task-field-row">
          <label className="task-field-label"><AlarmClock size={12} /> End</label>
          <input
            type="datetime-local"
            className="task-field-input"
            value={task.scheduled_end ? task.scheduled_end.slice(0, 16) : ""}
            onChange={e => onUpdate(task.id, { scheduledEnd: e.target.value || null })}
          />
        </div>
        {/* Priority */}
        <div className="task-field-row">
          <label className="task-field-label"><Flag size={12} /> Priority</label>
          <select
            className="task-field-select"
            value={task.priority ?? 0}
            onChange={e => onUpdate(task.id, { priority: Number(e.target.value) })}
          >
            {Object.entries(PRIORITY_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>
        {/* Person tags */}
        <div className="task-field-row">
          <label className="task-field-label"><User size={12} /> Assignees</label>
          <div className="task-field-tags">
            {(task.personTags || []).map(pid => {
              const person = (persons.persons || []).find(p => p.id === pid);
              return person ? (
                <span key={pid} className="task-person-tag">
                  {person.name}
                  <button type="button" onClick={() => onUpdate(task.id, { personTags: (task.personTags || []).filter(id => id !== pid) })}>
                    <X size={10} />
                  </button>
                </span>
              ) : null;
            })}
            <select
              className="task-field-select task-person-add"
              value=""
              onChange={e => {
                if (!e.target.value) return;
                const next = [...new Set([...(task.personTags || []), e.target.value])];
                onUpdate(task.id, { personTags: next });
              }}
            >
              <option value="">+ Add person</option>
              {(persons.persons || []).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
              {(persons.suggestions || []).map((s, i) => (
                <option key={`s-${i}`} value={`suggestion:${s.name}`}>+ {s.name}</option>
              ))}
            </select>
          </div>
        </div>
        {/* Source note */}
        {task.source_path && (
          <div className="task-field-row">
            <label className="task-field-label"><FileText size={12} /> Source Note</label>
            <button type="button" className="task-source-link" onClick={() => onOpenNote?.(task.source_path)}>
              {task.source_path.split(/[/\\]/).pop()?.replace(/\.md$/i, "")}
              <ExternalLink size={10} />
            </button>
          </div>
        )}
      </div>

      {/* Description */}
      <div className="task-detail-section">
        <h4 className="task-detail-section-title">Description</h4>
        <textarea
          className="task-detail-textarea"
          value={descDraft}
          onChange={e => setDescDraft(e.target.value)}
          onBlur={saveDesc}
          placeholder="Add a description…"
          rows={4}
        />
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
          <button type="submit" className="task-comment-submit app-button primary" disabled={!commentDraft.trim()}>
            <Check size={12} /> Post
          </button>
        </form>
      </div>

      {/* Danger zone */}
      <div className="task-detail-footer">
        <button
          type="button"
          className="task-delete-btn"
          onClick={() => { if (window.confirm("Delete this task?")) onDelete(task.id); }}
        >
          <Trash2 size={12} /> Delete task
        </button>
      </div>
    </div>
  );
}

function NewTaskModal({ onCreate, onClose, defaultNoteFilter }) {
  const now = new Date();
  const roundedStart = new Date(Math.ceil(now.getTime() / (30 * 60000)) * 30 * 60000);
  const roundedEnd = new Date(roundedStart.getTime() + 60 * 60000);
  const toDatetimeLocal = d => d.toISOString().slice(0, 16);

  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState(now.toISOString().slice(0, 10));
  const [scheduledStart, setScheduledStart] = useState(toDatetimeLocal(roundedStart));
  const [scheduledEnd, setScheduledEnd] = useState(toDatetimeLocal(roundedEnd));
  const [priority, setPriority] = useState(0);
  const [isAllDay, setIsAllDay] = useState(true);

  const handleSubmit = e => {
    e.preventDefault();
    if (!title.trim()) return;
    onCreate({
      title: title.trim(),
      dueDate: dueDate || null,
      scheduledStart: isAllDay ? null : scheduledStart,
      scheduledEnd: isAllDay ? null : scheduledEnd,
      priority: Number(priority),
      isAllDay: isAllDay ? 1 : 0,
      sourcePath: defaultNoteFilter || null,
    });
    onClose();
  };

  return (
    <OverlayDialog open={true} onClose={onClose} ariaLabel="Create task" cardClassName="task-modal-card">
      <div className="overlay-dialog-header">
        <h2>New Task</h2>
        <button className="icon-button" onClick={onClose} type="button" aria-label="Cancel"><X size={16} /></button>
      </div>
      <form onSubmit={handleSubmit} className="task-modal-form">
        <input
          className="task-modal-title-input"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Task title…"
          autoFocus
          required
        />
        <div className="task-modal-fields">
          <label>
            Due Date
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </label>
          <label>
            Priority
            <select value={priority} onChange={e => setPriority(e.target.value)}>
              {Object.entries(PRIORITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="task-modal-checkbox">
            <input type="checkbox" checked={isAllDay} onChange={e => setIsAllDay(e.target.checked)} />
            All day
          </label>
          {!isAllDay && (
            <>
              <label>Start<input type="datetime-local" value={scheduledStart} onChange={e => setScheduledStart(e.target.value)} /></label>
              <label>End<input type="datetime-local" value={scheduledEnd} onChange={e => setScheduledEnd(e.target.value)} /></label>
            </>
          )}
        </div>
        <div className="task-modal-actions">
          <button type="button" onClick={onClose} className="app-button secondary">Cancel</button>
          <button type="submit" className="app-button primary" disabled={!title.trim()}>
            <Plus size={14} /> Create Task
          </button>
        </div>
      </form>
    </OverlayDialog>
  );
}

export function TaskWorkspacePage({ onBack, onOpenNote, noteFilter = null }) {
  const ws = useTaskWorkspace({ noteFilter });
  const [showNewTask, setShowNewTask] = useState(false);
  const searchDebounceRef = useRef(null);

  const handleSearchChange = useCallback(value => {
    clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => ws.setSearch(value), 300);
  }, [ws]);

  return (
    <div className="task-workspace">
      {/* Sidebar */}
      <aside className="task-sidebar">
        <div className="task-sidebar-header">
          <button className="task-back-btn" type="button" onClick={onBack} aria-label="Back">
            <ArrowLeft size={16} />
          </button>
          <div>
            <span className="task-sidebar-title">Tasks</span>
            <span className="task-sidebar-subtitle">Markdown Notes Index</span>
          </div>
        </div>

        {noteFilter && (
          <div className="task-sidebar-context">
            <span>From: {noteFilter.split(/[/\\]/).pop()?.replace(/\.md$/i, "")}</span>
            <button type="button" onClick={() => { /* clear filter */ }} aria-label="Clear note filter">
              <X size={10} />
            </button>
          </div>
        )}

        <nav className="task-sidebar-nav" aria-label="Task views">
          {ws.views.map(v => {
            const meta = VIEW_META[v];
            const Icon = meta.Icon;
            return (
              <button
                key={v}
                type="button"
                className={`task-nav-item${ws.view === v ? " active" : ""}`}
                onClick={() => ws.setView(v)}
                aria-current={ws.view === v ? "page" : undefined}
              >
                <Icon size={14} />
                {meta.label}
              </button>
            );
          })}
        </nav>

        <div className="task-sidebar-footer">
          <button
            type="button"
            className="task-new-btn"
            onClick={() => setShowNewTask(true)}
          >
            <Plus size={14} /> New Task
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="task-main">
        {/* Toolbar */}
        <div className="task-toolbar">
          <div className="task-search-box">
            <Search size={14} />
            <input
              type="search"
              placeholder={`Search ${VIEW_META[ws.view]?.desc ?? "tasks"}…`}
              onChange={e => handleSearchChange(e.target.value)}
              aria-label="Search tasks"
            />
          </div>
          <div className="task-toolbar-right">
            <span className="task-truth-badge">
              <FileText size={11} /> Source of truth: Markdown Notes
            </span>
            <span className="task-count">{ws.tasks.length} task{ws.tasks.length !== 1 ? "s" : ""}</span>
          </div>
        </div>

        {/* Task list */}
        <div className="task-list-area" role="grid" aria-label="Task list">
          {ws.loading && <div className="task-list-loading"><div className="task-spinner" /></div>}
          {!ws.loading && ws.tasks.length === 0 && (
            <div className="task-list-empty">
              <ListChecks size={40} />
              <p>No tasks in this view.</p>
              <button type="button" className="app-button primary" onClick={() => setShowNewTask(true)}>
                <Plus size={14} /> Create a task
              </button>
            </div>
          )}
          {!ws.loading && ws.tasks.map(task => (
            <TaskRow
              key={task.id}
              task={task}
              isSelected={task.id === ws.selectedId}
              onSelect={ws.setSelectedId}
              onComplete={ws.handleComplete}
              onOpenNote={onOpenNote}
            />
          ))}
        </div>
      </div>

      {/* Detail panel */}
      {ws.selectedTask && (
        <TaskDetail
          task={ws.selectedTask}
          comments={ws.comments}
          commentsLoading={ws.commentsLoading}
          persons={ws.persons}
          onUpdate={ws.handleUpdate}
          onComplete={ws.handleComplete}
          onDelete={ws.handleDelete}
          onAddComment={ws.handleAddComment}
          onOpenNote={onOpenNote}
          onClose={() => ws.setSelectedId(null)}
        />
      )}

      {/* New task modal */}
      {showNewTask && (
        <NewTaskModal
          onCreate={ws.handleCreate}
          onClose={() => setShowNewTask(false)}
          defaultNoteFilter={noteFilter}
        />
      )}
    </div>
  );
}
