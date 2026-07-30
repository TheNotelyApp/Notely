const { createLogger, setLogLevel, LEVELS } = require('./logger');
const { aiService } = require('./AIService');

module.exports = {
  createLogger,
  setLogLevel,
  LEVELS,
  aiService,
  get Agent() { return require('./Agent'); },
  get AIFlow() { return require('./AIFlow'); },
  get AIConfig() { return require('./AIConfig'); },
  get AIService() { return require('./AIService'); },
  createAgent: (databaseManager, llmRegistry) => {
    const Agent = require('./Agent');
    return new Agent(databaseManager, llmRegistry);
  },
  createAIFlow: (agent) => {
    const AIFlow = require('./AIFlow');
    return new AIFlow(agent);
  },
  createAIConfig: () => {
    const AIConfig = require('./AIConfig');
    return new AIConfig();
  }
};


