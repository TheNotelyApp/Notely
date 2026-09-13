/**
 * McpConfig.cjs
 * Manages configuration for the Notely MCP (Model Context Protocol) Server.
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_CONFIG = {
  enabled: true,
  port: 3700,
  host: '127.0.0.1',
  bearerToken: ''
};

class McpConfig {
  constructor(appDataDir) {
    this.appDataDir = appDataDir;
    this.configPath = path.join(appDataDir, 'mcp-config.json');
    this.config = { ...DEFAULT_CONFIG };
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf8');
        const parsed = JSON.parse(raw);
        this.config = {
          ...DEFAULT_CONFIG,
          ...parsed,
          port: Number(parsed.port) || DEFAULT_CONFIG.port
        };
      }
    } catch (err) {
      console.warn('[MCP Config] Failed to load config file, using defaults:', err.message);
      this.config = { ...DEFAULT_CONFIG };
    }
    return this.getConfig();
  }

  save(updates = {}) {
    try {
      const next = {
        ...this.config,
        ...updates
      };
      if (updates.port !== undefined) {
        const p = Number(updates.port);
        if (Number.isInteger(p) && p > 0 && p <= 65535) {
          next.port = p;
        }
      }
      if (updates.enabled !== undefined) {
        next.enabled = Boolean(updates.enabled);
      }
      if (updates.host !== undefined) {
        next.host = String(updates.host || '127.0.0.1').trim();
      }
      if (updates.bearerToken !== undefined) {
        next.bearerToken = String(updates.bearerToken || '').trim();
      }

      this.config = next;
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
    } catch (err) {
      console.error('[MCP Config] Failed to save config file:', err.message);
      throw err;
    }
    return this.getConfig();
  }

  getConfig() {
    return {
      enabled: Boolean(this.config.enabled),
      port: Number(this.config.port) || DEFAULT_CONFIG.port,
      host: this.config.host || DEFAULT_CONFIG.host,
      bearerToken: this.config.bearerToken || '',
      isTokenProtected: Boolean(this.config.bearerToken && this.config.bearerToken.trim().length > 0)
    };
  }
}

module.exports = {
  McpConfig,
  DEFAULT_CONFIG
};
