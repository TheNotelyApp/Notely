/**
 * Planner - Layer 3 of Decoupled Hybrid Planning Architecture
 * Responsibility: Execution DAG Planning
 *
 * Takes an IntentManifest (Intent Detection) and Resolved Capabilities (Capability Resolution)
 * to build structured, ordered execution plan DAGs for tool orchestration.
 */

const IntentAnalyzer = require('./IntentAnalyzer');
const CapabilityResolver = require('./CapabilityResolver');
const { createLogger } = require('../core/logger');
const { normalizeSearchQuery } = require('../utils/SearchQueryUtils');
const log = createLogger('Planner');

class Planner {
  constructor(agent) {
    this.agent = agent;
    this.intentAnalyzer = new IntentAnalyzer();
    this.capabilityResolver = new CapabilityResolver();
  }

  /**
   * Build an Execution Plan from Intent Manifest and Resolved Capabilities
   * @param {string} query
   * @param {object} [context={}]
   * @returns {{ intent: string, steps: Array<{ toolName: string, capability: string, args: object }> }}
   */
  createPlan(query, context = {}) {
    const intentManifest = this.intentAnalyzer.analyze(query, context);
    const resolvedCapabilities = this.capabilityResolver.resolveCapabilities(intentManifest.informationNeeds);

    let steps = [];
    const seenTools = new Set();
    for (const cap of resolvedCapabilities) {
      if (!seenTools.has(cap.toolName)) {
        seenTools.add(cap.toolName);
        steps.push({
          capability: cap.capability,
          toolName: cap.toolName,
          args: this._buildStepArgs(cap.toolName, query, context, cap.capability)
        });
      }
    }

    if (intentManifest.goal === 'workspace_task_summary' && !intentManifest.capabilities.needsGraph) {
      steps = steps.filter(s => s.capability !== 'graph:traverse');
    }

    const selectedStrategy = intentManifest.goal === 'workspace_task_summary'
      ? 'task_pipeline'
      : (intentManifest.capabilities.needsGraph
          ? (intentManifest.informationNeeds.includes('workspace_content_search') ? 'hybrid_graph_search' : 'graph_search')
          : 'semantic_search');

    const rejectedStrategies = [];
    if (!selectedStrategy.includes('graph') && !intentManifest.capabilities.needsGraph) {
      rejectedStrategies.push('graph_search');
    }
    if (selectedStrategy !== 'task_pipeline' && !intentManifest.capabilities.needsTasks) {
      rejectedStrategies.push('task_pipeline');
    }

    const plannerDecision = {
      intent: intentManifest.goal,
      confidence: intentManifest.confidence || 0.90,
      selectedStrategy,
      rejectedStrategies
    };

    const trace = context.trace || context.traceSession;
    if (trace && typeof trace.recordEvent === 'function') {
      trace.recordEvent('Planner', 'planner:plan_created', 'Execution Plan Created', {
        intent: intentManifest.goal,
        plannerDecision,
        manifest: intentManifest,
        stepsCount: steps.length,
        steps
      });
    }

    log.debug('Execution plan generated from capabilities', { intent: intentManifest.goal, plannerDecision, stepsCount: steps.length });
    return {
      intent: intentManifest.goal,
      manifest: intentManifest,
      plannerDecision,
      steps
    };
  }

  /**
   * Helper to construct appropriate arguments per tool
   * @private
   */
  _buildStepArgs(toolName, query, context, capability = '') {
    if (capability === 'tasks:extract' || toolName === 'get_tasks' || toolName === 'notes.extract_tasks') {
      return { status: 'open' };
    }
    if (capability === 'notes:read' || toolName === 'read_note' || toolName === 'notes.read') {
      return context.currentFile ? { filePath: context.currentFile } : {};
    }
    if (capability === 'graph:traverse' || toolName === 'explore_topic_graph') {
      return { topic: query, maxHops: 2 };
    }
    if (capability === 'timeline:recent' || toolName === 'recent_activity') {
      return { limit: 5 };
    }
    if (capability === 'notes:search' || toolName === 'search_notes' || toolName === 'search.notes' || toolName === 'semantic_search' || toolName === 'search.similar') {
      const normalized = normalizeSearchQuery(query);
      return { query: normalized || query, limit: 5 };
    }
    return { query, limit: 5 };
  }

  /**
   * Async LLM-driven plan generation using active provider structured outputs
   * @param {string} query
   * @param {object} [context={}]
   * @returns {Promise<{ intent: string, steps: Array<{ toolName: string, capability: string, args: object }> }>}
   */
  async createPlanAsync(query, context = {}) {
    if (this.agent?.llmRegistry) {
      try {
        const activeProvider = this.agent.llmRegistry.getActiveProvider();
        if (activeProvider) {
          const { generateObject } = await import('ai');
          const { z } = await import('zod');
          const model = await activeProvider.getModelInstance();
          const tools = this.capabilityResolver.getRegisteredTools();
          
          const toolListDesc = tools.map(t => `- ${t.name}: ${t.description}`).join('\n');
          const result = await generateObject({
            model,
            system: `You are Notely's AI Capability Execution Planner. Analyze the user request and build an ordered execution plan of semantic tool calls:\n${toolListDesc}`,
            prompt: `User Query: "${query}"`,
            schema: z.object({
              intent: z.string().describe('Abstract intent goal category'),
              steps: z.array(
                z.object({
                  capability: z.string().describe('Abstract capability contract name e.g. notes:search, tasks:extract, graph:traverse'),
                  toolName: z.string().describe('Name of registered tool endpoint to invoke'),
                  args: z.record(z.any()).optional().describe('Execution parameters')
                })
              ).describe('Ordered execution steps')
            })
          });

          if (result.object?.steps?.length > 0) {
            log.info(`LLM dynamic capability plan generated (${result.object.steps.length} steps) for: "${query.slice(0, 40)}"`);
            return {
              intent: result.object.intent || 'synthesize_workspace_notes',
              steps: result.object.steps
            };
          }
        }
      } catch (err) {
        log.warn('LLM dynamic planning fallback:', err.message);
      }
    }

    return this.createPlan(query, context);
  }
}

module.exports = Planner;
