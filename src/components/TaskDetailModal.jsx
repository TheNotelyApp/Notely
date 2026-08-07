import { useState, useRef, useEffect, useCallback } from "react";
import {
  CheckCircle2, Circle, Clock, ChevronRight,
  MessageSquare, User, Edit3, Check, X, Flag,
  AlarmClock
} from "lucide-react";
import { OverlayDialog } from "./OverlayDialog";
import AppButton from "./AppButton";
import AppSelect from "./AppSelect";
import {
  listTasks,
  getTask,
  createTask,
  updateTask,
  getTaskComments,
  addTaskComment,
  listPersons,
  syncTasksFromNote,
} from "../services/electronService";
import "../styles/TaskWorkspacePage.css";

const PRIORITY_LABELS = { 0: "None", 1: "Low", 2: "Medium", 3: "High" };
const PRIORITY_COLORS = { 0: "none", 1: "low", 2: "medium", 3: "high" };

export function TaskDetailModal({
  open,
  onClose,
  taskInfo,
  _onOpenNote,
  onNotify,
  onTaskUpdated,
}) {
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);

  const [titleDraft, setTitleDraft] = useState("");
  const [descDraft, setDescDraft] = useState("");
  const [statusDraft, setStatusDraft] = useState("open");
  const [dueDateDraft, setDueDateDraft] = useState("");
  const [scheduledStartDraft, setScheduledStartDraft] = useState("");
  const [scheduledEndDraft, setScheduledEndDraft] = useState("");
  const [priorityDraft, setPriorityDraft] = useState(0);
  const [personTagsDraft, setPersonTagsDraft] = useState([]);

  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [persons, setPersons] = useState({ persons: [], suggestions: [] });

  const titleRef = useRef(null);

  // Initialize or fetch task record
  const loadTaskData = useCallback(async () => {
    if (!taskInfo) {
      setTask(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Sync active note content into TaskDatabase first so DB is 100% up-to-date
      if (taskInfo.filePath && typeof taskInfo.noteContent === "string") {
        try {
          await syncTasksFromNote({ filePath: taskInfo.filePath, content: taskInfo.noteContent });
        } catch (syncErr) {
          console.warn("[TaskDetailModal] Pre-sync note tasks warning:", syncErr);
        }
      }

      let resolvedTask = null;

      // 1. If explicit task ID passed, fetch directly
      if (taskInfo.id) {
        resolvedTask = await getTask(taskInfo.id);
      }

      // 2. Search by sourcePath + title or line
      if (!resolvedTask && taskInfo.filePath) {
        const matches = await listTasks({
          noteFilter: taskInfo.filePath,
          search: taskInfo.title || undefined,
          limit: 10,
        });

        if (Array.isArray(matches) && matches.length > 0) {
          resolvedTask = matches.find(
            (t) =>
              t.title.trim().toLowerCase() === (taskInfo.title || "").trim().toLowerCase()
          ) || matches[0];
        }
      }

      // 3. Fallback search by title
      if (!resolvedTask && taskInfo.title) {
        const matches = await listTasks({
          search: taskInfo.title,
          limit: 5,
        });
        if (Array.isArray(matches) && matches.length > 0) {
          resolvedTask = matches[0];
        }
      }

      // 4. Create task in DB if not found
      if (!resolvedTask && taskInfo.title) {
        resolvedTask = await createTask({
          title: taskInfo.title,
          status: taskInfo.status || "open",
          sourcePath: taskInfo.filePath || "none",
          sourceLine: taskInfo.sourceLine || null,
        });
      }

      if (!resolvedTask) {
        resolvedTask = {
          id: `temp-${Date.now()}`,
          title: taskInfo.title || "Untitled Task",
          status: taskInfo.status || "open",
          description: "",
          due_date: null,
          scheduled_start: null,
          scheduled_end: null,
          priority: 0,
          personTags: [],
          source_path: taskInfo.filePath || null,
          source_line: taskInfo.sourceLine || null,
        };
      }

      setTask(resolvedTask);
      setTitleDraft(resolvedTask.title || "");
      setDescDraft(resolvedTask.description || "");
      setStatusDraft(resolvedTask.status || "open");
      setDueDateDraft(resolvedTask.due_date || "");
      setScheduledStartDraft(
        resolvedTask.scheduled_start ? resolvedTask.scheduled_start.slice(0, 16) : ""
      );
      setScheduledEndDraft(
        resolvedTask.scheduled_end ? resolvedTask.scheduled_end.slice(0, 16) : ""
      );
      setPriorityDraft(resolvedTask.priority ?? 0);
      setPersonTagsDraft(resolvedTask.personTags || []);

      // Load comments & persons
      if (resolvedTask.id && !resolvedTask.id.startsWith("temp-")) {
        setCommentsLoading(true);
        getTaskComments(resolvedTask.id)
          .then(setComments)
          .catch(() => setComments([]))
          .finally(() => setCommentsLoading(false));
      } else {
        setComments([]);
      }

      listPersons().then(setPersons).catch(() => {});

    } catch (err) {
      console.error("[TaskDetailModal] Error loading task:", err);
      onNotify?.("Unable to load task details", "error");
    } finally {
      setLoading(false);
    }
  }, [taskInfo, onNotify]);

  useEffect(() => {
    if (open && taskInfo) {
      void loadTaskData();
    } else {
      setTask(null);
      setLoading(false);
    }
  }, [open, taskInfo, loadTaskData]);

  if (!open) return null;

  const isDirty = Boolean(
    task &&
      (titleDraft.trim() !== (task.title || "") ||
        descDraft !== (task.description || "") ||
        statusDraft !== (task.status || "open") ||
        dueDateDraft !== (task.due_date || "") ||
        (scheduledStartDraft || "") !==
          (task.scheduled_start ? task.scheduled_start.slice(0, 16) : "") ||
        (scheduledEndDraft || "") !==
          (task.scheduled_end ? task.scheduled_end.slice(0, 16) : "") ||
        Number(priorityDraft) !== (task.priority ?? 0) ||
        JSON.stringify(personTagsDraft) !== JSON.stringify(task.personTags || []))
  );

  const handleSave = async () => {
    if (!task) return;
    try {
      const updates = {
        title: titleDraft.trim() || "Untitled",
        description: descDraft,
        status: statusDraft,
        dueDate: dueDateDraft || null,
        scheduledStart: scheduledStartDraft || null,
        scheduledEnd: scheduledEndDraft || null,
        priority: Number(priorityDraft),
        personTags: personTagsDraft,
      };

      let updatedTask = task;
      if (task.id && !task.id.startsWith("temp-")) {
        updatedTask = await updateTask(task.id, updates);
      } else {
        updatedTask = await createTask({
          ...updates,
          sourcePath: task.source_path || "none",
          sourceLine: task.source_line || null,
        });
      }

      if (updatedTask) {
        setTask(updatedTask);
        onNotify?.("Task saved successfully", "success");
        onTaskUpdated?.(updatedTask);
      }
    } catch (err) {
      console.error("[TaskDetailModal] Save error:", err);
      onNotify?.("Failed to save task", "error");
    }
  };

  const submitComment = async (e) => {
    e.preventDefault();
    if (!commentDraft.trim() || !task || !task.id) return;
    try {
      let activeId = task.id;
      if (activeId.startsWith("temp-")) {
        const created = await createTask({
          title: titleDraft.trim() || "Untitled",
          status: statusDraft,
          sourcePath: task.source_path || "none",
        });
        if (created) {
          activeId = created.id;
          setTask(created);
        }
      }
      const newComment = await addTaskComment(activeId, commentDraft.trim());
      if (newComment) {
        setComments((prev) => [...prev, newComment]);
        setCommentDraft("");
      }
    } catch (err) {
      console.error("[TaskDetailModal] Comment error:", err);
    }
  };

  const isOverdue =
    dueDateDraft &&
    statusDraft !== "done" &&
    dueDateDraft < new Date().toISOString().slice(0, 10);

  return (
    <OverlayDialog
      open={open}
      onClose={onClose}
      ariaLabel="Task details"
      cardClassName="task-detail-modal-card"
    >
      {loading ? (
        <div className="task-list-loading" style={{ padding: "40px 0" }}>
          <div className="task-spinner" />
          <span style={{ fontSize: "12px", color: "var(--text-subtle)", marginTop: "8px" }}>
            Loading task details…
          </span>
        </div>
      ) : task ? (
        <div className="task-detail task-modal-detail-pane">
          {/* Header */}
          <div className="task-detail-header">
            <div className="task-detail-title-col">
              {editingTitle ? (
                <input
                  ref={titleRef}
                  className="task-detail-title-input"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={() => setEditingTitle(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "Escape") setEditingTitle(false);
                  }}
                  autoFocus
                />
              ) : (
                <h2 className="task-detail-title" onClick={() => setEditingTitle(true)}>
                  {titleDraft || "Untitled"}
                  <Edit3 size={12} className="task-detail-edit-hint" />
                </h2>
              )}
            </div>

            {/* Inline Header Actions */}
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
              <button
                type="button"
                className="task-detail-close icon-button"
                onClick={onClose}
                aria-label="Close modal"
                style={{ marginLeft: "4px" }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="task-detail-scroll-content">
            {/* Meta Fields */}
            <div className="task-detail-fields">
              {/* Status */}
              <div className="task-field-row">
                <label className="task-field-label">
                  <CheckCircle2 size={12} /> Status
                </label>
                <div className="task-status-selector" role="radiogroup" aria-label="Task status">
                  <button
                    type="button"
                    className={`task-status-btn status-open${
                      statusDraft === "open" ? " active" : ""
                    }`}
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
                    className={`task-status-btn status-in-progress${
                      statusDraft === "in_progress" ? " active" : ""
                    }`}
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
                    className={`task-status-btn status-done${
                      statusDraft === "done" ? " active" : ""
                    }`}
                    onClick={() => setStatusDraft("done")}
                    role="radio"
                    aria-checked={statusDraft === "done"}
                  >
                    <CheckCircle2 size={12} />
                    <span>Completed</span>
                  </button>
                </div>
              </div>

              {/* Due Date */}
              <div className="task-field-row">
                <label className="task-field-label">
                  <Clock size={12} /> Due Date
                </label>
                <input
                  type="date"
                  className={`task-field-input${isOverdue ? " overdue" : ""}`}
                  value={dueDateDraft}
                  onChange={(e) => setDueDateDraft(e.target.value)}
                />
              </div>

              {/* Schedule */}
              <div className="task-field-row task-schedule-grid-row">
                <label className="task-field-label">
                  <AlarmClock size={12} /> Schedule
                </label>
                <div className="task-schedule-inputs-grid">
                  <div className="task-schedule-col">
                    <span className="task-sublabel">Start</span>
                    <input
                      type="datetime-local"
                      className="task-field-input"
                      value={scheduledStartDraft}
                      onChange={(e) => setScheduledStartDraft(e.target.value)}
                    />
                  </div>
                  <div className="task-schedule-col">
                    <span className="task-sublabel">End</span>
                    <input
                      type="datetime-local"
                      className="task-field-input"
                      value={scheduledEndDraft}
                      onChange={(e) => setScheduledEndDraft(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Priority */}
              <div className="task-field-row">
                <label className="task-field-label">
                  <Flag size={12} /> Priority
                </label>
                <div className="task-priority-selector" role="radiogroup" aria-label="Priority level">
                  {Object.entries(PRIORITY_LABELS).map(([val, label]) => {
                    const numVal = Number(val);
                    const isSelected = Number(priorityDraft) === numVal;
                    const cls = PRIORITY_COLORS[numVal] ?? "none";
                    return (
                      <button
                        key={val}
                        type="button"
                        className={`task-priority-btn priority-${cls}${
                          isSelected ? " active" : ""
                        }`}
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

              {/* Assignees */}
              <div className="task-field-row">
                <label className="task-field-label">
                  <User size={12} /> Assignees
                </label>
                <div className="task-field-tags">
                  {personTagsDraft.map((pid) => {
                    const person = (persons.persons || []).find((p) => p.id === pid);
                    return person ? (
                      <span key={pid} className="task-person-tag">
                        {person.name}
                        <button
                          type="button"
                          onClick={() =>
                            setPersonTagsDraft((prev) => prev.filter((id) => id !== pid))
                          }
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ) : null;
                  })}
                  <AppSelect
                    className="task-field-select task-person-add"
                    value=""
                    onChange={(e) => {
                      if (!e.target.value) return;
                      setPersonTagsDraft((prev) => [
                        ...new Set([...prev, e.target.value]),
                      ]);
                    }}
                  >
                    <option value="">+ Add person</option>
                    {(persons.persons || []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
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
                onChange={(e) => setDescDraft(e.target.value)}
                placeholder="Add a description…"
                rows={4}
              />
            </div>
          </div>

          {/* Comments */}
          <div className="task-detail-section task-comments-section">
            <h4 className="task-detail-section-title">
              <MessageSquare size={12} /> Comments
            </h4>
            <div className="task-comments-list">
              {commentsLoading && <p className="task-comments-loading">Loading…</p>}
              {!commentsLoading && comments.length === 0 && (
                <p className="task-comments-empty">No comments yet.</p>
              )}
              {comments.map((c) => (
                <div key={c.id} className="task-comment">
                  <div className="task-comment-header">
                    <span className="task-comment-author">{c.author}</span>
                    <span className="task-comment-time">
                      {c.createdAt ? new Date(c.createdAt).toLocaleString() : ""}
                    </span>
                  </div>
                  <p className="task-comment-body">{c.body}</p>
                </div>
              ))}
            </div>
            <form className="task-comment-form" onSubmit={submitComment}>
              <textarea
                className="task-comment-input"
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                placeholder="Add a comment…"
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitComment(e);
                }}
              />
              <AppButton
                type="submit"
                variant="small"
                className="task-comment-submit primary-button"
                disabled={!commentDraft.trim()}
              >
                <Check size={12} /> Post
              </AppButton>
            </form>
          </div>
        </div>
      ) : null}
    </OverlayDialog>
  );
}
