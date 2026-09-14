import React, { useEffect, useState, useCallback } from 'react';
import {
  Activity,
  Database,
  AlertCircle,
  Wrench,
  Search,
  X,
  Copy,
  Check,
  Clock,
  Trash2,
  Zap,
  RefreshCw,
  Radio,
  FileCode,
  ShieldAlert,
  ChevronRight
} from 'lucide-react';
import {
  aiGetHealth,
  aiGetLogs,
  aiClearLogs,
  onTelemetryEvent,
  mcpGetStatus,
  mcpGetSessions,
  onMcpStatusChanged
} from '../services/electronService';
import { useConfirm } from '../hooks/useConfirm';
import '../styles/KnowledgeGraph.css';
import '../styles/AISettings.css';
import '../styles/AIHealthPage.css';

// ─── Formatting Helpers ──────────────────────────────────────────────────────

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

function formatJson(val) {
  if (val == null) return 'null';
  if (typeof val === 'string') {
    try {
      return JSON.stringify(JSON.parse(val), null, 2);
    } catch {
      return val;
    }
  }
  try {
    return JSON.stringify(val, null, 2);
  } catch {
    return String(val);
  }
}

function highlightJsonToHtml(jsonStr) {
  if (!jsonStr) return '';
  const safe = String(jsonStr)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return safe.replace(
    /("(?:\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = 'json-number';
      if (match.startsWith('"')) {
        if (/:\s*$/.test(match)) {
          cls = 'json-key';
          const colonIdx = match.lastIndexOf(':');
          return `<span class="${cls}">${match.slice(0, colonIdx)}</span>${match.slice(colonIdx)}`;
        }
        cls = 'json-string';
      } else if (match === 'true' || match === 'false') {
        cls = 'json-boolean';
      } else if (match === 'null') {
        cls = 'json-null';
      }
      return `<span class="${cls}">${match}</span>`;
    }
  );
}

// ─── Sub-Components ─────────────────────────────────────────────────────────

function StatusDot({ ok }) {
  return <span className="ahp-status-dot" data-ok={ok ? 'true' : 'false'} />;
}

function DbRow({ label, count, countLabel, status }) {
  const ok = status === 'connected';
  return (
    <div className="ahp-db-row">
      <div className="ahp-db-row-header">
        <StatusDot ok={ok} />
        <span className="ahp-db-row-name">{label}</span>
        <span className="ahp-db-row-count">{count} {countLabel || ''}</span>
      </div>
    </div>
  );
}

// ─── Main MCP Diagnostics Component ─────────────────────────────────────────

