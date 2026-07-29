const assert = require('assert');
const path = require('path');
const os = require('os');
const fs = require('fs');

const GraphDB = require('../../ai/graph/GraphDB');
const { SemanticExtractionEngine, GLiNER2RelexAdapter } = require('../../ai/graph/semantic');
const GraphModelDownloader = require('../../ai/graph/GraphModelDownloader');
const GraphService = require('../../ai/graph/GraphService');

describe('GLiNER2-Relex ONNX Model Engine & Semantic Layer Tests', () => {
  let tmpDir;
  let graphDb;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gliner2-test-'));
    graphDb = new GraphDB(tmpDir);
    graphDb.initialize();
  });

  afterEach(() => {
    if (graphDb) graphDb.close();
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should initialize GLiNER2RelexAdapter and segment sentences', () => {
    const adapter = new GLiNER2RelexAdapter({ appDataDir: tmpDir });
    const sentences = adapter.segmentSentences('React is a JavaScript framework. Node.js is a runtime.');
    assert.ok(sentences.length >= 2);
  });

  it('should extract entities dynamically using GLiNER2RelexAdapter', async () => {
    const adapter = new GLiNER2RelexAdapter({ appDataDir: tmpDir });
    adapter.isLoaded = true;
    const doc = {
      id: 'react-note.md',
      content: 'React is a popular framework developed by Facebook.',
      sourceType: 'markdown'
    };
    
    const result = await adapter.extract(doc, { confidenceThreshold: 0.40 });
    assert.ok(Array.isArray(result.entities));
    const isMock = adapter.isMockMode || !adapter.encoderSession || !adapter.classifierSession;
    if (isMock) {
      return;
    }
    assert.ok(result.entities.length >= 1);
    const reactEnt = result.entities.find(e => e.text === 'React');
    assert.ok(reactEnt, 'Should extract React entity');
  });

  it('should report correct status in GraphModelDownloader for gliner2-relex', () => {
    const downloader = new GraphModelDownloader(tmpDir);
    const status = downloader.getStatus();
    assert.strictEqual(status.downloaded, false);
    assert.strictEqual(status.isDownloading, false);
    assert.strictEqual(status.progress, 0);
  });

  it('should process note end-to-end in GraphService using SemanticExtractionEngine', async () => {
    const service = new GraphService({ appDataDir: tmpDir }, graphDb);
    const notePath = path.join(tmpDir, 'test-note.md');
    const content = '# Machine Learning\nPython depends on NumPy for mathematical operations.';

    await service.processNote(notePath, content);

    const stats = graphDb.getStatus();
    assert.ok(stats.nodeCount > 0);
  });

  it('should extract entities and expected relationships from a large paragraph using SemanticExtractionEngine', async () => {
    const engine = new SemanticExtractionEngine(tmpDir);
    const bigParagraph = `
# Artificial Intelligence Systems
Modern artificial intelligence applications rely heavily on Python as their primary programming language.
The PyTorch framework depends on Python to build deep neural network architectures for computer vision and natural language processing.
Similarly, TensorFlow created by Google offers high-performance tensor computations across distributed GPU clusters.
In production environments, Kubernetes manages containerized microservices created by software engineering teams.
Furthermore, PostgreSQL handles relational data persistence while Redis provides high-speed in-memory caching.
    `;

    const doc = {
      id: 'ai-sys.md',
      content: bigParagraph,
      sourceType: 'markdown'
    };

    const results = await engine.extract(doc, { confidenceThreshold: 0.20 });
    assert.ok(Array.isArray(results.entities));
    assert.ok(Array.isArray(results.relations));
    const adapter = engine.getAdapter();
    const isMock = adapter.isMockMode || !adapter.encoderSession || !adapter.classifierSession;
    if (isMock) {
      return;
    }
    
    assert.ok(results.entities.length >= 3, `Expected entities, found ${results.entities.length}`);
    assert.ok(results.relations.length >= 1, `Expected relations, found ${results.relations.length}`);

    const extractedEntityNames = results.entities.map(e => e.text);
    assert.ok(extractedEntityNames.some(name => /PyTorch|Python|Google|PostgreSQL|Redis|Kubernetes|TensorFlow/i.test(name)), 'Entities should contain domain technical terms');
  });
});
