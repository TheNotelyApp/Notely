import React from "react";
import {
  Box,
  ChevronDown,
  ChevronRight,
  Copy,
  Crosshair,
  FileText,
  Trash2
} from "lucide-react";

export function AnnotationsSection({
  isOpen,
  onToggle,
  annotations,
  onSelectAnnotation,
  onDeleteAnnotation,
  onCopySpecMarkdown
}) {
  return (
    <div className={`wireframe-section ${isOpen ? "open" : "collapsed"}`}>
      <button
        type="button"
        className="wireframe-section-header"
        onClick={onToggle}
      >
        <div className="wireframe-section-title-wrap">
          <FileText size={14} />
          <span>Annotations</span>
          {annotations.length > 0 && (
            <span className="wireframe-annotations-count">{annotations.length}</span>
          )}
        </div>
        <div className="wireframe-section-chevron">
          {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </div>
      </button>

      <div
        className="wireframe-section-body wireframe-annotations-section"
        style={{ display: isOpen ? "block" : "none" }}
      >
        <div className="wireframe-annotations-header">
          <strong style={{ fontSize: "11px", color: "var(--text-strong)" }}>
            Pins & Notes
          </strong>
          {annotations.length > 0 && (
            <button
              type="button"
              className="wireframe-copy-spec-btn"
              onClick={onCopySpecMarkdown}
              title="Copy annotations table as Markdown"
            >
              <Copy size={12} />
              <span>Copy Spec</span>
            </button>
          )}
        </div>

        {annotations.length === 0 ? (
          <div className="wireframe-inspector-empty">
            <FileText size={20} className="wireframe-empty-icon-svg" />
            <span>No annotations yet. Add a Developer Note to create pins [1], [2] on canvas.</span>
          </div>
        ) : (
          <div className="wireframe-annotations-list">
            {annotations.map((item, idx) => {
              const Icon = item.icon || Box;
              return (
                <div
                  key={item.cid || idx}
                  className="wireframe-annotation-card"
                  onClick={() => onSelectAnnotation(item)}
                  title="Click to jump to component on canvas"
                >
                  <div className="wireframe-annotation-card-top">
                    <div className="wireframe-annotation-badge-group">
                      <span className="wireframe-annotation-badge">{idx + 1}</span>
                      <Icon size={12} color="var(--text-muted)" />
                      <span className="wireframe-annotation-comp-name">{item.name}</span>
                    </div>
                    <div className="wireframe-annotation-actions">
                      <button
                        type="button"
                        className="wireframe-annotation-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectAnnotation(item);
                        }}
                        title="Locate & inspect element"
                      >
                        <Crosshair size={12} />
                      </button>
                      <button
                        type="button"
                        className="wireframe-annotation-btn danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteAnnotation(item);
                        }}
                        title="Remove note & pin"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="wireframe-annotation-text">{item.note}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
