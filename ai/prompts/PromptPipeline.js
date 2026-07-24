/**
 * PromptPipeline - Dynamic system prompt assembly engine following a 13-stage execution pipeline.
 */

const PromptLoader = require('./PromptLoader');
const TemplateEngine = require('./TemplateEngine');
const { createLogger } = require('../core/logger');

const log = createLogger('PromptPipeline');

class PromptPipeline {
  /**
   * @param {PromptLoader} promptLoader
   */
  constructor(promptLoader = null) {
    this.loader = promptLoader || new PromptLoader();
  }

  /**
   * Assemble complete system prompt dynamically from static policy assets and runtime context
   * @param {object} options
   * @param {string|object} [options.persona='general'] - Persona ID or custom persona object
   * @param {object} [options.workspaceContext] - Workspace metadata & current file content
   * @param {Array|string} [options.conversationMemory] - Recent conversation history or memory summary
   * @param {Array|string} [options.retrievedEvidence] - Merged evidence from search/graph tools
   * @param {object} [options.uiContext] - UI tab state, selection, view mode
   * @returns {string}
   */
  assemble(options = {}) {
    const pipelineStages = [];

    // Stage 1: Base System
    const baseSystem = this.loader.loadSystemPrompt('base-system');
    if (baseSystem.body) pipelineStages.push(baseSystem.body);

    // Stage 2: Behavior Policy
    const behaviorPolicy = this.loader.loadSystemPrompt('behavior-policy');
    if (behaviorPolicy.body) pipelineStages.push(behaviorPolicy.body);

    // Stage 3: Planning Policy
    const planningPolicy = this.loader.loadSystemPrompt('planning-policy');
    if (planningPolicy.body) pipelineStages.push(planningPolicy.body);

    // Stage 4: Permission Policy
    const permissionPolicy = this.loader.loadSystemPrompt('permission-policy');
    if (permissionPolicy.body) pipelineStages.push(permissionPolicy.body);

    // Stage 5: Grounding Policy
    const groundingPolicy = this.loader.loadSystemPrompt('grounding-policy');
    if (groundingPolicy.body) pipelineStages.push(groundingPolicy.body);

    // Stage 6: Safety Policy
    const safetyPolicy = this.loader.loadSystemPrompt('safety-policy');
    if (safetyPolicy.body) pipelineStages.push(safetyPolicy.body);

    // Stage 7: Formatting Policy
    const formattingPolicy = this.loader.loadSystemPrompt('formatting-policy');
    if (formattingPolicy.body) pipelineStages.push(formattingPolicy.body);

    // Stage 8: Active Persona
    let personaContent = '';
    const personaInput = options.persona || 'general';

    if (typeof personaInput === 'string') {
      const loadedPersona = this.loader.loadPersona(personaInput) || this.loader.loadPersona('general');
      if (loadedPersona) {
        const metaStr = Object.entries(loadedPersona.metadata)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
          .join('\n');
        personaContent = `ACTIVE PERSONA ROLE (${loadedPersona.metadata.name || personaInput}):\n${metaStr}\n\n${loadedPersona.body}`;
      }
    } else if (typeof personaInput === 'object' && personaInput !== null) {
      const name = personaInput.name || personaInput.id || 'Custom Persona';
      const instructions = personaInput.systemInstructions || personaInput.prompt || personaInput.body || '';
      personaContent = `ACTIVE PERSONA ROLE (${name}):\n${instructions}`;
    }

    if (personaContent) {
      pipelineStages.push(`---\n${personaContent}`);
    }

    // Stage 9: Workspace Context Injection
    if (options.workspaceContext) {
      const rawWsTemplate = this.loader.loadTemplate('workspace-context');
      const wsBlock = TemplateEngine.renderWorkspaceContext(rawWsTemplate, options.workspaceContext);
      if (wsBlock) pipelineStages.push(wsBlock);
    }

    // Stage 10: Conversation Memory Injection
    if (options.conversationMemory) {
      const rawMemTemplate = this.loader.loadTemplate('conversation-memory');
      const memBlock = TemplateEngine.renderConversationMemory(rawMemTemplate, options.conversationMemory);
      if (memBlock) pipelineStages.push(memBlock);
    }

    // Stage 11: Retrieved Evidence Injection
    if (options.retrievedEvidence) {
      const rawEvTemplate = this.loader.loadTemplate('retrieved-context');
      const evBlock = TemplateEngine.renderRetrievedContext(rawEvTemplate, options.retrievedEvidence);
      if (evBlock) pipelineStages.push(evBlock);
    }

    // Stage 12: Current UI Context Injection
    if (options.uiContext) {
      const rawUiTemplate = this.loader.loadTemplate('ui-context');
      const uiBlock = TemplateEngine.renderUIContext(rawUiTemplate, options.uiContext);
      if (uiBlock) pipelineStages.push(uiBlock);
    }

    // Stage 13: Final Assembly Join
    const finalPrompt = pipelineStages.join('\n\n---\n\n');
    log.info(`Assembled system prompt (${finalPrompt.length} chars across ${pipelineStages.length} stages)`);

    return finalPrompt;
  }
}

module.exports = PromptPipeline;
