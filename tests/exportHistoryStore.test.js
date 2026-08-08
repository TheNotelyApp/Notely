import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const { ExportHistoryStore } = require('../electron/lib/export/exportHistoryStore.cjs');

describe('ExportHistoryStore', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notely-export-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('adds, retrieves, and removes export records in SQLite/JSON fallback', async () => {
    const store = new ExportHistoryStore(tempDir, () => tempDir);

    const record = await store.addRecord({
      filename: 'spec.pdf',
      filePath: path.join(tempDir, 'spec.pdf'),
      fileSize: 1024,
      exportType: 'pdf',
      category: 'document',
      sourceNote: 'spec.md'
    });

    expect(record.id).toBeDefined();
    expect(record.filename).toBe('spec.pdf');

    const history = await store.getHistory();
    expect(history.length).toBe(1);
    expect(history[0].filename).toBe('spec.pdf');
    expect(history[0].exportType).toBe('pdf');

    // Remove record
    const result = await store.removeRecord(record.id);
    expect(result).toBe(true);

    const historyAfter = await store.getHistory();
    expect(historyAfter.length).toBe(0);

    store.close();
  });

  it('creates database file inside .notes-app directory', async () => {
    const store = new ExportHistoryStore(tempDir, () => tempDir);
    await store.addRecord({
      filename: 'test.nly',
      filePath: path.join(tempDir, 'test.nly'),
      fileSize: 500,
      exportType: 'note_package',
      category: 'document'
    });

    const notesAppDir = path.join(tempDir, '.notes-app');
    expect(fs.existsSync(notesAppDir)).toBe(true);

    const hasDbOrJson = fs.existsSync(path.join(notesAppDir, 'export-history.db')) ||
                        fs.existsSync(path.join(notesAppDir, 'export-history.json'));
    expect(hasDbOrJson).toBe(true);

    store.close();
  });
});
