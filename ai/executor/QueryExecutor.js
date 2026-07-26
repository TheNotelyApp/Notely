/**
 * QueryExecutor - Routes queries to AI models with multi-step tool execution
 */

const { getTools } = require('../tools');
const { normalizeTokensDetail } = require('../utils/aiUtils');

class QueryExecutor {
  constructor(agent) {
    this.agent = agent;
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
      const pipeline = this.agent.promptPipeline;
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

    // Allow callers (e.g. tool-call error retry) to force plain text generation.
    if (context._skipTools) {
      return { model, systemPrompt, messages, mergedTools: {}, llm, toolChoice: undefined, orchestratorTrace };
    }

    // Honor provider capability: if the provider cannot reliably execute tool
    // calls (schema validation failures, malformed JSON generation, etc.),
    // strip all tools from the request. Retrieved context from
    // ContextOrchestrator is already injected into systemPrompt above, so the
    // response stays grounded without needing live tool calls.
    // See getCapabilities().supportsToolCalling in the active provider.
    const providerCapabilities = typeof llm.getCapabilities === 'function' ? llm.getCapabilities() : {};
    let activeTools = providerCapabilities.supportsToolCalling === false ? {} : mergedTools;

    // When retrieved evidence is already provided programmatically by ContextOrchestrator,
    // disable live LLM tool calls to prevent empty re-invocations (e.g. search_notes({})).
    if (retrievedEvidence && typeof retrievedEvidence === 'string' && retrievedEvidence.trim().length > 0) {
      activeTools = {};
    }

    if (Object.keys(activeTools).length === 0) {
      toolChoice = undefined;
    }

    // Build messages array strictly (history + current user query)
    const historyMsgs = (Array.isArray(ceMessages) && ceMessages.length > 0)
      ? ceMessages
      : (Array.isArray(context.conversationMemory) ? context.conversationMemory : []);

    let messages = [];
    if (historyMsgs.length > 0) {
      messages = historyMsgs.map(m => ({
        role: m.role || 'user',
        content: m.content || ''
      }));
      if (messages[messages.length - 1]?.content !== query || messages[messages.length - 1]?.role !== 'user') {
        messages.push({ role: 'user', content: query });
      }
    } else {
      messages = [{ role: 'user', content: query }];
    }

    return { model, systemPrompt, messages, mergedTools: activeTools, llm, toolChoice, orchestratorTrace };
  }

  /**
   * Helper to format tool parameter schemas with jsonSchema() and cache execution
   */
  _wrapTools(tools, jsonSchema, traceSession) {
    if (!tools) return {};
    const wrapped = {};
    for (const [tName, tObj] of Object.entries(tools)) {
      if (!tObj) continue;
      let toolDef = tObj;
      if (typeof tObj.execute === 'function') {
        let rawParams = tObj.parameters || tObj.inputSchema;
        let schemaToUse = rawParams;
        if (rawParams && typeof rawParams === 'object' && !rawParams._def && !rawParams.jsonSchema) {
          schemaToUse = jsonSchema(rawParams);
        }
        toolDef = {
          ...tObj,
          parameters: schemaToUse,
          execute: async (args, options) => {
            if (traceSession && typeof traceSession.getCachedToolResult === 'function') {
              const cached = traceSession.getCachedToolResult(tName, args);
              if (cached !== undefined) return cached;
            }
            const res = await tObj.execute(args, options);
            if (traceSession && typeof traceSession.setCachedToolResult === 'function') {
              traceSession.setCachedToolResult(tName, args, res);
            }
            return res;
          }
        };
      }
      wrapped[tName] = toolDef;
    }
    return wrapped;
  }

