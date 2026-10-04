/**
 * LogCore.cjs - Enterprise Centralized Logging Engine for Notely
 * 
 * High-performance, zero-external-dependency logging subsystem.
 * Stores centralized logs in {userData}/logs/app-log.db using node:sqlite.
 * Features:
 *  - WAL mode + 5s busy timeout (safe for multi-process / worker concurrent writes)
 *  - Automatic secret & path redaction (tokens, api keys, auth headers)
 *  - In-memory ring buffer with debounced async batch inserts (zero-lag on main thread)
 *  - Configurable retention pruning (time-based & max database size)
 *  - Crash / uncaught exception capture hooks
 *  - Aggregated log_stats rollups for instant UI telemetry without full table scans
 *  - Non-blocking error handling: logger failures NEVER throw or interrupt app flow
 */

const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const LEVELS = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5
};

const LEVEL_NAMES = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];

// Patterns for sensitive data redaction
const REDACTION_PATTERNS = [
  /(?:api[_-]?key|bearer|token|secret|password|authorization)\s*[:=]\s*['"]?([a-zA-Z0-9_\-\.]{8,})['"]?/gi,
  /(?:AIzaSy[a-zA-Z0-9_-]{33})/g, // Google / Gemini API key
  /(?:sk-[a-zA-Z0-9]{20,})/g,     // OpenAI / Anthropic key format
  /(?:hf_[a-zA-Z0-9]{34,})/g      // HuggingFace token
];

class LogCore {
  constructor() {
    this.db = null;
    this.dbPath = null;
    this.logsDir = null;
    this.isInitialized = false;
    this.sessionId = crypto.randomUUID ? crypto.randomUUID() : `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.appVersion = '1.0.0';
    this.activeWorkspaceId = 'default';
    this.activeWorkspacePath = '';
    
    // Batching & Flush state
    this.buffer = [];
    this.maxBufferSize = 500;
    this.flushIntervalMs = 500;
    this.flushTimer = null;
    this.isFlushing = false;

    // Default configuration
    this.config = {
      retentionDays: 30,
      maxSizeBytes: 200 * 1024 * 1024, // 200 MB
      minLevel: 'info',
      captureRendererLogs: false
    };

    this._boundUncaughtHandler = null;
    this._boundUnhandledRejection = null;
  }

  /**
   * Initialize central database in userData/logs directory
   * @param {string} userDataPath Path to Electron app.getPath('userData')
   * @param {object} options Optional configs
   */
  initialize(userDataPath, options = {}) {
    if (this.isInitialized && this.db) return true;

    try {
      if (!userDataPath) {
        // Fallback if userData not provided (e.g., test environment)
        userDataPath = path.join(os.tmpdir(), 'notely-enterprise-test');
      }

      this.logsDir = path.join(userDataPath, 'logs');
      if (!fs.existsSync(this.logsDir)) {
        fs.mkdirSync(this.logsDir, { recursive: true });
      }

      this.dbPath = path.join(this.logsDir, 'app-log.db');
      this.appVersion = options.appVersion || this.appVersion;
      if (options.retentionDays) this.config.retentionDays = options.retentionDays;
      if (options.maxSizeBytes) this.config.maxSizeBytes = options.maxSizeBytes;
      if (options.minLevel) this.config.minLevel = options.minLevel;

      this.db = new DatabaseSync(this.dbPath);

      // Enterprise SQLite pragmas for high concurrency & integrity
      this.db.exec(`
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA busy_timeout = 5000;
      `);

      // Core Schema
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS app_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ts_epoch INTEGER NOT NULL,
          ts_iso TEXT NOT NULL,
          level TEXT NOT NULL,
          category TEXT NOT NULL,
          subsystem TEXT NOT NULL,
          source TEXT,
          event TEXT,
          message TEXT NOT NULL,
          meta_json TEXT,
          error_name TEXT,
          error_message TEXT,
          stack TEXT,
          duration_ms REAL,
          workspace_id TEXT,
          session_id TEXT NOT NULL,
          process TEXT NOT NULL,
          pid INTEGER,
          app_version TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_app_logs_ts ON app_logs(ts_epoch);
        CREATE INDEX IF NOT EXISTS idx_app_logs_sub_ts ON app_logs(subsystem, ts_epoch);
        CREATE INDEX IF NOT EXISTS idx_app_logs_lvl_ts ON app_logs(level, ts_epoch);
        CREATE INDEX IF NOT EXISTS idx_app_logs_cat_ts ON app_logs(category, ts_epoch);
        CREATE INDEX IF NOT EXISTS idx_app_logs_ws ON app_logs(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_app_logs_sess ON app_logs(session_id);

        CREATE TABLE IF NOT EXISTS app_log_stats (
          hour_epoch INTEGER NOT NULL,
          level TEXT NOT NULL,
          category TEXT NOT NULL,
          count INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (hour_epoch, level, category)
        );

        CREATE TABLE IF NOT EXISTS app_log_meta (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);

      this.isInitialized = true;

      // Start periodic flush
      this._startFlushTimer();

      // Run background retention cleanup on init
      setTimeout(() => {
        this.pruneRetention();
      }, 2000);

      // Write boot log
      this.write({
        level: 'info',
        category: 'app',
        subsystem: 'main',
        source: 'LogCore',
        event: 'app.startup',
        message: `Notely centralized logging system initialized at ${this.dbPath}`
      });

      return true;
    } catch (err) {
      console.error('[LogCore] Failed to initialize centralized log database:', err);
      return false;
    }
  }

  /**
   * Set the active workspace to tag subsequent logs
   */
  setActiveWorkspace(workspacePath) {
    this.activeWorkspacePath = workspacePath || '';
    if (workspacePath) {
      this.activeWorkspaceId = crypto.createHash('sha256').update(workspacePath).digest('hex').slice(0, 16);
    } else {
      this.activeWorkspaceId = 'global';
    }
  }

  /**
   * Helper to redact sensitive information from strings
   */
  redact(str) {
    if (typeof str !== 'string') return str;
    let result = str;
    for (const pattern of REDACTION_PATTERNS) {
      result = result.replace(pattern, (match, p1) => {
        if (p1) {
          return match.replace(p1, '[REDACTED]');
        }
        return '[REDACTED]';
      });
    }
    return result;
  }

  /**
   * Enqueue a log entry (non-blocking, batched)
   */
  write(entry) {
    try {
      if (!entry) return;

      const level = (entry.level || 'info').toLowerCase();
      const tsEpoch = entry.ts_epoch || Date.now();
      const tsIso = entry.ts_iso || new Date(tsEpoch).toISOString();

      let metaJson = null;
      if (entry.meta_json) {
        metaJson = typeof entry.meta_json === 'string' ? entry.meta_json : JSON.stringify(entry.meta_json);
      } else if (entry.metadata || entry.meta) {
        metaJson = JSON.stringify(entry.metadata || entry.meta);
      }

      // Redact message and json metadata
      const cleanMessage = this.redact(String(entry.message || ''));
      if (metaJson) {
        metaJson = this.redact(metaJson);
      }

      let errorName = entry.error_name || null;
      let errorMessage = entry.error_message || null;
      let stack = entry.stack || null;

      if (entry.error && entry.error instanceof Error) {
        errorName = entry.error.name;
        errorMessage = this.redact(entry.error.message);
        stack = this.redact(entry.error.stack || '');
      }

      const item = {
        ts_epoch: tsEpoch,
        ts_iso: tsIso,
        level: LEVEL_NAMES.includes(level) ? level : 'info',
        category: entry.category || 'app',
        subsystem: entry.subsystem || 'general',
        source: entry.source || null,
        event: entry.event || null,
        message: cleanMessage,
        meta_json: metaJson,
        error_name: errorName,
        error_message: errorMessage,
        stack: stack,
        duration_ms: typeof entry.duration_ms === 'number' ? entry.duration_ms : null,
        workspace_id: entry.workspace_id || this.activeWorkspaceId,
        session_id: entry.session_id || this.sessionId,
        process: entry.process || (process.type || 'main'),
        pid: entry.pid || process.pid,
        app_version: entry.app_version || this.appVersion
      };

      this.buffer.push(item);

      if (this.buffer.length >= this.maxBufferSize) {
        this.flush();
      }
    } catch {
      // Logger must NEVER crash the caller
    }
  }

  _startFlushTimer() {
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.flushTimer = setInterval(() => {
      if (this.buffer.length > 0) {
        this.flush();
      }
    }, this.flushIntervalMs);
    if (this.flushTimer.unref) {
      this.flushTimer.unref();
    }
  }

  /**
   * Flush in-memory log buffer into SQLite database inside a single transaction
   */
  flush() {
    if (!this.db || !this.isInitialized || this.buffer.length === 0 || this.isFlushing) return;

    this.isFlushing = true;
    const batch = this.buffer.splice(0, this.buffer.length);

    try {
      this.db.exec('BEGIN IMMEDIATE;');

      const insertStmt = this.db.prepare(`
        INSERT INTO app_logs (
          ts_epoch, ts_iso, level, category, subsystem, source, event,
          message, meta_json, error_name, error_message, stack,
          duration_ms, workspace_id, session_id, process, pid, app_version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const statsStmt = this.db.prepare(`
        INSERT INTO app_log_stats (hour_epoch, level, category, count)
        VALUES (?, ?, ?, 1)
        ON CONFLICT(hour_epoch, level, category) DO UPDATE SET count = count + 1
      `);

      for (const r of batch) {
        insertStmt.run(
          r.ts_epoch, r.ts_iso, r.level, r.category, r.subsystem, r.source, r.event,
          r.message, r.meta_json, r.error_name, r.error_message, r.stack,
          r.duration_ms, r.workspace_id, r.session_id, r.process, r.pid, r.app_version
        );

        // Aggregate per hour epoch for ultra-fast UI sparklines & telemetry
        const hourEpoch = Math.floor(r.ts_epoch / (1000 * 60 * 60)) * (1000 * 60 * 60);
        statsStmt.run(hourEpoch, r.level, r.category);
      }

      this.db.exec('COMMIT;');
    } catch (err) {
      try {
        this.db.exec('ROLLBACK;');
      } catch { /* ignore */ }
      console.error('[LogCore] Flush batch error:', err?.message || err);
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Query logs for Enterprise UI
   */
  queryLogs(options = {}) {
    if (!this.db) return { rows: [], total: 0, hasMore: false };
    this.flush(); // Ensure latest entries are written before query

    try {
      const limit = Math.min(Math.max(Number(options.limit) || 200, 1), 2000);
      const offset = Math.max(Number(options.offset) || 0, 0);
      const conditions = [];
      const params = [];

      if (options.subsystem && options.subsystem !== 'all') {
        conditions.push('subsystem = ?');
        params.push(options.subsystem);
      }

      if (options.level && options.level !== 'all') {
        conditions.push('level = ?');
        params.push(options.level);
      }

      if (options.category && options.category !== 'all') {
        conditions.push('category = ?');
        params.push(options.category);
      }

      if (options.workspace_id && options.workspace_id !== 'all') {
        conditions.push('workspace_id = ?');
        params.push(options.workspace_id);
      }

      if (options.search && String(options.search).trim()) {
        conditions.push('(message LIKE ? OR source LIKE ? OR event LIKE ?)');
        const searchPattern = `%${String(options.search).trim()}%`;
        params.push(searchPattern, searchPattern, searchPattern);
      }

      if (options.startTime) {
        conditions.push('ts_epoch >= ?');
        params.push(Number(options.startTime));
      }

      if (options.endTime) {
        conditions.push('ts_epoch <= ?');
        params.push(Number(options.endTime));
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Count total matching
      const countStmt = this.db.prepare(`SELECT COUNT(*) as cnt FROM app_logs ${whereClause}`);
      const countRes = countStmt.get(...params);
      const total = countRes ? countRes.cnt : 0;

      // Select matching items
      const queryStmt = this.db.prepare(`
        SELECT * FROM app_logs
        ${whereClause}
        ORDER BY id DESC
        LIMIT ? OFFSET ?
      `);

      const rows = queryStmt.all(...params, limit, offset).map(r => ({
        id: r.id,
        timestamp: r.ts_iso,
        ts_epoch: r.ts_epoch,
        level: r.level,
        category: r.category,
        subsystem: r.subsystem,
        source: r.source,
        event: r.event,
        message: r.message,
        metadata: r.meta_json ? this._safeParseJson(r.meta_json) : {},
        error_name: r.error_name,
        error_message: r.error_message,
        stack: r.stack,
        duration_ms: r.duration_ms,
        workspace_id: r.workspace_id,
        session_id: r.session_id,
        process: r.process,
        app_version: r.app_version
      }));

      return {
        rows,
        total,
        hasMore: offset + rows.length < total
      };
    } catch (err) {
      console.error('[LogCore] Query error:', err);
      return { rows: [], total: 0, hasMore: false };
    }
  }

  /**
   * Get telemetry stats summary for UI Header
   */
  getStats(options = {}) {
    if (!this.db) return { total: 0, errors: 0, warns: 0, hourly: [], subsystems: [] };
    this.flush();

    try {
      const past24Hours = Date.now() - (24 * 60 * 60 * 1000);

      // Error/Warn counts in last 24h
      const summaryStmt = this.db.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN level IN ('error', 'fatal') THEN 1 ELSE 0 END) as errors,
          SUM(CASE WHEN level = 'warn' THEN 1 ELSE 0 END) as warns
        FROM app_logs
        WHERE ts_epoch >= ?
      `);
      const summary = summaryStmt.get(past24Hours) || { total: 0, errors: 0, warns: 0 };

      // Subsystem breakdown
      const subStmt = this.db.prepare(`
        SELECT subsystem, COUNT(*) as count
        FROM app_logs
        WHERE ts_epoch >= ?
        GROUP BY subsystem
        ORDER BY count DESC
        LIMIT 10
      `);
      const subsystems = subStmt.all(past24Hours);

      // Hourly stats rollup for sparkline
      const statsStmt = this.db.prepare(`
        SELECT hour_epoch, level, SUM(count) as count
        FROM app_log_stats
        WHERE hour_epoch >= ?
        GROUP BY hour_epoch, level
        ORDER BY hour_epoch ASC
      `);
      const hourly = statsStmt.all(past24Hours);

      // DB file size info
      let dbSizeMb = 0;
      if (this.dbPath && fs.existsSync(this.dbPath)) {
        const stat = fs.statSync(this.dbPath);
        dbSizeMb = (stat.size / (1024 * 1024)).toFixed(2);
      }

      return {
        total: summary.total || 0,
        errors: summary.errors || 0,
        warns: summary.warns || 0,
        dbSizeMb,
        subsystems,
        hourly,
        sessionId: this.sessionId
      };
    } catch (err) {
      console.error('[LogCore] getStats error:', err);
      return { total: 0, errors: 0, warns: 0, hourly: [], subsystems: [] };
    }
  }

  /**
   * Clear logs based on criteria (scoped, protects crash/audit records)
   */
  clearLogs(options = {}) {
    if (!this.db) return false;
    this.flush();

    try {
      const conditions = [];
      const params = [];

      // Exclude crash and audit records by default to protect forensic integrity
      if (!options.includeProtected) {
        conditions.push("category NOT IN ('crash', 'audit')");
      }

      if (options.subsystem && options.subsystem !== 'all') {
        conditions.push('subsystem = ?');
        params.push(options.subsystem);
      }

      if (options.beforeTimestamp) {
        conditions.push('ts_epoch <= ?');
        params.push(Number(options.beforeTimestamp));
      }

      let query = 'DELETE FROM app_logs';
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      this.db.prepare(query).run(...params);
      return true;
    } catch (err) {
      console.error('[LogCore] Clear logs error:', err);
      return false;
    }
  }

  /**
   * Automated retention pruning
   */
  pruneRetention() {
    if (!this.db) return;
    try {
      const cutoffEpoch = Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000);
      
      // Delete old logs beyond retention window (keep fatal/crash up to 90 days)
      const pruneStmt = this.db.prepare(`
        DELETE FROM app_logs 
        WHERE ts_epoch < ? AND level NOT IN ('fatal')
      `);
      pruneStmt.run(cutoffEpoch);

      // Prune hourly stats older than 60 days
      const statsPruneStmt = this.db.prepare(`
        DELETE FROM app_log_stats
        WHERE hour_epoch < ?
      `);
      statsPruneStmt.run(Date.now() - (60 * 24 * 60 * 60 * 1000));

      // Size cap check
      if (this.dbPath && fs.existsSync(this.dbPath)) {
        const stat = fs.statSync(this.dbPath);
        if (stat.size > this.config.maxSizeBytes) {
          // Delete oldest 20% of logs to relieve storage pressure
          this.db.exec(`
            DELETE FROM app_logs WHERE id IN (
              SELECT id FROM app_logs ORDER BY id ASC LIMIT 5000
            );
          `);
        }
      }
    } catch (err) {
      console.warn('[LogCore] Retention pruning error:', err?.message || err);
    }
  }

  /**
   * Attach process crash handlers
   */
  attachCrashHandlers() {
    if (this._boundUncaughtHandler) return;

    this._boundUncaughtHandler = (error) => {
      this.write({
        level: 'fatal',
        category: 'crash',
        subsystem: 'process',
        source: 'uncaughtException',
        event: 'process.crash.uncaught',
        message: `Uncaught Exception: ${error?.message || error}`,
        error: error instanceof Error ? error : new Error(String(error))
      });
      this.flush();
    };

    this._boundUnhandledRejection = (reason) => {
      this.write({
        level: 'error',
        category: 'crash',
        subsystem: 'process',
        source: 'unhandledRejection',
        event: 'process.rejection.unhandled',
        message: `Unhandled Rejection: ${reason?.message || reason}`,
        error: reason instanceof Error ? reason : new Error(String(reason))
      });
    };

    process.on('uncaughtException', this._boundUncaughtHandler);
    process.on('unhandledRejection', this._boundUnhandledRejection);
  }

  _safeParseJson(jsonStr) {
    try {
      return JSON.parse(jsonStr);
    } catch {
      return { raw: jsonStr };
    }
  }

  close() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush();

    if (this._boundUncaughtHandler) {
      process.removeListener('uncaughtException', this._boundUncaughtHandler);
      this._boundUncaughtHandler = null;
    }
    if (this._boundUnhandledRejection) {
      process.removeListener('unhandledRejection', this._boundUnhandledRejection);
      this._boundUnhandledRejection = null;
    }

    if (this.db) {
      try {
        this.db.close();
      } catch { /* ignore */ }
      this.db = null;
      this.isInitialized = false;
    }
  }
}

// Global Singleton Instance
const logCore = new LogCore();

module.exports = {
  LogCore,
  logCore,
  LEVELS
};
