'use strict';

const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

const TASK_DB_DIR = '.notes-app';
const TASK_DB_FILE = 'task-db.sqlite';
const TASK_JSON_FILE = 'tasks.json';

function hashSource(filePath, lineText, occurrenceIndex = 1) {
  const cleanText = String(lineText || "")
    .replace(/^[ \t]*[-*+]?[ \t]*\[[ xX]\][ \t]*/, "")
    .trim()
    .toLowerCase();
  const suffix = occurrenceIndex > 1 ? `::${occurrenceIndex}` : "";
  return crypto.createHash('sha1').update(`${filePath}\x00${cleanText}${suffix}`).digest('hex');
}

function calculateSimilarity(str1, str2) {
  const s1 = String(str1 || '').toLowerCase().trim();
  const s2 = String(str2 || '').toLowerCase().trim();
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0;
  const words1 = new Set(s1.split(/\s+/));
  const words2 = new Set(s2.split(/\s+/));
  let intersection = 0;
  for (const w of words1) {
    if (words2.has(w)) intersection++;
  }
  const union = new Set([...words1, ...words2]).size;
  return union ? intersection / union : 0;
}

function randomId() {
  return crypto.randomBytes(10).toString('hex');
}

function nowISO() {
  return new Date().toISOString();
}

const SCHEMA = `
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS tasks (
    id            TEXT PRIMARY KEY,
    title         TEXT NOT NULL DEFAULT '',
    description   TEXT NOT NULL DEFAULT '',
    status        TEXT NOT NULL DEFAULT 'open',
    priority      INTEGER NOT NULL DEFAULT 0,
    source_path   TEXT,
    source_line   INTEGER,
    source_hash   TEXT UNIQUE,
    user_managed  INTEGER NOT NULL DEFAULT 0,
    due_date      TEXT,
    scheduled_start TEXT,
    scheduled_end   TEXT,
    is_all_day    INTEGER NOT NULL DEFAULT 1,
    reminder      TEXT,
    person_tags   TEXT NOT NULL DEFAULT '[]',
    metadata      TEXT NOT NULL DEFAULT '{}',
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL,
    completed_at  TEXT
  );

  CREATE TABLE IF NOT EXISTS task_comments (
    id         TEXT PRIMARY KEY,
    task_id    TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    author     TEXT NOT NULL DEFAULT 'me',
    body       TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS persons (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    email      TEXT NOT NULL DEFAULT '',
    avatar     TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
  CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
  CREATE INDEX IF NOT EXISTS idx_tasks_source_path ON tasks(source_path);
  CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);
`;

