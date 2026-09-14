/**
 * ai/telemetry/TelemetryDB.js
 *
 * Dedicated, isolated SQLite database for MCP execution telemetry and system observability.
 * Stored inside {workspace}/.notes-app/ai-telemetry.db
 */

const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const { createLogger } = require('../core/logger');

const log = createLogger('TelemetryDB');

/**
 * Security payload redaction utility for API keys, passwords, and auth tokens.
 * Enforces payload truncation at maxBytes to prevent database bloat.
 */
function sanitizePayload(data, maxBytes = 32768) {
  if (!data) return data;
  if (typeof data === 'string') {
    let sanitized = data
      .replace(/gsk_[A-Za-z0-9_-]+/gi, 'gsk_***REDACTED***')
      .replace(/sk-[A-Za-z0-9_-]+/gi, 'sk-***REDACTED***')
      .replace(/AIzaSy[A-Za-z0-9_-]+/gi, 'AIzaSy***REDACTED***')
      .replace(/Bearer\s+[A-Za-z0-9_.-]+/gi, 'Bearer ***REDACTED***')
      .replace(/("password"|"secret"|"token"|"apiKey"|"api_key"|"authorization")\s*:\s*"[^"]+"/gi, '$1: "***REDACTED***"');
    if (sanitized.length > maxBytes) {
      sanitized = sanitized.slice(0, maxBytes) + `\n... [truncated ${sanitized.length - maxBytes} bytes]`;
    }
    return sanitized;
  }
  if (typeof data === 'object') {
    try {
      const copy = Array.isArray(data) ? [...data] : { ...data };
      const sensitiveKeys = new Set(['password', 'secret', 'token', 'apikey', 'api_key', 'authorization', 'credential', 'auth']);
      for (const k in copy) {
        if (sensitiveKeys.has(k.toLowerCase())) {
          copy[k] = '***REDACTED***';
        } else if (typeof copy[k] === 'string') {
          copy[k] = sanitizePayload(copy[k], maxBytes);
        } else if (typeof copy[k] === 'object' && copy[k] !== null) {
          copy[k] = sanitizePayload(copy[k], maxBytes);
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

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS telemetry_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          trace_id TEXT NOT NULL,
          span_id TEXT NOT NULL,
          parent_span_id TEXT,
          conversation_id TEXT DEFAULT 'mcp-session',
          event_type TEXT NOT NULL,
          category TEXT NOT NULL,
          status TEXT NOT NULL,
          severity TEXT DEFAULT 'info',
          caller_type TEXT DEFAULT 'external_client',
          label TEXT,
          duration_ms INTEGER DEFAULT 0,
          payload TEXT,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS mcp_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT UNIQUE NOT NULL,
          client_name TEXT DEFAULT 'Unknown Client',
          client_version TEXT DEFAULT '1.0.0',
          connected_at TEXT NOT NULL,
          disconnected_at TEXT,
          client_info TEXT,
          tool_calls_count INTEGER DEFAULT 0,
          successful_calls INTEGER DEFAULT 0,
          errors_count INTEGER DEFAULT 0,
          status TEXT DEFAULT 'active'
        );

        CREATE TABLE IF NOT EXISTS mcp_tool_calls (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          call_id TEXT UNIQUE,
          session_id TEXT NOT NULL,
          client_name TEXT DEFAULT 'Unknown Client',
          tool_name TEXT NOT NULL,
          input_payload TEXT,
          output_payload TEXT,
          duration_ms INTEGER DEFAULT 0,
          success INTEGER DEFAULT 1,
          error TEXT,
          called_at TEXT NOT NULL
        );
      `);

      // Migrate missing columns if tables pre-existed from older schema version
      try {
        const eventCols = this.db.prepare("PRAGMA table_info(telemetry_events)").all().map(c => c.name);
        if (eventCols.length > 0 && !eventCols.includes('status')) {
          this.db.exec("ALTER TABLE telemetry_events ADD COLUMN status TEXT DEFAULT 'SUCCESS'");
        }
        const sessionCols = this.db.prepare("PRAGMA table_info(mcp_sessions)").all().map(c => c.name);
        if (sessionCols.length > 0 && !sessionCols.includes('status')) {
          this.db.exec("ALTER TABLE mcp_sessions ADD COLUMN status TEXT DEFAULT 'active'");
        }
      } catch (migErr) {
        log.warn('TelemetryDB column migration warning:', migErr.message);
      }

      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_events_trace_id ON telemetry_events(trace_id);
        CREATE INDEX IF NOT EXISTS idx_events_type ON telemetry_events(event_type);
        CREATE INDEX IF NOT EXISTS idx_events_status ON telemetry_events(status);
        CREATE INDEX IF NOT EXISTS idx_mcp_tool_calls_session ON mcp_tool_calls(session_id);
        CREATE INDEX IF NOT EXISTS idx_mcp_tool_calls_tool ON mcp_tool_calls(tool_name);
        CREATE INDEX IF NOT EXISTS idx_mcp_tool_calls_called_at ON mcp_tool_calls(called_at);
        CREATE INDEX IF NOT EXISTS idx_mcp_sessions_status ON mcp_sessions(status);
      `);

      this.isInitialized = true;
      log.info(`TelemetryDB initialized at: ${this.dbPath}`);
      return true;
    } catch (err) {
      log.error('Failed to initialize TelemetryDB:', err.message);
      return false;
    }
  }

  recordMcpSession(session) {
    if (!this.db || !this.isInitialized || !session?.id) return;
    try {
      const stmt = this.db.prepare(`
        INSERT INTO mcp_sessions (session_id, client_name, client_version, connected_at, disconnected_at, client_info, tool_calls_count, successful_calls, errors_count, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET
          disconnected_at = excluded.disconnected_at,
          tool_calls_count = excluded.tool_calls_count,
          successful_calls = excluded.successful_calls,
          errors_count = excluded.errors_count,
          status = excluded.status
      `);
      stmt.run(
        session.id,
        session.clientName || session.clientInfo?.name || 'Unknown Client',
        session.clientVersion || session.clientInfo?.version || '1.0.0',
        session.connectedAt || new Date().toISOString(),
        session.disconnectedAt || null,
        JSON.stringify(sanitizePayload(session.clientInfo || {})),
        session.toolCallsCount || 0,
        session.successfulCalls || 0,
        session.errorsCount || 0,
        session.status || (session.disconnectedAt ? 'disconnected' : 'active')
      );
    } catch (err) {
      log.error('Failed to record MCP session in TelemetryDB:', err.message);
    }
  }

  recordMcpToolCall({ callId, sessionId, clientName, toolName, input, output, durationMs, success, error }) {
    if (!this.db || !this.isInitialized) return;
    try {
      const sanitizedInput = input ? JSON.stringify(sanitizePayload(input)) : null;
      const sanitizedOutput = output ? JSON.stringify(sanitizePayload(output)) : null;
      const generatedCallId = callId || `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      const stmt = this.db.prepare(`
        INSERT INTO mcp_tool_calls (call_id, session_id, client_name, tool_name, input_payload, output_payload, duration_ms, success, error, called_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        generatedCallId,
        sessionId || 'anonymous',
        clientName || 'Unknown Client',
        toolName || 'unknown_tool',
        sanitizedInput,
        sanitizedOutput,
        durationMs || 0,
        success ? 1 : 0,
        error || null,
        new Date().toISOString()
      );

      // Update session statistics
      if (sessionId) {
        this.db.prepare(`
          UPDATE mcp_sessions
          SET tool_calls_count = tool_calls_count + 1,
              successful_calls = successful_calls + (CASE WHEN ? = 1 THEN 1 ELSE 0 END),
              errors_count = errors_count + (CASE WHEN ? = 0 THEN 1 ELSE 0 END)
          WHERE session_id = ?
        `).run(success ? 1 : 0, success ? 1 : 0, sessionId);
      }
    } catch (err) {
      log.error('Failed to record MCP tool call in TelemetryDB:', err.message);
    }
  }

  recordEvent(evt) {
    if (!this.db || !this.isInitialized) return;
    try {
      const stmt = this.db.prepare(`
        INSERT INTO telemetry_events
        (trace_id, span_id, parent_span_id, conversation_id, event_type, category, status, severity, caller_type, label, duration_ms, payload, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        evt.traceId || `trc_${Date.now()}`,
        evt.spanId || `spn_${Date.now()}`,
        evt.parentSpanId || null,
        evt.conversationId || 'mcp-session',
        evt.eventType || evt.type || 'MCP_EVENT',
        evt.category || 'MCP',
        evt.status || 'SUCCESS',
        evt.severity || 'info',
        evt.callerType || 'external_client',
        evt.label || evt.type || 'MCP Event',
        Number(evt.durationMs || 0),
        JSON.stringify(sanitizePayload(evt.payload || evt.input || {})),
        evt.createdAt || new Date().toISOString()
      );
    } catch (err) {
      log.error('Failed to record telemetry event:', err.message);
    }
  }

  getMcpStats() {
    if (!this.db || !this.isInitialized) {
      return { totalSessions: 0, activeConnections: 0, totalToolCalls: 0, successfulCalls: 0, failedCalls: 0, successRate: 100, mostUsedTools: [] };
    }
    try {
      const sessionsRow = this.db.prepare(`
        SELECT 
          COUNT(*) as totalSessions,
          SUM(CASE WHEN status = 'active' AND disconnected_at IS NULL THEN 1 ELSE 0 END) as activeConnections
        FROM mcp_sessions
      `).get();

      const callsRow = this.db.prepare(`
        SELECT 
          COUNT(*) as totalCalls,
          SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successfulCalls,
          SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failedCalls
        FROM mcp_tool_calls
      `).get();

      const topTools = this.db.prepare(`
        SELECT tool_name as toolName, COUNT(*) as count
        FROM mcp_tool_calls
        GROUP BY tool_name
        ORDER BY count DESC
        LIMIT 5
      `).all();

      const totalCalls = callsRow?.totalCalls || 0;
      const successfulCalls = callsRow?.successfulCalls || 0;
      const failedCalls = callsRow?.failedCalls || 0;
      const successRate = totalCalls > 0 ? Math.round((successfulCalls / totalCalls) * 1000) / 10 : 100;

      return {
        totalSessions: sessionsRow?.totalSessions || 0,
        activeConnections: sessionsRow?.activeConnections || 0,
        totalToolCalls: totalCalls,
        successfulCalls,
        failedCalls,
        successRate,
        mostUsedTools: topTools || []
      };
    } catch (err) {
      log.error('Failed to get MCP stats:', err.message);
      return { totalSessions: 0, activeConnections: 0, totalToolCalls: 0, successfulCalls: 0, failedCalls: 0, successRate: 100, mostUsedTools: [] };
    }
  }

  getMcpToolCalls(filters = {}) {
    if (!this.db || !this.isInitialized) return [];
    try {
      const conditions = [];
      const params = [];

      if (filters.sessionId) {
        conditions.push('session_id = ?');
        params.push(filters.sessionId);
      }
      if (filters.clientName) {
        conditions.push('client_name LIKE ?');
        params.push(`%${filters.clientName}%`);
      }
      if (filters.toolName) {
        conditions.push('tool_name = ?');
        params.push(filters.toolName);
      }
      if (filters.status) {
        if (filters.status === 'SUCCESS' || filters.status === 'success') {
          conditions.push('success = 1');
        } else if (filters.status === 'FAILED' || filters.status === 'failed') {
          conditions.push('success = 0');
        }
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const limit = Number(filters.limit) || 100;
      params.push(limit);

      const stmt = this.db.prepare(`
        SELECT * FROM mcp_tool_calls
        ${whereClause}
        ORDER BY id DESC
        LIMIT ?
      `);
      const rows = stmt.all(...params);
      return rows.map(r => {
        let input = null;
        let output = null;
        try { if (r.input_payload) input = JSON.parse(r.input_payload); } catch { input = r.input_payload; }
        try { if (r.output_payload) output = JSON.parse(r.output_payload); } catch { output = r.output_payload; }

        return {
          id: r.id,
          callId: r.call_id,
          sessionId: r.session_id,
          clientName: r.client_name,
          toolName: r.tool_name,
          input,
          output,
          durationMs: r.duration_ms,
          status: r.success === 1 ? 'SUCCESS' : 'FAILED',
          error: r.error,
          calledAt: r.called_at
        };
      });
    } catch (err) {
      log.error('Failed to get MCP tool calls:', err.message);
      return [];
    }
  }

  getMcpSessions(limit = 50) {
    if (!this.db || !this.isInitialized) return [];
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM mcp_sessions
        ORDER BY id DESC
        LIMIT ?
      `);
      const rows = stmt.all(limit);
      return rows.map(r => {
        let clientInfo = null;
        try { if (r.client_info) clientInfo = JSON.parse(r.client_info); } catch { /* ignore */ }
        return {
          id: r.id,
          sessionId: r.session_id,
          clientName: r.client_name,
          clientVersion: r.client_version,
          connectedAt: r.connected_at,
          disconnectedAt: r.disconnected_at,
          clientInfo,
          toolCallsCount: r.tool_calls_count,
          successfulCalls: r.successful_calls,
          errorsCount: r.errors_count,
          status: r.status
        };
      });
    } catch (err) {
      log.error('Failed to get MCP sessions:', err.message);
      return [];
    }
  }

  clearTelemetry() {
    if (!this.db || !this.isInitialized) return;
    try {
      this.db.prepare('DELETE FROM mcp_tool_calls').run();
      this.db.prepare('DELETE FROM mcp_sessions').run();
      this.db.prepare('DELETE FROM telemetry_events').run();
      log.info('Cleared MCP telemetry logs and sessions');
    } catch (err) {
      log.error('Failed to clear telemetry logs:', err.message);
    }
  }

  addTelemetry(payload) {
    if (!this.db || !this.isInitialized) return;
    try {
      const now = payload.startedAt || new Date().toISOString();
      const flowId = payload.flowId || `flow-${Date.now()}`;
      const traceId = payload.traceId || flowId;
      const conversationId = payload.conversationId || 'default';
      const query = String(payload.query || payload.toolName || 'telemetry_event');
      const durationMs = Number(payload.totalDurationMs || payload.durationMs || 0);

      // Record as generic MCP tool call / event
      this.recordMcpToolCall({
        callId: flowId,
        sessionId: conversationId,
        clientName: payload.persona || 'System',
        toolName: query,
        input: payload.input || { query },
        output: payload.output || { stages: payload.stages },
        durationMs,
        success: payload.status !== 'failed' && payload.status !== 'error',
        error: payload.error || null
      });

      if (Array.isArray(payload.events)) {
        for (const evt of payload.events) {
          this.recordEvent({
            traceId,
            spanId: evt.spanId || `spn_${Date.now()}`,
            parentSpanId: evt.parentSpanId || null,
            conversationId,
            eventType: evt.eventType || evt.type || 'event',
            category: evt.category || 'System',
            status: evt.status || 'completed',
            severity: evt.severity || 'info',
            callerType: evt.callerType || 'system',
            label: evt.label || evt.type || 'Event',
            durationMs: Number(evt.durationMs || 0),
            payload: evt.payload || evt.input || {},
            createdAt: evt.startedAt || now
          });
        }
      }
    } catch (err) {
      log.error('Failed to add telemetry in TelemetryDB:', err.message);
    }
  }

  getTelemetryByConversation(conversationId, limit = 50) {
    if (!this.db || !this.isInitialized) return [];
    try {
      const calls = this.getMcpToolCalls({ sessionId: conversationId, limit });
      return calls.map(c => ({
        id: c.id,
        subsystem: 'FlowTracker',
        message: `Telemetry for ${c.toolName}`,
        timestamp: c.calledAt,
        metadata: {
          flowId: c.callId,
          traceId: c.callId,
          conversationId: c.sessionId,
          query: c.toolName,
          totalDurationMs: c.durationMs,
          input: c.input,
          output: c.output
        }
      }));
    } catch (err) {
      log.error('Failed to fetch telemetry by conversation:', err.message);
      return [];
    }
  }

  getTelemetryByTrace(traceId) {
    if (!this.db || !this.isInitialized) return null;
    try {
      const calls = this.getMcpToolCalls({ limit: 100 });
      const found = calls.find(c => c.callId === traceId);
      if (!found) return null;
      return {
        id: found.id,
        subsystem: 'FlowTracker',
        message: `Telemetry for ${found.toolName}`,
        timestamp: found.calledAt,
        metadata: {
          flowId: found.callId,
          traceId: found.callId,
          conversationId: found.sessionId,
          query: found.toolName,
          totalDurationMs: found.durationMs
        }
      };
    } catch (err) {
      log.error('Failed to fetch telemetry by trace:', err.message);
      return null;
    }
  }

  queryEvents(filters = {}) {
    if (!this.db || !this.isInitialized) return [];
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

