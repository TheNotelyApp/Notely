/**
 * AIFlow - Master end-to-end flow orchestrator for Notely AI
 *
 * Coordinates the complete 5-stage AI execution pipeline:
 *  - Stage 1: Context & Persona Resolution (memory + personas)
 *  - Stage 2: Intent Planning & Hybrid Retrieval (planner + graph + embeddings)
 *  - Stage 3: System Prompt Assembly & Harness Audit (prompts + testing)
 *  - Stage 4: Runtime Dynamic Strategy Execution & Tools (executor + tools + grounding + formatter)
 *  - Stage 5: Memory Persistence & Telemetry Logging (memory + logs)
 */

const { randomUUID } = require('crypto');
const { createLogger } = require('./logger');
const { buildEvents, buildEventsFromTrace, createTraceSession, recordTelemetry, calculatePipelineHealth } = require('../telemetry');
const compaction = require('../compaction');
const { createPromptPipeline } = require('../prompts');
const { PromptTester } = require('../testing');
const { checkTaskSummaryOptimization } = require('../formatter');
const { verifyCitations, formatLineNumberLinks } = require('../grounding');

const log = createLogger('AIFlow');

class AIFlow {
  constructor(agent) {
    this.agent = agent;
  }

  /**
   * Execute non-streaming query through the master 5-stage pipeline
   */
  async execute(userQuery, context = {}) {
    const startTime = Date.now();
    const startIso = new Date(startTime).toISOString();
    const flowId = randomUUID();
    const stages = [];
    let conversationId = context.conversationId || context.conversation_id || 'default';

    const traceSession = createTraceSession({
      workspaceId: this.agent?.workspaceRoot || 'default',
      conversationId,
      traceId: `trc_${flowId.replace(/-/g, '').slice(0, 16)}`,
      query: userQuery
    });

    try {
      log.info(`[Flow:${flowId}] Starting master execution flow for query: "${String(userQuery).slice(0, 60)}..."`);

      // Stage 1: Context & Persona Resolution
      const s1 = this._stage1_ContextResolution(userQuery, context, conversationId, traceSession, stages);
      conversationId = s1.conversationId;

      // Stage 2: Intent Planning & Hybrid Retrieval
      const s2 = await this._stage2_IntentAndRetrieval(userQuery, context, s1.activeNotePath, traceSession, stages);

      // Stage 3: System Prompt Assembly & Harness Audit
      const s3 = this._stage3_PromptAssembly(userQuery, context, s1, s2, traceSession, stages);

      // Stage 4: Execution Strategy & Grounding
      const s4Start = Date.now();
      const s4SpanId = traceSession.startSpan('Runtime Strategy Execution & Grounding', 'LLM', traceSession.rootSpanId, { component: 'QueryExecutor' });
      const queryContext = {
        ...context,
        conversationId,
        persona: s3.personaInput,
        activeNoteContent: s1.activeNoteContent,
        systemPrompt: s3.systemPrompt,
        conversationMemory: s1.historyMessages,
        orchestratorTrace: s2.orchestratorTrace,
        retrievedEvidence: s2.retrievedEvidence,
        trace: traceSession
      };

      let result = await this._checkTaskSummaryOptimization(userQuery, s2.orchRes, flowId);

      const estimatedPromptTokens = Math.ceil(((s3.systemPrompt || '').length + (userQuery || '').length) / 4);

      if (!result) {
        try {
          result = await this.agent.queryExecutor.execute(userQuery, queryContext);
        } catch (execErr) {
          log.warn(`[Flow:${flowId}] QueryExecutor error:`, execErr.message);
          const activeProv = this.agent?.llmRegistry?.getActiveProvider ? this.agent.llmRegistry.getActiveProvider() : null;
          const activeProvId = activeProv?.providerId || activeProv?.name || 'unknown';
          const activeModelId = activeProv?.modelId || activeProv?.config?.model || 'unknown-model';
          const safeErrMsg = (() => {
            const msg = execErr.message || '';
            const isProviderErr = msg.includes('API key') || msg.includes('401') || msg.includes('429') || msg.includes('rate limit') || msg.includes('fetch') || msg.includes('network') || msg.includes('Groq') || msg.includes('Provider');
            if (isProviderErr) return `⚠️ **AI Provider Error**\n\n${msg}`;
            return 'An error occurred while processing your request. Please try again.';
          })();
          result = {
            type: 'query',
            result: safeErrMsg,
            isError: true,
            error: execErr.message || String(execErr),
            tokensUsed: estimatedPromptTokens,
            tokensDetail: { inputTokens: estimatedPromptTokens, outputTokens: 0, toolTokens: 0, totalTokens: estimatedPromptTokens },
            strategy: 'DirectExecutorStrategy',
            provider: activeProvId,
            model: activeModelId,
            finishReason: 'error'
          };
        }
      }

      let groundingInfo = { verifiedCitations: 0, brokenCitations: 0, hallucinations: [] };
      if (result.result && !result.isError) {
        try {
          let text = result.result;
          let workspaceFiles = context.relatedDocuments ? context.relatedDocuments.map(d => d.path || d.filePath || d) : [];
          if (workspaceFiles.length > 0 && formatLineNumberLinks) {
            text = formatLineNumberLinks(text, workspaceFiles);
          }
          const citationCheck = verifyCitations(text);
          result.result = citationCheck.text;
          groundingInfo.verifiedCitations = citationCheck.verifiedCitations;
          groundingInfo.brokenCitations = citationCheck.brokenCitations;
          traceSession.recordEvent('Validation', 'grounding:validated', 'Citation Grounding Verified', groundingInfo);
        } catch (err) {
          log.warn(`[Flow:${flowId}] Grounding check warning:`, err.message);
        }
      }

      const s4End = Date.now();
      const s4Duration = s4End - s4Start;
      const executionMode = result.isError ? 'execution_error' : (result.llmInvoked === false ? 'template_formatter' : (result.cached ? 'cache_hit' : 'llm_generation'));
      const cacheMeta = { checked: true, hit: Boolean(result.cached), llmBypassed: result.llmInvoked === false, key: conversationId || 'session' };
      const finalTokensDetail = (result.tokensDetail && result.tokensDetail.totalTokens > 0) ? result.tokensDetail : {
        inputTokens: estimatedPromptTokens,
        outputTokens: 0,
        toolTokens: 0,
        totalTokens: estimatedPromptTokens,
        estimated: true
      };

      stages.push({
        stage: 4,
        name: 'Runtime Execution Strategy & Grounding',
        startedAt: new Date(s4Start).toISOString(),
        endedAt: new Date(s4End).toISOString(),
        durationMs: s4Duration,
        strategy: result.strategy || 'DirectExecutorStrategy',
        executionMode,
        cache: cacheMeta,
        provider: result.provider || 'groq',
        model: result.model || 'default-model',
        finishReason: result.finishReason || (result.isError ? 'error' : 'stop'),
        tokensUsed: result.tokensUsed || estimatedPromptTokens,
        tokensDetail: finalTokensDetail,
        estimatedPromptTokens,
        toolCallsCount: result.trace ? result.trace.length : 0,
        toolCalls: result.trace || [],
        userQuery,
        resultText: result.result || '',
        isError: Boolean(result.isError),
        error: result.isError ? result.result : null,
        grounding: groundingInfo,
        corrected: Boolean(result.corrected)
      });

      traceSession.endSpan(s4SpanId, {
        status: result.isError ? 'failed' : 'completed',
        payload: {
          strategy: result.strategy || 'DirectExecutorStrategy',
          executionMode,
          cache: cacheMeta,
          tokensUsed: result.tokensUsed || 0,
          tokensDetail: result.tokensDetail || null,
          toolCallsCount: result.trace ? result.trace.length : 0,
          userQuery,
          resultText: result.result || '',
          grounding: groundingInfo,
          corrected: Boolean(result.corrected)
        },
        error: result.isError ? result.result : null
      });

      // Stage 5: Persistence & Telemetry
      await this._stage5_PersistenceAndTelemetry({
        userQuery,
        result,
        conversationId,
        flowId,
        s2,
        s3,
        groundingInfo,
        stages,
        traceSession,
        startTime,
        startIso,
        personaId: s1.personaId
      });

      if (result.isError) {
        throw new Error(result.error || result.result || 'Execution error');
      }

      return {
        ...result,
        flowId,
        telemetry: { flowId, totalDurationMs: Date.now() - startTime, stages }
      };
    } catch (error) {
      log.error(`[Flow:${flowId}] Execution failed:`, error.message);
      this._handleFlowError(error, flowId, conversationId, userQuery, context, startIso, startTime, stages);
      throw error;
    }
  }

