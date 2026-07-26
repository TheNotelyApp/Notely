const assert = require('assert');
const path = require('path');
const fs = require('fs');
const ContextOrchestrator = require('../../ai/planner/ContextOrchestrator');

describe('ContextOrchestrator Multi-Tool Planning & Context Aggregation Tests', () => {
  let mockAgent;

  beforeEach(() => {
    mockAgent = {
      workspaceBrain: {
        getWorkspaceFacts: async (query) => [
          { source: 'WorkspaceBrain', filePath: 'note1.md', content: 'Architecture discussion notes.', score: 0.9 }
        ]
      }
    };
  });

  it('should execute internal planning, parallel tool execution, and context consolidation', async () => {
    const orchestrator = new ContextOrchestrator(mockAgent);

    // Stub the planner to return a deterministic plan so this test is
    // independent of ApplicationToolRegistry (Electron process) availability.
    orchestrator.planner.createPlanAsync = async () => ({
      intent: 'explore_knowledge_graph',
      manifest: { requiresRetrieval: true, category: 'Graph Exploration', confidence: 0.88, capabilities: {} },
      plannerDecision: { intent: 'explore_knowledge_graph', confidence: 0.88, selectedStrategy: 'graph_search', rejectedStrategies: [] },
      steps: [{ toolName: 'reconstruct_timeline', args: { topic: 'architecture' } }]
    });

    const res = await orchestrator.orchestrate('What is our architecture timeline?', {}, { targetConfidence: 0.50 });

    // WorkspaceBrain & tool execution populates evidence
    assert.ok(res.evidence.length > 0, 'Retrieval must populate evidence');
    assert.ok(res.confidence > 0.50, `Expected confidence > 0.50, got ${res.confidence}`);
    assert.ok(res.aggregatedContext.includes('Evidence #1'));
  });

  it('should deduplicate overlapping evidence snippets across tools', () => {
    const orchestrator = new ContextOrchestrator(mockAgent);
    const duplicateItems = [
      { toolName: 'find_discussions', filePath: 'noteA.md', content: 'Database migration design.', score: 0.85 },
      { toolName: 'explore_topic_graph', filePath: 'noteA.md', content: 'Database migration design.', score: 0.80 },
      { toolName: 'reconstruct_timeline', filePath: 'noteB.md', content: 'Initial schema created in May.', score: 0.90 }
    ];

    const aggregated = orchestrator.aggregateContext(duplicateItems);
    assert.strictEqual(aggregated.items.length, 2); // 1 duplicate removed
    assert.strictEqual(aggregated.items[0].filePath, 'noteB.md'); // ranked by score
  });

  it('should calculate confidence based on volume, grounding, and relevance scores', () => {
    const orchestrator = new ContextOrchestrator(mockAgent);
    const items = [
      { toolName: 'find_architecture', filePath: 'spec.md', content: 'VitePress documentation setup', score: 0.85 }
    ];

    const aggregated = orchestrator.aggregateContext(items);
    assert.ok(aggregated.confidence >= 0.70);
  });
});
