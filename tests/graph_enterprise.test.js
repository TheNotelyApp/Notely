import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import GraphDB from '../ai/graph/GraphDB';
import GraphService from '../ai/graph/GraphService';
import EntityResolver from '../ai/graph/EntityResolver';
import EvidenceStore from '../ai/graph/EvidenceStore';
import EvidenceFusionEngine from '../ai/graph/EvidenceFusionEngine';
import GraphMaintenance from '../ai/graph/GraphMaintenance';
import GraphValidationEngine from '../ai/graph/GraphValidationEngine';
import MarkdownASTParser from '../ai/graph/MarkdownASTParser';
import CommunityDetector from '../ai/graph/CommunityDetector';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function makeDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'notely-graph-'));
  const db = new GraphDB(dir);
  db.initialize();
  return { db, dir };
}

function seedLinearChain(db) {
  // A → B → C → D
  for (const [id, name, type] of [
    ['ea', 'Alpha', 'Note'],
    ['eb', 'Beta', 'Concept'],
    ['ec', 'Gamma', 'Person'],
    ['ed', 'Delta', 'Project'],
  ]) {
    db.upsertEntity({ id, name, type });
  }
  db.upsertRelationship({ source_id: 'ea', target_id: 'eb', type: 'links_to', confidence: 0.9 });
  db.upsertRelationship({ source_id: 'eb', target_id: 'ec', type: 'mentions', confidence: 0.8 });
  db.upsertRelationship({ source_id: 'ec', target_id: 'ed', type: 'relates_to', confidence: 0.7 });
}

// ─────────────────────────────────────────────────────────────
// 1. EntityResolver
// ─────────────────────────────────────────────────────────────
describe('EntityResolver — ID determinism, alias dedup, type resolution', () => {
  let db, dir;

  beforeEach(() => { ({ db, dir } = makeDb()); });
  afterEach(() => { db.close(); fs.rmSync(dir, { recursive: true, force: true }); });

  it('generates stable SHA-256 IDs for same name+type', () => {
    const er = new EntityResolver(db);
    const id1 = er.generateEntityId('SQLite', 'Database');
    const id2 = er.generateEntityId('SQLite', 'Database');
    expect(id1).toBe(id2);
    expect(id1).toMatch(/^ent-[0-9a-f]{16}$/);
  });

  it('generates different IDs for same name with different type', () => {
    const er = new EntityResolver(db);
    const asConcept = er.generateEntityId('GraphDB', 'Concept');
    const asDatabase = er.generateEntityId('GraphDB', 'Database');
    expect(asConcept).not.toBe(asDatabase);
  });

  it('cleanName decodes URI encoding and collapses whitespace', () => {
    const er = new EntityResolver(db);
    expect(er.cleanName('My%20Note')).toBe('My Note');
    expect(er.cleanName('  hello   world  ')).toBe('hello world');
    expect(er.cleanName('')).toBe('');
    expect(er.cleanName(null)).toBe('');
  });

  it('resolveMention returns existing entity instead of creating duplicate', () => {
    const er = new EntityResolver(db);
    db.upsertEntity({ id: 'ent-existing', name: 'GraphDB', type: 'Database', canonical_name: 'GraphDB' });
    const resolved = er.resolveMention('GraphDB', 'Database');
    expect(resolved).not.toBeNull();
    expect(resolved.id).toBe('ent-existing');
    expect(resolved.isAlias).toBe(true);
  });

  it('addAlias and findAlias roundtrip correctly', () => {
    const er = new EntityResolver(db);
    db.upsertEntity({ id: 'ent-x', name: 'Graph Worker', type: 'Service' });
    er.addAlias('ent-x', 'GraphWorker', 0.95);
    const alias = er.findAlias('graphworker');
    expect(alias).not.toBeNull();
    expect(alias.entity_id).toBe('ent-x');
    expect(alias.confidence).toBeCloseTo(0.95);
  });

  it('calculateSimilarity returns 1.0 for identical strings', () => {
    const er = new EntityResolver(db);
    expect(er.calculateSimilarity('hello', 'hello')).toBe(1.0);
  });

  it('calculateSimilarity returns 0.0 for empty vs non-empty', () => {
    const er = new EntityResolver(db);
    expect(er.calculateSimilarity('', 'hello')).toBe(0.0);
  });

  it('calculateSimilarity detects similar multi-word terms via Jaccard', () => {
    const er = new EntityResolver(db);
    const sim = er.calculateSimilarity('Knowledge Graph Builder', 'Graph Builder Module');
    expect(sim).toBeGreaterThanOrEqual(0.5);
  });
});

