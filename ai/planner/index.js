/**
 * Planner Module Facade
 * Single entry point for planning, multi-tool orchestration, and intent analysis.
 */

const Planner = require('./Planner');
const ContextOrchestrator = require('./ContextOrchestrator');
const IntentAnalyzer = require('./IntentAnalyzer');
const CapabilityResolver = require('./CapabilityResolver');
const registryUtils = require('./registryUtils');

module.exports = {
  Planner,
  ContextOrchestrator,
  IntentAnalyzer,
  CapabilityResolver,
  registryUtils,

  createPlanner: (agent) => new Planner(agent),
  createContextOrchestrator: (agent) => new ContextOrchestrator(agent)
};
