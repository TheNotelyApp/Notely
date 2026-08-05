import React, { useState, useEffect } from "react";
import { Handle, Position } from "@xyflow/react";
import { Trash2, Square, Circle, Diamond } from "lucide-react";
import { COLOR_PRESETS } from "./mermaidParser";

export function MermaidNode({ id, data, selected }) {
  const [isEditing, setIsEditing] = useState(false);
  const [label, setLabel] = useState(data.label || id);
  const shape = data.shape || "rectangle";
  const fillColor = data.fillColor;
  const strokeColor = data.strokeColor;
  const textColor = data.textColor;

  useEffect(() => {
    setLabel(data.label || id);
  }, [data.label, id]);

  const handleBlur = () => {
    setIsEditing(false);
    if (data.onChangeLabel) {
      data.onChangeLabel(id, label);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleBlur();
    }
  };

  const handleShapeChange = (newShape) => {
    if (data.onChangeShape) {
      data.onChangeShape(id, newShape);
    }
  };

  const handleColorPresetChange = (presetId) => {
    const preset = COLOR_PRESETS.find((p) => p.id === presetId);
    if (data.onChangeColor) {
      data.onChangeColor(id, {
        preset: presetId,
        fill: preset?.id === "default" ? undefined : preset?.fill,
        stroke: preset?.id === "default" ? undefined : preset?.stroke,
        text: preset?.id === "default" ? undefined : preset?.text,
      });
    }
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    if (data.onDeleteNode) {
      data.onDeleteNode(id);
    }
  };

  const getBorderRadius = () => {
    switch (shape) {
      case "stadium":
        return "999px";
      case "rounded":
        return "8px";
      case "circle":
        return "50%";
      case "diamond":
        return "4px";
      case "subroutine":
        return "2px";
      case "rectangle":
      default:
        return "6px";
    }
  };

  const isDiamond = shape === "diamond";
  const isSubroutine = shape === "subroutine";

  const nodeStyle = {
    padding: isDiamond ? "16px 20px" : isSubroutine ? "10px 20px" : "10px 16px",
    borderRadius: getBorderRadius(),
    background: fillColor || "var(--surface-elevated, #ffffff)",
    border: selected
      ? "2px solid var(--accent-solid, #3b82f6)"
      : strokeColor
      ? `1px solid ${strokeColor}`
      : "1px solid var(--border-soft, #cbd5e1)",
    color: textColor || "var(--text-strong, #0f172a)",
    minWidth: "120px",
    textAlign: "center",
    position: "relative",
    transform: isDiamond ? "rotate(45deg)" : "none",
    boxShadow: selected
      ? "0 0 0 3px color-mix(in srgb, var(--accent-solid, #3b82f6) 30%, transparent), 0 4px 12px rgba(0, 0, 0, 0.15)"
      : "0 2px 6px rgba(0, 0, 0, 0.08)",
    fontSize: "0.85rem",
    fontWeight: 500,
    letterSpacing: "-0.01em",
    transition: "all 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
  };



  return (
    <div className={`mermaid-custom-node ${selected ? "selected" : ""} shape-${shape}`} style={nodeStyle}>
      {/* Target handle top */}
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: strokeColor || "var(--accent-color, #007acc)",
          width: 8,
          height: 8,
          transform: isDiamond ? "rotate(-45deg)" : "none",
        }}
      />
      {/* Target handle left */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        style={{
          background: strokeColor || "var(--accent-color, #007acc)",
          width: 8,
          height: 8,
          transform: isDiamond ? "rotate(-45deg)" : "none",
        }}
      />

      {/* Subroutine inner border indicators */}
      {isSubroutine && (
        <>
          <div style={{ position: "absolute", top: 0, bottom: 0, left: 6, width: 1, background: strokeColor || "var(--border-soft, #555)" }} />
          <div style={{ position: "absolute", top: 0, bottom: 0, right: 6, width: 1, background: strokeColor || "var(--border-soft, #555)" }} />
        </>
      )}

      {/* Inner Content */}
      <div
        style={{
          transform: isDiamond ? "rotate(-45deg)" : "none",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "4px",
        }}
      >
        {isEditing ? (
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            autoFocus
            className="mermaid-node-input"
            style={{
              background: "var(--bg-subtle, #1e1e1e)",
              color: "var(--text-main, #fff)",
              border: "1px solid var(--accent-color, #007acc)",
              borderRadius: "4px",
              padding: "2px 6px",
              fontSize: "0.8rem",
              textAlign: "center",
              width: "100%",
            }}
          />
        ) : (
          <div
            onDoubleClick={() => setIsEditing(true)}
            style={{ cursor: "pointer", userSelect: "none" }}
            title="Double-click to edit label"
          >
            {label}
          </div>
        )}

        {/* Toolbar on Node selection */}
        {selected && (
          <div
            className="node-selection-actions"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              marginTop: "6px",
              background: "var(--bg-card, #1f232a)",
              padding: "4px 8px",
              borderRadius: "6px",
              border: "1px solid var(--border-subtle, #333)",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
              zIndex: 10,
            }}
          >
            <button
              onClick={() => handleShapeChange("rectangle")}
              title="Rectangle"
              style={{ background: "none", border: "none", color: shape === "rectangle" ? "var(--accent-color, #007acc)" : "var(--text-muted)", cursor: "pointer", padding: "2px" }}
            >
              <Square size={12} />
            </button>
            <button
              onClick={() => handleShapeChange("stadium")}
              title="Stadium (Start/End)"
              style={{ background: "none", border: "none", color: shape === "stadium" ? "var(--accent-color, #007acc)" : "var(--text-muted)", cursor: "pointer", padding: "2px", borderRadius: "999px" }}
            >
              <Square size={12} style={{ borderRadius: "6px" }} />
            </button>
            <button
              onClick={() => handleShapeChange("diamond")}
              title="Diamond (Decision)"
              style={{ background: "none", border: "none", color: shape === "diamond" ? "var(--accent-color, #007acc)" : "var(--text-muted)", cursor: "pointer", padding: "2px" }}
            >
              <Diamond size={12} />
            </button>
            <button
              onClick={() => handleShapeChange("circle")}
              title="Circle"
              style={{ background: "none", border: "none", color: shape === "circle" ? "var(--accent-color, #007acc)" : "var(--text-muted)", cursor: "pointer", padding: "2px" }}
            >
              <Circle size={12} />
            </button>

            {/* Quick Color Preset Swatches */}
            <div style={{ display: "flex", alignItems: "center", gap: "3px", marginLeft: "4px", paddingLeft: "4px", borderLeft: "1px solid var(--border-soft, #444)" }}>
              {COLOR_PRESETS.slice(1, 6).map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleColorPresetChange(preset.id)}
                  title={preset.label}
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: preset.stroke,
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                  }}
                />
              ))}
            </div>

            <button
              onClick={handleDelete}
              title="Delete node"
              style={{ background: "none", border: "none", color: "var(--danger-color, #ef4444)", cursor: "pointer", padding: "2px", marginLeft: "4px" }}
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Source handle bottom */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: strokeColor || "var(--accent-color, #007acc)",
          width: 8,
          height: 8,
          transform: isDiamond ? "rotate(-45deg)" : "none",
        }}
      />
      {/* Source handle right */}
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={{
          background: strokeColor || "var(--accent-color, #007acc)",
          width: 8,
          height: 8,
          transform: isDiamond ? "rotate(-45deg)" : "none",
        }}
      />
    </div>
  );
}