export default function AIHealthPage({ onBack }) {
  const { confirm } = useConfirm();
  const [loading, setLoading] = useState(true);
  const [healthData, setHealthData] = useState(null);
  const [mcpStatus, setMcpStatus] = useState(null);
  const [mcpSessions, setMcpSessions] = useState([]);
  const [toolCalls, setToolCalls] = useState([]);
  const [expandedCallId, setExpandedCallId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [toolFilter, setToolFilter] = useState('ALL');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [hRes, sRes, sessRes, logsRes] = await Promise.all([
        aiGetHealth().catch(() => null),
        mcpGetStatus().catch(() => null),
        mcpGetSessions().catch(() => ({ active: [] })),
        aiGetLogs('mcp', 100).catch(() => [])
      ]);

      if (hRes) setHealthData(hRes.data || hRes);
      if (sRes) setMcpStatus(sRes.data || sRes);
      if (sessRes) setMcpSessions((sessRes.data?.active || sessRes.active) || []);

      const logsArray = Array.isArray(logsRes?.data) ? logsRes.data : (Array.isArray(logsRes) ? logsRes : []);
      const calls = logsArray.map((item, idx) => {
        const meta = item.metadata || item;
        return {
          id: item.id || `call_${idx}_${Date.now()}`,
          callId: item.callId || meta.callId || item.call_id || `call_${idx}`,
          sessionId: item.sessionId || meta.sessionId || item.session_id || 'default',
          clientName: item.clientName || meta.clientName || item.client_name || 'Antigravity / External Client',
          toolName: item.toolName || meta.toolName || item.tool_name || item.query || 'mcp_tool',
          input: item.input !== undefined ? item.input : (meta.input || meta.input_payload || item.payload),
          output: item.output !== undefined ? item.output : (meta.output || meta.output_payload),
          durationMs: item.durationMs ?? meta.durationMs ?? meta.totalDurationMs ?? item.duration_ms ?? 0,
          status: (item.status || meta.status || 'SUCCESS').toUpperCase(),
          error: item.error || meta.error || null,
          calledAt: item.calledAt || item.timestamp || item.created_at || meta.calledAt || new Date().toISOString()
        };
      });
      setToolCalls(calls);
    } catch (err) {
      console.error('[MCP Diagnostics] Fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    const unsubTel = onTelemetryEvent(() => {
      fetchData();
    });

    const unsubMcp = onMcpStatusChanged((newStatus) => {
      setMcpStatus(newStatus);
    });

    return () => {
      if (typeof unsubTel === 'function') unsubTel();
      if (typeof unsubMcp === 'function') unsubMcp();
    };
  }, [fetchData]);

  const handleClearLogs = async () => {
    const isOk = await confirm({
      title: 'Clear MCP Telemetry Logs',
      message: 'Are you sure you want to clear all recorded MCP tool calls and activity logs? This action cannot be undone.',
      confirmText: 'Clear Logs',
      cancelText: 'Cancel',
      type: 'danger'
    });

    if (isOk) {
      try {
        await aiClearLogs();
        await fetchData();
        window.dispatchEvent(new CustomEvent('app:toast', { detail: { message: 'MCP Telemetry logs cleared', type: 'info' } }));
      } catch (err) {
        console.error('Clear logs failed:', err);
      }
    }
  };

  const handleCopyCode = (text, keyId, label = 'Content') => {
    copyToClipboard(text, label);
    setCopiedId(keyId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filter tool calls
  const filteredCalls = toolCalls.filter(c => {
    if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
    if (toolFilter !== 'ALL' && c.toolName !== toolFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = c.toolName.toLowerCase().includes(q);
      const matchClient = c.clientName.toLowerCase().includes(q);
      const matchErr = c.error ? String(c.error).toLowerCase().includes(q) : false;
      if (!matchName && !matchClient && !matchErr) return false;
    }
    return true;
  });

  // Unique tool names for filter dropdown
  const uniqueTools = Array.from(new Set(toolCalls.map(c => c.toolName))).filter(Boolean);

  // Health summary metrics
  const isRunning = mcpStatus?.running ?? healthData?.enabled ?? false;
  const serverPort = mcpStatus?.port || 3700;
  const serverHost = mcpStatus?.host || '127.0.0.1';
  const mcpMetrics = healthData?.mcp || {};
  const activeConnCount = mcpSessions.length || mcpMetrics.activeConnections || 0;
  const totalCallsCount = mcpMetrics.totalToolCalls || toolCalls.length;
  const successRate = mcpMetrics.successRate ?? (totalCallsCount > 0 ? 100 : 100);
  const failedCount = mcpMetrics.failedCalls || toolCalls.filter(c => c.status === 'FAILED').length;
  const topTools = mcpMetrics.mostUsedTools || [];
  const dbStats = healthData?.database || {};

  return (
    <div className="knowledge-graph-page">
      {/* Unified topbar navigation breadcrumb */}
      <div className="detail-topbar">
        <nav className="detail-breadcrumb" aria-label="MCP Diagnostics location">
          <span className="detail-breadcrumb-part">
            <button className="detail-breadcrumb-link" type="button" onClick={onBack}>
              Workspace
            </button>
            <span className="detail-breadcrumb-separator" aria-hidden="true">
              /
            </span>
          </span>
          <span className="detail-breadcrumb-current">MCP Diagnostics</span>
        </nav>
      </div>

      {/* Header Actions Bar — matching Knowledge Graph & Embeddings page */}
      <div className="kg-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', height: '52px', boxSizing: 'border-box' }}>
        {/* Sleek Running Status Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', background: 'var(--surface-muted)', border: '1px solid var(--border-soft)', padding: '0 12px', borderRadius: '6px', height: '32px', boxSizing: 'border-box' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: isRunning ? 'var(--status-success-text)' : 'var(--status-danger-text)' }}>
            <span style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: isRunning ? 'var(--status-success-text)' : 'var(--status-danger-text)',
              boxShadow: isRunning ? '0 0 6px var(--status-success-text)' : 'none'
            }} />
            MCP Server {isRunning ? 'Running' : 'Stopped'}
          </span>
          <span style={{ width: '1px', height: '10px', background: 'var(--border-soft)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Port:</span>
            <strong style={{ color: 'var(--text-strong)' }}>{serverPort}</strong>
          </div>
          <span style={{ width: '1px', height: '10px', background: 'var(--border-soft)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Active Clients:</span>
            <strong style={{ color: 'var(--text-strong)' }}>{activeConnCount}</strong>
          </div>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={fetchData}
            style={{ height: '32px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '6px', boxSizing: 'border-box' }}
            title="Refresh telemetry metrics"
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={handleClearLogs}
            style={{ height: '32px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--status-danger-text)', boxSizing: 'border-box' }}
            title="Clear telemetry logs"
          >
            <Trash2 size={14} />
            <span>Clear Logs</span>
          </button>
        </div>
      </div>

      {/* Main Two-Column Body */}
      <div className="ahp-body">
        {/* Left Column: Subsystem & Metrics Cards Sidebar */}
        <div className="ahp-left">
          {/* MCP Server Overview */}
          <div className="ahp-card">
            <div className="ahp-card-header">
              <Radio size={14} /> MCP Server Overview
            </div>
            <div className="ahp-card-rows">
              <div className="ahp-row">
                <span>MCP</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <code style={{ fontSize: '11px', fontFamily: 'monospace' }}>http://{serverHost}:{serverPort}/mcp</code>
                  <button
                    type="button"
                    style={{
                      border: 'none',
                      background: 'transparent',
                      width: '20px',
                      height: '20px',
                      padding: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      borderRadius: '4px'
                    }}
                    onClick={() => handleCopyCode(`http://${serverHost}:${serverPort}/mcp`, 'endpoint_http', 'MCP Endpoint URL')}
                    title={copiedId === 'endpoint_http' ? 'Copied to clipboard' : 'Copy MCP Endpoint URL'}
                    aria-label="Copy MCP Endpoint URL"
                  >
                    {copiedId === 'endpoint_http' ? <Check size={12} style={{ color: 'var(--status-success-text)' }} /> : <Copy size={12} />}
                  </button>
                </div>
              </div>
              <div className="ahp-row">
                <span>SSE</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <code style={{ fontSize: '11px', fontFamily: 'monospace' }}>http://{serverHost}:{serverPort}/sse</code>
                  <button
                    type="button"
                    style={{
                      border: 'none',
                      background: 'transparent',
                      width: '20px',
                      height: '20px',
                      padding: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      borderRadius: '4px'
                    }}
                    onClick={() => handleCopyCode(`http://${serverHost}:${serverPort}/sse`, 'endpoint_sse', 'SSE Endpoint URL')}
                    title={copiedId === 'endpoint_sse' ? 'Copied to clipboard' : 'Copy SSE Endpoint URL'}
                    aria-label="Copy SSE Endpoint URL"
                  >
                    {copiedId === 'endpoint_sse' ? <Check size={12} style={{ color: 'var(--status-success-text)' }} /> : <Copy size={12} />}
                  </button>
                </div>
              </div>
              <div className="ahp-row">
                <span>Transport Protocol</span>
                <span className="ahp-provider">Streamable HTTP &amp; SSE</span>
              </div>
              <div className="ahp-row">
                <span>MCP Spec Version</span>
                <span>2024-11-05</span>
              </div>
              <div className="ahp-row">
                <span>Total Sessions Recorded</span>
                <span>{mcpMetrics.totalSessions || mcpSessions.length || 0}</span>
              </div>
            </div>
          </div>

          {/* Execution Metrics Stat Grid */}
          <div className="ahp-card">
            <div className="ahp-card-header">
              <Activity size={14} /> Tool Execution Activity
            </div>
            <div className="ahp-stat-grid">
              <div className="ahp-stat-card">
                <div className="ahp-stat-label">Total Calls</div>
                <div className="ahp-stat-value">{totalCallsCount}</div>
              </div>
              <div className="ahp-stat-card">
                <div className="ahp-stat-label">Success Rate</div>
                <div className="ahp-stat-value" style={{ color: successRate >= 95 ? 'var(--status-success-text)' : 'var(--status-danger-text)' }}>
                  {successRate}%
                </div>
              </div>
              <div className="ahp-stat-card">
                <div className="ahp-stat-label">Failures</div>
                <div className="ahp-stat-value" style={{ color: failedCount > 0 ? 'var(--status-danger-text)' : 'inherit' }}>
                  {failedCount}
                </div>
              </div>
            </div>
          </div>

          {/* Top Tools Pills */}
          {topTools.length > 0 && (
            <div className="ahp-card">
              <div className="ahp-card-header">
                <Zap size={14} style={{ color: '#eab308' }} /> Frequently Invoked Tools
              </div>
              <div style={{ padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {topTools.map((t, i) => (
                  <span key={i} className="atv-stat-chip atv-stat-accent">
                    <FileCode size={12} />
                    <code style={{ fontFamily: 'monospace' }}>{t.toolName}</code>
                    <span style={{ opacity: 0.7 }}>({t.count})</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Subsystem Storage Health */}
          <div className="ahp-card">
            <div className="ahp-card-header">
              <Database size={14} /> Subsystem Storage Health
            </div>
            <div className="ahp-db-list">
              <DbRow
                label="Vector DB Chunks"
                count={`${dbStats.totalChunks || 0} chunks (${dbStats.indexedNotes || 0} notes)`}
                status={dbStats.status}
              />
              <DbRow
                label="Knowledge Graph"
                count={`${dbStats.totalEntities || 0} nodes / ${dbStats.totalRelations || 0} edges`}
                status={dbStats.status}
              />
              <DbRow
                label="Telemetry Database"
                count={`${totalCallsCount} logs`}
                status={dbStats.status}
              />
            </div>
          </div>
        </div>

        {/* Right Column: Flight Log Inspector */}
        <div className="ahp-right">
          <div className="ahp-conv-list-header">
            <Wrench size={14} /> MCP Activity &amp; Tool Call Flight Log
            <span className="ahp-conv-count">{filteredCalls.length}</span>
          </div>

          {/* Search and Filters Bar */}
          <div className="ahp-conv-search-wrap">
            <Search size={14} className="ahp-conv-search-icon" />
            <input
              type="text"
              className="ahp-conv-search"
              placeholder="Filter by tool or client..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="ahp-conv-search-clear" onClick={() => setSearchQuery('')}>
                <X size={12} />
              </button>
            )}

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{
                height: '24px',
                fontSize: '11px',
                padding: '0 6px',
                background: 'var(--surface-bg)',
                color: 'var(--app-text)',
                border: '1px solid var(--border-soft)',
                borderRadius: 'var(--radius-sm)'
              }}
            >
              <option value="ALL">All Statuses</option>
              <option value="SUCCESS">SUCCESS</option>
              <option value="FAILED">FAILED</option>
            </select>

            {uniqueTools.length > 0 && (
              <select
                value={toolFilter}
                onChange={e => setToolFilter(e.target.value)}
                style={{
                  height: '24px',
                  fontSize: '11px',
                  padding: '0 6px',
                  background: 'var(--surface-bg)',
                  color: 'var(--app-text)',
                  border: '1px solid var(--border-soft)',
                  borderRadius: 'var(--radius-sm)'
                }}
              >
                <option value="ALL">All Tools</option>
                {uniqueTools.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            )}
          </div>

          {/* Tool Calls Flight Log Timeline */}
          <div className="atv-trace-list">
            {filteredCalls.length === 0 ? (
              <div className="ahp-empty">
                <AlertCircle size={20} style={{ marginBottom: '8px', opacity: 0.5 }} />
                <br />
                No MCP tool call events recorded yet. Connect an external MCP client (such as Claude Desktop or Cursor) to inspect tool executions.
              </div>
            ) : (
              filteredCalls.map((call) => {
                const isExpanded = expandedCallId === call.id;
                const isSuccess = call.status === 'SUCCESS';
                const formattedInput = isExpanded ? formatJson(call.input) : null;
                const formattedOutput = isExpanded ? formatJson(call.output) : null;

                return (
                  <div
                    key={call.id}
                    className={`ahp-tool-call${isExpanded ? ' open' : ''}`}
                  >
                    {/* Collapsed Item Header */}
                    <button
                      type="button"
                      className="ahp-tool-call-header"
                      onClick={() => setExpandedCallId(isExpanded ? null : call.id)}
                    >
                      <Wrench size={14} className="ahp-tool-icon" style={{ color: isSuccess ? 'var(--status-success-text)' : 'var(--status-danger-text)' }} />
                      <span className="ahp-tool-name">{call.toolName}</span>
                      <span className="ahp-tool-args-preview">
                        Client: {call.clientName}
                      </span>
                      <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                        <Clock size={12} /> {fmtMs(call.durationMs)}
                      </span>
                      <span className="ahp-pill" data-ok={isSuccess ? 'true' : 'false'} style={{ marginLeft: '8px', flexShrink: 0 }}>
                        {call.status}
                      </span>
                      <ChevronRight size={14} className={`ahp-tool-chevron${isExpanded ? ' open' : ''}`} style={{ flexShrink: 0 }} />
                    </button>

                    {/* Expanded Detail Inspector */}
                    {isExpanded && (
                      <div className="ahp-tool-body">
                        {call.error && (
                          <div className="ahp-error-bar" style={{ marginBottom: '10px' }}>
                            <ShieldAlert size={16} />
                            <span><strong>Execution Failure:</strong> {String(call.error)}</span>
                          </div>
                        )}

                        <div style={{ marginBottom: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span className="ahp-tool-section-label">INPUT PAYLOAD (Sanitized)</span>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ height: '22px', fontSize: '10.5px', padding: '0 6px' }}
                              onClick={() => handleCopyCode(formattedInput, `${call.id}_in`, 'Input payload')}
                            >
                              {copiedId === `${call.id}_in` ? <Check size={12} style={{ color: 'var(--status-success-text)' }} /> : <Copy size={12} />} Copy Input
                            </button>
                          </div>
                          <pre
                            className="ahp-tool-pre"
                            dangerouslySetInnerHTML={{ __html: highlightJsonToHtml(formattedInput) }}
                          />
                        </div>

                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span className="ahp-tool-section-label">OUTPUT PAYLOAD (Sanitized)</span>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ height: '22px', fontSize: '10.5px', padding: '0 6px' }}
                              onClick={() => handleCopyCode(formattedOutput, `${call.id}_out`, 'Output payload')}
                            >
                              {copiedId === `${call.id}_out` ? <Check size={12} style={{ color: 'var(--status-success-text)' }} /> : <Copy size={12} />} Copy Output
                            </button>
                          </div>
                          <pre
                            className="ahp-tool-pre"
                            dangerouslySetInnerHTML={{ __html: highlightJsonToHtml(formattedOutput) }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
