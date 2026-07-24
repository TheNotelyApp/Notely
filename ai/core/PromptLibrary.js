/**
 * PromptLibrary - Facade over PromptLoader and PromptPipeline.
 * Maintains backward compatibility while delegating to the modular Markdown prompt architecture.
 */

const PromptLoader = require('../prompts/PromptLoader');
const PromptPipeline = require('../prompts/PromptPipeline');

class PromptLibrary {
  static getLoader() {
    if (!this._loader) {
      this._loader = new PromptLoader();
    }
    return this._loader;
  }

  static getPipeline() {
    if (!this._pipeline) {
      this._pipeline = new PromptPipeline(this.getLoader());
    }
    return this._pipeline;
  }

  static getBaseSystemPrompt() {
    const loader = this.getLoader();
    const base = loader.loadSystemPrompt('base-system');
    return base.body || "You are Notely's AI Knowledge Partner.";
  }

  static composeSystemPrompt(personaInstructions = '', workspaceContext = '') {
    const pipeline = this.getPipeline();
    return pipeline.assemble({
      persona: personaInstructions ? { systemInstructions: personaInstructions } : 'general',
      workspaceContext: typeof workspaceContext === 'object' ? workspaceContext : { raw: workspaceContext }
    });
  }
}

module.exports = PromptLibrary;
