/**
 * LogDB - Persistent SQLite database for AI logs (Embeddings, Knowledge Graph)
 * Stored inside {workspace}/.notes-app/ai-logs.db
 */

const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const { createLogger } = require('../core/logger');

const log = createLogger('LogDB');

class LogDB {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.dbDir = path.join(workspaceRoot, '.notes-app');
    this.dbPath = path.join(this.dbDir, 'ai-logs.db');
    this.db = null;
    this.isInitialized = false;
  }

  initialize() {
    try {
      if (!fs.existsSync(this.dbDir)) {
        fs.mkdirSync(this.dbDir, { recursive: true });
      }

      this.db = new DatabaseSync(this.dbPath);

      // Create logs table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          subsystem TEXT NOT NULL,
          level TEXT DEFAULT 'info',
          message TEXT NOT NULL,
          metadata TEXT,
          timestamp TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_logs_subsystem ON logs(subsystem);
      `);

      this.isInitialized = true;
      return true;
    } catch (err) {
      log.error('Failed to initialize LogDB:', err.message);
      return false;
    }
  }

  addLog(subsystem, message, level = 'info', metadata = {}) {
    if (!this.db) return;
    try {
      const now = new Date().toISOString();
      const metaStr = typeof metadata === 'string' ? metadata : JSON.stringify(metadata || {});
      const stmt = this.db.prepare(`
        INSERT INTO logs (subsystem, level, message, metadata, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `);
      stmt.run(subsystem, level, message, metaStr, now);
    } catch (err) {
      log.error('Failed to add log:', err.message);
    }
  }

  getLogs(subsystem = null, limit = 100) {
    if (!this.db) return [];
    try {
      let query = 'SELECT * FROM logs ';
      const params = [];

      if (subsystem) {
        query += 'WHERE subsystem = ? ';
        params.push(subsystem);
      }

      query += 'ORDER BY id DESC LIMIT ?';
      params.push(limit);

      const stmt = this.db.prepare(query);
      const rows = stmt.all(...params);
      return rows.map(r => ({
        id: r.id,
        subsystem: r.subsystem,
        level: r.level,
        message: r.message,
        metadata: r.metadata ? JSON.parse(r.metadata) : {},
        timestamp: r.timestamp
      }));
    } catch (err) {
      log.error('Failed to fetch logs:', err.message);
      return [];
    }
  }

  clearLogs(subsystem = null) {
    if (!this.db) return;
    try {
      if (subsystem) {
        const stmt = this.db.prepare('DELETE FROM logs WHERE subsystem = ?');
        stmt.run(subsystem);
      } else {
        this.db.exec('DELETE FROM logs');
      }
    } catch (err) {
      log.error('Failed to clear logs:', err.message);
    }
  }

  close() {
    if (this.db) {
      try {
        this.db.close();
      } catch (err) {
        log.error('Error closing LogDB:', err.message);
      }
      this.db = null;
      this.isInitialized = false;
    }
  }
}

module.exports = LogDB;
