/**
 * ContextOrchestrator - Dynamic multi-tool planning, parallel retrieval & context aggregation engine
 *
 * Implements the complete multi-tool planning workflow:
 * 1. Intent understanding & internal plan generation (never exposed to user)
 * 2. Parallel retrieval execution across candidate tools
 * 3. Dynamic tool output chaining
 * 4. Context aggregation (deduplication, ranking, source attribution)
 * 5. Confidence evaluation & iterative retrieval loop until confidence target is satisfied
 * 6. Structured evidence handoff to Reasoning layer
 */

const Planner = require('./Planner');
const { createLogger } = require('../core/logger');
const log = createLogger('ContextOrchestrator');

class ContextOrchestrator {
  constructor(agent) {
    this.agent = agent;
    this.planner = new Planner(agent);
  }

  /**
   * Execute multi-tool planning & context aggregation lifecycle
   * @param {string} query
   * @param {object} context - { activeNotePath, userHistory }
   * @param {object} options - { targetConfidence: 0.70, maxIterations: 3 }
   * @returns {Promise<{ evidence: Array, aggregatedContext: string, confidence: number, iterations: number }>}
   */
  async orchestrate(query, context = {}, options = {}) {
    const targetConfidence = options.targetConfidence || 0.70;
    const maxIterations = options.maxIterations || 3;
    const traceSession = context.trace || options.trace;

    // 1. Understand Intent & Build Internal Execution Plan via Decoupled Planning Architecture
    const plan = await this.planner.createPlanAsync(query, context);
    log.debug('Internal execution plan generated', { intent: plan.intent, stepsCount: plan.steps.length });

    const isTaskQuery = plan.intent === 'workspace_task_summary' || plan.manifest?.capabilities?.needsTasks;

    if (traceSession && typeof traceSession.recordEvent === 'function') {
      traceSession.recordEvent('Planner', 'intent_analyzed', 'Intent Planning Completed', {
        intent: plan.intent,
        plannerDecision: plan.plannerDecision || {
          intent: plan.intent,
          confidence: plan.manifest?.confidence || 0.90,
          selectedStrategy: isTaskQuery ? 'task_pipeline' : 'semantic_search',
          rejectedStrategies: isTaskQuery ? ['graph_search'] : []
        },
        stepsCount: plan.steps?.length || 0,
        steps: plan.steps || []
      });
    }

    // Fast-path bypass for zero-retrieval queries (General Q&A, Coding, Writing, Brainstorming)
    if (plan.manifest && plan.manifest.requiresRetrieval === false) {
      log.info(`Zero retrieval required for query category: ${plan.manifest.category}. Bypassing pre-retrieval.`);
      return {
        evidence: [],
        aggregatedContext: '',
        confidence: 1.0,
        iterations: 0,
        trace: [],
        plannerDecision: plan.plannerDecision,
        retrievalQuality: [],
        category: plan.manifest.category
      };
    }

    let collectedEvidence = [];
    let executionTrace = [];
    let iterations = 0;
    let confidence = 0.0;

    // Active workspace tools runner
    const SemanticTools = require('../tools/SemanticTools');

    // 2. Multi-Tool Parallel & Chained Execution Loop
    while (iterations < maxIterations && confidence < targetConfidence) {
      iterations++;
      log.debug(`Executing retrieval iteration ${iterations}/${maxIterations}...`);

      const currentSteps = iterations === 1 ? plan.steps : this._deriveNextSteps(query, collectedEvidence, isTaskQuery);
      if (currentSteps.length === 0) break;

      // Parallel tool execution for independent tools
      const toolPromises = currentSteps.map(step => {
        return (async () => {
          const tStart = Date.now();
          try {
            // Check request-scoped cache first
            if (traceSession && typeof traceSession.getCachedToolResult === 'function') {
              const cached = traceSession.getCachedToolResult(step.toolName, step.args);
              if (cached !== undefined) {
                log.debug(`[ContextOrchestrator] Cache hit for tool: ${step.toolName}`);
                executionTrace.push({
                  name: step.toolName,
                  args: step.args,
                  type: 'programmatic',
                  durationMs: 0,
                  cacheHit: true,
                  output: typeof cached === 'object' ? JSON.stringify(cached).slice(0, 500) : String(cached).slice(0, 500)
                });
                return { toolName: step.toolName, result: cached, error: null, cacheHit: true };
              }
            }

            const runner = SemanticTools.getToolRunner(step.toolName, this.agent);
            if (runner) {
              const res = await runner(step.args);
              const tDur = Date.now() - tStart;
              const outputStr = typeof res === 'object' ? JSON.stringify(res).slice(0, 500) : String(res).slice(0, 500);

              if (traceSession && typeof traceSession.setCachedToolResult === 'function') {
                traceSession.setCachedToolResult(step.toolName, step.args, res);
              }

              executionTrace.push({
                name: step.toolName,
                args: step.args,
                type: 'programmatic',
                durationMs: tDur,
                cacheHit: false,
                output: outputStr
              });

              if (traceSession && typeof traceSession.recordEvent === 'function') {
                traceSession.recordEvent('Tool', 'tool_execution', `Tool: ${step.toolName}`, {
                  toolName: step.toolName,
                  toolType: 'pre-retrieval',
                  args: step.args,
                  input: step.args,
                  output: outputStr,
                  durationMs: tDur,
                  callerType: 'system'
                });
              }

              return { toolName: step.toolName, result: res, error: null };
            }
          } catch (err) {
            const tDur = Date.now() - tStart;
            executionTrace.push({
              name: step.toolName,
              args: step.args,
              type: 'programmatic',
              durationMs: tDur,
              output: `Error: ${err.message}`
            });

            if (traceSession && typeof traceSession.recordEvent === 'function') {
              traceSession.recordError('Tool', `Tool Error: ${step.toolName}`, err.message, {
                toolName: step.toolName,
                args: step.args
              });
            }

            return { toolName: step.toolName, result: null, error: err.message };
          }
          return null;
        })();
      });

      const results = await Promise.allSettled(toolPromises);

      // Ingest tool results into evidence collection
      for (const item of results) {
        if (item.status === 'fulfilled' && item.value && item.value.result) {
          const rawRes = item.value.result;
          this._ingestEvidence(collectedEvidence, item.value.toolName, rawRes);
        }
      }

      // Explicit task query fallback sequence when get_tasks returns empty
      if (isTaskQuery && collectedEvidence.length === 0 && iterations === 1) {
        // 1. Search markdown task syntax (- [ ], TODO, FIXME, status fields)
        try {
          const runner = SemanticTools.getToolRunner('search_notes', this.agent) || SemanticTools.getToolRunner('search.notes', this.agent);
          if (runner) {
            const syntaxMatches = await runner({ query: 'TODO FIXME status "- [ ]"' });
            if (syntaxMatches && Array.isArray(syntaxMatches) && syntaxMatches.length > 0) {
              this._ingestEvidence(collectedEvidence, 'markdown_task_parser', syntaxMatches);
              executionTrace.push({
                name: 'markdown_task_parser',
                args: { query: 'TODO FIXME status "- [ ]"' },
                type: 'programmatic',
                output: `Found ${syntaxMatches.length} markdown task matches`
              });
            }
          }
        } catch { /* ignore fallback error */ }

        // 2. Search recent workspace activity
        if (collectedEvidence.length === 0) {
          try {
            const runner = SemanticTools.getToolRunner('recent_activity', this.agent) || SemanticTools.getToolRunner('workspace.recent_activity', this.agent);
            if (runner) {
              const recentActivity = await runner({ limit: 5 });
              if (recentActivity && Array.isArray(recentActivity) && recentActivity.length > 0) {
                this._ingestEvidence(collectedEvidence, 'recent_activity', recentActivity);
                executionTrace.push({
                  name: 'recent_activity',
                  args: { limit: 5 },
                  type: 'programmatic',
                  output: `Retrieved ${recentActivity.length} recent activity items`
                });
              }
            }
          } catch { /* ignore fallback error */ }
        }
      }

      // Proactive WorkspaceBrain & Graph evidence ingestion (only for non-task queries when evidence is sparse)
      if (!isTaskQuery && this.agent?.workspaceBrain && collectedEvidence.length === 0 && iterations === 1) {
        try {
          const wbFacts = await this.agent.workspaceBrain.getWorkspaceFacts(query, context.activeNotePath);
          const factsArray = Array.isArray(wbFacts) ? wbFacts : [];
          executionTrace.push({
            name: 'workspace_graph_retrieval',
            args: { query, activeNotePath: context.activeNotePath || null },
            type: 'programmatic',
            output: `Retrieved ${factsArray.length} workspace facts & graph relations`
          });
          for (const fact of factsArray) {
            collectedEvidence.push({
              source: fact.source || 'WorkspaceBrain',
              filePath: fact.filePath || '',
              content: fact.content || '',
              score: fact.score || 0.8
            });
          }
        } catch { /* ignore fallback */ }
      }

      // 3. Aggregate & Measure Confidence
      const aggregated = this.aggregateContext(collectedEvidence, { isTaskQuery });
      confidence = aggregated.confidence;
      log.debug(`Iteration ${iterations} complete. Measured confidence: ${confidence.toFixed(2)}`);

      if (confidence >= targetConfidence || isTaskQuery) {
        log.info(`Target confidence ${targetConfidence} achieved in ${iterations} iteration(s).`);
        break;
      }
    }

    // Final consolidation
    const finalAggregated = this.aggregateContext(collectedEvidence, { isTaskQuery });

    if (traceSession && typeof traceSession.recordEvent === 'function') {
      traceSession.recordEvent('Retrieval', 'retrieval_completed', 'Hybrid Context Aggregated', {
        evidenceCount: finalAggregated.items.length,
        confidence: finalAggregated.confidence,
        plannerDecision: plan.plannerDecision,
        retrievalQuality: finalAggregated.retrievalQuality,
        iterations
      });
    }

    return {
      evidence: finalAggregated.items,
      aggregatedContext: finalAggregated.contextString,
      confidence: finalAggregated.confidence,
      plannerDecision: plan.plannerDecision,
      retrievalQuality: finalAggregated.retrievalQuality,
      iterations,
      trace: executionTrace
    };
  }

