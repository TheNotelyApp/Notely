import React, { useEffect, useState, useCallback } from 'react';
import {
  Activity,
  Database,
  Cpu,
  AlertCircle,
  MessageSquare,
  ChevronRight,
  Terminal,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Wrench,
  Search,
  X,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  Clock,
  Trash2,
  Zap,
  ChevronDown,
  ChevronUp,
  Brain,
  FileText,
  Bot,
  Filter
} from 'lucide-react';
import { aiGetHealth, aiListConversations, aiGetMessages, aiGetLogs, aiClearLogs, aiClearConversations, onTelemetryEvent } from '../services/electronService';
import { useConfirm } from '../hooks/useConfirm';
import { renderMarkdown } from '../utils/renderUtils';
import '../styles/KnowledgeGraph.css';
import '../styles/AISettings.css';
import '../styles/AIHealthPage.css';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatPersonaName(p) {
  if (!p) return 'general';
  if (typeof p === 'object') return p.name || p.id || 'general';
  return String(p);
}

function fmtTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
  } catch { return iso; }
}

function fmtMs(ms) {
  if (ms == null || ms < 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function copyToClipboard(text, label) {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text);
    }
  } catch (err) {
    console.warn('Clipboard write failed:', err);
  }
  window.dispatchEvent(new CustomEvent('app:toast', { detail: { message: `${label} copied to clipboard`, type: 'success' } }));
}

// ─── Event config ───────────────────────────────────────────────────────────

const EVENT_CONFIG = {
  conversation_loaded: { icon: Brain, color: '#a78bfa', label: 'Context & Persona', bg: 'rgba(167,139,250,0.12)' },
  compaction: { icon: Database, color: '#a78bfa', label: 'History Compaction', bg: 'rgba(167,139,250,0.12)' },
  planner: { icon: Activity, color: '#60a5fa', label: 'Intent Planning', bg: 'rgba(96,165,250,0.12)' },
  intent_analyzed: { icon: Activity, color: '#60a5fa', label: 'Intent Analysis', bg: 'rgba(96,165,250,0.12)' },
  context_building: { icon: Database, color: '#34d399', label: 'Context Building', bg: 'rgba(52,211,153,0.12)' },
  retrieval_completed: { icon: Database, color: '#34d399', label: 'Context Aggregation', bg: 'rgba(52,211,153,0.12)' },
  vector_search: { icon: Search, color: '#34d399', label: 'Vector Search', bg: 'rgba(52,211,153,0.12)' },
  graph_traverse: { icon: Database, color: '#34d399', label: 'Graph Traversal', bg: 'rgba(52,211,153,0.12)' },
  prompt_construction: { icon: FileText, color: '#fbbf24', label: 'Prompt Construction', bg: 'rgba(251,191,36,0.12)' },
  'prompt:assembled': { icon: FileText, color: '#fbbf24', label: 'Prompt Assembly', bg: 'rgba(251,191,36,0.12)' },
  llm_execution: { icon: Bot, color: '#e879f9', label: 'LLM Execution', bg: 'rgba(232,121,249,0.12)' },
  llm_request: { icon: Bot, color: '#f472b6', label: 'LLM Request', bg: 'rgba(244,114,182,0.12)' },
  tool_execution: { icon: Wrench, color: '#fb923c', label: 'Tool Execution', bg: 'rgba(251,146,60,0.12)' },
  tool_invocation: { icon: Wrench, color: '#fb923c', label: 'Tool Invocation', bg: 'rgba(251,146,60,0.12)' },
  tool_response: { icon: Terminal, color: '#4ade80', label: 'Tool Response', bg: 'rgba(74,222,128,0.12)' },
  llm_response: { icon: Bot, color: '#e879f9', label: 'LLM Response', bg: 'rgba(232,121,249,0.12)' },
  final_response: { icon: CheckCircle, color: '#10b981', label: 'Final Response', bg: 'rgba(16,185,129,0.12)' },
  trace_completed: { icon: CheckCircle, color: '#10b981', label: 'Trace Complete', bg: 'rgba(16,185,129,0.12)' },
  warning: { icon: AlertCircle, color: '#f59e0b', label: 'Warning', bg: 'rgba(245,158,11,0.12)' },
  error: { icon: AlertCircle, color: '#f87171', label: 'Error', bg: 'rgba(248,113,113,0.12)' },
};

function getEventCfg(type) {
  if (EVENT_CONFIG[type]) return EVENT_CONFIG[type];
  if (type && type.includes('compaction')) return EVENT_CONFIG.compaction;
  if (type && type.includes('retrieval')) return EVENT_CONFIG.retrieval_completed;
  if (type && type.includes('warn')) return EVENT_CONFIG.warning;
  if (type && type.includes('error')) return EVENT_CONFIG.error;
  return { icon: Activity, color: '#94a3b8', label: type, bg: 'rgba(148,163,184,0.1)' };
}

