/**
 * ai/telemetry/TelemetryDB.js
 *
 * Dedicated, isolated SQLite database for AI execution telemetry.
 * Stored inside {workspace}/.notes-app/ai-telemetry.db
 */

const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const { createLogger } = require('../core/logger');

const log = createLogger('TelemetryDB');

class TelemetryDB {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.dbDir = path.join(workspaceRoot, '.notes-app');
    this.dbPath = path.join(this.dbDir, 'ai-telemetry.db');
    this.db = null;
    this.isInitialized = false;
  }

  initialize() {
    try {
      if (!fs.existsSync(this.dbDir)) {
        fs.mkdirSync(this.dbDir, { recursive: true });
      }

      this.db = new DatabaseSync(this.dbPath);

      this.db.exec('PRAGMA journal_mode = WAL');
      this.db.exec('PRAGMA synchronous = NORMAL');

      // Create telemetry_logs table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS telemetry_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          flow_id TEXT UNIQUE NOT NULL,
          conversation_id TEXT NOT NULL,
          query TEXT NOT NULL,
          persona TEXT,
          duration_ms INTEGER,
          tokens_used INTEGER,
          tokens_detail TEXT,
          system_prompt TEXT,
          stages TEXT,
          events TEXT,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_telemetry_conv_id ON telemetry_logs(conversation_id);
        CREATE INDEX IF NOT EXISTS idx_telemetry_created_at ON telemetry_logs(created_at);
      `);

      this.isInitialized = true;
      log.info(`TelemetryDB initialized at: ${this.dbPath}`);
      return true;
    } catch (err) {
      log.error('Failed to initialize TelemetryDB:', err.message);
      return false;
    }
  }

  addTelemetry(payload) {
    if (!this.db) return;
    try {
      const now = payload.startedAt || new Date().toISOString();
      const flowId = payload.flowId || `flow-${Date.now()}`;
      const conversationId = payload.conversationId || 'default';
      const query = String(payload.query || '');
      const persona = String(payload.persona || 'general');
      const durationMs = Number(payload.totalDurationMs || 0);
      const tokensUsed = typeof payload.tokensUsed === 'number' ? payload.tokensUsed : (payload.tokensUsed?.totalTokens || 0);
      const tokensDetailStr = payload.tokensDetail ? JSON.stringify(payload.tokensDetail) : (typeof payload.tokensUsed === 'object' ? JSON.stringify(payload.tokensUsed) : null);
      const systemPrompt = String(payload.systemPrompt || '');
      const stagesStr = JSON.stringify(payload.stages || []);
      const eventsStr = JSON.stringify(payload.events || []);

      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO telemetry_logs 
        (flow_id, conversation_id, query, persona, duration_ms, tokens_used, tokens_detail, system_prompt, stages, events, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(flowId, conversationId, query, persona, durationMs, tokensUsed, tokensDetailStr, systemPrompt, stagesStr, eventsStr, now);
    } catch (err) {
      log.error('Failed to add telemetry log:', err.message);
    }
  }

  getTelemetryByConversation(conversationId, limit = 50) {
    if (!this.db) return [];
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM telemetry_logs 
        WHERE conversation_id = ? 
        ORDER BY id DESC 
        LIMIT ?
      `);
      const rows = stmt.all(conversationId, limit);
      return rows.map(r => this._parseRow(r));
    } catch (err) {
      log.error('Failed to fetch telemetry by conversation:', err.message);
      return [];
    }
  }

  getLatestTelemetry(limit = 100) {
    if (!this.db) return [];
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM telemetry_logs 
        ORDER BY id DESC 
        LIMIT ?
      `);
      const rows = stmt.all(limit);
      return rows.map(r => this._parseRow(r));
    } catch (err) {
      log.error('Failed to fetch latest telemetry:', err.message);
      return [];
    }
  }

  clearTelemetry(conversationId = null) {
    if (!this.db) return;
    try {
      if (conversationId) {
        const stmt = this.db.prepare('DELETE FROM telemetry_logs WHERE conversation_id = ?');
        stmt.run(conversationId);
      } else {
        this.db.prepare('DELETE FROM telemetry_logs').run();
      }
    } catch (err) {
      log.error('Failed to clear telemetry logs:', err.message);
    }
  }

  _parseRow(r) {
    let stages = [];
    let events = [];
    let tokensDetail = null;

    try { if (r.stages) stages = JSON.parse(r.stages); } catch { /* ignore */ }
    try { if (r.events) events = JSON.parse(r.events); } catch { /* ignore */ }
    try { if (r.tokens_detail) tokensDetail = JSON.parse(r.tokens_detail); } catch { /* ignore */ }

    return {
      id: r.id,
      subsystem: 'FlowTracker',
      message: `Flow execution telemetry recorded for query: "${r.query.slice(0, 60)}"`,
      timestamp: r.created_at,
      metadata: {
        flowId: r.flow_id,
        conversationId: r.conversation_id,
        query: r.query,
        persona: r.persona,
        totalDurationMs: r.duration_ms,
        tokensUsed: r.tokens_used,
        tokensDetail,
        systemPrompt: r.system_prompt,
        stages,
        events
      }
    };
  }

  close() {
    if (this.db) {
      try {
        this.db.close();
      } catch (err) {
        log.error('Error closing TelemetryDB:', err.message);
      }
      this.db = null;
      this.isInitialized = false;
    }
  }
}

module.exports = TelemetryDB;
