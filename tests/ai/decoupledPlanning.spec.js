const assert = require('assert');
const IntentAnalyzer = require('../../ai/core/IntentAnalyzer');
const CapabilityResolver = require('../../ai/core/CapabilityResolver');
const Planner = require('../../ai/core/Planner');
const ContextOrchestrator = require('../../ai/core/ContextOrchestrator');

describe('4-Layer Decoupled Hybrid Planning Architecture Tests', () => {
  it('Layer 1 (IntentAnalyzer) should deconstruct queries into IntentManifests', () => {
    const analyzer = new IntentAnalyzer();

    const manifest1 = analyzer.analyze('Find open action items and tasks assigned to me');
    assert.strictEqual(manifest1.goal, 'summarize_tasks_and_actions');
    assert.ok(manifest1.informationNeeds.includes('action_items'));
    assert.strictEqual(manifest1.requiresExternalData, false);

    const manifest2 = analyzer.analyze('Explore system architecture relationship graph for auth');
    assert.strictEqual(manifest2.goal, 'explore_knowledge_graph');
    assert.ok(manifest2.informationNeeds.includes('entity_relationships'));

    const manifest3 = analyzer.analyze('Search web for React 19 documentation https://react.dev');
    assert.strictEqual(manifest3.requiresExternalData, true);
    assert.ok(manifest3.informationNeeds.includes('external_web_content'));
  });

  it('Layer 2 (CapabilityResolver) should resolve info needs into abstract capabilities and bind tools', () => {
    const resolver = new CapabilityResolver();

    const capabilities = resolver.resolveCapabilities(['workspace_content_search', 'action_items', 'entity_relationships']);
    assert.strictEqual(capabilities.length, 3);
    assert.strictEqual(capabilities[0].capability, 'notes:search');
    assert.strictEqual(capabilities[1].capability, 'tasks:extract');
    assert.strictEqual(capabilities[2].capability, 'graph:traverse');
    assert.ok(capabilities[0].toolName);
  });

  it('Layer 3 (Planner) should consume IntentManifest and Resolved Capabilities to build Execution DAG', () => {
    const planner = new Planner({});

    const plan = planner.createPlan('Find open tasks and Explore graph of auth middleware');
    assert.ok(plan.intent);
    assert.ok(Array.isArray(plan.steps));
    assert.ok(plan.steps.length >= 2);
    assert.ok(plan.steps[0].capability);
    assert.ok(plan.steps[0].toolName);
  });

  it('Layer 4 (ContextOrchestrator) should orchestrate 4-layer execution lifecycle cleanly', async () => {
    const mockAgent = {
      workspaceBrain: {
        getWorkspaceFacts: async (q) => [{ topic: q, snippet: 'Evidence fact' }]
      }
    };
    const orchestrator = new ContextOrchestrator(mockAgent);

    const res = await orchestrator.orchestrate('Explore architecture of graph database');
    assert.ok(res);
    assert.ok(res.confidence > 0);
    assert.ok(Array.isArray(res.trace));
  });
});
