const { getTaskDatabase } = require('./TaskDatabase.cjs');
const { assertTrustedIpcSender } = require('../ipc/ipcSecurity.cjs');
const { shouldHideDirectory, shouldHideFile } = require('../core/workspaceIgnorePolicy.cjs');
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
      const rawTitle = (m[1] || '').trim();

      let priority = 0;
      if (/#p1\b/i.test(rawTitle) || /#urgent\b/i.test(rawTitle)) priority = 3;
      else if (/#p2\b/i.test(rawTitle) || /#high\b/i.test(rawTitle)) priority = 2;
      else if (/#p3\b/i.test(rawTitle) || /#medium\b/i.test(rawTitle)) priority = 1;

      let dueDate = null;
      let scheduledStart = null;
      let scheduledEnd = null;
      let isAllDay = 1;
      let completedAt = null;

      const dueMatch = rawTitle.match(/@due\(([^)]+)\)/i) || rawTitle.match(/\bdue:([0-9T:\- ]+)/i);
      if (dueMatch) {
        const val = dueMatch[1].trim();
        dueDate = val.slice(0, 10);
        if (val.length > 10) {
          scheduledStart = val;
          isAllDay = 0;
        }
      }

      const schedMatch = rawTitle.match(/@sched(?:ule|uled)?\(([^)]+)\)/i) || rawTitle.match(/\bsched(?:ule|uled)?:([0-9T:\- ]+)/i);
      if (schedMatch) {
        const val = schedMatch[1].trim();
        scheduledStart = val;
        if (!dueDate) dueDate = val.slice(0, 10);
        if (val.length > 10) isAllDay = 0;
      }

      const startMatch = rawTitle.match(/@start\(([^)]+)\)/i);
      if (startMatch) {
        scheduledStart = startMatch[1].trim();
        if (scheduledStart.length > 10) isAllDay = 0;
      }

      const endMatch = rawTitle.match(/@end\(([^)]+)\)/i);
      if (endMatch) {
        scheduledEnd = endMatch[1].trim();
      }

      const doneMatch = rawTitle.match(/@(?:completed|done)\(([^)]+)\)/i);
      if (doneMatch) {
        completedAt = doneMatch[1].trim();
      }

      tasks.push({
        title: rawTitle,
        status,
        line,
        lineText,
        priority,
        due_date: dueDate,
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd,
        is_all_day: isAllDay,
        completed_at: completedAt,
      });
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
        if (shouldHideDirectory(entry.name)) continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.markdown'))) {
          if (shouldHideFile(entry.name, fullPath)) continue;
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
function writeTaskStatusToNote(filePath, sourceLine, newStatus, taskTitle) {
  if (!filePath || !fs.existsSync(filePath)) return false;
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);
    const lineIdx = (sourceLine ?? 1) - 1;

    let updatedLine = null;
    let updatedIdx = -1;

    // 1. Check exact line number
    if (lineIdx >= 0 && lineIdx < lines.length) {
      const line = lines[lineIdx];
      if (newStatus === 'done' && /\[[ ]\]/.test(line)) {
        updatedLine = line.replace(/\[[ ]\]/, '[x]');
        updatedIdx = lineIdx;
      } else if ((newStatus === 'open' || newStatus === 'in_progress') && /\[[xX]\]/.test(line)) {
        updatedLine = line.replace(/\[[xX]\]/, '[ ]');
        updatedIdx = lineIdx;
      }
    }

    // 2. Fallback: Search lines for task title match
    if (updatedIdx < 0 && taskTitle) {
      const cleanTitle = String(taskTitle).trim().toLowerCase();
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.toLowerCase().includes(cleanTitle)) {
          if (newStatus === 'done' && /\[[ ]\]/.test(line)) {
            updatedLine = line.replace(/\[[ ]\]/, '[x]');
            updatedIdx = i;
            break;
          } else if ((newStatus === 'open' || newStatus === 'in_progress') && /\[[xX]\]/.test(line)) {
            updatedLine = line.replace(/\[[xX]\]/, '[ ]');
            updatedIdx = i;
            break;
          }
        }
      }
    }

    if (updatedIdx < 0 || !updatedLine) return false;

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
  const { BrowserWindow, getNotesRoot, getActiveProject, getAppDataDir } = deps;

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
    if (payload.standalone || payload.sourcePath === "none") {
      targetFile = null;
    } else if (!targetFile && root) {
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
    if (!db) return null;
    const task = db.getTask(id);
    if (!task) return null;
    const updated = db.updateTask(id, fields);
    if (fields.status && task.source_path) {
      writeTaskStatusToNote(task.source_path, task.source_line, fields.status, task.title);
    }
    return updated;
  });

  trusted('tasks:complete', (_event, { id, status = 'done' }) => {
    const db = getDb();
    if (!db) return null;

    const task = db.getTask(id);
    if (!task) return null;

    const updated = db.updateTask(id, { status });

    // Two-way sync: write back to source note
    if (task.source_path) {
      writeTaskStatusToNote(task.source_path, task.source_line, status, task.title);
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

  // Helper to format Date or ISO string into local YYYY-MM-DD
  function toLocalDateStr(val) {
    if (!val) return '';
    const d = new Date(val);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // Extract note frontmatter and fs creation/update timestamps
  function extractNoteDates(filePath, content, stat) {
    let createdIso = null;
    let updatedIso = null;
    let createdIsAllDay = false;
    let updatedIsAllDay = false;

    if (content) {
      const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (fmMatch) {
        const fm = fmMatch[1];
        const createdMatch = fm.match(/(?:created|createdAt|created_at|date|publishedAt):\s*["']?([^"'\r\n]+)["']?/i);
        if (createdMatch) {
          const raw = createdMatch[1].trim();
          const d = new Date(raw);
          if (!isNaN(d.getTime())) {
            createdIso = d.toISOString();
            if (!raw.includes(':') && !raw.includes('T')) createdIsAllDay = true;
          }
        }
        const updatedMatch = fm.match(/(?:updated|updatedAt|updated_at|modified|lastModified):\s*["']?([^"'\r\n]+)["']?/i);
        if (updatedMatch) {
          const raw = updatedMatch[1].trim();
          const d = new Date(raw);
          if (!isNaN(d.getTime())) {
            updatedIso = d.toISOString();
            if (!raw.includes(':') && !raw.includes('T')) updatedIsAllDay = true;
          }
        }
      }
    }

    if (!createdIso && stat) {
      const btime = stat.birthtime && !isNaN(stat.birthtime.getTime()) && stat.birthtime.getTime() > 0 ? stat.birthtime : stat.ctime;
      if (btime && !isNaN(btime.getTime())) {
        createdIso = btime.toISOString();
      }
    }

    if (!updatedIso && stat && stat.mtime && !isNaN(stat.mtime.getTime())) {
      updatedIso = stat.mtime.toISOString();
    }

    return { createdIso, updatedIso, createdIsAllDay, updatedIsAllDay };
  }

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
        const eventType = t._eventType || t.type || 'task-due';
        if (!types.length || types.includes(eventType)) {
          events.push({
            id: t.id || `task-${t.taskId || Math.random()}`,
            title: t.title,
            start: t.start || t.scheduled_start || t.due_date || t.completed_at,
            end: t.end || t.scheduled_end || t.start || t.due_date,
            allDay: Boolean(t.allDay ?? t.isAllDay),
            type: eventType,
            _eventType: eventType,
            taskId: t.taskId || t.id,
            sourcePath: t.source_path || t.sourcePath,
            priority: t.priority,
            status: t.status,
          });
        }
      }
    }

    // Note events directly from workspace filesystem notes
    if (root) {
      try {
        const walkNotes = (dir) => {
          let entries = [];
          try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
          for (const entry of entries) {
            if (shouldHideDirectory(entry.name)) continue;
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              walkNotes(fullPath);
            } else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.markdown'))) {
              if (shouldHideFile(entry.name, fullPath)) continue;
              try {
                const stat = fs.statSync(fullPath);
                let content = '';
                try { content = fs.readFileSync(fullPath, 'utf8'); } catch { /* ignore */ }
                const title = entry.name.replace(/\.md$/i, '');
                const noteDates = extractNoteDates(fullPath, content, stat);

                const createdDate = toLocalDateStr(noteDates.createdIso);
                const updatedDate = toLocalDateStr(noteDates.updatedIso);

                if (createdDate && (!startDate || createdDate >= startDate) && (!endDate || createdDate <= endDate)) {
                  if (!types.length || types.includes('note-created')) {
                    events.push({
                      id: `note-created-${fullPath}`,
                      title: `Created: ${title}`,
                      start: noteDates.createdIso,
                      end: noteDates.createdIso,
                      allDay: noteDates.createdIsAllDay,
                      type: 'note-created',
                      _eventType: 'note-created',
                      sourcePath: fullPath,
                      filePath: fullPath,
                    });
                  }
                }

                if (updatedDate && (!startDate || updatedDate >= startDate) && (!endDate || updatedDate <= endDate)) {
                  if (!types.length || types.includes('note-updated')) {
                    events.push({
                      id: `note-updated-${fullPath}`,
                      title: `Updated: ${title}`,
                      start: noteDates.updatedIso,
                      end: noteDates.updatedIso,
                      allDay: noteDates.updatedIsAllDay,
                      type: 'note-updated',
                      _eventType: 'note-updated',
                      sourcePath: fullPath,
                      filePath: fullPath,
                    });
                  }
                }
              } catch { /* ignore single stat error */ }
            }
          }
        };
        walkNotes(root);
      } catch (err) {
        console.error('[taskIpc] calendar note events failed:', err.message);
      }
    }

    return events;
  });
}

module.exports = { registerTaskIpc, parseMarkdownTasks, writeTaskStatusToNote };
