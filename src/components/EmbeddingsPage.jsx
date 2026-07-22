import React, { useEffect, useState, useCallback } from 'react';
import {
  Search,
  RefreshCw,
  Database,
  Pause,
  Play,
  AlertCircle,
  FileText,
  RotateCw,
  ExternalLink,
  Trash2,
  Cpu
} from 'lucide-react';
import {
  aiGetEmbeddingsStatus,
  aiRebuildEmbeddings,
  aiClearEmbeddingsData,
  aiPauseWorker,
  aiResumeWorker,
  aiGetModelStatus,
  aiDownloadModel,
  aiGetLogs,
  onModelDownloadProgress,
  aiGetPreferences
} from '../services/electronService';
import { OverlayDialog } from './OverlayDialog';
import { useConfirm } from '../hooks/useConfirm';

import '../styles/KnowledgeGraph.css'; // Reuses base layout rules for unified styling

export default function EmbeddingsPage({ onBack }) {
  const { confirm } = useConfirm();
  const [status, setStatus] = useState({
    totalChunks: 0,
    indexedNotes: 0,
    queueSize: 0,
    queueTotal: 0,
    isPaused: false,
    isWorking: false,
    chunks: [],
    logs: [],
    dbSize: '0 KB'
  });
  const [modelStatus, setModelStatus] = useState({
    downloaded: false,
    isDownloading: false,
    progress: 0
  });
  const [preferences, setPreferences] = useState({
    embeddingProvider: 'internal'
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedChunk, setSelectedChunk] = useState(null);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);

  const loadEmbeddingsStatus = useCallback(async () => {
    try {
      setError('');
      const res = await aiGetEmbeddingsStatus({ search: searchQuery });
      const logsRes = await aiGetLogs('embeddings', 50);

      if (res.success && res.data) {
        if (res.data.uninitialized) {
          setError('AI agent or EmbeddingDB is not initialized. Please configure your active AI provider first under Settings > AI settings.');
        } else {
          const fetchedLogs = (logsRes && logsRes.success && Array.isArray(logsRes.data)) ? logsRes.data : [];
          setStatus({
            ...res.data,
            logs: fetchedLogs.length > 0 ? fetchedLogs : (res.data.logs || [])
          });
          if (isRebuilding && res.data.queueSize === 0) {
            setIsRebuilding(false);
            setShowProgressModal(false);
            window.dispatchEvent(new CustomEvent('app:toast', {
              detail: { message: 'Embeddings DB successfully rebuilt.', type: 'success' }
            }));
          }
        }
      } else {
        setError(res.error || 'Failed to fetch embeddings status.');
      }
    } catch (err) {
      setError(err.message || 'Error occurred fetching status.');
    }
  }, [searchQuery, isRebuilding]);

  const loadModelAndPrefs = useCallback(async () => {
    try {
      const modelRes = await aiGetModelStatus();
      if (modelRes.success && modelRes.data) {
        setModelStatus(modelRes.data);
      }
      const prefsRes = await aiGetPreferences();
      if (prefsRes.success && prefsRes.data) {
        setPreferences(prev => ({ ...prev, ...prefsRes.data }));
      }
    } catch (err) {
      console.error('Failed to load metadata', err);
    }
  }, []);

  useEffect(() => {
    loadEmbeddingsStatus();
    const interval = setInterval(loadEmbeddingsStatus, 1000);
    return () => clearInterval(interval);
  }, [loadEmbeddingsStatus]);

  useEffect(() => {
    loadModelAndPrefs();

    // Listen to model download progress
    const unsubscribe = onModelDownloadProgress((payload) => {
      setModelStatus(prev => ({
        ...prev,
        isDownloading: true,
        progress: payload.progress,
        downloaded: payload.progress === 100
      }));
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [loadModelAndPrefs]);



  const handlePauseResume = async () => {
    try {
      if (status.isPaused) {
        await aiResumeWorker();
        setStatus(prev => ({ ...prev, isPaused: false }));
      } else {
        await aiPauseWorker();
        setStatus(prev => ({ ...prev, isPaused: true }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRebuild = async () => {
    const confirmed = await confirm({
      title: 'Rebuild Embeddings Database?',
      message: 'Are you sure you want to drop all indexed vector chunks and rebuild the embeddings index?',
      confirmLabel: 'Rebuild Embeddings',
      cancelLabel: 'Cancel',
      variant: 'primary'
    });
    if (!confirmed) return;

    try {
      setLoading(true);
      const res = await aiRebuildEmbeddings();
      if (res.success) {
        window.dispatchEvent(new CustomEvent('app:toast', {
          detail: { message: 'Embeddings rebuild triggered.', type: 'success' }
        }));
        setIsRebuilding(true);
        await loadEmbeddingsStatus();
      } else {
        setError(res.error || 'Failed to clear data');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="knowledge-graph-page">
      {/* Unified topbar navigation breadcrumb */}
      <div className="detail-topbar">
        <nav className="detail-breadcrumb" aria-label="Embeddings location">
          <span className="detail-breadcrumb-part">
            <button className="detail-breadcrumb-link" type="button" onClick={onBack}>Notes</button>
            <span className="detail-breadcrumb-separator" aria-hidden="true">/</span>
          </span>
          <span className="detail-breadcrumb-current">Vector Embeddings</span>
        </nav>
      </div>

      <div className="knowledge-graph-container">
        {/* Header Actions Bar */}
        <div className="kg-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', height: '52px', boxSizing: 'border-box' }}>
          <div className="kg-search-wrapper" style={{ height: '32px' }}>
            <Search size={16} className="kg-search-icon" />
            <input
              type="text"
              className="kg-search-input"
              placeholder="Search note chunk content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ height: '32px', boxSizing: 'border-box' }}
            />
          </div>

          {/* Model & DB Status details pill in header */}
          {status.queueSize > 0 || isRebuilding ? (
            <div
              onClick={() => setShowProgressModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'var(--surface-muted)',
                border: '1px solid var(--accent-solid)',
                padding: '0 12px',
                borderRadius: '6px',
                fontSize: '11px',
                color: 'var(--text-strong)',
                marginLeft: 'auto',
                height: '32px',
                cursor: 'pointer',
                boxSizing: 'border-box'
              }}
              title="Click to view detailed indexing progress"
            >
              <RefreshCw size={12} className="spin" style={{ color: 'var(--accent-solid)' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                <span style={{ fontSize: '10px', fontWeight: 600 }}>Indexing vector embeddings...</span>
                <div style={{ width: '120px', height: '3px', background: 'var(--border-soft)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${status.queueTotal > 0 ? Math.max(0, Math.min(100, ((status.queueTotal - status.queueSize) / status.queueTotal) * 100)) : 0}%`,
                    height: '100%',
                    background: 'var(--accent-solid)',
                    transition: 'width 0.2s ease'
                  }} />
                </div>
              </div>
              <span style={{ fontWeight: 700, fontSize: '10px', color: 'var(--accent-solid)' }}>
                {status.queueTotal > 0 ? Math.round(((status.queueTotal - status.queueSize) / status.queueTotal) * 100) : 0}%
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', background: 'var(--surface-muted)', border: '1px solid var(--border-soft)', padding: '0 12px', borderRadius: '6px', color: 'var(--text-secondary)', marginLeft: 'auto', height: '32px', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Provider:</span>
                <strong style={{ color: 'var(--text-strong)' }}>{preferences.embeddingProvider === 'internal' ? 'Local' : 'HuggingFace'}</strong>
              </div>
              <span style={{ width: '1px', height: '10px', background: 'var(--border-soft)' }}></span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Model:</span>
                <strong style={{ color: 'var(--text-strong)' }}>{preferences.embeddingProvider === 'internal' ? 'BGE-Small-En-v1.5' : 'bge-small-en'}</strong>
              </div>
              <span style={{ width: '1px', height: '10px', background: 'var(--border-soft)' }}></span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>DB Size:</span>
                <strong style={{ color: 'var(--text-strong)' }}>{status.dbSize || '0 KB'}</strong>
              </div>
              <span style={{ width: '1px', height: '10px', background: 'var(--border-soft)' }}></span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600, color: modelStatus.downloaded ? 'var(--status-success-text)' : 'var(--text-warning)' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: modelStatus.downloaded ? 'var(--status-success-border)' : 'var(--text-warning)' }}></span>
                {modelStatus.downloaded ? 'Ready' : 'Missing'}
              </span>
            </div>
          )}

          {!modelStatus.downloaded && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={async () => {
                try {
                  const res = await aiDownloadModel();
                  if (res.success) {
                    setModelStatus(prev => ({ ...prev, isDownloading: true, progress: 0 }));
                  }
                } catch (err) {
                  console.error(err);
                }
              }}
              disabled={modelStatus.isDownloading}
              style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', height: '32px', gap: '4px', boxSizing: 'border-box' }}
            >
              <span>{modelStatus.isDownloading ? `Downloading (${modelStatus.progress}%)...` : 'Download Model (~130MB)'}</span>
            </button>
          )}

          <div className="kg-stats-pill" style={{ gap: '12px', display: 'flex', alignItems: 'center', height: '32px', boxSizing: 'border-box', margin: 0, padding: '0 12px' }}>
            <Database size={12} />
            <span>Chunks: {status.totalChunks} | Indexed Notes: {status.indexedNotes}</span>
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={handlePauseResume}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '32px', padding: '0 10px', fontSize: '11px' }}
          >
            {status.isPaused ? <Play size={12} /> : <Pause size={12} />}
            <span>{status.isPaused ? 'Resume Worker' : 'Pause Worker'}</span>
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={loadEmbeddingsStatus}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '32px', padding: '0 10px', fontSize: '11px' }}
            title="Reload Vector Embeddings status"
          >
            <RotateCw size={12} className={loading ? 'spin' : ''} />
            <span>Reload Data</span>
          </button>
        </div>

        <div className="kg-body">
          {/* Settings & Controls Sidebar */}
          <div className="kg-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%' }}>
            <div className="kg-sidebar-section-scroll" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', padding: '10px' }}>
              {/* Vector Engine Stats Card */}
              <div className="kg-sidebar-section" style={{ background: 'var(--surface-elevated)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-soft)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', margin: 0, fontWeight: 600 }}>
                  <Cpu size={12} />
                  Engine Metadata
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Provider:</span>
                    <strong style={{ color: 'var(--text-strong)' }}>{preferences.embeddingProvider === 'internal' ? 'Local BGE' : 'HuggingFace'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Dimensions:</span>
                    <strong style={{ color: 'var(--text-strong)' }}>384 dense float</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Worker Status:</span>
                    <span style={{ fontWeight: 600, color: status.isWorking ? 'var(--accent-solid)' : status.isPaused ? 'var(--text-warning)' : 'var(--status-success-text)' }}>
                      {status.isWorking ? 'Processing' : status.isPaused ? 'Paused' : 'Idle'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Queue Size:</span>
                    <strong style={{ color: 'var(--text-strong)' }}>{status.queueSize} remaining</strong>
                  </div>
                </div>
              </div>

              {/* Indexing Event Logs */}
              <div className="kg-sidebar-section" style={{ background: 'var(--surface-elevated)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-soft)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', margin: 0, fontWeight: 600 }}>
                    Indexing Logs
                  </h4>
                  <button
                    className="btn btn-tertiary"
                    onClick={() => window.dispatchEvent(new CustomEvent('app:menu-action', { detail: { action: 'open-app-logs' } }))}
                    style={{ padding: '2px 6px', fontSize: '9px', height: '18px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                    title="Open full System & Application Logs"
                  >
                    <ExternalLink size={12} />
                    System Logs
                  </button>
                </div>
                <div style={{
                  background: 'var(--surface-muted)',
                  borderRadius: '4px',
                  padding: '6px',
                  border: '1px solid var(--border-soft)',
                  fontFamily: 'monospace',
                  fontSize: '9px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '3px'
                }}>
                  {status.logs.length === 0 ? (
                    <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No logs available.</span>
                  ) : (
                    status.logs.slice(0, 10).map((logItem, idx) => {
                      const timeStr = logItem.timestamp ? new Date(logItem.timestamp).toLocaleTimeString() : (logItem.ts || '');
                      const eventName = String(logItem.level || logItem.event || 'INFO').toUpperCase();
                      const detailText = logItem.message || logItem.detail || '';
                      return (
                        <div key={logItem.id || idx} style={{ display: 'flex', gap: '4px', lineHeight: 1.3 }}>
                          <span style={{ color: 'var(--text-muted)' }}>[{timeStr}]</span>
                          <span style={{ color: eventName === 'ERROR' ? 'var(--text-danger)' : 'var(--accent-solid)', fontWeight: 600 }}>{eventName}</span>
                          <span style={{ color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{detailText}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Actions Panel - Rebuild & Clear on single row */}
            <div className="kg-sidebar-section" style={{ background: 'var(--surface-elevated)', padding: '10px', borderTop: '1px solid var(--border-soft)', display: 'flex', gap: '6px' }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleRebuild}
                disabled={loading}
                style={{ flex: 1, justifyContent: 'center', height: '26px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px', padding: '0 6px' }}
              >
                <RefreshCw size={12} className={loading ? 'spin' : ''} />
                <span>{loading ? 'Building...' : 'Rebuild'}</span>
              </button>

              <button
                className="btn btn-secondary btn-sm"
                onClick={async () => {
                  const confirmed = await confirm({
                    title: 'Clear Embeddings Cache?',
                    message: 'Are you sure you want to clear all indexed vector embeddings data from cache?',
                    confirmLabel: 'Clear Cache',
                    cancelLabel: 'Cancel',
                    variant: 'danger'
                  });
                  if (confirmed) {
                    await aiClearEmbeddingsData();
                    loadEmbeddingsStatus();
                  }
                }}
                style={{ flex: 1, justifyContent: 'center', height: '26px', fontSize: '10px', color: 'var(--text-danger)', display: 'flex', alignItems: 'center', gap: '4px', padding: '0 6px' }}
              >
                <Trash2 size={12} />
                <span>Clear Data</span>
              </button>
            </div>

            {/* Selected Chunk Detail Card */}
            {selectedChunk && (
              <div className="kg-details-card animate-fade-in" style={{ margin: '10px' }}>
                <div className="kg-details-head">
                  <h4>Chunk Detail</h4>
                  <button className="kg-details-close" onClick={() => setSelectedChunk(null)}>✕</button>
                </div>
                <div className="kg-details-body" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  <div className="kg-detail-row">
                    <span className="label">Location</span>
                    <strong>Lines {selectedChunk.start_line} - {selectedChunk.end_line}</strong>
                  </div>
                  <div className="kg-detail-row">
                    <span className="label">Content</span>
                    <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: '11px', background: 'var(--surface-muted)', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-soft)' }}>
                      {selectedChunk.content}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Searchable Chunk Inspector */}
          <div className="kg-canvas-wrapper" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--surface-bg)', overflow: 'hidden', paddingBottom: '28px' }}>
            {error && (
              <div className="kg-error-overlay">
                <AlertCircle size={20} style={{ color: 'var(--kg-task-border)' }} />
                <p>{error}</p>
              </div>
            )}

            {/* Chunks Inspector list */}
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 16px 64px 16px', boxSizing: 'border-box' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-strong)', margin: '0 0 12px 0' }}>Chunks Inspector</h3>
              {status.chunks.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                  <FileText size={20} style={{ marginBottom: '8px', opacity: 0.5 }} />
                  <span>No note chunks found. Try writing a note or rebuilding the index.</span>
                </div>
              ) : (
                <>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                    <thead style={{ position: 'sticky', top: 0, background: 'var(--surface-bg)', zIndex: 1 }}>
                      <tr style={{ borderBottom: '1px solid var(--border-default)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '8px', background: 'var(--surface-bg)' }}>Note Path</th>
                        <th style={{ padding: '8px', background: 'var(--surface-bg)' }}>Type</th>
                        <th style={{ padding: '8px', background: 'var(--surface-bg)' }}>Lines</th>
                        <th style={{ padding: '8px', background: 'var(--surface-bg)' }}>Preview</th>
                      </tr>
                    </thead>
                    <tbody>
                      {status.chunks.map((chunk) => (
                        <tr
                          key={chunk.id}
                          onClick={() => setSelectedChunk(chunk)}
                          style={{ borderBottom: '1px solid var(--border-soft)', cursor: 'pointer' }}
                          className="kg-table-row"
                        >
                          <td style={{ padding: '8px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={chunk.note_path}>
                            {chunk.note_path.split(/[/\\]/).pop()}
                          </td>
                          <td style={{ padding: '8px' }}>
                            <span className="kg-category-badge" style={{ fontSize: '9px', padding: '1px 4px', borderRadius: '3px', background: 'var(--surface-muted)', border: '1px solid var(--border-soft)' }}>
                              {chunk.chunk_type || 'text'}
                            </span>
                          </td>
                          <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>
                            {chunk.start_line}-{chunk.end_line}
                          </td>
                          <td style={{ padding: '8px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-strong)' }}>
                            {chunk.content}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ height: '48px' }} />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <OverlayDialog
        open={showProgressModal}
        onClose={() => setShowProgressModal(false)}
        ariaLabel="Embeddings Database Rebuild Progress"
      >
        <div className="overlay-dialog-header" style={{ padding: "1.25rem 1.5rem" }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-strong)', margin: 0 }}>Rebuilding Embeddings DB</h2>
        </div>
        <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "16px", minWidth: "320px", background: 'var(--surface-bg)' }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
              <span style={{ color: "var(--text-secondary)" }}>Indexing notes...</span>
              <strong style={{ color: "var(--text-strong)" }}>
                {status.queueTotal > 0 ? Math.round(((status.queueTotal - status.queueSize) / status.queueTotal) * 100) : 0}%
              </strong>
            </div>
            
            <div style={{ width: '100%', height: '8px', background: 'var(--border-soft)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{
                width: `${status.queueTotal > 0 ? Math.max(0, Math.min(100, ((status.queueTotal - status.queueSize) / status.queueTotal) * 100)) : 0}%`,
                height: '100%',
                background: 'var(--accent-solid)',
                transition: 'width 0.3s ease'
              }} />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
              <span>Remaining: {status.queueSize} files</span>
              <span>Total: {status.queueTotal} files</span>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
            <button
              className="btn btn-secondary"
              onClick={() => setShowProgressModal(false)}
              style={{ padding: "6px 12px", fontSize: "12px" }}
            >
              Run in Background
            </button>
          </div>
        </div>
      </OverlayDialog>
    </div>
  );
}
