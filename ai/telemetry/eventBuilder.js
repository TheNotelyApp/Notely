/**
 * ai/telemetry/eventBuilder.js
 *
 * Builds a flat, chronological events[] array from AIFlow pipeline stages
 * and the tool trace returned by QueryExecutor.
 *
 * Each event has: type, callerType ('system' | 'llm'), label, startedAt (ISO),
 * durationMs, tokensDetail, and type-specific fields.
 * Consumed by the AI Health & Diagnostics → Flow Telemetry timeline UI.
 */

function buildEvents(stagesWithTs = [], toolTrace = [], totalDurationMs = 0, startEpoch = Date.now()) {
  const events = [];
  const stages = Array.isArray(stagesWithTs) ? stagesWithTs : [];

  // Stage 1 → conversation_loaded
  const s1 = stages.find(s => s.stage === 1);
  if (s1) {
    const s1Start = s1.startedAt || new Date(startEpoch).toISOString();
    const s1Dur = s1.durationMs || 0;
    const s1End = s1.endedAt || new Date(new Date(s1Start).getTime() + s1Dur).toISOString();

    events.push({
      type: 'conversation_loaded',
      callerType: 'system',
      label: 'Context & Persona Resolution',
      startedAt: s1Start,
      endedAt: s1End,
      durationMs: s1Dur,
      tokensUsed: null,
      personaId: s1.personaId,
      personaName: s1.personaName,
      historyCount: s1.historyCount,
      activeNotePath: s1.activeNotePath,
      isCompacted: s1.isCompacted,
      compactedTurnsCount: s1.compactedTurnsCount,
      input: { personaId: s1.personaId, personaName: s1.personaName, activeNotePath: s1.activeNotePath },
      output: { historyMessagesCount: s1.historyCount, isCompacted: s1.isCompacted, compactedTurnsCount: s1.compactedTurnsCount }
    });
  }

  // Stage 2 → planner
  const s2 = stages.find(s => s.stage === 2);
  if (s2) {
    const s2Start = s2.startedAt || new Date(startEpoch).toISOString();
    const s2Dur = s2.durationMs || 0;
    const s2End = s2.endedAt || new Date(new Date(s2Start).getTime() + s2Dur).toISOString();

    events.push({
      type: 'planner',
      callerType: 'system',
      label: 'Intent Planning & Pre-Retrieval',
      startedAt: s2Start,
      endedAt: s2End,
      durationMs: s2Dur,
      tokensUsed: null,
      confidenceScore: s2.confidenceScore,
      evidenceLength: s2.evidenceLength,
      query: s2.userQuery || '',
      orchestratorTrace: s2.orchestratorTrace,
      input: s2.userQuery || '',
      output: s2.orchestratorTrace
    });
  }

  // Stage 3 → prompt_construction
  const s3 = stages.find(s => s.stage === 3);
  if (s3) {
    const s3Start = s3.startedAt || new Date(startEpoch).toISOString();
    const s3Dur = s3.durationMs || 0;
    const s3End = s3.endedAt || new Date(new Date(s3Start).getTime() + s3Dur).toISOString();
    const promptSnippet = s3.systemPromptSnippet || (s3.systemPrompt ? s3.systemPrompt.slice(0, 500) : '');

    events.push({
      type: 'prompt_construction',
      callerType: 'system',
      label: 'System Prompt Assembly',
      startedAt: s3Start,
      endedAt: s3End,
      durationMs: s3Dur,
      tokensUsed: null,
      systemPromptLength: s3.systemPromptLength,
      harnessValid: s3.harnessValid,
      systemPromptSnippet: promptSnippet,
      input: `System Prompt Configuration (${s3.systemPromptLength || 0} chars)`,
      output: promptSnippet
    });
  }

  // Stage 4 → tool executions + llm_execution
  const s4 = stages.find(s => s.stage === 4);
  if (s4) {
    const s4StartIso = s4.startedAt || new Date(startEpoch).toISOString();
    const s4Duration = s4.durationMs || 0;
    const rawEpoch = new Date(s4StartIso).getTime();
    const s4EpochStart = isNaN(rawEpoch) ? startEpoch : rawEpoch;
    const s4EndIso = s4.endedAt || new Date(s4EpochStart + s4Duration).toISOString();

    const tools = Array.isArray(toolTrace) ? toolTrace : [];
    if (tools.length > 0) {
      const toolWindow = s4Duration > 0 ? s4Duration * 0.7 : 500;
      const perToolOffset = tools.length > 1 ? toolWindow / tools.length : toolWindow / 2;

      tools.forEach((tool, i) => {
        const toolName = tool.name || tool.toolName || 'tool';
        const isLlmDriven = tool.type === 'llm' || tool.toolType === 'llm-driven';

        const toolStartIso = tool.startedAt || new Date(s4EpochStart + Math.round(perToolOffset * i * 0.6)).toISOString();
        const toolDuration = tool.durationMs || Math.round(perToolOffset * 0.8);
        const toolEndIso = tool.endedAt || new Date(new Date(toolStartIso).getTime() + toolDuration).toISOString();
        const rawOutput = tool.output !== undefined && tool.output !== null ? tool.output : (tool.result !== undefined ? tool.result : null);
        const argsPayload = tool.args || tool.parameters || {};

        // Truncate large tool output payloads to prevent DB bloat
        let processedOutput = rawOutput;
        if (typeof rawOutput === 'string' && rawOutput.length > 2000) {
          processedOutput = rawOutput.slice(0, 2000) + `\n... [truncated ${rawOutput.length - 2000} bytes]`;
        } else if (typeof rawOutput === 'object' && rawOutput !== null) {
          try {
            const str = JSON.stringify(rawOutput);
            if (str.length > 2000) {
              processedOutput = `${str.slice(0, 2000)}\n... [truncated ${str.length - 2000} bytes]`;
            }
          } catch { /* keep rawOutput */ }
        }

        events.push({
          type: 'tool_execution',
          callerType: isLlmDriven ? 'llm' : 'system',
          label: `Tool: ${toolName}`,
          startedAt: toolStartIso,
          endedAt: toolEndIso,
          durationMs: toolDuration,
          tokensUsed: null,
          toolName,
          toolType: isLlmDriven ? 'llm-driven' : 'pre-retrieval',
          args: argsPayload,
          input: argsPayload,
          output: processedOutput
        });
      });
    }

    const tokensUsedVal = typeof s4.tokensUsed === 'number' ? s4.tokensUsed : (s4.tokensUsed?.totalTokens || null);
    const tokensDetail = s4.tokensDetail || (typeof s4.tokensUsed === 'object' ? s4.tokensUsed : null);

    events.push({
      type: 'llm_execution',
      callerType: 'llm',
      label: 'LLM Execution',
      startedAt: s4StartIso,
      endedAt: s4EndIso,
      durationMs: s4Duration,
      strategy: s4.strategy,
      tokensUsed: tokensUsedVal,
      tokensDetail: tokensDetail,
      toolCallsCount: s4.toolCallsCount || 0,
      grounding: s4.grounding || null,
      corrected: s4.corrected || false,
      input: s4.userQuery || '',
      output: s4.resultText || ''
    });

    if (s4.isError || s4.error) {
      events.push({
        type: 'error',
        callerType: 'system',
        label: 'Provider Error',
        startedAt: s4EndIso,
        endedAt: s4EndIso,
        durationMs: 0,
        errorMessage: s4.error || s4.resultText || 'LLM execution error',
        input: s4.userQuery || '',
        output: s4.error || s4.resultText || ''
      });
    }
  }

  // trace_completed
  const completedAt = new Date(startEpoch + (totalDurationMs || 0)).toISOString();
  events.push({
    type: 'trace_completed',
    callerType: 'system',
    label: 'Trace Complete',
    startedAt: completedAt,
    endedAt: completedAt,
    durationMs: 0,
    tokensUsed: null,
    status: 'ok',
    input: '',
    output: ''
  });

  // Sort chronologically ascending within turn (Stage 1 -> Stage 5 execution order)
  events.sort((a, b) => {
    const tA = new Date(a.startedAt).getTime() || 0;
    const tB = new Date(b.startedAt).getTime() || 0;
    return tA - tB;
  });
  return events;
}

