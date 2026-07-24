/**
 * Planner - Layer 3 of Decoupled Hybrid Planning Architecture
 * Responsibility: Execution DAG Planning
 *
 * Takes an IntentManifest (Intent Detection) and Resolved Capabilities (Capability Resolution)
 * to build structured, ordered execution plan DAGs for tool orchestration.
 */

const IntentAnalyzer = require('./IntentAnalyzer');
const CapabilityResolver = require('./CapabilityResolver');
const { createLogger } = require('./logger');
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

    const steps = resolvedCapabilities.map(cap => ({
      capability: cap.capability,
      toolName: cap.toolName,
      args: { query, limit: 5, notePath: query, status: 'open', ...context }
    }));

    log.debug('Execution plan generated from capabilities', { intent: intentManifest.goal, stepsCount: steps.length });
    return {
      intent: intentManifest.goal,
      manifest: intentManifest,
      steps
    };
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