class TaskDatabase {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.db = null;
    this.jsonState = null;
    this.jsonPath = null;
    this._open();
  }

  _open() {
    if (!this.workspaceRoot) return;
    const dir = path.join(this.workspaceRoot, TASK_DB_DIR);
    if (!fs.existsSync(dir)) {
      try { fs.mkdirSync(dir, { recursive: true }); } catch { /* ignore */ }
    }

    // Try SQLite first
    try {
      const sqliteModule = require('node:sqlite');
      const DatabaseSync = sqliteModule?.DatabaseSync;
      if (DatabaseSync) {
        const dbPath = path.join(dir, TASK_DB_FILE);
        this.db = new DatabaseSync(dbPath);
        this.db.exec(SCHEMA);
        return;
      }
    } catch (err) {
      console.warn('[TaskDatabase] SQLite unavailable, using JSON fallback:', err?.message || err);
      this.db = null;
    }

    // JSON fallback
    this.jsonPath = path.join(dir, TASK_JSON_FILE);
    try {
      if (fs.existsSync(this.jsonPath)) {
        this.jsonState = JSON.parse(fs.readFileSync(this.jsonPath, 'utf8'));
      }
    } catch {
      /* ignore */
    }
    if (!this.jsonState) {
      this.jsonState = { tasks: [], comments: [], persons: [] };
    }
  }

  _saveJson() {
    if (!this.jsonPath || !this.jsonState) return;
    try {
      fs.writeFileSync(this.jsonPath, JSON.stringify(this.jsonState, null, 2), 'utf8');
    } catch { /* ignore */ }
  }

  close() {
    try { this.db?.close(); } catch { /* ignore */ }
    this.db = null;
  }

  // ── Tasks ─────────────────────────────────────────────────────────────────

  syncFromNote(filePath, parsedTasks) {
    const now = nowISO();
    let inserted = 0;
    let updated = 0;

    if (this.db) {
      const existingDbTasks = this.db.prepare(
        'SELECT * FROM tasks WHERE source_path = ? AND user_managed = 0'
      ).all(filePath).map(r => this._deserialize(r));

      const matchedTaskIds = new Set();
      const matchedParsedIndices = new Set();

      // Pass 1: Exact hash match (title + filePath)
      for (let i = 0; i < parsedTasks.length; i++) {
        const t = parsedTasks[i];
        const hash = hashSource(filePath, t.title);
        const match = existingDbTasks.find(dbT => !matchedTaskIds.has(dbT.id) && dbT.source_hash === hash);

        if (match) {
          matchedTaskIds.add(match.id);
          matchedParsedIndices.add(i);
          if (match.status !== t.status || match.source_line !== t.line) {
            const completedAt = t.status === 'done' ? now : (t.status === 'open' ? null : match.completed_at);
            this.db.prepare(
              'UPDATE tasks SET status = ?, source_line = ?, updated_at = ?, completed_at = ? WHERE id = ?'
            ).run(t.status, t.line, now, completedAt, match.id);
            updated++;
          }
        }
      }

      // Pass 2: Line index match for title edits on same line
      for (let i = 0; i < parsedTasks.length; i++) {
        if (matchedParsedIndices.has(i)) continue;
        const t = parsedTasks[i];
        const match = existingDbTasks.find(dbT => !matchedTaskIds.has(dbT.id) && dbT.source_line === t.line);

        if (match) {
          matchedTaskIds.add(match.id);
          matchedParsedIndices.add(i);
          const newHash = hashSource(filePath, t.title);
          const completedAt = t.status === 'done' ? now : null;
          this.db.prepare(
            'UPDATE tasks SET title = ?, status = ?, source_hash = ?, source_line = ?, updated_at = ?, completed_at = ? WHERE id = ?'
          ).run(t.title, t.status, newHash, t.line, now, completedAt, match.id);
          updated++;
        }
      }

      // Pass 3: Fuzzy title / positional alignment for remaining unmatched tasks
      const unmatchedDb = existingDbTasks.filter(dbT => !matchedTaskIds.has(dbT.id));
      const unmatchedParsed = parsedTasks.map((t, idx) => ({ ...t, idx })).filter(t => !matchedParsedIndices.has(t.idx));

      for (const p of unmatchedParsed) {
        let bestMatch = null;
        let bestScore = 0;

        for (const dbT of unmatchedDb) {
          if (matchedTaskIds.has(dbT.id)) continue;
          const score = calculateSimilarity(dbT.title, p.title);
          if (score > 0.35 && score > bestScore) {
            bestScore = score;
            bestMatch = dbT;
          }
        }

        if (!bestMatch && unmatchedDb.length === 1 && unmatchedParsed.length === 1) {
          bestMatch = unmatchedDb[0];
        }

        if (bestMatch) {
          matchedTaskIds.add(bestMatch.id);
          matchedParsedIndices.add(p.idx);
          const newHash = hashSource(filePath, p.title);
          const completedAt = p.status === 'done' ? now : null;
          this.db.prepare(
            'UPDATE tasks SET title = ?, status = ?, source_hash = ?, source_line = ?, updated_at = ?, completed_at = ? WHERE id = ?'
          ).run(p.title, p.status, newHash, p.line, now, completedAt, bestMatch.id);
          updated++;
        } else {
          // Insert new task safely checking if source_hash already exists
          const hash = hashSource(filePath, p.title);
          const existingHashMatch = this.db.prepare('SELECT id FROM tasks WHERE source_hash = ?').get(hash);

          if (existingHashMatch) {
            const completedAt = p.status === 'done' ? now : null;
            this.db.prepare(
              'UPDATE tasks SET status = ?, source_line = ?, updated_at = ?, completed_at = ? WHERE id = ?'
            ).run(p.status, p.line, now, completedAt, existingHashMatch.id);
            updated++;
          } else {
            this.db.prepare(`
              INSERT INTO tasks (id, title, status, source_path, source_line, source_hash,
                                 user_managed, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
            `).run(randomId(), p.title, p.status, filePath, p.line, hash, now, now);
            inserted++;
          }
        }
      }

      // Pass 4: Purge orphaned DB tasks for this file
      for (const dbT of existingDbTasks) {
        if (!matchedTaskIds.has(dbT.id)) {
          this.db.prepare('DELETE FROM tasks WHERE id = ?').run(dbT.id);
        }
      }

      return { inserted, updated };
    }

    if (this.jsonState) {
      const activeHashSet = new Set();
      for (const t of parsedTasks) {
        const hash = hashSource(filePath, t.title);
        activeHashSet.add(hash);
        const existing = this.jsonState.tasks.find(x => x.source_hash === hash);

        if (!existing) {
          this.jsonState.tasks.push({
            id: randomId(),
            title: t.title,
            description: '',
            status: t.status,
            priority: 0,
            source_path: filePath,
            source_line: t.line,
            source_hash: hash,
            user_managed: 0,
            due_date: null,
            scheduled_start: null,
            scheduled_end: null,
            is_all_day: 1,
            reminder: null,
            person_tags: [],
            metadata: {},
            created_at: now,
            updated_at: now,
            completed_at: t.status === 'done' ? now : null,
          });
          inserted++;
        } else if (!existing.user_managed && existing.status !== t.status) {
          existing.status = t.status;
          existing.source_line = t.line;
          existing.updated_at = now;
          existing.completed_at = t.status === 'done' ? now : null;
          updated++;
        } else if (existing.source_line !== t.line) {
          existing.source_line = t.line;
        }
      }

      // Purge orphaned tasks for this file
      this.jsonState.tasks = this.jsonState.tasks.filter(
        t => t.source_path !== filePath || t.user_managed === 1 || activeHashSet.has(t.source_hash)
      );

      this._saveJson();
    }

    return { inserted, updated };
  }

  listTasks({ status, priority, dueBefore, noteFilter, search, limit = 200, offset = 0 } = {}) {
    if (this.db) {
      let sql = 'SELECT * FROM tasks WHERE 1=1';
      const params = [];

      if (status && status !== 'all') {
        if (status === 'overdue') {
          sql += " AND status = 'open' AND due_date IS NOT NULL AND due_date < date('now')";
        } else if (status === 'today') {
          sql += " AND status = 'open' AND due_date = date('now')";
        } else if (status === 'upcoming') {
          sql += " AND status = 'open' AND (due_date IS NULL OR due_date >= date('now'))";
        } else {
          sql += ' AND status = ?';
          params.push(status);
        }
      }

      if (priority != null && priority >= 0) {
        sql += ' AND priority = ?';
        params.push(priority);
      }

      if (dueBefore) {
        sql += ' AND due_date IS NOT NULL AND due_date <= ?';
        params.push(dueBefore);
      }

      if (noteFilter) {
        sql += ' AND source_path = ?';
        params.push(noteFilter);
      }

      if (search) {
        sql += ' AND (title LIKE ? OR description LIKE ?)';
        const needle = `%${search}%`;
        params.push(needle, needle);
      }

      sql += " ORDER BY CASE status WHEN 'open' THEN 0 ELSE 1 END, due_date ASC NULLS LAST, priority DESC, updated_at DESC";
      sql += ' LIMIT ? OFFSET ?';
      params.push(limit, offset);

      return this.db.prepare(sql).all(...params).map(r => this._deserialize(r));
    }

    if (this.jsonState) {
      const todayStr = new Date().toISOString().slice(0, 10);
      let list = [...this.jsonState.tasks];

      if (status && status !== 'all') {
        if (status === 'overdue') {
          list = list.filter(t => t.status === 'open' && t.due_date && t.due_date < todayStr);
        } else if (status === 'today') {
          list = list.filter(t => t.status === 'open' && t.due_date === todayStr);
        } else if (status === 'upcoming') {
          list = list.filter(t => t.status === 'open' && (t.due_date == null || t.due_date >= todayStr));
        } else {
          list = list.filter(t => t.status === status);
        }
      }

      if (priority != null && priority >= 0) {
        list = list.filter(t => (t.priority ?? 0) === priority);
      }

      if (dueBefore) {
        list = list.filter(t => t.due_date && t.due_date <= dueBefore);
      }

      if (noteFilter) {
        list = list.filter(t => t.source_path === noteFilter);
      }

      if (search) {
        const needle = search.toLowerCase();
        list = list.filter(t => (t.title || '').toLowerCase().includes(needle) || (t.description || '').toLowerCase().includes(needle));
      }

      list.sort((a, b) => {
        if (a.status !== b.status) return a.status === 'open' ? -1 : 1;
        if (a.due_date !== b.due_date) {
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return a.due_date.localeCompare(b.due_date);
        }
        return (b.priority ?? 0) - (a.priority ?? 0);
      });

      return list.slice(offset, offset + limit);
    }

    return [];
  }

  getTask(id) {
    if (this.db) {
      const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
      return row ? this._deserialize(row) : null;
    }
    if (this.jsonState) {
      return this.jsonState.tasks.find(t => t.id === id) ?? null;
    }
    return null;
  }

  createTask({ title, description = '', status = 'open', priority = 0, sourcePath, sourceLine,
               dueDate, scheduledStart, scheduledEnd, isAllDay = 1,
               reminder, personTags = [], metadata = {} }) {
    const now = nowISO();
    const isNoteTask = Boolean(sourcePath && sourcePath !== 'none');
    const sourceHash = isNoteTask ? hashSource(sourcePath, title) : null;

    if (this.db) {
      if (sourceHash) {
        const existing = this.db.prepare('SELECT id FROM tasks WHERE source_hash = ?').get(sourceHash);
        if (existing) {
          this.updateTask(existing.id, { title, description, status, priority, dueDate, scheduledStart, scheduledEnd, isAllDay, reminder, personTags });
          return this.getTask(existing.id);
        }
      }

      const id = randomId();
      this.db.prepare(`
        INSERT INTO tasks (id, title, description, status, priority, source_path, source_line, source_hash,
                           user_managed, due_date, scheduled_start, scheduled_end, is_all_day, reminder,
                           person_tags, metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, title, description, status, priority, isNoteTask ? sourcePath : null, sourceLine ?? null, sourceHash,
             isNoteTask ? 0 : 1, dueDate ?? null, scheduledStart ?? null, scheduledEnd ?? null, isAllDay ? 1 : 0,
             reminder ?? null, JSON.stringify(personTags), JSON.stringify(metadata), now, now);
      return this.getTask(id);
    }

    if (this.jsonState) {
      if (sourceHash) {
        const existing = this.jsonState.tasks.find(t => t.source_hash === sourceHash);
        if (existing) {
          this.updateTask(existing.id, { title, description, status, priority, dueDate, scheduledStart, scheduledEnd, isAllDay, reminder, personTags });
          return this.getTask(existing.id);
        }
      }

      const id = randomId();
      const task = {
        id, title, description, status, priority,
        source_path: isNoteTask ? sourcePath : null,
        source_line: sourceLine ?? null,
        source_hash: sourceHash,
        user_managed: isNoteTask ? 0 : 1,
        due_date: dueDate ?? null,
        scheduled_start: scheduledStart ?? null,
        scheduled_end: scheduledEnd ?? null,
        is_all_day: isAllDay ? 1 : 0,
        reminder: reminder ?? null,
        person_tags: personTags,
        metadata,
        created_at: now,
        updated_at: now,
        completed_at: status === 'done' ? now : null,
      };
      this.jsonState.tasks.push(task);
      this._saveJson();
      return task;
    }

    return null;
  }

  updateTask(id, fields) {
    const now = nowISO();

    if (this.db) {
      const allowed = ['title', 'description', 'status', 'priority', 'due_date', 'scheduled_start',
                       'scheduled_end', 'is_all_day', 'reminder', 'person_tags', 'metadata',
                       'user_managed', 'completed_at'];
      const sets = [];
      const params = [];

      for (const [key, val] of Object.entries(fields)) {
        const col = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        if (!allowed.includes(col)) continue;
        const stored = (col === 'person_tags' || col === 'metadata') ? JSON.stringify(val) : val;
        sets.push(`${col} = ?`);
        params.push(stored);
      }

      if (!sets.length) return this.getTask(id);

      if (fields.status === 'done' && !fields.completedAt) {
        sets.push('completed_at = ?');
        params.push(now);
      } else if (fields.status === 'open') {
        sets.push('completed_at = ?');
        params.push(null);
      }

      sets.push('updated_at = ?', 'user_managed = 1');
      params.push(now);

      this.db.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`).run(...params, id);
      return this.getTask(id);
    }

    if (this.jsonState) {
      const task = this.jsonState.tasks.find(t => t.id === id);
      if (!task) return null;

      for (const [key, val] of Object.entries(fields)) {
        const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        task[snakeKey] = val;
      }
      task.user_managed = 1;
      task.updated_at = now;

      if (fields.status === 'done' && !fields.completedAt) {
        task.completed_at = now;
      } else if (fields.status === 'open') {
        task.completed_at = null;
      }

      this._saveJson();
      return task;
    }

    return null;
  }

  deleteTask(id) {
    if (this.db) {
      this.db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
      return true;
    }
    if (this.jsonState) {
      const idx = this.jsonState.tasks.findIndex(t => t.id === id);
      if (idx !== -1) {
        this.jsonState.tasks.splice(idx, 1);
        this._saveJson();
        return true;
      }
    }
    return false;
  }

  getOverdueTasks() {
    return this.listTasks({ status: 'overdue', limit: 1000 });
  }

  // ── Comments ──────────────────────────────────────────────────────────────

  addComment(taskId, { body, author = 'me' }) {
    const id = randomId();
    const now = nowISO();

    if (this.db) {
      this.db.prepare(
        'INSERT INTO task_comments (id, task_id, author, body, created_at) VALUES (?, ?, ?, ?, ?)'
      ).run(id, taskId, author, body, now);
      return { id, taskId, author, body, createdAt: now };
    }

    if (this.jsonState) {
      const comment = { id, taskId, author, body, createdAt: now };
      this.jsonState.comments.push(comment);
      this._saveJson();
      return comment;
    }

    return null;
  }

  getComments(taskId) {
    if (this.db) {
      return this.db.prepare(
        'SELECT id, task_id AS taskId, author, body, created_at AS createdAt FROM task_comments WHERE task_id = ? ORDER BY created_at ASC'
      ).all(taskId);
    }
    if (this.jsonState) {
      return this.jsonState.comments
        .filter(c => c.taskId === taskId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }
    return [];
  }

  // ── Persons ───────────────────────────────────────────────────────────────

  listPersons() {
    if (this.db) {
      return this.db.prepare('SELECT * FROM persons ORDER BY name ASC').all();
    }
    if (this.jsonState) {
      return [...this.jsonState.persons].sort((a, b) => a.name.localeCompare(b.name));
    }
    return [];
  }

  upsertPerson({ id, name, email = '', avatar = '' }) {
    const now = nowISO();
    const pid = id || randomId();

    if (this.db) {
      this.db.prepare(`
        INSERT INTO persons (id, name, email, avatar, created_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET name = excluded.name, email = excluded.email, avatar = excluded.avatar
      `).run(pid, name, email, avatar, now);
      return this.db.prepare('SELECT * FROM persons WHERE id = ?').get(pid);
    }

    if (this.jsonState) {
      let p = this.jsonState.persons.find(x => x.id === pid);
      if (p) {
        p.name = name;
        p.email = email;
        p.avatar = avatar;
      } else {
        p = { id: pid, name, email, avatar, created_at: now };
        this.jsonState.persons.push(p);
      }
      this._saveJson();
      return p;
    }

    return null;
  }

  deletePerson(id) {
    if (this.db) {
      this.db.prepare('DELETE FROM persons WHERE id = ?').run(id);
      return true;
    }
    if (this.jsonState) {
      const idx = this.jsonState.persons.findIndex(p => p.id === id);
      if (idx !== -1) {
        this.jsonState.persons.splice(idx, 1);
        this._saveJson();
        return true;
      }
    }
    return false;
  }

  // ── Calendar Events ───────────────────────────────────────────────────────

  getCalendarTaskEvents(startDate, endDate) {
    if (this.db) {
      const rows = this.db.prepare(`
        SELECT id, title, status, due_date, scheduled_start, scheduled_end,
               is_all_day, priority, source_path, completed_at
        FROM tasks
        WHERE (
          (due_date IS NOT NULL AND due_date BETWEEN ? AND ?)
          OR (scheduled_start IS NOT NULL AND date(scheduled_start) BETWEEN ? AND ?)
          OR (completed_at IS NOT NULL AND date(completed_at) BETWEEN ? AND ?)
        )
      `).all(startDate, endDate, startDate, endDate, startDate, endDate);

      return rows.map(r => ({
        ...this._deserialize(r),
        _eventType: r.completed_at ? 'task-completed'
          : r.scheduled_start ? 'task-scheduled'
          : 'task-due',
      }));
    }

    if (this.jsonState) {
      return this.jsonState.tasks
        .filter(t => {
          const due = t.due_date && t.due_date >= startDate && t.due_date <= endDate;
          const sched = t.scheduled_start && t.scheduled_start.slice(0, 10) >= startDate && t.scheduled_start.slice(0, 10) <= endDate;
          const comp = t.completed_at && t.completed_at.slice(0, 10) >= startDate && t.completed_at.slice(0, 10) <= endDate;
          return due || sched || comp;
        })
        .map(t => ({
          ...t,
          _eventType: t.completed_at ? 'task-completed'
            : t.scheduled_start ? 'task-scheduled'
            : 'task-due',
        }));
    }

    return [];
  }

  _deserialize = (row) => {
    return {
      ...row,
      personTags: this._parseJson(row.person_tags, []),
      metadata: this._parseJson(row.metadata, {}),
      isAllDay: Boolean(row.is_all_day),
      userManaged: Boolean(row.user_managed),
    };
  };

  _parseJson = (val, fallback) => {
    try { return JSON.parse(val); } catch { return fallback; }
  };
}

const _instances = new Map();

function getTaskDatabase(workspaceRoot) {
  if (!workspaceRoot) return null;
  const key = String(workspaceRoot).toLowerCase();
  if (!_instances.has(key)) {
    _instances.set(key, new TaskDatabase(workspaceRoot));
  }
  return _instances.get(key);
}

function closeTaskDatabase(workspaceRoot) {
  if (!workspaceRoot) return;
  const key = String(workspaceRoot).toLowerCase();
  const db = _instances.get(key);
  if (db) { db.close(); _instances.delete(key); }
}

module.exports = { TaskDatabase, getTaskDatabase, closeTaskDatabase, hashSource };
