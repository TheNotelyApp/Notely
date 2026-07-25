const assert = require('assert');
const Planner = require('../../ai/planner/Planner');
const { semanticToolsCatalog, SemanticToolRunner } = require('../../ai/tools/SemanticTools');

describe('Planner & Semantic Tools Tests (Phase 2)', () => {
  it('Planner should classify intents and build multi-step execution plans', () => {
    const planner = new Planner({});

    const timelinePlan = planner.createPlan('Show me the timeline of recent changes');
    assert.strictEqual(timelinePlan.intent, 'reconstruct_project_timeline');
    assert.ok(timelinePlan.steps.length >= 1);
    assert.ok(timelinePlan.steps[0].toolName);

    const taskPlan = planner.createPlan('Find open tasks assigned to me');
    assert.strictEqual(taskPlan.intent, 'summarize_tasks_and_actions');
    assert.ok(taskPlan.steps[0].toolName);

    const topicPlan = planner.createPlan('Explore architecture of graph database');
    assert.strictEqual(topicPlan.intent, 'explore_knowledge_graph');
    assert.ok(topicPlan.steps[0].toolName);
  });

  it('SemanticToolRunner should execute semantic tools cleanly', async () => {
    assert.ok(Array.isArray(semanticToolsCatalog));
    assert.strictEqual(semanticToolsCatalog.length, 5);

    const mockAgent = {
      workspaceBrain: {
        getWorkspaceFacts: async (topic) => [{ topic, snippet: 'Sample discussion' }]
      }
    };
    const runner = new SemanticToolRunner(mockAgent);

    const discussionRes = await runner.run('find_discussions', { topic: 'JWT Auth' });
    assert.ok(discussionRes);

    const timelineRes = await runner.run('reconstruct_timeline', { topic: 'Vite Migration' });
    assert.ok(Array.isArray(timelineRes));
  });
});
