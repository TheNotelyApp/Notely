import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import GraphDB from '../ai/graph/GraphDB';
import GraphService from '../ai/graph/GraphService';
import GraphBuilder from '../ai/graph/GraphBuilder';

describe('Golden Validation Workspace End-to-End Test Suite', () => {
  const goldenWorkspace = path.join(__dirname, 'golden_workspace');
  let graphDb;
  let graphService;
  let graphBuilder;

  beforeEach(() => {
    graphDb = new GraphDB(goldenWorkspace);
    graphDb.initialize();
    const mockAgent = { workspaceRoot: goldenWorkspace, appDataDir: goldenWorkspace };
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
  });

  it('1. Rebuild graph over golden workspace and verify baseline invariants', async () => {
    const result = await graphBuilder.rebuild();
    expect(result.success).toBe(true);

    const json = graphDb.exportAsJSON();
    expect(json.statistics.entityCount).toBeGreaterThan(5);
    expect(json.statistics.relationshipCount).toBeGreaterThan(3);

    // 2. Evidence coverage ratio verification (P1 & P2 verification)
    expect(json.statistics.evidenceCoverageRatio).toBeGreaterThan(0.50);

    // 3. Pre-persistence guards verification (P8 verification)
    expect(json.validation.selfLoops).toBe(0);

    // 4. Build report telemetry (P9 & P12 verification)
    const report = graphBuilder.getPipelineReport();
    expect(report).toBeDefined();
    expect(report.totalDurationMs).toBeGreaterThanOrEqual(0);

    // 5. Export as Markdown verification
    const md = graphDb.exportAsMarkdown();
    expect(md).toContain('# Knowledge Graph Export');
    expect(md).toContain('## Statistics');
  }, 30000);

  it('2. Incremental save stale outgoing edge cleanup (P14 verification)', async () => {
    const testFile = path.join(goldenWorkspace, 'notes', '01-wikilinks.md');
    const originalContent = fs.readFileSync(testFile, 'utf8');
    const noteName = path.basename(testFile, '.md');
    const rootId = graphService.entityResolver.generateEntityId(noteName, 'Note');

    // Run initial note ingestion
    await graphService.processNote(testFile, originalContent);
    let allRels = graphDb.getAll().relationships;
    const initialEdgeCount = allRels.filter(r => r.source_id === rootId && r.type === 'links_to').length;
    expect(initialEdgeCount).toBe(3);

    // Edit note content to remove all wikilinks
    const updatedContent = '# Wikilinks Test\n\nNo links here anymore.';
    await graphService.processNote(testFile, updatedContent);

    // Verify old outgoing wikilink edges were deleted
    allRels = graphDb.getAll().relationships;
    const updatedEdgeCount = allRels.filter(r => r.source_id === rootId && r.type === 'links_to').length;
    expect(updatedEdgeCount).toBe(0);

    // Restore original file
    fs.writeFileSync(testFile, originalContent, 'utf8');
  });
});
