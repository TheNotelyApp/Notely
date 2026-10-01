import React from 'react';
import { Sparkles } from 'lucide-react';
import { TYPE_COLORS, DEFAULT_COLOR, RELATIONSHIP_COLORS } from './graphUtils';

export default function EntityInspector({
  selectedNode,
  entities = [],
  relationships = [],
  onSelectNode,
  onClose,
  onOpenNote
}) {
  if (!selectedNode) return null;

  const typeStyle = TYPE_COLORS[selectedNode.type] || DEFAULT_COLOR;
  const connected = relationships.filter(
    r => r.source_id === selectedNode.id || r.target_id === selectedNode.id
  );

  const entityMap = new Map(entities.map(e => [e.id, e]));

  return (
    <div className="kg-details-card animate-fade-in" style={{ marginTop: 'auto', borderTop: '1px solid var(--border-default)' }}>
      <div className="kg-details-head">
        <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Sparkles size={14} style={{ color: 'var(--accent-solid)' }} />
          Entity Inspector
        </h4>
        <button className="kg-details-close" onClick={onClose} title="Close inspector">✕</button>
      </div>

      <div className="kg-details-body">
        <div className="kg-detail-row">
          <span className="label">Name</span>
          <strong>{selectedNode.name || selectedNode.canonical_name}</strong>
        </div>

        <div className="kg-detail-row">
          <span className="label">Category</span>
          <span
            className="kg-category-badge"
            style={{
              background: typeStyle.background,
              border: `1px solid ${typeStyle.border}`,
              color: typeStyle.text,
              fontSize: '10px',
              padding: '2px 6px',
              borderRadius: '4px',
              fontWeight: 600,
              alignSelf: 'flex-start'
            }}
          >
            {selectedNode.type}
          </span>
        </div>

        {connected.length > 0 && (
          <div className="kg-detail-row" style={{ marginTop: '4px' }}>
            <span className="label">Connected Neighbors ({connected.length})</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '130px', overflowY: 'auto', paddingRight: '2px' }}>
              {connected.map((rel, idx) => {
                const isOutgoing = rel.source_id === selectedNode.id;
                const otherId = isOutgoing ? rel.target_id : rel.source_id;
                const otherNode = entityMap.get(otherId);
                const otherName = otherNode?.name || otherNode?.canonical_name || otherId.replace(/^ent-([^-]+-)?/, '') || otherId;
                const relUpper = String(rel.type || 'RELATION').toUpperCase();
                const relColor = RELATIONSHIP_COLORS[relUpper] || RELATIONSHIP_COLORS.DEFAULT;

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      if (otherNode && typeof onSelectNode === 'function') {
                        onSelectNode(otherNode);
                      }
                    }}
                    className="kg-neighbor-item"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'var(--surface-muted)',
                      border: '1px solid var(--border-soft)',
                      borderRadius: '5px',
                      padding: '3px 6px',
                      fontSize: '10px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    title={`Inspect ${otherName}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0, overflow: 'hidden' }}>
                      <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{isOutgoing ? '→' : '←'}</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {otherName}
                      </span>
                    </div>
                    <span style={{ fontSize: '8px', fontWeight: 700, color: relColor, background: `${relColor}18`, padding: '1px 4px', borderRadius: '3px', whiteSpace: 'nowrap', textTransform: 'lowercase' }}>
                      {String(rel.type).replace(/_/g, ' ')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {selectedNode.note_path && (
          <div className="kg-detail-row" style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
            <button
              className="btn btn-primary"
              onClick={() => onOpenNote && onOpenNote(selectedNode.note_path)}
              style={{ width: '100%', padding: '6px 12px', fontSize: '11px', display: 'flex', justifyContent: 'center', height: '30px' }}
            >
              Open Note
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
