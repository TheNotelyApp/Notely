/**
 * appLogIpc.cjs - IPC Handlers for Enterprise Centralized Logging
 */

const { ipcMain, BrowserWindow, app, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { logCore } = require('./LogCore.cjs');
const { assertTrustedIpcSender } = require('../lib/ipc/ipcSecurity.cjs');

function registerAppLogIpcHandlers() {
  // Query centralized logs with pagination and filters
  ipcMain.handle('applog:query', async (event, options = {}) => {
    assertTrustedIpcSender(BrowserWindow, event, 'applog:query');
    try {
      const result = logCore.queryLogs(options);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message, data: { rows: [], total: 0, hasMore: false } };
    }
  });

  // Query real-time aggregated stats / sparklines for UI
  ipcMain.handle('applog:stats', async (event, options = {}) => {
    assertTrustedIpcSender(BrowserWindow, event, 'applog:stats');
    try {
      const stats = logCore.getStats(options);
      return { success: true, data: stats };
    } catch (err) {
      return { success: false, error: err.message, data: {} };
    }
  });

  // Clear centralized logs (scoped, preserves forensic crash/audit)
  ipcMain.handle('applog:clear', async (event, options = {}) => {
    assertTrustedIpcSender(BrowserWindow, event, 'applog:clear');
    try {
      const ok = logCore.clearLogs(options);
      return { success: ok };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Ingest logs from renderer process (frontend telemetry, errors, action logs)
  ipcMain.on('applog:write', (event, entry = {}) => {
    try {
      assertTrustedIpcSender(BrowserWindow, event, 'applog:write');
      logCore.write({
        ...entry,
        process: 'renderer',
        category: entry.category || 'ui'
      });
    } catch { /* ignore */ }
  });

  // Export diagnostics bundle or reveal log file in system file manager
  ipcMain.handle('applog:open-folder', async (event) => {
    assertTrustedIpcSender(BrowserWindow, event, 'applog:open-folder');
    try {
      if (logCore.logsDir && fs.existsSync(logCore.logsDir)) {
        await shell.openPath(logCore.logsDir);
        return { success: true };
      }
      return { success: false, error: 'Logs directory not found' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

module.exports = { registerAppLogIpcHandlers };
