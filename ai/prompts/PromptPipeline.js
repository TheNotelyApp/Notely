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
    this.moduleCache = new Map();
    this._cachedStaticCore = null;
  }

  /**
   * Load individual prompt module with in-memory caching
   * @private
   */
  _loadModule(name) {
    if (this.moduleCache.has(name)) {
      return this.moduleCache.get(name);
    }
    const p = this.loader.loadSystemPrompt(name);
    const body = p && p.body ? p.body : '';
    this.moduleCache.set(name, body);
    return body;
  }

  /**
   * Get cached core static system prompt block (Core identity + Safety + Grounding)
   * @private
   */
  _getStaticCore() {
    if (this._cachedStaticCore !== null) {
      return this._cachedStaticCore;
    }
    const baseSystem = this._loadModule('base-system');
    const behaviorPolicy = this._loadModule('behavior-policy');
    const safetyPolicy = this._loadModule('safety-policy');
    const permPolicy = this._loadModule('permission-policy');
    const groundingPolicy = this._loadModule('grounding-policy');

    const coreParts = [baseSystem, behaviorPolicy, safetyPolicy, permPolicy, groundingPolicy].filter(Boolean);
    this._cachedStaticCore = coreParts.join('\n\n---\n\n');
    return this._cachedStaticCore;
  }

  /**
   * Assemble complete system prompt dynamically from modular policy assets and runtime context
   * @param {object} options
   * @param {string|object} [options.persona='general'] - Persona ID or custom persona object
   * @param {object} [options.workspaceContext] - Workspace metadata & current file content
   * @param {Array|string} [options.conversationMemory] - Recent conversation history or memory summary
   * @param {Array|string} [options.retrievedEvidence] - Merged evidence from search/graph tools
   * @param {object} [options.uiContext] - UI tab state, selection, view mode
   * @param {string} [options.category] - Query intent category
   * @param {object} [options.capabilities] - Query capabilities manifest
   * @returns {string}
   */
  assemble(options = {}) {
    const pipelineStages = [];
    const activeCategory = options.category || 'Workspace Search';
    const caps = options.capabilities || options.manifest?.capabilities || {};

    // 1. Core Foundational Policies (Always Included - Cached Static Block)
    const staticCore = this._getStaticCore();
    if (staticCore) {
      pipelineStages.push(staticCore);
    }

    // 2. Conditional Modular Policies
    // Formatting & Visual Policy: Included when diagram, code, or formatting is requested, or by default for general search
    const needsFormatting = caps.needsDiagram || caps.needsCode || caps.needsCreative || !options.capabilities;
    if (needsFormatting) {
      const formattingPolicy = this._loadModule('formatting-policy');
      if (formattingPolicy) pipelineStages.push(formattingPolicy);
    }

    // Planning Policy: Included for task queries, workspace search, or planning
    if (['Task Query', 'Workspace Search', 'Planning', 'Graph Exploration'].includes(activeCategory) || caps.needsTasks) {
      const planningPolicy = this._loadModule('planning-policy');
      if (planningPolicy) pipelineStages.push(planningPolicy);
    }

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

    // Stage 9: Workspace Context Injection (Only inject when active file or non-trivial context is present)
    const hasActiveWorkspaceContext = options.workspaceContext && (
      (options.workspaceContext.activeNotePath && options.workspaceContext.activeNotePath !== 'none') ||
      Boolean(options.workspaceContext.activeNoteContent) ||
      Boolean(options.workspaceContext.raw)
    );
    if (hasActiveWorkspaceContext) {
      // Deduplicate activeNoteContent if already present in retrievedEvidence to avoid repeated text chunks
      const wsCtx = { ...options.workspaceContext };
      if (wsCtx.activeNoteContent && options.retrievedEvidence && typeof options.retrievedEvidence === 'string' && options.retrievedEvidence.includes(wsCtx.activeNoteContent.trim().slice(0, 100))) {
        wsCtx.activeNoteContent = '[Active note content included in retrieved evidence below]';
      }
      const rawWsTemplate = this.loader.loadTemplate('workspace-context');
      const wsBlock = TemplateEngine.renderWorkspaceContext(rawWsTemplate, wsCtx);
      if (wsBlock) pipelineStages.push(wsBlock);
    }

    // Stage 10: Conversation Memory Injection (Bypassed - conversation history is supplied strictly via messages array to prevent prompt transmission duplication)

    // Stage 11: Retrieved Evidence Injection (Budget-capped at 4,000 chars)
    if (options.retrievedEvidence) {
      let evText = typeof options.retrievedEvidence === 'string'
        ? options.retrievedEvidence
        : JSON.stringify(options.retrievedEvidence);
      if (evText.length > 4000) {
        evText = evText.slice(0, 4000) + '\n... [retrieved evidence capped at 4000 chars context limit]';
      }
      const rawEvTemplate = this.loader.loadTemplate('retrieved-context');
      const evBlock = TemplateEngine.renderRetrievedContext(rawEvTemplate, evText);
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

    const trace = options.trace || options.traceSession;
    if (trace && typeof trace.recordEvent === 'function') {
      trace.recordEvent('Prompt', 'prompt:assembled', 'System Prompt Assembled', {
        systemPromptLength: finalPrompt.length,
        stagesCount: pipelineStages.length,
        hasPersona: Boolean(personaContent),
        hasWorkspaceContext: Boolean(options.workspaceContext),
        hasMemory: Boolean(options.conversationMemory),
        hasRetrievedEvidence: Boolean(options.retrievedEvidence),
        hasUiContext: Boolean(options.uiContext),
        systemPromptSnippet: finalPrompt.slice(0, 500)
      });
    }

    return finalPrompt;
  }
}

module.exports = PromptPipeline;
