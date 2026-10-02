import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Search,
  ShieldAlert,
  Database,
  Pause,
  Play,
  Trash2,
  RotateCw,
  FileText,
  Braces,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles
} from 'lucide-react';
import {
  aiGetGraph,
  aiBuildGraph,
  aiGetGraphStatus,
  aiGetLogs,
  aiClearGraphData,
  aiGetPreferences,
  aiGetGraphModelStatus,
  aiPauseGraphWorker,
  aiResumeGraphWorker,
  onGraphProgress,
  aiExportGraphAsJSON,
  aiExportGraphAsMarkdown
} from '../services/electronService';
import { OverlayDialog } from './OverlayDialog';
import { useConfirm } from '../hooks/useConfirm';
import AppButton from './AppButton';
import SubpageHeader from './layout/SubpageHeader';

import GraphSidebar from './graph/GraphSidebar';
import GraphCanvasView from './graph/GraphCanvasView';
import EntityInspector from './graph/EntityInspector';
import { normalizeType } from './graph/graphUtils';

import '../styles/KnowledgeGraph.css';

export default function KnowledgeGraph({ onBack }) {
  const { confirm } = useConfirm();
  const [rawEntities, setRawEntities] = useState([]);
  const [rawRelationships, setRawRelationships] = useState([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypes, setSelectedTypes] = useState({
    Note: true,
    Person: true,
    Project: true,
    Technology: true,
    Company: true,
    Organization: true,
    Concept: true,
    Task: true,
    Image: true,
    Document: true,
    ExternalURL: true,
    Repo: true,
    CodeModule: true,
    CodeClass: true,
    CodeInterface: true,
    CodeFunction: true,
    APIEndpoint: true,
    DBModel: true
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [graphStatus, setGraphStatus] = useState({
    nodeCount: 0,
    edgeCount: 0,
    sizeBytes: 0,
    isBuilding: false,
    isPaused: false,
    current: 0,
    total: 0,
    progress: 0,
    noteName: ''
  });
  const [selectedNode, setSelectedNode] = useState(null);
  const [graphLogs, setGraphLogs] = useState([]);
  const [preferences, setPreferences] = useState({
    graphProvider: 'local'
  });
  const [modelStatus, setModelStatus] = useState({
    downloaded: false,
    isDownloading: false,
    progress: 0
  });
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);

  const [showEdgeLabels, setShowEdgeLabels] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleCopyJSON = async () => {
    try {
      const res = await aiExportGraphAsJSON();
      if (res?.data) {
        await navigator.clipboard.writeText(JSON.stringify(res.data, null, 2));
        window.dispatchEvent(new CustomEvent('app:toast', {
          detail: { message: 'Knowledge Graph JSON copied to clipboard.', type: 'success' }
        }));
      }
    } catch (err) {
      console.error('Failed to copy graph JSON:', err);
    }
  };

  const handleCopyMarkdown = async () => {
    try {
      const res = await aiExportGraphAsMarkdown();
      if (res?.data) {
        await navigator.clipboard.writeText(res.data);
        window.dispatchEvent(new CustomEvent('app:toast', {
          detail: { message: 'Knowledge Graph Markdown summary copied to clipboard.', type: 'success' }
        }));
      }
    } catch (err) {
      console.error('Failed to copy graph Markdown:', err);
    }
  };

  const loadModelAndPrefs = useCallback(async () => {
    try {
      const modelRes = await aiGetGraphModelStatus();
      if (modelRes?.success && modelRes.data) {
        setModelStatus(modelRes.data);
      }
      const prefsRes = await aiGetPreferences();
      if (prefsRes?.success && prefsRes.data) {
        setPreferences(prev => ({ ...prev, ...prefsRes.data }));
      }
    } catch (err) {
      console.error('Failed to load graph preferences metadata', err);
    }
  }, []);

  // Load Graph Data using cached SQLite coordinates (Instant O(1) load)
  const loadGraphData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const graphRes = await aiGetGraph();
      const statusRes = await aiGetGraphStatus();
      const logsRes = await aiGetLogs('graph', 50);

      if (logsRes?.success && Array.isArray(logsRes.data)) {
        setGraphLogs(logsRes.data);
      }

      if (statusRes?.success && statusRes.data) {
        setGraphStatus(prev => ({ ...prev, ...statusRes.data }));
      }

      if (graphRes?.success && graphRes.data) {
        const rawEntitiesData = Array.isArray(graphRes.data.entities) ? graphRes.data.entities : [];
        const entities = rawEntitiesData.map(ent => ({
          ...ent,
          type: normalizeType(ent.type)
        }));
        const relationships = Array.isArray(graphRes.data.relationships) ? graphRes.data.relationships : [];

        setRawEntities(entities);
        setRawRelationships(relationships);
      } else {
        setError(graphRes?.error || 'Failed to load graph nodes.');
      }
    } catch (err) {
      setError(err.message || 'Error occurred fetching Knowledge Graph.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadModelAndPrefs();
    loadGraphData();
  }, [loadModelAndPrefs, loadGraphData]);

  useEffect(() => {
    const unsubscribe = onGraphProgress((payload) => {
      if (payload) {
        setGraphStatus(prev => ({ ...prev, ...payload }));

        if (!payload.isBuilding && isRebuilding) {
          setIsRebuilding(false);
          setShowProgressModal(false);
          window.dispatchEvent(new CustomEvent('app:toast', {
            detail: { message: 'Knowledge Graph successfully rebuilt.', type: 'success' }
          }));
          loadGraphData();
        }
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [isRebuilding, loadGraphData]);

  const handlePauseResume = async () => {
    try {
      if (graphStatus.isPaused) {
        await aiResumeGraphWorker();
        setGraphStatus(prev => ({ ...prev, isPaused: false }));
      } else {
        const confirmed = await confirm({
          title: 'Pause Knowledge Graph Worker?',
          message: 'Are you sure you want to pause background Knowledge Graph extraction?',
          confirmLabel: 'Pause Worker',
          cancelLabel: 'Cancel',
          variant: 'warning'
        });
        if (!confirmed) return;
        await aiPauseGraphWorker();
        setGraphStatus(prev => ({ ...prev, isPaused: true }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRebuild = async () => {
    const confirmed = await confirm({
      title: 'Rebuild Knowledge Graph?',
      message: 'Are you sure you want to rebuild the Knowledge Graph from scratch? This will re-parse all notes and compute layout in the background.',
      confirmLabel: 'Rebuild',
      cancelLabel: 'Cancel',
      variant: 'primary'
    });
    if (!confirmed) return;

    try {
      setError('');
      setIsRebuilding(true);
      setRawEntities([]);
      setRawRelationships([]);
      setGraphStatus(prev => ({ ...prev, isBuilding: true, current: 0, noteName: 'Initializing GLiNER/GLiREL worker...' }));
      const rebuildRes = await aiBuildGraph();
      if (!rebuildRes.success) {
        setError(rebuildRes.error || 'Rebuild failed.');
        setIsRebuilding(false);
        setGraphStatus(prev => ({ ...prev, isBuilding: false }));
      } else {
        loadGraphData();
      }
    } catch (err) {
      setError(err.message || 'Failed to rebuild Knowledge Graph.');
      setIsRebuilding(false);
      setGraphStatus(prev => ({ ...prev, isBuilding: false }));
    }
  };

  const handleNodeClick = useCallback((rawEntity) => {
    setSelectedNode(rawEntity);
  }, []);

  const handleNodeDoubleClick = useCallback(async (rawEntity) => {
    if (rawEntity?.note_path) {
      try {
        const { appOpenNote } = await import('../services/electronService');
        if (typeof appOpenNote === 'function') {
          await appOpenNote(rawEntity.note_path);
        } else {
          window.dispatchEvent(new CustomEvent('app:open-note', { detail: { path: rawEntity.note_path } }));
        }
        if (onBack) onBack();
      } catch (err) {
        console.error('[KG] Failed to open note on double-click:', err);
      }
    }
  }, [onBack]);

  // Filtered dataset for Canvas View based on selected entity types
  const filteredNodes = useMemo(() => {
    return rawEntities.filter(ent => {
      const typeMatch = selectedTypes[ent.type] !== false;
      return typeMatch;
    });
  }, [rawEntities, selectedTypes]);

  const sizeMB = (graphStatus.sizeBytes / (1024 * 1024)).toFixed(2);

  return (
    <div className="knowledge-graph-page">
      <SubpageHeader
        currentTitle="Knowledge Graph"
        breadcrumbParent="Workspace"
        onBack={onBack}
        actions={
          <div className="kg-toolbar-group">
            <AppButton
              variant="secondary"
              size="small"
              className="kg-icon-btn"
              onClick={loadGraphData}
              disabled={loading}
              title="Reload Graph View"
            >
              <RotateCw size={14} className={loading ? 'spin' : ''} />
            </AppButton>

            <AppButton
              variant="secondary"
              size="small"
              className="kg-icon-btn"
              onClick={handlePauseResume}
              title={graphStatus.isPaused ? 'Resume Worker' : 'Pause Worker'}
            >
              {graphStatus.isPaused ? <Play size={14} /> : <Pause size={14} />}
            </AppButton>

            <AppButton
              variant="secondary"
              size="small"
              className="kg-icon-btn"
              onClick={handleRebuild}
              disabled={loading || graphStatus.isBuilding}
              title="Rebuild Knowledge Graph"
            >
              <Sparkles size={14} className={graphStatus.isBuilding ? 'spin' : ''} />
            </AppButton>

            <AppButton
              variant="secondary"
              size="small"
              className="kg-text-btn"
              onClick={handleCopyMarkdown}
              title="Copy Graph Summary (Markdown)"
            >
              <FileText size={14} />
              <span>Copy MD</span>
            </AppButton>

            <AppButton
              variant="secondary"
              size="small"
              className="kg-text-btn"
              onClick={handleCopyJSON}
              title="Copy Complete Graph (JSON)"
            >
              <Braces size={14} />
              <span>Copy JSON</span>
            </AppButton>

            <AppButton
              variant="secondary"
              size="small"
              className="kg-icon-btn"
              onClick={async () => {
                const confirmed = await confirm({
                  title: 'Clear Knowledge Graph Cache?',
                  message: 'Are you sure you want to clear all Knowledge Graph entities and relationships from cache?',
                  confirmLabel: 'Clear Cache',
                  cancelLabel: 'Cancel',
                  variant: 'danger'
                });
                if (confirmed) {
                  await aiClearGraphData();
                  loadGraphData();
                }
              }}
              style={{ color: 'var(--text-danger)' }}
              title="Clear Data"
            >
              <Trash2 size={14} />
            </AppButton>
          </div>
        }
      />

      <div className="knowledge-graph-container">
        {/* Header Bar */}
        <div className="kg-header-actions">
          <div className="kg-search-wrapper">
            <Search size={16} className="kg-search-icon" />
            <input
              type="text"
              className="kg-search-input"
              placeholder="Search entity or type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Real-time Top Building Progress Indicator */}
          {graphStatus.isBuilding ? (
            <div
              className="kg-building-pill"
              onClick={() => setShowProgressModal(true)}
              title="Click to view detailed extraction log"
            >
              <RotateCw size={12} className="spin" style={{ color: 'var(--accent-solid)' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '10px', fontWeight: 600, maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {graphStatus.noteName || 'Extracting graph...'}
                </span>
                <div className="kg-progress-track">
                  <div className="kg-progress-fill" style={{ width: `${graphStatus.progress || 0}%` }} />
                </div>
              </div>
              <span style={{ fontWeight: 700, fontSize: '10px', color: 'var(--accent-solid)' }}>
                {graphStatus.progress || 0}%
              </span>
            </div>
          ) : (
            <div className="kg-status-badge">
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Engine:</span>
                <strong style={{ color: 'var(--text-strong)' }}>
                  {(preferences.graphProvider === 'gliner2-relex' || preferences.graphProvider === 'local') ? 'GLiNER2-Relex ONNX' : 'Cloud LLM'}
                </strong>
              </div>
              <span style={{ width: '1px', height: '10px', background: 'var(--border-soft)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>DB Size:</span>
                <strong style={{ color: 'var(--text-strong)' }}>{sizeMB} MB</strong>
              </div>
              <span style={{ width: '1px', height: '10px', background: 'var(--border-soft)' }} />
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600, color: (preferences.graphProvider !== 'gliner2-relex' && preferences.graphProvider !== 'local') || modelStatus.downloaded ? 'var(--status-success-text)' : 'var(--text-warning)' }}>
                <span className="kg-status-dot" style={{ background: (preferences.graphProvider !== 'gliner2-relex' && preferences.graphProvider !== 'local') || modelStatus.downloaded ? 'var(--status-success-border)' : 'var(--text-warning)' }} />
                {(preferences.graphProvider !== 'gliner2-relex' && preferences.graphProvider !== 'local') ? 'Active' : modelStatus.downloaded ? 'Ready' : 'Missing'}
              </span>
            </div>
          )}

          <div className="kg-stats-pill">
            <Database size={12} />
            <span>Nodes: {graphStatus.nodeCount || rawEntities.length} | Edges: {graphStatus.edgeCount || rawRelationships.length}</span>
          </div>
        </div>

        {/* Main Body */}
        <div className="kg-body">
          {/* Modular Sidebar */}
          <GraphSidebar
            sidebarOpen={sidebarOpen}
            entities={rawEntities}
            selectedTypes={selectedTypes}
            setSelectedTypes={setSelectedTypes}
            showEdgeLabels={showEdgeLabels}
            setShowEdgeLabels={setShowEdgeLabels}
            graphLogs={graphLogs}
          />

          {/* Canvas Viewport */}
          <div className="kg-canvas-wrapper" style={{ flex: 1, height: '100%', position: 'relative' }}>
            {/* Sidebar toggle button */}
            <AppButton
              variant="secondary"
              size="small"
              onClick={() => setSidebarOpen(prev => !prev)}
              style={{
                position: 'absolute',
                top: 12,
                left: 12,
                zIndex: 5,
                width: '32px',
                height: '32px',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--shadow-sm)'
              }}
              title={sidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
            >
              {sidebarOpen ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
            </AppButton>

            {/* Quick search match counter pill */}
            {searchQuery.trim() && (
              <div
                style={{
                  position: 'absolute',
                  top: 12,
                  left: 52,
                  zIndex: 5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'var(--surface-elevated)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-default)',
                  padding: '4px 10px',
                  fontSize: '11px',
                  color: 'var(--text-strong)',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                <Search size={12} style={{ color: 'var(--accent-solid)' }} />
                <span>Matches: <strong>{filteredNodes.filter(n => n.name?.toLowerCase().includes(searchQuery.toLowerCase())).length}</strong> / {rawEntities.length}</span>
              </div>
            )}

            {error && (
              <div className="kg-error-overlay">
                <ShieldAlert size={20} />
                <p>{error}</p>
                <AppButton variant="secondary" size="small" onClick={loadGraphData}>Retry</AppButton>
              </div>
            )}

            {!error && !loading && !graphStatus.isBuilding && rawEntities.length === 0 && (
              <div className="kg-empty-state-canvas">
                <Sparkles size={20} style={{ color: 'var(--accent-solid)' }} />
                <h3>No Knowledge Graph Data</h3>
                <p>Scan and extract entities, wikilinks, and semantic relations from your workspace notes.</p>
                <AppButton variant="primary" size="small" onClick={handleRebuild}>
                  Rebuild Knowledge Graph
                </AppButton>
              </div>
            )}

            <GraphCanvasView
              nodes={filteredNodes}
              edges={rawRelationships}
              onNodeClick={handleNodeClick}
              onNodeDoubleClick={handleNodeDoubleClick}
              showEdgeLabels={showEdgeLabels}
              searchQuery={searchQuery}
              selectedNode={selectedNode}
            />
          </div>
        </div>
      </div>

      {/* Progress Modal */}
      {showProgressModal && (
        <OverlayDialog
          open={showProgressModal}
          onClose={() => setShowProgressModal(false)}
          title="Rebuilding Knowledge Graph"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%', minWidth: '420px', padding: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span>{graphStatus.noteName || 'Extracting entities & relations...'}</span>
              <strong style={{ color: 'var(--brand-primary)' }}>{graphStatus.progress || 0}%</strong>
            </div>

            <div style={{ width: '100%', height: '8px', background: 'var(--border-soft)', borderRadius: 'var(--radius-default)', overflow: 'hidden' }}>
              <div style={{ width: `${graphStatus.progress || 0}%`, height: '100%', background: 'var(--accent-solid)', transition: 'width 0.2s ease' }} />
            </div>

            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Processed: {graphStatus.current} / {graphStatus.total} notes
            </div>

            <div style={{ marginTop: '8px', maxHeight: '160px', overflowY: 'auto', background: 'var(--surface-muted)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-default)', padding: '8px' }}>
              <div style={{ fontSize: '10px', fontWeight: 'bold', marginBottom: '4px', color: 'var(--text-muted)' }}>Recent Extraction Logs:</div>
              {graphLogs.slice(-6).map((logItem, idx) => (
                <div key={idx} style={{ fontSize: '10px', color: 'var(--text-secondary)', padding: '2px 0' }}>
                  [{new Date(logItem.timestamp).toLocaleTimeString()}] {logItem.message}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <AppButton
                variant="secondary"
                size="small"
                onClick={() => setShowProgressModal(false)}
              >
                Hide Modal (Run in Background)
              </AppButton>
            </div>
          </div>
        </OverlayDialog>
      )}

      {/* Entity Inspector Popup Modal */}
      {selectedNode && (
        <EntityInspector
          selectedNode={selectedNode}
          entities={rawEntities}
          relationships={rawRelationships}
          onSelectNode={setSelectedNode}
          onClose={() => setSelectedNode(null)}
          onOpenNote={(notePath) => handleNodeDoubleClick({ note_path: notePath })}
        />
      )}
    </div>
  );
}
