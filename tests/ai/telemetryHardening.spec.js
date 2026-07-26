/**
 * tests/ai/telemetryHardening.spec.js
 * Comprehensive tests for AI Telemetry, Observability, Prompt Modularity, and Health Score fixes.
 */

const ContextOrchestrator = require('../../ai/planner/ContextOrchestrator');
const PromptPipeline = require('../../ai/prompts/PromptPipeline');
const { buildEvents } = require('../../ai/telemetry/eventBuilder');

describe('Telemetry & Observability Hardening Regression Suite', () => {
  let orchestrator;
  let promptPipeline;

  beforeEach(() => {
    orchestrator = new ContextOrchestrator();
    promptPipeline = new PromptPipeline();
  });

  // Test 1: Operation-Level Retrieval Quality
  it('1. Deduplicates retrievalQuality records to operation-level summaries', () => {
    const evidenceItems = [
      { toolName: 'get_tasks', filePath: 'C:\\Notes\\a.md', content: 'Task 1', score: 0.95, retrievalType: 'deterministic' },
      { toolName: 'get_tasks', filePath: 'C:\\Notes\\a.md', content: 'Task 2', score: 0.95, retrievalType: 'deterministic' },
      { toolName: 'get_tasks', filePath: 'C:\\Notes\\b.md', content: 'Task 3', score: 0.95, retrievalType: 'deterministic' }
    ];

    const aggregated = orchestrator.aggregateContext(evidenceItems, { isTaskQuery: true });

    // Expect 1 operation-level retrievalQuality entry for 'get_tasks', not 3 duplicate entries
    expect(aggregated.retrievalQuality).toHaveLength(1);
    expect(aggregated.retrievalQuality[0].source).toBe('get_tasks');
    expect(aggregated.retrievalQuality[0].retrievalType).toBe('deterministic');
    expect(aggregated.retrievalQuality[0].itemsReturned).toBe(3);
    expect(aggregated.retrievalQuality[0].acceptedCount).toBe(3);
    expect(aggregated.retrievalQuality[0].accepted).toBe(true);
  });

  // Test 2: Modular System Prompt Assembly
  it('2. Dynamically excludes unrequested prompt modules based on capabilities', () => {
    const defaultPrompt = promptPipeline.assemble({});
    const taskOnlyPrompt = promptPipeline.assemble({
      category: 'Task Query',
      capabilities: { needsDiagram: false, needsCode: false, needsTasks: true }
    });

    // Formatting policy (Mermaid/Code rules) should be excluded when not needed
    expect(defaultPrompt).toContain('Formatting & Visual Rendering Policy');
    expect(taskOnlyPrompt).not.toContain('Formatting & Visual Rendering Policy');
    expect(taskOnlyPrompt.length).toBeLessThan(defaultPrompt.length);
  });

  // Test 3: Enhanced Tool Metrics in Telemetry Events
  it('3. Generates rich tool performance metrics (itemsReturned, inputSizeBytes, outputSizeBytes)', () => {
    const stages = [
      { stage: 1, name: 'S1', durationMs: 2 },
      { stage: 2, name: 'S2', durationMs: 30, confidenceScore: 0.95 },
      { stage: 3, name: 'S3', durationMs: 5, systemPromptLength: 2000 },
      {
        stage: 4,
        name: 'S4',
        durationMs: 10,
        strategy: 'TaskSummaryFormatter',
        executionMode: 'template_formatter',
        cache: { checked: true, hit: false, llmBypassed: true },
        tokensUsed: 0,
        tokensDetail: { inputTokens: 0, outputTokens: 0, toolTokens: 0, totalTokens: 0 }
      }
    ];

    const toolTrace = [
      {
        toolName: 'get_tasks',
        toolType: 'planned-execution',
        callerType: 'executor',
        selectedBy: 'planner',
        intent: 'workspace_task_summary',
        durationMs: 5,
        itemsReturned: 3,
        inputSizeBytes: 18,
        outputSizeBytes: 350,
        cacheHit: false,
        output: '[{"task":"1"},{"task":"2"},{"task":"3"}]'
      }
    ];

    const events = buildEvents(stages, toolTrace, 50, Date.now());
    const toolEvt = events.find(e => e.type === 'tool_execution');

    expect(toolEvt).toBeDefined();
    expect(toolEvt.toolName).toBe('get_tasks');
    expect(toolEvt.eventName).toBe('tool.executed');
    expect(toolEvt.itemsReturned).toBe(3);
    expect(toolEvt.inputSizeBytes).toBe(18);
    expect(toolEvt.outputSizeBytes).toBe(350);
  });

  // Test 4: Execution Mode & Cache Telemetry Classification
  it('4. Attaches explicit executionMode and cache metadata for deterministic bypass', () => {
    const stages = [
      {
        stage: 4,
        name: 'Runtime Execution Strategy & Grounding',
        durationMs: 9,
        strategy: 'TaskSummaryFormatter',
        executionMode: 'template_formatter',
        cache: { checked: true, hit: false, llmBypassed: true },
        tokensUsed: 0
      }
    ];

    const events = buildEvents(stages, [], 10, Date.now());
    const llmEvt = events.find(e => e.type === 'llm_execution');

    expect(llmEvt).toBeDefined();
    expect(llmEvt.eventName).toBe('llm.completed');
    expect(llmEvt.executionMode).toBe('template_formatter');
    expect(llmEvt.cache).toEqual({ checked: true, hit: false, llmBypassed: true });
  });

  // Test 5: Provider Metadata and Execution DAG Construction
  it('5. Generates provider metadata and execution DAG in trace completion event', () => {
    const stages = [
      {
        stage: 4,
        name: 'Runtime Dynamic Strategy Execution',
        durationMs: 700,
        strategy: 'StreamingStrategy',
        provider: 'groq',
        model: 'llama-3.3-70b',
        finishReason: 'stop',
        tokensUsed: 120
      }
    ];

    const events = buildEvents(stages, [], 700, Date.now());
    const llmEvt = events.find(e => e.type === 'llm_execution');
    const traceDoneEvt = events.find(e => e.type === 'trace_completed');

    expect(llmEvt.provider).toBe('groq');
    expect(llmEvt.model).toBe('llama-3.3-70b');
    expect(llmEvt.finishReason).toBe('stop');

    expect(traceDoneEvt).toBeDefined();
    expect(traceDoneEvt.dagNodes).toHaveLength(5);
    expect(traceDoneEvt.dagEdges).toHaveLength(4);
  });
});
