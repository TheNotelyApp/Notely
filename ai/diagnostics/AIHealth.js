/**
 * ai/diagnostics/AIHealth.js
 *
 * Diagnostics and health check metrics aggregator for the Notely MCP subsystem.
 */

const { aiService } = require('../core/AIService');

const path = require('path');
const fs = require('fs');

function getEmbeddingStats(db) {
  let chunks = 0;
  let notes = 0;
  if (!db) return { chunks, notes };
  try {
    const cRes = db.prepare("SELECT COUNT(*) as count FROM chunks").get();
    chunks = cRes ? Number(cRes.count || 0) : 0;
  } catch { /* ignore */ }

  try {
    const nRes1 = db.prepare("SELECT COUNT(DISTINCT note_path) as count FROM chunks WHERE note_path IS NOT NULL AND note_path != ''").get();
    notes = nRes1 ? Number(nRes1.count || 0) : 0;
  } catch { /* ignore */ }

  if (notes === 0) {
    try {
      const nRes2 = db.prepare("SELECT COUNT(*) as count FROM note_hashes").get();
      notes = nRes2 ? Number(nRes2.count || 0) : 0;
    } catch { /* ignore */ }
  }

  return { chunks, notes };
}

function getGraphStats(db) {
  let nodes = 0;
  let edges = 0;
  if (!db) return { nodes, edges };

  try {
    const nRes1 = db.prepare("SELECT COUNT(*) as count FROM entities").get();
    nodes = nRes1 ? Number(nRes1.count || 0) : 0;
  } catch { /* ignore */ }

  try {
    const eRes = db.prepare("SELECT COUNT(*) as count FROM relationships").get();
    edges = eRes ? Number(eRes.count || 0) : 0;
  } catch { /* ignore */ }

  if (nodes === 0 && edges > 0) {
    try {
      const nRes2 = db.prepare(`
        SELECT COUNT(*) as count FROM (
          SELECT source_id AS id FROM relationships
          UNION
          SELECT target_id AS id FROM relationships
        )
      `).get();
      nodes = nRes2 ? Number(nRes2.count || 0) : 0;
    } catch { /* ignore */ }
  }

  return { nodes, edges };
}

function getSubsystemHealth() {
  const isEnabled = aiService.isEnabled();
  const agent = aiService.agent;
  const isInitialized = Boolean(agent?.isInitialized);
  const workspaceRoot = aiService.workspaceRoot || agent?.workspaceRoot || null;

  let dbStatus = workspaceRoot ? 'connected' : 'uninitialized';
  let embeddingDBPath = workspaceRoot ? path.join(workspaceRoot, '.notes-app', 'ai-embeddings.db') : 'none';
  let graphDBPath = workspaceRoot ? path.join(workspaceRoot, '.notes-app', 'ai-graph.db') : 'none';
  let telemetryDBPath = workspaceRoot ? path.join(workspaceRoot, '.notes-app', 'ai-telemetry.db') : 'none';
  let totalChunks = 0;
  let indexedNotes = 0;
  let totalEntities = 0;
  let totalRelations = 0;

  // 1. Primary: Use active Agent DB instances if initialized
  if (isInitialized && agent) {
    try {
      if (agent.embeddingDb && agent.embeddingDb.db) {
        embeddingDBPath = agent.embeddingDb.dbPath || embeddingDBPath;
        const eStats = getEmbeddingStats(agent.embeddingDb.db);
        totalChunks = eStats.chunks;
        indexedNotes = eStats.notes;
      }
      if (agent.graphDb && agent.graphDb.db) {
        graphDBPath = agent.graphDb.dbPath || graphDBPath;
        const gStats = getGraphStats(agent.graphDb.db);
        totalEntities = gStats.nodes;
        totalRelations = gStats.edges;
      }
      if (agent.telemetryDb && agent.telemetryDb.db) {
        telemetryDBPath = agent.telemetryDb.dbPath || telemetryDBPath;
      }
    } catch (err) {
      console.error('[MCP Health] Failed to gather agent database stats:', err);
      dbStatus = 'degraded';
    }
  } else if (workspaceRoot) {
    // 2. Fallback: Use direct SQLite connection to workspace disk DB files
    try {
      const { DatabaseSync } = require('node:sqlite');
      if (fs.existsSync(embeddingDBPath)) {
        try {
          const embDb = new DatabaseSync(embeddingDBPath);
          const eStats = getEmbeddingStats(embDb);
          totalChunks = eStats.chunks;
          indexedNotes = eStats.notes;
          embDb.close();
        } catch { /* ignore */ }
      }
      if (fs.existsSync(graphDBPath)) {
        try {
          const gDb = new DatabaseSync(graphDBPath);
          const gStats = getGraphStats(gDb);
          totalEntities = gStats.nodes;
          totalRelations = gStats.edges;
          gDb.close();
        } catch { /* ignore */ }
      }
    } catch (err) {
      console.error('[MCP Health] Fallback workspace DB check failed:', err);
    }
  }

  // Get MCP Server & Telemetry Stats
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
    if (agent?.telemetryDb && typeof agent.telemetryDb.getMcpStats === 'function') {
      mcpStats = agent.telemetryDb.getMcpStats();
    } else if (workspaceRoot && fs.existsSync(telemetryDBPath)) {
      const { TelemetryDB } = require('../telemetry');
      const tempTelDb = new TelemetryDB(workspaceRoot);
      tempTelDb.initialize();
      mcpStats = tempTelDb.getMcpStats();
      tempTelDb.close();
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
      indexedNotes,
      totalEntities,
      totalRelations
    }
  };
}

module.exports = { getSubsystemHealth };

