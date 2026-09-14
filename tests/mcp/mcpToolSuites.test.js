import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { applicationToolRegistry, ApplicationToolRegistry } = require('../../electron/tools/ApplicationToolRegistry.cjs');

describe('Notely MCP Tool Registry & Capability Suites Test', () => {
  let tmpDir;
  let registry;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notely-mcp-suite-test-'));
    registry = new ApplicationToolRegistry();

    // Initialize git repo in tmpDir for git.* tool tests
    try {
      execSync('git init && git config user.name "Test User" && git config user.email "test@example.com"', {
        cwd: tmpDir,
        stdio: 'ignore'
      });
    } catch {
      // Git unavailable in environment
    }

    // Populate initial workspace notes & assets
    fs.writeFileSync(
      path.join(tmpDir, 'Welcome.md'),
      `---
title: Welcome Note
tags: [getting-started, guide]
author: Notely Team
---

# Welcome Note

This is a comprehensive test note for Notely MCP capability suites.

## Section 1: Overview
- [ ] Implement MCP tools test suite due:2026-12-31
- [x] Fix ESM relative imports

Here is a wikilink to [[Architecture]].

\`\`\`javascript
const greeting = "Hello from Notely MCP";
console.log(greeting);
\`\`\`

\`\`\`mermaid
flowchart TD
  Client[MCP Client] --> SSE[HTTP SSE Transport]
  SSE --> Registry[Application Tool Registry]
\`\`\`

![Preview Graphic](media/preview.png)
`,
      'utf8'
    );

    fs.writeFileSync(
      path.join(tmpDir, 'Architecture.md'),
      `# Architecture

Details regarding the Notely MCP architecture.
`,
      'utf8'
    );

    const mediaDir = path.join(tmpDir, 'media');
    fs.mkdirSync(mediaDir, { recursive: true });
    fs.writeFileSync(path.join(mediaDir, 'preview.png'), 'fake-binary-image-data', 'utf8');

    try {
      execSync('git add . && git commit -m "initial commit"', { cwd: tmpDir, stdio: 'ignore' });
    } catch {
      // ignore
    }
  });

  afterAll(() => {
    try {
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    } catch {
      // ignore Windows file locks in temp
    }
  });

  describe('1. Schema Registry & Verification', () => {
    it('should register exactly 133 tools across all suites', () => {
      const schemas = registry.toMcpSchemas();
      expect(schemas.length).toBe(133);
      expect(registry.tools.size).toBe(133);
    });

    it('should expose valid MCP JSON Schema for every single tool', () => {
      const schemas = registry.toMcpSchemas();
      for (const tool of schemas) {
        expect(tool.name).toBeTruthy();
        expect(typeof tool.name).toBe('string');
        expect(tool.description).toBeTruthy();
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe('object');
        expect(tool.inputSchema.properties).toBeDefined();

        if (tool.isWrite) {
          expect(tool.description.startsWith('[WRITE]')).toBe(true);
        }
      }
    });

    it('should block write tools when allowWriteTools is false', async () => {
      const res = await registry.executeTool(
        'notes.create',
        { title: 'Blocked Note', content: 'Blocked' },
        { workspaceRoot: tmpDir, allowWriteTools: false }
      );
      expect(res.success).toBe(false);
      expect(res.error.code).toBe('WRITE_DISABLED');
    });

    it('should resolve workspace-relative paths in all formats (leading slash, relative dot, subfolder)', async () => {
      // Subfolder test file
      const subDir = path.join(tmpDir, 'subfolder');
      fs.mkdirSync(subDir, { recursive: true });
      fs.writeFileSync(path.join(subDir, 'nested.md'), '# Nested Note\nBody content.', 'utf8');

      const relativeVariants = [
        'Welcome.md',
        '/Welcome.md',
        '\\Welcome.md',
        './Welcome.md',
        'subfolder/nested.md',
        '/subfolder/nested.md',
        '\\subfolder\\nested.md'
      ];

      for (const p of relativeVariants) {
        const res = await registry.executeTool('notes.read', { filePath: p }, { workspaceRoot: tmpDir });
        expect(res.success).toBe(true);
        expect(res.data.content).toBeTruthy();
      }
    });

    it('should reject path traversal attempts outside workspace', async () => {
      const traversalPaths = ['../outside.md', '/../outside.md', '..\\outside.md'];
      for (const p of traversalPaths) {
        const res = await registry.executeTool('notes.read', { filePath: p }, { workspaceRoot: tmpDir });
        expect(res.success).toBe(false);
        expect(res.error.message).toMatch(/Path traversal rejected/);
      }
    });
  });

  describe('2. Notes Suite (`notes.*`)', () => {
    it('notes.read should read note with lines and metadata', async () => {
      const res = await registry.executeTool(
        'notes.read',
        { filePath: 'Welcome.md', startLine: 1, maxLines: 20 },
        { workspaceRoot: tmpDir }
      );
      expect(res.success).toBe(true);
      expect(res.data.content).toContain('Welcome Note');
    });

    it('notes.read_frontmatter should parse YAML frontmatter correctly', async () => {
      const res = await registry.executeTool(
        'notes.read_frontmatter',
        { filePath: 'Welcome.md' },
        { workspaceRoot: tmpDir }
      );
      expect(res.success).toBe(true);
      expect(res.data.hasFrontmatter).toBe(true);
      expect(res.data.metadata.title).toBe('Welcome Note');
      expect(res.data.metadata.tags).toContain('getting-started');
    });

    it('notes.extract_headings should list all document headings', async () => {
      const res = await registry.executeTool(
        'notes.extract_headings',
        { filePath: 'Welcome.md' },
        { workspaceRoot: tmpDir }
      );
      expect(res.success).toBe(true);
      expect(Array.isArray(res.data.headings)).toBe(true);
      const h1 = res.data.headings.find((h) => h.level === 1);
      expect(h1).toBeDefined();
      expect(h1.text).toBe('Welcome Note');
    });

    it('notes.stats should calculate line and word counts', async () => {
      const res = await registry.executeTool(
        'notes.stats',
        { filePath: 'Welcome.md' },
        { workspaceRoot: tmpDir }
      );
      expect(res.success).toBe(true);
      expect(res.data.wordCount).toBeGreaterThan(0);
      expect(res.data.lineCount).toBeGreaterThan(0);
    });

    it('notes.extract_code should find fenced code blocks', async () => {
      const res = await registry.executeTool(
        'notes.extract_code',
        { filePath: 'Welcome.md' },
        { workspaceRoot: tmpDir }
      );
      expect(res.success).toBe(true);
      expect(res.data.totalBlocks).toBeGreaterThanOrEqual(1);
      const jsBlock = res.data.codeBlocks.find((b) => b.language === 'javascript');
      expect(jsBlock).toBeDefined();
      expect(jsBlock.code).toContain('Hello from Notely MCP');
    });

    it('notes.count should count workspace markdown files', async () => {
      const res = await registry.executeTool('notes.count', {}, { workspaceRoot: tmpDir });
      expect(res.success).toBe(true);
      expect(res.data.total).toBeGreaterThanOrEqual(2);
    });
  });

  describe('3. Workspace Suite (`workspace.*`)', () => {
    it('workspace.metadata should return environment info', async () => {
      const res = await registry.executeTool('workspace.metadata', {}, { workspaceRoot: tmpDir });
      expect(res.success).toBe(true);
      expect(res.data.workspaceRoot).toBe(tmpDir);
    });

    it('workspace.statistics should aggregate note and task metrics', async () => {
      const res = await registry.executeTool('workspace.statistics', {}, { workspaceRoot: tmpDir });
      expect(res.success).toBe(true);
      expect(res.data.noteCount).toBeGreaterThanOrEqual(2);
      expect(res.data.taskCount).toBeGreaterThanOrEqual(1);
    });

    it('workspace.word_count should calculate workspace words', async () => {
      const res = await registry.executeTool('workspace.word_count', {}, { workspaceRoot: tmpDir });
      expect(res.success).toBe(true);
      expect(res.data.words).toBeGreaterThan(0);
    });

    it('workspace.lint should audit notes for formatting standards', async () => {
      const res = await registry.executeTool('workspace.lint', {}, { workspaceRoot: tmpDir });
      expect(res.success).toBe(true);
      expect(Array.isArray(res.data.issues)).toBe(true);
    });

    it('workspace.file_tree should generate file tree hierarchy', async () => {
      const res = await registry.executeTool('workspace.file_tree', {}, { workspaceRoot: tmpDir });
      expect(res.success).toBe(true);
      expect(res.data.tree).toBeDefined();
    });

    it('workspace.list_workspaces should enumerate known workspaces', async () => {
      const res = await registry.executeTool('workspace.list_workspaces', {}, { workspaceRoot: tmpDir });
      expect(res.success).toBe(true);
      expect(Array.isArray(res.data.workspaces)).toBe(true);
      expect(res.data.totalWorkspaces).toBeGreaterThanOrEqual(1);
    });

    it('workspace.current should return active vault statistics and branch', async () => {
      const res = await registry.executeTool('workspace.current', {}, { workspaceRoot: tmpDir });
      expect(res.success).toBe(true);
      expect(res.data.vaultName).toBeDefined();
      expect(res.data.totalNotes).toBeGreaterThanOrEqual(2);
      expect(res.data.exists).toBe(true);
    });

    it('workspace.notes_index should build catalog of all notes with tags and metrics', async () => {
      const res = await registry.executeTool('workspace.notes_index', {}, { workspaceRoot: tmpDir });
      expect(res.success).toBe(true);
      expect(res.data.totalNotes).toBeGreaterThanOrEqual(2);
      expect(Array.isArray(res.data.notes)).toBe(true);
      const welcome = res.data.notes.find(n => n.path.includes('Welcome.md'));
      expect(welcome).toBeDefined();
      expect(welcome.wordCount).toBeGreaterThan(0);
      expect(welcome.tags).toContain('getting-started');
    });

    it('workspace.media_used_index should index referenced media assets with integrity check', async () => {
      const res = await registry.executeTool('workspace.media_used_index', {}, { workspaceRoot: tmpDir });
      expect(res.success).toBe(true);
      expect(res.data.totalReferencedAssets).toBeGreaterThanOrEqual(1);
      const preview = res.data.assets.find(a => a.path.includes('preview.png'));
      expect(preview).toBeDefined();
      expect(preview.existsOnDisk).toBe(true);
    });
  });

  describe('4. Tasks Suite (`tasks.*`)', () => {
    it('tasks.extract should find checklist items', async () => {
      const res = await registry.executeTool('tasks.extract', {}, { workspaceRoot: tmpDir });
      expect(res.success).toBe(true);
      expect(res.data.length).toBeGreaterThanOrEqual(2);
      const openTask = res.data.find((t) => t.status === 'open');
      expect(openTask).toBeDefined();
      expect(openTask.text).toContain('Implement MCP tools test suite');
    });

    it('tasks.summary should provide task completion metrics', async () => {
      const res = await registry.executeTool('tasks.summary', {}, { workspaceRoot: tmpDir });
      expect(res.success).toBe(true);
      expect(res.data.totalTasks).toBeGreaterThanOrEqual(2);
      expect(res.data.completedTasks).toBeGreaterThanOrEqual(1);
    });

    it('tasks.create should append new task to a note', async () => {
      const res = await registry.executeTool(
        'tasks.create',
        { filePath: 'Welcome.md', taskText: 'Verify new test suite execution' },
        { workspaceRoot: tmpDir, allowWriteTools: true }
      );
      expect(res.success).toBe(true);
      expect(res.data.updated).toBe(true);

      // Verify task exists now
      const verifyRes = await registry.executeTool(
        'notes.read',
        { filePath: 'Welcome.md' },
        { workspaceRoot: tmpDir }
      );
      expect(verifyRes.data.content).toContain('Verify new test suite execution');
    });
  });

  describe('5. Search & Index Suites (`search.*`, `index.*`)', () => {
    it('search.notes should find text across documents', async () => {
      const res = await registry.executeTool(
        'search.notes',
        { query: 'greeting' },
        { workspaceRoot: tmpDir }
      );
      expect(res.success).toBe(true);
      expect(res.data.length).toBeGreaterThan(0);
      expect(res.data[0].title).toBe('Welcome.md');
    });

    it('search.regex should execute regex search across notes', async () => {
      const res = await registry.executeTool(
        'search.regex',
        { pattern: 'Hello from [A-Za-z]+' },
        { workspaceRoot: tmpDir }
      );
      expect(res.success).toBe(true);
      expect(res.data.matches.length).toBeGreaterThan(0);
    });

    it('index.build_index should construct hierarchical workspace index', async () => {
      const res = await registry.executeTool('index.build_index', {}, { workspaceRoot: tmpDir });
      expect(res.success).toBe(true);
      expect(res.data.documentsMap).toBeDefined();
      expect(res.data.stats).toBeDefined();
    });

    it('index.list_notes should return flat note index', async () => {
      const res = await registry.executeTool('index.list_notes', {}, { workspaceRoot: tmpDir });
      expect(res.success).toBe(true);
      expect(res.data.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('6. Diagrams & Media Suites (`diagrams.*`, `media.*`)', () => {
    it('diagrams.render should validate Mermaid diagrams', async () => {
      const res = await registry.executeTool(
        'diagrams.render',
        { code: 'flowchart LR\n  A --> B' },
        { workspaceRoot: tmpDir }
      );
      expect(res.success).toBe(true);
      expect(res.data.valid).toBe(true);
      expect(res.data.diagramType).toBe('Flowchart');
    });

    it('diagrams.list should parse diagrams using ESM workspaceMediaService', async () => {
      const res = await registry.executeTool('diagrams.list', {}, { workspaceRoot: tmpDir });
      expect(res.success).toBe(true);
      expect(Array.isArray(res.data)).toBe(true);
      expect(res.data.length).toBeGreaterThanOrEqual(1);
    });

    it('media.list should inventory media files in workspace', async () => {
      const res = await registry.executeTool('media.list', {}, { workspaceRoot: tmpDir });
      expect(res.success).toBe(true);
      expect(res.data.totalAssets).toBeGreaterThanOrEqual(1);
      const preview = res.data.assets.find((m) => m.path.includes('preview.png'));
      expect(preview).toBeDefined();
    });

    it('media.list_assets should return assets list with format', async () => {
      const res = await registry.executeTool('media.list_assets', {}, { workspaceRoot: tmpDir });
      expect(res.success).toBe(true);
      expect(res.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('7. Draw.io & Excalidraw Suites (`drawio.*`, `excalidraw.*`)', () => {
    it('drawio.write_source and drawio.read_source should handle XML diagrams', async () => {
      const writeRes = await registry.executeTool(
        'drawio.write_source',
        { diagramId: 'test_drawio_1', xml: '<mxfile host="Electron"><diagram name="Page-1">root</diagram></mxfile>' },
        { workspaceRoot: tmpDir, allowWriteTools: true }
      );
      expect(writeRes.success).toBe(true);
      expect(writeRes.data.diagramId).toBe('test_drawio_1');

      const readRes = await registry.executeTool(
        'drawio.read_source',
        { diagramId: 'test_drawio_1' },
        { workspaceRoot: tmpDir }
      );
      expect(readRes.success).toBe(true);
      expect(readRes.data.xml).toContain('<mxfile');
    });

    it('excalidraw.create and excalidraw.read should manage canvas drawings', async () => {
      const createRes = await registry.executeTool(
        'excalidraw.create',
        {
          filePath: 'canvas_demo.excalidraw',
          elements: [{ id: 'elem_1', type: 'rectangle', x: 10, y: 10, width: 100, height: 50 }]
        },
        { workspaceRoot: tmpDir, allowWriteTools: true }
      );
      expect(createRes.success).toBe(true);
      expect(createRes.data.filePath).toBeDefined();

      const readRes = await registry.executeTool(
        'excalidraw.read',
        { filePath: createRes.data.filePath },
        { workspaceRoot: tmpDir }
      );
      expect(readRes.success).toBe(true);
      expect(readRes.data.elementsCount).toBe(1);
      expect(readRes.data.data.elements[0].type).toBe('rectangle');
    });
  });

  describe('8. Git Suite (`git.*`)', () => {
    it('git.status should report repository status', async () => {
      const res = await registry.executeTool('git.status', {}, { workspaceRoot: tmpDir });
      expect(res.success).toBe(true);
      expect(res.data.isGitRepo).toBe(true);
    });

    it('git.log should report commit log history', async () => {
      const res = await registry.executeTool('git.log', { maxCount: 5 }, { workspaceRoot: tmpDir });
      expect(res.success).toBe(true);
      expect(Array.isArray(res.data.commits)).toBe(true);
      expect(res.data.commits.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('9. Diagnostics Suite (`diagnostics.*`)', () => {
    it('diagnostics.check_health should report system readiness', async () => {
      const res = await registry.executeTool('diagnostics.check_health', {}, { workspaceRoot: tmpDir });
      expect(res.success).toBe(true);
      expect(res.data.serverStatus).toBeDefined();
      expect(res.data.database).toBeDefined();
    });

    it('diagnostics.get_telemetry should return tool execution flight logs', async () => {
      const res = await registry.executeTool('diagnostics.get_telemetry', {}, { workspaceRoot: tmpDir });
      expect(res.success).toBe(true);
      expect(res.data.stats).toBeDefined();
      expect(Array.isArray(res.data.logs)).toBe(true);
    });
  });
});
