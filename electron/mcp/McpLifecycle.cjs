/**
 * McpLifecycle.cjs
 * Lifecycle management and IPC controller for Notely MCP Server.
 */

const { McpConfig } = require('./McpConfig.cjs');
const { McpSessionManager } = require('./McpSessionManager.cjs');
const { McpServer } = require('./McpServer.cjs');

class McpLifecycle {
  constructor() {
    this.config = null;
    this.sessionManager = new McpSessionManager();
    this.server = null;
    this.initialized = false;
    this.browserWindows = new Set();
  }

  initialize(appDataDir) {
    if (this.initialized) return;
    this.config = new McpConfig(appDataDir);
    const cfg = this.config.getConfig();

    this.server = new McpServer({
      port: cfg.port,
      host: cfg.host,
      bearerToken: cfg.bearerToken,
      sessionManager: this.sessionManager
    });

    this.initialized = true;

    if (cfg.enabled) {
      this.start().catch((err) => {
        console.warn('[MCP Lifecycle] Initial start encountered error:', err.message);
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

  async start() {
    if (!this.server) throw new Error('MCP server not initialized.');
    try {
      await this.server.start();
      this.broadcastStatus();
      return this.getStatus();
    } catch (err) {
      this.broadcastStatus();
      return this.getStatus();
    }
  }

  async stop() {
    if (!this.server) return this.getStatus();
    await this.server.stop();
    this.broadcastStatus();
    return this.getStatus();
  }

  async restart() {
    await this.stop();
    return this.start();
  }

  async updateConfig(updates = {}) {
    if (!this.config) throw new Error('MCP config not initialized.');
    const oldConfig = this.config.getConfig();
    const newConfig = this.config.save(updates);

    if (this.server) {
      this.server.updateConfig({
        port: newConfig.port,
        host: newConfig.host,
        bearerToken: newConfig.bearerToken
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
    return {
      config: newConfig,
      status: this.getStatus()
    };
  }

  getStatus() {
    const cfg = this.config ? this.config.getConfig() : { enabled: false, port: 3700, host: '127.0.0.1', isTokenProtected: false };
    const isRunning = Boolean(this.server?.isRunning);
    const lastError = this.server?.lastError || null;
    const errorCode = this.server?.errorCode || null;
    const stats = this.sessionManager.getStats();

    return {
      enabled: cfg.enabled,
      running: isRunning,
      port: cfg.port,
      host: cfg.host,
      isTokenProtected: cfg.isTokenProtected,
      error: lastError,
      errorCode,
      activeSessions: stats.activeCount,
      totalToolCalls: stats.totalToolCalls,
      totalErrors: stats.totalErrors
    };
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
  }

  async shutdown() {
    if (this.server) {
      await this.server.stop();
    }
    this.sessionManager.clear();
  }
}

// Global singleton
const mcpLifecycle = new McpLifecycle();

module.exports = {
  McpLifecycle,
  mcpLifecycle
};
