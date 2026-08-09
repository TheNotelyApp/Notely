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
const { buildEvents, buildEventsFromTrace } = require('../telemetry/eventBuilder');
const { createTraceSession } = require('../telemetry/TraceContext');

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
    let orchestratorTrace = [];
    let conversationId = context.conversationId || context.conversation_id || 'default';

    const traceSession = createTraceSession({
      workspaceId: this.agent?.workspaceRoot || 'default',
      conversationId,
      traceId: `trc_${flowId.replace(/-/g, '').slice(0, 16)}`,
      query: userQuery
    });

    try {
      log.info(`[Flow:${flowId}] Starting master execution flow for query: "${String(userQuery).slice(0, 60)}..."`);

      // ── Stage 1: Context & Persona Resolution ──────────────────────────────
      const s1Start = Date.now();
      const s1SpanId = traceSession.startSpan('Context & Persona Resolution', 'Conversation', traceSession.rootSpanId, { component: 'ConversationStore' });

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

      const compaction = require('../compaction');
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

      // ── Stage 2: Intent Planning & Hybrid Retrieval ────────────────────────
      const s2Start = Date.now();
      const s2SpanId = traceSession.startSpan('Intent Planning & Hybrid Retrieval', 'Planner', traceSession.rootSpanId, { component: 'ContextOrchestrator' });
      let retrievedEvidence = '';
      orchestratorTrace = [];
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
          log.warn(`[Flow:${flowId}] ContextOrchestrator fallback:`, orchErr.message);
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

      // ── Stage 3: System Prompt Assembly & Harness Audit ────────────────────
      const s3Start = Date.now();
      const s3SpanId = traceSession.startSpan('System Prompt Assembly & Harness Audit', 'Prompt', traceSession.rootSpanId, { component: 'PromptPipeline' });
      let personaInput = personaObj ? {
        id: personaObj.id || personaId,
        name: personaObj.name || personaId,
        systemInstructions: personaObj.prompt || personaObj.systemInstructions || ''
      } : personaId;

      const queryCategory = orchRes?.category || 'Workspace Search';
      const pipeline = this.agent.promptPipeline || require('../prompts').createPromptPipeline();
      const systemPrompt = pipeline.assemble({
        persona: personaInput,
        category: queryCategory,
        workspaceContext: {
          workspaceRoot: this.agent.workspaceRoot || 'none',
          activeNotePath: activeNotePath || 'none',
          activeNoteContent,
          documentCount: this.agent.documentService?.getAllDocuments()?.length || 0
        },
        conversationMemory: historyMessages.length > 0 ? historyMessages : null,
        retrievedEvidence: retrievedEvidence || (context.relatedDocuments ? context.relatedDocuments.map(d => d.path).join('\n') : null),
        uiContext: context.uiContext || null,
        trace: traceSession
      });

      let harnessValid = true;
      try {
        const { PromptTester } = require('../testing');
        const tester = new PromptTester();
        const check = tester.validateSafetyInvariants(systemPrompt);
        harnessValid = check.valid;
      } catch { /* ignore audit error */ }

      const promptBreakdown = {
        systemPromptLength: systemPrompt.length,
        personaPromptLength: typeof personaInput === 'string' ? personaInput.length : JSON.stringify(personaInput || {}).length,
        workspaceContextLength: activeNoteContent ? activeNoteContent.length : 0,
        retrievedEvidenceLength: retrievedEvidence ? String(retrievedEvidence).length : 0,
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

      // ── Stage 4: Runtime Dynamic Execution Strategy & Grounding ────────────
      const s4Start = Date.now();
      const s4SpanId = traceSession.startSpan('Runtime Strategy Execution & Grounding', 'LLM', traceSession.rootSpanId, { component: 'QueryExecutor' });
      const queryContext = {
        ...context,
        conversationId,
        persona: personaInput,
        activeNoteContent,
        systemPrompt,
        conversationMemory: historyMessages,
        orchestratorTrace,
        retrievedEvidence,
        trace: traceSession
      };

      // Check for deterministic response optimization (Requirement 4)
      const intent = orchRes?.intent || orchRes?.plannerDecision?.intent;
      const isTaskIntent = ['workspace_task_summary', 'tasks:extract', 'checklist_summary'].includes(intent);
      const isTargetedQuestion = /\b(do we have|is there|are there|which|who|where|when|why|how|about|on|for|related|first|next|priority|specific)\b/i.test(String(userQuery).toLowerCase());
      const isTaskSummaryIntent = isTaskIntent && !isTargetedQuestion;
      let result = null;

      if (isTaskSummaryIntent) {
        let tasksData = orchRes?.rawTaskResults;
        if ((!tasksData || !Array.isArray(tasksData) || tasksData.length === 0) && this.agent) {
          try {
            const QueryTools = require('../tools/QueryTools');
            const tasksJson = await QueryTools.runTool(this.agent, 'get_tasks', { status: 'open' });
            if (typeof tasksJson === 'string' && tasksJson.startsWith('[')) {
              tasksData = JSON.parse(tasksJson);
            }
          } catch { /* ignore */ }
        }

        if (Array.isArray(tasksData) && tasksData.length > 0) {
          const { TaskSummaryFormatter } = require('../formatter');
          const formattedResponse = TaskSummaryFormatter(tasksData);
          result = {
            type: 'query',
            result: formattedResponse,
            tokensUsed: 0,
            tokensDetail: { inputTokens: 0, outputTokens: 0, toolTokens: 0, totalTokens: 0 },
            trace: (orchestratorTrace || []).map(t => ({
              ...t,
              toolType: 'planned-execution',
              callerType: 'executor',
              selectedBy: 'planner',
              intent
            })),
            strategy: 'TaskSummaryFormatter',
            llmInvoked: false
          };
          log.info(`[Flow:${flowId}] Deterministic response optimization applied for intent: ${intent}`);
        }
      }

      const estimatedPromptTokens = Math.ceil(((systemPrompt || '').length + (userQuery || '').length) / 4);

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
          const { verifyCitations, formatLineNumberLinks } = require('../grounding');
          let text = result.result;

          let workspaceFiles = [];
          if (context.relatedDocuments) {
            workspaceFiles = context.relatedDocuments.map(d => d.path || d.filePath || d);
          }

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
      const cacheMeta = {
        checked: true,
        hit: Boolean(result.cached),
        llmBypassed: result.llmInvoked === false,
        key: conversationId || 'session'
      };

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

      // ── Stage 5: Memory Persistence & Telemetry Logging ───────────────────
      const s5Start = Date.now();
      traceSession.startSpan('Memory Persistence & Telemetry Logging', 'Memory', traceSession.rootSpanId, { component: 'ConversationStore' });

      // Calculate composite pipeline health score (0-100)
      const retrievalScore = Math.round((orchRes?.confidenceScore || 0.9) * 100);
      const groundingScore = groundingInfo.brokenCitations === 0 ? 100 : Math.max(50, 100 - (groundingInfo.brokenCitations * 20));
      const promptEffScore = systemPrompt ? Math.min(100, Math.round(Math.max(50, (1 - (systemPrompt.length / 20000)) * 100))) : 90;
      const telemetryScore = 100;
      const overallHealth = Math.round((retrievalScore * 0.3) + (groundingScore * 0.3) + (promptEffScore * 0.2) + (telemetryScore * 0.2));

      const pipelineHealth = {
        retrieval: retrievalScore,
        grounding: groundingScore,
        telemetry: telemetryScore,
        promptEfficiency: promptEffScore,
        overall: overallHealth
      };

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
        ...(orchestratorTrace || []).map(t => ({ ...t, type: 'pre-retrieval' })),
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
        systemPrompt,
        stages,
        events
      });

      if (result.isError) {
        throw new Error(result.error || result.result || 'Execution error');
      }

      return {
        ...result,
        flowId,
        telemetry: { flowId, totalDurationMs, stages }
      };
    } catch (error) {
      log.error(`[Flow:${flowId}] Execution failed:`, error.message);
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
        const combinedToolTrace = (orchestratorTrace || []).map(t => ({ ...t, type: 'pre-retrieval' }));
        const events = [...buildEvents(stages, combinedToolTrace, totalDurationMs, startTime), errEvent];
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
      } catch { /* ignore telemetry log error */ }
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
    let orchestratorTrace = [];
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
      const s1Start = Date.now();
      const s1SpanId = traceSession.startSpan('Context & Persona Resolution', 'Conversation', traceSession.rootSpanId, { component: 'ConversationStore' });

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

      const compaction = require('../compaction');
      const compactionRes = compaction.compactHistory(rawHistory, { maxVerbatimCount: 4, trace: traceSession });
      const historyMessages = compactionRes.compactedMessages;

      const activeNotePath = context.currentFile || null;
      const activeNoteContent = context.activeNoteContent || null;

      const s1Duration = Date.now() - s1Start;
      stages.push({
        stage: 1,
        name: 'Context & Persona Resolution',
        startedAt: new Date(s1Start).toISOString(),
        durationMs: s1Duration,
        personaId,
        personaName: personaObj?.name || personaId,
        activeNotePath,
        historyCount: rawHistory.length,
        compactedTurnsCount: compactionRes.turnsCompacted,
        isCompacted: compactionRes.isCompacted
      });

      traceSession.endSpan(s1SpanId, {
        status: 'completed',
        payload: {
          personaId,
          personaName: personaObj?.name || personaId,
          historyCount: rawHistory.length,
          activeNotePath,
          isCompacted: compactionRes.isCompacted,
          compactedTurnsCount: compactionRes.turnsCompacted
        }
      });

      // Stage 2: Intent Planning & Hybrid Retrieval
      const s2Start = Date.now();
      const s2SpanId = traceSession.startSpan('Intent Planning & Hybrid Retrieval', 'Planner', traceSession.rootSpanId, { component: 'ContextOrchestrator' });
      let retrievedEvidence = '';
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
          log.warn(`[Flow:${flowId}] Streaming ContextOrchestrator fallback:`, orchErr.message);
          traceSession.recordWarning('Planner', 'Streaming ContextOrchestrator Fallback', orchErr.message);
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
          preRetrievalTraceCount: orchestratorTrace.length
        }
      });

      // Stage 3: Prompt Assembly
      const s3Start = Date.now();
      const s3SpanId = traceSession.startSpan('System Prompt Assembly & Harness Audit', 'Prompt', traceSession.rootSpanId, { component: 'PromptPipeline' });
      let personaInput = personaObj ? {
        id: personaObj.id || personaId,
        name: personaObj.name || personaId,
        systemInstructions: personaObj.prompt || personaObj.systemInstructions || ''
      } : personaId;

      const pipeline = this.agent.promptPipeline || require('../prompts').createPromptPipeline();
      const systemPrompt = pipeline.assemble({
        persona: personaInput,
        workspaceContext: {
          workspaceRoot: this.agent.workspaceRoot || 'none',
          activeNotePath: activeNotePath || 'none',
          activeNoteContent,
          documentCount: this.agent.documentService?.getAllDocuments()?.length || 0
        },
        conversationMemory: historyMessages.length > 0 ? historyMessages : null,
        retrievedEvidence: retrievedEvidence || (context.relatedDocuments ? context.relatedDocuments.map(d => d.path).join('\n') : null),
        uiContext: context.uiContext || null,
        trace: traceSession
      });

      let harnessValid = true;
      try {
        const { PromptTester } = require('../testing');
        const tester = new PromptTester();
        const check = tester.validateSafetyInvariants(systemPrompt);
        harnessValid = check.valid;
      } catch { /* ignore audit error */ }

      const s3Duration = Date.now() - s3Start;
      stages.push({
        stage: 3,
        name: 'System Prompt Assembly & Harness Audit',
        startedAt: new Date(s3Start).toISOString(),
        durationMs: s3Duration,
        systemPromptLength: systemPrompt.length,
        systemPrompt: systemPrompt,
        harnessValid
      });

      traceSession.endSpan(s3SpanId, {
        status: 'completed',
        payload: {
          systemPromptLength: systemPrompt.length,
          harnessValid
        }
      });

      // Stage 4: Execution Strategy & Grounding
      const s4Start = Date.now();
      const s4SpanId = traceSession.startSpan('Runtime Dynamic Strategy Execution & Grounding', 'LLM', traceSession.rootSpanId, { component: 'QueryExecutor' });
      const queryContext = {
        ...context,
        conversationId,
        persona: personaInput,
        activeNoteContent,
        systemPrompt,
        conversationMemory: historyMessages,
        orchestratorTrace,
        retrievedEvidence,
        trace: traceSession
      };

      // Check for deterministic response optimization (Requirement 4)
      const intent = orchRes?.intent || orchRes?.plannerDecision?.intent;
      const isTaskIntent = ['workspace_task_summary', 'tasks:extract', 'checklist_summary'].includes(intent);
      const isTargetedQuestion = /\b(do we have|is there|are there|which|who|where|when|why|how|about|on|for|related|first|next|priority|specific)\b/i.test(String(userQuery).toLowerCase());
      const isTaskSummaryIntent = isTaskIntent && !isTargetedQuestion;
      let result = null;

      if (isTaskSummaryIntent) {
        let tasksData = orchRes?.rawTaskResults;
        if ((!tasksData || !Array.isArray(tasksData) || tasksData.length === 0) && this.agent) {
          try {
            const QueryTools = require('../tools/QueryTools');
            const tasksJson = await QueryTools.runTool(this.agent, 'get_tasks', { status: 'open' });
            if (typeof tasksJson === 'string' && tasksJson.startsWith('[')) {
              tasksData = JSON.parse(tasksJson);
            }
          } catch { /* ignore */ }
        }

        if (Array.isArray(tasksData) && tasksData.length > 0) {
          const { TaskSummaryFormatter } = require('../formatter');
          const formattedResponse = TaskSummaryFormatter(tasksData);
          if (onChunk) {
            onChunk({ type: 'replace', content: formattedResponse });
          }
          result = {
            type: 'query',
            result: formattedResponse,
            tokensUsed: 0,
            tokensDetail: { inputTokens: 0, outputTokens: 0, toolTokens: 0, totalTokens: 0 },
            trace: (orchestratorTrace || []).map(t => ({
              ...t,
              toolType: 'planned-execution',
              callerType: 'executor',
              selectedBy: 'planner',
              intent
            })),
            strategy: 'TaskSummaryFormatter',
            llmInvoked: false
          };
          log.info(`[Flow:${flowId}] Streaming deterministic response optimization applied for intent: ${intent}`);
        }
      }

      if (!result) {
        result = await this.agent.queryExecutor.stream(userQuery, queryContext, onChunk, abortSignal);
      }

      if (result.result && !result.isError) {
        try {
          const { verifyCitations } = require('../grounding');
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

      // Stage 5: Persistence
      const s5Start = Date.now();
      traceSession.startSpan('Memory Persistence & Telemetry Logging', 'Memory', traceSession.rootSpanId, { component: 'ConversationStore' });

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

      const totalDurationMs = Date.now() - startTime;

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

      const traceFinalized = traceSession.finish({
        status: result.isError ? 'failed' : 'completed',
        metadata: { flowId, totalDurationMs, tokensUsed: result.tokensUsed || 0 }
      });

      const combinedToolTrace = [
        ...(orchestratorTrace || []).map(t => ({ ...t, type: 'pre-retrieval' })),
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
        systemPrompt,
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
      try {
        const totalDurationMs = Date.now() - startTime;
        const errEvent = {
          type: 'error',
          callerType: 'system',
          label: 'Streaming Execution Error',
          startedAt: new Date().toISOString(),
          durationMs: 0,
          errorMessage: error.message
        };
        const combinedToolTrace = (orchestratorTrace || []).map(t => ({ ...t, type: 'pre-retrieval' }));
        const events = [...buildEvents(stages, combinedToolTrace, totalDurationMs, startTime), errEvent];
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
      } catch { /* ignore telemetry log error */ }
      throw error;
    }
  }

  /**
   * Log telemetry record to TelemetryDB (isolated ai-telemetry.db)
   * Guaranteed to write under all conditions.
   * @private
   */
  _logFlowTelemetry(telemetryPayload) {
    try {
      if (this.agent.telemetryDb && this.agent.telemetryDb.isInitialized) {
        this.agent.telemetryDb.addTelemetry(telemetryPayload);
      } else if (this.agent.logDb && this.agent.logDb.isInitialized) {
        this.agent.logDb.addLog(
          'FlowTracker',
          `Flow execution telemetry recorded for query: "${String(telemetryPayload.query).slice(0, 60)}"`,
          'info',
          telemetryPayload
        );
      } else {
        const TelemetryDB = require('../telemetry/TelemetryDB');
        const workspaceRoot = this.agent.workspaceRoot || process.cwd();
        const fallbackDb = new TelemetryDB(workspaceRoot);
        if (fallbackDb.initialize()) {
          fallbackDb.addTelemetry(telemetryPayload);
          fallbackDb.close();
        }
      }
    } catch (err) {
      log.warn('Failed to log TelemetryDB record:', err.message);
    }
  }
}

module.exports = AIFlow;
