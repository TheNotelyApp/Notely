import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import GraphDB from '../ai/graph/GraphDB';

describe('SQLite Knowledge Graph DB and CTE Traversals', () => {
  const tempWorkspace = path.join(__dirname, '../scratch/temp-graph-test-workspace');
  let graphDb;

  beforeEach(() => {
    // Ensure clean workspace directory
    try {
      if (fs.existsSync(tempWorkspace)) {
        fs.rmSync(tempWorkspace, { recursive: true, force: true });
      }
    } catch { /* ignore */ }
    fs.mkdirSync(tempWorkspace, { recursive: true });
    
    // Initialize GraphDB targeting the temp workspace
    graphDb = new GraphDB(tempWorkspace);
    graphDb.initialize();
  });

  afterEach(() => {
    // Close handle and clean files
    if (graphDb) {
      graphDb.close();
    }
    try {
      if (fs.existsSync(tempWorkspace)) {
        fs.rmSync(tempWorkspace, { recursive: true, force: true });
      }
    } catch (err) {
      console.warn('Cleanup warning:', err.message);
    }
  });

  it('should initialize tables correctly', () => {
    const status = graphDb.getStatus();
    expect(status.nodeCount).toBe(0);
    expect(status.edgeCount).toBe(0);
    expect(status.sizeBytes).toBeGreaterThan(0);
  });

  it('should upsert and retrieve entities', () => {
    // Upsert a Note node
    graphDb.upsertEntity({
      id: 'note-1',
      type: 'Note',
      name: 'Welcome to Notely',
      note_path: 'welcome.md',
      properties: { size: 100 }
    });

    // Upsert a Person node
    graphDb.upsertEntity({
      id: 'person-1',
      type: 'Person',
      name: 'Alice Smith',
      properties: { role: 'Lead Architect' }
    });

    const status = graphDb.getStatus();
    expect(status.nodeCount).toBe(2);

    const all = graphDb.getAll();
    expect(all.entities).toHaveLength(2);
    
    const noteNode = all.entities.find(e => e.id === 'note-1');
    expect(noteNode).toBeDefined();
    expect(noteNode.type).toBe('Note');
    expect(noteNode.name).toBe('Welcome to Notely');
    expect(noteNode.properties.size).toBe(100);

    const personNode = all.entities.find(e => e.id === 'person-1');
    expect(personNode.properties.role).toBe('Lead Architect');
  });

  it('should perform recursive CTE depth-3 neighbor lookups', () => {
    // Establish a chain: A -> B -> C -> D -> E
    graphDb.upsertEntity({ id: 'node-a', type: 'Note', name: 'Node A' });
    graphDb.upsertEntity({ id: 'node-b', type: 'Project', name: 'Node B' });
    graphDb.upsertEntity({ id: 'node-c', type: 'Person', name: 'Node C' });
    graphDb.upsertEntity({ id: 'node-d', type: 'Concept', name: 'Node D' });
    graphDb.upsertEntity({ id: 'node-e', type: 'Task', name: 'Node E' });

    graphDb.upsertRelationship({ source_id: 'node-a', target_id: 'node-b', type: 'REFERENCES' });
    graphDb.upsertRelationship({ source_id: 'node-b', target_id: 'node-c', type: 'USES' });
    graphDb.upsertRelationship({ source_id: 'node-c', target_id: 'node-d', type: 'MENTIONS' });
    graphDb.upsertRelationship({ source_id: 'node-d', target_id: 'node-e', type: 'DEPENDS_ON' });

    // Fetch neighbors of node-a up to depth 3
    const result = graphDb.getNeighbors('node-a', 3);

    // Expect node-a, node-b, node-c, and node-d to be fetched (depths 0, 1, 2, 3)
    // node-e is depth 4, so it should be excluded
    const nodeIds = result.nodes.map(n => n.id);
    expect(nodeIds).toContain('node-a');
    expect(nodeIds).toContain('node-b');
    expect(nodeIds).toContain('node-c');
    expect(nodeIds).toContain('node-d');
    expect(nodeIds).not.toContain('node-e');

    // Should contain relationships between the visible nodes
    expect(result.edges.length).toBe(3);
    const hasAB = result.edges.some(e => e.source_id === 'node-a' && e.target_id === 'node-b');
    expect(hasAB).toBe(true);
  });

  it('should find path between entities using CTE', () => {
    graphDb.upsertEntity({ id: 'node-a', type: 'Note', name: 'Node A' });
    graphDb.upsertEntity({ id: 'node-b', type: 'Project', name: 'Node B' });
    graphDb.upsertEntity({ id: 'node-c', type: 'Person', name: 'Node C' });

    graphDb.upsertRelationship({ source_id: 'node-a', target_id: 'node-b', type: 'REFERENCES' });
    graphDb.upsertRelationship({ source_id: 'node-b', target_id: 'node-c', type: 'USES' });

    const pathResult = graphDb.findPath('node-a', 'node-c');
    expect(pathResult).toEqual(['node-a', 'node-b', 'node-c']);

    // Non-existent path
    const noPath = graphDb.findPath('node-a', 'node-xyz');
    expect(noPath).toBeNull();
  });

  it('should traverse path for multi-word queries with separate token entities', () => {
    graphDb.upsertEntity({ id: 'ent-bikash', name: 'Bikash', type: 'Person' });
    graphDb.upsertEntity({ id: 'ent-panda', name: 'Panda', type: 'Person' });
    graphDb.upsertEntity({ id: 'note-search', name: 'ai-and-search.md', type: 'Document' });
    graphDb.upsertRelationship({ id: 'rel-1', source_id: 'ent-bikash', target_id: 'note-search', type: 'HAS_PERSON' });
    graphDb.upsertRelationship({ id: 'rel-2', source_id: 'ent-panda', target_id: 'note-search', type: 'HAS_PERSON' });

    const results = graphDb.traversePathOrId('Who is Bikash Panda', 2);
    expect(results).toHaveLength(2);
    expect(results.some(r => r.from_name === 'Bikash')).toBe(true);
    expect(results.some(r => r.from_name === 'Panda')).toBe(true);
  });

  it('should reject self-loops and clamp confidence (P8)', () => {
    graphDb.upsertEntity({ id: 'node-self', type: 'Note', name: 'Self Loop Test' });

    // Self-loop should be ignored
    graphDb.upsertRelationship({ source_id: 'node-self', target_id: 'node-self', type: 'SELF_LOOP', confidence: 1.0 });
    const status = graphDb.getStatus();
    expect(status.edgeCount).toBe(0);

    // Confidence out-of-bounds should be clamped
    graphDb.upsertEntity({ id: 'node-target', type: 'Note', name: 'Target Note' });
    graphDb.upsertRelationship({ source_id: 'node-self', target_id: 'node-target', type: 'LINKS_TO', confidence: 2.5 });
    const all = graphDb.getAll();
    expect(all.relationships[0].confidence).toBe(1.0);
  });

  it('should increment source_count on entity upsert conflict (P10)', () => {
    graphDb.upsertEntity({ id: 'node-count', type: 'Concept', name: 'Shared Concept' });
    let ent = graphDb.getAll().entities.find(e => e.id === 'node-count');
    expect(ent.source_count).toBe(1);

    // Second upsert should increment source_count
    graphDb.upsertEntity({ id: 'node-count', type: 'Concept', name: 'Shared Concept' });
    ent = graphDb.getAll().entities.find(e => e.id === 'node-count');
    expect(ent.source_count).toBe(2);
  });

  it('should export graph as JSON and Markdown (P12)', () => {
    graphDb.upsertEntity({ id: 'node-1', type: 'Note', name: 'Doc 1' });
    graphDb.upsertEntity({ id: 'node-2', type: 'Concept', name: 'AI Architecture' });
    graphDb.upsertRelationship({ source_id: 'node-1', target_id: 'node-2', type: 'DISCUSSES', confidence: 0.95 });

    const json = graphDb.exportAsJSON();
    expect(json.metadata.schemaVersion).toBe('1.0');
    expect(json.statistics.entityCount).toBe(2);
    expect(json.statistics.relationshipCount).toBe(1);
    expect(json.entities).toHaveLength(2);
    expect(json.relationships).toHaveLength(1);

    const md = graphDb.exportAsMarkdown();
    expect(md).toContain('# Knowledge Graph Export');
    expect(md).toContain('Doc 1');
    expect(md).toContain('AI Architecture');
    expect(md).toContain('DISCUSSES');
  });
});
