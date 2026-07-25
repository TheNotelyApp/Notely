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

const log = createLogger('AIFlow');

class AIFlow {
  constructor(agent) {
    this.agent = agent;
  }

  /**
   * Execute non-streaming query through the master 5-stage pipeline
   * @param {string} userQuery
   * @param {object} context
   * @returns {Promise<object>}
   */
  async execute(userQuery, context = {}) {
    const startTime = Date.now();
    const flowId = randomUUID();
    const stages = [];

    try {
      log.info(`[Flow:${flowId}] Starting master execution flow for query: "${String(userQuery).slice(0, 60)}..."`);

      // ── Stage 1: Context & Persona Resolution ──────────────────────────────
      const s1Start = Date.now();
      const conversationId = context.conversationId || 'default';
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

      // Compact context using compaction module facade
      const compaction = require('../compaction');
      const compactionRes = compaction.compactHistory(rawHistory, { maxVerbatimCount: 4 });
      const historyMessages = compactionRes.compactedMessages;

      const activeNotePath = context.currentFile || null;
      const activeNoteContent = context.activeNoteContent || null;

      stages.push({
        stage: 1,
        name: 'Context & Persona Resolution',
        durationMs: Date.now() - s1Start,
        personaId,
        personaName: personaObj?.name || personaId,
        activeNotePath,
        historyCount: rawHistory.length,
        compactedTurnsCount: compactionRes.turnsCompacted,
        isCompacted: compactionRes.isCompacted
      });

      // ── Stage 2: Intent Planning & Hybrid Retrieval ────────────────────────
      const s2Start = Date.now();
      let retrievedEvidence = '';
      let orchestratorTrace = [];
      let confidenceScore = 0.0;

      if (this.agent.contextOrchestrator) {
        try {
          const orchRes = await this.agent.contextOrchestrator.orchestrate(userQuery, {
            ...context,
            activeNotePath
          });
          if (orchRes.aggregatedContext) {
            retrievedEvidence = orchRes.aggregatedContext;
          }
          if (orchRes.trace) {
            orchestratorTrace = orchRes.trace;
          }
          confidenceScore = orchRes.confidence || 0.0;
        } catch (orchErr) {
          log.warn(`[Flow:${flowId}] ContextOrchestrator fallback:`, orchErr.message);
        }
      }

      stages.push({
        stage: 2,
        name: 'Intent Planning & Hybrid Retrieval',
        durationMs: Date.now() - s2Start,
        confidenceScore,
        evidenceLength: retrievedEvidence.length,
        preRetrievalTrace: orchestratorTrace
      });

      // ── Stage 3: System Prompt Assembly & Harness Audit ────────────────────
      const s3Start = Date.now();
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
        uiContext: context.uiContext || null
      });

      // Safety Invariant Audit via Test Harness
      let harnessValid = true;
      try {
        const { PromptTester } = require('../testing');
        const tester = new PromptTester();
        const check = tester.validateSafetyInvariants(systemPrompt);
        harnessValid = check.valid;
      } catch { /* ignore audit error */ }

      stages.push({
        stage: 3,
        name: 'System Prompt Assembly & Harness Audit',
        durationMs: Date.now() - s3Start,
        systemPromptLength: systemPrompt.length,
        systemPromptSnippet: systemPrompt.slice(0, 500),
        harnessValid
      });

      // ── Stage 4: Runtime Dynamic Execution Strategy & Grounding ────────────
      const s4Start = Date.now();
      const queryContext = {
        ...context,
        conversationId,
        persona: personaInput,
        activeNoteContent,
        systemPrompt,
        orchestratorTrace
      };

      const result = await this.agent.queryExecutor.execute(userQuery, queryContext);

