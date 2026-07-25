/**
 * AIHealth - Diagnostics and health check metrics aggregator for the AI subsystem
 */

const { aiService } = require('../core/AIService');


function getSubsystemHealth() {
  const isEnabled = aiService.isEnabled();
  const agent = aiService.agent;
  const isInitialized = Boolean(agent?.isInitialized);

  // DB file checks
  let dbStatus = 'uninitialized';
  let memoryDBPath = 'none';
  let personaDBPath = 'none';
  let embeddingDBPath = 'none';
  let graphDBPath = 'none';
  let logDBPath = 'none';
  let totalPersonas = 0;
  let totalConversations = 0;
  let totalChunks = 0;
  let totalRelations = 0;
  let totalLogs = 0;
  let requestsCount = 0;
  let tokensUsed = 0;

  if (isInitialized) {
    dbStatus = 'connected';
    try {
      if (agent.conversationStore) {
        memoryDBPath = agent.conversationStore.memoryDB?.dbPath || agent.conversationStore.dbPath || 'none';
        const convs = agent.conversationStore.listConversations();
        totalConversations = convs ? convs.length : 0;
      }
      if (agent.personaDB) {
        personaDBPath = agent.personaDB.dbPath || 'none';
        const personas = agent.personaDB.list();
        totalPersonas = personas ? personas.length : 0;
      }
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
      if (agent.logDb && agent.logDb.db) {
        logDBPath = agent.logDb.dbPath || 'none';
        const logCountRes = agent.logDb.db.prepare("SELECT COUNT(*) as count FROM logs").get();
        totalLogs = logCountRes ? logCountRes.count : 0;

        const statsRes = agent.logDb.db.prepare(`
          SELECT 
            COUNT(*) as reqCount,
            SUM(CAST(json_extract(metadata, '$.tokensUsed') AS INTEGER)) as tokSum
          FROM logs 
          WHERE subsystem IN ('FlowTracker', 'PromptTracker')
        `).get();
        if (statsRes) {
          requestsCount = statsRes.reqCount || 0;
          tokensUsed = statsRes.tokSum || 0;
        }
      }
    } catch (err) {
      console.error('[AI Health] Failed to gather detailed database stats:', err);
      dbStatus = 'degraded';
    }

    const providerStats = agent.llmRegistry?.getActiveProvider()?.getUsageStats();
    if (providerStats) {
      if ((providerStats.requestsTotal || 0) > requestsCount) requestsCount = providerStats.requestsTotal;
      if ((providerStats.tokensUsedTotal || 0) > tokensUsed) tokensUsed = providerStats.tokensUsedTotal;
    }
  }

  const activeProvider = isInitialized ? (agent.llmRegistry?.getActiveProvider()?.name || 'none') : 'none';

  let isPaused = true;
  let isIndexing = false;
  try {
    const workerManager = require('../../electron/ai/workerManager.cjs');
    isPaused = workerManager.isPaused === true;
    isIndexing = workerManager.isWorking === true;
  } catch (err) {
    console.error('[AI Health] Failed to load workerManager:', err.message);
  }

  return {
    enabled: isEnabled,
    initialized: isInitialized,
    activeProvider,
    isPaused,
    isIndexing,
    database: {
      status: dbStatus,
      memoryDBPath,
      personaDBPath,
      embeddingDBPath,
      graphDBPath,
      logDBPath,
      totalPersonas,
      totalConversations,
      totalChunks,
      totalRelations,
      totalLogs
    },
    systemStats: {
      requestsCount,
      tokensUsed
    }
  };
}

module.exports = { getSubsystemHealth };