  /**
   * Derive subsequent retrieval steps if initial confidence is insufficient
   * @private
   */
  _deriveNextSteps(query, existingEvidence, isTaskQuery = false) {
    if (isTaskQuery) {
      return []; // Do NOT invoke graph exploration or generic search for task queries
    }
    const steps = [];

    // If existing evidence contains linked notes, trigger graph expansion
    const linkedPaths = existingEvidence
      .map(e => e.filePath)
      .filter(Boolean);

    if (linkedPaths.length > 0) {
      steps.push({
        toolName: 'explore_topic_graph',
        args: { topic: query, notePath: linkedPaths[0], maxHops: 2 }
      });
    } else {
      steps.push({
        toolName: 'find_discussions',
        args: { topic: query }
      });
    }

    return steps;
  }

  /**
   * Ingest raw tool outputs into evidence collection
   * @private
   */
  _ingestEvidence(targetArray, toolName, result) {
    if (typeof result === 'string') {
      targetArray.push({ toolName, content: result, score: 0.75 });
    } else if (Array.isArray(result)) {
      for (const item of result) {
        if (typeof item === 'string') {
          targetArray.push({ toolName, content: item, score: 0.8 });
        } else if (typeof item === 'object' && item !== null) {
          const filePath = item.filePath || item.path || item.note_path || item.file || '';
          let text = item.snippet || item.content || item.text || item.evidence;
          if (!text && Array.isArray(item.graph_triples) && item.graph_triples.length > 0) {
            text = item.graph_triples.join('; ');
          }
          if (!text) {
            text = JSON.stringify(item);
          }
          targetArray.push({
            toolName,
            filePath,
            content: text,
            score: item.score !== undefined ? item.score : 0.8
          });
        }
      }
    } else if (typeof result === 'object' && result !== null) {
      const filePath = result.filePath || result.path || result.note_path || '';
      const text = result.snippet || result.content || result.text || JSON.stringify(result);
      targetArray.push({
        toolName,
        filePath,
        content: text,
        score: result.score !== undefined ? result.score : 0.7
      });
    }
  }

