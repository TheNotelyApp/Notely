const assert = require('assert');
const path = require('path');
const os = require('os');
const fs = require('fs');

const GraphDB = require('../../ai/graph/GraphDB');
const GraphService = require('../../ai/graph/GraphService');
const { SemanticExtractionEngine } = require('../../ai/graph/semantic');

describe('GLiNER2-Relex ONNX Benchmark Performance Tests', () => {
  let tmpDir;
  let graphDb;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gliner-benchmark-'));
    graphDb = new GraphDB(tmpDir);
    graphDb.initialize();
  });

  afterEach(() => {
    if (graphDb) graphDb.close();
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should benchmark SemanticExtractionEngine initialization latency', async () => {
    const start = performance.now();
    const engine = new SemanticExtractionEngine(tmpDir);
    await engine.load();
    const durationMs = performance.now() - start;

    console.log(`[Benchmark] SemanticExtractionEngine initialization took ${durationMs.toFixed(2)} ms`);
    assert.ok(durationMs >= 0);
  }, 120000);

  it('should benchmark note extraction latency and memory delta', async () => {
    const service = new GraphService({ appDataDir: tmpDir }, graphDb);
    const notePath = path.join(tmpDir, 'benchmark-note.md');
    
    const content = `
# Quantum Computing Overview
Quantum computing relies on qubits to perform parallel calculations.
Superconducting circuits and trapped ions are primary hardware methodologies.
Shor's Algorithm offers exponential speedup for integer factorization.
Qiskit and Cirq are open-source software SDKs written in Python.
IBM, Google, and Rigetti are leading organizations building quantum systems.
    `.repeat(2);

    const memBefore = process.memoryUsage().heapUsed;
    const start = performance.now();

    await service.processNote(notePath, content);

    const durationMs = performance.now() - start;
    const memAfter = process.memoryUsage().heapUsed;
    const memDeltaMB = (memAfter - memBefore) / (1024 * 1024);

    console.log(`[Benchmark] Note extraction took ${durationMs.toFixed(2)} ms | Heap Delta: ${memDeltaMB.toFixed(2)} MB`);
    assert.ok(durationMs < 120000, `Extraction exceeded threshold: ${durationMs}ms`);
  }, 120000);

  it('should benchmark note batch throughput per minute', async () => {
    const service = new GraphService({ appDataDir: tmpDir }, graphDb);
    const notesCount = 2;
    const start = performance.now();

    for (let i = 0; i < notesCount; i++) {
      await new Promise((r) => setImmediate(r));
      const notePath = path.join(tmpDir, `note-${i}.md`);
      const content = `# Note ${i}\nEntityAlpha links to [[EntityBeta-${i}]] and relies on Python.`;
      await service.processNote(notePath, content);
    }

    const durationSec = (performance.now() - start) / 1000;
    const notesPerMin = Math.round((notesCount / durationSec) * 60);

    console.log(`[Benchmark] Processed ${notesCount} notes in ${durationSec.toFixed(2)} s (${notesPerMin} notes/min)`);
    assert.ok(notesPerMin > 0);
  }, 120000);
});
