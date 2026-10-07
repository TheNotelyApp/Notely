/**
 * McpLifecycle.cjs
 * Lifecycle management and IPC controller for Notely MCP Server.
 */

const { McpConfig } = require('./McpConfig.cjs');
const { McpSessionManager } = require('./McpSessionManager.cjs');
const { McpServer } = require('./McpServer.cjs');
const { mcpPromptsRegistry } = require('./McpPrompts.cjs');
const { AiContextBridgeService } = require('../services/AiContextBridgeService.cjs');

class McpLifecycle {
  constructor() {
    this.config = null;
    this.sessionManager = new McpSessionManager();
    this.server = null;
    this.initialized = false;
    this.browserWindows = new Set();
    this.getWorkspaceRoot = null;
    this.telemetryDbInstance = null;
    this.telemetryDbRoot = null;
    this.aiBridge = null;
  }

  getTelemetryDb(root) {
    if (!root) return null;
    if (this.telemetryDbInstance && this.telemetryDbRoot === root) {
      return this.telemetryDbInstance;
    }
    if (this.telemetryDbInstance) {
      try {
        if (this.telemetryDbInstance.db && typeof this.telemetryDbInstance.db.close === 'function') {
          this.telemetryDbInstance.db.close();
        }
      } catch { /* ignore */ }
      this.telemetryDbInstance = null;
      this.telemetryDbRoot = null;
    }
    try {
      const TelemetryDB = require('../../ai/telemetry/TelemetryDB');
      const db = new TelemetryDB(root);
      db.initialize();
      this.telemetryDbInstance = db;
      this.telemetryDbRoot = root;
      return db;
    } catch {
      return null;
    }
  }

  setWorkspaceRootProvider(fn) {
    if (typeof fn === 'function') {
      this.getWorkspaceRoot = fn;
      if (this.server) {
        this.server.updateConfig({ getWorkspaceRoot: fn });
      }
      if (this.aiBridge) {
        const root = fn();
        if (root) {
          this.aiBridge.setWorkspaceRoot(root);
        }
      }
    }
  }

  initialize(appDataDir, getWorkspaceRoot = null) {
    if (this.initialized) return;
    this.config = new McpConfig(appDataDir);
    const cfg = this.config.getConfig();

    if (typeof getWorkspaceRoot === 'function') {
      this.getWorkspaceRoot = getWorkspaceRoot;
    }

    this.aiBridge = new AiContextBridgeService({
      getMcpConfig: () => (this.config ? this.config.getConfig() : {})
    });
    if (this.getWorkspaceRoot) {
      const currentRoot = this.getWorkspaceRoot();
      if (currentRoot) {
        this.aiBridge.setWorkspaceRoot(currentRoot);
      }
    }

    this.server = new McpServer({
      port: cfg.port,
      host: cfg.host,
      bearerToken: cfg.bearerToken,
      allowWriteTools: cfg.allowWriteTools,
      sessionManager: this.sessionManager,
      getWorkspaceRoot: () => (this.getWorkspaceRoot ? this.getWorkspaceRoot() : null),
      onTelemetryEvent: (eventData) => this.broadcastTelemetryEvent(eventData)
    });

    this.initialized = true;

    if (cfg.enabled) {
      this.start().catch((err) => {
        console.warn('[MCP Lifecycle] Initial start encountered error:', err?.message || err);
      });
    }
  }

  trackWindow(win) {
    if (!win || win.isDestroyed()) return;
    this.browserWindows.add(win);
    win.on('closed', () => this.browserWindows.delete(win));
  }

  broadcastStatus() {
    const status = this.getStatus();
    for (const win of this.browserWindows) {
      if (!win.isDestroyed()) {
        win.webContents.send('mcp:status-changed', status);
      }
    }
  }

  broadcastTelemetryEvent(eventData) {
    for (const win of this.browserWindows) {
      if (!win.isDestroyed()) {
        win.webContents.send('telemetry:event', eventData);
      }
    }

    try {
      const root = typeof this.getWorkspaceRoot === 'function' ? this.getWorkspaceRoot() : null;
      if (root) {
        const db = this.getTelemetryDb(root);
        if (db) {
          db.recordMcpToolCall({
            sessionId: eventData.sessionId,
            clientName: eventData.clientName || 'MCP Client',
            toolName: eventData.toolName,
            input: eventData.input,
            output: eventData.output,
            durationMs: eventData.durationMs,
            success: eventData.success,
            error: eventData.error
          });
        }
      }
    } catch {
      // Telemetry persistence is non-blocking
    }
  }

  async start() {
    if (!this.server) throw new Error('MCP server not initialized.');
    try {
      await this.server.start();
      this.broadcastStatus();
      if (this.aiBridge) this.aiBridge.scheduleSync(200);
      return this.getStatus();
    } catch {
      this.broadcastStatus();
      if (this.aiBridge) this.aiBridge.scheduleSync(200);
      return this.getStatus();
    }
  }

