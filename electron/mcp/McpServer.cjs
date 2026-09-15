/**
 * McpServer.cjs
 * HTTP and SSE Model Context Protocol (MCP) Server for Notely.
 * Exposes Notely capabilities to external AI clients (Claude Desktop, IDE agents, custom scripts).
 */

const http = require('http');
const { URL } = require('url');
const { randomUUID } = require('crypto');
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { SSEServerTransport } = require('@modelcontextprotocol/sdk/server/sse.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} = require('@modelcontextprotocol/sdk/types.js');
const { applicationToolRegistry } = require('../tools/ApplicationToolRegistry.cjs');
const { mcpPromptsRegistry } = require('./McpPrompts.cjs');

class McpServer {
  /**
   * @param {object} options
   * @param {number} options.port
   * @param {string} options.host
   * @param {string} options.bearerToken
   * @param {boolean} options.allowWriteTools
   * @param {string} [options.toolMode] - 'unified' | 'legacy' | 'all'
   * @param {import('./McpSessionManager.cjs').McpSessionManager} options.sessionManager
   * @param {Function} options.getWorkspaceRoot
   * @param {Function} options.onTelemetryEvent
   */
  constructor(options = {}) {
    this.port = Number(options.port) || 3700;
    this.host = options.host || '127.0.0.1';
    this.bearerToken = options.bearerToken || '';
    this.allowWriteTools = options.allowWriteTools !== undefined ? Boolean(options.allowWriteTools) : true;
    this.toolMode = options.toolMode || 'all';
    this.sessionManager = options.sessionManager;
    this.getWorkspaceRoot = typeof options.getWorkspaceRoot === 'function' ? options.getWorkspaceRoot : null;
    this.onTelemetryEvent = typeof options.onTelemetryEvent === 'function' ? options.onTelemetryEvent : null;

    this.httpServer = null;
    this.transports = new Map(); // sessionId -> { transport, server } (legacy SSE)
    this.streamableTransports = new Map(); // sessionId -> { transport, server } (Streamable HTTP)
    this.isRunning = false;
    this.lastError = null;
    this.errorCode = null;
  }

  updateConfig({ port, host, bearerToken, allowWriteTools, toolMode, getWorkspaceRoot, onTelemetryEvent }) {
    if (port !== undefined) this.port = Number(port);
    if (host !== undefined) this.host = host;
    if (bearerToken !== undefined) this.bearerToken = bearerToken;
    if (allowWriteTools !== undefined) this.allowWriteTools = Boolean(allowWriteTools);
    if (toolMode !== undefined) this.toolMode = toolMode;
    if (typeof getWorkspaceRoot === 'function') this.getWorkspaceRoot = getWorkspaceRoot;
    if (typeof onTelemetryEvent === 'function') this.onTelemetryEvent = onTelemetryEvent;
  }

  _checkAuth(req) {
    if (!this.bearerToken || !this.bearerToken.trim()) {
      return true;
    }
    const authHeader = req.headers['authorization'] || '';
    return authHeader.trim() === `Bearer ${this.bearerToken.trim()}`;
  }

  _createServerInstance(sessionIdOrFn) {
    const getActiveSessionId = () => {
      if (typeof sessionIdOrFn === 'function') {
        return sessionIdOrFn() || 'mcp-session';
      }
      return sessionIdOrFn || 'mcp-session';
    };

    const server = new Server(
      { name: 'notely', version: '0.1.41' },
      { capabilities: { tools: {}, prompts: {}, resources: {} } }
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => {
      const allTools = applicationToolRegistry.toMcpSchemas({ mode: this.toolMode });
      const tools = this.allowWriteTools
        ? allTools
        : allTools.filter(t => !t.isWrite);
      return { tools };
    });

    server.setRequestHandler(ListPromptsRequestSchema, async () => {
      return { prompts: mcpPromptsRegistry.listPrompts() };
    });

    server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      return mcpPromptsRegistry.getPrompt(name, args || {});
    });

    server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: 'notely://workspace/tree',
            name: 'Workspace File Tree',
            description: 'Hierarchical directory tree of the active Notely workspace.',
            mimeType: 'application/json'
          },
          {
            uri: 'notely://workspace/stats',
            name: 'Workspace Statistics',
            description: 'Summary statistics including note count, tasks, links, and health.',
            mimeType: 'application/json'
          }
        ]
      };
    });

    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      const activeWorkspaceRoot = this.getWorkspaceRoot ? this.getWorkspaceRoot() : null;
      if (!activeWorkspaceRoot) {
        throw new Error('No active workspace configured.');
      }

      if (uri === 'notely://workspace/tree') {
        const tree = await applicationToolRegistry.workspaceService.listTree({ workspaceRoot: activeWorkspaceRoot, maxDepth: 4 });
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(tree, null, 2)
            }
          ]
        };
      }

      if (uri === 'notely://workspace/stats') {
        const stats = await applicationToolRegistry.workspaceService.getStatistics({ workspaceRoot: activeWorkspaceRoot });
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(stats, null, 2)
            }
          ]
        };
      }

      throw new Error(`Resource not found: "${uri}".`);
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const start = Date.now();
      const sessionId = getActiveSessionId();
      try {
        const activeWorkspaceRoot = this.getWorkspaceRoot ? this.getWorkspaceRoot() : null;
        const result = await applicationToolRegistry.executeTool(name, args || {}, {
          caller: 'mcp_client',
          sessionId,
          workspaceRoot: activeWorkspaceRoot,
          allowWriteTools: this.allowWriteTools
        });
        const duration = Date.now() - start;
        if (this.sessionManager && typeof this.sessionManager.recordToolCall === 'function') {
          this.sessionManager.recordToolCall(sessionId, name, duration, result.success, result.error?.message, args, result.data);
        }

        if (typeof this.onTelemetryEvent === 'function') {
          this.onTelemetryEvent({
            sessionId,
            toolName: name,
            input: args,
            output: result.data,
            durationMs: duration,
            success: result.success,
            error: result.error?.message
          });
        }

        const isSuccess = Boolean(result.success && !(result.data && result.data.exists === false));
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
          isError: !isSuccess
        };
      } catch (err) {
        const duration = Date.now() - start;
        if (this.sessionManager && typeof this.sessionManager.recordToolCall === 'function') {
          this.sessionManager.recordToolCall(sessionId, name, duration, false, err.message, args, null);
        }

        if (typeof this.onTelemetryEvent === 'function') {
          this.onTelemetryEvent({
            sessionId,
            toolName: name,
            input: args,
            output: null,
            durationMs: duration,
            success: false,
            error: err.message
          });
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
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version, Accept, Last-Event-ID');
        res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id, Mcp-Protocol-Version');

        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }

        let parsedUrl;
        try {
          parsedUrl = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Malformed URL' }));
          return;
        }

        const pathname = parsedUrl.pathname;

        // Health / Status ping
        const isGetHealth = req.method === 'GET' && (
          pathname === '/health' ||
          pathname === '/status' ||
          (pathname === '/' && !req.headers.accept?.includes('text/event-stream') && !req.headers['mcp-session-id'])
        );

        if (isGetHealth) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          const allSchemas = applicationToolRegistry.toMcpSchemas({ mode: this.toolMode });
          const advertisedSchemas = this.allowWriteTools
            ? allSchemas
            : allSchemas.filter(t => !t.isWrite);
          res.end(JSON.stringify({
            status: 'ok',
            server: 'notely-mcp',
            version: '0.1.41',
            port: this.port,
            toolsCount: advertisedSchemas.length,
            promptsCount: mcpPromptsRegistry.listPrompts().length,
            resourcesCount: 2,
            activeSessions: (this.sessionManager ? this.sessionManager.getActiveSessions().length : 0) + this.streamableTransports.size
          }));
          return;
        }

        // GET /tools
        if (pathname === '/tools' && req.method === 'GET') {
          if (!this._checkAuth(req)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Unauthorized: invalid or missing Bearer token' }));
            return;
          }
          const allTools = applicationToolRegistry.toMcpSchemas({ mode: this.toolMode });
          const tools = this.allowWriteTools
            ? allTools
            : allTools.filter(t => !t.isWrite);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ tools }));
          return;
        }

        // GET /prompts
        if (pathname === '/prompts' && req.method === 'GET') {
          if (!this._checkAuth(req)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Unauthorized: invalid or missing Bearer token' }));
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ prompts: mcpPromptsRegistry.listPrompts() }));
          return;
        }

        // Check authentication for all MCP endpoints
        if (!this._checkAuth(req)) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Unauthorized: invalid or missing Bearer token' }));
          return;
        }

        // Legacy SSE handshake: GET /sse without Mcp-Session-Id header
        if (pathname === '/sse' && req.method === 'GET' && !req.headers['mcp-session-id']) {
          try {
            const transport = new SSEServerTransport('/messages', res);
            const sessionId = transport.sessionId;
            const mcpInstance = this._createServerInstance(sessionId);

            if (this.sessionManager) {
              const clientName = req.headers['user-agent'] || 'Legacy SSE Client';
              if (typeof this.sessionManager.registerSession === 'function') {
                this.sessionManager.registerSession(sessionId, clientName, '1.0.0', req.headers);
              } else if (typeof this.sessionManager.createSession === 'function') {
                this.sessionManager.createSession(sessionId, req);
              }
            }

            this.transports.set(sessionId, { transport, server: mcpInstance });

            req.on('close', async () => {
              this.transports.delete(sessionId);
              if (this.sessionManager && typeof this.sessionManager.closeSession === 'function') {
                this.sessionManager.closeSession(sessionId);
              }
              try {
                await mcpInstance.close();
              } catch {
                // Connection closed
              }
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

        // Legacy SSE client POST: POST /messages with legacy session
        if (pathname === '/messages' && req.method === 'POST') {
          const legacySessionId = parsedUrl.searchParams.get('sessionId') || parsedUrl.searchParams.get('session_id');
          if (legacySessionId && this.transports.has(legacySessionId)) {
            const session = this.transports.get(legacySessionId);
            try {
              await session.transport.handlePostMessage(req, res);
            } catch (err) {
              console.error(`[MCP Server] Error handling POST message for session ${legacySessionId}:`, err);
              if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
              }
            }
            return;
          }
        }

        // Streamable HTTP Transport (MCP Standard 2024-11-05 / Antigravity / Claude / Cursor)
        const isStreamablePath = (
          pathname === '/' ||
          pathname === '/sse' ||
          pathname === '/mcp' ||
          pathname === '/api/mcp' ||
          pathname === '/messages'
        );

        if (isStreamablePath) {
          const sid = req.headers['mcp-session-id'] || parsedUrl.searchParams.get('sessionId') || parsedUrl.searchParams.get('session_id');

          // Route to existing active Streamable HTTP session
          if (sid && this.streamableTransports.has(sid)) {
            const session = this.streamableTransports.get(sid);
            try {
              await session.transport.handleRequest(req, res);
            } catch (err) {
              console.error(`[MCP Server] Streamable transport error for session ${sid}:`, err);
              if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  jsonrpc: '2.0',
                  error: { code: -32603, message: err?.message || 'Internal error' },
                  id: null
                }));
              }
            }
            return;
          }

          // New Streamable HTTP session (initialization handshake)
          if (req.method === 'POST') {
            let currentSessionId = null;
            const transport = new StreamableHTTPServerTransport({
              sessionIdGenerator: () => randomUUID(),
              onsessioninitialized: (newSid) => {
                currentSessionId = newSid;
                this.streamableTransports.set(newSid, { transport, server: mcpInstance });
                if (this.sessionManager && typeof this.sessionManager.registerSession === 'function') {
                  const clientName = req.headers['user-agent'] || 'Streamable-HTTP Client';
                  this.sessionManager.registerSession(newSid, clientName, '1.0.0', req.headers);
                }
              }
            });

            const mcpInstance = this._createServerInstance(() => currentSessionId);
            transport.onclose = () => {
              if (currentSessionId) {
                this.streamableTransports.delete(currentSessionId);
                if (this.sessionManager && typeof this.sessionManager.closeSession === 'function') {
                  this.sessionManager.closeSession(currentSessionId);
                }
              }
              try {
                mcpInstance.close();
              } catch {
                // Connection closed
              }
            };

            try {
              await mcpInstance.connect(transport);
              await transport.handleRequest(req, res);
            } catch (err) {
              console.error('[MCP Server] Streamable HTTP initialization error:', err);
              if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  jsonrpc: '2.0',
                  error: { code: -32603, message: err?.message || 'Internal error' },
                  id: null
                }));
              }
            }
            return;
          }

          // Request with missing or invalid session ID
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32001, message: sid ? `Session not found: ${sid}` : 'Session not found' },
            id: null
          }));
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
        console.log(`[MCP Server] Listening on http://${this.host}:${this.port} (SSE at /sse, Streamable HTTP at /mcp)`);
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
      } catch {
        // Transport already closed
      }
      try {
        await server.close();
      } catch {
        // Server instance already closed
      }
      if (this.sessionManager) {
        this.sessionManager.closeSession(sessionId);
      }
    }
    this.transports.clear();

    for (const [sessionId, { transport, server }] of this.streamableTransports.entries()) {
      try {
        await transport.close();
      } catch {
        // Transport already closed
      }
      try {
        await server.close();
      } catch {
        // Server instance already closed
      }
      if (this.sessionManager) {
        this.sessionManager.closeSession(sessionId);
      }
    }
    this.streamableTransports.clear();

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
