'use strict';

const { getTaskDatabase } = require('./TaskDatabase.cjs');
const { assertTrustedIpcSender } = require('../ipc/ipcSecurity.cjs');
const path = require('node:path');
const fs = require('node:fs');

// Parse open/closed task lines from markdown text
const OPEN_REGEX  = /^[ \t]*[-*+]?[ \t]*\[ \][ \t]+(.+)$/gm;
const DONE_REGEX  = /^[ \t]*[-*+]?[ \t]*\[(?:x|X)\][ \t]+(.+)$/gm;

function parseMarkdownTasks(content) {
  const tasks = [];
  const src = String(content || '');

  const tryRegex = (re, status) => {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src)) !== null) {
      const line = src.slice(0, m.index).split(/\r?\n/).length;
      const lineText = m[0].trim();
      tasks.push({ title: (m[1] || '').trim(), status, line, lineText });
    }
  };

  tryRegex(OPEN_REGEX, 'open');
  tryRegex(DONE_REGEX, 'done');
  return tasks.sort((a, b) => a.line - b.line);
}

/**
 * Recursively walk workspace root and sync all markdown tasks into TaskDatabase.
 */
function syncAllWorkspaceNotes(notesRoot, db) {
  if (!notesRoot || !fs.existsSync(notesRoot) || !db) return;
  try {
    const walk = (dir) => {
      let entries = [];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.markdown'))) {
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            const parsed = parseMarkdownTasks(content);
            db.syncFromNote(fullPath, parsed);
          } catch { /* ignore single file error */ }
        }
      }
    };
    walk(notesRoot);
  } catch (err) {
    console.error('[taskIpc] syncAllWorkspaceNotes error:', err.message);
  }
}

/**
 * Append a task line to a note file if not already present.
 */
function appendTaskToNote(filePath, title) {
  if (!filePath || !title) return null;
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    let content = '';
    if (fs.existsSync(filePath)) {
      content = fs.readFileSync(filePath, 'utf8');
    }
    const lines = content ? content.split(/\r?\n/) : [];
    const taskLineText = `- [ ] ${title.trim()}`;

    // Append newline if content doesn't end with one
    if (lines.length > 0 && lines[lines.length - 1] !== '') {
      lines.push('');
    }
    lines.push(taskLineText);
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    return { line: lines.length, lineText: taskLineText };
  } catch (err) {
    console.error('[taskIpc] appendTaskToNote failed:', err.message);
    return null;
  }
}

/**
 * Write [x] or [ ] back to a note file when a task is completed via the UI.
 */
function writeTaskStatusToNote(filePath, sourceLine, newStatus) {
  if (!filePath || !fs.existsSync(filePath)) return false;
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);
    const lineIdx = (sourceLine ?? 1) - 1;

    let updatedLine = null;
    let updatedIdx = lineIdx;

    if (lineIdx >= 0 && lineIdx < lines.length) {
      const line = lines[lineIdx];
      if (newStatus === 'done' && /\[[ ]\]/.test(line)) {
        updatedLine = line.replace(/\[[ ]\]/, '[x]');
      } else if (newStatus === 'open' && /\[[xX]\]/.test(line)) {
        updatedLine = line.replace(/\[[xX]\]/, '[ ]');
      }
    }

    // Fallback: search lines if exact line number didn't match
    if (!updatedLine) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (newStatus === 'done' && /\[[ ]\]/.test(line)) {
          updatedLine = line.replace(/\[[ ]\]/, '[x]');
          updatedIdx = i;
          break;
        } else if (newStatus === 'open' && /\[[xX]\]/.test(line)) {
          updatedLine = line.replace(/\[[xX]\]/, '[ ]');
          updatedIdx = i;
          break;
        }
      }
    }

    if (!updatedLine || updatedIdx < 0) return false;

    lines[updatedIdx] = updatedLine;
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    return true;
  } catch (err) {
    console.error('[taskIpc] writeTaskStatusToNote failed:', err.message);
    return false;
  }
}

