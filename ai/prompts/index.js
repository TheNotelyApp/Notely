/**
 * Prompts Module Facade
 * Single entry point for prompt loading, template rendering, and system prompt pipeline assembly.
 */

const PromptLoader = require('./PromptLoader');
const PromptPipeline = require('./PromptPipeline');
const TemplateEngine = require('./TemplateEngine');
const PromptLibrary = require('./PromptLibrary');

module.exports = {
  PromptLoader,
  PromptPipeline,
  TemplateEngine,
  PromptLibrary,

  createPromptPipeline: (promptLoader) => new PromptPipeline(promptLoader),
  createPromptLoader: () => new PromptLoader()
};
