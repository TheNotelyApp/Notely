/**
 * Telemetry Module Facade
 * Single entry point for flow execution tracing, metrics event bus, and event persistence.
 */

const { TraceSession, createTraceSession } = require('./TraceContext');
const TelemetryDB = require('./TelemetryDB');
const { AIEventBus, eventBus } = require('./AIEventBus');
const { buildEvents, buildEventsFromTrace } = require('./eventBuilder');

function recordTelemetry(agent, telemetryPayload) {
  try {
    if (agent?.telemetryDb && agent.telemetryDb.isInitialized) {
      agent.telemetryDb.addTelemetry(telemetryPayload);
    } else if (agent?.logDb && agent.logDb.isInitialized) {
      agent.logDb.addLog(
        'FlowTracker',
        `Flow execution telemetry recorded for query: "${String(telemetryPayload?.query || '').slice(0, 60)}"`,
        'info',
        telemetryPayload
      );
    } else {
      const workspaceRoot = agent?.workspaceRoot || process.cwd();
      const fallbackDb = new TelemetryDB(workspaceRoot);
      if (fallbackDb.initialize()) {
        fallbackDb.addTelemetry(telemetryPayload);
        fallbackDb.close();
      }
    }
  } catch (err) {
    console.warn('[Telemetry] Failed to log record:', err.message);
  }
}

module.exports = {
  TraceSession,
  createTraceSession,
  TelemetryDB,
  AIEventBus,
  eventBus,
  buildEvents,
  buildEventsFromTrace,
  recordTelemetry,

  createTelemetryDB: (workspaceRoot) => new TelemetryDB(workspaceRoot)
};
