/**
 * Config Module Facade
 * Single entry point for AI model configuration schemas and defaults.
 */

const aiModels = require('./ai-models.json');

module.exports = {
  aiModels,
  getModelsConfig: () => aiModels
};
