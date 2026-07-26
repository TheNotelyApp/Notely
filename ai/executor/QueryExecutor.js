/**
 * QueryExecutor - Routes queries to AI models with multi-step tool execution
 */

const { getTools } = require('../tools/ToolRegistry');
const PromptPipeline = require('../prompts/PromptPipeline');
const { normalizeTokensDetail } = require('../utils/aiUtils');

class QueryExecutor {
  constructor(agent) {
    this.agent = agent;
    this.promptPipeline = new PromptPipeline();
  }

  async _prepareConfig(query, context) {
    this.agent.lastQuery = query;
    const llm = this.agent.llmRegistry.getActiveProvider();
    const model = await llm.getModelInstance();
    const tools = await getTools(this.agent);

    let personaInput = context.persona || 'general';
    let contextEngineTools = {};
    let ceMessages = context.conversationMemory || context.messages || [];

    if (ceMessages.length === 0 && this.agent.contextEngine) {
      try {
        const conversationId = context.conversationId || 'default';
        const ceCtx = this.agent.contextEngine.buildContext({
          conversationId,
          activeNotePath: context.currentFile || null,
          activeNoteContent: context.activeNoteContent || null
        });
        if (ceCtx.persona && (ceCtx.persona.prompt || ceCtx.persona.systemInstructions)) {
          personaInput = {
            id: ceCtx.persona.id || ceCtx.personaId,
            name: ceCtx.persona.name || ceCtx.personaId,
            systemInstructions: ceCtx.persona.prompt || ceCtx.persona.systemInstructions
          };
        } else if (ceCtx.personaId) {
          personaInput = ceCtx.personaId;
        } else if (ceCtx.system) {
          personaInput = { systemInstructions: ceCtx.system };
        }
        contextEngineTools = ceCtx.tools || {};
        ceMessages = ceCtx.messages || [];
      } catch (ceErr) {
        console.warn('[QueryExecutor] ContextEngine.buildContext failed, falling back:', ceErr.message);
      }
    } else if (context.systemPrompt && !context.persona) {
      personaInput = { systemInstructions: context.systemPrompt };
    }

    // Multi-Tool Planning & Context Orchestration (Only run if not pre-orchestrated by AIFlow)
    let orchestratorTrace = context.orchestratorTrace || [];
    let retrievedEvidence = context.retrievedEvidence || '';
    let systemPrompt = context.systemPrompt || null;

    if (!systemPrompt) {
      if (this.agent.contextOrchestrator && !context.retrievedEvidence) {
        try {
          const orchRes = await this.agent.contextOrchestrator.orchestrate(query, context);
          if (orchRes.aggregatedContext) {
            retrievedEvidence = orchRes.aggregatedContext;
          }
          if (orchRes.trace) {
            orchestratorTrace = orchRes.trace;
          }
        } catch (orchErr) {
          console.warn('[QueryExecutor] ContextOrchestrator execution fallback:', orchErr.message);
          if (this.agent.workspaceBrain) {
            try {
              const facts = await this.agent.workspaceBrain.getWorkspaceFacts(query, context);
              if (this.agent.reasoningBrain) {
                const evidenceStr = this.agent.reasoningBrain.formatEvidenceContext(facts);
                if (evidenceStr) {
                  retrievedEvidence = evidenceStr;
                }
              }
            } catch { /* ignore fallback */ }
          }
        }
      }

      // Assemble final prompt using PromptPipeline
      const pipeline = this.agent.promptPipeline || this.promptPipeline;
      systemPrompt = pipeline.assemble({
        persona: personaInput,
        workspaceContext: {
          workspaceRoot: this.agent.workspaceRoot || 'none',
          activeNotePath: context.currentFile || 'none',
          activeNoteContent: context.activeNoteContent || null,
          documentCount: this.agent.documentService?.getAllDocuments()?.length || 0
        },
        retrievedEvidence: retrievedEvidence || (context.relatedDocuments ? context.relatedDocuments.map(d => d.path).join('\n') : null),
        uiContext: context.uiContext || null
      });
    }

    const mergedTools = {
      ...tools,
      ...contextEngineTools
    };

    let toolChoice = 'auto';

    // Build messages array strictly (history + current user query)
    let messages = [];
    if (Array.isArray(ceMessages) && ceMessages.length > 0) {
      messages = [...ceMessages];
      if (messages[messages.length - 1]?.content !== query || messages[messages.length - 1]?.role !== 'user') {
        messages.push({ role: 'user', content: query });
      }
    } else {
      messages = [{ role: 'user', content: query }];
    }

    return { model, systemPrompt, messages, mergedTools, llm, toolChoice, orchestratorTrace };
  }

