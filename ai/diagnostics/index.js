/**
 * Diagnostics Module Facade
 * Single entry point for evaluation harnesses and health diagnostics metrics aggregation.
 */

const AgentHarness = require('./AgentHarness');
const { getSubsystemHealth } = require('./AIHealth');

module.exports = {
  AgentHarness,
  getSubsystemHealth,

  createAgentHarness: (agent) => new AgentHarness(agent)
};