  /**
   * Execute a query using Vercel AI SDK and the tool registry
   */
  async execute(query, context = {}) {
    try {
      const { generateText, jsonSchema } = await import('ai');
      const { model, systemPrompt, messages, mergedTools, llm, toolChoice, orchestratorTrace: _orchestratorTrace, _retrievedEvidence } = await this._prepareConfig(query, context);

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
      const cachedWrappedTools = this._wrapTools(mergedTools, jsonSchema, traceSession);

      // Honor provider capability: some providers cap parallel tool steps.
      // See getCapabilities().maxParallelToolCalls in the active provider.
      const capabilities = typeof llm.getCapabilities === 'function' ? llm.getCapabilities() : {};
      const maxSteps = capabilities.maxParallelToolCalls ?? 5;

      const result = await generateText({
        model,
        system: systemPrompt,
        messages,
        tools: cachedWrappedTools,
        toolChoice,
        maxSteps
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
            }
          }
        } catch { /* ignore summary error */ }
      }

      const trace = Array.isArray(_orchestratorTrace)
        ? _orchestratorTrace.map(t => ({
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

      for (const call of allToolCalls) {
        const toolRes = toolResultsContent.find(r => r.toolCallId === call.toolCallId);
        const rawOutput = toolRes ? (toolRes.output !== undefined ? toolRes.output : (toolRes.result !== undefined ? toolRes.result : null)) : null;
        const toolName = call.toolName || call.name || 'tool';

        trace.push({
          name: toolName,
          toolName: toolName,
          args: call.args || {},
          type: 'llm',
          toolType: 'dynamic-llm-call',
          callerType: 'llm',
          selectedBy: 'llm',
          intent: context.intent || context.plannerDecision?.intent || 'workspace_task_summary',
          startedAt: new Date().toISOString(),
          endedAt: new Date().toISOString(),
          durationMs: 0,
          output: rawOutput
        });
      }

      if (traceSession && typeof traceSession.recordEvent === 'function') {
        traceSession.recordEvent('LLM', 'llm_call', 'LLM Query Execution Completed', {
          tokensUsedTotal: tokensUsed,
          toolCallsCount: trace.length,
          input: query,
          output: textResult || ''
        });
      }

      const workspaceFiles = this.agent.documentService ? this.agent.documentService._collectMarkdownFiles(this.agent.workspaceRoot) : [];
      const SelfCorrectionEngine = require('./SelfCorrectionEngine');
      const validation = SelfCorrectionEngine.validateAndCorrect(textResult || '', { query, workspaceFiles, retrievedEvidence: context.retrievedEvidence || "" });
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

      const isProviderError = error.message.includes('API key') || error.message.includes('fetch') || error.message.includes('network') || error.message.includes('401') || error.message.includes('403') || error.message.includes('429') || error.message.includes('Provider') || error.message.includes('Groq') || error.message.includes('rate limit');
      if (isProviderError) {
        return {
          type: 'query',
          result: `⚠️ **AI Provider Error**\n\n${error.message}`,
          tokensUsed: 0,
          tokensDetail: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          trace: [],
          isError: true
        };
      }

      // Catch Vercel AI SDK / provider tool-calling failures.
      // e.g. Groq returns HTTP 400 when Llama generates a malformed function
      // call ("failed_generation":"<function=search_notes{}>"). The tool never
      // ran, but the systemPrompt already contains workspace context from
      // ContextOrchestrator — so retry without tools to get a real answer.
      const isToolCallError = (error.name && /AI_/.test(error.name)) ||
        error.message.includes('Failed to call a function') ||
        error.message.includes('failed_generation') ||
        error.message.includes('tool_call') ||
        error.message.includes('Invalid tool');
      if (isToolCallError) {
        console.warn('[QueryExecutor] Tool-call failed, retrying without tools:', error.message);
        try {
          const { generateText: generateTextNoTools } = await import('ai');
          const { model: retryModel, systemPrompt: retryPrompt, messages: retryMessages } =
            await this._prepareConfig(query, context);
          const retryResult = await generateTextNoTools({
            model: retryModel,
            system: retryPrompt,
            messages: retryMessages
            // No tools — forces plain text generation using context already in systemPrompt
          });
          if (retryResult.text) {
            return {
              type: 'query',
              result: retryResult.text,
              tokensUsed: retryResult.usage?.totalTokens || 0,
              tokensDetail: normalizeTokensDetail(retryResult.usage || {}),
              trace: [],
              toolCallFallback: true
            };
          }
        } catch (retryErr) {
          console.error('[QueryExecutor] Tool-call retry also failed:', retryErr.message);
        }
        return {
          type: 'query',
          result: 'I was unable to search your workspace right now. Please try again.',
          tokensUsed: 0,
          tokensDetail: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          trace: [],
          isError: true,
          error: error.message
        };
      }

      throw error;
    }
  }

  /**
   * Stream a query using Vercel AI SDK streamText.
   * Falls back to execute() if the active provider declares supportsStreaming: false.
   * See getCapabilities() in the active provider for provider-specific flags.
   */
  async stream(query, context = {}, onChunk, abortSignal) {
    try {
      const { streamText } = await import('ai');
      const { model, systemPrompt, messages, mergedTools, llm, toolChoice, orchestratorTrace, _retrievedEvidence } = await this._prepareConfig(query, context);

      // Check provider capability before attempting streaming.
      // Providers that set supportsStreaming: false (e.g. those with known
      // streaming tool-call reliability issues) are routed to execute() instead.
      const capabilities = typeof llm.getCapabilities === 'function' ? llm.getCapabilities() : {};
      if (capabilities.supportsStreaming === false) {
        return this.execute(query, context);
      }

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

      const { jsonSchema } = await import('ai');
      const traceSession = context.trace || context.traceSession;
      const wrappedStreamTools = this._wrapTools(mergedTools, jsonSchema, traceSession);

      // Honor provider capability: cap multi-step tool calls per provider limit.
      const maxSteps = capabilities.maxParallelToolCalls ?? 5;

      const result = await streamText({
        model,
        system: systemPrompt,
        messages,
        tools: wrappedStreamTools,
        toolChoice,
        maxSteps,
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
      if (!traceSession && context.trace) {
        traceSession = context.trace;
      }
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

      const workspaceFiles = this.agent.documentService ? this.agent.documentService._collectMarkdownFiles(this.agent.workspaceRoot) : [];
      const SelfCorrectionEngine = require('./SelfCorrectionEngine');
      const validation = SelfCorrectionEngine.validateAndCorrect(fullText || '', { query, workspaceFiles, retrievedEvidence: context.retrievedEvidence || "" });
      const finalResultText = validation.validatedText || fullText || "AI query completed with no text output.";

      return {
        type: 'query',
        result: finalResultText,
        tokensUsed,
        tokensDetail,
        provider: providerId,
        model: modelId,
        finishReason,
        trace,
        corrected: validation.corrected
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

      // Catch Vercel AI SDK tool-calling failures — retry without tools.
      // See execute() catch block above for full explanation.
      const isToolCallError = (error.name && /AI_/.test(error.name)) ||
        error.message.includes('Failed to call a function') ||
        error.message.includes('failed_generation') ||
        error.message.includes('tool_call') ||
        error.message.includes('Invalid tool');
      if (isToolCallError) {
        console.warn('[QueryExecutor] Stream tool-call failed, retrying without tools:', error.message);
        try {
          const retryResult = await this.execute(query, { ...context, _skipTools: true });
          if (retryResult.result && !retryResult.isError) {
            if (onChunk) onChunk({ type: 'replace', content: retryResult.result });
            return { ...retryResult, toolCallFallback: true };
          }
        } catch (retryErr) {
          const isRateLimit = /\b(429|rate limit|quota|exceeded)\b/i.test(retryErr.message);
          const safeMsg = isRateLimit
            ? `⚠️ **AI Provider Rate Limit**: Rate limit reached for active provider. Please wait a moment or switch provider in Settings.`
            : 'I was unable to search your workspace right now. Please try again.';
          if (onChunk) onChunk({ type: 'replace', content: safeMsg });
          return {
            type: 'query',
            result: safeMsg,
            tokensUsed: 0,
            trace: [],
            isError: true,
            error: retryErr.message
          };
        }
        const safeMsg = 'I was unable to search your workspace right now. Please try again.';
        if (onChunk) onChunk({ type: 'replace', content: safeMsg });
        return {
          type: 'query',
          result: safeMsg,
          tokensUsed: 0,
          trace: [],
          isError: true,
          error: error.message
        };
      }

      throw error;
    }
  }
}

module.exports = QueryExecutor;