  /**
   * Execute a query using Vercel AI SDK and the tool registry
   */
  async execute(query, context = {}) {
    try {
      const { generateText } = await import('ai');
      const { model, systemPrompt, messages, mergedTools, llm, toolChoice, orchestratorTrace: _orchestratorTrace } = await this._prepareConfig(query, context);

      if (this.agent && typeof this.agent.logPrompt === 'function') {
        this.agent.logPrompt(query, systemPrompt, {
          conversationId: context.conversationId || 'default',
          persona: context.persona || 'general',
          model: llm?.name || 'unknown',
          messages,
          uiContext: context.uiContext || null
        });
      }

      const traceSession = context.trace || context.traceSession;
      const cachedWrappedTools = {};
      if (mergedTools) {
        for (const [tName, tObj] of Object.entries(mergedTools)) {
          if (tObj && typeof tObj.execute === 'function') {
            cachedWrappedTools[tName] = {
              ...tObj,
              execute: async (args, options) => {
                if (traceSession && typeof traceSession.getCachedToolResult === 'function') {
                  const cached = traceSession.getCachedToolResult(tName, args);
                  if (cached !== undefined) {
                    return cached;
                  }
                }
                const res = await tObj.execute(args, options);
                if (traceSession && typeof traceSession.setCachedToolResult === 'function') {
                  traceSession.setCachedToolResult(tName, args, res);
                }
                return res;
              }
            };
          } else {
            cachedWrappedTools[tName] = tObj;
          }
        }
      }

      const result = await generateText({
        model,
        system: systemPrompt,
        messages,
        tools: cachedWrappedTools,
        toolChoice,
        maxSteps: 5 // Allow multi-step tool calls
      });

      const usageObj = result.usage || {};
      const tokensDetail = normalizeTokensDetail(usageObj);
      let tokensUsed = tokensDetail.totalTokens;

      if (llm.usageStats) {
        llm.usageStats.tokensUsedTotal += tokensUsed;
        llm.usageStats.requestsTotal += 1;
      }

      let textResult = result.text;

      // Extract all tool calls and their results from all steps
      const allToolCalls = [];
      const toolResultsContent = [];
      if (Array.isArray(result.steps)) {
        for (const step of result.steps) {
          if (step.toolCalls && step.toolCalls.length > 0) {
            allToolCalls.push(...step.toolCalls);
          }
          if (step.toolResults && step.toolResults.length > 0) {
            toolResultsContent.push(...step.toolResults);
          }
        }
      }

      // Surface error if response text was not generated after tool calls
      if (!textResult && allToolCalls.length > 0) {
        try {
          const nextMessages = [...messages];
          if (nextMessages.length > 0 && nextMessages[nextMessages.length - 1].role === 'user') {
            let toolContext = `Retrieved the following contextual information from the workspace notes:`;
            for (const tr of toolResultsContent) {
              const val = tr.output !== undefined ? tr.output : tr.result;
              toolContext += `\n\n- Information: ${typeof val === 'object' ? JSON.stringify(val) : val}`;
            }
            toolContext += `\n\nBased on these workspace details, please provide a structured natural language response to my query: "${query}".`;
            
            nextMessages[nextMessages.length - 1] = {
              role: 'user',
              content: toolContext
            };

            const summaryResult = await generateText({
              model,
              system: systemPrompt,
              messages: nextMessages
            });

            if (summaryResult.text) {
              textResult = summaryResult.text;
              const extraTokens = summaryResult.usage?.totalTokens || 0;
              tokensUsed += extraTokens;
              tokensDetail.totalTokens = tokensUsed;
              if (llm.usageStats) {
                llm.usageStats.tokensUsedTotal += extraTokens;
              }
            }
          }
        } catch (summaryErr) {
          console.error('[QueryExecutor] Provider error during response synthesis:', summaryErr.message);
          return {
            type: 'query',
            result: `⚠️ **AI Provider Error**\n\n${summaryErr.message}`,
            tokensUsed,
            tokensDetail,
            trace: [],
            isError: true
          };
        }
      }

      // Construct the trace array of LLM-driven executed tools
      const trace = [];
      const plannedToolNames = Array.isArray(context.plannedTools) ? context.plannedTools : (context.plannerDecision?.plannedTools || []);
      const intent = context.intent || context.plannerDecision?.intent || 'workspace_task_summary';

      if (result.steps) {
        for (const step of result.steps) {
          const toolCalls = step.toolCalls || [];
          const toolResults = step.toolResults || [];
          for (const call of toolCalls) {
            const toolRes = toolResults.find(r => r.toolCallId === call.toolCallId);
            const rawOutput = toolRes ? (toolRes.output !== undefined ? toolRes.output : (toolRes.result !== undefined ? toolRes.result : null)) : null;
            const toolName = call.toolName || call.name || 'tool';
            const toolArgs = call.args || call.parameters || {};
            const toolDur = toolRes?.durationMs || 0;

            const isPlanned = plannedToolNames.includes(toolName) || context.plannerDecision?.selectedStrategy === 'task_pipeline';
            const toolType = isPlanned ? 'planned-execution' : 'llm-driven';
            const callerType = isPlanned ? 'executor' : 'llm';
            const selectedBy = isPlanned ? 'planner' : 'llm';

            trace.push({
              name: toolName,
              toolName,
              args: toolArgs,
              type: 'llm',
              toolType,
              callerType,
              selectedBy,
              intent,
              startedAt: toolRes?.startedAt || new Date().toISOString(),
              endedAt: toolRes?.endedAt || new Date().toISOString(),
              durationMs: toolDur,
              output: rawOutput
            });

            if (traceSession && typeof traceSession.recordEvent === 'function') {
              traceSession.recordEvent('Tool', 'tool_execution', `Tool: ${toolName}`, {
                toolName,
                toolType,
                callerType,
                selectedBy,
                intent,
                args: toolArgs,
                input: toolArgs,
                output: rawOutput,
                durationMs: toolDur
              });
            }
          }
        }
      }

      if (traceSession && typeof traceSession.recordEvent === 'function') {
        traceSession.recordEvent('LLM', 'llm_execution', 'LLM Execution Completed', {
          tokensUsed,
          tokensDetail,
          toolCallsCount: trace.length,
          input: query,
          output: textResult || ''
        });
      }

      const workspaceFiles = this.agent.documentService ? this.agent.documentService._collectMarkdownFiles(this.agent.workspaceRoot) : [];
      const SelfCorrectionEngine = require('./SelfCorrectionEngine');
      const validation = SelfCorrectionEngine.validateAndCorrect(textResult || '', { query, workspaceFiles });
      const finalResultText = validation.validatedText || textResult || "AI query completed with no text output.";

      return {
        type: 'query',
        result: finalResultText,
        tokensUsed,
        tokensDetail,
        trace,
        corrected: validation.corrected
      };
    } catch (error) {
      console.error('[QueryExecutor] Execution failed:', error.message);
      const traceSession = context.trace || context.traceSession;
      if (traceSession && typeof traceSession.recordEvent === 'function') {
        traceSession.recordEvent('LLM', 'llm_fallback', 'LLM Provider Fallback Triggered', {
          llmFallbackTriggered: true,
          originalError: error.message
        });
      }

      // 1. Try Secondary Configured Provider or Local ONNX Model Fallback
      if (this.agent?.llmRegistry) {
        try {
          const providers = this.agent.llmRegistry.listProviders();
          const activeProviderName = this.agent.llmRegistry.activeProvider?.id?.toLowerCase() || '';
          const fallbackProviderName = providers.find(p => p !== activeProviderName && p !== 'embedding') || (this.agent.llmRegistry.hasProvider('local-onnx') ? 'local-onnx' : null);

          if (fallbackProviderName && !context._isFallbackAttempt) {
            console.log(`[QueryExecutor] Fallback triggered to secondary provider: ${fallbackProviderName}`);
            const fallbackProvider = await this.agent.llmRegistry.activateProvider(fallbackProviderName, {});
            const fallbackModel = await fallbackProvider.getModelInstance();

            const { generateText } = await import('ai');
            const { systemPrompt, messages, cachedWrappedTools, toolChoice } = await this._prepareConfig(query, { ...context, _isFallbackAttempt: true });

            const fbResult = await generateText({
              model: fallbackModel,
              system: systemPrompt,
              messages,
              tools: cachedWrappedTools,
              toolChoice,
              maxSteps: 3
            });

            if (fbResult.text) {
              return {
                type: 'query',
                result: fbResult.text,
                tokensUsed: fbResult.usage?.totalTokens || 0,
                tokensDetail: { promptTokens: fbResult.usage?.promptTokens || 0, completionTokens: fbResult.usage?.completionTokens || 0, totalTokens: fbResult.usage?.totalTokens || 0 },
                trace: [],
                llmFallbackTriggered: true
              };
            }
          }
        } catch (fbErr) {
          console.warn('[QueryExecutor] Secondary provider fallback failed:', fbErr.message);
        }
      }

      const isProviderError = error.message.includes('API key') || error.message.includes('fetch') || error.message.includes('network') || error.message.includes('401') || error.message.includes('403') || error.message.includes('429') || error.message.includes('Provider') || error.message.includes('Groq') || error.message.includes('rate limit');
      if (isProviderError) {
        return {
          type: 'query',
          result: `⚠️ **AI Provider Error**\n\n${error.message}`,
          tokensUsed: 0,
          tokensDetail: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          trace: [],
          llmFallbackTriggered: true,
          isError: true
        };
      }
      throw error;
    }
  }

