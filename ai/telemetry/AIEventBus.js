const { EventEmitter } = require('node:events');
const crypto = require('node:crypto');

/**
 * AIEventBus - Decoupled Event-Driven Observability Bus for Notely AI Engine
 * Emits OpenTelemetry-compliant structured events across all AI subsystems.
 */
class AIEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100);
  }

  /**
   * Publish a structured telemetry event
   * @param {Object} event
   */
  publish(event = {}) {
    const timestamp = event.timestamp || new Date().toISOString();
    const eventId = event.eventId || `evt_${crypto.randomUUID().slice(0, 8)}`;
    
    const normalized = {
      workspaceId: event.workspaceId || 'default',
      conversationId: event.conversationId || 'global',
      traceId: event.traceId || `trc_${crypto.randomUUID().slice(0, 12)}`,
      spanId: event.spanId || `spn_${crypto.randomUUID().slice(0, 8)}`,
      parentSpanId: event.parentSpanId || null,
      eventId,
      timestamp,
      durationMs: typeof event.durationMs === 'number' ? event.durationMs : 0,
      component: event.component || 'AIEngine',
      subcomponent: event.subcomponent || null,
      category: event.category || 'System', // Conversation, Planner, Intent, Retrieval, Tool, LLM, Prompt, Error, etc.
      eventType: event.eventType || 'action',
      status: event.status || 'completed', // pending, running, completed, failed, retrying, skipped
      severity: event.severity || 'info', // info, warn, error, debug
      callerType: event.callerType || 'system', // system vs llm
      label: event.label || event.eventType || 'Event',
      payload: event.payload || {},
      diagnostics: event.diagnostics || null,
      error: event.error ? (typeof event.error === 'string' ? event.error : event.error.message) : null
    };

    this.emit('event', normalized);
    return normalized;
  }

  /**
   * Subscribe to event stream
   * @param {Function} handler 
   * @returns {Function} unsubscribe function
   */
  subscribe(handler) {
    this.on('event', handler);
    return () => this.off('event', handler);
  }
}

const eventBus = new AIEventBus();

module.exports = {
  AIEventBus,
  eventBus
};
