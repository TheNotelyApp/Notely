import React, { useMemo } from "react";
import {
  ReactFlow,
  Controls,
  Background,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { MermaidNode } from "./MermaidNode";

export function MermaidCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  onEdgeClick,
  onPaneClick,
}) {
  const nodeTypes = useMemo(
    () => ({
      mermaidNode: MermaidNode,
    }),
    []
  );

  return (
    <div className="mermaid-canvas-wrapper" style={{ width: "100%", height: "100%", position: "relative", background: "var(--surface-bg, #ffffff)" }}>
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
