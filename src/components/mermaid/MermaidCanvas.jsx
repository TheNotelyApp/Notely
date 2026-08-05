import React, { useMemo } from "react";
import {
  ReactFlow,
  Controls,
  Background,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { MermaidNode } from "./MermaidNode";
import {
  Square,
  Circle,
  Diamond,
  Plus
} from "lucide-react";

export function MermaidCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  onEdgeClick,
  onPaneClick,
  onAddNode,
}) {
  const nodeTypes = useMemo(
    () => ({
      mermaidNode: MermaidNode,
    }),
    []
  );

  return (
    <div className="mermaid-canvas-wrapper" style={{ width: "100%", height: "100%", position: "relative", background: "var(--surface-bg, #ffffff)" }}>
      {/* Excalidraw-Style Floating Canvas Shape Bar */}
      <div
        className="excalidraw-floating-shapebar"
        style={{
          position: "absolute",
          top: 12,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 10,
          background: "var(--surface-elevated, #ffffff)",
          border: "1px solid var(--border-soft, #cbd5e1)",
          borderRadius: "var(--radius-md, 8px)",
          boxShadow: "var(--shadow-overlay, 0 8px 24px rgba(0, 0, 0, 0.12))",
          padding: "4px 8px",
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <button
          className="canvas-shape-btn"
          onClick={() => onAddNode?.("rectangle", "Process Step")}
          title="Add Rectangle Node"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 8px",
            border: "1px solid var(--border-default, #cbd5e1)",
            borderRadius: 4,
            background: "var(--surface-bg, #fff)",
            fontSize: "0.78rem",
            color: "var(--text-strong, #0f172a)",
            cursor: "pointer",
          }}
        >
          <Square size={14} /> Process
        </button>
        <button
          className="canvas-shape-btn"
          onClick={() => onAddNode?.("diamond", "Decision?")}
          title="Add Decision Node"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 8px",
            border: "1px solid var(--border-default, #cbd5e1)",
            borderRadius: 4,
            background: "var(--surface-bg, #fff)",
            fontSize: "0.78rem",
            color: "var(--text-strong, #0f172a)",
            cursor: "pointer",
          }}
        >
          <Diamond size={14} /> Decision
        </button>
        <button
          className="canvas-shape-btn"
          onClick={() => onAddNode?.("stadium", "Start / End")}
          title="Add Start/End Capsule Node"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 8px",
            border: "1px solid var(--border-default, #cbd5e1)",
            borderRadius: 4,
            background: "var(--surface-bg, #fff)",
            fontSize: "0.78rem",
            color: "var(--text-strong, #0f172a)",
            cursor: "pointer",
          }}
        >
          <Circle size={14} /> Start / End
        </button>
        <button
          className="canvas-shape-btn"
          onClick={() => onAddNode?.("circle", "State")}
          title="Add Circle State Node"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 8px",
            border: "1px solid var(--border-default, #cbd5e1)",
            borderRadius: 4,
            background: "var(--surface-bg, #fff)",
            fontSize: "0.78rem",
            color: "var(--text-strong, #0f172a)",
            cursor: "pointer",
          }}
        >
          <Circle size={14} /> Circle
        </button>
        <button
          className="canvas-shape-btn primary"
          onClick={() => onAddNode?.("rectangle", "New Node")}
          title="Add Quick Node"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 10px",
            border: "none",
            borderRadius: 4,
            background: "var(--accent-solid, #3b82f6)",
            color: "#ffffff",
            fontSize: "0.78rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <Plus size={14} /> Quick Add
        </button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        snapToGrid
        snapGrid={[15, 15]}
        defaultEdgeOptions={{
          animated: false,
          style: { strokeWidth: 2, stroke: "var(--accent-solid, #3b82f6)" },
        }}
      >
        <Background color="var(--border-subtle, #cbd5e1)" gap={20} />
        <Controls
          showZoom
          showFitView
          showInteractive={false}
          aria-label="Mermaid diagram zoom and fit controls"
          style={{
            borderRadius: 6,
            boxShadow: "var(--shadow-overlay, 0 8px 24px rgba(0,0,0,0.12))",
            border: "1px solid var(--border-soft, #e2e8f0)",
            overflow: "hidden",
            button: {
              background: "var(--surface-elevated, #ffffff)",
              color: "var(--text-strong, #0f172a)",
              border: "none",
              borderBottom: "1px solid var(--border-soft, #e2e8f0)",
            },
          }}
        />
      </ReactFlow>
    </div>
  );
}
