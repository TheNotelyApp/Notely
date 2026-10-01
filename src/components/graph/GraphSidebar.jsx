import React, { useMemo } from 'react';
import { Layers, CheckSquare, Square, ExternalLink } from 'lucide-react';
import { TYPE_COLORS, RELATIONSHIP_COLORS, getTypeColor } from './graphUtils';
import EntityInspector from './EntityInspector';

export default function GraphSidebar({
  sidebarOpen,
  entities = [],
  relationships = [],
  selectedTypes = {},
  setSelectedTypes,
  showEdgeLabels,
  setShowEdgeLabels,
  selectedNode,
  setSelectedNode,
  graphLogs = [],
  onOpenNote
}) {
  // Pre-calculate type counts efficiently
  const { activeTypes, typeCounts } = useMemo(() => {
    const counts = new Map();
    for (const ent of entities) {
      const t = ent.type || 'Entity';
      counts.set(t, (counts.get(t) || 0) + 1);
    }

    const allTypesSet = new Set([...Object.keys(TYPE_COLORS), ...counts.keys()]);
    const sorted = Array.from(allTypesSet)
      .filter(t => (counts.get(t) || 0) > 0)
      .sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0));

    return { activeTypes: sorted, typeCounts: counts };
  }, [entities]);

  const handleTypeToggle = (type) => {
    setSelectedTypes(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const handleSelectAll = () => {
    const allKnown = new Set([...Object.keys(TYPE_COLORS), ...activeTypes]);
    const next = {};
    allKnown.forEach(k => { next[k] = true; });
    setSelectedTypes(next);
  };

  const handleSelectNone = () => {
    const allKnown = new Set([...Object.keys(TYPE_COLORS), ...activeTypes]);
    const next = {};
    allKnown.forEach(k => { next[k] = false; });
    setSelectedTypes(next);
  };

  return (
    <div
      className="kg-sidebar"
      style={{
        width: sidebarOpen ? '280px' : '0px',
        minWidth: sidebarOpen ? '280px' : '0px',
        opacity: sidebarOpen ? 1 : 0,
        pointerEvents: sidebarOpen ? 'auto' : 'none',
        borderRight: sidebarOpen ? '1px solid var(--border-default)' : 'none',
        transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        height: '100%',
        overflow: 'hidden'
      }}
    >
      <div className="kg-sidebar-section-scroll" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', padding: '10px' }}>
        {/* Entity Types Checklist */}
        <div className="kg-sidebar-section" style={{ background: 'var(--surface-elevated)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-soft)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', margin: 0, fontWeight: 600 }}>
              <Layers size={12} />
              Entity Types
            </h4>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                className="btn btn-tertiary"
                onClick={handleSelectAll}
                style={{ padding: '2px 5px', fontSize: '9px', height: '18px', display: 'inline-flex', alignItems: 'center', gap: '2px' }}
              >
                <CheckSquare size={12} />
                All
              </button>
              <button
                className="btn btn-tertiary"
                onClick={handleSelectNone}
                style={{ padding: '2px 5px', fontSize: '9px', height: '18px', display: 'inline-flex', alignItems: 'center', gap: '2px' }}
              >
                <Square size={12} />
                None
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {activeTypes.length === 0 ? (
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No entities extracted yet.</span>
            ) : (
              activeTypes.map(type => {
                const color = getTypeColor(type);
                const count = typeCounts.get(type) || 0;
                const isChecked = selectedTypes[type] !== false;

                return (
                  <label key={type} className="kg-filter-checkbox" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', cursor: 'pointer', padding: '1px 0' }}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleTypeToggle(type)}
                    />
                    <span className="kg-filter-color-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: color.border }} />
                    <span style={{ fontWeight: isChecked ? 600 : 400, color: isChecked ? 'var(--text-strong)' : 'var(--text-secondary)' }}>
                      {type} ({count})
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>

        {/* Compact Relationship & Arrow Legend */}
        <div className="kg-sidebar-section" style={{ background: 'var(--surface-elevated)', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-soft)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', margin: 0, fontWeight: 600 }}>
              Arrow & Colors
            </h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '9px', color: 'var(--text-secondary)', cursor: 'pointer' }} title="Toggle edge relationship text labels on graph">
                <input
                  type="checkbox"
                  checked={showEdgeLabels}
                  onChange={(e) => setShowEdgeLabels(e.target.checked)}
                  style={{ margin: 0, accentColor: 'var(--accent-solid)', cursor: 'pointer', width: '11px', height: '11px' }}
                />
                <span>Labels</span>
              </label>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '9px', fontFamily: 'monospace', background: 'var(--surface-muted)', padding: '1px 6px', borderRadius: '4px', border: '1px solid var(--border-soft)', color: 'var(--text-muted)' }}>
                <span>Source</span>
                <span style={{ color: 'var(--accent-solid)', fontWeight: 'bold' }}>──►</span>
                <span>Target</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 6px', marginTop: '2px' }}>
            {[
              { label: 'LINKS', color: RELATIONSHIP_COLORS.LINKS_TO },
              { label: 'IMPORTS', color: RELATIONSHIP_COLORS.IMPORTS },
              { label: 'CALLS', color: RELATIONSHIP_COLORS.CALLS },
              { label: 'CONTAINS', color: RELATIONSHIP_COLORS.CONTAINS },
              { label: 'EXPORTS', color: RELATIONSHIP_COLORS.EXPORTS },
              { label: 'DOCUMENTS', color: RELATIONSHIP_COLORS.DOCUMENTS },
              { label: 'DEPENDS', color: RELATIONSHIP_COLORS.DEPENDS_ON },
              { label: 'USES', color: RELATIONSHIP_COLORS.USES },
              { label: 'MENTIONS', color: RELATIONSHIP_COLORS.MENTIONS_NOTE },
              { label: 'TAGGED', color: RELATIONSHIP_COLORS.TAGGED },
              { label: 'URL', color: RELATIONSHIP_COLORS.REFERENCES_URL }
            ].map(item => (
              <span key={item.label} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '9px', fontWeight: 600, padding: '2px 5px', borderRadius: '4px', background: `${item.color}15`, border: `1px solid ${item.color}45`, color: 'var(--text-strong)' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: item.color, display: 'inline-block' }} />
                {item.label}
              </span>
            ))}
          </div>
        </div>

        {/* Extraction Logs Panel */}
        <div className="kg-sidebar-section" style={{ background: 'var(--surface-elevated)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-soft)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', margin: 0, fontWeight: 600 }}>
              Extraction Logs
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
            {graphLogs.length > 0 ? (
              graphLogs.slice(0, 8).map((logItem, i) => (
                <div key={logItem.id || i} style={{ color: logItem.level === 'error' ? 'var(--text-danger)' : 'var(--text-secondary)', lineHeight: 1.3 }}>
                  <span style={{ color: 'var(--text-muted)', marginRight: '4px' }}>[{new Date(logItem.timestamp).toLocaleTimeString()}]</span>
                  {logItem.message}
                </div>
              ))
            ) : (
              <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No logs yet.</span>
            )}
          </div>
        </div>
      </div>

      {/* Entity Inspector */}
      {selectedNode && (
        <EntityInspector
          selectedNode={selectedNode}
          entities={entities}
          relationships={relationships}
          onSelectNode={setSelectedNode}
          onClose={() => setSelectedNode(null)}
          onOpenNote={onOpenNote}
        />
      )}
    </div>
  );
}