  async stop() {
    if (!this.server) return this.getStatus();
    await this.server.stop();
    this.broadcastStatus();
    if (this.aiBridge) this.aiBridge.scheduleSync(200);
    return this.getStatus();
  }

  async restart() {
    await this.stop();
    return this.start();
  }

  async updateConfig(updates = {}) {
    if (!this.config) throw new Error('MCP config not initialized.');
    const newConfig = this.config.save(updates);

    if (this.server) {
      this.server.updateConfig({
        port: newConfig.port,
        host: newConfig.host,
        bearerToken: newConfig.bearerToken,
        allowWriteTools: newConfig.allowWriteTools,
        getWorkspaceRoot: () => (this.getWorkspaceRoot ? this.getWorkspaceRoot() : null)
      });
    }

    if (!newConfig.enabled) {
      if (this.server?.isRunning) {
        await this.stop();
      }
    } else {
      // If port changed or was stopped, restart
      await this.restart();
    }

    this.broadcastStatus();
    if (this.aiBridge) this.aiBridge.scheduleSync(200);
    return {
      config: newConfig,
      status: this.getStatus()
    };
  }

  getStatus() {
    const cfg = this.config ? this.config.getConfig() : { enabled: false, port: 3700, host: '127.0.0.1', bearerToken: '', allowWriteTools: true, isTokenProtected: false };
    const isRunning = Boolean(this.server?.isRunning);
    const lastError = this.server?.lastError || null;
    const errorCode = this.server?.errorCode || null;
    const stats = this.sessionManager.getStats();

    return {
      enabled: cfg.enabled,
      running: isRunning,
      port: cfg.port,
      host: cfg.host,
      allowWriteTools: cfg.allowWriteTools,
      isTokenProtected: cfg.isTokenProtected,
      error: lastError,
      errorCode,
      activeSessions: stats.activeCount,
      totalToolCalls: stats.totalToolCalls,
      totalErrors: stats.totalErrors
    };
  }

  broadcastResourceUpdated(uri) {
    if (this.server && typeof this.server.broadcastResourceUpdated === 'function') {
      this.server.broadcastResourceUpdated(uri);
    }
    if (this.aiBridge) {
      this.aiBridge.scheduleSync();
    }
  }

  registerIpcHandlers(ipcMain) {
    ipcMain.handle('mcp:get-status', async () => {
      return this.getStatus();
    });

    ipcMain.handle('mcp:get-config', async () => {
      return this.config ? this.config.getConfig() : null;
    });

    ipcMain.handle('mcp:set-config', async (_event, updates) => {
      return this.updateConfig(updates);
    });

    ipcMain.handle('mcp:start', async () => {
      return this.start();
    });

    ipcMain.handle('mcp:stop', async () => {
      return this.stop();
    });

    ipcMain.handle('mcp:restart', async () => {
      return this.restart();
    });

    ipcMain.handle('mcp:get-sessions', async () => {
      return {
        active: this.sessionManager.getActiveSessions(),
        stats: this.sessionManager.getStats()
      };
    });

    ipcMain.handle('mcp:list-prompts', async () => {
      const root = typeof this.getWorkspaceRoot === 'function' ? this.getWorkspaceRoot() : null;
      return mcpPromptsRegistry.listPrompts(root);
    });

    ipcMain.handle('mcp:get-prompt', async (_event, name, args) => {
      const root = typeof this.getWorkspaceRoot === 'function' ? this.getWorkspaceRoot() : null;
      return mcpPromptsRegistry.getPrompt(name, args || {}, root);
    });

    ipcMain.handle('mcp:save-prompt', async (_event, promptData) => {
      const root = typeof this.getWorkspaceRoot === 'function' ? this.getWorkspaceRoot() : null;
      const res = mcpPromptsRegistry.saveCustomPrompt(root, promptData);
      if (this.aiBridge) this.aiBridge.scheduleSync(100);
      return res;
    });

    ipcMain.handle('mcp:delete-prompt', async (_event, name) => {
      const root = typeof this.getWorkspaceRoot === 'function' ? this.getWorkspaceRoot() : null;
      const res = mcpPromptsRegistry.deleteCustomPrompt(root, name);
      if (this.aiBridge) this.aiBridge.scheduleSync(100);
      return res;
    });

    ipcMain.handle('mcp:sync-ai-bridge', async () => {
      if (this.aiBridge) {
        return this.aiBridge.syncNow();
      }
      return { ok: false, error: 'AI Bridge not initialized' };
    });
  }

  async shutdown() {
    if (this.server) {
      await this.server.stop();
    }
    this.sessionManager.clear();
    if (this.telemetryDbInstance) {
      try {
        if (this.telemetryDbInstance.db && typeof this.telemetryDbInstance.db.close === 'function') {
          this.telemetryDbInstance.db.close();
        }
      } catch { /* ignore */ }
      this.telemetryDbInstance = null;
      this.telemetryDbRoot = null;
    }
  }
}

// Global singleton
const mcpLifecycle = new McpLifecycle();

module.exports = {
  McpLifecycle,
  mcpLifecycle
};