  /**
   * Execute streaming query through the master 5-stage pipeline
   */
  async stream(userQuery, context = {}, onChunk, abortSignal) {
    const startTime = Date.now();
    const startIso = new Date(startTime).toISOString();
    const flowId = randomUUID();
    const stages = [];
    let conversationId = context.conversationId || context.conversation_id || 'default';

    const traceSession = createTraceSession({
      workspaceId: this.agent?.workspaceRoot || 'default',
      conversationId,
      traceId: `trc_${flowId.replace(/-/g, '').slice(0, 16)}`,
      query: userQuery
    });

    try {
      log.info(`[Flow:${flowId}] Starting master streaming flow for query: "${String(userQuery).slice(0, 60)}..."`);

      // Stage 1: Context & Persona Resolution
      const s1 = this._stage1_ContextResolution(userQuery, context, conversationId, traceSession, stages);
      conversationId = s1.conversationId;

      // Stage 2: Intent Planning & Hybrid Retrieval
      const s2 = await this._stage2_IntentAndRetrieval(userQuery, context, s1.activeNotePath, traceSession, stages);

      // Stage 3: System Prompt Assembly & Harness Audit
      const s3 = this._stage3_PromptAssembly(userQuery, context, s1, s2, traceSession, stages);

      // Stage 4: Execution Strategy & Grounding
      const s4Start = Date.now();
      const s4SpanId = traceSession.startSpan('Runtime Dynamic Strategy Execution & Grounding', 'LLM', traceSession.rootSpanId, { component: 'QueryExecutor' });
      const queryContext = {
        ...context,
        conversationId,
        persona: s3.personaInput,
        activeNoteContent: s1.activeNoteContent,
        systemPrompt: s3.systemPrompt,
        conversationMemory: s1.historyMessages,
        orchestratorTrace: s2.orchestratorTrace,
        retrievedEvidence: s2.retrievedEvidence,
        trace: traceSession
      };

      let result = await this._checkTaskSummaryOptimization(userQuery, s2.orchRes, flowId, onChunk);

      if (!result) {
        result = await this.agent.queryExecutor.stream(userQuery, queryContext, onChunk, abortSignal);
      }

      if (result.result && !result.isError) {
        try {
          const citationCheck = verifyCitations(result.result);
          result.result = citationCheck.text;
        } catch { /* ignore grounding error */ }
      }

      const s4Duration = Date.now() - s4Start;
      stages.push({
        stage: 4,
        name: 'Runtime Dynamic Strategy Execution & Grounding',
        startedAt: new Date(s4Start).toISOString(),
        durationMs: s4Duration,
        strategy: result.strategy || 'StreamingStrategy',
        tokensUsed: result.tokensUsed || 0,
        tokensDetail: result.tokensDetail || { inputTokens: 0, outputTokens: 0, toolTokens: 0, totalTokens: 0 },
        toolCallsCount: result.trace ? result.trace.length : 0,
        toolCalls: result.trace || [],
        userQuery,
        resultText: result.result || '',
        isError: Boolean(result.isError),
        error: result.isError ? result.result : null
      });

      traceSession.endSpan(s4SpanId, {
        status: result.isError ? 'failed' : 'completed',
        payload: {
          strategy: 'StreamingStrategy',
          tokensUsed: result.tokensUsed || 0,
          tokensDetail: result.tokensDetail || null,
          toolCallsCount: result.trace ? result.trace.length : 0,
          resultText: result.result || ''
        },
        error: result.isError ? result.result : null
      });

      // Stage 5: Persistence & Telemetry (Streaming)
      const s5Start = Date.now();
      const _s5SpanId = traceSession.startSpan('Memory Persistence & Telemetry Logging', 'Memory', traceSession.rootSpanId, { component: 'ConversationStore' });

      if (this.agent.conversationStore && result.result && result.type !== 'aborted') {
        try {
          const existingMsgs = this.agent.conversationStore.getMessages(conversationId) || [];
          const lastMsg = existingMsgs.length > 0 ? existingMsgs[existingMsgs.length - 1] : null;
          if (!lastMsg || lastMsg.role !== 'user' || lastMsg.content !== userQuery) {
            this.agent.conversationStore.addMessage(conversationId, 'user', userQuery);
          }
          const updatedMsgs = this.agent.conversationStore.getMessages(conversationId) || [];
          const lastAsst = updatedMsgs.length > 0 ? updatedMsgs[updatedMsgs.length - 1] : null;
          if (!lastAsst || lastAsst.role !== 'assistant' || lastAsst.content !== result.result) {
            this.agent.conversationStore.addMessage(conversationId, 'assistant', result.result, {
              tokensUsed: result.tokensUsed,
              trace: result.trace,
              flowId
            });
          }
        } catch (saveErr) {
          log.warn(`[Flow:${flowId}] Streaming ConversationStore save warning:`, saveErr.message);
        }
      }

      stages.push({
        stage: 5,
        name: 'Memory Persistence & Telemetry Logging',
        startedAt: new Date(s5Start).toISOString(),
        durationMs: Date.now() - s5Start,
        saved: true
      });

      if (Array.isArray(result?.trace)) {
        for (const tool of result.trace) {
          const toolName = tool.name || tool.toolName || 'tool';
          const exists = traceSession.events.some(e => e.payload?.toolName === toolName || e.label === `Tool: ${toolName}`);
          if (!exists) {
            traceSession.recordEvent('Tool', 'tool_execution', `Tool: ${toolName}`, {
              toolName,
              toolType: tool.type === 'llm' ? 'llm-driven' : 'pre-retrieval',
              args: tool.args || {},
              input: tool.args || {},
              output: tool.output !== undefined ? tool.output : tool.result,
              durationMs: tool.durationMs || 0,
              callerType: tool.type === 'llm' ? 'llm' : 'system'
            });
          }
        }
      }

      const totalDurationMs = Date.now() - startTime;
      const traceFinalized = traceSession.finish({
        status: result.isError ? 'failed' : 'completed',
        metadata: { flowId, totalDurationMs, tokensUsed: result.tokensUsed || 0 }
      });

      const combinedToolTrace = [
        ...(s2.orchestratorTrace || []).map(t => ({ ...t, type: 'pre-retrieval' })),
        ...(result?.trace || [])
      ];

      const builtEvents = buildEvents(stages, combinedToolTrace, totalDurationMs, startTime);
      const events = traceFinalized.events && traceFinalized.events.length > 0
        ? buildEventsFromTrace(traceFinalized.events)
        : builtEvents;

      this._logFlowTelemetry({
        flowId,
        traceId: traceSession.traceId,
        conversationId,
        query: userQuery,
        persona: s1.personaId,
        startedAt: startIso,
        totalDurationMs,
        tokensUsed: result.tokensUsed || 0,
        systemPrompt: s3.systemPrompt,
        stages,
        events
      });

      return {
        ...result,
        flowId,
        telemetry: { flowId, totalDurationMs, stages }
      };
    } catch (error) {
      log.error(`[Flow:${flowId}] Streaming execution failed:`, error.message);
      this._handleFlowError(error, flowId, conversationId, userQuery, context, startIso, startTime, stages);
      throw error;
    }
  }

