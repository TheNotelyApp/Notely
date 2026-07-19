/**
 * AIService - Single entry point and interface for the backend AI subsystem
 */

const { initializeAISystem, shutdownAISystem, getAIAgent, getAIConfig } = require('../index.js');
const { createLogger } = require('./logger');

const log = createLogger('AIService');

class AIService {
  constructor() {
    this.agent = null;
    this.config = null;
    this.enabled = true;
  }

  async initialize(appDataDir, workspaceRoot, llmProvider, embeddingConfig = null) {
    log.info('Initializing AI Service...');
    const result = await initializeAISystem(appDataDir, workspaceRoot, llmProvider, embeddingConfig);
    this.agent = getAIAgent();
    this.config = getAIConfig();
    return result;
  }

  isEnabled() {
    return this.enabled;
  }

  enableAI() {
    this.enabled = true;
    log.info('AI Service enabled');
  }

  disableAI() {
    this.enabled = false;
    log.info('AI Service disabled');
  }

  shutdown() {
    shutdownAISystem();
    this.agent = null;
    log.info('AI Service shut down');
  }
}

const aiServiceInstance = new AIService();

module.exports = {
  aiService: aiServiceInstance,
  initializeAISystem,
  shutdownAISystem,
  getAIAgent,
  getAIConfig
};
