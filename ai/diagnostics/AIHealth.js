/**
 * ai/diagnostics/AIHealth.js
 *
 * Diagnostics and health check metrics aggregator for the Notely MCP subsystem.
 */

const { aiService } = require('../core/AIService');

function getSubsystemHealth() {
  const isEnabled = aiService.isEnabled();
  const agent = aiService.agent;
  const isInitialized = Boolean(agent?.isInitialized);

  let dbStatus = 'uninitialized';
  let embeddingDBPath = 'none';
  let graphDBPath = 'none';
  let telemetryDBPath = 'none';
  let totalChunks = 0;
  let totalRelations = 0;

  if (isInitialized) {
    dbStatus = 'connected';
    try {
      if (agent.embeddingDb && agent.embeddingDb.db) {
        embeddingDBPath = agent.embeddingDb.dbPath || 'none';
        const countRes = agent.embeddingDb.db.prepare("SELECT COUNT(*) as count FROM chunks").get();
        totalChunks = countRes ? countRes.count : 0;
      }
      if (agent.graphDb && agent.graphDb.db) {
        graphDBPath = agent.graphDb.dbPath || 'none';
        const relsRes = agent.graphDb.db.prepare("SELECT COUNT(*) as count FROM relationships").get();
        totalRelations = relsRes ? relsRes.count : 0;
      }
      if (agent.telemetryDb && agent.telemetryDb.db) {
        telemetryDBPath = agent.telemetryDb.dbPath || 'none';
      }
    } catch (err) {
      console.error('[MCP Health] Failed to gather database stats:', err);
      dbStatus = 'degraded';
    }
  }

  // Get MCP Server Stats
  let mcpStats = {
    totalSessions: 0,
    activeConnections: 0,
    totalToolCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    successRate: 100,
    mostUsedTools: []
  };

  try {
    if (agent?.telemetryDb) {
      mcpStats = agent.telemetryDb.getMcpStats();
    }
  } catch (err) {
    console.error('[MCP Health] Failed to gather MCP stats:', err.message);
  }

  return {
    enabled: isEnabled,
    initialized: isInitialized,
    serverStatus: isEnabled ? 'Running' : 'Stopped',
    mcp: mcpStats,
    database: {
      status: dbStatus,
      embeddingDBPath,
      graphDBPath,
      telemetryDBPath,
      totalChunks,
      totalRelations
    }
  };
}

module.exports = { getSubsystemHealth };

