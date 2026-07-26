const IntentAnalyzer = require('../../ai/planner/IntentAnalyzer');
const Planner = require('../../ai/planner/Planner');
const ContextOrchestrator = require('../../ai/planner/ContextOrchestrator');

class MockAgent {
  constructor() {
    this.workspaceRoot = '/mock/workspace';
    this.contextOrchestrator = null;
  }
}

describe('AI Pipeline Telemetry & Intent Regression Tests', () => {
  let analyzer;
  let planner;
  let orchestrator;

  beforeEach(() => {
    const agent = new MockAgent();
    analyzer = new IntentAnalyzer();
    planner = new Planner(agent);
    orchestrator = new ContextOrchestrator(agent);
  });

  it('Test 1: Query "Summarize key tasks across my workspace" routes to workspace_task_summary without graph search', () => {
    const query = 'Summarize key tasks across my workspace';
    const manifest = analyzer.analyze(query);

    expect(manifest.goal).toBe('workspace_task_summary');
    expect(manifest.confidence).toBeGreaterThan(0.80);
    expect(manifest.category).toBe('Task Query');

    const plan = planner.createPlan(query);
    expect(plan.intent).toBe('workspace_task_summary');
    expect(plan.plannerDecision.intent).toBe('workspace_task_summary');
    expect(plan.plannerDecision.confidence).toBeGreaterThan(0.80);
    expect(plan.plannerDecision.rejectedStrategies).toContain('graph_search');

    const toolNames = plan.steps.map(s => s.toolName);
    expect(toolNames).toContain('get_tasks');
    expect(toolNames).not.toContain('explore_topic_graph');
  });

  it('Test 2: Query "What AI concepts are connected in my notes?" allows graph retrieval', () => {
    const query = 'What AI concepts are connected in my notes?';
    const manifest = analyzer.analyze(query);

    expect(manifest.capabilities.needsGraph).toBe(true);
    expect(manifest.informationNeeds).toContain('entity_relationships');

    const plan = planner.createPlan(query);
    const toolNames = plan.steps.map(s => s.toolName);
    expect(toolNames.some(t => t === 'get_graph' || t === 'explore_topic_graph')).toBe(true);
  });

  it('Test 3: Query "Find my pending TODO items" executes task parser', () => {
    const query = 'Find my pending TODO items';
    const manifest = analyzer.analyze(query);

    expect(manifest.goal).toBe('workspace_task_summary');
    expect(manifest.confidence).toBeGreaterThan(0.80);
    expect(manifest.subIntents).toContain('tasks:extract');

    const plan = planner.createPlan(query);
    expect(plan.steps.some(s => s.toolName === 'get_tasks')).toBe(true);
  });

  it('Test 4: Query "Explain my workspace AI architecture" enables semantic + graph retrieval', () => {
    const query = 'Explain my workspace AI architecture';
    const manifest = analyzer.analyze(query);

    expect(manifest.capabilities.needsGraph).toBe(true);

    const plan = planner.createPlan(query);
    const toolNames = plan.steps.map(s => s.toolName);
    expect(toolNames.some(t => t === 'get_graph' || t === 'explore_topic_graph')).toBe(true);
  });

  it('Relevance filtering: rejects evidence below 0.25 similarity threshold', () => {
    const evidence = [
      { toolName: 'test_rejected', content: 'Weak result', score: 0.02 },
      { toolName: 'test_accepted', content: 'Good result', score: 0.85 }
    ];

    const aggregated = orchestrator.aggregateContext(evidence);

    expect(aggregated.items).toHaveLength(1);
    expect(aggregated.items[0].content).toBe('Good result');
    expect(aggregated.retrievalQuality).toMatchObject([
      {
        source: 'test_rejected',
        sourceType: 'test_rejected',
        retrievalType: 'semantic',
        similarityScore: 0.02,
        score: 0.02,
        itemsReturned: 1,
        acceptedCount: 0,
        accepted: false,
        rejectedReason: 'below relevance threshold',
        reason: 'below relevance threshold'
      },
      {
        source: 'test_accepted',
        sourceType: 'test_accepted',
        retrievalType: 'semantic',
        similarityScore: 0.85,
        score: 0.85,
        itemsReturned: 1,
        acceptedCount: 1,
        accepted: true
      }
    ]);
  });
});
