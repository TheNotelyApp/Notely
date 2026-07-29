/**
 * tests/ai/pipelinePlanningAndRetrieval.spec.js
 * Unit and integration tests for Planner Intent Resolution, Early Exit,
 * Evidence Thresholding, and Stage Confidence Synchronization.
 */

const IntentAnalyzer = require('../../ai/planner/IntentAnalyzer');
const ContextOrchestrator = require('../../ai/planner/ContextOrchestrator');

describe('Pipeline Planning & Retrieval Hardening Test Suite', () => {
  const intentAnalyzer = new IntentAnalyzer();
  const orchestrator = new ContextOrchestrator();

  // Test 1: Conversational Follow-Up Intent Resolution
  it('1. Detects conversational follow-up query and resolves to conversational_followup goal', () => {
    const context = { historyCount: 2, conversationMemory: [{ role: 'user', content: 'Summarize key tasks' }] };
    const result = intentAnalyzer.analyze('Which shall we take first', context);

    expect(result.goal).toBe('conversational_followup');
    expect(result.confidence).toBe(0.88);
    expect(result.informationNeeds).toContain('conversation_memory');
  });

  // Test 2: Early Exit Logic in ContextOrchestrator
  it('2. Triggers early exit in _deriveNextSteps when initial evidence is empty or low confidence (< 0.10)', () => {
    const emptySteps = orchestrator._deriveNextSteps('test query', []);
    expect(emptySteps).toHaveLength(0);

    const lowScoreEvidence = [
      { toolName: 'find_discussions', filePath: 'Workspace AI Chat', content: 'test', score: 0.024 }
    ];
    const lowScoreSteps = orchestrator._deriveNextSteps('test query', lowScoreEvidence);
    expect(lowScoreSteps).toHaveLength(0);
  });

  // Test 3: Topic Graph Exploration Requires Valid Evidence (score >= 0.10)
  it('3. Authorizes explore_topic_graph only when valid high-confidence evidence exists', () => {
    const validEvidence = [
      { toolName: 'search_notes', filePath: 'C:\\Notes\\ai.md', content: 'AI notes', score: 0.85 }
    ];
    const steps = orchestrator._deriveNextSteps('ai search', validEvidence);

    expect(steps).toHaveLength(1);
    expect(steps[0].toolName).toBe('explore_topic_graph');
    expect(steps[0].args.notePath).toBe('C:\\Notes\\ai.md');
  });

  // Test 4: Actionable Diagnostic Rejection Reporting
  it('4. Rejects items below relevance threshold and reports actionable diagnostic reason', () => {
    const items = [
      { toolName: 'find_discussions', content: 'Irrelevant snippet', score: 0.024 }
    ];

    const aggregated = orchestrator.aggregateContext(items, { minRelevance: 0.10 });

    expect(aggregated.items).toHaveLength(0);
    expect(aggregated.retrievalQuality).toHaveLength(1);
    expect(aggregated.retrievalQuality[0].accepted).toBe(false);
    expect(aggregated.retrievalQuality[0].rejectedReason).toBe('below relevance threshold');
  });

  // Test 5: Entity and Identity Queries Trigger NeedsGraph
  it('5. Triggers needsGraph for identity inquiries like "Who is Bikash Panda"', () => {
    const result = intentAnalyzer.analyze('Who is Bikash Panda', {});
    expect(result.capabilities.needsGraph).toBe(true);
    expect(result.informationNeeds).toContain('entity_relationships');
  });
});
