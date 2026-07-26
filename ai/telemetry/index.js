/**
 * Telemetry Module Facade
 * Single entry point for flow execution tracing, metrics event bus, and event persistence.
 */

const { TraceSession, createTraceSession } = require('./TraceContext');
const TelemetryDB = require('./TelemetryDB');
const { AIEventBus, eventBus } = require('./AIEventBus');
const { buildEvents, buildEventsFromTrace } = require('./eventBuilder');

module.exports = {
  TraceSession,
  createTraceSession,
  TelemetryDB,
  AIEventBus,
  eventBus,
  buildEvents,
  buildEventsFromTrace,

  createTelemetryDB: (workspaceRoot) => new TelemetryDB(workspaceRoot)
};
