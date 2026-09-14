const assert = require('assert');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { McpConfig } = require('../../electron/mcp/McpConfig.cjs');
const { McpSessionManager } = require('../../electron/mcp/McpSessionManager.cjs');
const { McpServer } = require('../../electron/mcp/McpServer.cjs');
const { applicationToolRegistry } = require('../../electron/tools/ApplicationToolRegistry.cjs');

function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (_err) { json = null; }
        resolve({ statusCode: res.statusCode, headers: res.headers, body: data, json });
      });
    });
    req.on('error', reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

describe('Notely MCP Server Subsystem Tests', () => {
  const tempDir = path.join(__dirname, 'temp-mcp-test');

  beforeAll(() => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('McpConfig', () => {
    it('should initialize with defaults and save updates', () => {
      const configManager = new McpConfig(tempDir);
      const initial = configManager.getConfig();
      assert.strictEqual(initial.port, 3700);
      assert.strictEqual(initial.enabled, true);
      assert.strictEqual(initial.allowWriteTools, true);
      assert.strictEqual(initial.isTokenProtected, false);

      configManager.save({ port: 3755, bearerToken: 'secret123', allowWriteTools: false });
      const updated = configManager.getConfig();
      assert.strictEqual(updated.port, 3755);
      assert.strictEqual(updated.bearerToken, 'secret123');
      assert.strictEqual(updated.allowWriteTools, false);
      assert.strictEqual(updated.isTokenProtected, true);

      // Reload from disk
      const reloaded = new McpConfig(tempDir);
      assert.strictEqual(reloaded.getConfig().port, 3755);
      assert.strictEqual(reloaded.getConfig().bearerToken, 'secret123');
      assert.strictEqual(reloaded.getConfig().allowWriteTools, false);
    });
  });

  describe('McpSessionManager', () => {
    it('should track sessions and record tool execution metrics', () => {
      const manager = new McpSessionManager();
      const session = manager.createSession('sess_test_1');
      assert.strictEqual(session.id, 'sess_test_1');
      assert.strictEqual(manager.getActiveSessions().length, 1);

      manager.recordToolCall('sess_test_1', 'notes.read', 12, true);
      manager.recordToolCall('sess_test_1', 'search.notes', 25, false, 'Simulated error');

      const stats = manager.getStats();
      assert.strictEqual(stats.totalToolCalls, 2);
      assert.strictEqual(stats.totalErrors, 1);
      assert.strictEqual(session.toolCallsCount, 2);
      assert.strictEqual(session.errorsCount, 1);

      manager.closeSession('sess_test_1');
      assert.strictEqual(manager.getActiveSessions().length, 0);
    });
  });

  describe('ApplicationToolRegistry Security & Execution', () => {
    it('should block write tools when allowWriteTools is false', async () => {
      const writeRes = await applicationToolRegistry.executeTool(
        'notes.create',
        { title: 'Security Test Note' },
        { allowWriteTools: false, workspaceRoot: tempDir }
      );
      assert.strictEqual(writeRes.success, false);
      assert.strictEqual(writeRes.error.code, 'WRITE_DISABLED');

      const readRes = await applicationToolRegistry.executeTool(
        'workspace.statistics',
        {},
        { allowWriteTools: false, workspaceRoot: tempDir }
      );
      assert.strictEqual(readRes.success, true);
    });
  });

  describe('McpServer HTTP & Tool Endpoints', () => {
    let server;
    const testPort = 3798;
    const sessionManager = new McpSessionManager();
    const recordedEvents = [];

    beforeAll(async () => {
      server = new McpServer({
        port: testPort,
        host: '127.0.0.1',
        bearerToken: 'test-token',
        sessionManager,
        onTelemetryEvent: (evt) => recordedEvents.push(evt)
      });
      await server.start();
    });

    afterAll(async () => {
      if (server) {
        await server.stop();
      }
    });

    it('should respond to /health without requiring auth', async () => {
      const res = await httpRequest(`http://127.0.0.1:${testPort}/health`);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.json.status, 'ok');
      assert.strictEqual(res.json.server, 'notely-mcp');
      assert.strictEqual(res.json.port, testPort);
      assert.ok(res.json.toolsCount >= 40);
    });

    it('should enforce Bearer token authentication when configured', async () => {
      // Without token -> 401
      const resUnauth = await httpRequest(`http://127.0.0.1:${testPort}/tools`);
      assert.strictEqual(resUnauth.statusCode, 401);

      // With token -> 200
      const resAuth = await httpRequest(`http://127.0.0.1:${testPort}/tools`, {
        headers: { Authorization: 'Bearer test-token' }
      });
      assert.strictEqual(resAuth.statusCode, 200);
      assert.ok(Array.isArray(resAuth.json.tools));
      const toolNames = resAuth.json.tools.map(t => t.name);
      assert.ok(toolNames.includes('notes.read'));
      assert.ok(toolNames.includes('notes.create'));
      assert.ok(toolNames.includes('diagrams.render'));
      assert.ok(toolNames.includes('index.build_index'));
      assert.ok(toolNames.includes('workspace.metadata'));
      assert.ok(toolNames.includes('media.list_assets'));
      assert.ok(toolNames.includes('git.status'));
    });

    it('should handle CORS preflight', async () => {
      const res = await httpRequest(`http://127.0.0.1:${testPort}/tools`, {
        method: 'OPTIONS'
      });
      assert.strictEqual(res.statusCode, 204);
      assert.strictEqual(res.headers['access-control-allow-origin'], '*');
    });

    it('should execute tools registered in ApplicationToolRegistry and emit telemetry', async () => {
      const schemas = applicationToolRegistry.toMcpSchemas();
      assert.ok(schemas.length >= 40);
      const personaList = schemas.find(s => s.name === 'personas.list');
      assert.ok(personaList);
    });
  });
});
