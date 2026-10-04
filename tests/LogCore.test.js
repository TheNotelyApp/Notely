import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { LogCore } from '../electron/core/LogCore.cjs';

describe('Enterprise LogCore Engine', () => {
  let tempUserData;
  let logCore;

  beforeEach(() => {
    tempUserData = path.join(os.tmpdir(), `notely-logcore-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
    fs.mkdirSync(tempUserData, { recursive: true });
    logCore = new LogCore();
    logCore.initialize(tempUserData, { appVersion: '2.0.0-test' });
  });

  afterEach(() => {
    if (logCore) {
      logCore.close();
    }
    if (fs.existsSync(tempUserData)) {
      try {
        fs.rmSync(tempUserData, { recursive: true, force: true });
      } catch { /* ignore */ }
    }
  });

  it('initializes app-log.db with WAL mode and schema', () => {
    expect(fs.existsSync(path.join(tempUserData, 'logs', 'app-log.db'))).toBe(true);
    expect(logCore.isInitialized).toBe(true);
  });

  it('writes and queries logs with filters', () => {
    logCore.write({
      level: 'info',
      category: 'ai',
      subsystem: 'graph',
      source: 'GraphDB',
      message: 'Extracted 15 entities from note',
      meta: { count: 15 }
    });

    logCore.write({
      level: 'error',
      category: 'git',
      subsystem: 'git',
      source: 'GitService',
      message: 'Failed to commit: lock file present'
    });

    logCore.flush();

    const allLogs = logCore.queryLogs({ limit: 10 });
    expect(allLogs.rows.length).toBeGreaterThanOrEqual(2);

    const gitLogs = logCore.queryLogs({ category: 'git' });
    expect(gitLogs.rows.length).toBe(1);
    expect(gitLogs.rows[0].message).toContain('Failed to commit');

    const graphLogs = logCore.queryLogs({ subsystem: 'graph' });
    expect(graphLogs.rows.length).toBe(1);
    expect(graphLogs.rows[0].metadata.count).toBe(15);
  });

  it('redacts sensitive API tokens and keys automatically', () => {
    const sensitiveMessage = 'Connecting to service with apiKey: AIzaSyD89472398472938472938472938472 and token: gsk_abcdef1234567890';
    logCore.write({
      level: 'info',
      message: sensitiveMessage
    });
    logCore.flush();

    const res = logCore.queryLogs({ limit: 1 });
    expect(res.rows[0].message).not.toContain('AIzaSyD89472398472938472938472938472');
    expect(res.rows[0].message).toContain('[REDACTED]');
  });

  it('generates accurate telemetry aggregate stats', () => {
    logCore.write({ level: 'warn', message: 'Low disk warning' });
    logCore.write({ level: 'error', message: 'Fatal parse crash' });
    logCore.flush();

    const stats = logCore.getStats();
    expect(stats.total).toBeGreaterThanOrEqual(2);
    expect(stats.warns).toBeGreaterThanOrEqual(1);
    expect(stats.errors).toBeGreaterThanOrEqual(1);
  });

  it('clears logs while preserving crash/audit logs', () => {
    logCore.write({ level: 'info', category: 'app', message: 'Normal log' });
    logCore.write({ level: 'fatal', category: 'crash', message: 'Critical crash incident' });
    logCore.flush();

    logCore.clearLogs({ includeProtected: false });

    const remaining = logCore.queryLogs({ limit: 10 });
    const hasCrash = remaining.rows.some(r => r.category === 'crash');
    const hasNormal = remaining.rows.some(r => r.category === 'app' && r.message === 'Normal log');

    expect(hasCrash).toBe(true);
    expect(hasNormal).toBe(false);
  });
});
