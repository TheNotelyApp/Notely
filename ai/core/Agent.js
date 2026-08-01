/**
 * Agent - Main orchestrator for AI agent functionality
 */

const { DocumentReader: DocumentService } = require('../tools');
const { EmbeddingService } = require('../embeddings');
const { QueryExecutor } = require('../executor');
const { ContextManager } = require('../context');
const { InteractionLog: MemoryManager } = require('../memory');
const { GraphDB, GraphService, GraphBuilder } = require('../graph');

const { ContextOrchestrator } = require('../planner');

const { PromptLoader, PromptPipeline } = require('../prompts');
const { PersonaManager } = require('../personas');
const { LogDB } = require('../logs');

class Agent {
  constructor(databaseManager, llmRegistry) {
    this.db = databaseManager;
    this.llmRegistry = llmRegistry;
    this.logDb = null;

    // Prompt Architecture Infrastructure
    this.promptLoader = new PromptLoader();
    this.promptPipeline = new PromptPipeline(this.promptLoader);
    this.personaManager = new PersonaManager(this.promptLoader);

    // Initialize Context Orchestrator
    this.contextOrchestrator = new ContextOrchestrator(this);

    // Initialize services — EmbeddingService receives null here; the actual
    // embeddingProvider is injected after construction via setEmbeddingProvider()
    // (called from initializeAISystem once the HF token is resolved).
    this.documentService = new DocumentService(this.db, '');
    this.embeddingService = new EmbeddingService(this.db, null);
    this.relationshipService = null;
    this.queryExecutor = new QueryExecutor(this);
    this.contextManager = new ContextManager(this.db, this.documentService);
    this.memoryManager = new MemoryManager(this.db);

    this.graphDb = null;
    this.graphService = null;
    this.graphBuilder = null;
    this.graphProvider = null;

    this.isInitialized = false;
    this.workspaceRoot = null;
    this.aiFlow = null;
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
  async initialize(workspaceRoot, llmProvider) {
    try {
      console.log('[Agent] Initializing...');

      // Activate LLM provider
      if (llmProvider) {
        await this.llmRegistry.activateProvider(llmProvider.name, llmProvider.config);
      }

      // Store workspace root
      this.workspaceRoot = workspaceRoot;
      this.documentService.workspaceRoot = workspaceRoot;

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

      // Initialize database
      if (!this.db.isInitialized) {
        this.db.initialize();
      }

      // Initialize context for workspace
      const contextResult = await this.contextManager.initializeWorkspace(workspaceRoot);

      this.isInitialized = true;

      console.log('[Agent] Initialized successfully');
      return {
        success: true,
        ...contextResult
      };
    } catch (error) {
      console.error('[Agent] Initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Process a query via AIFlow orchestrator
   */
  async query(userQuery, context = {}) {
    if (!this.isInitialized) {
      throw new Error('Agent not initialized');
    }

    if (this.aiFlow) {
      return this.aiFlow.execute(userQuery, context);
    }

    const AIFlow = require('./AIFlow');
    this.aiFlow = new AIFlow(this);
    return this.aiFlow.execute(userQuery, context);
  }

  /**
   * Process a query with streaming output via AIFlow orchestrator
   */
  async stream(userQuery, context = {}, onChunk, abortSignal) {
    if (!this.isInitialized) {
      throw new Error('Agent not initialized');
    }

    if (this.aiFlow) {
      return this.aiFlow.stream(userQuery, context, onChunk, abortSignal);
    }

    const AIFlow = require('./AIFlow');
    this.aiFlow = new AIFlow(this);
    return this.aiFlow.stream(userQuery, context, onChunk, abortSignal);
  }

  /**
   * Generate embeddings for workspace
   */
  async generateEmbeddings(_forceRefresh = false) {
    try {
      const docs = this.documentService.getAllDocuments();
      console.log(`[Agent] Generating embeddings for ${docs.length} documents...`);

      const results = await this.embeddingService.generateBatchEmbeddings(docs);

      const successful = results.filter(r => r.success).length;
      console.log(`[Agent] Successfully generated ${successful}/${docs.length} embeddings`);

      return {
        success: true,
        embeddingsGenerated: successful,
        total: docs.length,
        results
      };
    } catch (error) {
      console.error('[Agent] Embedding generation failed:', error.message);
      return {
        success: false,
        error: error.message
      };
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
   * Learn from interactions
   */
  detectPatterns() {
    try {
      const patterns = this.memoryManager.detectPatterns(this.workspaceRoot);
      console.log(`[Agent] Detected ${patterns.length} patterns`);

      return {
        success: true,
        patternsDetected: patterns.length,
        patterns
      };
    } catch (error) {
      console.error('[Agent] Pattern detection failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Log LLM prompt execution to LogDB (PromptTracker)
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
      llmProvider: this.llmRegistry.activeProvider?.name || null,
      embeddingProvider: this.embeddingService.embeddingProvider?.name || null,
      embeddingsAvailable: this.embeddingService.isAvailable(),
      documentCount: this.documentService.getAllDocuments().length,
      sessionInfo: this.memoryManager.getSessionSummary(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Reset agent
   */
  reset() {
    this.memoryManager.clearSession();
    this.contextManager.clearCache();
    this.embeddingService.clearCache();
    if (this.relationshipService?.clearCache) {
      this.relationshipService.clearCache();
    }
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
      }
      if (this.db && this.db.isInitialized) {
        this.db.close();
      }
      this.isInitialized = false;
      console.log('[Agent] Shutdown complete');
    } catch (error) {
      console.error('[Agent] Shutdown error:', error.message);
    }
  }
}

module.exports = Agent;
