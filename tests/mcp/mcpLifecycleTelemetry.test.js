import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import http from 'http';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { McpServer } = require('../../electron/mcp/McpServer.cjs');
const { McpLifecycle } = require('../../electron/mcp/McpLifecycle.cjs');

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
    if (options.body) req.write(options.body);
    req.end();
  });
}

describe('MCP Lifecycle & Telemetry Integration Tests', () => {
  let tmpDir;
  let lifecycle;
  let server;
  const testPort = 3799;

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notely-lifecycle-test-'));
    fs.writeFileSync(path.join(tmpDir, 'Note1.md'), '# Note 1\nContent 1', 'utf8');

    lifecycle = new McpLifecycle();
    lifecycle.initialize(tmpDir, () => tmpDir);

    server = new McpServer({
      port: testPort,
      host: '127.0.0.1',
      allowWriteTools: true,
      getWorkspaceRoot: () => tmpDir,
      onTelemetryEvent: (event) => lifecycle.broadcastTelemetryEvent(event)
    });

    await server.start();
  });

  afterAll(async () => {
    if (server) {
      await server.stop();
    }
    if (lifecycle) {
      await lifecycle.shutdown();
    }
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should reuse single TelemetryDB instance across repeated telemetry events', () => {
    const db1 = lifecycle.getTelemetryDb(tmpDir);
    expect(db1).toBeDefined();

    for (let i = 0; i < 25; i++) {
      lifecycle.broadcastTelemetryEvent({
        sessionId: 'sess_leak_test',
        toolName: 'read_note',
        input: { pathOrTitle: 'Note1.md' },
        output: { success: true },
        durationMs: 5,
        success: true
      });
    }

    const db2 = lifecycle.getTelemetryDb(tmpDir);
    // Same instance reference, no new connections created
    expect(db1).toBe(db2);
  });

  it('should expose MCP resources in /health endpoint', async () => {
    const res = await httpRequest(`http://127.0.0.1:${testPort}/health`);
    expect(res.statusCode).toBe(200);
    expect(res.json.status).toBe('ok');
    expect(res.json.resourcesCount).toBe(2);
  });

  it('should cleanly close database connection on lifecycle shutdown', async () => {
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notely-shutdown-test-'));
    try {
      const lc = new McpLifecycle();
      lc.initialize(testDir, () => testDir);
      const db = lc.getTelemetryDb(testDir);
      expect(db).toBeDefined();
      expect(lc.telemetryDbInstance).not.toBeNull();

      await lc.shutdown();
      expect(lc.telemetryDbInstance).toBeNull();
    } finally {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });
});