  // ── Helper Methods ─────────────────────────────────────────────────────────

  _stage1_ContextResolution(userQuery, context, initialConvId, traceSession, stages) {
    const s1Start = Date.now();
    const s1SpanId = traceSession.startSpan('Context & Persona Resolution', 'Conversation', traceSession.rootSpanId, { component: 'ConversationStore' });

    let conversationId = initialConvId;
    if (!conversationId || conversationId === 'default') {
      if (this.agent.conversationStore) {
        const title = String(userQuery || 'New Chat').slice(0, 30);
        const newConv = this.agent.conversationStore.createConversation(title, context.persona || 'general');
        conversationId = newConv?.id || `conv-${Date.now()}`;
        traceSession.conversationId = conversationId;
      } else {
        conversationId = `conv-${Date.now()}`;
        traceSession.conversationId = conversationId;
      }
    }

    let personaId = context.persona || 'general';
    let personaObj = null;
    let rawHistory = [];

    if (this.agent.conversationStore) {
      const conv = this.agent.conversationStore.getConversation(conversationId);
      if (conv?.persona) {
        personaId = conv.persona;
      }
      rawHistory = this.agent.conversationStore.getMessages(conversationId) || [];
    }

    if (this.agent.personaDB) {
      personaObj = this.agent.personaDB.get(personaId);
    }
    if (!personaObj && this.agent.personaManager) {
      personaObj = this.agent.personaManager.getPersona(personaId);
    }

    const compactionRes = compaction.compactHistory(rawHistory, { maxVerbatimCount: 4, trace: traceSession });
    const historyMessages = compactionRes.compactedMessages;
    const activeNotePath = context.currentFile || null;
    const activeNoteContent = context.activeNoteContent || null;
    const userTurnCount = rawHistory.filter(m => m.role === 'user').length;
    const s1Duration = Date.now() - s1Start;

    stages.push({
      stage: 1,
      name: 'Context & Persona Resolution',
      startedAt: new Date(s1Start).toISOString(),
      durationMs: s1Duration,
      personaId,
      personaName: personaObj?.name || personaId,
      activeNotePath,
      historyCount: userTurnCount,
      userTurnCount,
      totalMessageCount: rawHistory.length,
      compactedTurnsCount: compactionRes.turnsCompacted,
      isCompacted: compactionRes.isCompacted
    });

    traceSession.endSpan(s1SpanId, {
      status: 'completed',
      payload: {
        personaId,
        personaName: personaObj?.name || personaId,
        historyCount: userTurnCount,
        userTurnCount,
        totalMessageCount: rawHistory.length,
        activeNotePath,
        isCompacted: compactionRes.isCompacted,
        compactedTurnsCount: compactionRes.turnsCompacted,
        input: { personaId, activeNotePath },
        output: { historyMessagesCount: userTurnCount, totalMessageCount: rawHistory.length, isCompacted: compactionRes.isCompacted }
      }
    });

    return { conversationId, personaId, personaObj, rawHistory, historyMessages, activeNotePath, activeNoteContent };
  }