  /**
   * Aggregate, deduplicate, rank, apply relevance filtering (min score 0.25), and compute quality metrics
   * @param {Array} evidenceItems
   * @param {object} [options={}]
   * @returns {{ items: Array, contextString: string, confidence: number, retrievalQuality: Array }}
   */
  aggregateContext(evidenceItems, options = {}) {
    const isTaskQuery = options.isTaskQuery || false;
    const minRelevance = options.minRelevance || 0.25;

    if (!Array.isArray(evidenceItems) || evidenceItems.length === 0) {
      return {
        items: [],
        contextString: isTaskQuery ? 'No tasks found in your workspace.' : '',
        confidence: isTaskQuery ? 0.90 : 0.0,
        retrievalQuality: []
      };
    }

    const uniqueMap = new Map();
    const retrievalQuality = [];

    for (const item of evidenceItems) {
      const contentStr = String(item.content || '').trim();
      if (!contentStr) continue;

      const score = item.score !== undefined ? item.score : 0.8;
      const sourceType = item.toolName || item.source || item.filePath || 'Workspace Evidence';

      if (score < minRelevance) {
        retrievalQuality.push({
          source: sourceType,
          sourceType,
          similarityScore: score,
          score,
          accepted: false,
          rejectedReason: 'below relevance threshold',
          reason: 'below relevance threshold'
        });
        continue;
      }

      retrievalQuality.push({
        source: sourceType,
        sourceType,
        similarityScore: score,
        score,
        accepted: true
      });

      const key = `${item.filePath || ''}:${contentStr.slice(0, 100)}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, item);
      }
    }

    const deduplicated = Array.from(uniqueMap.values());
    deduplicated.sort((a, b) => (b.score || 0) - (a.score || 0));

    if (deduplicated.length === 0) {
      return {
        items: [],
        contextString: isTaskQuery ? 'No tasks found in your workspace.' : '',
        confidence: isTaskQuery ? 0.90 : 0.0,
        retrievalQuality
      };
    }

    const topScore = deduplicated.length > 0 ? (deduplicated[0].score || 0.8) : 0.0;
    const avgScore = deduplicated.reduce((sum, el) => sum + (el.score || 0.5), 0) / deduplicated.length;
    const groundedCount = deduplicated.filter(el => el.filePath && el.filePath !== 'none').length;
    const groundingRatio = deduplicated.length > 0 ? groundedCount / deduplicated.length : 0.0;
    
    const confidence = Math.min(1.0, (topScore * 0.4) + (avgScore * 0.3) + (groundingRatio * 0.3));

    let contextString = `[CURATED WORKSPACE EVIDENCE payload - ${deduplicated.length} item(s)]\n\n`;
    deduplicated.slice(0, 10).forEach((el, idx) => {
      const fileLabel = el.filePath ? ` [File: ${el.filePath}]` : '';
      contextString += `--- Evidence #${idx + 1}${fileLabel} ---\n${el.content}\n\n`;
    });

    return {
      items: deduplicated,
      contextString,
      confidence,
      retrievalQuality
    };
  }
}

module.exports = ContextOrchestrator;
