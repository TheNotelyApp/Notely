import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Search, RefreshCw, Trash2, Download, Terminal, Filter, FolderOpen, Activity, AlertTriangle, ShieldAlert } from 'lucide-react';
import { appLogQuery, appLogClear, appLogStats, appLogOpenFolder, aiGetLogs, aiClearLogs } from '../services/electronService';
import useConfirm from '../hooks/useConfirm';
import AppButton from './AppButton';
import SubpageHeader from './layout/SubpageHeader';

import '../styles/KnowledgeGraph.css';

export default function AppLogsPage({ onBack }) {
  const { confirm } = useConfirm();
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [subsystemFilter, setSubsystemFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchLogs = useCallback(async () => {
    try {
      // 1. Attempt query from central Enterprise LogCore
      const sub = subsystemFilter === 'all' ? null : subsystemFilter;
      const lvl = levelFilter === 'all' ? null : levelFilter;
      const cat = categoryFilter === 'all' ? null : categoryFilter;

      const res = await appLogQuery({
        subsystem: sub,
        level: lvl,
        category: cat,
        search: searchQuery.trim() || null,
        limit: 500
      });

      if (res && res.success && res.data && Array.isArray(res.data.rows)) {
        setLogs(res.data.rows);
      } else {
        // Fallback to legacy AI logs API if central logger not reachable
        const fallbackRes = await aiGetLogs(sub, 200);
        if (fallbackRes && fallbackRes.success && Array.isArray(fallbackRes.data)) {
          setLogs(fallbackRes.data);
        }
      }

      // Fetch telemetry summary stats
      const statsRes = await appLogStats();
      if (statsRes && statsRes.success && statsRes.data) {
        setStats(statsRes.data);
      }
    } catch (err) {
      console.error('Failed to fetch application logs:', err);
    }
  }, [subsystemFilter, levelFilter, categoryFilter, searchQuery]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (levelFilter !== 'all' && log.level !== levelFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const msgMatch = String(log.message || '').toLowerCase().includes(query);
        const subMatch = String(log.subsystem || '').toLowerCase().includes(query);
        const sourceMatch = String(log.source || '').toLowerCase().includes(query);
        return msgMatch || subMatch || sourceMatch;
      }
      return true;
    });
  }, [logs, levelFilter, searchQuery]);

  const handleClear = async () => {
    const ok = await confirm({
      title: "Clear System Logs",
      message: "Are you sure you want to clear system logs? Forensic crash & audit logs are safely preserved.",
      confirmLabel: "Clear Logs",
      variant: "danger",
    });
    if (!ok) return;
    try {
      const sub = subsystemFilter === 'all' ? null : subsystemFilter;
      await Promise.allSettled([
        appLogClear({ subsystem: sub }),
        aiClearLogs(sub)
      ]);
      await fetchLogs();
    } catch (err) {
      console.error('Failed to clear logs:', err);
    }
  };

  const handleExport = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(filteredLogs, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `notely-system-logs-${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err) {
      console.error('Export logs failed:', err);
    }
  };

  return (
    <div className="knowledge-graph-page">
      <SubpageHeader
        currentTitle="System & Application Logs"
        breadcrumbParent="Workspace"
        onBack={onBack}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AppButton
              variant="secondary"
              size="small"
              onClick={() => appLogOpenFolder()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              title="Open central log database folder"
            >
              <FolderOpen size={14} />
              <span>Log Folder</span>
            </AppButton>

            <AppButton
              variant="secondary"
              size="small"
              onClick={() => setAutoRefresh(!autoRefresh)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={14} className={autoRefresh ? 'spin' : ''} />
              <span>{autoRefresh ? 'Live Auto-Refresh' : 'Paused'}</span>
            </AppButton>

            <AppButton
              variant="secondary"
              size="small"
              onClick={handleExport}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Download size={14} />
              <span>Export</span>
            </AppButton>

            <AppButton
              variant="secondary"
              size="small"
              onClick={handleClear}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-danger)' }}
            >
              <Trash2 size={14} />
              <span>Clear</span>
            </AppButton>
          </div>
        }
      />

      <div className="knowledge-graph-container" style={{ display: 'flex', flexDirection: 'column', padding: '16px', gap: '16px', height: 'calc(100vh - 80px)' }}>
        {/* Enterprise Telemetry Bar */}
        {stats && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '10px 16px', background: 'var(--surface-elevated)', borderRadius: 'var(--radius-default)', border: '1px solid var(--border-soft)', fontSize: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
              <Activity size={14} style={{ color: 'var(--accent-solid)' }} />
              <span>Total Logs: <strong style={{ color: 'var(--text-strong)' }}>{stats.total || filteredLogs.length}</strong></span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
              <AlertTriangle size={14} style={{ color: 'var(--text-warning)' }} />
              <span>Warnings (24h): <strong style={{ color: 'var(--text-warning)' }}>{stats.warns || 0}</strong></span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
              <ShieldAlert size={14} style={{ color: 'var(--text-danger)' }} />
              <span>Errors / Crashes (24h): <strong style={{ color: 'var(--text-danger)' }}>{stats.errors || 0}</strong></span>
            </div>

            {stats.dbSizeMb && (
              <div style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '11px' }}>
                Store Size: <span style={{ color: 'var(--text-strong)', fontWeight: 600 }}>{stats.dbSizeMb} MB</span> (SQLite WAL)
              </div>
            )}
          </div>
        )}

        {/* Controls Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', background: 'var(--surface-elevated)', padding: '10px 16px', borderRadius: 'var(--radius-default)', border: '1px solid var(--border-soft)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '280px' }}>
            <div className="kg-search-wrapper" style={{ flex: 1, margin: 0, height: '32px', display: 'flex', alignItems: 'center' }}>
              <Search size={16} className="kg-search-icon" />
              <input
                type="text"
                className="kg-search-input"
                placeholder="Search log messages, sources, or events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ height: '32px', boxSizing: 'border-box', fontSize: '12px' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '32px' }}>
              <Filter size={14} style={{ color: 'var(--text-muted)' }} />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={{ height: '32px', boxSizing: 'border-box', background: 'var(--surface-bg)', color: 'var(--text-strong)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-default)', padding: '0 10px', fontSize: '12px', outline: 'none', cursor: 'pointer' }}
              >
                <option value="all">All Categories</option>
                <option value="app">App / Core</option>
                <option value="ai">AI Subsystem</option>
                <option value="git">Git VC</option>
                <option value="mcp">MCP Tools</option>
                <option value="telemetry">Telemetry</option>
                <option value="crash">Crash & Forensics</option>
                <option value="ui">UI & Renderer</option>
              </select>

              <select
                value={subsystemFilter}
                onChange={(e) => setSubsystemFilter(e.target.value)}
                style={{ height: '32px', boxSizing: 'border-box', background: 'var(--surface-bg)', color: 'var(--text-strong)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-default)', padding: '0 10px', fontSize: '12px', outline: 'none', cursor: 'pointer' }}
              >
                <option value="all">All Subsystems</option>
                <option value="graph">Knowledge Graph</option>
                <option value="embeddings">Embeddings Engine</option>
                <option value="app">Application</option>
                <option value="main">Electron Main</option>
                <option value="git">Git VC</option>
                <option value="ai">AI Agent</option>
                <option value="mcp_tools">MCP Tools</option>
                <option value="process">Process Lifecycle</option>
              </select>

              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                style={{ height: '32px', boxSizing: 'border-box', background: 'var(--surface-bg)', color: 'var(--text-strong)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-default)', padding: '0 10px', fontSize: '12px', outline: 'none', cursor: 'pointer' }}
              >
                <option value="all">All Severity</option>
                <option value="debug">Debug</option>
                <option value="info">Info</option>
                <option value="warn">Warning</option>
                <option value="error">Error</option>
                <option value="fatal">Fatal / Crash</option>
              </select>
            </div>
          </div>
        </div>

        {/* Logs Console Container */}
        <div style={{ flex: 1, background: 'var(--surface-muted)', borderRadius: 'var(--radius-default)', border: '1px solid var(--border-soft)', padding: '0', overflowY: 'auto', fontFamily: 'monospace', fontSize: '11px', display: 'flex', flexDirection: 'column' }}>
          {/* Sticky Table Header */}
          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 2,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 12px',
              background: 'var(--surface-elevated)',
              borderBottom: '1px solid var(--border-default)',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}
          >
            <span style={{ width: '135px', flexShrink: 0 }}>Timestamp</span>
            <span style={{ width: '46px', flexShrink: 0, textAlign: 'center' }}>Level</span>
            <span style={{ width: '74px', flexShrink: 0, textAlign: 'center' }}>Category</span>
            <span style={{ width: '110px', flexShrink: 0 }}>Subsystem</span>
            <span style={{ flex: 1 }}>Message</span>
            <span style={{ width: '45px', flexShrink: 0, textAlign: 'right' }}>Elapsed</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '6px 8px' }}>
          {filteredLogs.length > 0 ? (
            filteredLogs.map((item, idx) => {
              const isFatal = item.level === 'fatal';
              const isErr = item.level === 'error' || isFatal;
              const isWarn = item.level === 'warn';
              const levelColor = isFatal ? '#ef4444' : isErr ? 'var(--text-danger)' : isWarn ? 'var(--text-warning)' : 'var(--status-success-text)';
              const logDate = new Date(item.timestamp || item.ts_iso || Date.now());
              const dateStr = logDate.toLocaleDateString([], { month: '2-digit', day: '2-digit' });
              const timeStr = logDate.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

              return (
                <div
                  key={item.id || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    lineHeight: 1.5,
                    padding: '4px 8px',
                    borderRadius: 'var(--radius-default)',
                    background: isFatal ? 'rgba(239,68,68,0.15)' : isErr ? 'rgba(239,68,68,0.06)' : isWarn ? 'rgba(245,158,11,0.06)' : 'transparent',
                    borderBottom: '1px solid var(--border-soft)'
                  }}
                >
                  {/* Timestamp Column (Date + 24h Time) */}
                  <span style={{ color: 'var(--text-muted)', flexShrink: 0, width: '135px', fontSize: '10px', fontFamily: 'monospace' }}>
                    {`${dateStr} ${timeStr}`}
                  </span>

                  {/* Level Column */}
                  <span
                    style={{
                      color: levelColor,
                      fontWeight: 700,
                      fontSize: '9.5px',
                      textTransform: 'uppercase',
                      flexShrink: 0,
                      width: '46px',
                      textAlign: 'center',
                      padding: '1px 4px',
                      borderRadius: '3px',
                      background: isFatal || isErr ? 'rgba(239,68,68,0.1)' : isWarn ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)'
                    }}
                  >
                    {item.level || 'info'}
                  </span>

                  {/* Category Column */}
                  <span
                    style={{
                      background: 'var(--surface-accent)',
                      color: 'var(--accent-solid)',
                      padding: '1px 6px',
                      borderRadius: 'var(--radius-default)',
                      fontSize: '9.5px',
                      textTransform: 'uppercase',
                      flexShrink: 0,
                      width: '74px',
                      textAlign: 'center',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                    title={item.category || item.subsystem || 'app'}
                  >
                    {item.category || item.subsystem || 'app'}
                  </span>

                  {/* Source Subsystem Column */}
                  <span
                    style={{
                      color: 'var(--text-muted)',
                      fontSize: '10px',
                      flexShrink: 0,
                      width: '110px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                    title={item.source || item.subsystem || ''}
                  >
                    {item.source ? `[${item.source}]` : item.subsystem ? `[${item.subsystem}]` : ''}
                  </span>

                  {/* Message Column */}
                  <span style={{ color: 'var(--text-strong)', wordBreak: 'break-word', flex: 1, fontSize: '11px' }}>
                    {item.message}
                  </span>

                  {/* Duration Column (if present) */}
                  {item.duration_ms && (
                    <span style={{ color: 'var(--text-muted)', fontSize: '9.5px', flexShrink: 0, width: '45px', textAlign: 'right' }}>
                      {item.duration_ms}ms
                    </span>
                  )}
                </div>
              );
            })
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-muted)', gap: '8px', padding: '40px 0' }}>
              <Terminal size={20} />
              <span>No system logs match the active filter criteria.</span>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