// ─── Small reusable components ───────────────────────────────────────────────

function StatusDot({ ok }) {
  return <span className="ahp-status-dot" data-ok={ok ? 'true' : 'false'} />;
}

function StatCard({ label, value, accent }) {
  return (
    <div className="ahp-stat-card">
      <div className="ahp-stat-label">{label}</div>
      <div className="ahp-stat-value" style={accent ? { color: 'var(--accent-default)' } : {}}>{value}</div>
    </div>
  );
}

function DbRow({ label, count, countLabel, path, status }) {
  const ok = status === 'connected';
  return (
    <div className="ahp-db-row">
      <div className="ahp-db-row-header">
        <StatusDot ok={ok} />
        <span className="ahp-db-row-name">{label}</span>
        <span className="ahp-db-row-count">{count} {countLabel}</span>
      </div>
      <span className="ahp-db-row-path">{path || 'none'}</span>
    </div>
  );
}

// ─── Message bubble (Messages tab) ──────────────────────────────────────────

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  const tsFormatted = msg.created_at ? new Date(msg.created_at).toLocaleTimeString() : '';

  return (
    <div className={`ahp-bubble-wrap${isUser ? ' user' : ' assistant'}`}>
      <div className={`ahp-bubble${isUser ? ' user' : ' assistant'}`}>
        <div className="ahp-bubble-role" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{isUser ? '👤 User' : '🤖 Assistant'}</span>
          {tsFormatted && (
            <span style={{ fontSize: '10px', opacity: 0.7, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              <Clock size={12} /> {tsFormatted}
            </span>
          )}
        </div>
        <div className="ahp-bubble-content markdown-body" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
      </div>
    </div>
  );
}

// ─── Event detail panels ─────────────────────────────────────────────────────

function PreBlock({ label, children, copyValue, maxHeight = '160px' }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  let content = '';
  if (children == null) {
    content = '(no output returned)';
  } else if (typeof children === 'object') {
    try {
      content = JSON.stringify(children, null, 2);
    } catch {
      content = String(children);
    }
  } else {
    content = String(children);
  }
  if (!content.trim()) content = '(empty output)';

  return (
    <div className="atv-pre-wrap">
      {(label || copyValue !== undefined) && (
        <div className="atv-pre-header">
          {label && <span className="atv-pre-label">{label}</span>}
          {copyValue !== undefined && (
            <button
              type="button"
              className="atv-pre-copy"
              onClick={() => { copyToClipboard(typeof copyValue === 'string' ? copyValue : JSON.stringify(copyValue, null, 2), label || 'Value'); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          )}
        </div>
      )}
      <pre className="ahp-tool-pre" style={{ maxHeight: expanded ? 'none' : maxHeight, overflow: 'auto' }}>
        {content}
      </pre>
      {content.length > 300 && (
        <button type="button" className="atv-expand-btn" onClick={() => setExpanded(e => !e)}>
          {expanded ? <><ChevronUp size={12} /> Show less</> : <><ChevronDown size={12} /> Show more</>}
        </button>
      )}
    </div>
  );
}

function KV({ k, v }) {
  if (v == null || v === '' || v === 0) return null;
  return (
    <div className="atv-kv-row">
      <span className="atv-kv-key">{k}</span>
      <span className="atv-kv-val">{typeof v === 'boolean' ? (v ? '✓ yes' : '✗ no') : String(v)}</span>
    </div>
  );
}

function EventDetail({ event }) {
  const { type, startedAt, endedAt, durationMs, tokensUsed, input, output } = event;

  const startStr = startedAt ? fmtTime(startedAt) : null;
  const endStr = endedAt ? fmtTime(endedAt) : null;

  return (
    <div className="atv-event-detail">
      {/* Standardized performance & timestamp header bar */}
      <div className="atv-detail-meta-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px dashed var(--border-soft)' }}>
        {startStr && <span className="atv-stat-chip"><Clock size={12} /> Start: {startStr}</span>}
        {endStr && <span className="atv-stat-chip"><Clock size={12} /> End: {endStr}</span>}
        {durationMs != null && durationMs > 0 && <span className="atv-stat-chip"><Zap size={12} /> Latency: {fmtMs(durationMs)}</span>}
        {tokensUsed != null && tokensUsed > 0 && <span className="atv-stat-chip"><Bot size={12} /> {tokensUsed} tokens</span>}
      </div>

      {/* Module-specific Metadata */}
      {type === 'conversation_loaded' && (
        <>
          <KV k="Persona ID" v={event.personaId} />
          <KV k="Persona Name" v={event.personaName} />
          <KV k="History Messages" v={event.historyCount} />
          <KV k="Active Note" v={event.activeNotePath} />
          <KV k="Compacted" v={event.isCompacted} />
          <KV k="Turns Compacted" v={event.compactedTurnsCount} />
        </>
      )}

      {type === 'planner' && (
        <>
          <KV k="Confidence Score" v={event.confidenceScore > 0 ? `${(event.confidenceScore * 100).toFixed(0)}%` : null} />
          <KV k="Evidence Retrieved" v={event.evidenceLength > 0 ? `${event.evidenceLength} chars` : null} />
        </>
      )}

      {type === 'prompt_construction' && (
        <>
          <KV k="System Prompt Length" v={event.systemPromptLength} />
          <KV k="Harness Validated" v={event.harnessValid} />
          <SystemPromptViewer prompt={event.systemPrompt || event.turnSystemPrompt || ''} />
        </>
      )}

      {(type === 'tool_execution' || type === 'tool_invocation' || type === 'tool_response') && (
        <>
          <KV k="Tool" v={event.toolName} />
          <KV k="Type" v={event.toolType} />
          {event.args && <PreBlock label="Arguments (Input)" copyValue={event.args}>{event.args}</PreBlock>}
          {output !== undefined && output !== null && <PreBlock label="Response Output (Result)" copyValue={output}>{output}</PreBlock>}
        </>
      )}

      {(type === 'llm_execution' || type === 'llm_request' || type === 'llm_response') && (
        <>
          <KV k="Strategy" v={event.strategy} />
          <KV k="Tool Calls Count" v={event.toolCallsCount} />
          <KV k="Corrected" v={event.corrected} />
          {event.grounding && (
            <>
              <KV k="Verified Citations" v={event.grounding.verifiedCitations} />
              <KV k="Broken Citations" v={event.grounding.brokenCitations} />
            </>
          )}
        </>
      )}

      {type === 'trace_completed' && (
        <>
          <KV k="Total Turn Latency" v={fmtMs(event.totalDurationMs || durationMs)} />
          <KV k="Status" v={event.status || 'ok'} />
        </>
      )}

      {/* Input payload */}
      {type !== 'tool_execution' && type !== 'tool_invocation' && input != null && input !== '' && typeof input === 'string' && input.length > 0 && (
        <PreBlock label="Input Payload" copyValue={input}>{input}</PreBlock>
      )}

      {/* Output payload */}
      {type !== 'prompt_construction' && type !== 'tool_execution' && type !== 'tool_response' && output != null && output !== '' && typeof output === 'string' && output.length > 0 && (
        <PreBlock label="Output Payload" copyValue={output}>{output}</PreBlock>
      )}
    </div>
  );
}



// ─── System prompt viewer (shared across all traces for a flow) ──────────────

function SystemPromptViewer({ prompt }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fullHeight, setFullHeight] = useState(false);
  if (!prompt) return null;
  return (
    <div className="atv-sysprompt-block">
      <button
        type="button"
        className="atv-sysprompt-header"
        onClick={() => setOpen(o => !o)}
      >
        <Terminal size={12} />
        <span>Assembled System Prompt</span>
        <span className="atv-sysprompt-len">({prompt.length} chars)</span>
        <ChevronDown size={12} className={`atv-chevron${open ? ' open' : ''}`} />
      </button>
      {open && (
        <div className="atv-sysprompt-body">
          <div className="atv-sysprompt-actions">
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '10.5px', height: '24px', padding: '0 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              onClick={() => setFullHeight(f => !f)}
            >
              {fullHeight ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
              {fullHeight ? 'Collapse' : 'Expand'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '10.5px', height: '24px', padding: '0 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              onClick={() => { copyToClipboard(prompt, 'System prompt'); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <pre className="ahp-tool-pre" style={{ maxHeight: fullHeight ? 'none' : '220px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {prompt}
          </pre>
        </div>
      )}
    </div>
  );
}



// Wrapper that lets expandAll override local open state with classic glowing dot & continuous vertical line timeline
function EventRowControlled({ event, isLast, forceOpen, turnSystemPrompt }) {
  const [localOpen, setLocalOpen] = useState(false);
  const open = forceOpen || localOpen;
  const cfg = getEventCfg(event.type);
  const Icon = cfg.icon;
  const isSystemDriven = event.callerType === 'system' ||
    (event.callerType !== 'llm' && (
      event.type === 'conversation_loaded' ||
      event.type === 'planner' ||
      event.type === 'prompt_construction' ||
      event.type === 'llm_request' ||
      event.toolType === 'programmatic' ||
      event.toolType === 'pre-retrieval'
    ));

  const DriverIcon = isSystemDriven ? Zap : Bot;
  const driverLabel = isSystemDriven ? 'SYSTEM' : 'LLM';
  const enrichedEvent = turnSystemPrompt ? { ...event, turnSystemPrompt } : event;

  return (
    <div className="atv-timeline-row">
      {/* 1. Left timestamp */}
      <div className="atv-timeline-time-col">
        <Clock size={12} className="atv-time-icon" />
        <span>{fmtTime(event.startedAt)}</span>
      </div>

      {/* 2. Center continuous vertical line thread & glowing dot node */}
      <div className="atv-timeline-thread-col">
        <div className="atv-thread-line-top" />
        <div
          className="atv-timeline-dot-node"
          style={{
            background: cfg.bg,
            borderColor: cfg.color,
            boxShadow: `0 0 10px ${cfg.color}66`
          }}
        >
          <Icon size={12} style={{ color: cfg.color }} />
        </div>
        {!isLast && <div className="atv-thread-line-bottom" />}
      </div>

      {/* 3. Right expandable card container */}
      <div className={`atv-timeline-card${open ? ' open' : ''}`}>
        <button
          type="button"
          className="atv-card-header"
          onClick={() => setLocalOpen(o => !o)}
        >
          <span className="atv-card-title">{event.label || cfg.label}</span>
          <span className="atv-event-type-badge" style={{ background: cfg.bg, color: cfg.color }}>
            {event.type}
          </span>
          <span className={`atv-driver-badge ${isSystemDriven ? 'system' : 'llm'}`}>
            <DriverIcon size={12} /> {driverLabel}
          </span>

          <div className="atv-card-header-right">
            {event.durationMs != null && event.durationMs > 0 && (
              <span className="atv-duration-pill">
                <Zap size={12} /> {fmtMs(event.durationMs)}
              </span>
            )}
            <ChevronDown size={14} className={`atv-chevron${open ? ' open' : ''}`} />
          </div>
        </button>

        {open && (
          <div className="atv-card-body">
            <EventDetail event={enrichedEvent} />
          </div>
        )}
      </div>
    </div>
  );
}

function exportTraceAsMarkdown(meta, turnNumber) {
  const query = meta.query || '(no query)';
  const events = meta.events || [];
  let md = `# AI Execution Trace Report - Turn #${turnNumber}\n\n`;
  md += `- **Query:** "${query}"\n`;
  md += `- **Persona:** ${formatPersonaName(meta.persona)}\n`;
  md += `- **Total Latency:** ${fmtMs(meta.totalDurationMs || 0)}\n`;
  md += `- **Tokens:** ${meta.tokensUsed || 0} (${meta.tokensDetail ? `${meta.tokensDetail.promptTokens || 0} prompt / ${meta.tokensDetail.completionTokens || 0} completion` : 'n/a'})\n\n`;
  md += `## Timeline Spans & Events (${events.length})\n\n`;
  events.forEach((e, i) => {
    md += `### ${i + 1}. [${(e.callerType || 'system').toUpperCase()}] ${e.label || e.type}\n`;
    if (e.startedAt) md += `- **Timestamp:** \`${e.startedAt}\`\n`;
    if (e.durationMs) md += `- **Latency:** ${fmtMs(e.durationMs)}\n`;
    if (e.toolName) md += `- **Tool Name:** \`${e.toolName}\`\n`;
    if (e.input) md += `\n**Input Payload:**\n\`\`\`json\n${typeof e.input === 'string' ? e.input : JSON.stringify(e.input, null, 2)}\n\`\`\`\n`;
    if (e.output) md += `\n**Output Result:**\n\`\`\`json\n${typeof e.output === 'string' ? e.output : JSON.stringify(e.output, null, 2)}\n\`\`\`\n`;
    md += `\n---\n\n`;
  });
  copyToClipboard(md, `Turn #${turnNumber} Markdown Report`);
}

// ─── Flow Telemetry tab: Unified Single Thread View (Latest on Top) ─────────

function FlowTelemetryPane({ conv, flowLogs }) {
  const [filter, setFilter] = useState('all');
  const [expandAll, setExpandAll] = useState(false);
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(false);

  const filterTypes = [
    { id: 'all', label: 'All' },
    { id: 'system', label: '⚡ System-Driven' },
    { id: 'llm', label: '🤖 LLM-Driven' },
    { id: 'tool_execution', label: 'Tools' },
    { id: 'llm_execution', label: 'LLM' },
    { id: 'prompt_construction', label: 'Prompt' },
    { id: 'planner', label: 'Planner' },
    { id: 'error', label: 'Errors' }
  ];

  // Total stats across the conversation thread
  const totalTokens = flowLogs.reduce((acc, l) => acc + (l.metadata?.tokensUsed || 0), 0);
  const totalTools = flowLogs.reduce((acc, l) => acc + (Array.isArray(l.metadata?.events) ? l.metadata.events.filter(e => e.type === 'tool_execution' || e.type === 'tool_invocation').length : 0), 0);

  // Search filter
  const q = search.trim().toLowerCase();
  const filteredLogs = q
    ? flowLogs.filter(l => (l.metadata?.query || l.message || '').toLowerCase().includes(q))
    : flowLogs;

  // Copy full conversation telemetry
  const handleCopyFullThreadTelemetry = () => {
    const threadTelemetry = {
      conversationId: conv.id,
      conversationTitle: conv.title || 'Conversation',
      turnCount: flowLogs.length,
      totalTokens,
      totalTools,
      turns: flowLogs.map((logItem, idx) => ({
        turnNumber: flowLogs.length - idx,
        timestamp: logItem.timestamp,
        query: logItem.metadata?.query || logItem.message,
        persona: logItem.metadata?.persona,
        durationMs: logItem.metadata?.totalDurationMs || 0,
        tokensUsed: logItem.metadata?.tokensUsed || 0,
        systemPrompt: logItem.metadata?.systemPrompt || '',
        stages: logItem.metadata?.stages || [],
        events: logItem.metadata?.events || []
      }))
    };
    copyToClipboard(JSON.stringify(threadTelemetry, null, 2), 'Full Thread Telemetry JSON');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="atv-telemetry-pane">
      {/* Header bar with thread stats & actions */}
      <div className="atv-trace-detail-header" style={{ borderBottom: '1px solid var(--border-soft)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span className="atv-stat-chip atv-stat-accent"><Activity size={12} /> {flowLogs.length} Turns</span>
          <span className="atv-stat-chip"><Bot size={12} /> {totalTokens} Tokens</span>
          {totalTools > 0 && <span className="atv-stat-chip"><Wrench size={12} /> {totalTools} Tools</span>}
        </div>
        <div className="atv-trace-detail-actions" style={{ marginLeft: 'auto' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '11px', height: '28px', padding: '0 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            onClick={handleCopyFullThreadTelemetry}
            data-tooltip="Copy full conversation telemetry JSON"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            <span>{copied ? 'Copied Full Telemetry!' : 'Copy Full Telemetry'}</span>
          </button>
        </div>
      </div>

      {/* Filter & Expand controls */}
      <div className="atv-timeline-controls">
        <div className="atv-filter-row">
          <Filter size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          {filterTypes.map(ft => (
            <button
              key={ft.id}
              type="button"
              className={`atv-filter-chip${filter === ft.id ? ' active' : ''}`}
              onClick={() => setFilter(ft.id)}
            >
              {ft.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '11px', height: '28px', padding: '0 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            onClick={() => setExpandAll(true)}
            data-tooltip="Expand all timeline events"
          >
            <Maximize2 size={12} />
            <span>Expand All</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '11px', height: '28px', padding: '0 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            onClick={() => setExpandAll(false)}
            data-tooltip="Collapse all timeline events"
          >
            <Minimize2 size={12} />
            <span>Collapse</span>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="ahp-conv-search-wrap">
        <Search size={12} className="ahp-conv-search-icon" />
        <input
          className="ahp-conv-search"
          type="text"
          placeholder="Search conversation thread events…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button className="ahp-conv-search-clear" onClick={() => setSearch('')} type="button" aria-label="Clear">
            <X size={12} />
          </button>
        )}
      </div>

      {/* Thread Timeline Body — Merged single timeline with horizontal turn dividers, latest turn on top */}
      <div className="atv-timeline">
        {filteredLogs.length === 0 && (
          <div className="ahp-empty">
            {flowLogs.length === 0
              ? 'No flow telemetry recorded yet for this conversation thread. Send a message in chat to generate execution events.'
              : 'No execution events match your search.'}
          </div>
        )}

        {filteredLogs.map((logItem, turnIdx) => {
          const meta = logItem.metadata || {};
          const query = meta.query || logItem.message || '(no query)';
          const totalMs = meta.totalDurationMs || 0;
          const tokens = meta.tokensUsed || 0;
          const events = Array.isArray(meta.events) ? meta.events : [];
          const systemPrompt = meta.systemPrompt || '';
          const turnNumber = flowLogs.length - turnIdx; // Turn 3, Turn 2, Turn 1 (newest first)

          const filteredEvents = events.filter(e => {
            if (filter === 'all') return true;
            const isSys = e.callerType === 'system' ||
              e.type === 'conversation_loaded' ||
              e.type === 'planner' ||
              e.type === 'prompt_construction' ||
              e.type === 'llm_request' ||
              e.type === 'error' ||
              e.toolType === 'programmatic' ||
              e.toolType === 'pre-retrieval';

            if (filter === 'system') return isSys;
            if (filter === 'llm') return !isSys;
            return e.type === filter;
          });

          const tokensDetail = meta.tokensDetail || null;

          return (
            <React.Fragment key={logItem.id || `turn-${turnIdx}`}>
              {/* Horizontal Turn Divider Line */}
              <div className="atv-turn-divider">
                <div className="atv-turn-divider-line" />
                <div className="atv-turn-divider-content">
                  <span className="atv-turn-badge">Turn #{turnNumber}</span>
                  <span className="atv-turn-query" title={query}>&quot;{query}&quot;</span>
                  <div className="atv-turn-meta">
                    {totalMs > 0 && <span className="atv-stat-chip"><Clock size={12} /> {fmtMs(totalMs)}</span>}
                    {tokens > 0 && (
                      <span className="atv-stat-chip" title={tokensDetail ? `Prompt: ${tokensDetail.promptTokens || 0} | Completion: ${tokensDetail.completionTokens || 0}` : ''}>
                        <Bot size={12} /> {tokens} tok {tokensDetail ? `(${tokensDetail.promptTokens || 0}p/${tokensDetail.completionTokens || 0}c)` : ''}
                      </span>
                    )}
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: '9.5px', height: '20px', padding: '0 6px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(JSON.stringify(meta, null, 2), `Turn #${turnNumber} Telemetry JSON`);
                      }}
                      title={`Copy Turn #${turnNumber} Telemetry`}
                    >
                      <Copy size={12} /> Turn JSON
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: '9.5px', height: '20px', padding: '0 6px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        exportTraceAsMarkdown(meta, turnNumber);
                      }}
                      title={`Export Turn #${turnNumber} Markdown Report`}
                    >
                      <FileText size={12} /> Report
                    </button>
                  </div>
                </div>
                <div className="atv-turn-divider-line" />
              </div>

              {/* Legacy fallback notice for old logs */}
              {events.length === 0 && (
                <div className="atv-legacy-notice" style={{ margin: '6px 0 10px 0' }}>
                  <AlertCircle size={12} />
                  <span>Turn recorded before granular event logging.</span>
                </div>
              )}

              {/* Timeline events in this turn running along single timeline */}
              {filteredEvents.map((event, idx) => (
                <EventRowControlled
                  key={`${event.type}-${idx}`}
                  event={event}
                  turnSystemPrompt={systemPrompt}
                  isLast={idx === filteredEvents.length - 1 && turnIdx === filteredLogs.length - 1}
                  forceOpen={expandAll}
                />
              ))}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ─── ConversationPane ────────────────────────────────────────────────────────

function ConversationPane({ conv, onBack }) {
  const [messages, setMessages] = useState(null);
  const [flowLogs, setFlowLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('messages');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [msgRes, flowRes] = await Promise.all([
          aiGetMessages(conv.id),
          aiGetLogs('FlowTracker', 200, conv.id).catch(() => ({ success: true, data: [] }))
        ]);
        if (cancelled) return;

        if (msgRes?.success) setMessages(msgRes.data || []);
        else setError(msgRes?.error || 'Failed to load messages.');

        const rawFlow = flowRes?.success ? (flowRes.data || []) : [];

        // Strict conversation-scoped filtering
        const matchedFlow = rawFlow.filter(item => item.metadata?.conversationId === conv.id);

        // Sort latest turn first (newest turn strictly at top)
        matchedFlow.sort((a, b) => {
          const tA = new Date(a.timestamp).getTime() || a.id || 0;
          const tB = new Date(b.timestamp).getTime() || b.id || 0;
          return tB - tA;
        });
        setFlowLogs(matchedFlow);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();

    // Subscribe to live telemetry events for live updates
    let unsub = () => {};
    try {
      if (typeof onTelemetryEvent === 'function') {
        unsub = onTelemetryEvent((evt) => {
          if (!evt || evt.conversationId !== conv.id) return;
          aiGetLogs('FlowTracker', 200, conv.id).then(res => {
            if (!cancelled && res?.success) {
              const rawFlow = res.data || [];
              const matched = rawFlow.filter(item => item.metadata?.conversationId === conv.id);
              matched.sort((a, b) => (new Date(b.timestamp).getTime() || 0) - (new Date(a.timestamp).getTime() || 0));
              setFlowLogs(matched);
            }
          }).catch(() => {});
        });
      }
    } catch { /* ignore subscription error */ }

    return () => {
      cancelled = true;
      unsub();
    };
  }, [conv.id]);

  return (
    <div className="ahp-trace-pane">
      <div className="ahp-trace-header">
        <button
          className="btn btn-secondary btn-sm"
          onClick={onBack}
          type="button"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '28px', padding: '0 10px', marginBottom: '8px' }}
          data-tooltip="Back to conversation list"
        >
          <ArrowLeft size={14} />
          <span>Back to Conversations</span>
        </button>
        <div className="ahp-trace-title">{conv.title}</div>
        <div className="ahp-trace-meta">Persona: {formatPersonaName(conv.persona)} &middot; {new Date(conv.created_at).toLocaleDateString()}</div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
          <button
            className={`btn ${activeTab === 'messages' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '28px', padding: '0 10px', fontSize: '12px' }}
            onClick={() => setActiveTab('messages')}
            type="button"
          >
            <MessageSquare size={12} />
            <span>Messages</span>
            <span className="ahp-conv-count" style={{ marginLeft: '2px' }}>{messages?.length || 0}</span>
          </button>
          <button
            className={`btn ${activeTab === 'flow' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '28px', padding: '0 10px', fontSize: '12px' }}
            onClick={() => setActiveTab('flow')}
            type="button"
          >
            <Activity size={12} />
            <span>Flow Telemetry</span>
            <span className="ahp-conv-count" style={{ marginLeft: '2px' }}>{flowLogs.length}</span>
          </button>
        </div>
      </div>

      <div className={`ahp-trace-body${activeTab === 'flow' ? ' is-flow-tab' : ''}`}>
        {loading && <div className="ahp-empty">Loading&hellip;</div>}
        {error && <div className="ahp-error-bar"><AlertCircle size={14} /> {error}</div>}

        {!loading && !error && activeTab === 'messages' && (
          <>
            {messages?.length === 0 && <div className="ahp-empty">No messages in this conversation.</div>}
            {messages?.map((msg, idx) => <MessageBubble key={msg.id || `msg-${idx}`} msg={msg} />)}
          </>
        )}

        {!loading && !error && activeTab === 'flow' && (
          <FlowTelemetryPane conv={conv} flowLogs={flowLogs} />
        )}
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function AIHealthPage({ onBack }) {
  const { confirm } = useConfirm();
  const [health, setHealth] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [convSearch, setConvSearch] = useState('');
  const [, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [healthRes, convRes] = await Promise.all([
        aiGetHealth(),
        aiListConversations().catch(() => ({ success: true, data: [] }))
      ]);
      if (healthRes?.success) setHealth(healthRes.data);
      else setError(healthRes?.error || 'Failed to fetch diagnostics.');
      if (convRes?.success) setConversations(convRes.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const db = health?.database;
  const stats = health?.systemStats;

  const q = convSearch.trim().toLowerCase();
  const filteredConversations = q
    ? conversations.filter(c =>
      c.title.toLowerCase().includes(q) ||
      formatPersonaName(c.persona).toLowerCase().includes(q)
    )
    : conversations;

  return (
    <div className="knowledge-graph-page ahp-root">
      <div className="detail-topbar">
        <nav className="detail-breadcrumb" aria-label="Health location">
          <span className="detail-breadcrumb-part">
            <button className="detail-breadcrumb-link" type="button" onClick={onBack}>Notes</button>
            <span className="detail-breadcrumb-separator" aria-hidden="true">/</span>
          </span>
          <span className="detail-breadcrumb-current">AI Health &amp; Diagnostics</span>
        </nav>
      </div>

      <div className="ahp-body">
        {/* Left column */}
        <div className="ahp-left">
          {error && <div className="ahp-error-bar"><AlertCircle size={14} />{error}</div>}

          <div className="ahp-card">
            <div className="ahp-card-header">
              <Cpu size={14} /><span>Subsystem State</span>
            </div>
            <div className="ahp-card-rows">
              <div className="ahp-row">
                <span>AI Engine</span>
                <span className="ahp-pill" data-ok={health?.enabled ? 'true' : 'false'}>
                  {health?.enabled ? <><CheckCircle size={12} /> Enabled</> : <><XCircle size={12} /> Disabled</>}
                </span>
              </div>
              <div className="ahp-row">
                <span>Orchestrator</span>
                <span className="ahp-pill" data-ok={health?.initialized ? 'true' : 'false'}>
                  {health?.initialized ? <><CheckCircle size={12} /> Ready</> : <><XCircle size={12} /> Not initialized</>}
                </span>
              </div>
              <div className="ahp-row">
                <span>Active Provider</span>
                <strong className="ahp-provider">{health?.activeProvider || '—'}</strong>
              </div>
              <div className="ahp-row">
                <span>Indexer Status</span>
                <span style={{
                  color: health?.isIndexing ? 'var(--accent-warning)' : health?.isPaused ? 'var(--text-muted)' : 'var(--accent-solid)',
                  fontWeight: 600
                }}>
                  {health?.isIndexing ? 'Indexing...' : health?.isPaused ? 'Paused' : 'Ready'}
                </span>
              </div>
            </div>
          </div>

          <div className="ahp-card">
            <div className="ahp-card-header">
              <Activity size={14} /><span>Session Usage</span>
            </div>
            <div className="ahp-stat-grid">
              <StatCard label="Requests" value={stats?.requestsCount ?? 0} />
              <StatCard label="Tokens" value={stats?.tokensUsed ?? 0} />
              <StatCard label="Conversations" value={health?.database?.totalConversations ?? conversations.length} accent />
            </div>
          </div>

          <div className="ahp-card">
            <div className="ahp-card-header">
              <Database size={14} /><span>Database Connections</span>
            </div>
            <div className="ahp-db-list">
              <DbRow label="Telemetry DB" count={db?.totalTelemetry ?? 0} countLabel="flows" path={db?.telemetryDBPath} status={db?.status} />
              <DbRow label="Logs DB" count={db?.totalLogs ?? 0} countLabel="entries" path={db?.logDBPath} status={db?.status} />
              <DbRow label="Persona Registry" count={db?.totalPersonas ?? 0} countLabel="personas" path={db?.personaDBPath} status={db?.status} />
              <DbRow label="Embeddings DB" count={db?.totalChunks ?? 0} countLabel="chunks" path={db?.embeddingDBPath} status={db?.status} />
              <DbRow label="Knowledge Graph" count={db?.totalRelations ?? 0} countLabel="relations" path={db?.graphDBPath} status={db?.status} />
            </div>
          </div>

          {/* Database Cleanup */}
          <div className="ahp-card" style={{ padding: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-strong)', marginBottom: '8px' }}>
              <Trash2 size={12} style={{ color: 'var(--status-danger-text, #ef4444)' }} />
              <span>Database & Telemetry Cleanup</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                id="ahp-log-cleanup-select"
                defaultValue="now"
                className="select-input"
                style={{ flex: 1, minWidth: '130px', fontSize: '11px', height: '26px' }}
              >
                <option value="now">All Records (Now)</option>
                <option value="1h">Older than 1 Hour</option>
                <option value="24h">Older than 24 Hours</option>
                <option value="7d">Older than 7 Days</option>
              </select>
              <button
                type="button"
                onClick={async () => {
                  const sel = document.getElementById('ahp-log-cleanup-select')?.value || 'now';
                  let beforeTs = null;
                  const now = Date.now();
                  if (sel === 'now') beforeTs = new Date(now).toISOString();
                  else if (sel === '1h') beforeTs = new Date(now - 3600 * 1000).toISOString();
                  else if (sel === '24h') beforeTs = new Date(now - 86400 * 1000).toISOString();
                  else if (sel === '7d') beforeTs = new Date(now - 7 * 86400 * 1000).toISOString();

                  const timeLabel = sel === 'now' ? 'now' : sel;
                  const ok = await confirm({
                    title: 'Clear AI Data & Telemetry',
                    message: `Are you sure you want to clear AI conversations, telemetry, and logs up to ${timeLabel}? This action cannot be undone.`,
                    confirmText: 'Clear Data',
                    cancelText: 'Cancel',
                    isDanger: true,
                  });
                  if (!ok) return;

                  await aiClearLogs(null, beforeTs);
                  await aiClearConversations(beforeTs).catch(() => {});

                  window.dispatchEvent(new CustomEvent('app:toast', { detail: { message: `Conversations & telemetry cleared (${sel})`, type: 'info' } }));
                  setSelectedConv(null);
                  load();
                }}
                className="btn btn-secondary"
                style={{ fontSize: '11px', height: '26px', padding: '0 10px', display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--status-danger-text, #ef4444)' }}
              >
                <Trash2 size={12} /> Clear Data
              </button>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="ahp-right">
          {selectedConv ? (
            <ConversationPane conv={selectedConv} onBack={() => setSelectedConv(null)} />
          ) : (
            <div className="ahp-conv-list-pane">
              <div className="ahp-conv-list-header">
                <MessageSquare size={14} /><span>Conversation History</span>
                <span className="ahp-conv-count">
                  {q ? `${filteredConversations.length} / ${conversations.length}` : conversations.length}
                </span>
              </div>
              <div className="ahp-conv-search-wrap">
                <Search size={12} className="ahp-conv-search-icon" />
                <input
                  className="ahp-conv-search"
                  type="text"
                  placeholder="Search conversations…"
                  value={convSearch}
                  onChange={e => setConvSearch(e.target.value)}
                />
                {convSearch && (
                  <button className="ahp-conv-search-clear" onClick={() => setConvSearch('')} type="button" aria-label="Clear search">
                    <X size={12} />
                  </button>
                )}
              </div>
              {filteredConversations.length === 0 ? (
                <div className="ahp-empty">
                  {conversations.length === 0
                    ? 'No conversations yet. Start chatting to see history here.'
                    : 'No matches for your search.'}
                </div>
              ) : (
                <div className="ahp-conv-list">
                  {filteredConversations.map(conv => (
                    <button key={conv.id} className="ahp-conv-item" onClick={() => setSelectedConv(conv)} type="button">
                      <div className="ahp-conv-title">{conv.title}</div>
                      <div className="ahp-conv-meta">
                        <span>Persona: {formatPersonaName(conv.persona)}</span>
                        <span>{new Date(conv.updated_at).toLocaleString()}</span>
                      </div>
                      <ChevronRight size={14} className="ahp-conv-arrow" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
