import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AIEventBus, eventBus } from '../../ai/telemetry/AIEventBus.js';
import { createTraceSession, TraceSession } from '../../ai/telemetry/TraceContext.js';
import { buildEvents, buildEventsFromTrace } from '../../ai/telemetry/eventBuilder.js';
import TelemetryDB from '../../ai/telemetry/TelemetryDB.js';
import CompactionEngine from '../../ai/compaction/CompactionEngine.js';
import Planner from '../../ai/planner/Planner.js';
import fs from 'fs';
import path from 'path';

describe('AI Telemetry & Execution Trace Framework', () => {
  let tmpDir;
  let telemetryDb;

  beforeEach(() => {
    tmpDir = path.join(process.cwd(), '.tmp-test-telemetry-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6));
    fs.mkdirSync(tmpDir, { recursive: true });
    telemetryDb = new TelemetryDB(tmpDir);
    telemetryDb.initialize();
  });

  afterEach(() => {
    if (telemetryDb) {
      telemetryDb.close();
    }
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('1. Successful execution — TraceSession produces complete hierarchical trace', () => {
    const trace = createTraceSession({
      workspaceId: 'ws-test',
      conversationId: 'conv-1',
      query: 'Summarize meeting notes'
    });

    expect(trace.traceId).toBeDefined();
    expect(trace.rootSpanId).toBeDefined();

    // Start child span
    const span1 = trace.startSpan('Planner', 'Planner', trace.rootSpanId, { query: 'Summarize meeting notes' });
    trace.recordEvent('Planner', 'planner:plan_created', 'Plan Created', { steps: ['search_notes'] }, { spanId: span1 });
    trace.endSpan(span1, { status: 'completed' });

    // Start LLM span
    const span2 = trace.startSpan('LLM Execution', 'LLM', trace.rootSpanId);
    trace.recordEvent('LLM', 'llm:completed', 'LLM Responded', { output: 'Summary text' }, { spanId: span2 });
    trace.endSpan(span2, { status: 'completed' });

    const summary = trace.finish({ status: 'completed' });
    expect(summary.events.length).toBeGreaterThanOrEqual(4);

    const uiEvents = buildEventsFromTrace(summary.events);
    expect(uiEvents.some(e => e.type === 'planner')).toBe(true);
    expect(uiEvents.some(e => e.type === 'llm_execution' || e.type === 'llm_response')).toBe(true);
    expect(uiEvents.some(e => e.type === 'trace_completed')).toBe(true);
  });

  it('2. Tool failures — records error event and failed span status', () => {
    const trace = createTraceSession({
      workspaceId: 'ws-test',
      conversationId: 'conv-tool-fail',
      query: 'Run broken tool'
    });

    const toolSpan = trace.startSpan('Tool Execution', 'Tool', trace.rootSpanId, { toolName: 'failing_tool' });
    trace.recordError('Tool', 'Tool Execution Failed', 'Network connection refused', { toolName: 'failing_tool' }, { spanId: toolSpan });
    trace.endSpan(toolSpan, { status: 'failed', error: 'Network connection refused' });

    const summary = trace.finish({ status: 'failed' });
    const events = buildEventsFromTrace(summary.events);
    
    const errEvt = events.find(e => e.severity === 'error' || e.status === 'failed');
    expect(errEvt).toBeDefined();
    expect(errEvt.error).toBe('Network connection refused');
  });

  it('3. Tool retries — records retry events and warning severity', () => {
    const trace = createTraceSession({
      workspaceId: 'ws-test',
      conversationId: 'conv-retry',
      query: 'Query requiring retry'
    });

    const span = trace.startSpan('Tool Execution', 'Tool', trace.rootSpanId, { toolName: 'api_tool' });
    trace.recordWarning('Tool', 'Tool Retry Attempt 1', 'Rate limit hit, retrying in 500ms', { retryCount: 1 }, { spanId: span });
    trace.recordEvent('Tool', 'tool:completed', 'Tool Succeeded on Retry', { retryCount: 1, result: 'OK' }, { spanId: span });
    trace.endSpan(span, { status: 'completed' });

    const summary = trace.finish({ status: 'completed' });
    const events = buildEventsFromTrace(summary.events);

    const warnEvt = events.find(e => e.severity === 'warn');
    expect(warnEvt).toBeDefined();
    expect(warnEvt.warningMessage).toContain('Rate limit hit');
  });

  it('4. Streaming responses — records stream started and completed telemetry', async () => {
    const trace = createTraceSession({
      workspaceId: 'ws-test',
      conversationId: 'conv-stream',
      query: 'Stream response test'
    });

    trace.recordEvent('LLM', 'llm:stream_started', 'Streaming Started', { model: 'gemini-2.0-flash-lite' });
    trace.recordEvent('LLM', 'llm:stream_completed', 'Streaming Completed', { tokensUsed: 120, output: 'Streamed content' });

    const summary = trace.finish({ status: 'completed' });
    const events = buildEventsFromTrace(summary.events);

    expect(events.some(e => e.eventType === 'llm:stream_started')).toBe(true);
    expect(events.some(e => e.eventType === 'llm:stream_completed')).toBe(true);
  });

  it('5. Multi-tool workflows & Multiple LLM invocations — tracks nested execution order', () => {
    const trace = createTraceSession({
      workspaceId: 'ws-test',
      conversationId: 'conv-multi-tool',
      query: 'Multi step analysis'
    });

    // Step 1: Tool A
    const spanA = trace.startSpan('Tool A', 'Tool', trace.rootSpanId);
    trace.recordEvent('Tool', 'tool_execution', 'Tool A Done', { toolName: 'search_notes' }, { spanId: spanA });
    trace.endSpan(spanA);

    // Step 2: Intermediate LLM call
    const spanLlm1 = trace.startSpan('LLM Call 1', 'LLM', trace.rootSpanId);
    trace.recordEvent('LLM', 'llm_execution', 'LLM 1 Done', { tokensUsed: 50 }, { spanId: spanLlm1 });
    trace.endSpan(spanLlm1);

    // Step 3: Tool B
    const spanB = trace.startSpan('Tool B', 'Tool', trace.rootSpanId);
    trace.recordEvent('Tool', 'tool_execution', 'Tool B Done', { toolName: 'read_note' }, { spanId: spanB });
    trace.endSpan(spanB);

    // Step 4: Final LLM synthesis
    const spanLlm2 = trace.startSpan('LLM Call 2', 'LLM', trace.rootSpanId);
    trace.recordEvent('LLM', 'llm_execution', 'LLM 2 Done', { tokensUsed: 150 }, { spanId: spanLlm2 });
    trace.endSpan(spanLlm2);

    const summary = trace.finish({ status: 'completed' });
    const events = buildEventsFromTrace(summary.events);

    const toolEvents = events.filter(e => e.type === 'tool_execution');
    expect(toolEvents.length).toBe(2);

    const llmEvents = events.filter(e => e.type === 'llm_execution');
    expect(llmEvents.length).toBe(2);
  });

  it('6. Conversation switching — isolates telemetry per conversation ID in TelemetryDB', () => {
    telemetryDb.addTelemetry({
      flowId: 'flow-conv-A',
      traceId: 'trc-A',
      conversationId: 'conv-A',
      query: 'Query for A',
      totalDurationMs: 100,
      tokensUsed: 50,
      events: [{ eventType: 'planner:plan_created', label: 'Plan A' }]
    });

    telemetryDb.addTelemetry({
      flowId: 'flow-conv-B',
      traceId: 'trc-B',
      conversationId: 'conv-B',
      query: 'Query for B',
      totalDurationMs: 200,
      tokensUsed: 80,
      events: [{ eventType: 'planner:plan_created', label: 'Plan B' }]
    });

    const logsA = telemetryDb.getTelemetryByConversation('conv-A');
    const logsB = telemetryDb.getTelemetryByConversation('conv-B');

    expect(logsA.length).toBe(1);
    expect(logsA[0].metadata.query).toBe('Query for A');

    expect(logsB.length).toBe(1);
    expect(logsB[0].metadata.query).toBe('Query for B');
  });

  it('7. Timeouts & Cancellations — records aborted / cancelled trace status', () => {
    const trace = createTraceSession({
      workspaceId: 'ws-test',
      conversationId: 'conv-cancel',
      query: 'Query cancelled by user'
    });

    trace.recordWarning('System', 'Execution Cancelled', 'User pressed stop generation button');
    const summary = trace.finish({ status: 'cancelled' });

    expect(summary.status).toBe('cancelled');
    const events = buildEventsFromTrace(summary.events);
    expect(events.some(e => e.severity === 'warn')).toBe(true);
  });

  it('8. TelemetryDB queryEvents API — supports flexible filtering by eventType, category, status', () => {
    telemetryDb.addTelemetry({
      flowId: 'flow-q-1',
      traceId: 'trc-q-1',
      conversationId: 'conv-q',
      query: 'Test query',
      events: [
        { spanId: 's1', eventType: 'planner:plan_created', category: 'Planner', status: 'completed', severity: 'info' },
        { spanId: 's2', eventType: 'tool:execution', category: 'Tool', status: 'failed', severity: 'error', payload: { error: 'Timeout' } }
      ]
    });

    const allEvents = telemetryDb.queryEvents({ conversationId: 'conv-q' });
    expect(allEvents.length).toBe(2);

    const errorEvents = telemetryDb.queryEvents({ conversationId: 'conv-q', severity: 'error' });
    expect(errorEvents.length).toBe(1);
    expect(errorEvents[0].eventType).toBe('tool:execution');
  });

  it('9. CompactionEngine telemetry — records compaction events when trace is passed', () => {
    const trace = createTraceSession({ workspaceId: 'ws-test', conversationId: 'conv-compact', query: 'test' });
    
    const messages = [
      { role: 'user', content: 'Turn 1 user request' },
      { role: 'assistant', content: 'Turn 1 assistant answer' },
      { role: 'user', content: 'Turn 2 user request' },
      { role: 'assistant', content: 'Turn 2 assistant answer' },
      { role: 'user', content: 'Turn 3 user request' },
      { role: 'assistant', content: 'Turn 3 assistant answer' }
    ];

    const res = CompactionEngine.compactHistory(messages, { maxVerbatimCount: 2, trace });
    expect(res.isCompacted).toBe(true);
    expect(res.turnsCompacted).toBe(2);

    const events = buildEventsFromTrace(trace.events);
    expect(events.some(e => e.eventType === 'memory:compaction_completed')).toBe(true);
  });

  it('10. Planner telemetry — records plan_created event when trace is passed', () => {
    const planner = new Planner(null);
    const trace = createTraceSession({ workspaceId: 'ws-test', conversationId: 'conv-plan', query: 'find tasks' });

    const plan = planner.createPlan('find my tasks', { trace });
    expect(plan.intent).toBeDefined();

    const events = buildEventsFromTrace(trace.events);
    expect(events.some(e => e.eventType === 'planner:plan_created')).toBe(true);
  });
});
