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

      const AIFlow = require('./AIFlow');
      this.aiFlow = new AIFlow(this.agent);
      this.agent.aiFlow = this.aiFlow;

      log.info('AI Service & AIFlow Orchestrator successfully initialized');
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
    this.aiFlow = null;
  }

  shutdown() {
    const { shutdownAISystem } = require('../index.js');
    shutdownAISystem();
    this.agent = null;
    this.aiFlow = null;
    log.info('AI Service shut down');
  }

  /**
   * Note save hook - enqueues note indexing in background worker process
   */
  onNoteSave(filePath) {
    if (!this.enabled || !this.agent) return;

    // Enqueue in background worker process (handles both embeddings & graph extraction)
    try {
      const workerManager = require('../../electron/ai/workerManager.cjs');
      workerManager.enqueueNote(filePath, 0);
    } catch (err) {
      log.error(`Failed to enqueue note for background indexing: ${filePath}`, err.message);
    }
  }

  /**
   * Note delete hook - purges note chunks and graph relationships via workerManager
   */
  onNoteDelete(filePath) {
    if (!this.enabled || !this.agent) return;

    try {
      const workerManager = require('../../electron/ai/workerManager.cjs');
      workerManager.deleteNoteData(filePath);
      log.info(`Enqueued background deletion for note embeddings & graph: ${filePath}`);
    } catch (err) {
      log.error(`Failed to delete background note data: ${filePath}`, err.message);
    }

    if (this.agent.graphDb && !this.agent.workerManager) {
      try {
        this.agent.graphDb.deleteNoteEntityAndRelationships(filePath);
      } catch { /* ignore fallback */ }
    }
  }

  /**
   * Note rename hook - updates note path mappings in background worker process
   */
  onNoteRename(oldPath, newPath) {
    if (!this.enabled || !this.agent) return;

    try {
      const workerManager = require('../../electron/ai/workerManager.cjs');
      workerManager.renameNoteData(oldPath, newPath);
      log.info(`Triggered note paths rename in background DBs from ${oldPath} to ${newPath}`);
    } catch (err) {
      log.error(`Failed to rename note paths in background DBs:`, err.message);
    }
  }

  async chat(message, context = {}) {
    if (!this.enabled || !this.agent) {
      throw new Error('AI is currently disabled or uninitialized.');
    }
    if (!this.aiFlow) {
      const AIFlow = require('./AIFlow');
      this.aiFlow = new AIFlow(this.agent);
      this.agent.aiFlow = this.aiFlow;
    }
    return this.aiFlow.execute(message, context);
  }

  /**
   * Main chat query streaming wrapper
   */
  async stream(message, context = {}, onChunk, abortSignal) {
    if (!this.enabled || !this.agent) {
      throw new Error('AI is currently disabled or uninitialized.');
    }
    if (!this.aiFlow) {
      const AIFlow = require('./AIFlow');
      this.aiFlow = new AIFlow(this.agent);
      this.agent.aiFlow = this.aiFlow;
    }
    return this.aiFlow.stream(message, context, onChunk, abortSignal);
  }

  // --- Facade API Methods for Subsystem Modules ---

  getGraphStatus() {
    return this.agent?.graphDb ? this.agent.graphDb.getStatus() : null;
  }

  getGraphData() {
    return this.agent?.graphDb ? this.agent.graphDb.getAll() : null;
  }

  clearGraphData() {
    if (this.agent?.graphDb) {
      this.agent.graphDb.clearAllData();
    }
  }

  async buildGraph(onProgress) {
    return this.agent ? this.agent.buildRelationshipGraph(onProgress) : { success: false, error: 'Agent not initialized' };
  }

  getEmbeddingStats() {
    return this.agent?.embeddingDb ? this.agent.embeddingDb.getStats() : null;
  }

  clearEmbeddingData() {
    if (this.agent?.embeddingDb) {
      this.agent.embeddingDb.clearAllData();
    }
  }

  async generateEmbeddings(forceRefresh = false) {
    return this.agent ? this.agent.generateEmbeddings(forceRefresh) : { success: false, error: 'Agent not initialized' };
  }

  detectPatterns() {
    return this.agent ? this.agent.detectPatterns() : { success: false, error: 'Agent not initialized' };
  }

  getConversationStore() {
    return this.agent?.conversationStore || null;
  }

  getPersonaManager() {
    return this.agent?.personaManager || null;
  }
}

const aiServiceInstance = new AIService();

module.exports = {
  aiService: aiServiceInstance
};
