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

/**
 * Security payload redaction utility for API keys and auth tokens
 */
function sanitizePayload(data) {
  if (!data) return data;
  if (typeof data === 'string') {
    return data
      .replace(/gsk_[A-Za-z0-9_-]+/gi, 'gsk_***REDACTED***')
      .replace(/sk-[A-Za-z0-9_-]+/gi, 'sk-***REDACTED***')
      .replace(/AIzaSy[A-Za-z0-9_-]+/gi, 'AIzaSy***REDACTED***')
      .replace(/Bearer\s+[A-Za-z0-9_.-]+/gi, 'Bearer ***REDACTED***');
  }
  if (typeof data === 'object') {
    try {
      const copy = Array.isArray(data) ? [...data] : { ...data };
      for (const k in copy) {
        if (typeof copy[k] === 'string') {
          copy[k] = sanitizePayload(copy[k]);
        } else if (typeof copy[k] === 'object' && copy[k] !== null) {
          copy[k] = sanitizePayload(copy[k]);
        }
      }
      return copy;
    } catch {
      return data;
    }
  }
  return data;
}

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
          trace_id TEXT,
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

        CREATE TABLE IF NOT EXISTS telemetry_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          trace_id TEXT NOT NULL,
          span_id TEXT NOT NULL,
          parent_span_id TEXT,
          conversation_id TEXT NOT NULL,
          event_type TEXT NOT NULL,
          category TEXT NOT NULL,
          status TEXT NOT NULL,
          severity TEXT DEFAULT 'info',
          caller_type TEXT DEFAULT 'system',
          label TEXT,
          duration_ms INTEGER DEFAULT 0,
          payload TEXT,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS mcp_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT UNIQUE NOT NULL,
          connected_at TEXT NOT NULL,
          disconnected_at TEXT,
          client_info TEXT,
          tool_calls_count INTEGER DEFAULT 0,
          errors_count INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS mcp_tool_calls (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT NOT NULL,
          tool_name TEXT NOT NULL,
          input_summary TEXT,
          output_summary TEXT,
          duration_ms INTEGER,
          success INTEGER DEFAULT 1,
          error TEXT,
          called_at TEXT NOT NULL
        );
      `);

      // Add trace_id column if upgrading existing database
      try {
        this.db.exec(`ALTER TABLE telemetry_logs ADD COLUMN trace_id TEXT;`);
      } catch {
        /* column already exists */
      }

      // Create indexes after ensuring columns exist
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_telemetry_conv_id ON telemetry_logs(conversation_id);
        CREATE INDEX IF NOT EXISTS idx_telemetry_created_at ON telemetry_logs(created_at);
        CREATE INDEX IF NOT EXISTS idx_telemetry_flow_id ON telemetry_logs(flow_id);
        CREATE INDEX IF NOT EXISTS idx_telemetry_trace_id ON telemetry_logs(trace_id);
        CREATE INDEX IF NOT EXISTS idx_events_trace_id ON telemetry_events(trace_id);
        CREATE INDEX IF NOT EXISTS idx_events_conv_id ON telemetry_events(conversation_id);
        CREATE INDEX IF NOT EXISTS idx_events_type ON telemetry_events(event_type);
        CREATE INDEX IF NOT EXISTS idx_events_status ON telemetry_events(status);
        CREATE INDEX IF NOT EXISTS idx_events_severity ON telemetry_events(severity);
        CREATE INDEX IF NOT EXISTS idx_mcp_tool_calls_session ON mcp_tool_calls(session_id);
        CREATE INDEX IF NOT EXISTS idx_mcp_tool_calls_called_at ON mcp_tool_calls(called_at);
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
      const traceId = payload.traceId || flowId;
      const conversationId = payload.conversationId || 'default';
      const query = String(payload.query || '');
      const persona = String(payload.persona || 'general');
      const durationMs = Number(payload.totalDurationMs || 0);
      const tokensUsed = typeof payload.tokensUsed === 'number' ? payload.tokensUsed : (payload.tokensUsed?.totalTokens || 0);
      const tokensDetailStr = payload.tokensDetail ? JSON.stringify(payload.tokensDetail) : (typeof payload.tokensUsed === 'object' ? JSON.stringify(payload.tokensUsed) : null);
      const systemPrompt = String(sanitizePayload(payload.systemPrompt || ''));
      const stagesStr = JSON.stringify(sanitizePayload(payload.stages || []));
      const eventsStr = JSON.stringify(sanitizePayload(payload.events || []));

      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO telemetry_logs 
        (flow_id, trace_id, conversation_id, query, persona, duration_ms, tokens_used, tokens_detail, system_prompt, stages, events, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(flowId, traceId, conversationId, query, persona, durationMs, tokensUsed, tokensDetailStr, systemPrompt, stagesStr, eventsStr, now);

      // Optionally populate telemetry_events table if events exist
      if (Array.isArray(payload.events)) {
        const evtStmt = this.db.prepare(`
          INSERT INTO telemetry_events
          (trace_id, span_id, parent_span_id, conversation_id, event_type, category, status, severity, caller_type, label, duration_ms, payload, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const evt of payload.events) {
          try {
            evtStmt.run(
              traceId,
              evt.spanId || `spn_${Date.now()}`,
              evt.parentSpanId || null,
              conversationId,
              evt.eventType || evt.type || 'event',
              evt.category || 'System',
              evt.status || 'completed',
              evt.severity || 'info',
              evt.callerType || 'system',
              evt.label || evt.type || 'Event',
              Number(evt.durationMs || 0),
              JSON.stringify(sanitizePayload(evt.payload || evt.input || {})),
              evt.startedAt || now
            );
          } catch {
            /* ignore individual event insert errors */
          }
        }
      }
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

  getTelemetryByTrace(traceId) {
    if (!this.db) return null;
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM telemetry_logs
        WHERE trace_id = ? OR flow_id = ?
        LIMIT 1
      `);
      const row = stmt.get(traceId, traceId);
      return row ? this._parseRow(row) : null;
    } catch (err) {
      log.error('Failed to fetch telemetry by trace:', err.message);
      return null;
    }
  }

  queryEvents(filters = {}) {
    if (!this.db) return [];
    try {
      const conditions = [];
      const params = [];

      if (filters.conversationId) {
        conditions.push('conversation_id = ?');
        params.push(filters.conversationId);
      }
      if (filters.traceId) {
        conditions.push('trace_id = ?');
        params.push(filters.traceId);
      }
      if (filters.eventType) {
        conditions.push('event_type = ?');
        params.push(filters.eventType);
      }
      if (filters.category) {
        conditions.push('category = ?');
        params.push(filters.category);
      }
      if (filters.status) {
        conditions.push('status = ?');
        params.push(filters.status);
      }
      if (filters.severity) {
        conditions.push('severity = ?');
        params.push(filters.severity);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const limit = Number(filters.limit) || 100;
      params.push(limit);

      const stmt = this.db.prepare(`
        SELECT * FROM telemetry_events
        ${whereClause}
        ORDER BY id DESC
        LIMIT ?
      `);
      const rows = stmt.all(...params);
      return rows.map(r => {
        let payload = null;
        try { if (r.payload) payload = JSON.parse(r.payload); } catch { /* ignore */ }
        return {
          id: r.id,
          traceId: r.trace_id,
          spanId: r.span_id,
          parentSpanId: r.parent_span_id,
          conversationId: r.conversation_id,
          eventType: r.event_type,
          category: r.category,
          status: r.status,
          severity: r.severity,
          callerType: r.caller_type,
          label: r.label,
          durationMs: r.duration_ms,
          payload,
          createdAt: r.created_at
        };
      });
    } catch (err) {
      log.error('Failed to query telemetry events:', err.message);
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

  clearTelemetry(conversationId = null, beforeTimestamp = null) {
    if (!this.db) return;
    try {
      if (conversationId) {
        const stmt = this.db.prepare('DELETE FROM telemetry_logs WHERE conversation_id = ?');
        stmt.run(conversationId);
        const stmtEvt = this.db.prepare('DELETE FROM telemetry_events WHERE conversation_id = ?');
        stmtEvt.run(conversationId);
      } else if (beforeTimestamp) {
        this.db.prepare('DELETE FROM telemetry_logs WHERE created_at <= ?').run(beforeTimestamp);
        this.db.prepare('DELETE FROM telemetry_events WHERE created_at <= ?').run(beforeTimestamp);
      } else {
        this.db.prepare('DELETE FROM telemetry_logs').run();
        this.db.prepare('DELETE FROM telemetry_events').run();
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
        traceId: r.trace_id || r.flow_id,
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

  recordMcpSession(session) {
    if (!this.db || !this.isInitialized || !session?.id) return;
    try {
      const stmt = this.db.prepare(`
        INSERT INTO mcp_sessions (session_id, connected_at, disconnected_at, client_info, tool_calls_count, errors_count)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET
          disconnected_at = excluded.disconnected_at,
          tool_calls_count = excluded.tool_calls_count,
          errors_count = excluded.errors_count
      `);
      stmt.run(
        session.id,
        session.connectedAt || new Date().toISOString(),
        session.disconnectedAt || null,
        JSON.stringify({ remoteAddress: session.remoteAddress, userAgent: session.userAgent }),
        session.toolCallsCount || 0,
        session.errorsCount || 0
      );
    } catch (err) {
      log.error('Failed to record MCP session in TelemetryDB:', err.message);
    }
  }

  recordMcpToolCall({ sessionId, toolName, inputSummary, outputSummary, durationMs, success, error }) {
    if (!this.db || !this.isInitialized) return;
    try {
      const stmt = this.db.prepare(`
        INSERT INTO mcp_tool_calls (session_id, tool_name, input_summary, output_summary, duration_ms, success, error, called_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        sessionId || 'anonymous',
        toolName || 'unknown',
        inputSummary ? sanitizePayload(inputSummary) : null,
        outputSummary ? sanitizePayload(outputSummary) : null,
        durationMs || 0,
        success ? 1 : 0,
        error || null,
        new Date().toISOString()
      );
    } catch (err) {
      log.error('Failed to record MCP tool call in TelemetryDB:', err.message);
    }
  }

  getMcpStats() {
    if (!this.db || !this.isInitialized) return { totalSessions: 0, totalToolCalls: 0, totalErrors: 0 };
    try {
      const sessionsRow = this.db.prepare('SELECT COUNT(*) as count FROM mcp_sessions').get();
      const callsRow = this.db.prepare('SELECT COUNT(*) as count, SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as errors FROM mcp_tool_calls').get();
      return {
        totalSessions: sessionsRow?.count || 0,
        totalToolCalls: callsRow?.count || 0,
        totalErrors: callsRow?.errors || 0
      };
    } catch (err) {
      log.error('Failed to get MCP stats:', err.message);
      return { totalSessions: 0, totalToolCalls: 0, totalErrors: 0 };
    }
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
