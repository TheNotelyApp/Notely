/**
 * sseTransport.cjs
 * Embedded HTTP Server-Sent Events (SSE) server for Notely Model Context Protocol (MCP).
 * Runs on http://127.0.0.1:3721 by default.
 */

const http = require('http');
const { SSEServerTransport } = require('@modelcontextprotocol/sdk/server/sse.js');
const { createNotelyMcpServer } = require('./createNotelyMcpServer.cjs');

class NotelyMcpSseService {
  constructor({ port = 3721, getWorkspaceRoot } = {}) {
    this.port = port;
    this.getWorkspaceRoot = getWorkspaceRoot;
    this.server = null;
    this.sessions = new Map(); // sessionId -> { transport, mcpServer }
    this.isRunning = false;
  }

  start() {
    if (this.isRunning && this.server) {
      return Promise.resolve({ port: this.port, running: true });
    }

    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        // Set standard CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Session-Id');

        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }

        const parsedUrl = new URL(req.url, `http://127.0.0.1:${this.port}`);
        const pathname = parsedUrl.pathname;

        // 1. Health check & metadata endpoint
        if (pathname === '/health' || pathname === '/status' || pathname === '/') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          const currentRoot = typeof this.getWorkspaceRoot === 'function' ? this.getWorkspaceRoot() : this.getWorkspaceRoot;
          res.end(
            JSON.stringify(
              {
                status: 'ok',
                service: 'notely-mcp-server',
                version: '0.1.41',
                transports: ['sse', 'stdio'],
                port: this.port,
                workspace: currentRoot || null,
                activeSessions: this.sessions.size,
                endpoints: {
                  sse: `http://127.0.0.1:${this.port}/sse`,
                  messages: `http://127.0.0.1:${this.port}/messages`
                }
              },
              null,
              2
            )
          );
          return;
        }

        // 2. SSE subscription endpoint
        if (pathname === '/sse') {
          if (req.method !== 'GET') {
            res.writeHead(405, { 'Content-Type': 'text/plain' });
            res.end('Method Not Allowed: SSE requires GET.');
            return;
          }

          try {
            const mcpServer = createNotelyMcpServer({
              getWorkspaceRoot: this.getWorkspaceRoot
            });

            // Creates transport pointing incoming posts to /messages
            const transport = new SSEServerTransport('/messages', res);
            const sessionId = transport.sessionId;
            this.sessions.set(sessionId, { transport, mcpServer });

            transport.onclose = () => {
              this.sessions.delete(sessionId);
            };

            await mcpServer.connect(transport);
          } catch (err) {
            console.error('[Notely MCP SSE] Failed to establish connection:', err);
            if (!res.headersSent) {
              res.writeHead(500, { 'Content-Type': 'text/plain' });
              res.end(`Internal Server Error: ${err.message}`);
            }
          }
          return;
        }

        // 3. Message dispatch endpoint
        if (pathname === '/messages') {
          if (req.method !== 'POST') {
            res.writeHead(405, { 'Content-Type': 'text/plain' });
            res.end('Method Not Allowed: Messages require POST.');
            return;
          }

          const sessionId = parsedUrl.searchParams.get('sessionId') || req.headers['x-session-id'];
          const session = sessionId ? this.sessions.get(sessionId) : null;

          if (!session) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end(`Session not found or expired: '${sessionId || 'missing'}'`);
            return;
          }

          try {
            await session.transport.handlePostMessage(req, res);
          } catch (err) {
            console.error('[Notely MCP SSE] Failed to handle message:', err);
            if (!res.headersSent) {
              res.writeHead(500, { 'Content-Type': 'text/plain' });
              res.end(`Error processing message: ${err.message}`);
            }
          }
          return;
        }

        // 404 for unknown endpoints
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      });

      this.server.on('error', (err) => {
        this.isRunning = false;
        reject(err);
      });

      this.server.listen(this.port, '127.0.0.1', () => {
        this.isRunning = true;
        console.log(`[Notely MCP] SSE server listening on http://127.0.0.1:${this.port}/sse`);
        resolve({ port: this.port, running: true });
      });
    });
  }

  stop() {
    return new Promise((resolve) => {
      if (!this.server) {
        this.isRunning = false;
        resolve({ running: false });
        return;
      }

      for (const session of this.sessions.values()) {
        try {
          session.transport.close?.();
        } catch {
          // ignore
        }
      }
      this.sessions.clear();

      this.server.close(() => {
        this.isRunning = false;
        this.server = null;
        console.log('[Notely MCP] SSE server stopped.');
        resolve({ running: false });
      });
    });
  }

  getStatus() {
    const currentRoot = typeof this.getWorkspaceRoot === 'function' ? this.getWorkspaceRoot() : this.getWorkspaceRoot;
    return {
      running: this.isRunning,
      port: this.port,
      workspace: currentRoot || null,
      sseUrl: `http://127.0.0.1:${this.port}/sse`,
      messagesUrl: `http://127.0.0.1:${this.port}/messages`,
      sessionsCount: this.sessions.size
    };
  }
}

module.exports = {
  NotelyMcpSseService
};