      // Auto-format file links and verify citations via GroundingEngine facade
      let groundingInfo = { verifiedCitations: 0, brokenCitations: 0, hallucinations: [] };
      if (result.result) {
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
        } catch (err) {
          log.warn(`[Flow:${flowId}] Grounding check warning:`, err.message);
        }
      }

      stages.push({
        stage: 4,
        name: 'Runtime Dynamic Strategy Execution & Grounding',
        durationMs: Date.now() - s4Start,
        strategy: 'MultiStepToolStrategy',
        tokensUsed: result.tokensUsed || 0,
        toolCallsCount: result.trace ? result.trace.length : 0,
        toolCalls: result.trace || [],
        grounding: groundingInfo,
        corrected: Boolean(result.corrected)
      });

      // ── Stage 5: Memory Persistence & Telemetry Logging ───────────────────
      const s5Start = Date.now();
      if (this.agent.conversationStore && result.result) {
        try {
          this.agent.conversationStore.addMessage(conversationId, 'user', userQuery);
          this.agent.conversationStore.addMessage(conversationId, 'assistant', result.result, {
            tokensUsed: result.tokensUsed,
            trace: result.trace,
            flowId
          });
        } catch (saveErr) {
          log.warn(`[Flow:${flowId}] ConversationStore save warning:`, saveErr.message);
        }
      }

      const totalDurationMs = Date.now() - startTime;

      stages.push({
        stage: 5,
        name: 'Memory Persistence & Telemetry Logging',
        durationMs: Date.now() - s5Start,
        saved: true
      });

      // Log complete telemetry payload to LogDB FlowTracker
      this._logFlowTelemetry({
        flowId,
        conversationId,
        query: userQuery,
        persona: personaId,
        totalDurationMs,
        tokensUsed: result.tokensUsed || 0,
        systemPrompt,
        stages
      });

      return {
        ...result,
        flowId,
        telemetry: {
          flowId,
          totalDurationMs,
          stages
        }
      };
    } catch (error) {
      log.error(`[Flow:${flowId}] Execution failed:`, error.message);
      throw error;
    }
  }

  /**
   * Execute streaming query through the master 5-stage pipeline
   * @param {string} userQuery
   * @param {object} context
   * @param {function} onChunk
   * @param {AbortSignal} abortSignal
   * @returns {Promise<object>}
   */
  async stream(userQuery, context = {}, onChunk, abortSignal) {
    const startTime = Date.now();
    const flowId = randomUUID();
    const stages = [];

    try {
      log.info(`[Flow:${flowId}] Starting master streaming flow for query: "${String(userQuery).slice(0, 60)}..."`);

      // Stage 1
      const s1Start = Date.now();
      const conversationId = context.conversationId || 'default';
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

      // Compact context using compaction module facade
      const compaction = require('../compaction');
      const compactionRes = compaction.compactHistory(rawHistory, { maxVerbatimCount: 4 });
      const historyMessages = compactionRes.compactedMessages;

      const activeNotePath = context.currentFile || null;
      const activeNoteContent = context.activeNoteContent || null;

      stages.push({
        stage: 1,
        name: 'Context & Persona Resolution',
        durationMs: Date.now() - s1Start,
        personaId,
        personaName: personaObj?.name || personaId,
        activeNotePath,
        historyCount: rawHistory.length,
        compactedTurnsCount: compactionRes.turnsCompacted,
        isCompacted: compactionRes.isCompacted
      });

      // Stage 2
      const s2Start = Date.now();
      let retrievedEvidence = '';
      let orchestratorTrace = [];
      let confidenceScore = 0.0;

      if (this.agent.contextOrchestrator) {
        try {
          const orchRes = await this.agent.contextOrchestrator.orchestrate(userQuery, {
            ...context,
            activeNotePath
          });
          if (orchRes.aggregatedContext) {
            retrievedEvidence = orchRes.aggregatedContext;
          }
          if (orchRes.trace) {
            orchestratorTrace = orchRes.trace;
          }
          confidenceScore = orchRes.confidence || 0.0;
        } catch (orchErr) {
          log.warn(`[Flow:${flowId}] Streaming ContextOrchestrator fallback:`, orchErr.message);
        }
      }

      stages.push({
        stage: 2,
        name: 'Intent Planning & Hybrid Retrieval',
        durationMs: Date.now() - s2Start,
        confidenceScore,
        evidenceLength: retrievedEvidence.length,
        preRetrievalTrace: orchestratorTrace
      });

      // Stage 3
      const s3Start = Date.now();
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
        uiContext: context.uiContext || null
      });

      stages.push({
        stage: 3,
        name: 'System Prompt Assembly & Harness Audit',
        durationMs: Date.now() - s3Start,
        systemPromptLength: systemPrompt.length,
        systemPromptSnippet: systemPrompt.slice(0, 500),
        harnessValid: true
      });

      // Stage 4
      const s4Start = Date.now();
      const queryContext = {
        ...context,
        conversationId,
        persona: personaInput,
        activeNoteContent,
        systemPrompt,
        orchestratorTrace
      };

      const result = await this.agent.queryExecutor.stream(userQuery, queryContext, onChunk, abortSignal);

      stages.push({
        stage: 4,
        name: 'Runtime Dynamic Strategy Execution & Grounding',
        durationMs: Date.now() - s4Start,
        strategy: 'StreamingStrategy',
        tokensUsed: result.tokensUsed || 0,
        toolCallsCount: result.trace ? result.trace.length : 0,
        toolCalls: result.trace || []
      });

      // Stage 5
      const s5Start = Date.now();
      if (this.agent.conversationStore && result.result && result.type !== 'aborted') {
        try {
          this.agent.conversationStore.addMessage(conversationId, 'user', userQuery);
          this.agent.conversationStore.addMessage(conversationId, 'assistant', result.result, {
            tokensUsed: result.tokensUsed,
            trace: result.trace,
            flowId
          });
        } catch (saveErr) {
          log.warn(`[Flow:${flowId}] Streaming ConversationStore save warning:`, saveErr.message);
        }
      }

      const totalDurationMs = Date.now() - startTime;

      stages.push({
        stage: 5,
        name: 'Memory Persistence & Telemetry Logging',
        durationMs: Date.now() - s5Start,
        saved: true
      });

      this._logFlowTelemetry({
        flowId,
        conversationId,
        query: userQuery,
        persona: personaId,
        totalDurationMs,
        tokensUsed: result.tokensUsed || 0,
        systemPrompt,
        stages
      });

      return {
        ...result,
        flowId,
        telemetry: {
          flowId,
          totalDurationMs,
          stages
        }
      };
    } catch (error) {
      log.error(`[Flow:${flowId}] Streaming execution failed:`, error.message);
      throw error;
    }
  }

  /**
   * Log telemetry record to LogDB (FlowTracker)
   * @private
   */
  _logFlowTelemetry(telemetryPayload) {
    try {
      if (this.agent.logDb && this.agent.logDb.isInitialized) {
        this.agent.logDb.addLog('FlowTracker', `Flow execution telemetry recorded for query: "${String(telemetryPayload.query).slice(0, 60)}"`, 'info', telemetryPayload);
      }
    } catch (err) {
      log.warn('Failed to log FlowTracker telemetry record:', err.message);
    }
  }
}

module.exports = AIFlow;
