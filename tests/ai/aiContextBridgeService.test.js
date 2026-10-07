const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  AiContextBridgeService,
  AI_BRIDGE_GITIGNORE_START,
  AI_BRIDGE_GITIGNORE_END,
  ROOT_BRIDGE_MARKER_START,
  ROOT_BRIDGE_MARKER_END
} = require('../../electron/services/AiContextBridgeService.cjs');

describe('AiContextBridgeService Test Suite', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notely-ai-bridge-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch { /* ignore */ }
  });

  it('1. should inject dedicated AI Bridge section into .gitignore without disturbing notes-app block', () => {
    const gitignorePath = path.join(tempDir, '.gitignore');
    const existingNotesAppBlock = `# >>> Notes App Managed >>>\n.notes-app/\n# <<< Notes App Managed <<<\n\n# User Rule\n*.log\n`;
    fs.writeFileSync(gitignorePath, existingNotesAppBlock, 'utf8');

    const service = new AiContextBridgeService({ workspaceRoot: tempDir });
    service.ensureGitignoreBridge(tempDir);

    const updated = fs.readFileSync(gitignorePath, 'utf8');
    assert.ok(updated.includes('# >>> Notes App Managed >>>'));
    assert.ok(updated.includes(AI_BRIDGE_GITIGNORE_START));
    assert.ok(updated.includes('.notes-app/ai/'));
    assert.ok(updated.includes('.vscode/mcp.json'));
    assert.ok(updated.includes(AI_BRIDGE_GITIGNORE_END));
    assert.ok(updated.includes('*.log'));
  });

  it('2. should generate master instructions in .notes-app/ai/instructions.md', async () => {
    const service = new AiContextBridgeService({
      workspaceRoot: tempDir,
      getMcpConfig: () => ({ port: 3800, host: '127.0.0.1', bearerToken: 'test-token-123' })
    });

    await service.syncNow();

    const instructionsPath = path.join(tempDir, '.notes-app', 'ai', 'instructions.md');
    assert.ok(fs.existsSync(instructionsPath), 'instructions.md should exist');

    const content = fs.readFileSync(instructionsPath, 'utf8');
    assert.ok(content.includes('Notely Workspace AI Instructions & Conventions'));
    assert.ok(content.includes('[[Exact Note Title]]'));
    assert.ok(content.includes('http://127.0.0.1:3800/mcp'));
    assert.ok(content.includes('read_note'));
    assert.ok(content.includes('get_knowledge_graph'));
  });

  it('3. should compile dynamic context snapshot with sitemap, hubs, and tasks', async () => {
    // Create sample notes
    fs.writeFileSync(
      path.join(tempDir, 'Architecture.md'),
      `# System Architecture\n\nTags: #system #core\n\nLinks to [[API-Design]] and [[Database-Schema]].\n\n- [ ] Write diagram spec due:2026-10-20\n- [x] Initial design\n`,
      'utf8'
    );
    fs.writeFileSync(
      path.join(tempDir, 'API-Design.md'),
      `# API Design\n\nTags: #api\n\nLinks to [[Architecture]].\n\n- [ ] Implement endpoints\n`,
      'utf8'
    );

    const service = new AiContextBridgeService({
      workspaceRoot: tempDir,
      getMcpConfig: () => ({ port: 3700, host: '127.0.0.1', bearerToken: '' })
    });

    await service.syncNow();

    const dynamicPath = path.join(tempDir, '.notes-app', 'ai', 'dynamic-context.md');
    assert.ok(fs.existsSync(dynamicPath), 'dynamic-context.md should exist');

    const content = fs.readFileSync(dynamicPath, 'utf8');
    assert.ok(content.includes('Notely Dynamic Workspace Context'));
    assert.ok(content.includes('Architecture.md'));
    assert.ok(content.includes('API-Design.md'));
    assert.ok(content.includes('Write diagram spec'));
    assert.ok(content.includes('Implement endpoints'));
    assert.ok(content.includes('#system'));
  });

  it('4. should write .vscode/mcp.json with headers if token is present', async () => {
    const service = new AiContextBridgeService({
      workspaceRoot: tempDir,
      getMcpConfig: () => ({ port: 3950, host: '127.0.0.1', bearerToken: 'secret_mcp_token_xyz' })
    });

    await service.syncNow();

    const mcpJsonPath = path.join(tempDir, '.vscode', 'mcp.json');
    assert.ok(fs.existsSync(mcpJsonPath), '.vscode/mcp.json should exist');

    const parsed = JSON.parse(fs.readFileSync(mcpJsonPath, 'utf8'));
    assert.strictEqual(parsed.mcpServers.notely.url, 'http://127.0.0.1:3950/mcp');
    assert.strictEqual(parsed.mcpServers.notely.headers.Authorization, 'Bearer secret_mcp_token_xyz');
  });

  it('5. should write root bridge files and preserve user customized content', async () => {
    const agentsPath = path.join(tempDir, 'AGENTS.md');
    fs.writeFileSync(agentsPath, '# User Custom Instructions\nAlways be concise.\n', 'utf8');

    const service = new AiContextBridgeService({ workspaceRoot: tempDir });
    await service.syncNow();

    const updated = fs.readFileSync(agentsPath, 'utf8');
    assert.ok(updated.includes('# User Custom Instructions'));
    assert.ok(updated.includes('Always be concise.'));
    assert.ok(updated.includes(ROOT_BRIDGE_MARKER_START));
    assert.ok(updated.includes('.notes-app/ai/instructions.md'));
    assert.ok(updated.includes(ROOT_BRIDGE_MARKER_END));

    // Other bridges should exist
    assert.ok(fs.existsSync(path.join(tempDir, 'CLAUDE.md')));
    assert.ok(fs.existsSync(path.join(tempDir, '.cursorrules')));
    assert.ok(fs.existsSync(path.join(tempDir, '.github', 'copilot-instructions.md')));
  });

  it('6. should transpile custom prompts to .vscode/prompts/, .github/prompts/, and .cursor/rules/', async () => {
    const promptsDir = path.join(tempDir, '.notes-app', 'prompts');
    fs.mkdirSync(promptsDir, { recursive: true });

    fs.writeFileSync(
      path.join(promptsDir, 'deep_research.md'),
      `---\nname: deep_research\ndescription: Perform in-depth research on a topic\n---\n\nResearch {{topic}} thoroughly with citations.\n`,
      'utf8'
    );

    const service = new AiContextBridgeService({ workspaceRoot: tempDir });
    await service.syncNow();

    const vscodePrompt = path.join(tempDir, '.vscode', 'prompts', 'deep_research.prompt.md');
    const githubPrompt = path.join(tempDir, '.github', 'prompts', 'deep_research.prompt.md');
    const cursorRule = path.join(tempDir, '.cursor', 'rules', 'notely-deep_research.mdc');

    assert.ok(fs.existsSync(vscodePrompt), 'vscode prompt should exist');
    assert.ok(fs.existsSync(githubPrompt), 'github prompt should exist');
    assert.ok(fs.existsSync(cursorRule), 'cursor rule should exist');

    const vscodeContent = fs.readFileSync(vscodePrompt, 'utf8');
    assert.ok(vscodeContent.includes('name: deep_research'));
    assert.ok(vscodeContent.includes('Research {{topic}} thoroughly with citations.'));

    const cursorContent = fs.readFileSync(cursorRule, 'utf8');
    assert.ok(cursorContent.includes('Notely Workflow: deep_research'));
  });

  it('7. should catalog binary document extractions and audio transcripts in dynamic-context.md', async () => {
    // 1. Setup mock audio transcript in media/audio/sync-meeting/transcript.json
    const audioDir = path.join(tempDir, 'media', 'audio', 'sync-meeting');
    fs.mkdirSync(audioDir, { recursive: true });
    fs.writeFileSync(
      path.join(audioDir, 'transcript.json'),
      JSON.stringify({ text: 'Discussed project architecture and milestones' }),
      'utf8'
    );

    // 2. Setup mock DocumentCacheStore record in SQLite
    const { DocumentCacheStore } = require('../../electron/lib/documents/DocumentCacheStore.cjs');
    const store = new DocumentCacheStore(tempDir);
    store.upsertRecord({
      relativePath: 'specs/system_overview.pdf',
      contentHash: 'hash_12345',
      fileSize: 45000,
      mtime: Date.now(),
      mimeType: 'application/pdf',
      extractedRelPath: '.notes-app/cache/extracted/system_overview.txt',
      pageCount: 14,
      wordCount: 3200,
      status: 'ready'
    });
    store.close();

    const service = new AiContextBridgeService({ workspaceRoot: tempDir });
    await service.syncNow();

    const dynamicPath = path.join(tempDir, '.notes-app', 'ai', 'dynamic-context.md');
    assert.ok(fs.existsSync(dynamicPath));

    const content = fs.readFileSync(dynamicPath, 'utf8');
    assert.ok(content.includes('## 6. Extracted Documents & Audio Transcripts'));
    assert.ok(content.includes('specs/system_overview.pdf'));
    assert.ok(content.includes('PDF Document'));
    assert.ok(content.includes('14 pages • 3200 words'));
    assert.ok(content.includes('media/audio/sync-meeting'));
    assert.ok(content.includes('Audio Recording'));
  });

  it('8. should catalog attached code repositories in dynamic-context.md', async () => {
    const metaDir = path.join(tempDir, '.notes-app');
    fs.mkdirSync(metaDir, { recursive: true });
    fs.writeFileSync(
      path.join(metaDir, 'metadata.json'),
      JSON.stringify({
        attachedRepos: [
          {
            id: 'repo-1',
            name: 'frontend-core',
            path: 'C:/code/frontend-core',
            branch: 'develop',
            remoteUrl: 'https://github.com/my-org/frontend-core.git',
            symbolCount: 88,
            fileCount: 24,
            status: 'indexed'
          }
        ]
      }),
      'utf8'
    );

    const service = new AiContextBridgeService({ workspaceRoot: tempDir });
    await service.syncNow();

    const dynamicPath = path.join(tempDir, '.notes-app', 'ai', 'dynamic-context.md');
    assert.ok(fs.existsSync(dynamicPath));

    const content = fs.readFileSync(dynamicPath, 'utf8');
    assert.ok(content.includes('## 7. Attached Code Repositories'));
    assert.ok(content.includes('frontend-core'));
    assert.ok(content.includes('develop'));
    assert.ok(content.includes('https://github.com/my-org/frontend-core.git'));
    assert.ok(content.includes('88 symbols • 24 files'));
  });

  it('9. should ensure AI Bridge root files (AGENTS.md, CLAUDE.md, .cursorrules) are ignored from workspace note listing', () => {
    // Create regular notes and bridge files
    fs.writeFileSync(path.join(tempDir, 'My-Regular-Note.md'), '# My Regular Note\n\nContent here.');
    fs.writeFileSync(path.join(tempDir, 'AGENTS.md'), '# AGENTS Instructions');
    fs.writeFileSync(path.join(tempDir, 'CLAUDE.md'), '# CLAUDE Instructions');
    fs.writeFileSync(path.join(tempDir, '.cursorrules'), 'Cursor rules');

    const { collectMarkdownFiles } = require('../../electron/services/NoteApplicationService.cjs');
    const { createWorkspaceEntries } = require('../../electron/lib/documents/workspaceEntries.cjs');
    const { shouldHideFile } = require('../../electron/lib/core/workspaceIgnorePolicy.cjs');

    assert.strictEqual(shouldHideFile('AGENTS.md'), true);
    assert.strictEqual(shouldHideFile('CLAUDE.md'), true);
    assert.strictEqual(shouldHideFile('.cursorrules'), true);
    assert.strictEqual(shouldHideFile('My-Regular-Note.md'), false);

    const collected = collectMarkdownFiles(tempDir);
    const basenames = collected.map(f => path.basename(f));
    assert.ok(basenames.includes('My-Regular-Note.md'), 'Regular note should be collected');
    assert.ok(!basenames.includes('AGENTS.md'), 'AGENTS.md should be ignored');
    assert.ok(!basenames.includes('CLAUDE.md'), 'CLAUDE.md should be ignored');

    const entriesHelper = createWorkspaceEntries({
      fs,
      path,
      ensureDir: () => {},
      parseDocument: (content, entryPath) => ({
        fileName: path.basename(entryPath),
        title: path.basename(entryPath, '.md'),
        metadata: {},
        rawNotes: content,
        cleansed: content,
        hash: 'hash'
      })
    });

    const entries = entriesHelper.listWorkspaceFileEntries(tempDir);
    const entryNames = entries.map(e => e.fileName);
    assert.ok(entryNames.includes('My-Regular-Note.md'));
    assert.ok(!entryNames.includes('AGENTS.md'));
    assert.ok(!entryNames.includes('CLAUDE.md'));
  });
});
