import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import http from 'http';
import { createNotelyMcpServer } from '../../../electron/mcp/createNotelyMcpServer.cjs';
import { NotelyMcpSseService } from '../../../electron/mcp/sseTransport.cjs';

describe('Notely MCP Server', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notely-mcp-test-'));
    // Setup sample notes
    fs.writeFileSync(
      path.join(tmpDir, 'Overview.md'),
      '# Workspace Overview\nWelcome to Notely notes.\n\n- [ ] Finish architecture plan\n- [x] Create MCP server\n\nRelated to [[Architecture]]'
    );
    fs.writeFileSync(
      path.join(tmpDir, 'Architecture.md'),
      '# Architecture\nDetails on Model Context Protocol and local embeddings.\nBacklink to [[Overview]].'
    );
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('should initialize McpServer and register tools and prompts', () => {
    const server = createNotelyMcpServer({
      getWorkspaceRoot: () => tmpDir
    });

    expect(server).toBeDefined();
    expect(server._registeredTools).toBeDefined();
    expect(server._registeredTools['list_notes']).toBeDefined();
    expect(server._registeredTools['read_note']).toBeDefined();
    expect(server._registeredTools['create_note']).toBeDefined();
    expect(server._registeredTools['search_notes']).toBeDefined();
    expect(server._registeredTools['get_note_graph']).toBeDefined();
    expect(server._registeredTools['list_tasks']).toBeDefined();

    // Prompts (Personas)
    expect(server._registeredPrompts['general']).toBeDefined();
    expect(server._registeredPrompts['software-engineer']).toBeDefined();
    expect(server._registeredPrompts['technical-architect']).toBeDefined();
    expect(server._registeredPrompts['research-assistant']).toBeDefined();
  });

  it('should execute list_notes tool handler', async () => {
    const server = createNotelyMcpServer({
      getWorkspaceRoot: () => tmpDir
    });

    const handler = server._registeredTools['list_notes'].handler;
    const result = await handler({});
    expect(result.content).toBeDefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.total).toBe(2);
    const paths = data.notes.map((n) => n.path);
    expect(paths).toContain('Overview.md');
    expect(paths).toContain('Architecture.md');
  });

  it('should execute read_note tool handler', async () => {
    const server = createNotelyMcpServer({
      getWorkspaceRoot: () => tmpDir
    });

    const handler = server._registeredTools['read_note'].handler;
    const result = await handler({ path: 'Overview.md' });
    expect(result.content[0].text).toContain('# Workspace Overview');
  });

  it('should execute create_note and update_note tool handlers', async () => {
    const server = createNotelyMcpServer({
      getWorkspaceRoot: () => tmpDir
    });

    const createHandler = server._registeredTools['create_note'].handler;
    await createHandler({ path: 'NewTopic.md', content: '## Brand New Topic' });

    expect(fs.existsSync(path.join(tmpDir, 'NewTopic.md'))).toBe(true);

    const updateHandler = server._registeredTools['update_note'].handler;
    await updateHandler({ path: 'NewTopic.md', content: '## Updated Topic Content' });

    const content = fs.readFileSync(path.join(tmpDir, 'NewTopic.md'), 'utf8');
    expect(content).toBe('## Updated Topic Content');
  });

  it('should execute search_notes tool handler', async () => {
    const server = createNotelyMcpServer({
      getWorkspaceRoot: () => tmpDir
    });

    const searchHandler = server._registeredTools['search_notes'].handler;
    const result = await searchHandler({ query: 'embeddings' });
    const data = JSON.parse(result.content[0].text);
    expect(data.results.length).toBeGreaterThan(0);
    expect(data.results[0].path).toBe('Architecture.md');
  });

  it('should execute get_note_graph tool handler', async () => {
    const server = createNotelyMcpServer({
      getWorkspaceRoot: () => tmpDir
    });

    const graphHandler = server._registeredTools['get_note_graph'].handler;
    const result = await graphHandler({ path: 'Overview.md' });
    const data = JSON.parse(result.content[0].text);
    expect(data.forwardLinks).toContain('Architecture');
    expect(data.backlinks.length).toBe(1);
    expect(data.backlinks[0].path).toBe('Architecture.md');
  });

  it('should execute list_tasks tool handler', async () => {
    const server = createNotelyMcpServer({
      getWorkspaceRoot: () => tmpDir
    });

    const tasksHandler = server._registeredTools['list_tasks'].handler;
    const openTasks = await tasksHandler({ completed: false });
    const openData = JSON.parse(openTasks.content[0].text);
    expect(openData.count).toBe(1);
    expect(openData.tasks[0].task).toBe('Finish architecture plan');

    const doneTasks = await tasksHandler({ completed: true });
    const doneData = JSON.parse(doneTasks.content[0].text);
    expect(doneData.count).toBe(1);
    expect(doneData.tasks[0].task).toBe('Create MCP server');
  });

  it('should start HTTP SSE service and respond to /health', async () => {
    const testPort = 3729;
    const sseService = new NotelyMcpSseService({
      port: testPort,
      getWorkspaceRoot: () => tmpDir
    });

    await sseService.start();
    expect(sseService.isRunning).toBe(true);

    const healthData = await new Promise((resolve, reject) => {
      http
        .get(`http://127.0.0.1:${testPort}/health`, (res) => {
          let raw = '';
          res.on('data', (c) => (raw += c));
          res.on('end', () => resolve(JSON.parse(raw)));
        })
        .on('error', reject);
    });

    expect(healthData.status).toBe('ok');
    expect(healthData.port).toBe(testPort);
    expect(healthData.workspace).toBe(tmpDir);

    await sseService.stop();
    expect(sseService.isRunning).toBe(false);
  });
});
