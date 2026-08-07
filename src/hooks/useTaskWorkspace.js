import { useState, useEffect, useCallback, useRef } from "react";
import {
  listTasks,
  createTask,
  updateTask,
  completeTask,
  deleteTask,
  addTaskComment,
  getTaskComments,
  listPersons,
  upsertPerson,
} from "../services/electronService";

const VIEWS = ["today", "upcoming", "overdue", "done", "all"];

function getStatusFilter(view) {
  if (view === "today") return "today";
  if (view === "upcoming") return "upcoming";
  if (view === "overdue") return "overdue";
  if (view === "done") return "done";
  return "all";
}

export function useTaskWorkspace({ noteFilter = null } = {}) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [persons, setPersons] = useState({ persons: [], suggestions: [] });
  const [error, setError] = useState(null);

  const searchRef = useRef(search);
  searchRef.current = search;

  // ── Load tasks ─────────────────────────────────────────────────────────────

  const loadTasks = useCallback(async (currentView, currentSearch, currentNoteFilter) => {
    setLoading(true);
    setError(null);
    try {
      const filters = {
        status: getStatusFilter(currentView),
        search: currentSearch || undefined,
        noteFilter: currentNoteFilter || undefined,
        limit: 500,
      };
      const result = await listTasks(filters);
      setTasks(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(err.message);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTasks(view, search, noteFilter);
  }, [view, search, noteFilter, loadTasks]);

  // ── Load persons ───────────────────────────────────────────────────────────

  useEffect(() => {
    listPersons().then(setPersons).catch(() => {});
  }, []);

  // ── Load comments ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!selectedId) { setComments([]); return; }
    setCommentsLoading(true);
    getTaskComments(selectedId)
      .then(setComments)
      .catch(() => setComments([]))
      .finally(() => setCommentsLoading(false));
  }, [selectedId]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleCreate = useCallback(async (fields) => {
    const task = await createTask(fields);
    if (task) {
      setTasks(prev => [task, ...prev]);
      setSelectedId(task.id);
    }
    return task;
  }, []);

  const handleUpdate = useCallback(async (id, fields) => {
    const updated = await updateTask(id, fields);
    if (updated) {
      setTasks(prev => prev.map(t => t.id === id ? updated : t));
      if (selectedId === id) {
        // no-op, the selected panel will re-read from tasks
      }
    }
    return updated;
  }, [selectedId]);

  const handleComplete = useCallback(async (id, status = "done") => {
    const updated = await completeTask(id, status);
    if (updated) {
      setTasks(prev => {
        const next = prev.map(t => t.id === id ? updated : t);
        // Remove from current view if it no longer matches
        return next;
      });
      if (selectedId === id) setSelectedId(null);
    }
    return updated;
  }, [selectedId]);

  const handleDelete = useCallback(async (id) => {
    await deleteTask(id);
    setTasks(prev => prev.filter(t => t.id !== id));
    if (selectedId === id) setSelectedId(null);
  }, [selectedId]);

  const handleAddComment = useCallback(async (taskId, body, author = "me") => {
    const comment = await addTaskComment(taskId, body, author);
    if (comment) setComments(prev => [...prev, comment]);
    return comment;
  }, []);

  const handleUpsertPerson = useCallback(async (payload) => {
    const result = await upsertPerson(payload);
    if (result) {
      setPersons(prev => ({
        ...prev,
        persons: prev.persons.find(p => p.id === result.id)
          ? prev.persons.map(p => p.id === result.id ? result : p)
          : [result, ...prev.persons],
      }));
    }
    return result;
  }, []);

  const refresh = useCallback(() => {
    void loadTasks(view, search, noteFilter);
  }, [view, search, noteFilter, loadTasks]);

  const selectedTask = tasks.find(t => t.id === selectedId) ?? null;

  return {
    // State
    tasks,
    loading,
    view,
    search,
    selectedId,
    selectedTask,
    comments,
    commentsLoading,
    persons,
    error,
    views: VIEWS,
    // Actions
    setView,
    setSearch,
    setSelectedId,
    handleCreate,
    handleUpdate,
    handleComplete,
    handleDelete,
    handleAddComment,
    handleUpsertPerson,
    refresh,
  };
}
