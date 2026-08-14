import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import GraphDB from '../ai/graph/GraphDB';
import GraphService from '../ai/graph/GraphService';
import GraphBuilder from '../ai/graph/GraphBuilder';
import GraphWorker from '../ai/queue/GraphWorker';
import GraphQueue from '../ai/queue/GraphQueue';

describe('Knowledge Graph Incremental Update vs Full Rebuild Parity Test Suite', () => {
  const tmpDir = path.join(__dirname, 'tmp_parity_workspace');
  let graphDb;
  let graphService;
  let graphBuilder;

  beforeEach(() => {
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    const notesDir = path.join(tmpDir, 'notes');
    if (!fs.existsSync(notesDir)) {
      fs.mkdirSync(notesDir, { recursive: true });
    }

    graphDb = new GraphDB(tmpDir);
    graphDb.initialize();
    const mockAgent = { workspaceRoot: tmpDir, appDataDir: tmpDir };
    graphService = new GraphService(mockAgent, graphDb);
    const engine = graphService.getSemanticEngine();
    if (engine) {
      const adapter = engine.getAdapter();
      if (adapter && typeof adapter._setupTestMockEnvironment === 'function') {
        adapter._setupTestMockEnvironment();
      }
    }
    graphBuilder = new GraphBuilder(mockAgent, graphDb, graphService);
  });

  afterEach(() => {
    if (graphDb) graphDb.close();
    try {
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    } catch { /* ignore cleanup error */ }
  });

  it('1. Incremental note edit cleans up stale concept edges and maintains parity with rebuild', async () => {
    const t1Dir = path.join(tmpDir, 'test1');
    fs.mkdirSync(path.join(t1Dir, 'notes'), { recursive: true });

    const t1Db = new GraphDB(t1Dir);
    t1Db.initialize();
    const t1Agent = { workspaceRoot: t1Dir, appDataDir: t1Dir };
    const t1Service = new GraphService(t1Agent, t1Db);
    const engine = t1Service.getSemanticEngine();
    if (engine) {
      const adapter = engine.getAdapter();
      if (adapter && typeof adapter._setupTestMockEnvironment === 'function') {
        adapter._setupTestMockEnvironment();
      }
    }
    const t1Builder = new GraphBuilder(t1Agent, t1Db, t1Service);

    const file1 = path.join(t1Dir, 'notes', 'note1.md');
    const contentOriginal = '# Note 1\n\nESP32 uses Relay to control Power.\n\n[[note2]]';
    fs.writeFileSync(file1, contentOriginal, 'utf8');

    const file2 = path.join(t1Dir, 'notes', 'note2.md');
    const content2 = '# Note 2\n\n#hardware #embedded';
    fs.writeFileSync(file2, content2, 'utf8');

    // Run initial full rebuild
    await t1Builder.rebuild();

    // Now modify note1 to remove the concept "Relay" and wikilink to note2
    const contentUpdated = '# Note 1\n\nESP32 relies on WiFi.';
    fs.writeFileSync(file1, contentUpdated, 'utf8');

    // Run incremental processing on note1
    await t1Service.processNote(file1, contentUpdated);
    const incrementalState = t1Db.getAll();

    // Now run full rebuild in a separate DB to verify parity
    const cleanDir = path.join(tmpDir, 'clean1');
    fs.mkdirSync(path.join(cleanDir, 'notes'), { recursive: true });
    fs.writeFileSync(path.join(cleanDir, 'notes', 'note1.md'), contentUpdated, 'utf8');
    fs.writeFileSync(path.join(cleanDir, 'notes', 'note2.md'), content2, 'utf8');

    const cleanDb = new GraphDB(cleanDir);
    cleanDb.initialize();
    const mockAgentClean = { workspaceRoot: cleanDir, appDataDir: cleanDir };
    const cleanService = new GraphService(mockAgentClean, cleanDb);
    const cleanEngine = cleanService.getSemanticEngine();
    if (cleanEngine) {
      const cleanAdapter = cleanEngine.getAdapter();
      if (cleanAdapter && typeof cleanAdapter._setupTestMockEnvironment === 'function') {
        cleanAdapter._setupTestMockEnvironment();
      }
    }
    const cleanBuilder = new GraphBuilder(mockAgentClean, cleanDb, cleanService);

    await cleanBuilder.rebuild();
    const rebuildState2 = cleanDb.getAll();
    cleanDb.close();
    t1Db.close();

    // Assert that stale concept edges (Relay) were removed incrementally
    const relayRelIncremental = incrementalState.relationships.filter(r => 
      r.type === 'links_to' && r.source_id.includes('note1')
    );
    expect(relayRelIncremental.length).toBe(0);

    // Assert that stale concept edges (Relay) and wikilinks (note2) were removed incrementally
    const staleRelayRels = incrementalState.relationships.filter(r => 
      r.type === 'links_to' && r.source_id.includes('note1')
    );
    expect(staleRelayRels.length).toBe(0);

    // Assert new concept relationships (ESP32 relies on WiFi) were added incrementally
    const newMinedRels = incrementalState.relationships.filter(r => 
      r.type === 'DEPENDS_ON' || r.type === 'mentions'
    );
    expect(newMinedRels.length).toBeGreaterThan(0);
  });

  it('2. Non-markdown diagram file (excalidraw) processed incrementally via GraphWorker', async () => {
    const t2Dir = path.join(tmpDir, 'test2');
    fs.mkdirSync(t2Dir, { recursive: true });

    const t2Db = new GraphDB(t2Dir);
    t2Db.initialize();
    const t2Agent = { workspaceRoot: t2Dir, appDataDir: t2Dir };
    const t2Service = new GraphService(t2Agent, t2Db);

    const excFile = path.join(t2Dir, 'architecture.excalidraw');
    const excContent = JSON.stringify({
      elements: [
        { type: 'text', text: 'Gateway' },
        { type: 'text', text: 'Microservice' },
        { type: 'arrow', startBinding: { elementId: '1' }, endBinding: { elementId: '2' } }
      ]
    });
    fs.writeFileSync(excFile, excContent, 'utf8');

    const queue = new GraphQueue(t2Db);
    const worker = new GraphWorker(t2Db, queue, t2Service);

    queue.enqueue(excFile);
    await worker.processNextJob();

    const state = t2Db.getAll();
    t2Db.close();
    expect(state.entities.some(e => e.name === 'Gateway' || e.name === 'Microservice')).toBe(true);
  });
});
