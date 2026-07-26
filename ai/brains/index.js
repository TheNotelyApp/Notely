/**
 * Brains Module Facade (3-Brain Triad)
 * Single entry point for WorkspaceBrain, ReasoningBrain, and ActionBrain.
 */

const WorkspaceBrain = require('./WorkspaceBrain');
const ReasoningBrain = require('./ReasoningBrain');
const ActionBrain = require('./ActionBrain');

module.exports = {
  WorkspaceBrain,
  ReasoningBrain,
  ActionBrain,

  createWorkspaceBrain: (db) => new WorkspaceBrain(db),
  createReasoningBrain: (llmRegistry) => new ReasoningBrain(llmRegistry),
  createActionBrain: (agent) => new ActionBrain(agent)
};
