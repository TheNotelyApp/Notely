/**
 * mcpIpc.cjs
 * Electron Main Process IPC Handlers for Notely MCP Server.
 */

const { assertTrustedIpcSender } = require('../lib/ipc/ipcSecurity.cjs');

function registerMcpIpc(ipcMain, { BrowserWindow, mcpService, getNotesRoot, getProjectRoot }) {
  function registerTrusted(channel, handler) {
    ipcMain.handle(channel, (event, payload) => {
      assertTrustedIpcSender(BrowserWindow, event, channel);
      return handler(event, payload);
    });
  }

  registerTrusted('mcp:get-status', async () => {
    if (!mcpService) {
      return { running: false, port: 3721, workspace: getNotesRoot() };
    }
    return mcpService.getStatus();
  });

  registerTrusted('mcp:start', async () => {
    if (!mcpService) return { running: false };
    return mcpService.start();
  });

  registerTrusted('mcp:stop', async () => {
    if (!mcpService) return { running: false };
    return mcpService.stop();
  });

  registerTrusted('mcp:get-config-snippets', async () => {
    const workspace = getNotesRoot();
    const port = mcpService ? mcpService.port : 3721;
    const projectRoot = typeof getProjectRoot === 'function' ? getProjectRoot() : process.cwd();
    const cliPath = require('path').join(projectRoot, 'electron', 'mcp', 'cli.cjs');

    return {
      workspace,
      port,
      sseUrl: `http://127.0.0.1:${port}/sse`,
      claudeDesktopSse: {
        mcpServers: {
          notely: {
            url: `http://127.0.0.1:${port}/sse`
          }
        }
      },
      claudeDesktopStdio: {
        mcpServers: {
          notely: {
            command: 'node',
            args: [cliPath, '--workspace', workspace]
          }
        }
      },
      cursorMcp: {
        mcpServers: {
          notely: {
            url: `http://127.0.0.1:${port}/sse`
          }
        }
      },
      antigravityMcp: {
        mcpServers: {
          notely: {
            command: 'node',
            args: [cliPath, '--workspace', workspace]
          }
        }
      }
    };
  });
}

module.exports = {
  registerMcpIpc
};
