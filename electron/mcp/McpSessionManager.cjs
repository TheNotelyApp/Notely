/**
 * McpSessionManager.cjs
 * Tracks client sessions connected to Notely MCP Server.
 */

class McpSessionManager {
  constructor() {
    this.sessions = new Map();
    this.totalConnections = 0;
    this.totalToolCalls = 0;
    this.totalErrors = 0;
  }

  createSession(sessionId, req = null) {
    const session = {
      id: sessionId,
      connectedAt: new Date().toISOString(),
      remoteAddress: req?.socket?.remoteAddress || '127.0.0.1',
      userAgent: req?.headers?.['user-agent'] || 'unknown',
      toolCallsCount: 0,
      errorsCount: 0,
      lastActivityAt: new Date().toISOString()
    };
    this.sessions.set(sessionId, session);
    this.totalConnections++;
    return session;
  }

  registerSession(sessionId, clientName = 'Unknown Client', clientVersion = '1.0.0', headers = {}) {
    const session = {
      id: sessionId,
      clientName,
      clientVersion,
      clientInfo: JSON.stringify(headers || {}),
      connectedAt: new Date().toISOString(),
      remoteAddress: '127.0.0.1',
      userAgent: clientName,
      toolCallsCount: 0,
      errorsCount: 0,
      status: 'active',
      lastActivityAt: new Date().toISOString()
    };
    this.sessions.set(sessionId, session);
    this.totalConnections++;
    return session;
  }

  closeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.disconnectedAt = new Date().toISOString();
      this.sessions.delete(sessionId);
    }
    return session;
  }

  recordToolCall(sessionId, toolName, durationMs, success, error = null) {
    this.totalToolCalls++;
    if (!success) {
      this.totalErrors++;
    }

    const session = this.sessions.get(sessionId);
    if (session) {
      session.toolCallsCount++;
      session.lastActivityAt = new Date().toISOString();
      if (!success) {
        session.errorsCount++;
      }
    }

    return {
      sessionId,
      toolName,
      durationMs,
      success,
      error
    };
  }

  getActiveSessions() {
    return Array.from(this.sessions.values());
  }

  getStats() {
    return {
      activeCount: this.sessions.size,
      totalConnections: this.totalConnections,
      totalToolCalls: this.totalToolCalls,
      totalErrors: this.totalErrors
    };
  }

  clear() {
    this.sessions.clear();
  }
}

module.exports = {
  McpSessionManager
};