/**
 * Cross-workspace persons cache stored in appData/persons.json for auto-tagging suggestions.
 */
function loadAppDataPersons(appDataDir) {
  const p = path.join(appDataDir, 'persons.json');
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return []; }
}

function saveAppDataPersons(appDataDir, persons) {
  try {
    const p = path.join(appDataDir, 'persons.json');
    fs.writeFileSync(p, JSON.stringify(persons, null, 2), 'utf8');
  } catch { /* ignore */ }
}

function registerTaskIpc(ipcMain, deps) {
  const { BrowserWindow, getNotesRoot, getActiveProject, getMetadataStore, getAppDataDir } = deps;

  function trusted(channel, handler) {
    ipcMain.handle(channel, (event, payload) => {
      assertTrustedIpcSender(BrowserWindow, event, channel);
      return handler(event, payload);
    });
  }

  function getRoot() {
    const project = getActiveProject?.();
    return project?.rootPath || getNotesRoot?.() || '';
  }

  function getDb() {
    const root = getRoot();
    return getTaskDatabase(root);
  }

  // ── Sync ──────────────────────────────────────────────────────────────────

  trusted('tasks:sync-from-note', (_event, { filePath, content }) => {
    const db = getDb();
    if (!db) return { inserted: 0, updated: 0 };
    const parsed = parseMarkdownTasks(content);
    return db.syncFromNote(filePath, parsed);
  });

  trusted('tasks:sync-all', (_event) => {
    const db = getDb();
    const root = getRoot();
    if (!db || !root) return false;
    syncAllWorkspaceNotes(root, db);
    return true;
  });

  // ── CRUD ──────────────────────────────────────────────────────────────────

  trusted('tasks:list', (_event, filters = {}) => {
    const db = getDb();
    const root = getRoot();
    if (db && root) {
      // Auto-scan workspace markdown notes on list query so all notes' tasks are up-to-date
      syncAllWorkspaceNotes(root, db);
    }
    return db ? db.listTasks(filters) : [];
  });

  trusted('tasks:get', (_event, { id }) => {
    const db = getDb();
    return db ? db.getTask(id) : null;
  });

  trusted('tasks:create', (_event, payload) => {
    const db = getDb();
    const root = getRoot();
    if (!db) return null;

    let targetFile = payload.sourcePath;
    if (!targetFile && root) {
      targetFile = path.join(root, 'Tasks.md');
    }

    let appendedLine = null;
    if (targetFile && payload.title) {
      appendedLine = appendTaskToNote(targetFile, payload.title);
    }

    const task = db.createTask({
      ...payload,
      sourcePath: targetFile || null,
      sourceLine: appendedLine?.line || null,
    });

    return task;
  });

  trusted('tasks:update', (_event, { id, ...fields }) => {
    const db = getDb();
    return db ? db.updateTask(id, fields) : null;
  });

  trusted('tasks:complete', (_event, { id, status = 'done' }) => {
    const db = getDb();
    if (!db) return null;

    const task = db.getTask(id);
    if (!task) return null;

    const updated = db.updateTask(id, { status });

    // Two-way sync: write back to source note
    if (task.source_path) {
      writeTaskStatusToNote(task.source_path, task.source_line, status);
    }

    return updated;
  });

  trusted('tasks:delete', (_event, { id }) => {
    const db = getDb();
    return db ? db.deleteTask(id) : false;
  });

  trusted('tasks:get-overdue', () => {
    const db = getDb();
    const root = getRoot();
    if (db && root) {
      syncAllWorkspaceNotes(root, db);
    }
    return db ? db.getOverdueTasks() : [];
  });

  // ── Comments ──────────────────────────────────────────────────────────────

  const handleAddComment = (_event, { taskId, body, author }) => {
    const db = getDb();
    return db ? db.addComment(taskId, { body, author }) : null;
  };

  const handleGetComments = (_event, { taskId }) => {
    const db = getDb();
    return db ? db.getComments(taskId) : [];
  };

  trusted('tasks:add-comment', handleAddComment);
  trusted('tasks:get-comments', handleGetComments);
  trusted('tasks:comments:add', handleAddComment);
  trusted('tasks:comments:list', handleGetComments);

  // ── Persons ───────────────────────────────────────────────────────────────

  trusted('persons:list', (_event) => {
    const db = getDb();
    const workspacePersons = db ? db.listPersons() : [];
    const appDataPersons = loadAppDataPersons(getAppDataDir?.() || '');

    // Merge by id/name
    const map = new Map();
    for (const p of appDataPersons) map.set(p.name.toLowerCase(), p);
    for (const p of workspacePersons) map.set(p.name.toLowerCase(), p);
    return Array.from(map.values());
  });

  trusted('persons:upsert', (_event, payload) => {
    const db = getDb();
    const person = db ? db.upsertPerson(payload) : null;

    // Cache in appData
    if (person && getAppDataDir?.()) {
      const all = loadAppDataPersons(getAppDataDir());
      const idx = all.findIndex(p => p.id === person.id || p.name.toLowerCase() === person.name.toLowerCase());
      if (idx !== -1) all[idx] = person;
      else all.push(person);
      saveAppDataPersons(getAppDataDir(), all);
    }

    return person;
  });

  trusted('persons:delete', (_event, { id }) => {
    const db = getDb();
    return db ? db.deletePerson(id) : false;
  });

  // ── Calendar ──────────────────────────────────────────────────────────────

  trusted('calendar:get-events', (_event, { startDate, endDate, types = [] } = {}) => {
    const db = getDb();
    const root = getRoot();
    const events = [];

    if (db && root) {
      // Sync notes first so calendar events match all workspace markdown notes
      syncAllWorkspaceNotes(root, db);

      // Task events
      const taskEvents = db.getCalendarTaskEvents(startDate, endDate);
      for (const t of taskEvents) {
        if (!types.length || types.includes(t._eventType)) {
          events.push({
            id: `task-${t.id}`,
            title: t.title,
            start: t.scheduled_start || t.due_date || t.completed_at,
            end: t.scheduled_end || t.due_date || t.completed_at,
            allDay: Boolean(t.isAllDay),
            type: t._eventType,
            taskId: t.id,
            sourcePath: t.source_path,
            priority: t.priority,
            status: t.status,
          });
        }
      }
    }

    // Note events from metadataStore
    try {
      const store = getMetadataStore?.();
      if (store) {
        const notes = store.listNotes?.() || [];
        for (const n of notes) {
          const createdStr = n.created_at || n.createdAt;
          const updatedStr = n.updated_at || n.updatedAt;

          if (createdStr && createdStr.slice(0, 10) >= startDate && createdStr.slice(0, 10) <= endDate) {
            if (!types.length || types.includes('note-created')) {
              events.push({
                id: `note-created-${n.path}`,
                title: `Created: ${n.title || path.basename(n.path, '.md')}`,
                start: createdStr,
                end: createdStr,
                allDay: true,
                type: 'note-created',
                sourcePath: n.path,
              });
            }
          }

          if (updatedStr && updatedStr.slice(0, 10) >= startDate && updatedStr.slice(0, 10) <= endDate) {
            if (!types.length || types.includes('note-updated')) {
              events.push({
                id: `note-updated-${n.path}`,
                title: `Updated: ${n.title || path.basename(n.path, '.md')}`,
                start: updatedStr,
                end: updatedStr,
                allDay: true,
                type: 'note-updated',
                sourcePath: n.path,
              });
            }
          }
        }
      }
    } catch (err) {
      console.error('[taskIpc] calendar note events failed:', err.message);
    }

    return events;
  });
}

module.exports = { registerTaskIpc, parseMarkdownTasks, writeTaskStatusToNote };