  async _stage2_IntentAndRetrieval(userQuery, context, activeNotePath, traceSession, stages) {
    const s2Start = Date.now();
    const s2SpanId = traceSession.startSpan('Intent Planning & Hybrid Retrieval', 'Planner', traceSession.rootSpanId, { component: 'ContextOrchestrator' });
    let retrievedEvidence = '';
    let orchestratorTrace = [];
    let confidenceScore = 0.0;
    let orchRes = null;

    if (this.agent.contextOrchestrator) {
      try {
        orchRes = await this.agent.contextOrchestrator.orchestrate(userQuery, {
          ...context,
          activeNotePath,
          trace: traceSession
        });
        if (orchRes.aggregatedContext) {
          retrievedEvidence = orchRes.aggregatedContext;
        }
        if (orchRes.trace) {
          orchestratorTrace = orchRes.trace;
        }
        confidenceScore = orchRes.confidenceScore !== undefined ? orchRes.confidenceScore : (orchRes.plannerDecision?.confidence !== undefined ? orchRes.plannerDecision.confidence : (orchRes.confidence !== undefined ? orchRes.confidence : 0.0));
      } catch (orchErr) {
        log.warn(`ContextOrchestrator fallback:`, orchErr.message);
        traceSession.recordWarning('Planner', 'ContextOrchestrator Fallback', orchErr.message);
      }
    }

    const s2Duration = Date.now() - s2Start;
    stages.push({
      stage: 2,
      name: 'Intent Planning & Hybrid Retrieval',
      startedAt: new Date(s2Start).toISOString(),
      durationMs: s2Duration,
      confidenceScore,
      plannerDecision: orchRes?.plannerDecision || null,
      retrievalQuality: orchRes?.retrievalQuality || [],
      evidenceLength: retrievedEvidence.length,
      preRetrievalTrace: orchestratorTrace
    });

    traceSession.endSpan(s2SpanId, {
      status: 'completed',
      payload: {
        confidenceScore,
        plannerDecision: orchRes?.plannerDecision || null,
        retrievalQuality: orchRes?.retrievalQuality || [],
        evidenceLength: retrievedEvidence.length,
        preRetrievalTraceCount: orchestratorTrace.length,
        input: userQuery,
        output: orchestratorTrace
      }
    });

    return { retrievedEvidence, orchestratorTrace, confidenceScore, orchRes };
  }

