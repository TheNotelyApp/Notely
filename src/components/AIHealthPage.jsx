import React, { useEffect, useState, useCallback } from 'react';
import {
  Activity,
  Database,
  Cpu,
  AlertCircle,
  RefreshCw,
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
  Trash2
} from 'lucide-react';
import { aiGetHealth, aiListConversations, aiGetMessages, aiGetLogs, aiClearLogs } from '../services/electronService';
import { renderMarkdown } from '../utils/renderUtils';
import '../styles/KnowledgeGraph.css';
import '../styles/AISettings.css';
import '../styles/AIHealthPage.css';

function StatusDot({ ok }) {
  return (
    <span className="ahp-status-dot" data-ok={ok ? 'true' : 'false'} />
  );
}

function formatPersonaName(p) {
  if (!p) return 'general';
  if (typeof p === 'object') return p.name || p.id || 'general';
  return String(p);
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

function ToolCallBlock({ step }) {
  const [open, setOpen] = useState(false);
  const name = step.name || step.tool || step.toolName || 'tool_call';
  const isProgrammatic = step.type === 'programmatic';
  const args = step.args || step.parameters || step.input || {};
  const rawOutput = typeof step.output !== 'undefined' ? step.output : typeof step.result !== 'undefined' ? step.result : typeof step.response !== 'undefined' ? step.response : '(empty)';
  const formattedOutput = typeof rawOutput === 'object' && rawOutput !== null ? JSON.stringify(rawOutput, null, 2) : String(rawOutput);

  return (
    <div className="ahp-tool-call" style={{ margin: '6px 0' }}>
      <button
        className="ahp-tool-call-header"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(o => !o);
        }}
        type="button"
        style={{ cursor: 'pointer', padding: '8px 10px' }}
      >
        <Wrench size={12} className="ahp-tool-icon" />
        <span className="ahp-tool-name">{name}</span>
        <span style={{
          fontSize: '10px',
          fontWeight: 600,
          padding: '1px 6px',
          borderRadius: '4px',
          background: isProgrammatic ? 'var(--bg-tertiary, rgba(255, 255, 255, 0.08))' : 'rgba(99, 102, 241, 0.15)',
          color: isProgrammatic ? 'var(--text-muted, #a0aec0)' : 'var(--accent-default, #6366f1)',
          marginLeft: '4px'
        }}>
          {isProgrammatic ? '⚡ Pre-Retrieval' : '🤖 LLM Call'}
        </span>
        <span className="ahp-tool-args-preview" style={{ marginLeft: 'auto', opacity: 0.7 }}>{JSON.stringify(args).slice(0, 40)}</span>
        <ChevronRight size={12} className={`ahp-tool-chevron${open ? ' open' : ''}`} />
      </button>
      {open && (
        <div className="ahp-tool-body" style={{ padding: '8px 10px' }}>
          <div className="ahp-tool-section-label">Execution Source</div>
          <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-normal)', marginBottom: '6px' }}>
            {isProgrammatic ? '⚡ Programmatic Context Retrieval (Pre-LLM Orchestration)' : '🤖 Direct LLM Autonomous Tool Execution'}
          </div>
          <div className="ahp-tool-section-label">Args</div>
          <pre className="ahp-tool-pre">{JSON.stringify(args, null, 2)}</pre>
          <div className="ahp-tool-section-label">Output</div>
          <pre className="ahp-tool-pre">{formattedOutput}</pre>
        </div>
      )}
    </div>
  );
}

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

