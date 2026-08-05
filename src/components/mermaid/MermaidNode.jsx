import { useState, useCallback, memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { Edit2, Check, X, Trash2 } from "lucide-react";

export const MermaidNode = memo(function MermaidNode({ id, data, selected }) {
  const {
    label = "",
    shape = "rectangle",
    fillColor,
    strokeColor,
    textColor,
    onChangeLabel,
    onDeleteNode,
  } = data || {};

  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(label);

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    setEditText(label);
    setIsEditing(true);
  };

  const handleSave = useCallback(
    (e) => {
      e?.stopPropagation();
      onChangeLabel?.(id, editText);
      setIsEditing(false);
    },
    [id, editText, onChangeLabel]
  );

  const handleCancel = useCallback(
    (e) => {
      e?.stopPropagation();
      setEditText(label);
      setIsEditing(false);
    },
    [label]
  );

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave(e);
    } else if (e.key === "Escape") {
      handleCancel(e);
    }
  };

  // Shape geometry calculations
  const isDiamond = shape === "diamond";
  const isCircle = shape === "circle";
  const isStadium = shape === "stadium";
  const isRounded = shape === "rounded";
  const isSubroutine = shape === "subroutine";

  const getBorderRadius = () => {
    if (isCircle) return "50%";
    if (isStadium) return "9999px";
    if (isRounded) return "16px";
    if (isSubroutine) return "4px";
    if (isDiamond) return "4px";
    return "6px";
  };

  const nodeStyle = {
    padding: isCircle ? "16px" : isDiamond ? "20px 24px" : isStadium ? "10px 24px" : isSubroutine ? "10px 22px" : "10px 18px",
    borderRadius: getBorderRadius(),
    background: fillColor || "var(--surface-elevated, #ffffff)",
    border: selected
      ? "2px solid var(--accent-solid, #3b82f6)"
      : strokeColor
      ? `1.5px solid ${strokeColor}`
      : "1px solid var(--border-soft, #cbd5e1)",
    color: textColor || "var(--text-strong, #0f172a)",
    minWidth: isCircle ? "90px" : isDiamond ? "110px" : "120px",
    minHeight: isCircle ? "90px" : isDiamond ? "110px" : "44px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    position: "relative",
    boxShadow: selected
      ? "0 0 0 3px color-mix(in srgb, var(--accent-solid, #3b82f6) 30%, transparent), 0 6px 16px rgba(0, 0, 0, 0.12)"
      : "0 2px 8px rgba(0, 0, 0, 0.08)",
    fontSize: "0.85rem",
    fontWeight: 500,
    letterSpacing: "-0.01em",
    transition: "all 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
    transform: isDiamond ? "rotate(45deg)" : "none",
  };

  const contentStyle = {
    transform: isDiamond ? "rotate(-45deg)" : "none",
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const handleStyle = {
    background: strokeColor || "var(--accent-solid, #3b82f6)",
    width: 8,
    height: 8,
    border: "1.5px solid #ffffff",
  };

  return (
    <div className={`mermaid-custom-node ${selected ? "selected" : ""} shape-${shape}`} style={nodeStyle}>
      {/* Subroutine Side Borders */}
      {isSubroutine && (
        <>
          <div className="subroutine-border-left" style={{ position: "absolute", left: 6, top: 0, bottom: 0, width: 1.5, background: strokeColor || "var(--border-soft, #cbd5e1)" }} />
          <div className="subroutine-border-right" style={{ position: "absolute", right: 6, top: 0, bottom: 0, width: 1.5, background: strokeColor || "var(--border-soft, #cbd5e1)" }} />
        </>
      )}

      {/* Connection Handles */}
      <Handle type="target" position={Position.Top} style={{ ...handleStyle, transform: isDiamond ? "rotate(-45deg)" : "none" }} />
      <Handle type="target" position={Position.Left} id="left" style={{ ...handleStyle, transform: isDiamond ? "rotate(-45deg)" : "none" }} />
      <Handle type="source" position={Position.Bottom} style={{ ...handleStyle, transform: isDiamond ? "rotate(-45deg)" : "none" }} />
      <Handle type="source" position={Position.Right} id="right" style={{ ...handleStyle, transform: isDiamond ? "rotate(-45deg)" : "none" }} />

      {/* Card Content */}
      <div style={contentStyle}>
        {isEditing ? (
          <div className="inline-editor-group" style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <input
              type="text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              className="inline-node-input"
              style={{
                background: "var(--surface-bg, #ffffff)",
                color: "var(--text-strong, #0f172a)",
                border: "1px solid var(--accent-solid, #3b82f6)",
                borderRadius: 4,
                padding: "2px 6px",
                fontSize: "0.82rem",
                width: "90px",
                textAlign: "center",
              }}
            />
            <button onClick={handleSave} className="inline-action-btn check" style={{ background: "none", border: "none", color: "var(--accent-solid)", cursor: "pointer", padding: 2 }}>
              <Check size={12} />
            </button>
            <button onClick={handleCancel} className="inline-action-btn cancel" style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 2 }}>
              <X size={12} />
            </button>
          </div>
        ) : (
          <div className="node-label-wrap" onDoubleClick={handleDoubleClick} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "text" }}>
            <span className="node-label-text">{label}</span>
            <Edit2 size={12} className="node-edit-icon" style={{ opacity: 0.4, transition: "opacity 0.15s ease" }} />
          </div>
        )}
      </div>

      {/* Floating Action Button on Selection */}
      {selected && !isEditing && (
        <button
          className="node-delete-badge"
          onClick={(e) => {
            e.stopPropagation();
            onDeleteNode?.(id);
          }}
          title="Delete Node"
          style={{
            position: "absolute",
            top: -8,
            right: -8,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "var(--danger-color, #ef4444)",
            color: "#ffffff",
            border: "1.5px solid #ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transform: isDiamond ? "rotate(-45deg)" : "none",
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
          }}
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );
});
