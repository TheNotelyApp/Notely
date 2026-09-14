import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { ApplicationToolRegistry } = require('../electron/tools/ApplicationToolRegistry.cjs');
const { NoteApplicationService } = require('../electron/services/NoteApplicationService.cjs');

describe('Application Tool Registry Architecture Tests', () => {
  let tmpDir;
  let registry;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notely-tool-test-'));
    registry = new ApplicationToolRegistry();
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should list and resolve registered tools', () => {
    const schemas = registry.toMcpSchemas();
    expect(schemas.length).toBe(7);
    
    const readTool = schemas.find(s => s.name === 'read_note');
    expect(readTool).toBeDefined();
    expect(readTool.inputSchema).toBeDefined();
  });

  it('should safely execute edit_note and read_note within workspace boundaries', async () => {
    const createRes = await registry.executeTool('edit_note', {
      operation: 'create',
      filePath: 'Architecture Test Note.md',
      content: 'This is test content.'
    }, { workspaceRoot: tmpDir });

    expect(createRes.success).toBe(true);
    expect(createRes.data.operation).toBe('create');
    expect(createRes.metadata.toolName).toBe('edit_note');

    const createdPath = path.join(tmpDir, 'Architecture Test Note.md');
    expect(fs.existsSync(createdPath)).toBe(true);

    const readRes = await registry.executeTool('read_note', {
      pathOrTitle: 'Architecture Test Note.md'
    }, { workspaceRoot: tmpDir });

    expect(readRes.success).toBe(true);
    expect(readRes.data.content.raw).toContain('This is test content.');
  });

  it('should reject path traversal attempts outside workspace root', async () => {
    const service = new NoteApplicationService();
    const maliciousPath = path.resolve(tmpDir, '../outside_secret.txt');

    await expect(service.readNote({
      workspaceRoot: tmpDir,
      filePath: maliciousPath
    })).rejects.toThrow(/Path traversal rejected/);
  });

  it('should validate inputs for notes.update and notes.delete capabilities', async () => {
    const service = new NoteApplicationService();
    await expect(service.updateNote({})).rejects.toThrow(/filePath/);
    await expect(service.deleteNote({})).rejects.toThrow(/filePath/);
  });

  it('should calculate workspace overview cleanly', async () => {
    fs.writeFileSync(path.join(tmpDir, 'test1.md'), '# Test\n- [ ] Task 1\n[[Link1]]', 'utf8');

    const statsRes = await registry.executeTool('workspace_overview', {}, { workspaceRoot: tmpDir });
    expect(statsRes.success).toBe(true);
    expect(statsRes.data.noteCount).toBe(1);
    expect(statsRes.data.taskCount).toBe(1);
    expect(statsRes.data.linkCount).toBe(1);
  });

  it('should search notes cleanly without exposing storage internals', async () => {
    fs.writeFileSync(path.join(tmpDir, 'search_target.md'), '# Secret Topic\nUnique keyword antigravity.', 'utf8');

    const searchRes = await registry.executeTool('search', { query: 'antigravity' }, { workspaceRoot: tmpDir });
    expect(searchRes.success).toBe(true);
    expect(searchRes.data.hits.length).toBe(1);
    expect(searchRes.data.hits[0].title).toBe('Secret Topic');
  });
});
