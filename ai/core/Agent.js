/**
 * Agent - Main orchestrator for AI agent functionality
 */

const { EmbeddingService } = require('../embeddings');
const { GraphDB, GraphService, GraphBuilder } = require('../graph');
const { LogDB } = require('../logs');
const { LLMRegistry } = require('../providers');

class Agent {
  constructor(llmRegistry = null) {
    this.llmRegistry = llmRegistry || new LLMRegistry();
    this.logDb = null;
    this.embeddingService = new EmbeddingService(null, null);
    this.graphDb = null;
    this.graphService = null;
    this.graphBuilder = null;
    this.graphProvider = null;

    this.isInitialized = false;
    this.workspaceRoot = null;
  }

  setGraphProvider(provider) {
    this.graphProvider = provider;
  }

  /**
   * Inject (or replace) the embedding provider after construction.
   * Called by initializeAISystem once the HuggingFace token is resolved.
   */
  setEmbeddingProvider(provider) {
    this.embeddingService.setProvider(provider);
  }

  /**
   * Initialize agent for workspace
   */
  async initialize(workspaceRoot, llmProvider = null) {
    try {
      console.log('[Agent] Initializing...');

      if (llmProvider && this.llmRegistry) {
        await this.llmRegistry.activateProvider(llmProvider.name, llmProvider.config);
      }

      // Store workspace root
      this.workspaceRoot = workspaceRoot;


      // Initialize LogDB for prompt and AI logging
      this.logDb = new LogDB(workspaceRoot);
      this.logDb.initialize();

      // Initialize TelemetryDB for isolated flow execution telemetry
      const { TelemetryDB } = require('../telemetry');
      this.telemetryDb = new TelemetryDB(workspaceRoot);
      this.telemetryDb.initialize();

      // Initialize GraphDB
      this.graphDb = new GraphDB(workspaceRoot);
      this.graphDb.initialize();
      this.graphService = new GraphService(this, this.graphDb);
      this.graphBuilder = new GraphBuilder(this, this.graphDb, this.graphService);

      this.isInitialized = true;

      console.log('[Agent] Initialized successfully');
      return {
        success: true
      };
    } catch (error) {
      console.error('[Agent] Initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Build relationship graph
   */
  async buildRelationshipGraph(onProgress = null) {
    if (!this.graphBuilder) {
      return { success: false, error: 'Graph builder not initialized' };
    }
    return this.graphBuilder.rebuild(onProgress);
  }

  /**
   * Log prompt execution to LogDB
   */
  logPrompt(query, systemPrompt, metadata = {}) {
    if (this.logDb && this.logDb.isInitialized) {
      const displayQuery = query ? String(query).slice(0, 80) : 'N/A';
      this.logDb.addLog('PromptTracker', `Prompt executed for query: "${displayQuery}"`, 'info', {
        query,
        systemPrompt,
        ...metadata
      });
    }
  }

  /**
   * Get agent status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      workspaceRoot: this.workspaceRoot,
      embeddingProvider: this.embeddingService.embeddingProvider?.name || null,
      embeddingsAvailable: this.embeddingService.isAvailable(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Reset agent
   */
  reset() {
    this.embeddingService.clearCache();
    console.log('[Agent] Reset successfully');
  }

  /**
   * Shutdown agent
   */
  shutdown() {
    try {
      this.reset();
      if (this.indexWorker) {
        this.indexWorker.pause();
        this.indexWorker = null;
      }
      if (this.embeddingDb) {
        this.embeddingDb.close();
        this.embeddingDb = null;
      }
      if (this.graphDb) {
        this.graphDb.close();
        this.graphDb = null;
      }
      this.isInitialized = false;
      console.log('[Agent] Shutdown complete');
    } catch (error) {
      console.error('[Agent] Shutdown error:', error.message);
    }
  }
}

module.exports = Agent;
