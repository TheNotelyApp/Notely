import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import GraphDB from '../ai/graph/GraphDB';
import GraphService from '../ai/graph/GraphService';
import EntityResolver from '../ai/graph/EntityResolver';
import DeterministicSemanticMiner from '../ai/graph/DeterministicSemanticMiner';
import MarkdownASTParser from '../ai/graph/MarkdownASTParser';
import EvidenceFusionEngine from '../ai/graph/EvidenceFusionEngine';
import CommunityDetector from '../ai/graph/CommunityDetector';

describe('8-Stage Knowledge Graph Production Pipeline Test Suite', () => {
  const tempDir = path.join(__dirname, '../scratch/temp-eight-stage-pipeline-test');
  let graphDb;
  let graphService;
  let entityResolver;

  beforeEach(() => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    graphDb = new GraphDB(tempDir);
    graphDb.initialize();

    entityResolver = new EntityResolver(graphDb);
    graphService = new GraphService({
      workspacePath: tempDir,
      graphDb: graphDb
    });
  });

  afterEach(() => {
    if (graphDb) {
      graphDb.close();
    }
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch { /* ignore clean error */ }
  });

  it('Stage 1: AST Structural Markdown Parsing & Attribute Cleansing', () => {
    const parser = new MarkdownASTParser();
    const rawMarkdown = `
# System Architecture

Notely uses SQLite database for graph storage.
![Diagram](.assets/diag.png){data-diagram-id="4e711903" data-diagram-type="excalidraw"}

| Column 1 | Column 2 |
| Value 1  | Value 2  |
`;

    const ast = parser.parse('/docs/arch.md', rawMarkdown);
    expect(ast.sections).toHaveLength(1);
    expect(ast.media).toHaveLength(1);

    const cleansed = parser.cleanse(rawMarkdown);
    expect(cleansed).not.toContain('data-diagram-id');
    expect(cleansed).not.toContain('Column 1');
    expect(cleansed).toContain('Notely uses SQLite database for graph storage.');
  });

  it('Stage 2 & 5: Universal Quality Gate and Noise Filtering', () => {
    const BANNED_NOISE = [
      'Teh', 'Again', 'for', 'in', 'ave a', '.ot', 'dddde', 'a test',
      'This tool will help', 'AI Integration and', 'data-diagram-type="excalidraw"',
      'Column 1', 'Value 1.1', 'Weh'
    ];

    for (const noise of BANNED_NOISE) {
      expect(entityResolver.isValidEntityName(noise), `Term "${noise}" must fail quality gate`).toBe(false);
    }
  });

  it('Stage 3: Deterministic Domain Pattern Relationship Mining', () => {
    const miner = new DeterministicSemanticMiner();
    const text = 'Notely uses SQLite database for persistent graph storage. ESP32 controls Relay module.';

    const mined = miner.mine(text);
    expect(mined.length).toBeGreaterThan(0);
    expect(mined.some(r => r.sourceText === 'Notely' && r.type === 'USES' && r.targetText === 'SQLite')).toBe(true);
  });

  it('Stage 6: Algorithmic Entity Type Coercion', () => {
    // Title-Cased multi-word name -> Person
    expect(entityResolver.sanitizeEntityType('Bikash Panda', 'Organization')).toBe('Person');
    expect(entityResolver.sanitizeEntityType('Abhiram Panda', 'Organization')).toBe('Person');

    // Title-Cased single name -> Person
    expect(entityResolver.sanitizeEntityType('Abhiram', 'Organization')).toBe('Person');

    // Structural media term -> Concept
    expect(entityResolver.sanitizeEntityType('Screenshot', 'Event')).toBe('Concept');

    // Action verb -> Rejected (null)
    expect(entityResolver.sanitizeEntityType('Create', 'Person')).toBe(null);
  });

  it('Stage 7: Vector Persistence & Cosine Similarity Deduplication', () => {
    const v1 = [1.0, 0.0, 0.0, 0.0];
    const v2 = [0.99, 0.01, 0.0, 0.0];
    const v3 = [0.0, 1.0, 0.0, 0.0];

    const simHigh = entityResolver._cosineSimilarity(v1, v2);
    const simLow = entityResolver._cosineSimilarity(v1, v3);

    expect(simHigh).toBeGreaterThan(0.95);
    expect(simLow).toBe(0.0);

    // Vector DB Persistence
    graphDb.upsertEntity({ id: 'ent-sqlite', name: 'SQLite', canonical_name: 'SQLite', type: 'Concept' });
    graphDb.upsertEntityVector('ent-sqlite', [0.1, 0.2, 0.3, 0.4]);

    const vectors = graphDb.getAllEntityVectors();
    expect(vectors).toHaveLength(1);
    expect(vectors[0].entityId).toBe('ent-sqlite');
    expect(vectors[0].vector[0]).toBeCloseTo(0.1, 4);
  });

  it('Stage 8: Evidence Fusion, Plausibility & Community Detection', () => {
    graphDb.upsertEntity({ id: 'ent-a', name: 'Node A', canonical_name: 'Node A', type: 'Concept' });
    graphDb.upsertEntity({ id: 'ent-b', name: 'Node B', canonical_name: 'Node B', type: 'Concept' });

    const fusion = new EvidenceFusionEngine(graphDb, graphService.evidenceStore);
    fusion.fuseTriple({ source_id: 'ent-a', target_id: 'ent-b', type: 'USES', confidence: 0.90 });

    // Verify inverse circular relation is blocked
    const blockedInverse = fusion.fuseTriple({ source_id: 'ent-b', target_id: 'ent-a', type: 'USES', confidence: 0.90 });
    expect(blockedInverse).toBe(null);

    // Community Detection
    const detector = new CommunityDetector();
    const result = detector.detect(graphDb);
    expect(result.communityCount).toBeGreaterThanOrEqual(1);
  });

  it('End-to-End Pipeline: Ingest multi-note workspace cleanly across all 8 stages', async () => {
    const note1 = path.join(tempDir, 'note1.md');
    const content1 = '# Tech Notes\nNotely uses SQLite database. Excalidraw diagrams enable visual editing.';
    fs.writeFileSync(note1, content1, 'utf8');

    await graphService.processNote(note1, content1);

    const exportData = graphDb.exportAsJSON();
    expect(exportData.entities.length).toBeGreaterThan(0);
    expect(exportData.validation.orphans).toBe(0);
    expect(exportData.validation.selfLoops).toBe(0);
    expect(exportData.validation.duplicateEdges).toBe(0);
    expect(exportData.validation.evidenceCoverageRatio).toBe(1.0);
  });
});
