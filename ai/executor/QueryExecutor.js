/**
 * QueryExecutor - Routes queries to AI models with multi-step tool execution
 */

const { getTools } = require('../tools/ToolRegistry');
const PromptPipeline = require('../prompts/PromptPipeline');

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
    let ceMessages = [];

    if (this.agent.contextEngine) {
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
    } else if (context.systemPrompt) {
      personaInput = { systemInstructions: context.systemPrompt };
    }

    // Multi-Tool Planning & Context Orchestration
    let orchestratorTrace = [];
    let retrievedEvidence = '';
    if (this.agent.contextOrchestrator) {
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
    const systemPrompt = pipeline.assemble({
      persona: personaInput,
      workspaceContext: {
        workspaceRoot: this.agent.workspaceRoot || 'none',
        activeNotePath: context.currentFile || 'none',
        activeNoteContent: context.activeNoteContent || null,
        documentCount: this.agent.documentService?.getAllDocuments()?.length || 0
      },
      conversationMemory: ceMessages.length > 0 ? ceMessages : null,
      retrievedEvidence: retrievedEvidence || (context.relatedDocuments ? context.relatedDocuments.map(d => d.path).join('\n') : null),
      uiContext: context.uiContext || null
    });

    const mergedTools = {
      ...tools,
      ...contextEngineTools
    };

    let toolChoice = 'auto';

    // Build messages array
    let messages = [];
    if (ceMessages.length > 0) {
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
      const { model, systemPrompt, messages, mergedTools, llm, toolChoice, orchestratorTrace } = await this._prepareConfig(query, context);

      if (this.agent && typeof this.agent.logPrompt === 'function') {
        this.agent.logPrompt(query, systemPrompt, {
          conversationId: context.conversationId || 'default',
          persona: context.persona || 'general',
          model: llm?.name || 'unknown',
          messages,
          uiContext: context.uiContext || null
        });
      }

      const result = await generateText({
        model,
        system: systemPrompt,
        messages,
        tools: mergedTools,
        toolChoice,
        maxSteps: 5 // Allow multi-step tool calls
      });

      const usageObj = result.usage || {};
      const promptTokens = usageObj.promptTokens || usageObj.inputTokens || 0;
      const completionTokens = usageObj.completionTokens || usageObj.outputTokens || 0;
      let tokensUsed = usageObj.totalTokens || (promptTokens + completionTokens);
      const tokensDetail = { promptTokens, completionTokens, totalTokens: tokensUsed };

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

      // Construct the trace array of executed tools and outputs with timestamps
      const trace = Array.isArray(orchestratorTrace)
        ? orchestratorTrace.map(t => ({
            name: t.name || t.toolName || 'tool',
            args: t.args || t.parameters || {},
            type: t.type || 'programmatic',
            startedAt: t.startedAt || new Date().toISOString(),
            endedAt: t.endedAt || new Date().toISOString(),
            durationMs: t.durationMs || 0,
            output: t.output !== undefined ? t.output : (t.result !== undefined ? t.result : null)
          }))
        : [];

      if (result.steps) {
        for (const step of result.steps) {
          const toolCalls = step.toolCalls || [];
          const toolResults = step.toolResults || [];
          for (const call of toolCalls) {
            const toolRes = toolResults.find(r => r.toolCallId === call.toolCallId);
            const rawOutput = toolRes ? (toolRes.output !== undefined ? toolRes.output : (toolRes.result !== undefined ? toolRes.result : null)) : null;
            trace.push({
              name: call.toolName || call.name || 'tool',
              args: call.args || call.parameters || {},
              type: 'llm',
              startedAt: toolRes?.startedAt || new Date().toISOString(),
              endedAt: toolRes?.endedAt || new Date().toISOString(),
              durationMs: toolRes?.durationMs || 0,
              output: rawOutput
            });
          }
        }
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
      }

      if (!fullText) {
        console.log('[QueryExecutor] Stream returned empty text. Falling back to non-streaming execution...');
        return this.execute(query, context);
      }

      const usage = await result.usage;
      const promptTokens = usage?.promptTokens || usage?.inputTokens || 0;
      const completionTokens = usage?.completionTokens || usage?.outputTokens || 0;
      const tokensUsed = usage?.totalTokens || (promptTokens + completionTokens);
      const tokensDetail = { promptTokens, completionTokens, totalTokens: tokensUsed };

      if (llm.usageStats) {
        llm.usageStats.tokensUsedTotal += tokensUsed;
        llm.usageStats.requestsTotal += 1;
      }

      const steps = await result.steps;
      const trace = Array.isArray(orchestratorTrace)
        ? orchestratorTrace.map(t => ({
            name: t.name || t.toolName || 'tool',
            args: t.args || t.parameters || {},
            type: t.type || 'programmatic',
            startedAt: t.startedAt || new Date().toISOString(),
            endedAt: t.endedAt || new Date().toISOString(),
            durationMs: t.durationMs || 0,
            output: t.output !== undefined ? t.output : (t.result !== undefined ? t.result : null)
          }))
        : [];

      if (steps) {
        for (const step of steps) {
          const toolCalls = step.toolCalls || [];
          const toolResults = step.toolResults || [];
          for (const call of toolCalls) {
            const toolRes = toolResults.find(r => r.toolCallId === call.toolCallId);
            const rawOutput = toolRes ? (toolRes.output !== undefined ? toolRes.output : (toolRes.result !== undefined ? toolRes.result : null)) : null;
            trace.push({
              name: call.toolName || call.name || 'tool',
              args: call.args || call.parameters || {},
              type: 'llm',
              startedAt: toolRes?.startedAt || new Date().toISOString(),
              endedAt: toolRes?.endedAt || new Date().toISOString(),
              durationMs: toolRes?.durationMs || 0,
              output: rawOutput
            });
          }
        }
      }

      return {
        type: 'query',
        result: fullText,
        tokensUsed,
        tokensDetail,
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
          isError: true
        };
      }
      throw error;
    }
  }
}

module.exports = QueryExecutor;