function normalizeEventType(raw) {
  if (!raw) return 'action';
  if (raw === 'conversation:started' || raw === 'conversation:completed' || raw === 'conversation_loaded') return 'conversation_loaded';
  if (raw === 'planner:started' || raw === 'planner:completed' || raw === 'intent_analyzed' || raw === 'planner:plan_created') return 'planner';
  if (raw === 'prompt:started' || raw === 'prompt:completed' || raw === 'prompt:assembled' || raw === 'prompt_construction') return 'prompt_construction';
  if (raw === 'llm_execution' || raw === 'llm:execution') return 'llm_execution';
  if (raw === 'llm:started' || raw === 'llm:request') return 'llm_request';
  if (raw === 'llm:completed' || raw === 'llm:response') return 'llm_response';
  if (raw === 'tool_execution' || raw === 'tool:execution') return 'tool_execution';
  if (raw === 'tool:started') return 'tool_invocation';
  if (raw === 'tool:completed') return 'tool_response';
  if (raw === 'memory:compaction_started' || raw === 'memory:compaction_completed') return 'compaction';
  if (raw.startsWith('retrieval:')) return 'retrieval_completed';
  return raw;
}

/**
 * Normalizes live TraceSession events into UI-ready event list
 */
function buildEventsFromTrace(traceEvents = []) {
  if (!Array.isArray(traceEvents)) return [];
  const events = traceEvents.map(evt => {
    const rawType = evt.eventType || evt.type || 'action';
    const canonicalType = normalizeEventType(rawType);
    return {
      type: canonicalType,
      eventType: rawType,
      callerType: evt.callerType || 'system',
      label: evt.label || canonicalType || 'Event',
      startedAt: evt.timestamp || evt.startedAt || new Date().toISOString(),
      endedAt: evt.endedAt || evt.timestamp || new Date().toISOString(),
      durationMs: typeof evt.durationMs === 'number' ? evt.durationMs : 0,
      spanId: evt.spanId,
      parentSpanId: evt.parentSpanId,
      traceId: evt.traceId,
      category: evt.category,
      status: evt.status,
      severity: evt.severity,
      error: evt.error || evt.payload?.error || null,
      diagnostics: evt.diagnostics || evt.payload?.diagnostics || null,
      warningMessage: evt.payload?.warningMessage || null,
      input: evt.payload?.input || evt.payload?.query || evt.payload?.args || null,
      output: evt.payload?.output || evt.payload?.result || evt.payload?.text || null,
      ...evt.payload
    };
  });

  // Ensure trace_completed event exists at the end
  if (!events.some(e => e.type === 'trace_completed')) {
    const lastEvt = events[events.length - 1];
    const completedAt = lastEvt?.startedAt || new Date().toISOString();
    events.push({
      type: 'trace_completed',
      eventType: 'trace_completed',
      callerType: 'system',
      label: 'Trace Complete',
      startedAt: completedAt,
      endedAt: completedAt,
      durationMs: 0,
      status: 'ok',
      input: '',
      output: ''
    });
  }

  return events;
}

module.exports = { buildEvents, buildEventsFromTrace };

