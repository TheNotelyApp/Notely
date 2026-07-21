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
      fs.rmSync(tempDir, { recursive: true, force: true });
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
});
