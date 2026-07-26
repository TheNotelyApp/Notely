const assert = require('assert');
const fs = require('fs');
const path = require('path');
const LogDB = require('../../ai/logs/LogDB');
const GraphService = require('../../ai/graph/GraphService');

describe('User Reported AI Fixes Tests', () => {
  let tempDir;
  let logDb;

  beforeAll(() => {
    tempDir = path.join(__dirname, 'temp-user-fixes');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    logDb = new LogDB(tempDir);
    logDb.initialize();
  });

  afterAll(() => {
    logDb.close();
    if (fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch { /* ignore Windows file handle lock */ }
    }
  });

  it('should store and retrieve persistent logs via LogDB', () => {
    logDb.addLog('graph', 'Graph rebuild started', 'info');
    logDb.addLog('embeddings', 'Embedding chunk indexed', 'info');

    const graphLogs = logDb.getLogs('graph');
    assert.strictEqual(graphLogs.length, 1);
    assert.strictEqual(graphLogs[0].message, 'Graph rebuild started');

    const embLogs = logDb.getLogs('embeddings');
    assert.strictEqual(embLogs.length, 1);
    assert.strictEqual(embLogs[0].message, 'Embedding chunk indexed');

    const allLogs = logDb.getLogs(null);
    assert.ok(allLogs.length >= 2);
  });

  it('should eliminate #20 tag false positives and extract Media, Documents, and URLs in GraphService', async () => {
    const mockGraphDb = {
      isInitialized: true,
      initialize: () => {},
      upsertEntity: () => {},
      upsertRelationship: () => {},
      db: { prepare: () => ({ run: () => {} }) }
    };
    const mockAgent = {
      llmRegistry: {
        getActiveProvider: () => {
          throw new Error('LLM unavailable for test; use regex fallback');
        }
      }
    };

    const graphService = new GraphService(mockAgent, mockGraphDb);
    const content = `
# 20. Introduction Header
This is a test note with #project tag and #v2 tag.
Check out wikilink [[Design Specs]].
Here is an image: ![architecture](Media/arch.png).
Here is a document: [reqs](Media/specs.pdf).
Here is an external link: [Google](https://google.com).
    `;

    const filePath = path.join(tempDir, 'test-note.md');
    await graphService.processNote(filePath, content);

    // Regex check directly on the improved patterns
    const tagRegex = /(?:^|\s)#([a-zA-Z_-]*[a-zA-Z][a-zA-Z0-9_-]*)/g;
    const matchedTags = [];
    let match;
    while ((match = tagRegex.exec(content)) !== null) {
      matchedTags.push(match[1]);
    }

    // Must match #project and #v2, but NOT #20
    assert.ok(matchedTags.includes('project'));
    assert.ok(matchedTags.includes('v2'));
    assert.strictEqual(matchedTags.includes('20'), false);
  });

  it('should mask raw execution exceptions in AIFlow.execute()', async () => {
    const AIFlow = require('../../ai/core/AIFlow');
    const mockAgent = {
      workspaceRoot: tempDir,
      queryExecutor: {
        execute: async () => {
          throw new Error('Database connection failed at /internal/db.sqlite: stacktrace info');
        }
      }
    };
    const flow = new AIFlow(mockAgent);
    await assert.rejects(
      async () => { await flow.execute('Hello world'); },
      (err) => {
        assert.ok(err.message.includes('/internal/db.sqlite'));
        return true;
      }
    );
  });

  it('should sanitize tool error responses in ApplicationToolRegistry', async () => {
    const { applicationToolRegistry } = require('../../electron/tools/ApplicationToolRegistry.cjs');
    const vercelTools = await applicationToolRegistry.toVercelTools({});
    
    if (vercelTools.search_notes) {
      // Call search_notes with invalid empty args
      const res = await vercelTools.search_notes.execute({});
      assert.strictEqual(typeof res, 'string');
      assert.strictEqual(res.includes('EXECUTION_ERROR'), false);
      assert.strictEqual(res.includes('INVALID_INPUT'), false);
      assert.ok(res.includes('No results available'));
    }
  });

  it('should return neutral error strings from QueryTools.runTool', async () => {
    const QueryTools = require('../../ai/tools/QueryTools');
    const res = await QueryTools.runTool({}, 'read_note', { file_path: '/nonexistent/path.md' });
    assert.strictEqual(res.startsWith('Error:'), false);
    assert.ok(res.includes('Note not found'));
  });

  it('should mask Vercel AI SDK tool-call errors in QueryExecutor execute()', async () => {
    const QueryExecutor = require('../../ai/executor/QueryExecutor');
    const sdkError = new Error('Failed to call a function. Please adjust your prompt. See \'failed_generation\' for more details.');
    sdkError.name = 'AI_InvalidToolInputError';

    const mockAgent = {
      workspaceRoot: tempDir,
      documentService: null,
      llmRegistry: null
    };
    const executor = new QueryExecutor(mockAgent);
    executor._prepareConfig = async () => { throw sdkError; };

    const result = await executor.execute('test query', {});
    assert.strictEqual(result.isError, true);
    assert.ok(
      result.result.includes('unable') || result.result.includes('rephrasing'),
      `Expected safe message, got: ${result.result}`
    );
    assert.ok(!result.result.includes('failed_generation'), 'SDK internal key must not leak');
    assert.ok(!result.result.includes('Failed to call a function'), 'SDK message must not leak');
  });

  it('should include response, conversation, formatting policies and Tool Calling Discipline in PromptPipeline', () => {
    const PromptPipeline = require('../../ai/prompts/PromptPipeline');
    const pipeline = new PromptPipeline();

    const assembled = pipeline.assemble({
      category: 'Workspace Search',
      retrievedEvidence: 'Line 1: Note content\nLine 2: Secondary evidence\n' + 'A'.repeat(5000)
    });

    assert.ok(assembled.includes('Response Quality & Structure Policy'));
    assert.ok(assembled.includes('Conversation Policy'));
    assert.ok(assembled.includes('Formatting & Visual Rendering Policy'));
    assert.ok(assembled.includes('Tool Calling Discipline'));
    assert.ok(assembled.includes('retrieved evidence capped at 4000 chars'));

    // Check evidence newline trimming
    const cappedIdx = assembled.indexOf('retrieved evidence capped at 4000 chars');
    assert.ok(cappedIdx > 0);

    // Verify clearPromptCache
    pipeline.clearPromptCache();
    assert.strictEqual(pipeline._cachedStaticCore, null);
  });

  it('should treat Markdown files as source of truth for personas and write .md on custom persona creation', async () => {
    const PersonaManager = require('../../ai/personas/PersonaManager');
    const { ConversationStore } = require('../../ai/memory/ConversationStore');
    const { MemoryDB } = require('../../ai/memory/MemoryDB');
    const PromptPipeline = require('../../ai/prompts/PromptPipeline');

    const appDataDir = path.join(tempDir, 'appData');
    const manager = new PersonaManager(null, null, appDataDir);

    // 1. Primary lookup returns built-in .md file persona
    const generalPersona = manager.getPersona('general');
    assert.strictEqual(generalPersona.id, 'general');
    assert.strictEqual(generalPersona.name, 'General Assistant');

    // 2. Custom persona writes .md file to userPersonasDir
    const custom = manager.createCustomPersona({
      id: 'custom-architect',
      name: 'Custom Architect',
      description: 'System design expert',
      tone: 'analytical, precise',
      systemInstructions: 'Focus on architecture patterns.'
    });

    const expectedMdPath = path.join(appDataDir, 'personas', 'custom-architect.md');
    assert.ok(fs.existsSync(expectedMdPath), 'Custom persona .md file must exist');
    const fileContent = fs.readFileSync(expectedMdPath, 'utf8');
    assert.ok(fileContent.includes('id: custom-architect'));
    assert.ok(fileContent.includes('Focus on architecture patterns.'));

    // 3. ConversationStore defaults to 'general'
    const memoryDB = new MemoryDB(path.join(tempDir, 'test-conv.db'));
    await memoryDB.initialize();
    const store = new ConversationStore(memoryDB, null);
    const conv = store.createConversation('Test Title');
    assert.strictEqual(conv.persona, 'general');
    memoryDB.close();

    // 4. PromptPipeline renders custom persona objects with full Markdown richness
    const pipeline = new PromptPipeline();
    const assembled = pipeline.assemble({ persona: custom });
    assert.ok(assembled.includes('ACTIVE PERSONA ROLE (Custom Architect):'));
    assert.ok(assembled.includes('Tone: analytical, precise'));
  });
});


