/**
 * AI Agent IPC Handlers for Electron Main Process
 * Handles communication between React frontend and AI agent backend
 */

/* eslint-disable no-unused-vars */
const { ipcMain, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

let IPC_EVENTS, AIQueryRequest, AIQueryResponse;

try {
  // Packaged: ai/ lives at app root (from `files: ["ai/**/*"]`).
  // Dev: src/ai/utils/ is the source location.
  const rootAiProtocolPath = path.join(__dirname, '..', '..', 'ai', 'utils', 'ipcProtocol.js');
  const srcProtocolPath = path.join(__dirname, '..', '..', 'src', 'ai', 'utils', 'ipcProtocol.js');
  const ipcProtocolPath = fs.existsSync(rootAiProtocolPath) ? rootAiProtocolPath : srcProtocolPath;
  ({ IPC_EVENTS, AIQueryRequest, AIQueryResponse } = require(ipcProtocolPath));
} catch (err) {
  console.error('[AI] Failed to load ipcProtocol:', err.message);
  console.error('[AI] Stack:', err.stack);
  // Fallback: define minimal IPC_EVENTS to prevent complete crash
  IPC_EVENTS = {
    AI_INIT: 'ai:init',
    AI_STATUS: 'ai:status',
    AI_GENERATE_EMBEDDINGS: 'ai:embeddings:generate',
    AI_BUILD_GRAPH: 'ai:graph:build',
    AI_DETECT_PATTERNS: 'ai:patterns:detect',
    AI_SET_API_KEY: 'ai:config:set-api-key',
    AI_GET_API_KEY: 'ai:config:get-api-key',
    AI_SHUTDOWN: 'ai:shutdown'
  };
  AIQueryRequest = class {
    constructor(query, context = {}) {
      this.query = query;
      this.context = context;
      this.timestamp = new Date().toISOString();
    }
  };
  AIQueryResponse = class {
    constructor(success, data = {}, error = null) {
      this.success = success;
      this.data = data;
      this.error = error;
      this.timestamp = new Date().toISOString();
    }
  };
}

const { aiService } = require('../../ai/core/AIService');
const { applicationToolRegistry } = require('../tools/ApplicationToolRegistry.cjs');
let handlersRegistered = false;

// --- Input validation & sender trust guards -------------------------------


// Input size limits (kept for config/payload validation)
const MIN_API_KEY_LENGTH = 1;
const MAX_API_KEY_LENGTH = 2048;
const { PROVIDER_REGISTRY, ALLOWED_PROVIDER_IDS: ALLOWED_PROVIDERS } = require('../../ai/providers/ProviderRegistry');

/**
 * Only accept IPC originating from a top-level application BrowserWindow frame.
 * Rejects calls from subframes / detached / unknown senders.
 */
function isTrustedSender(event) {
  try {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed()) {
      return false;
    }
    const frame = event.senderFrame;
    // A top frame has no parent; reject any embedded frame.
    if (frame && frame.parent) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function assertProvider(provider) {
  const name = String(provider || '').trim().toLowerCase();
  if (!ALLOWED_PROVIDERS.has(name)) {
    throw new Error('Unsupported AI provider.');
  }
  return name;
}

function assertApiKey(apiKey) {
  if (typeof apiKey !== 'string') {
    throw new Error('Invalid API key.');
  }
  const trimmed = apiKey.trim();
  if (trimmed.length < MIN_API_KEY_LENGTH || trimmed.length > MAX_API_KEY_LENGTH) {
    throw new Error('Invalid API key length.');
  }
  return trimmed;
}

function maskApiKey(apiKey) {
  const key = String(apiKey || "").trim();
  if (!key) return "";
  if (key.length <= 8) return `${key.slice(0, 2)}***${key.slice(-2)}`;
  return `${key.slice(0, 5)}...${key.slice(-5)}`;
}



function registerHandler(channel, handler) {
  if (!channel || typeof channel !== 'string') {
    throw new Error(`Invalid AI IPC channel: ${channel}`);
  }
  ipcMain.handle(channel, async (event, payload) => {
    if (!isTrustedSender(event)) {
      console.warn(`[AI IPC] Rejected untrusted sender on channel: ${channel}`);
      return new AIQueryResponse(false, null, 'Untrusted IPC sender rejected.');
    }
    return handler(event, payload);
  });
}



/**
 * Initialize IPC handlers
 */
function initializeAIHandlers(electronApp, agent) {
  if (agent) {
    aiService.agent = agent;
    applicationToolRegistry.setAgentInstance(agent);
    
    // Dynamically initialize embeddingDb and indexWorker if not present
    if (!agent.embeddingDb && agent.workspaceRoot) {
      try {
        const EmbeddingDB = require('../../ai/embeddings/EmbeddingDB');
        agent.embeddingDb = new EmbeddingDB(agent.workspaceRoot);
        agent.embeddingDb.initialize();
      } catch (err) {
        console.error('[AI IPC] Failed to dynamically initialize EmbeddingDB:', err);
      }
    }
    if (!agent.indexWorker && agent.embeddingDb && agent.workspaceRoot) {
      try {
        const IndexQueue = require('../../ai/queue/IndexQueue');
        const IndexWorker = require('../../ai/queue/IndexWorker');
        const queue = new IndexQueue(agent.embeddingDb);
        agent.indexWorker = new IndexWorker(agent.embeddingDb, queue, agent.embeddingService);
        agent.indexWorker.start();
      } catch (err) {
        console.error('[AI IPC] Failed to dynamically initialize IndexWorker:', err);
      }
    }
  }
  if (handlersRegistered) {
    return;
  }

  // Application Tool Registry Handlers
  registerHandler(IPC_EVENTS.TOOL_EXECUTE, async (event, payload) => {
    const { toolName, args = {}, context = {} } = payload || {};
    const workspaceRoot = agent?.workspaceRoot || context.workspaceRoot || null;
    return applicationToolRegistry.executeTool(toolName, args, { ...context, workspaceRoot, caller: 'ipc_client' });
  });

  registerHandler(IPC_EVENTS.TOOL_LIST, async () => {
    return {
      success: true,
      data: applicationToolRegistry.toMcpSchemas()
    };
  });

  // AI Initialization
  registerHandler(IPC_EVENTS.AI_INIT, handleInitialize);

  // Status
  registerHandler(IPC_EVENTS.AI_STATUS, handleStatus);

  // Embeddings
  registerHandler(IPC_EVENTS.AI_GENERATE_EMBEDDINGS, handleGenerateEmbeddings);

  // Relationship graph
  registerHandler(IPC_EVENTS.AI_BUILD_GRAPH, handleBuildGraph);
  registerHandler(IPC_EVENTS.AI_GRAPH_GET, handleGetGraph);
  registerHandler(IPC_EVENTS.AI_GRAPH_STATUS, handleGetGraphStatus);
  registerHandler(IPC_EVENTS.AI_GRAPH_PAUSE, handlePauseGraphWorker);
  registerHandler(IPC_EVENTS.AI_GRAPH_RESUME, handleResumeGraphWorker);
  registerHandler(IPC_EVENTS.AI_GRAPH_EXPORT_JSON, handleExportGraphAsJSON);
  registerHandler(IPC_EVENTS.AI_GRAPH_EXPORT_MD, handleExportGraphAsMarkdown);

  // Embeddings Engine Subsystem
  registerHandler(IPC_EVENTS.AI_EMBEDDINGS_REBUILD, handleRebuildEmbeddings);
  registerHandler(IPC_EVENTS.AI_EMBEDDINGS_CLEAR, handleClearEmbeddingsData);
  registerHandler(IPC_EVENTS.AI_EMBEDDINGS_STATUS, handleGetEmbeddingsStatus);
  registerHandler(IPC_EVENTS.AI_GRAPH_CLEAR, handleClearGraphData);
  registerHandler(IPC_EVENTS.AI_WORKER_PAUSE, handlePauseWorker);
  registerHandler(IPC_EVENTS.AI_WORKER_RESUME, handleResumeWorker);
  registerHandler(IPC_EVENTS.AI_MODEL_DOWNLOAD, handleDownloadModel);
  registerHandler(IPC_EVENTS.AI_MODEL_DELETE, handleDeleteModel);
  registerHandler(IPC_EVENTS.AI_MODEL_STATUS, handleGetModelStatus);
  registerHandler(IPC_EVENTS.AI_GRAPH_MODEL_DOWNLOAD, handleDownloadGraphModel);
  registerHandler(IPC_EVENTS.AI_GRAPH_MODEL_DELETE, handleDeleteGraphModel);
  registerHandler(IPC_EVENTS.AI_GRAPH_MODEL_STATUS, handleGetGraphModelStatus);



  // Persistent Log Store
  registerHandler(IPC_EVENTS.AI_LOGS_GET, handleGetLogs);
  registerHandler(IPC_EVENTS.AI_LOGS_CLEAR, handleClearLogs);

  // Note stats
  registerHandler(IPC_EVENTS.AI_NOTE_STATS, handleNoteStats);

  // Configuration
  registerHandler(IPC_EVENTS.AI_SET_API_KEY, handleSetAPIKey);
  registerHandler(IPC_EVENTS.AI_GET_API_KEY, handleGetAPIKey);
  registerHandler(IPC_EVENTS.AI_GET_PREFERENCES, handleGetPreferences);
  registerHandler(IPC_EVENTS.AI_SET_PREFERENCES, handleSetPreferences);
  registerHandler(IPC_EVENTS.AI_GET_PROVIDER_MODEL, handleGetProviderModel);
  registerHandler(IPC_EVENTS.AI_SET_PROVIDER_MODEL, handleSetProviderModel);
  registerHandler(IPC_EVENTS.AI_TEST_CONNECTION, handleTestConnection);
  registerHandler(IPC_EVENTS.AI_CLEAR_DATA, handleClearData);
  registerHandler(IPC_EVENTS.AI_GET_PROVIDER_LIST, handleGetProviderList);
  registerHandler(IPC_EVENTS.AI_ENABLE, handleEnableAI);
  registerHandler(IPC_EVENTS.AI_DISABLE, handleDisableAI);
  registerHandler(IPC_EVENTS.AI_HEALTH_GET, handleGetAIHealth);

  // Shutdown
  registerHandler(IPC_EVENTS.AI_SHUTDOWN, handleShutdown);

  handlersRegistered = true;
}

/**
 * Handle agent initialization
 */
async function handleInitialize(event, payload) {
  try {
    if (!aiService.isEnabled()) {
      throw new Error('AI is disabled by master switch.');
    }

    const { app } = require('electron');
    const appDataDir = path.join(app.getPath('appData'), 'Notely');
    
    const activeProject = payload?.activeProject;
    const notesRoot = payload?.notesRoot;
    const workspaceRoot = path.resolve(activeProject?.rootPath || notesRoot);

    const AIConfig = require('../../ai/core/AIConfig');
    const { PROVIDER_REGISTRY } = require('../../ai/providers/ProviderRegistry');
    const config = new AIConfig();

    const prefs = config.loadPreferences();
    const activeProviderName = prefs.aiProvider || 'gemini';

    let llmProvider = null;
    const activeApiKey = config.getAPIKey(activeProviderName);

    if (activeApiKey || activeProviderName === 'local') {
      const savedModel = config.getProviderModel(activeProviderName);
      const entry = PROVIDER_REGISTRY[activeProviderName];
      llmProvider = {
        name: activeProviderName,
        config: { apiKey: activeApiKey, model: savedModel || entry?.defaultModel },
      };
    } else {
      for (const entry of Object.values(PROVIDER_REGISTRY)) {
        if (!entry.available) continue;
        const apiKey = config.getAPIKey(entry.id);
        if (apiKey) {
          const savedModel = config.getProviderModel(entry.id);
          llmProvider = {
            name: entry.id,
            config: { apiKey, model: savedModel || entry.defaultModel },
          };
          break;
        }
      }
    }

    const hfToken = config.getAPIKey("huggingface");
    const embeddingConfig = hfToken ? { token: hfToken } : null;

    const result = await aiService.initialize(appDataDir, workspaceRoot, llmProvider, embeddingConfig);

    // Apply saved graphProvider preference (gliner2-relex ONNX vs text-provider Cloud LLM)
    if (aiService.agent) {
      if (prefs.graphProvider === 'text-provider') {
        const activeProvider = aiService.agent.llmRegistry?.getActiveProvider();
        aiService.agent.setGraphProvider(activeProvider);
      } else {
        try {
          const GraphModelDownloader = require('../../ai/graph/GraphModelDownloader');
          const modelDownloader = new GraphModelDownloader(appDataDir);
          if (modelDownloader.isModelDownloaded()) {
            aiService.agent.setGraphProvider('gliner2-relex');
          } else {
            aiService.agent.setGraphProvider(null);
          }
        } catch (graphErr) {
          console.warn('[AI IPC] Local GLiNER2-Relex ONNX graph provider init notice:', graphErr.message);
        }
      }
    }

    return new AIQueryResponse(true, result);
  } catch (error) {
    console.error('[AI IPC] Initialization failed:', error);
    return new AIQueryResponse(false, null, error.message);
  }
}

/**
 * Handle status request
 */
async function handleStatus(_event, _payload) {
  try {
    return new AIQueryResponse(true, {
      enabled: aiService.isEnabled(),
      initialized: Boolean(aiService.agent?.isInitialized),
      status: aiService.agent ? aiService.agent.getStatus() : null
    });
  } catch (error) {
    console.error('[AI IPC] Status request failed:', error);
    return new AIQueryResponse(false, null, error.message);
  }
}

/**
 * Handle embeddings generation
 */
async function handleGenerateEmbeddings(event, payload) {
  try {
    if (!aiService.isEnabled() || !aiService.agent) {
      throw new Error('AI agent is disabled or not initialized');
    }

    const result = await aiService.agent.generateEmbeddings(payload?.forceRefresh || false);
    return new AIQueryResponse(true, result);
  } catch (error) {
    console.error('[AI IPC] Embeddings generation failed:', error);
    return new AIQueryResponse(false, null, error.message);
  }
}

async function handleRebuildEmbeddings(_event, _payload) {
  try {
    if (!aiService.isEnabled() || !aiService.agent || !aiService.agent.embeddingDb) {
      throw new Error('AI agent or EmbeddingDB is not initialized');
    }

    const { LogDB } = require('../../ai/logs');
    const logDb = new LogDB(aiService.agent.workspaceRoot);
    logDb.initialize();
    logDb.addLog('embeddings', 'Starting complete Embeddings DB rebuild...', 'info');

    aiService.agent.embeddingDb.clearAllData();

    const workerManager = require('./workerManager.cjs');
    
    // Populate queue with all markdown files in workspace
    const docs = aiService.agent.documentService.getAllDocuments();
    let count = 0;
    if (docs && docs.length > 0) {
      for (const doc of docs) {
        const filePath = doc?.path || doc?.filePath;
        if (filePath) {
          workerManager.enqueueNote(filePath, 0);
          count++;
        }
      }
    }

    logDb.addLog('embeddings', `Cleared database and enqueued ${count} notes for embedding generation`, 'info');
    logDb.close();

    return new AIQueryResponse(true, { message: 'Embeddings db cleared and rebuild triggered' });
  } catch (error) {
    console.error('[AI IPC] Embeddings rebuild failed:', error);
    return new AIQueryResponse(false, null, error.message);
  }
}

async function handleClearEmbeddingsData(_event, _payload) {
  try {
    if (!aiService.isEnabled() || !aiService.agent || !aiService.agent.embeddingDb) {
      throw new Error('AI agent or EmbeddingDB is not initialized');
    }
    aiService.agent.embeddingDb.clearAllData();
    const { LogDB } = require('../../ai/logs');
    const logDb = new LogDB(aiService.agent.workspaceRoot);
    logDb.initialize();
    logDb.addLog('embeddings', 'Cleared all vector embeddings data from cache', 'info');
    logDb.close();
    return new AIQueryResponse(true, { message: 'Embeddings data cleared' });
  } catch (error) {
    console.error('[AI IPC] Clear embeddings failed:', error);
    return new AIQueryResponse(false, null, error.message);
  }
}

async function handleClearGraphData(_event, _payload) {
  try {
    if (!aiService.isEnabled() || !aiService.agent || !aiService.agent.graphDb) {
      throw new Error('AI agent or GraphDB is not initialized');
    }
    aiService.agent.graphDb.clearAllData();
    const { LogDB } = require('../../ai/logs');
    const logDb = new LogDB(aiService.agent.workspaceRoot);
    logDb.initialize();
    logDb.addLog('graph', 'Cleared all Knowledge Graph entities and relationships from cache', 'info');
    logDb.close();
    return new AIQueryResponse(true, { message: 'Knowledge Graph data cleared' });
  } catch (error) {
    console.error('[AI IPC] Clear graph failed:', error);
    return new AIQueryResponse(false, null, error.message);
  }
}

async function handleGetEmbeddingsStatus(_event, payload) {
  try {
    let db = aiService.agent?.embeddingDb;
    let tempDb = null;
    const workspaceRoot = aiService.workspaceRoot || aiService.agent?.workspaceRoot || null;

    if (!db && workspaceRoot) {
      try {
        const EmbeddingDB = require('../../ai/embeddings/EmbeddingDB');
        tempDb = new EmbeddingDB(workspaceRoot);
        tempDb.initialize();
        db = tempDb;
      } catch (err) {
        console.error('[AI IPC] Temp EmbeddingDB init failed:', err);
      }
    }

    if (!db) {
      return new AIQueryResponse(true, {
        totalChunks: 0,
        indexedNotes: 0,
        queueSize: 0,
        isPaused: true,
        isWorking: false,
        chunks: [],
        logs: [],
        uninitialized: true
      });
    }

    const workerManager = require('./workerManager.cjs');
    const search = payload?.search || '';
    const limit = payload?.limit || 50;
    const offset = payload?.offset || 0;

    const chunks = db.getAllChunks(search, limit, offset);
    const totalChunks = db.getChunkCount();
    const indexedNotes = db.getIndexedNotesCount();
    const queueStats = db.getQueueSize();
    const logs = typeof db.getLogs === 'function' ? db.getLogs(30) : [];

    let dbSize = '0 KB';
    try {
      if (db.dbPath && fs.existsSync(db.dbPath)) {
        const stats = fs.statSync(db.dbPath);
        const bytes = stats.size;
        if (bytes < 1024 * 1024) {
          dbSize = `${(bytes / 1024).toFixed(1)} KB`;
        } else {
          dbSize = `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        }
      }
    } catch (err) {
      console.error('[AI IPC] Failed to check db size:', err);
    }

    if (tempDb) {
      try { tempDb.close(); } catch { /* ignore */ }
    }

    return new AIQueryResponse(true, {
      totalChunks,
      indexedNotes,
      queueSize: queueStats.pending,
      queueTotal: queueStats.total,
      isPaused: workerManager.isPaused === true,
      isWorking: workerManager.isWorking === true,
      chunks,
      logs,
      dbSize,
      uninitialized: false
    });
  } catch (error) {
    console.error('[AI IPC] Get embeddings status failed:', error);
    return new AIQueryResponse(false, null, error.message);
  }
}

async function handleNoteStats(_event, payload) {
  try {
    const notePath = payload?.notePath;
    if (!notePath) return new AIQueryResponse(false, null, 'notePath is required.');
    const agent = aiService.agent;
    const chunkCount = agent && agent.embeddingDb ? agent.embeddingDb.getNoteChunkCount(notePath) : 0;
    const edgeCount = agent && agent.graphDb ? agent.graphDb.getNoteRelationshipCount(notePath) : 0;
    return new AIQueryResponse(true, { chunkCount, edgeCount });
  } catch (err) {
    return new AIQueryResponse(false, null, err.message);
  }
}

async function handlePauseWorker(_event, _payload) {
  try {
    const workerManager = require('./workerManager.cjs');
    workerManager.pauseWorker();
    return new AIQueryResponse(true, { paused: true });
  } catch (error) {
    return new AIQueryResponse(false, null, error.message);
  }
}

async function handleResumeWorker(_event, _payload) {
  try {
    const workerManager = require('./workerManager.cjs');
    workerManager.resumeWorker();
    return new AIQueryResponse(true, { paused: false });
  } catch (error) {
    return new AIQueryResponse(false, null, error.message);
  }
}

async function handleDownloadModel(_event, _payload) {
  try {
    const { app } = require('electron');
    const appDataDir = path.join(app.getPath('appData'), 'Notely');
    const ModelDownloader = require('../../ai/embeddings/ModelDownloader');
    const downloader = new ModelDownloader(appDataDir);

    const win = BrowserWindow.getFocusedWindow();
    downloader.download((progress) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send('ai:model:progress', { progress });
      }
    }).catch(err => {
      console.error('[AI IPC] Async downloader error:', err);
    });

    return new AIQueryResponse(true, { started: true });
  } catch (error) {
    return new AIQueryResponse(false, null, error.message);
  }
}

async function handlePauseGraphWorker(_event, _payload) {
  try {
    const workerManager = require('./workerManager.cjs');
    workerManager.pauseGraphWorker();
    return new AIQueryResponse(true, { paused: true });
  } catch (error) {
    return new AIQueryResponse(false, null, error.message);
  }
}

async function handleResumeGraphWorker(_event, _payload) {
  try {
    const workerManager = require('./workerManager.cjs');
    workerManager.resumeGraphWorker();
    return new AIQueryResponse(true, { paused: false });
  } catch (error) {
    return new AIQueryResponse(false, null, error.message);
  }
}

async function handleDownloadGraphModel(_event, _payload) {
  try {
    const { app } = require('electron');
    const appDataDir = path.join(app.getPath('appData'), 'Notely');
    const GraphModelDownloader = require('../../ai/graph/GraphModelDownloader');
    const downloader = new GraphModelDownloader(appDataDir);

    const workerManager = require('./workerManager.cjs');
    const win = BrowserWindow.getFocusedWindow();
    downloader.downloadModel((progressObj) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send('ai:graph-model:progress', progressObj);
      }
      if (progressObj && progressObj.status === 'complete' && workerManager) {
        workerManager.reloadGraphModel();
      }
    }).catch(err => {
      console.error('[AI IPC] Async graph model downloader error:', err);
    });

    return new AIQueryResponse(true, { started: true });
  } catch (error) {
    return new AIQueryResponse(false, null, error.message);
  }
}

async function handleDeleteModel(_event, _payload) {
  try {
    const { app } = require('electron');
    const appDataDir = path.join(app.getPath('appData'), 'Notely');
    const ModelDownloader = require('../../ai/embeddings/ModelDownloader');
    const downloader = new ModelDownloader(appDataDir);
    downloader.deleteModel();
    return new AIQueryResponse(true, { deleted: true });
  } catch (error) {
    return new AIQueryResponse(false, null, error.message);
  }
}

async function handleDeleteGraphModel(_event, _payload) {
  try {
    const { app } = require('electron');
    const appDataDir = path.join(app.getPath('appData'), 'Notely');
    const GraphModelDownloader = require('../../ai/graph/GraphModelDownloader');
    const downloader = new GraphModelDownloader(appDataDir);
    downloader.deleteModel();
    return new AIQueryResponse(true, { deleted: true });
  } catch (error) {
    return new AIQueryResponse(false, null, error.message);
  }
}

async function handleGetModelStatus(_event, _payload) {
  try {
    const { app } = require('electron');
    const appDataDir = path.join(app.getPath('appData'), 'Notely');
    const ModelDownloader = require('../../ai/embeddings/ModelDownloader');
    const downloader = new ModelDownloader(appDataDir);
    const status = downloader.getProgress();
    
    return new AIQueryResponse(true, {
      downloaded: downloader.isModelDownloaded(),
      isDownloading: status.isDownloading,
      progress: status.progress
    });
  } catch (error) {
    return new AIQueryResponse(false, null, error.message);
  }
}

async function handleGetGraphModelStatus(_event, _payload) {
  try {
    const { app } = require('electron');
    const appDataDir = path.join(app.getPath('appData'), 'Notely');
    const GraphModelDownloader = require('../../ai/graph/GraphModelDownloader');
    const downloader = new GraphModelDownloader(appDataDir);
    const status = downloader.getStatus();
    
    return new AIQueryResponse(true, {
      downloaded: status.downloaded,
      isDownloading: status.isDownloading,
      progress: status.progress
    });
  } catch (error) {
    return new AIQueryResponse(false, null, error.message);
  }
}

/**
 * Handle relationship graph building
 */
async function handleBuildGraph(_event, _payload) {
  try {
    if (!aiService.isEnabled() || !aiService.agent) {
      throw new Error('AI agent is disabled or not initialized');
    }

    if (aiService.agent.graphDb) {
      aiService.agent.graphDb.clear();
    }

    const LogDB = require('../../ai/logs/LogDB');
    const logDb = new LogDB(aiService.agent.workspaceRoot);
    logDb.initialize();
    logDb.addLog('graph', 'Starting Knowledge Graph rebuild...', 'info');

    const workerManager = require('./workerManager.cjs');
    let docs = [];
    if (aiService.agent.documentService) {
      try {
        docs = aiService.agent.documentService.getAllDocuments() || [];
      } catch { docs = []; }
    }
    let workspaceFiles = docs.map(d => d.path || d.filePath).filter(Boolean);

    // Fallback: If documentService cache is empty, scan workspaceRoot directly for .md files
    const workspaceRoot = aiService.agent.workspaceRoot;
    if (workspaceFiles.length === 0 && workspaceRoot && fs.existsSync(workspaceRoot)) {
      function scanMarkdownFiles(dir) {
        let results = [];
        try {
          const list = fs.readdirSync(dir);
          for (const file of list) {
            if (file.startsWith('.') || file === 'node_modules' || file === 'dist' || file === 'build') continue;
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);
            if (stat && stat.isDirectory()) {
              results = results.concat(scanMarkdownFiles(fullPath));
            } else if (file.endsWith('.md')) {
              results.push(fullPath);
            }
          }
        } catch { /* ignore scan error */ }
        return results;
      }
      workspaceFiles = scanMarkdownFiles(workspaceRoot);
    }

    logDb.addLog('graph', `Enqueued ${workspaceFiles.length} notes for entity extraction`, 'info');
    logDb.close();

    if (workerManager) {
      const activeProvider = aiService.agent.llmRegistry?.getActiveProvider();
      const prefs = aiService.agent.aiConfig ? aiService.agent.aiConfig.loadPreferences() : {};
      const providerConfig = {
        name: activeProvider ? activeProvider.name : null,
        apiKey: activeProvider ? activeProvider.apiKey : null,
        model: activeProvider ? activeProvider.model : null,
        graphProvider: prefs.graphProvider || 'gliner2-relex'
      };
      workerManager.rebuildGraph(workspaceFiles, providerConfig);
    }

    return new AIQueryResponse(true, { message: `Graph rebuild started for ${workspaceFiles.length} notes in background worker` });
  } catch (error) {
    console.error('[AI IPC] Graph building failed:', error);
    return new AIQueryResponse(false, null, error.message);
  }
}

/**
 * Handle fetching graph entities and relationships
 */
async function handleGetGraph(_event, payload) {
  try {
    if (!aiService.isEnabled() || !aiService.agent || !aiService.agent.graphDb) {
      throw new Error('AI agent or GraphDB is not initialized');
    }
    const AIConfig = require('../../ai/core/AIConfig');
    const config = new AIConfig();
    const prefs = config.loadPreferences();
    const minConfidence = payload?.confidence ?? (typeof prefs.graphConfidence === 'number' ? prefs.graphConfidence : 0.60);

    const result = aiService.agent.graphDb.getAll(minConfidence);
    return new AIQueryResponse(true, result);
  } catch (error) {
    console.error('[AI IPC] Get graph failed:', error);
    return new AIQueryResponse(false, null, error.message);
  }
}

async function handleExportGraphAsJSON(_event, payload) {
  try {
    if (!aiService.isEnabled() || !aiService.agent || !aiService.agent.graphDb) {
      throw new Error('AI agent or GraphDB is not initialized');
    }
    const result = aiService.agent.graphDb.exportAsJSON(payload || {});
    return new AIQueryResponse(true, result);
  } catch (error) {
    console.error('[AI IPC] Export graph as JSON failed:', error);
    return new AIQueryResponse(false, null, error.message);
  }
}

async function handleExportGraphAsMarkdown(_event, payload) {
  try {
    if (!aiService.isEnabled() || !aiService.agent || !aiService.agent.graphDb) {
      throw new Error('AI agent or GraphDB is not initialized');
    }
    const result = aiService.agent.graphDb.exportAsMarkdown(payload || {});
    return new AIQueryResponse(true, result);
  } catch (error) {
    console.error('[AI IPC] Export graph as Markdown failed:', error);
    return new AIQueryResponse(false, null, error.message);
  }
}

/**
 * Handle fetching graph status metrics
 */
async function handleGetGraphStatus(_event, payload) {
  try {
    if (!aiService.isEnabled() || !aiService.agent || !aiService.agent.graphDb) {
      return new AIQueryResponse(true, {
        nodeCount: 0,
        edgeCount: 0,
        sizeBytes: 0,
        isBuilding: false,
        current: 0,
        total: 0,
        noteName: ''
      });
    }
    const AIConfig = require('../../ai/core/AIConfig');
    const config = new AIConfig();
    const prefs = config.loadPreferences();
    const minConfidence = payload?.confidence ?? (typeof prefs.graphConfidence === 'number' ? prefs.graphConfidence : 0.60);

    const result = aiService.agent.graphDb.getStatus(minConfidence);
    const workerManager = require('./workerManager.cjs');
    const graphProgress = workerManager.getGraphProgressState();
    return new AIQueryResponse(true, {
      ...result,
      isBuilding: graphProgress.isBuilding,
      current: graphProgress.current,
      total: graphProgress.total,
      noteName: graphProgress.noteName
    });
  } catch (error) {
    console.error('[AI IPC] Get graph status failed:', error);
    return new AIQueryResponse(false, null, error.message);
  }
}


/**
 * Handle API key configuration
 */
async function handleSetAPIKey(event, payload) {
  try {
    const provider = assertProvider(payload?.provider);
    const apiKey = assertApiKey(payload?.apiKey);

    // Store API key securely using Electron's safeStorage
    const { app, safeStorage } = require('electron');
    const appDataDir = app.getPath('appData');
    const fs = require('fs');
    const path = require('path');

    const configPath = path.join(appDataDir, 'notely', 'ai-config.json');
    const configDir = path.dirname(configPath);

    // Ensure directory exists
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // Read existing config
    let config = {};
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }

    // Encrypt and store API key
    const encrypted = safeStorage.encryptString(apiKey);
    config[provider] = encrypted.toString('latin1');

    // Write config
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    if (aiService.agent?.isInitialized) {
      try {
        if (provider === 'huggingface') {
          // HuggingFace is an embedding-only provider — wire it directly.
          const { HuggingFaceEmbeddingProvider } = require('../../ai/embeddings');
          const hfProvider = new HuggingFaceEmbeddingProvider(apiKey);
          await hfProvider.initialize();
          aiService.agent.setEmbeddingProvider(hfProvider);
        }
      } catch (activationError) {
        console.warn('[AI IPC] Provider activation after key save failed:', activationError.message);
      }
    }

    return new AIQueryResponse(true, { message: 'API key saved successfully' });
  } catch (error) {
    console.error('[AI IPC] API key setting failed:', error);
    return new AIQueryResponse(false, null, error.message);
  }
}

/**
 * Handle API key retrieval
 */
async function handleGetAPIKey(event, payload) {
  try {
    const requestedProvider = String(payload?.provider || '').trim().toLowerCase();
    if (!requestedProvider || !ALLOWED_PROVIDERS.has(requestedProvider)) {
      return new AIQueryResponse(true, { configured: false, maskedKey: "" });
    }
    const provider = requestedProvider;

    const AIConfig = require('../../ai/core/AIConfig');
    const config = new AIConfig();
    const apiKey = config.getAPIKey(provider);

    return new AIQueryResponse(true, {
      configured: Boolean(apiKey),
      maskedKey: maskApiKey(apiKey),
      apiKey: apiKey || ""
    });
  } catch (error) {
    console.error('[AI IPC] API key retrieval failed:', error);
    return new AIQueryResponse(false, null, error.message);
  }
}

/**
 * Handle get provider list
 */
async function handleGetProviderList(_event, _payload) {
  try {
    const { PROVIDER_REGISTRY } = require('../../ai/providers/ProviderRegistry');
    const serializableProviders = Object.values(PROVIDER_REGISTRY).map(p => {
      const { factory: _factory, ...rest } = p;
      return rest;
    });
    return new AIQueryResponse(true, serializableProviders);
  } catch (error) {
    console.error('[AI IPC] Get provider list failed:', error);
    return new AIQueryResponse(false, null, error.message);
  }
}


/**
 * Handle get preferences
 */
async function handleGetPreferences(_event, _payload) {
  try {
    const AIConfig = require('../../ai/core/AIConfig');
    const config = new AIConfig();
    const prefs = config.loadPreferences();
    return new AIQueryResponse(true, prefs);
  } catch (error) {
    console.error('[AI IPC] Get preferences failed:', error);
    return new AIQueryResponse(false, null, error.message);
  }
}

/**
 * Handle set preferences
 */
async function handleSetPreferences(event, payload) {
  try {
    const preferences = payload?.preferences;
    if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) {
      throw new Error('Invalid preferences payload.');
    }
    const AIConfig = require('../../ai/core/AIConfig');
    const config = new AIConfig();
    config.savePreferences(preferences);

    // Apply the chosen embedding provider to the running agent immediately
    if (aiService.agent) {
      const activeEmbProvider = preferences.embeddingProvider || 'internal';
      if (activeEmbProvider === 'huggingface') {
        const hfToken = config.getAPIKey("huggingface");
        if (hfToken) {
          const { HuggingFaceEmbeddingProvider } = require('../../ai/embeddings');
          const hfProvider = new HuggingFaceEmbeddingProvider(hfToken);
          await hfProvider.initialize();
          aiService.agent.setEmbeddingProvider(hfProvider);
        } else {
          aiService.agent.setEmbeddingProvider(null);
        }
      } else if (activeEmbProvider === 'internal') {
        try {
          const { app } = require('electron');
          const appDataDir = path.join(app.getPath('appData'), 'Notely');
          const { ONNXEmbedder } = require('../../ai/embeddings');
          const onnxProvider = new ONNXEmbedder(appDataDir);
          const fs = require('fs');
          const modelPath = path.join(appDataDir, 'notely', 'ai-model', 'model.onnx');
          if (fs.existsSync(modelPath)) {
            await onnxProvider.load();
            aiService.agent.setEmbeddingProvider(onnxProvider);
          } else {
            aiService.agent.setEmbeddingProvider(null);
          }
        } catch (onnxErr) {
          console.warn('[AI IPC] Local ONNX embedding provider failed to load:', onnxErr.message);
          aiService.agent.setEmbeddingProvider(null);
        }
      } else {
        aiService.agent.setEmbeddingProvider(null);
      }
    }

    // Apply graph provider choice (gliner2-relex ONNX)
    if (aiService.agent) {
      const graphProviderPref = preferences.graphProvider || 'gliner2-relex';
      if (graphProviderPref === 'gliner2-relex') {
        try {
          const { app } = require('electron');
          const appDataDir = path.join(app.getPath('appData'), 'Notely');
          const GraphModelDownloader = require('../../ai/graph/GraphModelDownloader');
          const modelDownloader = new GraphModelDownloader(appDataDir);
          if (modelDownloader.isModelDownloaded()) {
            aiService.agent.setGraphProvider('gliner2-relex');
          }
        } catch (graphErr) {
          console.warn('[AI IPC] Local GLiNER2-Relex ONNX graph provider set notice:', graphErr.message);
        }
      } else {
        aiService.agent.setGraphProvider(null);
      }
    }

    return new AIQueryResponse(true, { message: 'Preferences saved' });
  } catch (error) {
    console.error('[AI IPC] Set preferences failed:', error);
    return new AIQueryResponse(false, null, error.message);
  }
}

/**
 * Get saved model for a provider
 */
async function handleGetProviderModel(_event, payload) {
  try {
    const provider = assertProvider(payload?.provider);
    const AIConfig = require('../../ai/core/AIConfig');
    const config = new AIConfig();
    const model = config.getProviderModel(provider);
    return new AIQueryResponse(true, { model });
  } catch (error) {
    return new AIQueryResponse(false, null, error.message);
  }
}

/**
 * Save model selection for a provider
 */
async function handleSetProviderModel(_event, payload) {
  try {
    const provider = assertProvider(payload?.provider);
    const modelId = typeof payload?.model === 'string' ? payload.model.trim() : '';
    if (!modelId) throw new Error('Model id is required.');

    const AIConfig = require('../../ai/core/AIConfig');
    const config = new AIConfig();
    config.saveProviderModel(provider, modelId);

    return new AIQueryResponse(true, { message: 'Model saved' });
  } catch (error) {
    console.error('[AI IPC] Set provider model failed:', error);
    return new AIQueryResponse(false, null, error.message);
  }
}

/**
 * Handle connection test
 */
async function handleTestConnection(event, payload) {
  try {
    const providerName = assertProvider(payload?.provider || 'huggingface');
    const AIConfig = require('../../ai/core/AIConfig');
    const config = new AIConfig();
    
    // Use key from UI payload if available (and not masked), otherwise fall back to saved key
    const apiKey = typeof payload?.apiKey === 'string' && payload.apiKey.trim() && !payload.apiKey.includes('...')
      ? payload.apiKey.trim()
      : config.getAPIKey(providerName);

    if (!apiKey) {
      throw new Error(`No API key configured for ${providerName}`);
    }

    // HuggingFace is an embedding provider
    if (providerName === 'huggingface') {
      const { HuggingFaceEmbeddingProvider } = require('../../ai/embeddings');
      const hfProvider = new HuggingFaceEmbeddingProvider(apiKey);
      await hfProvider.initialize(); // throws on failure
      return new AIQueryResponse(true, { message: 'HuggingFace embeddings connected successfully' });
    }

    const { PROVIDER_REGISTRY } = require('../../ai/providers/ProviderRegistry');
    const entry = PROVIDER_REGISTRY[providerName];
    if (entry && entry.factory) {
      const providerInstance = entry.factory({ apiKey, model: entry.defaultModel });
      if (typeof providerInstance.initialize === 'function') {
        await providerInstance.initialize();
      }
      return new AIQueryResponse(true, { message: `Connected to ${entry.name} successfully!` });
    }

    return new AIQueryResponse(true, { message: 'Connected successfully' });
  } catch (error) {
    console.error('[AI IPC] Connection test failed:', error);
    return new AIQueryResponse(false, null, error.message);
  }
}


/**
 * Handle clear data
 */
async function handleClearData(_event, _payload) {
  try {
    if (!aiService.agent) {
      throw new Error('AI agent not available');
    }

    // Clear session memory
    aiService.agent.memoryManager?.clearSession?.();

    // Clear caches
    aiService.agent.contextManager?.clearCache?.();
    aiService.agent.embeddingService?.clearCache?.();

    // Clean database
    if (aiService.agent.db?.cleanExpiredCache) {
      aiService.agent.db.cleanExpiredCache();
    }

    return new AIQueryResponse(true, { message: 'All AI data cleared' });
  } catch (error) {
    console.error('[AI IPC] Clear data failed:', error);
    return new AIQueryResponse(false, null, error.message);
  }
}

/**
 * Handle shutdown
 */
async function handleShutdown(_event, _payload) {
  try {
    aiService.shutdown();
    return new AIQueryResponse(true, { message: 'Shutdown complete' });
  } catch (error) {
    console.error('[AI IPC] Shutdown failed:', error);
    return new AIQueryResponse(false, null, error.message);
  }
}

async function handleEnableAI(_event, _payload) {
  try {
    await aiService.enableAI();
    return new AIQueryResponse(true, { message: 'AI Service enabled' });
  } catch (error) {
    console.error('[AI IPC] Enable AI failed:', error);
    return new AIQueryResponse(false, null, error.message);
  }
}

async function handleDisableAI(_event, _payload) {
  try {
    await aiService.disableAI();
    return new AIQueryResponse(true, { message: 'AI Service disabled' });
  } catch (error) {
    console.error('[AI IPC] Disable AI failed:', error);
    return new AIQueryResponse(false, null, error.message);
  }
}

async function handleGetAIHealth(_event, _payload) {
  try {
    const { getSubsystemHealth } = require('../../ai/diagnostics/AIHealth');
    const health = getSubsystemHealth();
    return new AIQueryResponse(true, health);
  } catch (error) {
    console.error('[AI IPC] Get AI Health failed:', error);
    return new AIQueryResponse(false, null, error.message);
  }
}

// ─── Personas removed (conversational AI decommissioned) ──────────────────

// ─── Candidate Knowledge removed (chat-only) ─────────────────────────────


let logDbInstance = null;
function getLogDbInstance() {
  // Prefer the agent's already-initialized LogDB — same file, no duplicate connection.
  const agentLogDb = aiService?.agent?.logDb;
  if (agentLogDb?.isInitialized) return agentLogDb;

  // Fallback: standalone instance (covers cases where agent isn't up yet but workspaceRoot is known).
  const workspaceRoot = aiService.workspaceRoot;
  if (!workspaceRoot) return null;
  if (!logDbInstance || logDbInstance.workspaceRoot !== workspaceRoot) {
    if (logDbInstance) try { logDbInstance.close(); } catch { /* ignore */ }
    const { LogDB } = require('../../ai/logs');
    logDbInstance = new LogDB(workspaceRoot);
    logDbInstance.initialize();
  }
  return logDbInstance;
}

let telemetryDbInstance = null;
function getTelemetryDbInstance() {
  const agentTelDb = aiService?.agent?.telemetryDb;
  if (agentTelDb?.isInitialized) return agentTelDb;

  const workspaceRoot = aiService.workspaceRoot;
  if (!workspaceRoot) return null;
  if (!telemetryDbInstance || telemetryDbInstance.workspaceRoot !== workspaceRoot) {
    if (telemetryDbInstance) try { telemetryDbInstance.close(); } catch { /* ignore */ }
    const { TelemetryDB } = require('../../ai/telemetry');
    telemetryDbInstance = new TelemetryDB(workspaceRoot);
    telemetryDbInstance.initialize();
  }
  return telemetryDbInstance;
}

try {
  const { eventBus } = require('../../ai/telemetry');
  if (eventBus) {
    eventBus.subscribe((evt) => {
      try {
        const windows = BrowserWindow.getAllWindows();
        for (const win of windows) {
          if (win && !win.isDestroyed()) {
            win.webContents.send('ai:telemetry:event', evt);
          }
        }
      } catch { /* ignore */ }
    });
  }
} catch { /* ignore */ }

async function handleGetLogs(_event, payload) {
  try {
    const subsystem = payload?.subsystem || null;
    const limit = payload?.limit || 200;
    const conversationId = payload?.conversationId || null;

    if (subsystem === 'mcp' || subsystem === 'mcp_tools' || subsystem === 'telemetry' || subsystem === 'FlowTracker' || conversationId) {
      const telDb = getTelemetryDbInstance();
      if (telDb) {
        if (conversationId) {
          const telLogs = telDb.getTelemetryByConversation(conversationId, limit);
          return new AIQueryResponse(true, telLogs);
        }
        const toolCalls = telDb.getMcpToolCalls({ limit });
        return new AIQueryResponse(true, toolCalls);
      }
      return new AIQueryResponse(true, []);
    }

    const logDb = getLogDbInstance();
    if (!logDb) return new AIQueryResponse(true, []);
    const logs = logDb.getLogs(subsystem, limit, conversationId);
    return new AIQueryResponse(true, logs);
  } catch (err) {
    console.error('[AI IPC] Failed to fetch logs:', err);
    return new AIQueryResponse(false, null, err.message);
  }
}

async function handleClearLogs(_event, payload) {
  try {
    const subsystem = payload?.subsystem || null;
    const beforeTimestamp = payload?.beforeTimestamp || null;

    if (!subsystem || subsystem === 'FlowTracker') {
      const telDb = getTelemetryDbInstance();
      if (telDb) {
        telDb.clearTelemetry(payload?.conversationId || null, beforeTimestamp);
      }
    }

    const logDb = getLogDbInstance();
    if (logDb) {
      logDb.clearLogs(subsystem, beforeTimestamp);
    }
    return new AIQueryResponse(true, { ok: true });
  } catch (err) {
    console.error('[AI IPC] Failed to clear logs:', err);
    return new AIQueryResponse(false, null, err.message);
  }
}

module.exports = {
  initializeAIHandlers
};