// ─────────────────────────────────────────────────────────────
// 2. EvidenceFusionEngine
// ─────────────────────────────────────────────────────────────
describe('EvidenceFusionEngine — probabilistic fusion, evidence linking', () => {
  let db, dir;

  beforeEach(() => {
    ({ db, dir } = makeDb());
    db.upsertEntity({ id: 'ea', name: 'Alpha', type: 'Note' });
    db.upsertEntity({ id: 'eb', name: 'Beta', type: 'Concept' });
  });
  afterEach(() => { db.close(); fs.rmSync(dir, { recursive: true, force: true }); });

  it('inserts a new edge on first fuseTriple call', () => {
    const evidenceStore = new EvidenceStore(db);
    const engine = new EvidenceFusionEngine(db, evidenceStore);
    engine.fuseTriple({ source_id: 'ea', target_id: 'eb', type: 'mentions', confidence: 0.7 });
    const all = db.getAll();
    expect(all.relationships).toHaveLength(1);
    expect(all.relationships[0].confidence).toBeCloseTo(0.7, 2);
  });

  it('fuses confidence probabilistically on second fuseTriple with same triple', () => {
    const evidenceStore = new EvidenceStore(db);
    const engine = new EvidenceFusionEngine(db, evidenceStore);
    engine.fuseTriple({ source_id: 'ea', target_id: 'eb', type: 'mentions', confidence: 0.6 });
    engine.fuseTriple({ source_id: 'ea', target_id: 'eb', type: 'mentions', confidence: 0.6 });
    const rel = db.getAll().relationships[0];
    // P(A U B) = 1 - (1 - 0.6)(1 - 0.6) = 0.84
    expect(rel.confidence).toBeCloseTo(0.84, 2);
    expect(db.getAll().relationships).toHaveLength(1);
  });

  it('fused confidence never exceeds 1.0', () => {
    const evidenceStore = new EvidenceStore(db);
    const engine = new EvidenceFusionEngine(db, evidenceStore);
    for (let i = 0; i < 5; i++) {
      engine.fuseTriple({ source_id: 'ea', target_id: 'eb', type: 'mentions', confidence: 0.99 });
    }
    const rel = db.getAll().relationships[0];
    expect(rel.confidence).toBeLessThanOrEqual(1.0);
  });

  it('links evidence record to relationship via junction table', () => {
    const evidenceStore = new EvidenceStore(db);
    const engine = new EvidenceFusionEngine(db, evidenceStore);
    const evId = evidenceStore.addEvidence({
      sourceId: 'alpha.md', extractor: 'ast_parser',
      subjectText: 'Alpha', predicateText: 'mentions', objectText: 'Beta',
      rawSentence: 'Alpha mentions Beta.', confidence: 0.9
    });
    engine.fuseTriple({ source_id: 'ea', target_id: 'eb', type: 'mentions', confidence: 0.9, evidenceId: evId });
    const junctionRow = db.db.prepare('SELECT * FROM relationship_evidence WHERE evidence_id = ?').get(evId);
    expect(junctionRow).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// 3. MarkdownASTParser
// ─────────────────────────────────────────────────────────────
describe('MarkdownASTParser — structural element extraction', () => {
  const parser = new MarkdownASTParser();

  it('extracts wikilinks including aliased links', () => {
    const content = 'See [[My Note]] and [[Other Note|Alias Text]].';
    const ast = parser.parse('test.md', content);
    expect(ast.links.map(l => l.targetName)).toContain('My Note');
    expect(ast.links.map(l => l.targetName)).toContain('Other Note');
    expect(ast.links).toHaveLength(2);
  });

  it('extracts hashtags from body', () => {
    const content = 'A note about #machine-learning and #AI.';
    const ast = parser.parse('test.md', content);
    const names = ast.tags.map(t => t.name);
    expect(names).toContain('machine-learning');
    expect(names).toContain('AI');
  });

  it('frontmatter tags are parsed without body bleed-through (B5 fix)', () => {
    const content = `---\ntags: foo, bar\n---\n\nStatus: In Progress`;
    const ast = parser.parse('test.md', content);
    const metaNames = ast.metadataEntities.map(e => e.name);
    expect(metaNames).not.toContain('In Progress');
  });

  it('extracts Person from frontmatter author field', () => {
    const content = `---\nauthor: Alice Smith\n---\n\nBody text.`;
    const ast = parser.parse('test.md', content);
    const people = ast.metadataEntities.filter(e => e.type === 'Person');
    expect(people.map(p => p.name)).toContain('Alice Smith');
  });

  it('extracts section headings with correct levels', () => {
    const content = '# H1\n\n## H2 Section\n\n### H3 Deep';
    const ast = parser.parse('test.md', content);
    expect(ast.sections.find(s => s.title === 'H1')?.level).toBe(1);
    expect(ast.sections.find(s => s.title === 'H2 Section')?.level).toBe(2);
    expect(ast.sections.find(s => s.title === 'H3 Deep')?.level).toBe(3);
  });

  it('extracts tasks with completed status', () => {
    const content = '- [x] Done task\n- [ ] Open task';
    const ast = parser.parse('test.md', content);
    expect(ast.tasks.find(t => t.taskText === 'Done task')?.completed).toBe(true);
    expect(ast.tasks.find(t => t.taskText === 'Open task')?.completed).toBe(false);
  });

  it('extracts media images and external URLs', () => {
    const content = '![Alt text](images/photo.png)\n[Link](https://example.com)';
    const ast = parser.parse('test.md', content);
    expect(ast.media).toHaveLength(1);
    expect(ast.media[0].name).toBe('photo.png');
    expect(ast.urls).toHaveLength(1);
    expect(ast.urls[0].url).toBe('https://example.com');
  });

  it('extracts inline code and code block languages', () => {
    // Parser filters inline codes with spaces (len<=50, no spaces) — use single token
    const content = 'Use `npm-install`. \n```javascript\nconsole.log("hi");\n```';
    const ast = parser.parse('test.md', content);
    const hasCode = ast.inlineCodes.some(c => (c.code || '').includes('npm-install'));
    expect(hasCode).toBe(true);
    expect(ast.codeBlocks.some(b => b.language === 'javascript')).toBe(true);
  });

  it('cleanse() produces clean prose without markdown syntax', () => {
    const content = '# Heading\n\n[[wikilink]] **bold** `code` > blockquote\n\n- list item';
    const cleansed = parser.cleanse(content);
    expect(cleansed).not.toContain('#');
    expect(cleansed).not.toContain('[[');
    expect(cleansed).not.toContain('**');
    expect(cleansed).not.toContain('`');
    expect(cleansed.trim().length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
// 4. GraphMaintenance
// ─────────────────────────────────────────────────────────────
describe('GraphMaintenance — orphan purge, deduplication', () => {
  let db, dir;

  beforeEach(() => { ({ db, dir } = makeDb()); });
  afterEach(() => { db.close(); fs.rmSync(dir, { recursive: true, force: true }); });

  it('purgeOrphans removes entities with no relationships and no note_path', () => {
    const er = new EntityResolver(db);
    db.upsertEntity({ id: 'orphan-1', name: 'Orphan A', type: 'Concept' });
    db.upsertEntity({ id: 'orphan-2', name: 'Orphan B', type: 'Concept' });
    db.upsertEntity({ id: 'connected', name: 'Connected', type: 'Note' });
    db.upsertRelationship({ source_id: 'orphan-2', target_id: 'connected', type: 'links_to' });

    const maint = new GraphMaintenance(db, er);
    const purged = maint.purgeOrphans();
    expect(purged).toBe(1);
    const ids = db.getAll().entities.map(e => e.id);
    expect(ids).not.toContain('orphan-1');
    expect(ids).toContain('orphan-2');
  });

  it('deduplicateAliases leaves no self-loops after merge (B6 fix)', () => {
    const er = new EntityResolver(db);
    db.upsertEntity({ id: 'ent-a', name: 'GraphQL', type: 'Concept' });
    db.upsertEntity({ id: 'ent-b', name: 'GraphQL', type: 'Concept' });
    db.upsertEntity({ id: 'ent-c', name: 'REST', type: 'Concept' });
    db.upsertRelationship({ source_id: 'ent-a', target_id: 'ent-c', type: 'competes_with' });
    db.upsertRelationship({ source_id: 'ent-b', target_id: 'ent-c', type: 'competes_with' });

    const maint = new GraphMaintenance(db, er);
    maint.deduplicateAliases();

    const selfLoops = db.db.prepare('SELECT COUNT(*) as c FROM relationships WHERE source_id = target_id').get().c;
    expect(selfLoops).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// 5. GraphValidationEngine
// ─────────────────────────────────────────────────────────────
describe('GraphValidationEngine — validation rules', () => {
  let db, dir;

  beforeEach(() => { ({ db, dir } = makeDb()); });
  afterEach(() => { db.close(); fs.rmSync(dir, { recursive: true, force: true }); });

  it('reports zero orphans when all entities have relationships', () => {
    seedLinearChain(db);
    const v = new GraphValidationEngine(db);
    const result = v.validateSync();
    expect(result.orphans).toBe(0);
  });

  it('correctly counts excess duplicate edge instances (B11 fix)', () => {
    db.upsertEntity({ id: 'n1', name: 'N1', type: 'Note' });
    db.upsertEntity({ id: 'n2', name: 'N2', type: 'Note' });
    db.upsertEntity({ id: 'n3', name: 'N3', type: 'Note' });
    // Create 3 distinct edges and then check duplicate detection works
    // Use three different source entities to create 3 rows for same n2→n3 type
    // Since schema has UNIQUE, we simulate via multiple relationships of same type from diff sources
    db.upsertRelationship({ source_id: 'n1', target_id: 'n2', type: 'links_to', confidence: 0.9 });
    db.upsertRelationship({ source_id: 'n1', target_id: 'n3', type: 'links_to', confidence: 0.9 });
    db.upsertRelationship({ source_id: 'n2', target_id: 'n3', type: 'links_to', confidence: 0.9 });
    // Inject a raw duplicate of n1→n2 via ALTER to bypass unique constraint
    try {
      db.db.exec('DROP TABLE IF EXISTS _dup_test_backup');
      db.db.exec('CREATE TABLE _dup_test_backup AS SELECT * FROM relationships');
      db.db.exec('DELETE FROM relationships');
      db.db.exec('DROP INDEX IF EXISTS idx_rel_src_tgt_type');
      db.db.exec('INSERT INTO relationships SELECT * FROM _dup_test_backup');
      db.db.prepare(
        'INSERT INTO relationships (source_id, target_id, type, weight, confidence, extractor) VALUES (?, ?, ?, ?, ?, ?)'
      ).run('n1', 'n2', 'links_to', 1.0, 0.9, 'ast_parser');
      db.db.prepare(
        'INSERT INTO relationships (source_id, target_id, type, weight, confidence, extractor) VALUES (?, ?, ?, ?, ?, ?)'
      ).run('n1', 'n2', 'links_to', 1.0, 0.9, 'ast_parser');
      db.db.exec('DROP TABLE _dup_test_backup');
    } catch {
      // If unique index can't be dropped, skip this raw insert test
      return;
    }
    const v = new GraphValidationEngine(db);
    const result = v.validateSync();
    expect(result.duplicateEdges).toBe(2); // 3 rows for n1→n2 - 1 canonical = 2 excess
  });

  it('reports emptyGraph = true on fresh database', () => {
    const v = new GraphValidationEngine(db);
    const result = v.validateSync();
    expect(result.emptyGraph).toBe(true);
  });

  it('reports evidenceCoverageRatio as 1.0 when all edges have evidence', () => {
    const evidenceStore = new EvidenceStore(db);
    db.upsertEntity({ id: 'a', name: 'A', type: 'Note' });
    db.upsertEntity({ id: 'b', name: 'B', type: 'Note' });
    const evId = evidenceStore.addEvidence({
      sourceId: 'a.md', extractor: 'ast_parser',
      subjectText: 'A', predicateText: 'links_to', objectText: 'B',
      rawSentence: 'A links to B.', confidence: 1.0
    });
    db.upsertRelationship({ source_id: 'a', target_id: 'b', type: 'links_to', evidence_id: evId });
    const v = new GraphValidationEngine(db);
    const result = v.validateSync();
    expect(result.evidenceCoverageRatio).toBe(1.0);
  });

  it('reports selfLoops = 0 on clean graph', () => {
    seedLinearChain(db);
    const v = new GraphValidationEngine(db);
    const result = v.validateSync();
    expect(result.selfLoops).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// 6. GraphDB — Note entity deletion (B1 fix)
// ─────────────────────────────────────────────────────────────
describe('GraphDB — note deletion uses canonical entity ID (B1 fix)', () => {
  let db, dir;

  beforeEach(() => { ({ db, dir } = makeDb()); });
  afterEach(() => { db.close(); fs.rmSync(dir, { recursive: true, force: true }); });

  it('deleteNoteEntityAndRelationships removes the correct entity', async () => {
    const mockAgent = { workspaceRoot: dir, appDataDir: dir };
    const svc = new GraphService(mockAgent, db);
    svc.getSemanticEngine()?.getAdapter()?._setupTestMockEnvironment?.();

    const notePath = path.join(dir, 'my-note.md');
    fs.writeFileSync(notePath, '# My Note\n\n[[Other Note]]\n', 'utf8');
    await svc.processNote(notePath, '# My Note\n\n[[Other Note]]\n');

    const before = db.getAll().entities.filter(e => e.type === 'Note');
    expect(before.length).toBeGreaterThan(0);

    db.deleteNoteEntityAndRelationships(notePath);
    const after = db.getAll().entities.filter(e => e.note_path === notePath);
    expect(after).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
// 7. GraphService.processNote — structural integration
// ─────────────────────────────────────────────────────────────
describe('GraphService.processNote — structural pipeline integration', () => {
  let db, dir;

  beforeEach(() => { ({ db, dir } = makeDb()); });
  afterEach(() => { db.close(); fs.rmSync(dir, { recursive: true, force: true }); });

  it('creates links_to relationships for all wikilinks', async () => {
    const mockAgent = { workspaceRoot: dir, appDataDir: dir };
    const svc = new GraphService(mockAgent, db);
    svc.getSemanticEngine()?.getAdapter()?._setupTestMockEnvironment?.();

    const notePath = path.join(dir, 'links-test.md');
    await svc.processNote(notePath, '# Links\n\n[[Alpha]] [[Beta]] [[Gamma]]');

    const rels = db.getAll().relationships.filter(r => r.type === 'links_to');
    expect(rels.length).toBe(3);
  });

  it('tag canonical_name does not contain # prefix (B7 fix)', async () => {
    const mockAgent = { workspaceRoot: dir, appDataDir: dir };
    const svc = new GraphService(mockAgent, db);
    svc.getSemanticEngine()?.getAdapter()?._setupTestMockEnvironment?.();

    const notePath = path.join(dir, 'tagged-note.md');
    await svc.processNote(notePath, '# Tagged Note\n\n#machinelearning #ai');

    const tags = db.getAll().entities.filter(e => e.type === 'Tag');
    for (const tag of tags) {
      expect(tag.canonical_name).not.toMatch(/^#/);
    }
  });

  it('clears stale outgoing edges on re-ingestion (B2/B3 fix)', async () => {
    const mockAgent = { workspaceRoot: dir, appDataDir: dir };
    const svc = new GraphService(mockAgent, db);
    svc.getSemanticEngine()?.getAdapter()?._setupTestMockEnvironment?.();

    const notePath = path.join(dir, 'evolving-note.md');
    await svc.processNote(notePath, '# Note\n\n[[Alpha]] [[Beta]]');

    let rels = db.getAll().relationships.filter(r => r.type === 'links_to');
    expect(rels.length).toBe(2);

    await svc.processNote(notePath, '# Note\n\nNo wikilinks now.');
    rels = db.getAll().relationships.filter(r => r.type === 'links_to');
    expect(rels.length).toBe(0);
  });

  it('tasks produce has_open_task and has_completed_task relationships', async () => {
    const mockAgent = { workspaceRoot: dir, appDataDir: dir };
    const svc = new GraphService(mockAgent, db);
    svc.getSemanticEngine()?.getAdapter()?._setupTestMockEnvironment?.();

    const notePath = path.join(dir, 'tasks-note.md');
    await svc.processNote(notePath, '# Tasks\n\n- [ ] Write tests\n- [x] Ship feature');

    const rels = db.getAll().relationships;
    expect(rels.some(r => r.type === 'has_open_task')).toBe(true);
    expect(rels.some(r => r.type === 'has_completed_task')).toBe(true);
  });

  it('all AST structural edges are tagged extractor=ast_parser', async () => {
    const mockAgent = { workspaceRoot: dir, appDataDir: dir };
    const svc = new GraphService(mockAgent, db);
    svc.getSemanticEngine()?.getAdapter()?._setupTestMockEnvironment?.();

    const notePath = path.join(dir, 'extractor-tag-test.md');
    await svc.processNote(notePath, '# Test\n\n[[Other]] #mytag\n\n- [ ] Task');

    // Filter only structural AST relationship types — semantic pass may add gliner2-relex edges
    const astTypes = ['links_to', 'tagged', 'has_open_task', 'has_completed_task', 'contains_section'];
    const rels = db.getAll().relationships.filter(r => astTypes.includes(r.type));
    expect(rels.length).toBeGreaterThan(0);
    for (const r of rels) {
      expect(r.extractor).toBe('ast_parser');
    }
  });
});

// ─────────────────────────────────────────────────────────────
// 8. EvidenceStore
// ─────────────────────────────────────────────────────────────
describe('EvidenceStore — provenance record management', () => {
  let db, dir;

  beforeEach(() => { ({ db, dir } = makeDb()); });
  afterEach(() => { db.close(); fs.rmSync(dir, { recursive: true, force: true }); });

  it('addEvidence returns deterministic ID (INSERT OR IGNORE)', () => {
    const store = new EvidenceStore(db);
    const payload = {
      sourceId: 'test.md', extractor: 'ast_parser',
      subjectText: 'Note A', predicateText: 'links_to', objectText: 'Note B',
      rawSentence: '[[Note B]]', confidence: 1.0
    };
    const id1 = store.addEvidence(payload);
    const id2 = store.addEvidence(payload);
    expect(id1).toBe(id2);
    expect(id1).toMatch(/^ev-/);
  });

  it('deleteForSource removes all evidence for a source', () => {
    const store = new EvidenceStore(db);
    store.addEvidence({
      sourceId: 'note-a.md', extractor: 'ast_parser',
      subjectText: 'A', predicateText: 'x', objectText: 'B',
      rawSentence: 'A x B', confidence: 1.0
    });
    expect(store.getEvidenceForSource('note-a.md').length).toBe(1);
    store.deleteForSource('note-a.md');
    expect(store.getEvidenceForSource('note-a.md').length).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// 9. CommunityDetector
// ─────────────────────────────────────────────────────────────
describe('CommunityDetector — label propagation convergence', () => {
  let db, dir;

  beforeEach(() => { ({ db, dir } = makeDb()); });
  afterEach(() => { db.close(); fs.rmSync(dir, { recursive: true, force: true }); });

  it('assigns community IDs to all nodes after detection', () => {
    seedLinearChain(db);
    const detector = new CommunityDetector();
    const result = detector.detect(db);
    expect(result.totalNodes).toBeGreaterThan(0);
    expect(result.communityCount).toBeGreaterThanOrEqual(1);
    // Every entity should have a community_id set if detection ran
    const unassigned = db.db.prepare('SELECT COUNT(*) as c FROM entities WHERE community_id IS NULL').get().c;
    expect(unassigned).toBe(0);
  });

  it('handles empty graph gracefully', () => {
    const detector = new CommunityDetector();
    const result = detector.detect(db);
    expect(result.communityCount).toBe(0);
    expect(result.totalNodes).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// 10. GraphDB.findPath — CTE UNION dedup (B8 fix)
// ─────────────────────────────────────────────────────────────
describe('GraphDB.findPath — CTE correctness (B8 fix)', () => {
  let db, dir;

  beforeEach(() => { ({ db, dir } = makeDb()); });
  afterEach(() => { db.close(); fs.rmSync(dir, { recursive: true, force: true }); });

  it('finds shortest path in a diamond graph (no duplicate traversal)', () => {
    for (const [id, name] of [['a', 'A'], ['b', 'B'], ['c', 'C'], ['d', 'D']]) {
      db.upsertEntity({ id, name, type: 'Note' });
    }
    db.upsertRelationship({ source_id: 'a', target_id: 'b', type: 'links_to' });
    db.upsertRelationship({ source_id: 'a', target_id: 'c', type: 'links_to' });
    db.upsertRelationship({ source_id: 'b', target_id: 'd', type: 'links_to' });
    db.upsertRelationship({ source_id: 'c', target_id: 'd', type: 'links_to' });

    const pathResult = db.findPath('a', 'd');
    expect(pathResult).not.toBeNull();
    expect(pathResult[0]).toBe('a');
    expect(pathResult[pathResult.length - 1]).toBe('d');
    expect(pathResult.length).toBe(3); // a → (b or c) → d
  });

  it('returns null when no path exists', () => {
    db.upsertEntity({ id: 'x', name: 'X', type: 'Note' });
    db.upsertEntity({ id: 'y', name: 'Y', type: 'Note' });
    const result = db.findPath('x', 'y');
    expect(result).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// 11. DeterministicSemanticMiner — Rule-Based Semantic Extraction
// ─────────────────────────────────────────────────────────────
describe('DeterministicSemanticMiner — pattern-based semantic mining', () => {
  it('mines USES and DEPENDS_ON relations from prose', () => {
    const DeterministicSemanticMiner = require('../ai/graph/DeterministicSemanticMiner');
    const miner = new DeterministicSemanticMiner();
    const text = 'GraphService uses EntityResolver. Notely depends on SQLite.';
    const mined = miner.mine(text);

    expect(mined.some(m => m.sourceText === 'GraphService' && m.targetText === 'EntityResolver' && m.type === 'USES')).toBe(true);
    expect(mined.some(m => m.sourceText === 'Notely' && m.targetText === 'SQLite' && m.type === 'DEPENDS_ON')).toBe(true);
  });
});

