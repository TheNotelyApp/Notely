const crypto = require('node:crypto');
const { eventBus } = require('./AIEventBus');

/**
 * TraceContext - OpenTelemetry W3C Compliant Trace & Span Hierarchy Builder
 */
class TraceSession {
  constructor({ workspaceId = 'default', conversationId = 'global', traceId, query = '' }) {
    this.workspaceId = workspaceId;
    this.conversationId = conversationId;
    this.traceId = traceId || `trc_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    this.query = query;
    this.startedAt = new Date().toISOString();
    this.activeSpans = new Map();
    this.events = [];
    this.toolCache = new Map();
    
    // Create Root Trace Span
    this.rootSpanId = this.startSpan('Trace Root', 'Conversation', null, { query });
  }

  /**
   * Helper key builder for tool caching with canonical sorted keys
   * @private
   */
  _buildToolCacheKey(toolName, args) {
    try {
      const canonicalize = (obj) => {
        if (obj === null || typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) return obj.map(canonicalize);
        return Object.keys(obj)
          .sort()
          .reduce((acc, k) => {
            acc[k] = canonicalize(obj[k]);
            return acc;
          }, {});
      };
      return `${toolName}:${JSON.stringify(canonicalize(args || {}))}`;
    } catch {
      return `${toolName}:${String(args)}`;
    }
  }

  /**
   * Retrieve cached tool execution result if available
   */
  getCachedToolResult(toolName, args) {
    const key = this._buildToolCacheKey(toolName, args);
    return this.toolCache.get(key);
  }

  /**
   * Store tool execution result in request-scoped cache (skips write operations)
   */
  setCachedToolResult(toolName, args, result) {
    const isWriteTool = /^(write|create|update|delete|edit|save|modify)_/i.test(toolName);
    if (isWriteTool) return;
    const key = this._buildToolCacheKey(toolName, args);
    this.toolCache.set(key, result);
  }

  /**
   * Start a logical execution span
   */
  startSpan(name, category = 'System', parentSpanId = null, extra = {}) {
    const spanId = `spn_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const actualParentSpanId = parentSpanId || (this.rootSpanId && spanId !== this.rootSpanId ? this.rootSpanId : null);
    
    const span = {
      spanId,
      parentSpanId: actualParentSpanId,
      name,
      category,
      startedAt: new Date().toISOString(),
      status: 'running',
      extra
    };
    
    this.activeSpans.set(spanId, span);

    const event = eventBus.publish({
      workspaceId: this.workspaceId,
      conversationId: this.conversationId,
      traceId: this.traceId,
      spanId,
      parentSpanId: actualParentSpanId,
      component: extra.component || name,
      category,
      eventType: `${category.toLowerCase()}:started`,
      status: 'running',
      callerType: extra.callerType || 'system',
      label: `${name} Started`,
      payload: { ...extra, query: this.query }
    });

    this.events.push(event);
    return spanId;
  }

  /**
   * Complete an execution span
   */
  endSpan(spanId, { status = 'completed', payload = {}, error = null, diagnostics = null } = {}) {
    const span = this.activeSpans.get(spanId);
    const nowEpoch = Date.now();
    const startEpoch = span?.startedAt ? new Date(span.startedAt).getTime() : nowEpoch;
    const durationMs = Math.max(0, nowEpoch - startEpoch);

    if (span) {
      span.status = status;
      span.durationMs = durationMs;
      this.activeSpans.delete(spanId);
    }

    const event = eventBus.publish({
      workspaceId: this.workspaceId,
      conversationId: this.conversationId,
      traceId: this.traceId,
      spanId,
      parentSpanId: span?.parentSpanId || null,
      component: span?.name || 'AIEngine',
      category: span?.category || 'System',
      eventType: `${(span?.category || 'system').toLowerCase()}:${status}`,
      status,
      durationMs,
      severity: error ? 'error' : 'info',
      callerType: payload?.callerType || 'system',
      label: `${span?.name || 'Operation'} ${status === 'completed' ? 'Completed' : 'Failed'}`,
      payload,
      diagnostics,
      error
    });

    this.events.push(event);
    return event;
  }

  /**
   * Emit an instantaneous point-in-time timeline event
   */
  recordEvent(category, eventType, label, payload = {}, options = {}) {
    const spanId = options.spanId || this.rootSpanId;
    const span = this.activeSpans.get(spanId);

    const event = eventBus.publish({
      workspaceId: this.workspaceId,
      conversationId: this.conversationId,
      traceId: this.traceId,
      spanId,
      parentSpanId: span?.parentSpanId || null,
      component: options.component || 'AIEngine',
      category,
      eventType,
      status: options.status || 'completed',
      severity: options.error ? 'error' : (options.severity || 'info'),
      callerType: options.callerType || payload.callerType || 'system',
      label,
      payload,
      diagnostics: options.diagnostics || null,
      error: options.error || null
    });

    this.events.push(event);
    return event;
  }

  /**
   * Record a warning telemetry event
   */
  recordWarning(category, label, message, payload = {}, options = {}) {
    return this.recordEvent(category, `${category.toLowerCase()}:warning`, label, { ...payload, warningMessage: message }, {
      ...options,
      severity: 'warn'
    });
  }

  /**
   * Record an error telemetry event
   */
  recordError(category, label, error, payload = {}, options = {}) {
    const errorMsg = typeof error === 'string' ? error : (error?.message || String(error));
    return this.recordEvent(category, `${category.toLowerCase()}:error`, label, payload, {
      ...options,
      status: options.status || 'failed',
      severity: 'error',
      error: errorMsg
    });
  }

  /**
   * Close and finalize the trace session
   */
  finish({ status = 'completed', metadata = {} } = {}) {
    this.endSpan(this.rootSpanId, { status, payload: metadata });
    return {
      traceId: this.traceId,
      workspaceId: this.workspaceId,
      conversationId: this.conversationId,
      query: this.query,
      startedAt: this.startedAt,
      endedAt: new Date().toISOString(),
      status,
      events: this.events
    };
  }
}

function createTraceSession(opts) {
  return new TraceSession(opts);
}

module.exports = {
  TraceSession,
  createTraceSession
};
