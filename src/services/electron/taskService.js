import { getNotesApi } from "./base";

export async function syncTasksFromNote(payload) {
  if (typeof window === "undefined" || !window.notesApi) return { inserted: 0, updated: 0 };
  const api = getNotesApi();
  if (typeof api?.syncTasksFromNote !== 'function') return { inserted: 0, updated: 0 };
  return api.syncTasksFromNote(payload);
}

export async function listTasks(filters = {}) {
  const api = getNotesApi();
  if (typeof api.listTasks !== 'function') return [];
  return api.listTasks(filters);
}

export async function getTask(id) {
  const api = getNotesApi();
  if (typeof api.getTask !== 'function') return null;
  return api.getTask({ id });
}

export async function createTask(payload) {
  const api = getNotesApi();
  if (typeof api.createTask !== 'function') return null;
  return api.createTask(payload);
}

export async function updateTask(id, fields) {
  const api = getNotesApi();
  if (typeof api.updateTask !== 'function') return null;
  return api.updateTask({ id, ...fields });
}

export async function completeTask(id, status = 'done') {
  const api = getNotesApi();
  if (typeof api.completeTask !== 'function') return null;
  return api.completeTask({ id, status });
}

export async function deleteTask(id) {
  const api = getNotesApi();
  if (typeof api.deleteTask !== 'function') return false;
  return api.deleteTask({ id });
}

export async function addTaskComment(taskId, body, author = 'me') {
  const api = getNotesApi();
  if (typeof api.addTaskComment !== 'function') return null;
  return api.addTaskComment({ taskId, body, author });
}

export async function getTaskComments(taskId) {
  const api = getNotesApi();
  if (typeof api.getTaskComments !== 'function') return [];
  return api.getTaskComments({ taskId });
}

export async function getCalendarEvents(startDate, endDate) {
  const api = getNotesApi();
  if (typeof api.getCalendarEvents !== 'function') return { taskEvents: [], noteEvents: [] };
  return api.getCalendarEvents({ startDate, endDate });
}

export async function listPersons() {
  const api = getNotesApi();
  if (typeof api.listPersons !== 'function') return { persons: [], suggestions: [] };
  return api.listPersons();
}

export async function upsertPerson(payload) {
  const api = getNotesApi();
  if (typeof api.upsertPerson !== 'function') return null;
  return api.upsertPerson(payload);
}

export async function deletePerson(id) {
  const api = getNotesApi();
  if (typeof api.deletePerson !== 'function') return false;
  return api.deletePerson({ id });
}

