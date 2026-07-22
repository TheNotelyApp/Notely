const assert = require('assert');
const path = require('path');
const os = require('os');
const fs = require('fs');

const GraphDB = require('../../ai/graph/GraphDB');
const GraphService = require('../../ai/graph/GraphService');
const GraphQueue = require('../../ai/queue/GraphQueue');
const GraphWorker = require('../../ai/queue/GraphWorker');
const { GraphRetriever } = require('../../ai/context/GraphRetriever');

describe('Full Knowledge Graph Pipeline E2E Test', () => {
  let tmpDir;
  let graphDb;
  let graphQueue;
  let graphService;
  let worker;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notely-pipeline-test-'));
    graphDb = new GraphDB(tmpDir);
    graphDb.initialize();
    graphQueue = new GraphQueue(graphDb);
    graphService = new GraphService({ appDataDir: tmpDir }, graphDb);
    worker = new GraphWorker(graphDb, graphQueue, graphService);
  });

  afterEach(() => {
    if (worker) worker.pause();
    if (graphDb) graphDb.close();
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should process note through end-to-end pipeline: queue -> AST/AI parse -> DB -> CTE traversal', async () => {
    // 1. Create a dummy note file
    const notePath = path.join(tmpDir, 'ai-architecture.md');
    const noteContent = `# AI Knowledge Architecture
This document explains the Knowledge Graph pipeline in [[Notely App]].
Tagged with #ai and #architecture.

ModernBERT extracts named entities like **Neural Search Engine**.
Code example:
\`\`\`javascript
const pipeline = new KnowledgePipeline();
\`\`\`
Referencing external documentation at [Electron Docs](https://electronjs.org).
`;
    fs.writeFileSync(notePath, noteContent, 'utf8');

    // 2. Enqueue note job into persistent SQLite queue
    const jobId = graphQueue.enqueue(notePath, 1);
    assert.ok(jobId);

    // Verify job persisted in SQLite database
    const dbJob = graphDb.db.prepare('SELECT * FROM graph_queue WHERE id = ?').get(jobId);
    assert.ok(dbJob);
    assert.strictEqual(dbJob.note_path, path.normalize(notePath));

    // 3. Process note via GraphService (simulating worker execution)
    await graphService.processNote(notePath, noteContent);
    graphQueue.updateStatus(jobId, 'done');

    // 4. Verify entities upserted in GraphDB
    const rootEntity = graphDb.db.prepare('SELECT * FROM entities WHERE note_path = ?').get(notePath);
    assert.ok(rootEntity);
    assert.strictEqual(rootEntity.name, 'ai-architecture');

    const wikilinkEntity = graphDb.db.prepare("SELECT * FROM entities WHERE name = 'Notely App'").get();
    assert.ok(wikilinkEntity);

    const tagEntity = graphDb.db.prepare("SELECT * FROM entities WHERE name = '#ai'").get();
    assert.ok(tagEntity);

    // 5. Verify provenance evidence logged in EvidenceStore
    const evidenceList = graphDb.db.prepare('SELECT * FROM evidence WHERE source_id = ?').all(notePath);
    assert.ok(evidenceList.length > 0);

    // 6. Verify recursive CTE traversal using GraphRetriever
    const retriever = new GraphRetriever(graphDb);
    const relations = retriever.traverse(notePath, 2);
    assert.ok(relations.length >= 2);
    const targetPaths = relations.map(r => r.to_path);
    assert.ok(targetPaths.includes('Notely App') || targetPaths.includes('#ai'));
  });
});
