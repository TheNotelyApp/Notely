import React from 'react';
import { FileText, X } from 'lucide-react';
import { OverlayDialog } from '../OverlayDialog';
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
    <OverlayDialog
      open={!!selectedNode}
      onClose={onClose}
      ariaLabel="Entity Inspector"
      size="sm"
      cardClassName="kg-inspector-modal-card"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%', minWidth: '360px', padding: '4px 2px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-soft)', paddingBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, overflow: 'hidden' }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: typeStyle.border, display: 'inline-block', flexShrink: 0, boxShadow: `0 0 8px ${typeStyle.border}` }} />
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selectedNode.name || selectedNode.canonical_name}
            </h3>
          </div>
          <span
            className="kg-category-badge"
            style={{
              background: typeStyle.background,
              border: `1px solid ${typeStyle.border}`,
              color: typeStyle.text,
              fontSize: '10px',
              padding: '2px 8px',
              borderRadius: '4px',
              fontWeight: 700,
              flexShrink: 0
            }}
          >
            {selectedNode.type}
          </span>
        </div>

        {/* Details Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {selectedNode.note_path && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', background: 'var(--surface-muted)', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-soft)' }}>
              <span style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                Source Document
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-strong)', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                {selectedNode.note_path}
              </span>
            </div>
          )}

          {/* Connected Neighbors List */}
          {connected.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                  Connected Relationships
                </span>
                <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--accent-solid)' }}>
                  {connected.length} {connected.length === 1 ? 'link' : 'links'}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '180px', overflowY: 'auto', paddingRight: '2px' }}>
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
                        borderRadius: '6px',
                        padding: '6px 10px',
                        fontSize: '11px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                      title={`Inspect ${otherName}`}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, overflow: 'hidden' }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{isOutgoing ? '→' : '←'}</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {otherName}
                        </span>
                      </div>
                      <span style={{ fontSize: '9px', fontWeight: 700, color: relColor, background: `${relColor}18`, padding: '2px 6px', borderRadius: '4px', whiteSpace: 'nowrap', textTransform: 'lowercase' }}>
                        {String(rel.type).replace(/_/g, ' ')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px', paddingTop: '10px', borderTop: '1px solid var(--border-soft)' }}>
          <button
            className="btn btn-secondary btn-sm kg-inspector-footer-close-btn"
            onClick={onClose}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <X size={13} />
            Close
          </button>
          {selectedNode.note_path && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                if (onOpenNote) onOpenNote(selectedNode.note_path);
                if (onClose) onClose();
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <FileText size={13} />
              Open Note
            </button>
          )}
        </div>
      </div>
    </OverlayDialog>
  );
}