  /**
   * Stream a query using Vercel AI SDK streamText
   */
  async stream(query, context = {}, onChunk, abortSignal) {
    try {
      const { streamText } = await import('ai');
      const { model, systemPrompt, messages, mergedTools, llm, toolChoice, orchestratorTrace } = await this._prepareConfig(query, context);

      if (this.agent && typeof this.agent.logPrompt === 'function') {
        this.agent.logPrompt(query, systemPrompt, {
          conversationId: context.conversationId || 'default',
          persona: context.persona || 'general',
          model: llm?.name || 'unknown',
          messages,
          uiContext: context.uiContext || null,
          streaming: true
        });
      }

      const result = await streamText({
        model,
        system: systemPrompt,
        messages,
        tools: mergedTools,
        toolChoice,
        maxSteps: 5,
        abortSignal
      });

      let fullText = '';
      try {
        for await (const part of result.fullStream) {
          if (part.type === 'text-delta') {
            const delta = part.textDelta !== undefined ? part.textDelta : (part.text || '');
            fullText += delta;
            if (onChunk) {
              onChunk({ type: 'text', content: delta });
            }
          }
        }
      } catch (streamIterErr) {
        console.warn('[QueryExecutor] Error iterating fullStream:', streamIterErr.message);
        throw streamIterErr;
      }

      if (!fullText) {
        console.log('[QueryExecutor] Stream returned empty text. Falling back to non-streaming execution...');
        return this.execute(query, context);
      }

      const usage = await result.usage;
      const tokensDetail = normalizeTokensDetail(usage || {});
      const tokensUsed = tokensDetail.totalTokens;

      if (llm.usageStats) {
        llm.usageStats.tokensUsedTotal += tokensUsed;
        llm.usageStats.requestsTotal += 1;
      }

      const steps = await result.steps;
      const traceSession = context.trace;
      const trace = Array.isArray(orchestratorTrace)
        ? orchestratorTrace.map(t => ({
            name: t.name || t.toolName || 'tool',
            toolName: t.toolName || t.name || 'tool',
            args: t.args || t.parameters || {},
            type: t.type || 'programmatic',
            toolType: t.toolType || 'planned-execution',
            callerType: t.callerType || 'executor',
            selectedBy: t.selectedBy || 'planner',
            intent: t.intent || context.intent || context.plannerDecision?.intent || 'workspace_task_summary',
            startedAt: t.startedAt || new Date().toISOString(),
            endedAt: t.endedAt || new Date().toISOString(),
            durationMs: t.durationMs || 0,
            output: t.output !== undefined ? t.output : (t.result !== undefined ? t.result : null)
          }))
        : [];

      const plannedToolNames = Array.isArray(context.plannedTools) ? context.plannedTools : (context.plannerDecision?.plannedTools || []);
      const intent = context.intent || context.plannerDecision?.intent || 'workspace_task_summary';

      if (steps) {
        for (const step of steps) {
          const toolCalls = step.toolCalls || [];
          const toolResults = step.toolResults || [];
          for (const call of toolCalls) {
            const toolRes = toolResults.find(r => r.toolCallId === call.toolCallId);
            const rawOutput = toolRes ? (toolRes.output !== undefined ? toolRes.output : (toolRes.result !== undefined ? toolRes.result : null)) : null;
            const toolName = call.toolName || call.name || 'tool';
            const toolArgs = call.args || call.parameters || {};
            const toolDur = toolRes?.durationMs || 0;

            const isPlanned = plannedToolNames.includes(toolName) || context.plannerDecision?.selectedStrategy === 'task_pipeline';
            const toolType = isPlanned ? 'planned-execution' : 'llm-driven';
            const callerType = isPlanned ? 'executor' : 'llm';
            const selectedBy = isPlanned ? 'planner' : 'llm';

            trace.push({
              name: toolName,
              toolName,
              args: toolArgs,
              type: 'llm',
              toolType,
              callerType,
              selectedBy,
              intent,
              startedAt: toolRes?.startedAt || new Date().toISOString(),
              endedAt: toolRes?.endedAt || new Date().toISOString(),
              durationMs: toolDur,
              output: rawOutput
            });

            if (traceSession && typeof traceSession.recordEvent === 'function') {
              traceSession.recordEvent('Tool', 'tool_execution', `Tool: ${toolName}`, {
                toolName,
                toolType,
                callerType,
                selectedBy,
                intent,
                args: toolArgs,
                input: toolArgs,
                output: rawOutput,
                durationMs: toolDur
              });
            }
          }
        }
      }

      const providerId = llm.providerId || llm.name || 'unknown';
      const modelId = llm.modelId || 'unknown';
      const finishReason = (await result.finishReason) || 'stop';

      if (traceSession && typeof traceSession.recordEvent === 'function') {
        traceSession.recordEvent('LLM', 'llm_execution', 'Streaming LLM Execution Completed', {
          tokensUsed,
          tokensDetail,
          provider: providerId,
          model: modelId,
          finishReason,
          toolCallsCount: trace.length,
          input: query,
          output: fullText
        });
      }

      return {
        type: 'query',
        result: fullText,
        tokensUsed,
        tokensDetail,
        provider: providerId,
        model: modelId,
        finishReason,
        trace
      };
    } catch (error) {
      if (error.name === 'AbortError' || abortSignal?.aborted) {
        console.log('[QueryExecutor] Stream execution aborted by user.');
        return { type: 'aborted', result: 'Generation stopped.' };
      }
      console.error('[QueryExecutor] Stream execution failed:', error.message);
      const isProviderError = error.message.includes('API key') || error.message.includes('fetch') || error.message.includes('network') || error.message.includes('401') || error.message.includes('403') || error.message.includes('429') || error.message.includes('Provider') || error.message.includes('Groq') || error.message.includes('rate limit');
      if (isProviderError) {
        const errorMsg = `⚠️ **AI Provider Error**\n\n${error.message}`;
        if (onChunk) {
          onChunk({ type: 'text', content: errorMsg });
        }
        return {
          type: 'query',
          result: errorMsg,
          tokensUsed: 0,
          trace: [],
          llmFallbackTriggered: true,
          isError: true
        };
      }
      throw error;
    }
  }
}

module.exports = QueryExecutor;