function FlowTelemetryCard({ logItem, hideLeftTimestamp, hideDotNode }) {
  const [open, setOpen] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [fullPrompt, setFullPrompt] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedTrace, setCopiedTrace] = useState(false);

  const meta = logItem.metadata || {};
  const sysPrompt = meta.systemPrompt || '';
  const stages = meta.stages || [];
  const queryText = meta.query || logItem.message || 'N/A';
  const totalDurationMs = meta.totalDurationMs || 0;
  const tokensUsed = meta.tokensUsed || 0;

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(sysPrompt);
    setCopied(true);
    window.dispatchEvent(new CustomEvent('app:toast', { detail: { message: 'System prompt copied to clipboard', type: 'success' } }));
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyTrace = (e) => {
    e.stopPropagation();
    const tracePayload = {
      flowId: meta.flowId || logItem.id,
      persona: formatPersonaName(meta.persona),
      userQuery: queryText,
      totalDurationMs,
      tokensUsed,
      timestamp: logItem.timestamp,
      executionStages: stages,
      executedTools: toolCalls,
      assembledSystemPrompt: sysPrompt
    };
    navigator.clipboard.writeText(JSON.stringify(tracePayload, null, 2));
    setCopiedTrace(true);
    window.dispatchEvent(new CustomEvent('app:toast', { detail: { message: 'Full flow trace JSON copied to clipboard', type: 'success' } }));
    setTimeout(() => setCopiedTrace(false), 2000);
  };

  const stage4 = stages.find(s => s.stage === 4);
  const toolCalls = stage4?.toolCalls || meta.toolCalls || meta.executedTools || meta.trace || [];

  return (
    <div className="ahp-tool-call" style={{ margin: '0 0 8px 0', border: '1px solid var(--border-soft, rgba(255,255,255,0.08))', borderRadius: '8px', overflow: 'hidden', background: 'var(--surface-bg)' }}>
      <button
        className="ahp-tool-call-header"
        onClick={() => setOpen(o => !o)}
        type="button"
        style={{
          padding: '10px 14px',
          background: 'var(--bg-secondary, rgba(255,255,255,0.02))',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          width: '100%',
          textAlign: 'left'
        }}
      >
        {!hideLeftTimestamp && (
          <span className="ahp-pill" style={{
            fontSize: '10.5px',
            fontWeight: 600,
            background: 'var(--surface-subtle, rgba(255,255,255,0.04))',
            color: 'var(--text-muted, #a0aec0)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            flexShrink: 0,
            fontFamily: 'monospace',
            width: '95px'
          }}>
            <Clock size={12} /> {new Date(logItem.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        )}

        {!hideDotNode && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <span style={{
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              background: 'var(--accent-default, #6366f1)',
              color: '#fff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 8px rgba(99, 102, 241, 0.45)',
              flexShrink: 0
            }}>
              <Activity size={12} />
            </span>
          </div>
        )}

        <span className="ahp-tool-name" style={{ fontWeight: 600, color: 'var(--text-normal)', flexShrink: 0 }}>
          AIFlow &middot; {formatPersonaName(meta.persona)}
        </span>

        <span className="ahp-tool-args-preview" style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', opacity: 0.85, flex: 1, margin: '0 4px' }}>
          &quot;{queryText}&quot;
        </span>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
          {totalDurationMs > 0 && (
            <span className="ahp-pill" style={{ fontSize: '10px', background: 'rgba(99,102,241,0.15)', color: 'var(--accent-default, #6366f1)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              ⚡ {totalDurationMs}ms
            </span>
          )}
          {tokensUsed > 0 && (
            <span className="ahp-pill" style={{ fontSize: '10px', fontWeight: 600 }}>
              {tokensUsed} tokens
            </span>
          )}
          <ChevronRight size={14} className={`ahp-tool-chevron${open ? ' open' : ''}`} />
        </div>
      </button>

      {open && (
        <div className="ahp-tool-body" style={{ padding: '14px', gap: '10px', display: 'flex', flexDirection: 'column' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <div className="ahp-tool-section-label" style={{ margin: 0 }}>User Query</div>
              <button
                className="btn btn-secondary"
                type="button"
                style={{ fontSize: '10.5px', height: '22px', padding: '0 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                onClick={handleCopyTrace}
              >
                {copiedTrace ? <Check size={12} /> : <Copy size={12} />}
                {copiedTrace ? 'Copied Trace!' : 'Copy Full Trace JSON'}
              </button>
            </div>
            <pre className="ahp-tool-pre" style={{ whiteSpace: 'pre-wrap', maxHeight: '80px', margin: '4px 0' }}>{queryText}</pre>
          </div>

          <div>
            <div className="ahp-tool-section-label">Execution Timeline ({stages.length || 5} Stages)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px', position: 'relative', paddingLeft: '4px' }}>
              <div style={{
                position: 'absolute',
                left: '18px',
                top: '12px',
                bottom: '12px',
                width: '2px',
                background: 'rgba(99, 102, 241, 0.3)',
                zIndex: 0
              }} />
              {stages.map((stg) => (
                <div key={stg.stage} style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '6px 10px',
                  background: 'var(--surface-bg, rgba(20, 20, 30, 0.95))',
                  border: '1px solid var(--border-soft, rgba(255, 255, 255, 0.08))',
                  borderRadius: '6px',
                  fontSize: '11px',
                  gap: '10px',
                  position: 'relative',
                  zIndex: 1
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <span style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: 'var(--accent-default, #6366f1)',
                      color: '#fff',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '10px',
                      boxShadow: '0 0 8px rgba(99, 102, 241, 0.4)'
                    }}>
                      {stg.stage}
                    </span>
                    <span style={{ fontWeight: 600, color: 'var(--text-normal)' }}>{stg.name}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, fontSize: '10.5px', color: 'var(--text-muted)' }}>
                    <span style={{ opacity: 0.4 }}>→</span>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                      padding: '2px 7px',
                      borderRadius: '4px',
                      background: 'rgba(99, 102, 241, 0.15)',
                      color: 'var(--accent-default, #6366f1)',
                      fontWeight: 600,
                      fontSize: '10px'
                    }}>
                      <Clock size={12} /> {stg.durationMs}ms
                    </span>
                  </div>

                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10.5px', color: 'var(--text-muted)' }}>
                    {stg.stage === 1 && stg.personaName && <span>Persona: <strong>{stg.personaName}</strong></span>}
                    {stg.stage === 2 && stg.confidenceScore > 0 && <span>Confidence: <strong>{(stg.confidenceScore * 100).toFixed(0)}%</strong></span>}
                    {stg.stage === 4 && stg.toolCallsCount > 0 && <span>Tools: <strong>{stg.toolCallsCount}</strong></span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {toolCalls.length > 0 && (
            <div style={{ border: '1px solid var(--border-color, rgba(255,255,255,0.08))', borderRadius: '6px' }}>
              <button
                type="button"
                onClick={() => setShowTools(t => !t)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-normal)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: 600 }}>
                  <Terminal size={12} /> Executed Tool Calls ({toolCalls.length})
                </div>
                <ChevronRight size={12} className={`ahp-tool-chevron${showTools ? ' open' : ''}`} />
              </button>
              {showTools && (
                <div style={{ padding: '8px 10px 10px' }}>
                  {toolCalls.map((step, i) => (
                    <ToolCallBlock key={i} step={step} />
                  ))}
                </div>
              )}
            </div>
          )}

          {sysPrompt && (
            <div style={{ border: '1px solid var(--border-color, rgba(255,255,255,0.08))', borderRadius: '6px' }}>
              <button
                type="button"
                onClick={() => setShowPrompt(p => !p)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-normal)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: 600 }}>
                  <Terminal size={12} /> Assembled System Prompt ({sysPrompt.length} chars)
                </div>
                <ChevronRight size={12} className={`ahp-tool-chevron${showPrompt ? ' open' : ''}`} />
              </button>
              {showPrompt && (
                <div style={{ padding: '8px 10px 10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginBottom: '6px' }}>
                    <button
                      className="btn btn-secondary"
                      type="button"
                      style={{ fontSize: '10.5px', height: '24px', padding: '0 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      onClick={handleCopy}
                    >
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <button
                      className="btn btn-secondary"
                      type="button"
                      style={{ fontSize: '10.5px', height: '24px', padding: '0 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      onClick={() => setFullPrompt(f => !f)}
                    >
                      {fullPrompt ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                      {fullPrompt ? 'Collapse Height' : 'Expand Height'}
                    </button>
                  </div>
                  <pre className="ahp-tool-pre" style={{ maxHeight: fullPrompt ? 'none' : '220px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {sysPrompt}
                  </pre>
                </div>
              )}
            </div>
          )}

          <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '4px' }}>Logged at {new Date(logItem.timestamp).toLocaleString()}</div>
        </div>
      )}
    </div>
  );
}

function TimelineFlowRow({ logItem, isLast }) {
  const meta = logItem.metadata || {};
  const timeStr = new Date(logItem.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'stretch' }}>
      {/* Left timestamp */}
      <div style={{
        width: '68px',
        fontSize: '11px',
        fontWeight: 600,
        color: 'var(--text-muted)',
        fontFamily: 'monospace',
        flexShrink: 0,
        textAlign: 'right',
        paddingTop: '10px',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-end',
        gap: '4px'
      }}>
        <Clock size={12} style={{ opacity: 0.7, marginTop: '1px' }} />
        <span>{timeStr}</span>
      </div>

      {/* Center glowing dot node & continuous vertical timeline thread */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ width: '2px', height: '10px', background: 'rgba(99, 102, 241, 0.35)', flexShrink: 0 }} />
        <div style={{
          width: '22px',
          height: '22px',
          borderRadius: '50%',
          background: 'var(--accent-default, #6366f1)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 10px rgba(99, 102, 241, 0.5)',
          flexShrink: 0,
          zIndex: 2
        }}>
          <Activity size={12} />
        </div>
        {!isLast && <div style={{ width: '2px', flex: 1, background: 'rgba(99, 102, 241, 0.35)', minHeight: '16px' }} />}
      </div>

      {/* Flow card on right */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <FlowTelemetryCard logItem={logItem} hideLeftTimestamp hideDotNode />
      </div>
    </div>
  );
}

function ConversationPane({ conv, onBack }) {
  const [messages, setMessages] = useState(null);
  const [flowLogs, setFlowLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('messages');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedSession, setCopiedSession] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [msgRes, flowRes, promptRes] = await Promise.all([
          aiGetMessages(conv.id),
          aiGetLogs('FlowTracker', 100, conv.id).catch(() => ({ success: true, data: [] })),
          aiGetLogs('PromptTracker', 100, conv.id).catch(() => ({ success: true, data: [] }))
        ]);
        const loadedMessages = msgRes?.success ? (msgRes.data || []) : [];
        if (msgRes?.success) setMessages(loadedMessages);
        else setError(msgRes?.error || 'Failed to load messages.');

        const rawFlowLogs = flowRes?.success ? (flowRes.data || []) : [];
        const rawPromptLogs = promptRes?.success ? (promptRes.data || []) : [];
        const combinedLogs = [...rawFlowLogs, ...rawPromptLogs];

        // Strict session ID matching to prevent leaking flow cards across different chats
        const filtered = combinedLogs.filter(item => {
          const itemConvId = item.metadata?.conversationId;
          return itemConvId === conv.id;
        });
        setFlowLogs(filtered);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [conv.id]);

  return (
    <div className="ahp-trace-pane">
      <div className="ahp-trace-header">
        <button className="ahp-back-btn" onClick={onBack} type="button">
          <ArrowLeft size={14} /> Conversations
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
      <div className="ahp-trace-body">
        {loading && <div className="ahp-empty">Loading details&hellip;</div>}
        {error && <div className="ahp-error-bar"><AlertCircle size={14} /> {error}</div>}
        {!loading && !error && activeTab === 'messages' && (
          <>
            {messages?.length === 0 && <div className="ahp-empty">No messages in this conversation.</div>}
            {messages?.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
          </>
        )}
        {!loading && !error && activeTab === 'flow' && (
          <>
            {flowLogs.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
                <button
                  className="btn btn-secondary"
                  type="button"
                  style={{ fontSize: '11px', height: '26px', padding: '0 10px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  onClick={() => {
                    const exportData = {
                      conversationId: conv.id,
                      title: conv.title,
                      persona: formatPersonaName(conv.persona),
                      totalLogs: flowLogs.length,
                      telemetry: flowLogs.map(l => ({
                        timestamp: l.timestamp,
                        query: l.metadata?.query || l.message,
                        persona: formatPersonaName(l.metadata?.persona),
                        totalDurationMs: l.metadata?.totalDurationMs,
                        tokensUsed: l.metadata?.tokensUsed,
                        stages: l.metadata?.stages,
                        systemPrompt: l.metadata?.systemPrompt
                      }))
                    };
                    navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
                    setCopiedSession(true);
                    window.dispatchEvent(new CustomEvent('app:toast', { detail: { message: 'All session telemetry JSON copied to clipboard', type: 'success' } }));
                    setTimeout(() => setCopiedSession(false), 2500);
                  }}
                >
                  {copiedSession ? <Check size={12} style={{ color: '#10b981' }} /> : <Copy size={12} />}
                  {copiedSession ? 'Copied All Session Telemetry!' : 'Copy All Session Telemetry JSON'}
                </button>
              </div>
            )}
            {flowLogs.length === 0 && <div className="ahp-empty">No flow telemetry logs recorded yet.</div>}
            {flowLogs.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                {flowLogs.map((item, idx) => (
                  <TimelineFlowRow key={item.id} logItem={item} isLast={idx === flowLogs.length - 1} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {copiedSession && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: 'var(--bg-secondary, #1e1e2e)',
          color: 'var(--text-normal, #fff)',
          border: '1px solid var(--accent-default, #6366f1)',
          borderRadius: '8px',
          padding: '10px 16px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '12px',
          fontWeight: 600,
          zIndex: 9999
        }}>
          <Check size={14} style={{ color: '#10b981' }} />
          <span>Copied all session flow telemetry JSON to clipboard!</span>
        </div>
      )}
    </div>
  );
}

export default function AIHealthPage({ onBack }) {
  const [health, setHealth] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [convSearch, setConvSearch] = useState('');
  const [loading, setLoading] = useState(false);
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
          {error && (
            <div className="ahp-error-bar"><AlertCircle size={14} />{error}</div>
          )}

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
              <DbRow label="Logs DB" count={db?.totalLogs ?? 0} countLabel="entries" path={db?.logDBPath} status={db?.status} />
              <DbRow label="Persona Registry" count={db?.totalPersonas ?? 0} countLabel="personas" path={db?.personaDBPath} status={db?.status} />
              <DbRow label="Embeddings DB" count={db?.totalChunks ?? 0} countLabel="chunks" path={db?.embeddingDBPath} status={db?.status} />
              <DbRow label="Knowledge Graph" count={db?.totalRelations ?? 0} countLabel="relations" path={db?.graphDBPath} status={db?.status} />
            </div>
          </div>

          {/* Database Cleanup Control Card */}
          <div className="ahp-card" style={{ padding: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-strong)', marginBottom: '8px' }}>
              <Trash2 size={12} style={{ color: 'var(--status-danger-text, #ef4444)' }} />
              <span>Database Logs Cleanup</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <select
                id="ahp-log-cleanup-select"
                defaultValue="now"
                className="select-input"
                style={{ flex: 1, fontSize: '11px', height: '26px' }}
              >
                <option value="now">All Logs (Default / Now)</option>
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
                  if (!window.confirm(`Clear logs up to ${sel === 'now' ? 'now' : sel}?`)) return;
                  await aiClearLogs(null, beforeTs);
                  window.dispatchEvent(new CustomEvent('app:toast', { detail: { message: 'Database logs cleared', type: 'info' } }));
                  load();
                }}
                className="btn btn-secondary"
                style={{ fontSize: '11px', height: '26px', padding: '0 8px', display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--status-danger-text, #ef4444)' }}
              >
                <Trash2 size={12} />
                Clear
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
