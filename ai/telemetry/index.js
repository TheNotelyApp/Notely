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

function calculatePipelineHealth({ confidenceScore = 0.9, groundingInfo = {}, systemPrompt = '' } = {}) {
  const retrievalScore = Math.round((confidenceScore || 0.9) * 100);
  const groundingScore = (groundingInfo?.brokenCitations || 0) === 0 ? 100 : Math.max(50, 100 - ((groundingInfo?.brokenCitations || 0) * 20));
  const promptEffScore = systemPrompt ? Math.min(100, Math.round(Math.max(50, (1 - (systemPrompt.length / 20000)) * 100))) : 90;
  const telemetryScore = 100;
  const overallHealth = Math.round((retrievalScore * 0.3) + (groundingScore * 0.3) + (promptEffScore * 0.2) + (telemetryScore * 0.2));

  return { retrieval: retrievalScore, grounding: groundingScore, telemetry: telemetryScore, promptEfficiency: promptEffScore, overall: overallHealth };
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
  calculatePipelineHealth,

  createTelemetryDB: (workspaceRoot) => new TelemetryDB(workspaceRoot)
};
