import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import http from 'http';
import { execSync } from 'child_process';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { applicationToolRegistry, ApplicationToolRegistry } = require('../../electron/tools/ApplicationToolRegistry.cjs');
const { mcpPromptsRegistry } = require('../../electron/mcp/McpPrompts.cjs');
const { McpServer } = require('../../electron/mcp/McpServer.cjs');
const { cleanMarkdown, resolveNotePath } = require('../../electron/tools/EnterpriseToolSuite.cjs');

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

describe('Enterprise-Grade Unified MCP Tools & Prompts Test Suite', () => {
  let tmpDir;
  let registry;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notely-enterprise-test-'));
    registry = new ApplicationToolRegistry();

    // Initialize git repository in tmpDir
    try {
      execSync('git init && git config user.name "Test User" && git config user.email "test@example.com"', {
        cwd: tmpDir,
        stdio: 'ignore'
      });
    } catch {
      // ignore
    }

    // Populate notes
    fs.writeFileSync(
      path.join(tmpDir, 'Architecture.md'),
      `---
title: System Architecture
tags: [architecture, backend, v2]
author: Alice
status: approved
---

# System Architecture

This document describes the core backend pipeline and data models.

## Database Design
We use SQLite for local fast querying and PostgreSQL for cloud sync.
- [ ] Implement index optimization due:2026-12-31
- [x] Create database schema migration
- [ ] Refactor telemetry table due:2025-01-01

Here is a link to [[Roadmap]] and [[Security Guide]].

\`\`\`mermaid
flowchart TD
  Client[MCP Client] --> Gateway[API Gateway]
  Gateway --> Service[Note Service]
\`\`\`

![Architecture Diagram](media/diagram.png)
`,
      'utf8'
    );

    fs.writeFileSync(
      path.join(tmpDir, 'Roadmap.md'),
      `# Roadmap

Future development milestones.
Refers to [[System Architecture]] and [[MissingDoc]].
#planning #v2
`,
      'utf8'
    );

    const mediaDir = path.join(tmpDir, 'media');
    fs.mkdirSync(mediaDir, { recursive: true });
    fs.writeFileSync(path.join(mediaDir, 'diagram.png'), 'fake-image-bytes', 'utf8');

    try {
      execSync('git add . && git commit -m "feat: initial enterprise notes"', { cwd: tmpDir, stdio: 'ignore' });
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
      // ignore
    }
  });

  describe('1. Unified Tool Registration & Annotations', () => {
    it('should expose exactly 7 unified enterprise tools in unified mode', () => {
      const unifiedTools = registry.toMcpSchemas({ mode: 'unified' });
      expect(unifiedTools.length).toBe(7);

      const names = unifiedTools.map(t => t.name);
      expect(names).toEqual([
        'search',
        'read_note',
        'edit_note',
        'manage_tasks',
        'manage_diagrams',
        'workspace_overview',
        'git_control'
      ]);
    });

    it('should attach MCP annotations (readOnly, idempotent, destructive) to enterprise tools', () => {
      const unifiedTools = registry.toMcpSchemas({ mode: 'unified' });
      const searchTool = unifiedTools.find(t => t.name === 'search');
      const readTool = unifiedTools.find(t => t.name === 'read_note');
      const editTool = unifiedTools.find(t => t.name === 'edit_note');

      expect(searchTool.annotations).toEqual({ readOnly: true, idempotent: true });
      expect(readTool.annotations).toEqual({ readOnly: true, idempotent: true });
      expect(editTool.annotations).toEqual({ readOnly: false, destructive: true });
    });
  });

  describe('2. Multi-Modal Search Tool (`search`)', () => {
    it('should search notes by fulltext query and return match breakdown', async () => {
      const res = await registry.executeTool('search', {
        query: 'backend pipeline'
      }, { workspaceRoot: tmpDir });

      expect(res.success).toBe(true);
      expect(res.data.totalHits).toBeGreaterThanOrEqual(1);
      const hit = res.data.hits[0];
      expect(hit.title).toBe('System Architecture');
      expect(hit.matchReasons.textSnippets.length).toBeGreaterThan(0);
      expect(hit.stats.wordCount).toBeGreaterThan(0);
      expect(hit.stats.taskCount).toBe(3);
      expect(hit.stats.diagramCount).toBe(1);
      expect(res.data.suggestedFollowUps.length).toBeGreaterThan(0);
    });

    it('should filter notes by tags', async () => {
      const res = await registry.executeTool('search', {
        tags: ['planning']
      }, { workspaceRoot: tmpDir });

      expect(res.success).toBe(true);
      expect(res.data.totalHits).toBe(1);
      expect(res.data.hits[0].title).toBe('Roadmap');
    });

    it('should support regex search mode', async () => {
      const res = await registry.executeTool('search', {
        query: '/SQLite.*PostgreSQL/',
        mode: 'regex'
      }, { workspaceRoot: tmpDir });

      expect(res.success).toBe(true);
      expect(res.data.totalHits).toBe(1);
      expect(res.data.hits[0].title).toBe('System Architecture');
    });
  });

  describe('3. 360° Note Inspector (`read_note`)', () => {
    it('should retrieve complete 360 note context in one call', async () => {
      const res = await registry.executeTool('read_note', {
        pathOrTitle: 'System Architecture'
      }, { workspaceRoot: tmpDir });

      expect(res.success).toBe(true);
      const note = res.data;

      expect(note.title).toBe('System Architecture');
      expect(note.folder).toBe('');
      expect(note.frontmatter).toEqual({
        title: 'System Architecture',
        tags: ['architecture', 'backend', 'v2'],
        author: 'Alice',
        status: 'approved'
      });
      expect(note.tags).toContain('architecture');
      expect(note.tags).toContain('backend');

      // Raw vs Cleaned text
      expect(note.content.raw).toContain('# System Architecture');
      expect(note.content.cleansed).not.toContain('#');
      expect(note.content.cleansed).not.toContain('```mermaid');
      expect(note.content.cleansed).toContain('System Architecture');

      // Outline
      expect(note.outline.length).toBe(2);
      expect(note.outline[0]).toEqual({ level: 1, text: 'System Architecture', line: 8 });
      expect(note.outline[1]).toEqual({ level: 2, text: 'Database Design', line: 12 });

      // Tasks
      expect(note.tasks.length).toBe(3);
      expect(note.tasks[0].status).toBe('open');
      expect(note.tasks[1].status).toBe('completed');
      expect(note.tasks[2].isOverdue).toBe(true);

      // Diagrams
      expect(note.diagrams.length).toBe(1);
      expect(note.diagrams[0].type).toBe('Flowchart');
      expect(note.diagrams[0].code).toContain('API Gateway');

      // Media with disk check
      expect(note.media.length).toBe(1);
      expect(note.media[0].name).toBe('diagram.png');
      expect(note.media[0].exists).toBe(true);
      expect(note.media[0].sizeBytes).toBeGreaterThan(0);

      // Links and Backlinks
      expect(note.links.outgoing).toContain('Roadmap');
      expect(note.links.outgoing).toContain('Security Guide');
      expect(note.links.backlinks).toContain('Roadmap.md');

      // Git History
      expect(note.gitHistory.length).toBeGreaterThanOrEqual(1);
      expect(note.gitHistory[0].message).toContain('initial enterprise notes');

      // Stats & Pagination
      expect(note.stats.words).toBeGreaterThan(20);
      expect(note.pagination.totalLines).toBeGreaterThan(15);
      expect(note.pagination.tokenEstimate).toBeGreaterThan(0);
    });

    it('should provide self-healing didYouMean suggestions when note is misspelled', async () => {
      const res = await registry.executeTool('read_note', {
        pathOrTitle: 'Architechtur'
      }, { workspaceRoot: tmpDir });

      expect(res.data.success).toBe(false);
      expect(res.data.error.code).toBe('NOTE_NOT_FOUND');
      expect(res.data.error.didYouMean).toContain('Architecture.md');
      expect(res.data.error.hint).toContain('Architecture.md');
    });

    it('should support clean line pagination with startLine and maxLines', async () => {
      const res = await registry.executeTool('read_note', {
        pathOrTitle: 'Architecture.md',
        startLine: 1,
        maxLines: 5
      }, { workspaceRoot: tmpDir });

      expect(res.success).toBe(true);
      expect(res.data.pagination.returnedLines).toBe(5);
      expect(res.data.pagination.hasMore).toBe(true);
      expect(res.data.pagination.nextStartLine).toBe(6);
    });
  });

  describe('4. Atomic Note Authoring & Modification (`edit_note`)', () => {
    it('should support dry-run preview without modifying disk', async () => {
      const res = await registry.executeTool('edit_note', {
        filePath: 'Architecture.md',
        operation: 'append',
        content: '## New Section\nDry-run text.',
        dryRun: true
      }, { workspaceRoot: tmpDir });

      expect(res.success).toBe(true);
      expect(res.data.dryRun).toBe(true);

      // Verify disk was NOT changed
      const onDisk = fs.readFileSync(path.join(tmpDir, 'Architecture.md'), 'utf8');
      expect(onDisk).not.toContain('Dry-run text.');
    });

    it('should create new note with frontmatter', async () => {
      const res = await registry.executeTool('edit_note', {
        filePath: 'docs/API.md',
        operation: 'create',
        content: '# API Docs\n\nEndpoint specs.',
        frontmatter: { version: '1.0', draft: false }
      }, { workspaceRoot: tmpDir });

      expect(res.success).toBe(true);
      expect(res.data.path).toBe('docs/API.md');

      const created = fs.readFileSync(path.join(tmpDir, 'docs', 'API.md'), 'utf8');
      expect(created).toMatch(/version:\s*['"]?1\.0['"]?/);
      expect(created).toContain('# API Docs');
    });

    it('should patch text via search and replace', async () => {
      const res = await registry.executeTool('edit_note', {
        filePath: 'docs/API.md',
        operation: 'patch',
        patch: {
          search: 'Endpoint specs.',
          replace: 'REST and GraphQL endpoint specs.'
        }
      }, { workspaceRoot: tmpDir });

      expect(res.success).toBe(true);
      const patched = fs.readFileSync(path.join(tmpDir, 'docs', 'API.md'), 'utf8');
      expect(patched).toContain('REST and GraphQL endpoint specs.');
    });

    it('should update frontmatter metadata without touching body', async () => {
      const res = await registry.executeTool('edit_note', {
        filePath: 'docs/API.md',
        operation: 'update_frontmatter',
        frontmatter: { status: 'published', author: 'Team' }
      }, { workspaceRoot: tmpDir });

      expect(res.success).toBe(true);
      const updated = fs.readFileSync(path.join(tmpDir, 'docs', 'API.md'), 'utf8');
      expect(updated).toContain('status: published');
      expect(updated).toContain('author: Team');
      expect(updated).toContain('REST and GraphQL endpoint specs.');
    });

    it('should rename note safely', async () => {
      const res = await registry.executeTool('edit_note', {
        filePath: 'docs/API.md',
        operation: 'rename',
        newPath: 'docs/ApiReference.md'
      }, { workspaceRoot: tmpDir });

      expect(res.success).toBe(true);
      expect(res.data.newPath).toBe('docs/ApiReference.md');
      expect(fs.existsSync(path.join(tmpDir, 'docs', 'ApiReference.md'))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, 'docs', 'API.md'))).toBe(false);
    });

    it('should delete note cleanly', async () => {
      const res = await registry.executeTool('edit_note', {
        filePath: 'docs/ApiReference.md',
        operation: 'delete'
      }, { workspaceRoot: tmpDir });

      expect(res.success).toBe(true);
      expect(res.data.deleted).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, 'docs', 'ApiReference.md'))).toBe(false);
    });
  });

  describe('5. Task & Checklist Management (`manage_tasks`)', () => {
    it('should list all tasks across workspace with overdue detection', async () => {
      const res = await registry.executeTool('manage_tasks', {
        operation: 'list'
      }, { workspaceRoot: tmpDir });

      expect(res.success).toBe(true);
      expect(res.data.totalTasks).toBeGreaterThanOrEqual(3);

      const overdue = res.data.tasks.find(t => t.isOverdue);
      expect(overdue).toBeDefined();
      expect(overdue.dueDate).toBe('2025-01-01');
    });

    it('should create a new task with due date in target note', async () => {
      const res = await registry.executeTool('manage_tasks', {
        operation: 'create',
        notePath: 'Roadmap.md',
        taskText: 'Design new plugin architecture',
        dueDate: '2026-11-15'
      }, { workspaceRoot: tmpDir });

      expect(res.success).toBe(true);
      expect(res.data.created).toBe(true);

      const noteText = fs.readFileSync(path.join(tmpDir, 'Roadmap.md'), 'utf8');
      expect(noteText).toContain('- [ ] Design new plugin architecture due:2026-11-15');
    });

    it('should complete task by matching text', async () => {
      const res = await registry.executeTool('manage_tasks', {
        operation: 'complete',
        notePath: 'Roadmap.md',
        taskText: 'Design new plugin architecture'
      }, { workspaceRoot: tmpDir });

      expect(res.success).toBe(true);
      expect(res.data.completed).toBe(true);

      const noteText = fs.readFileSync(path.join(tmpDir, 'Roadmap.md'), 'utf8');
      expect(noteText).toContain('- [x] Design new plugin architecture');
    });

    it('should archive completed tasks to bottom section', async () => {
      const res = await registry.executeTool('manage_tasks', {
        operation: 'archive_completed',
        notePath: 'Roadmap.md'
      }, { workspaceRoot: tmpDir });

      expect(res.success).toBe(true);
      expect(res.data.archivedCount).toBe(1);

      const noteText = fs.readFileSync(path.join(tmpDir, 'Roadmap.md'), 'utf8');
      expect(noteText).toContain('## Completed Tasks');
      expect(noteText).toContain('- [x] Design new plugin architecture');
    });
  });

  describe('6. Diagram Management (`manage_diagrams`)', () => {
    it('should list all diagrams across workspace', async () => {
      const res = await registry.executeTool('manage_diagrams', {
        operation: 'list'
      }, { workspaceRoot: tmpDir });

      expect(res.success).toBe(true);
      expect(res.data.totalDiagrams).toBeGreaterThanOrEqual(1);
      expect(res.data.diagrams[0].type).toBe('mermaid');
    });

    it('should read Mermaid diagram from note', async () => {
      const res = await registry.executeTool('manage_diagrams', {
        operation: 'read',
        notePath: 'Architecture.md',
        diagramIndex: 0
      }, { workspaceRoot: tmpDir });

      expect(res.success).toBe(true);
      expect(res.data.type).toBe('mermaid');
      expect(res.data.code).toContain('API Gateway');
    });

    it('should append new Mermaid diagram to note', async () => {
      const newDiagramCode = 'graph LR\n  A[Start] --> B[End]';
      const res = await registry.executeTool('manage_diagrams', {
        operation: 'create',
        notePath: 'Roadmap.md',
        content: newDiagramCode
      }, { workspaceRoot: tmpDir });

      expect(res.success).toBe(true);
      const noteText = fs.readFileSync(path.join(tmpDir, 'Roadmap.md'), 'utf8');
      expect(noteText).toContain('```mermaid\ngraph LR\n  A[Start] --> B[End]\n```');
    });
  });

  describe('7. Workspace Overview & Health (`workspace_overview`)', () => {
    it('should return workspace statistics and storage breakdown', async () => {
      const res = await registry.executeTool('workspace_overview', {
        operation: 'summary'
      }, { workspaceRoot: tmpDir });

      expect(res.success).toBe(true);
      expect(res.data.noteCount).toBeGreaterThanOrEqual(2);
      expect(res.data.storageBytes).toBeGreaterThan(0);
      expect(res.data.health).toBe('healthy');
    });

    it('should generate hierarchical folder tree', async () => {
      const res = await registry.executeTool('workspace_overview', {
        operation: 'tree',
        maxDepth: 3
      }, { workspaceRoot: tmpDir });

      expect(res.success).toBe(true);
      expect(res.data.type).toBe('directory');
      expect(res.data.children.length).toBeGreaterThanOrEqual(2);
    });

    it('should audit workspace links and detect broken wikilinks', async () => {
      const res = await registry.executeTool('workspace_overview', {
        operation: 'lint'
      }, { workspaceRoot: tmpDir });

      expect(res.success).toBe(true);
      expect(res.data.totalNotesScanned).toBeGreaterThanOrEqual(2);
      const brokenLinkIssue = res.data.issues.find(i => i.issue === 'BROKEN_WIKILINK' && i.target === 'missingdoc');
      expect(brokenLinkIssue).toBeDefined();
    });
  });

  describe('8. Git Control Tool (`git_control`)', () => {
    it('should return git branch and working tree status', async () => {
      const res = await registry.executeTool('git_control', {
        action: 'status'
      }, { workspaceRoot: tmpDir });

      expect(res.success).toBe(true);
      expect(res.data.action).toBe('status');
      expect(res.data.branch).toBeDefined();
    });

    it('should return git commit log history', async () => {
      const res = await registry.executeTool('git_control', {
        action: 'log',
        limit: 5
      }, { workspaceRoot: tmpDir });

      expect(res.success).toBe(true);
      expect(res.data.commits.length).toBeGreaterThanOrEqual(1);
      expect(res.data.commits[0].message).toContain('initial enterprise notes');
    });
  });

  describe('9. MCP Prompts Primitive', () => {
    it('should register 5 enterprise prompts', () => {
      const prompts = mcpPromptsRegistry.listPrompts();
      expect(prompts.length).toBe(5);

      const names = prompts.map(p => p.name);
      expect(names).toEqual([
        'summarize_note',
        'plan_tasks',
        'explore_knowledge_graph',
        'refactor_note',
        'daily_review'
      ]);
    });

    it('should generate prompt messages with arguments', () => {
      const res = mcpPromptsRegistry.getPrompt('summarize_note', {
        notePath: 'Architecture.md',
        depth: 'brief'
      });

      expect(res.description).toContain('executive summary');
      expect(res.messages.length).toBe(1);
      expect(res.messages[0].role).toBe('user');
      expect(res.messages[0].content.text).toContain('Architecture.md');
      expect(res.messages[0].content.text).toContain('brief 1-paragraph summary');
    });
  });

  describe('10. MCP Server HTTP & Prompts Integration', () => {
    let server;
    const testPort = 3795;

    beforeAll(async () => {
      server = new McpServer({
        port: testPort,
        host: '127.0.0.1',
        bearerToken: 'test-token',
        toolMode: 'unified'
      });
      await server.start();
    });

    afterAll(async () => {
      if (server) await server.stop();
    });

    it('should expose /prompts endpoint via HTTP', async () => {
      const res = await httpRequest(`http://127.0.0.1:${testPort}/prompts`, {
        headers: { Authorization: 'Bearer test-token' }
      });

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json.prompts)).toBe(true);
      expect(res.json.prompts.length).toBe(5);
    });

    it('should expose only 7 unified enterprise tools via /tools when toolMode is unified', async () => {
      const res = await httpRequest(`http://127.0.0.1:${testPort}/tools`, {
        headers: { Authorization: 'Bearer test-token' }
      });

      expect(res.statusCode).toBe(200);
      expect(res.json.tools.length).toBe(7);
      const names = res.json.tools.map(t => t.name);
      expect(names).toEqual([
        'search',
        'read_note',
        'edit_note',
        'manage_tasks',
        'manage_diagrams',
        'workspace_overview',
        'git_control'
      ]);
    });
  });
});
