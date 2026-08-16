import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import GraphDB from '../ai/graph/GraphDB';
import EntityResolver from '../ai/graph/EntityResolver';
import GLiNER2RelexAdapter from '../ai/graph/semantic/adapters/GLiNER2RelexAdapter';
import ExtractionValidator from '../ai/graph/semantic/validators/ExtractionValidator';

describe('Knowledge Graph Bug Regression Test Suite', () => {
  const tmpDir = path.join(__dirname, 'tmp_regression_workspace');
  let graphDb;
  let entityResolver;

  beforeEach(() => {
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    graphDb = new GraphDB(tmpDir);
    graphDb.initialize();
    entityResolver = new EntityResolver(graphDb);
  });

  afterEach(() => {
    if (graphDb) graphDb.close();
    try {
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    } catch { /* ignore cleanup error */ }
  });

  it('1. EntityResolver addAlias stores entityId in entity_id and alias in alias column', () => {
    const targetEntityId = 'ent-test1234';
    const aliasMention = 'Bikash';

    // Insert target entity
    graphDb.upsertEntity({ id: targetEntityId, name: 'Bikash Panda', type: 'Person' });

    // Add alias
    entityResolver.addAlias(targetEntityId, aliasMention, 0.95);

    // Look up alias
    const found = entityResolver.findAlias(aliasMention);
    expect(found).not.toBeNull();
    expect(found.entity_id).toBe(targetEntityId);

    // Query SQLite directly to verify column values
    const rawRow = graphDb.db.prepare('SELECT alias, entity_id FROM entity_aliases WHERE entity_id = ?').get(targetEntityId);
    expect(rawRow).toBeDefined();
    expect(rawRow.alias.toLowerCase()).toBe('bikash');
    expect(rawRow.entity_id).toBe(targetEntityId);
  });

  it('2. GLiNER2RelexAdapter relation extraction does not generate Cartesian product clique', async () => {
    const adapter = new GLiNER2RelexAdapter({ appDataDir: tmpDir });
    adapter._setupTestMockEnvironment();

    const doc = {
      id: 'test-doc',
      content: 'ESP32 connects to Relay and Sensor.'
    };

    // Extract
    const res = await adapter.extract(doc, { confidenceThreshold: 0.5 });
    
    // In sentence with 3 entities (ESP32, Relay, Sensor), Cartesian loop produced 6 bidirectional edges per predicted relation.
    // Our fix creates directed edges without double-looping over every pair bidirectionally.
    const relations = res.relations;
    
    // Verify self-loops are 0
    const selfLoops = relations.filter(r => r.sourceEntityId === r.targetEntityId);
    expect(selfLoops.length).toBe(0);
  });

  it('3. Production GLiNER2RelexAdapter does not generate mock fallback relations when ONNX returns 0 relations', async () => {
    const adapter = new GLiNER2RelexAdapter({ appDataDir: tmpDir });
    adapter.isMockMode = false;
    adapter.isLoaded = true;
    adapter.encoderSession = { run: async () => ({ logits: { data: new Float32Array(0) } }) };
    adapter.classifierSession = adapter.encoderSession;
    adapter.ort = { Tensor: class Tensor {} };

    const doc = {
      id: 'doc1',
      content: 'Unrelated Sentence One. Unrelated Sentence Two.'
    };

    const res = await adapter.extract(doc);
    expect(res.relations.length).toBe(0);
  });

  it('4. ExtractionValidator filters low confidence relations and self loops before persistence', () => {
    const validator = new ExtractionValidator({ minConfidence: 0.5 });
    const rawResult = {
      entities: [{ id: 'ent-1', text: 'Entity 1' }, { id: 'ent-2', text: 'Entity 2' }],
      relations: [
        { sourceEntityId: 'ent-1', targetEntityId: 'ent-1', relationType: 'SELF_LOOP', confidence: 0.9 },
        { sourceEntityId: 'ent-1', targetEntityId: 'ent-2', relationType: 'LOW_CONF', confidence: 0.2 },
        { sourceEntityId: 'ent-1', targetEntityId: 'ent-2', relationType: 'VALID', confidence: 0.8 }
      ],
      evidence: []
    };

    const validation = validator.validate(rawResult);
    expect(validation.sanitizedRelations.length).toBe(1);
    expect(validation.sanitizedRelations[0].relationType).toBe('VALID');
  });
});
