import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import GraphDB from '../ai/graph/GraphDB';
import GraphLayoutEngine from '../ai/graph/layout/GraphLayoutEngine';

describe('GraphLayoutEngine & SQLite Layout Cache Test Suite', () => {
  let tmpDir;
  let graphDb;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notely-graph-layout-test-'));
    graphDb = new GraphDB(tmpDir);
    graphDb.initialize();
  });

  afterEach(() => {
    if (graphDb && graphDb.close) {
      graphDb.close();
    }
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('1. GraphLayoutEngine accurately computes coordinates and node degrees', () => {
    const entities = [
      { id: 'ent-1', name: 'Node 1', type: 'Concept' },
      { id: 'ent-2', name: 'Node 2', type: 'Technology' },
      { id: 'ent-3', name: 'Node 3', type: 'Note' }
    ];

    const relationships = [
      { source_id: 'ent-1', target_id: 'ent-2', type: 'uses' },
      { source_id: 'ent-1', target_id: 'ent-3', type: 'references' }
    ];

    const result = GraphLayoutEngine.computeLayout(entities, relationships, {
      width: 1000,
      height: 800,
      ticks: 50
    });

    expect(result.nodes).toHaveLength(3);
    expect(result.positions.size).toBe(3);

    const pos1 = result.positions.get('ent-1');
    const pos2 = result.positions.get('ent-2');
    const pos3 = result.positions.get('ent-3');

    expect(pos1.degree).toBe(2);
    expect(pos2.degree).toBe(1);
    expect(pos3.degree).toBe(1);

    expect(typeof pos1.x).toBe('number');
    expect(typeof pos1.y).toBe('number');
    expect(isNaN(pos1.x)).toBe(false);
    expect(isNaN(pos1.y)).toBe(false);
  });

  it('2. GraphDB persists and retrieves cached layout coordinates and degrees', () => {
    graphDb.upsertEntity({ id: 'ent-a', name: 'Alpha', type: 'Project' });
    graphDb.upsertEntity({ id: 'ent-b', name: 'Beta', type: 'Person' });
    graphDb.upsertRelationship({ source_id: 'ent-a', target_id: 'ent-b', type: 'managed_by' });

    // Initial state before layout computation
    const initial = graphDb.getAll();
    expect(initial.entities).toHaveLength(2);

    // Run layout computation and cache to SQLite
    const layout = graphDb.recomputeLayout({ ticks: 40 });
    expect(layout.nodes).toHaveLength(2);

    // Fetch again and verify cached coordinates exist
    const cached = graphDb.getAll();
    const entA = cached.entities.find(e => e.id === 'ent-a');
    const entB = cached.entities.find(e => e.id === 'ent-b');

    expect(typeof entA.pos_x).toBe('number');
    expect(typeof entA.pos_y).toBe('number');
    expect(entA.degree).toBe(1);
    expect(entB.degree).toBe(1);
  });
});
