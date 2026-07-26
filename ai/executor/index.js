/**
 * Executor Module Facade
 * Single entry point for query execution, multi-step tool calls, streaming, and self-correction.
 */

const QueryExecutor = require('./QueryExecutor');
const SelfCorrectionEngine = require('./SelfCorrectionEngine');

module.exports = {
  QueryExecutor,
  SelfCorrectionEngine,

  createQueryExecutor: (agent) => new QueryExecutor(agent)
};