  _stage3_PromptAssembly(userQuery, context, s1, s2, traceSession, stages) {
    const s3Start = Date.now();
    const s3SpanId = traceSession.startSpan('System Prompt Assembly & Harness Audit', 'Prompt', traceSession.rootSpanId, { component: 'PromptPipeline' });
    let personaInput = s1.personaObj ? {
      id: s1.personaObj.id || s1.personaId,
      name: s1.personaObj.name || s1.personaId,
      systemInstructions: s1.personaObj.prompt || s1.personaObj.systemInstructions || ''
    } : s1.personaId;

    const queryCategory = s2.orchRes?.category || 'Workspace Search';
    const pipeline = this.agent.promptPipeline || createPromptPipeline();
    const systemPrompt = pipeline.assemble({
      persona: personaInput,
      category: queryCategory,
      workspaceContext: {
        workspaceRoot: this.agent.workspaceRoot || 'none',
        activeNotePath: s1.activeNotePath || 'none',
        activeNoteContent: s1.activeNoteContent,
        documentCount: this.agent.documentService?.getAllDocuments()?.length || 0
      },
      conversationMemory: s1.historyMessages.length > 0 ? s1.historyMessages : null,
      retrievedEvidence: s2.retrievedEvidence || (context.relatedDocuments ? context.relatedDocuments.map(d => d.path).join('\n') : null),
      uiContext: context.uiContext || null,
      trace: traceSession
    });

    let harnessValid = true;
    try {
      const tester = new PromptTester();
      const check = tester.validateSafetyInvariants(systemPrompt);
      harnessValid = check.valid;
    } catch { /* ignore audit error */ }

    const promptBreakdown = {
      systemPromptLength: systemPrompt.length,
      personaPromptLength: typeof personaInput === 'string' ? personaInput.length : JSON.stringify(personaInput || {}).length,
      workspaceContextLength: s1.activeNoteContent ? s1.activeNoteContent.length : 0,
      retrievedEvidenceLength: s2.retrievedEvidence ? String(s2.retrievedEvidence).length : 0,
      userPromptLength: userQuery ? userQuery.length : 0,
      promptVersion: '1.2.0',
      harnessVersion: '1.0.0'
    };

    const s3Duration = Date.now() - s3Start;
    stages.push({
      stage: 3,
      name: 'System Prompt Assembly & Harness Audit',
      startedAt: new Date(s3Start).toISOString(),
      durationMs: s3Duration,
      systemPromptLength: systemPrompt.length,
      systemPromptSnippet: systemPrompt.slice(0, 500),
      systemPrompt,
      harnessValid,
      promptBreakdown
    });

    traceSession.endSpan(s3SpanId, {
      status: 'completed',
      payload: {
        systemPromptLength: systemPrompt.length,
        harnessValid,
        systemPromptSnippet: systemPrompt.slice(0, 500),
        promptBreakdown,
        input: `System Prompt Config (${systemPrompt.length} chars)`,
        output: systemPrompt.slice(0, 500)
      }
    });

    return { personaInput, systemPrompt, harnessValid, promptBreakdown };
  }

