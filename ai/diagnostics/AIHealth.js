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
  let totalEmbeddingsCount = 0;
  let totalRelationshipsCount = 0;

  if (isInitialized && agent.db) {
    try {
      dbStatus = 'connected';
      // Query legacy DB or workspace scoped DB
      const files = agent.db.getWorkspaceFiles ? agent.db.getWorkspaceFiles() : [];
      totalEmbeddingsCount = files.length;
    } catch {
      dbStatus = 'degraded';
    }
  }

  const activeProvider = isInitialized ? agent.llmRegistry?.getActiveProvider()?.name : 'none';

  return {
    enabled: isEnabled,
    initialized: isInitialized,
    activeProvider,
    database: {
      status: dbStatus,
      embeddingsCount: totalEmbeddingsCount,
      relationshipsCount: totalRelationshipsCount,
    },
    systemStats: {
      requestsCount: isInitialized ? agent.llmRegistry?.getActiveProvider()?.getUsageStats()?.requestsTotal || 0 : 0,
      tokensUsed: isInitialized ? agent.llmRegistry?.getActiveProvider()?.getUsageStats()?.tokensUsedTotal || 0 : 0
    }
  };
}

module.exports = { getSubsystemHealth };
