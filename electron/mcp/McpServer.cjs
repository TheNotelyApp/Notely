/**
 * McpServer.cjs
 * HTTP and SSE Model Context Protocol (MCP) Server for Notely.
 * Exposes Notely capabilities to external AI clients (Claude Desktop, IDE agents, custom scripts).
 */

const http = require('http');
const { URL } = require('url');
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { SSEServerTransport } = require('@modelcontextprotocol/sdk/server/sse.js');
const { ListToolsRequestSchema, CallToolRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const { applicationToolRegistry } = require('../tools/ApplicationToolRegistry.cjs');

class McpServer {
  /**
   * @param {object} options
   * @param {number} options.port
   * @param {string} options.host
   * @param {string} options.bearerToken
   * @param {import('./McpSessionManager.cjs').McpSessionManager} options.sessionManager
   */
  constructor(options = {}) {
    this.port = Number(options.port) || 3700;
    this.host = options.host || '127.0.0.1';
    this.bearerToken = options.bearerToken || '';
    this.sessionManager = options.sessionManager;

    this.httpServer = null;
    this.transports = new Map(); // sessionId -> { transport, server }
    this.isRunning = false;
    this.lastError = null;
    this.errorCode = null;
  }

  updateConfig({ port, host, bearerToken }) {
    if (port !== undefined) this.port = Number(port);
    if (host !== undefined) this.host = host;
    if (bearerToken !== undefined) this.bearerToken = bearerToken;
  }

  _checkAuth(req) {
    if (!this.bearerToken || !this.bearerToken.trim()) {
      return true;
    }
    const authHeader = req.headers['authorization'] || '';
    return authHeader.trim() === `Bearer ${this.bearerToken.trim()}`;
  }

  _createServerInstance(sessionId) {
    const server = new Server(
      { name: 'notely', version: '0.1.41' },
      { capabilities: { tools: {} } }
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = applicationToolRegistry.toMcpSchemas();
      return { tools };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const start = Date.now();
      try {
        const result = await applicationToolRegistry.executeTool(name, args || {}, {
          caller: 'mcp_client',
          sessionId
        });
        const duration = Date.now() - start;
        if (this.sessionManager) {
          this.sessionManager.recordToolCall(sessionId, name, duration, result.success, result.error?.message);
        }

        let textContent = '';
        if (result.data !== null && result.data !== undefined) {
          if (typeof result.data === 'string') {
            textContent = result.data;
          } else if (result.data.content && typeof result.data.content === 'string') {
            textContent = result.data.content;
          } else {
            textContent = JSON.stringify(result.data, null, 2);
          }
        } else {
          textContent = result.error?.message || 'Tool executed with no output.';
        }

        return {
          content: [{ type: 'text', text: textContent }],
          isError: !result.success
        };
      } catch (err) {
        const duration = Date.now() - start;
        if (this.sessionManager) {
          this.sessionManager.recordToolCall(sessionId, name, duration, false, err.message);
        }
        return {
          content: [{ type: 'text', text: err.message || 'Execution error' }],
          isError: true
        };
      }
    });

    return server;
  }

  start() {
    return new Promise((resolve, reject) => {
      if (this.isRunning) {
        return resolve({ port: this.port, host: this.host });
      }

      this.lastError = null;
      this.errorCode = null;

      const server = http.createServer(async (req, res) => {
        // Handle CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }

        let parsedUrl;
        try {
          parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Malformed URL' }));
          return;
        }

        const pathname = parsedUrl.pathname;

        // Health / Status ping
        if (pathname === '/health' || pathname === '/status' || pathname === '/') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 'ok',
            server: 'notely-mcp',
            version: '0.1.41',
            port: this.port,
            toolsCount: applicationToolRegistry.toMcpSchemas().length,
            activeSessions: this.sessionManager ? this.sessionManager.getActiveSessions().length : 0
          }));
          return;
        }

        // Tools discovery list endpoint (HTTP convenience for testing)
        if (pathname === '/tools' && req.method === 'GET') {
          if (!this._checkAuth(req)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Unauthorized: invalid or missing Bearer token' }));
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ tools: applicationToolRegistry.toMcpSchemas() }, null, 2));
          return;
        }

        // SSE endpoint: establish connection
        if (pathname === '/sse' && req.method === 'GET') {
          if (!this._checkAuth(req)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Unauthorized: invalid or missing Bearer token' }));
            return;
          }

          try {
            const transport = new SSEServerTransport('/messages', res);
            const sessionId = transport.sessionId;

            if (this.sessionManager) {
              this.sessionManager.createSession(sessionId, req);
            }

            const mcpInstance = this._createServerInstance(sessionId);
            this.transports.set(sessionId, { transport, server: mcpInstance });

            req.on('close', async () => {
              this.transports.delete(sessionId);
              if (this.sessionManager) {
                this.sessionManager.closeSession(sessionId);
              }
              try {
                await mcpInstance.close();
              } catch {}
            });

            await mcpInstance.connect(transport);
          } catch (err) {
            console.error('[MCP Server] Error establishing SSE transport:', err);
            if (!res.headersSent) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            }
          }
          return;
        }

        // POST /messages: incoming JSON-RPC from client
        if (pathname === '/messages' && req.method === 'POST') {
          if (!this._checkAuth(req)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Unauthorized: invalid or missing Bearer token' }));
            return;
          }

          const sessionId = parsedUrl.searchParams.get('sessionId') || parsedUrl.searchParams.get('session_id');
          if (!sessionId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing sessionId query parameter' }));
            return;
          }

          const session = this.transports.get(sessionId);
          if (!session) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Session not found or expired: ${sessionId}` }));
            return;
          }

          try {
            await session.transport.handlePostMessage(req, res);
          } catch (err) {
            console.error(`[MCP Server] Error handling POST message for session ${sessionId}:`, err);
            if (!res.headersSent) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            }
          }
          return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Route not found: ${pathname}` }));
      });

      server.on('error', (err) => {
        this.isRunning = false;
        this.httpServer = null;
        this.lastError = err.message;
        if (err.code === 'EADDRINUSE') {
          this.errorCode = 'EADDRINUSE';
          console.warn(`[MCP Server] Port ${this.port} already in use. MCP server disabled on this port.`);
        } else {
          this.errorCode = err.code || 'SERVER_ERROR';
          console.error('[MCP Server] Server error:', err);
        }
        reject(err);
      });

      server.listen(this.port, this.host, () => {
        this.isRunning = true;
        this.httpServer = server;
        this.lastError = null;
        this.errorCode = null;
        console.log(`[MCP Server] Listening on http://${this.host}:${this.port} (SSE at /sse)`);
        resolve({ port: this.port, host: this.host });
      });
    });
  }

  async stop() {
    if (!this.httpServer) {
      this.isRunning = false;
      return;
    }

    // Close all open client transports
    for (const [sessionId, { transport, server }] of this.transports.entries()) {
      try {
        await transport.close();
      } catch {}
      try {
        await server.close();
      } catch {}
      if (this.sessionManager) {
        this.sessionManager.closeSession(sessionId);
      }
    }
    this.transports.clear();

    return new Promise((resolve) => {
      this.httpServer.close(() => {
        this.isRunning = false;
        this.httpServer = null;
        console.log('[MCP Server] Stopped.');
        resolve();
      });
    });
  }
}

module.exports = {
  McpServer
};
