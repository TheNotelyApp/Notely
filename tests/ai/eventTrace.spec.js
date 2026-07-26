import { describe, expect, it, vi } from 'vitest';
import { eventBus } from '../../ai/telemetry/AIEventBus';
import { createTraceSession } from '../../ai/telemetry/TraceContext';

describe('Event-Driven Telemetry & Tracing Framework', () => {
  it('should publish structured events to AIEventBus', () => {
    const handler = vi.fn();
    const unsub = eventBus.subscribe(handler);

    const published = eventBus.publish({
      workspaceId: 'ws-123',
      conversationId: 'conv-456',
      category: 'Planner',
      eventType: 'planner:strategy_selected',
      label: 'Planner Strategy',
      payload: { strategy: 'HybridRetrieval' }
    });

    expect(published).toBeDefined();
    expect(published.traceId).toBeDefined();
    expect(published.spanId).toBeDefined();
    expect(published.category).toBe('Planner');
    expect(published.eventType).toBe('planner:strategy_selected');
    expect(published.payload.strategy).toBe('HybridRetrieval');
    expect(handler).toHaveBeenCalledWith(published);

    unsub();
  });

  it('should create hierarchical W3C-compliant spans in TraceSession', () => {
    const session = createTraceSession({
      workspaceId: 'ws-1',
      conversationId: 'conv-1',
      query: 'Summarize workspace tasks'
    });

    expect(session.traceId).toBeDefined();
    expect(session.rootSpanId).toBeDefined();

    // Start a child span (e.g. VectorSearch)
    const childSpanId = session.startSpan('Vector Search', 'Retrieval', session.rootSpanId, { query: 'tasks' });
    expect(childSpanId).toBeDefined();

    // Record timeline event inside child span
    const timelineEvt = session.recordEvent('Vector', 'vector:result', 'Chunks Retrieved', { count: 5 }, { spanId: childSpanId });
    expect(timelineEvt.spanId).toBe(childSpanId);
    expect(timelineEvt.parentSpanId).toBe(session.rootSpanId);

    // Complete child span
    const endEvt = session.endSpan(childSpanId, { status: 'completed', payload: { hits: 5 } });
    expect(endEvt.status).toBe('completed');
    expect(endEvt.durationMs).toBeGreaterThanOrEqual(0);

    // Finalize session
    const summary = session.finish({ status: 'completed' });
    expect(summary.traceId).toBe(session.traceId);
    expect(summary.events.length).toBeGreaterThan(0);
  });
});
