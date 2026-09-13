import React, { useState, useEffect, useCallback } from 'react';
import {
  Server,
  Play,
  Square,
  Copy,
  Check,
  RefreshCw,
  Wrench,
  BookOpen
} from 'lucide-react';
import { mcpGetStatus, mcpStart, mcpStop, mcpGetConfigSnippets } from '../services/electronService';
import AppButton from './AppButton';
import AppCard from './AppCard';
import AppBadge from './AppBadge';

export function MCPSettingsContent({ onNotify }) {
  const [status, setStatus] = useState({ running: false, port: 3721, workspace: '' });
  const [snippets, setSnippets] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);
  const [activeSnippetTab, setActiveSnippetTab] = useState('claude-sse');

  const loadData = useCallback(async () => {
    try {
      const [st, sn] = await Promise.all([
        mcpGetStatus(),
        mcpGetConfigSnippets()
      ]);
      if (st) setStatus(st);
      if (sn) setSnippets(sn);
    } catch (err) {
      console.warn('[MCP UI] Error fetching status:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 4000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleToggleServer = async () => {
    setLoading(true);
    try {
      if (status.running) {
        await mcpStop();
      } else {
        await mcpStart();
      }
      await loadData();
    } catch (err) {
      onNotify?.(err.message || 'Failed to toggle MCP server', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(typeof text === 'string' ? text : JSON.stringify(text, null, 2));
    setCopiedKey(key);
    onNotify?.('Configuration copied to clipboard!', 'success');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const currentSnippet = () => {
    if (!snippets) return '';
    switch (activeSnippetTab) {
      case 'claude-sse':
        return JSON.stringify(snippets.claudeDesktopSse, null, 2);
      case 'claude-stdio':
        return JSON.stringify(snippets.claudeDesktopStdio, null, 2);
      case 'cursor':
        return JSON.stringify(snippets.cursorMcp, null, 2);
      case 'antigravity':
        return JSON.stringify(snippets.antigravityMcp, null, 2);
      default:
        return '';
    }
  };

  return (
    <div className="mcp-settings-content" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Server Status Header Card */}
      <AppCard style={{ padding: '1.25rem', border: '1px solid var(--border-color, #e2e8f0)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: status.running ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: status.running ? '#16a34a' : '#dc2626'
              }}
            >
              <Server size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>Notely Model Context Protocol (MCP)</h4>
                <AppBadge variant={status.running ? 'success' : 'default'}>
                  {status.running ? 'Running (HTTP SSE)' : 'Stopped'}
                </AppBadge>
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted, #64748b)', marginTop: '0.2rem' }}>
                {status.running
                  ? `Listening on http://127.0.0.1:${status.port}/sse`
                  : `Server is stopped (Port ${status.port})`}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <AppButton
              variant={status.running ? "small" : "primary"}
              onClick={handleToggleServer}
              disabled={loading}
            >
              {status.running ? <Square size={14} style={{ marginRight: '4px' }} /> : <Play size={14} style={{ marginRight: '4px' }} />}
              {status.running ? 'Stop Server' : 'Start Server'}
            </AppButton>
            <AppButton onClick={loadData}>
              <RefreshCw size={14} style={{ marginRight: '4px' }} />
              Refresh
            </AppButton>
          </div>
        </div>

        {status.workspace && (
          <div
            style={{
              marginTop: '1rem',
              paddingTop: '0.85rem',
              borderTop: '1px solid var(--border-color, #e2e8f0)',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: 'var(--text-muted, #64748b)'
            }}
          >
            <div>Workspace root: <code>{status.workspace}</code></div>
            <div>Knowledge graph: <strong>active</strong></div>
          </div>
        )}
      </AppCard>

      {/* Client Setup Snippets */}
      <AppCard style={{ padding: '1.25rem', border: '1px solid var(--border-color, #e2e8f0)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 600 }}>Connect AI Assistant</h4>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted, #64748b)' }}>
              Paste into your external AI assistant&apos;s config file to grant it secure access to your notes and knowledge graph.
            </p>
          </div>
          <AppButton
            onClick={() => handleCopy(currentSnippet(), activeSnippetTab)}
          >
            {copiedKey === activeSnippetTab ? <Check size={14} style={{ marginRight: '4px' }} /> : <Copy size={14} style={{ marginRight: '4px' }} />}
            {copiedKey === activeSnippetTab ? 'Copied' : 'Copy JSON'}
          </AppButton>
        </div>

        {/* Client Selector Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          {[
            { id: 'claude-sse', label: 'Claude Desktop (SSE)' },
            { id: 'cursor', label: 'Cursor (.cursor/mcp.json)' },
            { id: 'antigravity', label: 'Antigravity / Cline' },
            { id: 'claude-stdio', label: 'Claude Desktop (Stdio CLI)' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSnippetTab(tab.id)}
              style={{
                fontSize: '0.78rem',
                fontWeight: 500,
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: activeSnippetTab === tab.id ? 'var(--primary-color, #3b82f6)' : 'var(--border-color, #e2e8f0)',
                background: activeSnippetTab === tab.id ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                color: activeSnippetTab === tab.id ? 'var(--primary-color, #3b82f6)' : 'inherit',
                cursor: 'pointer'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Code Block */}
        <pre
          style={{
            margin: 0,
            padding: '0.85rem 1rem',
            background: 'var(--bg-secondary, #1e293b)',
            color: '#f8fafc',
            borderRadius: '8px',
            fontSize: '0.8rem',
            fontFamily: 'Consolas, Monaco, "Courier New", monospace',
            overflowX: 'auto'
          }}
        >
          <code>{currentSnippet()}</code>
        </pre>
      </AppCard>

      {/* Capabilities Overview: Tools & Personas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        {/* Tools Card */}
        <AppCard style={{ padding: '1rem', border: '1px solid var(--border-color, #e2e8f0)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
            <Wrench size={16} color="var(--primary-color, #3b82f6)" />
            <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 600 }}>Available MCP Tools</h4>
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <li><code>list_notes</code> - List files in workspace</li>
            <li><code>read_note</code> - Read note markdown & line slices</li>
            <li><code>create_note</code> - Create new note safely</li>
            <li><code>update_note</code> - Edit or patch note</li>
            <li><code>search_notes</code> - Full-text & token relevance search</li>
            <li><code>get_note_graph</code> - Backlinks & forward link map</li>
            <li><code>list_tasks</code> - Extract all open checkboxes</li>
          </ul>
        </AppCard>

        {/* Prompts (Personas) Card */}
        <AppCard style={{ padding: '1rem', border: '1px solid var(--border-color, #e2e8f0)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
            <BookOpen size={16} color="#8b5cf6" />
            <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 600 }}>MCP Prompts (Personas)</h4>
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <li><code>general</code> - General knowledge assistant</li>
            <li><code>software-engineer</code> - Code refactoring & patterns</li>
            <li><code>technical-architect</code> - System design & tradeoffs</li>
            <li><code>research-assistant</code> - Note synthesis & concept gaps</li>
          </ul>
        </AppCard>
      </div>
    </div>
  );
}

export default MCPSettingsContent;