  async _checkTaskSummaryOptimization(userQuery, orchRes, flowId, onChunk = null) {
    const res = await checkTaskSummaryOptimization(this.agent, userQuery, orchRes, flowId, onChunk);
    if (res) {
      log.info(`[Flow:${flowId}] Deterministic response optimization applied`);
    }
    return res;
  }

  async _stage5_PersistenceAndTelemetry({ userQuery, result, conversationId, flowId, s2, s3, groundingInfo, stages, traceSession, startTime, startIso, personaId }) {
    const s5Start = Date.now();
    const _s5SpanId = traceSession.startSpan('Memory Persistence & Telemetry Logging', 'Memory', traceSession.rootSpanId, { component: 'ConversationStore' });

    const pipelineHealth = calculatePipelineHealth({
      confidenceScore: s2.confidenceScore,
      groundingInfo,
      systemPrompt: s3.systemPrompt
    });

    try {
      if (this.agent && this.agent.conversationStore) {
        await this.agent.conversationStore.appendTurn(conversationId, {
          query: userQuery,
          response: result.result || '',
          stages,
          flowId,
          pipelineHealth
        });
      }
    } catch (err) {
      log.warn(`[Flow:${flowId}] Memory persistence warning:`, err.message);
    }

    stages.push({
      stage: 5,
      name: 'Memory Persistence & Telemetry Logging',
      startedAt: new Date(s5Start).toISOString(),
      durationMs: Date.now() - s5Start,
      saved: true
    });

    if (Array.isArray(result?.trace)) {
      for (const tool of result.trace) {
        const toolName = tool.name || tool.toolName || 'tool';
        const exists = traceSession.events.some(e => e.payload?.toolName === toolName || e.label === `Tool: ${toolName}`);
        if (!exists) {
          traceSession.recordEvent('Tool', 'tool_execution', `Tool: ${toolName}`, {
            toolName,
            toolType: tool.type === 'llm' ? 'llm-driven' : 'pre-retrieval',
            args: tool.args || {},
            input: tool.args || {},
            output: tool.output !== undefined ? tool.output : tool.result,
            durationMs: tool.durationMs || 0,
            callerType: tool.type === 'llm' ? 'llm' : 'system'
          });
        }
      }
    }

    const totalDurationMs = Date.now() - startTime;
    const traceFinalized = traceSession.finish({
      status: result.isError ? 'failed' : 'completed',
      metadata: { flowId, totalDurationMs, tokensUsed: result.tokensUsed || 0 }
    });

    const combinedToolTrace = [
      ...(s2.orchestratorTrace || []).map(t => ({ ...t, type: 'pre-retrieval' })),
      ...(result?.trace || [])
    ];

    const builtEvents = buildEvents(stages, combinedToolTrace, totalDurationMs, startTime);
    const events = traceFinalized.events && traceFinalized.events.length > 0
      ? buildEventsFromTrace(traceFinalized.events)
      : builtEvents;

    this._logFlowTelemetry({
      flowId,
      traceId: traceSession.traceId,
      conversationId,
      query: userQuery,
      persona: personaId,
      startedAt: startIso,
      totalDurationMs,
      tokensUsed: result.tokensUsed || 0,
      tokensDetail: result.tokensDetail || null,
      systemPrompt: s3.systemPrompt,
      stages,
      events
    });
  }

  _handleFlowError(error, flowId, conversationId, userQuery, context, startIso, startTime, stages) {
    try {
      const totalDurationMs = Date.now() - startTime;
      const errEvent = {
        type: 'error',
        callerType: 'system',
        label: 'Execution Error',
        startedAt: new Date().toISOString(),
        durationMs: 0,
        errorMessage: error.message
      };
      const events = [...buildEvents(stages, [], totalDurationMs, startTime), errEvent];
      this._logFlowTelemetry({
        flowId,
        conversationId: conversationId || 'default',
        query: userQuery,
        persona: context.persona || 'general',
        startedAt: startIso,
        totalDurationMs,
        tokensUsed: 0,
        systemPrompt: '',
        stages,
        events,
        error: error.message
      });
    } catch { /* ignore telemetry error */ }
  }

  /**
   * Log telemetry record to TelemetryDB
   * @private
   */
  _logFlowTelemetry(telemetryPayload) {
    recordTelemetry(this.agent, telemetryPayload);
  }
}

module.exports = AIFlow;
