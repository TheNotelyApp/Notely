/**
 * AIService - Central coordinator for the backend AI subsystem
 */

const AIConfig = require('./AIConfig');
const { createLogger } = require('./logger');

const log = createLogger('AIService');

class AIService {
  constructor() {
    this.agent = null;
    this.config = new AIConfig();
    this.enabled = true;
    this.workspaceRoot = null;
    this.appDataDir = null;
    this.loadState();
  }

  loadState() {
    try {
      const prefs = this.config.loadPreferences();
      this.enabled = prefs.aiEnabled !== false; // default to true
    } catch (err) {
      log.error('Failed to load state:', err.message);
      this.enabled = true;
    }
  }

  async initialize(appDataDir, workspaceRoot, llmProvider, embeddingConfig = null) {
    this.appDataDir = appDataDir;
    this.workspaceRoot = workspaceRoot;

    if (!this.enabled) {
      log.info('AI is disabled by master switch. Skipping initialization.');
      return { success: true, message: 'AI is disabled' };
    }

    try {
      log.info('Initializing AI Service...');
      // Dynamic require of index.js bootstrap to initialize the agent
      const { initializeAISystem } = require('../index.js');
      const result = await initializeAISystem(appDataDir, workspaceRoot, llmProvider, embeddingConfig);
      const { getAIAgent } = require('../index.js');
      this.agent = getAIAgent();
      log.info('AI Service successfully initialized');
      return result;
    } catch (error) {
      log.error('Failed to initialize AI Service:', error.message);
      throw error;
    }
  }

  isEnabled() {
    return this.enabled;
  }

  async enableAI() {
    if (this.enabled) return;
    this.enabled = true;
    log.info('AI master switch toggled: ENABLED');
    
    // Save state
    const prefs = this.config.loadPreferences();
    prefs.aiEnabled = true;
    this.config.savePreferences(prefs);

    // If we have paths, trigger full initialization
    if (this.appDataDir && this.workspaceRoot) {
      const { PROVIDER_REGISTRY } = require('../providers/ProviderRegistry');
      const activeProviderName = prefs.aiProvider || 'gemini';
      
      let llmProvider = null;
      const activeApiKey = this.config.getAPIKey(activeProviderName);

      if (activeApiKey) {
        const savedModel = this.config.getProviderModel(activeProviderName);
        const entry = PROVIDER_REGISTRY[activeProviderName];
        llmProvider = {
          name: activeProviderName,
          config: { apiKey: activeApiKey, model: savedModel || entry?.defaultModel },
        };
      } else {
        for (const entry of Object.values(PROVIDER_REGISTRY)) {
          if (!entry.available) continue;
          const apiKey = this.config.getAPIKey(entry.id);
          if (apiKey) {
            const savedModel = this.config.getProviderModel(entry.id);
            llmProvider = {
              name: entry.id,
              config: { apiKey, model: savedModel || entry.defaultModel },
            };
            break;
          }
        }
      }
      const hfToken = this.config.getAPIKey('huggingface');
      const embeddingConfig = hfToken ? { token: hfToken } : null;

      await this.initialize(this.appDataDir, this.workspaceRoot, llmProvider, embeddingConfig);
    }
  }

  async disableAI() {
    if (!this.enabled) return;
    this.enabled = false;
    log.info('AI master switch toggled: DISABLED');

    // Save state
    const prefs = this.config.loadPreferences();
    prefs.aiEnabled = false;
    this.config.savePreferences(prefs);

    // Shutdown running subsystems
    const { shutdownAISystem } = require('../index.js');
    shutdownAISystem();
    this.agent = null;
  }

  shutdown() {
    const { shutdownAISystem } = require('../index.js');
    shutdownAISystem();
    this.agent = null;
    log.info('AI Service shut down');
  }

  /**
   * Main chat query wrapper
   */
  async chat(message, context = {}) {
    if (!this.enabled || !this.agent) {
      throw new Error('AI is currently disabled or uninitialized.');
    }
    
    // Wire call directly into current Agent orchestrator
    return this.agent.query(message, context);
  }
}

const aiServiceInstance = new AIService();

module.exports = {
  aiService: aiServiceInstance
};
