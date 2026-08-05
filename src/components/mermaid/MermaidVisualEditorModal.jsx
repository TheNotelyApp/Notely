import { useState, useEffect, useCallback, useRef } from "react";
import {
  useNodesState,
  useEdgesState,
  addEdge,
} from "@xyflow/react";
import dagre from "dagre";
import {
  Save,
  X,
  RotateCcw,
  Code2,
  Eye,
  Workflow,
  Sliders,
  Palette,
  Trash2,
  Undo,
  Redo,
  Copy,
  Check,
  Info,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from "lucide-react";
import { MermaidCanvas } from "./MermaidCanvas";
import { parseMermaidToFlow, generateMermaidFromFlow, COLOR_PRESETS } from "./mermaidParser";
import { MermaidBlock } from "../MermaidBlock";
import OverlayDialog from "../OverlayDialog";
import AppButton from "../AppButton";
import AppSelect from "../AppSelect";
import "../../styles/mermaidEditor.css";

function FullpageMermaidPreview({ code }) {
  const [zoomScale, setZoomScale] = useState(1);
  const [panPos, setPanPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const cleanCode = code?.trim() || "";

  const handleMouseDown = (e) => {
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - panPos.x, y: e.clientY - panPos.y };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPanPos({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 0.1 : -0.1;
    setZoomScale((prev) => Math.min(Math.max(prev + zoomFactor, 0.4), 3));
  };

  const handleReset = () => {
    setZoomScale(1);
    setPanPos({ x: 0, y: 0 });
  };

  if (!cleanCode) {
    return (
      <div className="fullpage-preview-empty" style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: "0.88rem" }}>
        No diagram code to preview. Switch to <strong>Visual Canvas</strong> or <strong>Mermaid Code</strong> tab to build your diagram.
      </div>
    );
  }

  return (
    <div
      className={`fullpage-preview-container ${isDragging ? "is-dragging" : ""}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: "var(--surface-bg, #ffffff)",
        cursor: isDragging ? "grabbing" : "pointer",
        userSelect: "none",
      }}
    >
      {/* Zoom Toolbar */}
      <div
        className="preview-zoom-toolbar"
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          zIndex: 10,
          background: "var(--surface-elevated, #ffffff)",
          border: "1px solid var(--border-soft, #cbd5e1)",
          borderRadius: "var(--radius-md, 6px)",
          boxShadow: "var(--shadow-overlay, 0 8px 24px rgba(0,0,0,0.12))",
          padding: "4px 8px",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <button
          onClick={() => setZoomScale((prev) => Math.min(prev + 0.2, 3))}
          title="Zoom In"
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-strong)", padding: 4 }}
        >
          <ZoomIn size={14} />
        </button>
        <span style={{ fontSize: "0.76rem", fontWeight: 600, color: "var(--text-muted)", minWidth: 40, textAlign: "center" }}>
          {Math.round(zoomScale * 100)}%
        </span>
        <button
          onClick={() => setZoomScale((prev) => Math.max(prev - 0.2, 0.4))}
          title="Zoom Out"
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-strong)", padding: 4 }}
        >
          <ZoomOut size={14} />
        </button>
        <button
          onClick={handleReset}
          title="Reset Zoom & Pan"
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-strong)", padding: 4 }}
        >
          <Maximize2 size={14} />
        </button>
      </div>

      {/* Full Viewport Renderer */}
      <div
        className="fullpage-svg-viewport"
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          padding: 32,
        }}
      >
        <div
          style={{
            transform: `translate(${panPos.x}px, ${panPos.y}px) scale(${zoomScale})`,
            transformOrigin: "center center",
            transition: isDragging ? "none" : "transform 0.1s ease-out",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
          }}
        >
          <MermaidBlock code={cleanCode} />
        </div>
      </div>
    </div>
  );
}

const DIAGRAM_TEMPLATES = {
  flowchart: `flowchart TD\n    A["Start Task"] -->|Next| B("In Progress")\n    B --> C{"Is Done?"}\n    C -->|Yes| D(("Complete"))`,
  sequence: `sequenceDiagram\n    autonumber\n    actor User\n    participant App as App Frontend\n    participant API as Backend Service\n    User->>App: Click Submit\n    App->>API: POST /data\n    API-->>App: 200 OK\n    App-->>User: Show Success Banner`,
  class: `classDiagram\n    class User {\n        +String id\n        +String name\n        +login()\n    }\n    class Document {\n        +String title\n        +save()\n    }\n    User "1" --> "*" Document : owns`,
  state: `stateDiagram-v2\n    [*] --> Draft\n    Draft --> Reviewing: Submit\n    Reviewing --> Approved: Accept\n    Reviewing --> Draft: Request Changes\n    Approved --> [*]`,
};

export function MermaidVisualEditorModal({
  initialCode = "",
  isOpen = false,
  onClose,
  onSave,
}) {
  const [activeTab, setActiveTab] = useState("visual"); // "visual" | "code" | "preview"
  const [diagramType, setDiagramType] = useState("flowchart"); // "flowchart" | "sequence" | "class" | "state"
  const [direction, setDirection] = useState("TD");
  const [mermaidCode, setMermaidCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [copied, setCopied] = useState(false);
  const [selectedElement, setSelectedElement] = useState(null); // { type: "node" | "edge", id: string }

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Undo / Redo History
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isInternalUpdateRef = useRef(false);

  const saveButtonRef = useRef(null);
  const edgesRef = useRef(edges);
  edgesRef.current = edges;

  const directionRef = useRef(direction);
  directionRef.current = direction;

  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  // Push state to history
  const pushHistory = useCallback((currentNodes, currentEdges, currentDir) => {
    if (isInternalUpdateRef.current) return;
    const snapshot = {
      nodes: JSON.parse(JSON.stringify(currentNodes)),
      edges: JSON.parse(JSON.stringify(currentEdges)),
      direction: currentDir,
    };
    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1);
      return [...newHistory, snapshot];
    });
    setHistoryIndex((prev) => prev + 1);
  }, [historyIndex]);

  // Sync canvas -> code
  const syncCodeFromFlow = useCallback(
    (currentNodes, currentEdges, currentDir, recordHistory = true) => {
      if (diagramType !== "flowchart") return;
      const code = generateMermaidFromFlow(currentNodes, currentEdges, currentDir);
      setMermaidCode(code);
      setCodeError("");
      if (recordHistory) {
        pushHistory(currentNodes, currentEdges, currentDir);
      }
    },
    [diagramType, pushHistory]
  );

  // Handle label change on custom node
  const handleNodeLabelChange = useCallback(
    (nodeId, newLabel) => {
      setNodes((nds) => {
        const updated = nds.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, label: newLabel } }
            : n
        );
        syncCodeFromFlow(updated, edgesRef.current, directionRef.current);
        return updated;
      });
    },
    [setNodes, syncCodeFromFlow]
  );

  // Handle shape change on custom node
  const handleNodeShapeChange = useCallback(
    (nodeId, newShape) => {
      setNodes((nds) => {
        const updated = nds.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, shape: newShape } }
            : n
        );
        syncCodeFromFlow(updated, edgesRef.current, directionRef.current);
        return updated;
      });
    },
    [setNodes, syncCodeFromFlow]
  );

  // Handle color change on custom node
  const handleNodeColorChange = useCallback(
    (nodeId, { preset, fill, stroke, text }) => {
      setNodes((nds) => {
        const updated = nds.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                data: {
                  ...n.data,
                  colorPreset: preset,
                  fillColor: fill,
                  strokeColor: stroke,
                  textColor: text,
                },
              }
            : n
        );
        syncCodeFromFlow(updated, edgesRef.current, directionRef.current);
        return updated;
      });
    },
    [setNodes, syncCodeFromFlow]
  );

  // Handle delete node
  const handleNodeDelete = useCallback(
    (nodeId) => {
      setNodes((nds) => {
        const updated = nds.filter((n) => n.id !== nodeId);
        setEdges((eds) => {
          const updatedEdges = eds.filter(
            (e) => e.source !== nodeId && e.target !== nodeId
          );
          syncCodeFromFlow(updated, updatedEdges, directionRef.current);
          return updatedEdges;
        });
        return updated;
      });
      setSelectedElement(null);
    },
    [setEdges, setNodes, syncCodeFromFlow]
  );

  // Attach interactive callbacks to node data
  const attachNodeCallbacks = useCallback(
    (nodesList) => {
      return nodesList.map((n) => ({
        ...n,
        data: {
          ...n.data,
          onChangeLabel: handleNodeLabelChange,
          onChangeShape: handleNodeShapeChange,
          onChangeColor: handleNodeColorChange,
          onDeleteNode: handleNodeDelete,
        },
      }));
    },
    [handleNodeLabelChange, handleNodeShapeChange, handleNodeColorChange, handleNodeDelete]
  );

  // Track modal open state
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      wasOpenRef.current = true;
      const rawCode = initialCode.trim() || DIAGRAM_TEMPLATES.flowchart;
      setMermaidCode(rawCode);

      if (rawCode.startsWith("sequenceDiagram")) {
        setDiagramType("sequence");
        setActiveTab("code");
        setCodeError("");
      } else if (rawCode.startsWith("classDiagram")) {
        setDiagramType("class");
        setActiveTab("code");
        setCodeError("");
      } else if (rawCode.startsWith("stateDiagram")) {
        setDiagramType("state");
        setActiveTab("code");
        setCodeError("");
      } else {
        setDiagramType("flowchart");
        setActiveTab("visual");
        try {
          const parsed = parseMermaidToFlow(rawCode);
          setDirection(parsed.direction || "TD");
          const initialNodes = attachNodeCallbacks(parsed.nodes);
          setNodes(initialNodes);
          setEdges(parsed.edges);
          setCodeError("");

          setHistory([{ nodes: JSON.parse(JSON.stringify(initialNodes)), edges: JSON.parse(JSON.stringify(parsed.edges)), direction: parsed.direction || "TD" }]);
          setHistoryIndex(0);
        } catch (err) {
          setCodeError(err.message || "Failed to parse initial Mermaid code.");
        }
      }
    } else if (!isOpen) {
      wasOpenRef.current = false;
      setSelectedElement(null);
    }
  }, [isOpen, initialCode, attachNodeCallbacks, setEdges, setNodes]);

  // Handle switching diagram type template cleanly
  const handleDiagramTypeChange = (newType) => {
    setDiagramType(newType);
    const templateCode = DIAGRAM_TEMPLATES[newType] || DIAGRAM_TEMPLATES.flowchart;
    setMermaidCode(templateCode);
    setCodeError("");

    if (newType !== "flowchart") {
      setActiveTab("code");
    } else {
      setActiveTab("visual");
      try {
        const parsed = parseMermaidToFlow(templateCode);
        setDirection(parsed.direction || "TD");
        const initialNodes = attachNodeCallbacks(parsed.nodes);
        setNodes(initialNodes);
        setEdges(parsed.edges);
      } catch (err) {
        console.warn("Failed to parse flowchart template:", err);
      }
    }
  };

  // Sync code -> canvas on code edit
  const handleCodeChange = (newCode) => {
    setMermaidCode(newCode);
    const trimmed = newCode.trim();

    if (trimmed.startsWith("sequenceDiagram")) {
      setDiagramType("sequence");
      setCodeError("");
      return;
    }
    if (trimmed.startsWith("classDiagram")) {
      setDiagramType("class");
      setCodeError("");
      return;
    }
    if (trimmed.startsWith("stateDiagram")) {
      setDiagramType("state");
      setCodeError("");
      return;
    }

    setDiagramType("flowchart");
    try {
      const parsed = parseMermaidToFlow(newCode);
      setDirection(parsed.direction || "TD");
      const updatedNodes = attachNodeCallbacks(parsed.nodes);
      setNodes(updatedNodes);
      setEdges(parsed.edges);
      setCodeError("");
      pushHistory(updatedNodes, parsed.edges, parsed.direction || "TD");
    } catch (err) {
      setCodeError(err.message || "Invalid Mermaid syntax.");
    }
  };

  // Real-time direction change (TD, LR, RL, BT) with instant Dagre re-layout
  const handleDirectionChange = (newDir) => {
    setDirection(newDir);

    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: newDir, nodesep: 60, ranksep: 80 });
    g.setDefaultEdgeLabel(() => ({}));

    nodes.forEach((n) => g.setNode(n.id, { width: 150, height: 50 }));
    edges.forEach((e) => g.setEdge(e.source, e.target));

    dagre.layout(g);

    const updatedNodes = nodes.map((node) => {
      const pos = g.node(node.id);
      return {
        ...node,
        position: {
          x: (pos?.x || 100) - 75,
          y: (pos?.y || 100) - 25,
        },
      };
    });

    setNodes(updatedNodes);
    syncCodeFromFlow(updatedNodes, edges, newDir);
  };

  // Auto layout using Dagre
  const handleAutoLayout = () => {
    handleDirectionChange(direction);
  };

  // Undo / Redo handlers
  const handleUndo = () => {
    if (historyIndex > 0) {
      isInternalUpdateRef.current = true;
      const targetIndex = historyIndex - 1;
      const snapshot = history[targetIndex];
      setDirection(snapshot.direction);
      const updatedNodes = attachNodeCallbacks(snapshot.nodes);
      setNodes(updatedNodes);
      setEdges(snapshot.edges);
      setMermaidCode(generateMermaidFromFlow(updatedNodes, snapshot.edges, snapshot.direction));
      setHistoryIndex(targetIndex);
      setTimeout(() => {
        isInternalUpdateRef.current = false;
      }, 50);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      isInternalUpdateRef.current = true;
      const targetIndex = historyIndex + 1;
      const snapshot = history[targetIndex];
      setDirection(snapshot.direction);
      const updatedNodes = attachNodeCallbacks(snapshot.nodes);
      setNodes(updatedNodes);
      setEdges(snapshot.edges);
      setMermaidCode(generateMermaidFromFlow(updatedNodes, snapshot.edges, snapshot.direction));
      setHistoryIndex(targetIndex);
      setTimeout(() => {
        isInternalUpdateRef.current = false;
      }, 50);
    }
  };

  // Connect edges handler
  const onConnect = useCallback(
    (params) => {
      setEdges((eds) => {
        const updated = addEdge(
          {
            ...params,
            animated: false,
            style: { strokeWidth: 2, stroke: "var(--accent-solid, #3b82f6)" },
            data: { lineStyle: "solid" },
          },
          eds
        );
        syncCodeFromFlow(nodesRef.current, updated, directionRef.current);
        return updated;
      });
    },
    [syncCodeFromFlow, setEdges]
  );

  // Selection handlers
  const handleNodeClick = (_, node) => {
    setSelectedElement({ type: "node", id: node.id });
  };

  const handleEdgeClick = (_, edge) => {
    setSelectedElement({ type: "edge", id: edge.id });
  };

  const handlePaneClick = () => {
    setSelectedElement(null);
  };

  // Add new node with specified shape preset
  const handleAddNodePreset = (shapePreset = "rectangle", defaultLabel = "New Step") => {
    const newId = `node-${Date.now().toString().slice(-4)}`;
    const newNode = {
      id: newId,
      type: "mermaidNode",
      data: {
        label: defaultLabel,
        shape: shapePreset,
        onChangeLabel: handleNodeLabelChange,
        onChangeShape: handleNodeShapeChange,
        onChangeColor: handleNodeColorChange,
        onDeleteNode: handleNodeDelete,
      },
      position: { x: 150 + Math.random() * 80, y: 150 + Math.random() * 80 },
    };

    setNodes((nds) => {
      const updated = [...nds, newNode];
      syncCodeFromFlow(updated, edgesRef.current, directionRef.current);
      return updated;
    });
    setSelectedElement({ type: "node", id: newId });
  };

  // Edge property updates
  const handleEdgeLabelChange = (edgeId, newLabel) => {
    setEdges((eds) => {
      const updated = eds.map((e) =>
        e.id === edgeId ? { ...e, label: newLabel } : e
      );
      syncCodeFromFlow(nodesRef.current, updated, directionRef.current);
      return updated;
    });
  };

  const handleEdgeLineStyleChange = (edgeId, lineStyle) => {
    setEdges((eds) => {
      const updated = eds.map((e) => {
        if (e.id !== edgeId) return e;
        const animated = lineStyle === "dashed";
        const strokeWidth = lineStyle === "thick" ? 4 : 2;
        const strokeDasharray = lineStyle === "dashed" ? "5,5" : undefined;
        return {
          ...e,
          animated,
          style: { ...e.style, strokeWidth, strokeDasharray },
          data: { ...e.data, lineStyle },
        };
      });
      syncCodeFromFlow(nodesRef.current, updated, directionRef.current);
      return updated;
    });
  };

  const handleEdgeDelete = (edgeId) => {
    setEdges((eds) => {
      const updated = eds.filter((e) => e.id !== edgeId);
      syncCodeFromFlow(nodesRef.current, updated, directionRef.current);
      return updated;
    });
    setSelectedElement(null);
  };

  // Copy code handler
  const handleCopyCode = async () => {
    try {
      const code = diagramType === "flowchart" ? generateMermaidFromFlow(nodes, edges, direction) : mermaidCode;
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy code:", err);
    }
  };

  // Save handler
  const handleSave = () => {
    const finalCode = diagramType === "flowchart" ? generateMermaidFromFlow(nodes, edges, direction) : mermaidCode;
    onSave?.(finalCode);
    onClose?.();
  };

  const activeSelectedNode = selectedElement?.type === "node" ? nodes.find((n) => n.id === selectedElement.id) : null;
  const activeSelectedEdge = selectedElement?.type === "edge" ? edges.find((e) => e.id === selectedElement.id) : null;

  if (!isOpen) return null;

  const currentActiveCode = diagramType === "flowchart" ? generateMermaidFromFlow(nodes, edges, direction) : mermaidCode;

  return (
    <OverlayDialog
      open={isOpen}
      onClose={onClose}
      closeOnClickOutside={false}
      ariaLabel="Mermaid Visual Editor"
      overlayClassName="excalidraw-modal-overlay"
      cardClassName="excalidraw-modal-container mermaid-modal-container"
      useDefaultCardClass={false}
      size=""
      initialFocusRef={saveButtonRef}
    >
      {/* Standard App Modal Header */}
      <div className="excalidraw-modal-header mermaid-modal-header">
        <div className="modal-title-group">
          <Workflow size={16} className="modal-title-icon" />
          <h2>Mermaid Editor</h2>
        </div>

        {/* Clean 3 Main View Tabs */}
        <div className="mermaid-view-tabs" role="tablist">
          <button
            className={`tab-btn ${activeTab === "visual" ? "active" : ""}`}
            onClick={() => setActiveTab("visual")}
            disabled={diagramType !== "flowchart"}
            title={diagramType !== "flowchart" ? "Visual drag-and-drop editor supported for Flowcharts" : "Visual Canvas"}
            style={{ opacity: diagramType !== "flowchart" ? 0.5 : 1 }}
          >
            <Workflow size={14} />
            Visual Canvas
          </button>
          <button
            className={`tab-btn ${activeTab === "code" ? "active" : ""}`}
            onClick={() => setActiveTab("code")}
          >
            <Code2 size={14} />
            Mermaid Code
          </button>
          <button
            className={`tab-btn ${activeTab === "preview" ? "active" : ""}`}
            onClick={() => setActiveTab("preview")}
          >
            <Eye size={14} />
            Live Preview
          </button>
        </div>

        {/* Action Buttons */}
        <div className="excalidraw-modal-actions">
          <AppButton variant="small" onClick={handleCopyCode} title="Copy Mermaid Markdown Code">
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied" : "Copy Code"}
          </AppButton>
          <AppButton ref={saveButtonRef} variant="primary" onClick={handleSave}>
            <Save size={14} aria-hidden="true" />
            Save Diagram
          </AppButton>
          <AppButton variant="small" onClick={onClose}>
            <X size={14} aria-hidden="true" />
            Close
          </AppButton>
        </div>
      </div>

      {/* Toolbar for Visual Editor View */}
      {activeTab === "visual" && diagramType === "flowchart" && (
        <div className="mermaid-editor-toolbar">
          <div className="toolbar-left">
            <div className="diagram-type-select-group" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 500 }}>Type:</span>
              <AppSelect
                value={diagramType}
                onChange={(e) => handleDiagramTypeChange(e.target.value)}
                style={{ height: 26, fontSize: "0.78rem", padding: "0 8px" }}
              >
                <option value="flowchart">Flowchart</option>
                <option value="sequence">Sequence Diagram</option>
                <option value="class">Class Diagram</option>
                <option value="state">State Diagram</option>
              </AppSelect>
            </div>

            <div className="toolbar-divider" />

            <button
              className="toolbar-btn"
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              title="Undo last change"
              style={{ opacity: historyIndex <= 0 ? 0.5 : 1 }}
            >
              <Undo size={14} />
            </button>
            <button
              className="toolbar-btn"
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              title="Redo change"
              style={{ opacity: historyIndex >= history.length - 1 ? 0.5 : 1 }}
            >
              <Redo size={14} />
            </button>

            <div className="toolbar-divider" />

            <button className="toolbar-btn" onClick={handleAutoLayout} title="Auto Align layout with Dagre">
              <RotateCcw size={14} />
              Auto Align
            </button>

            <div className="direction-selector">
              <span>Layout:</span>
              {["TD", "LR", "RL", "BT"].map((dir) => (
                <button
                  key={dir}
                  className={`dir-btn ${direction === dir ? "active" : ""}`}
                  onClick={() => handleDirectionChange(dir)}
                >
                  {dir}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal Body / Dedicated Full-Height Views */}
      <div className={`mermaid-modal-body tab-${activeTab}`}>
        {/* Tab 1: Visual Canvas */}
        {activeTab === "visual" && (
          <div className="mermaid-panel canvas-panel" style={{ position: "relative", width: "100%", height: "100%" }}>
            <MermaidCanvas
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={handleNodeClick}
              onEdgeClick={handleEdgeClick}
              onPaneClick={handlePaneClick}
              onAddNode={handleAddNodePreset}
            />

            {/* Node Inspector Drawer */}
            {activeSelectedNode && (
              <div className="mermify-inspector-drawer">
                <div className="drawer-header">
                  <Sliders size={14} />
                  <span>Node Inspector</span>
                  <button className="drawer-close-btn" onClick={() => setSelectedElement(null)}>
                    <X size={12} />
                  </button>
                </div>

                <div className="drawer-section">
                  <label>Label</label>
                  <input
                    type="text"
                    value={activeSelectedNode.data.label || ""}
                    onChange={(e) => handleNodeLabelChange(activeSelectedNode.id, e.target.value)}
                    className="inspector-input"
                  />
                </div>

                <div className="drawer-section">
                  <label>Shape</label>
                  <div className="shape-picker-grid">
                    {[
                      { id: "rectangle", label: "Rectangle [ ]" },
                      { id: "stadium", label: "Stadium ([ ])" },
                      { id: "diamond", label: "Diamond { }" },
                      { id: "circle", label: "Circle (( ))" },
                      { id: "rounded", label: "Rounded ( )" },
                      { id: "subroutine", label: "Subroutine [[ ]]" },
                    ].map((s) => (
                      <button
                        key={s.id}
                        className={`shape-btn ${activeSelectedNode.data.shape === s.id ? "active" : ""}`}
                        onClick={() => handleNodeShapeChange(activeSelectedNode.id, s.id)}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="drawer-section">
                  <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Palette size={12} /> Theme Color Preset
                  </label>
                  <div className="color-preset-grid">
                    {COLOR_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        className={`color-preset-btn ${activeSelectedNode.data.colorPreset === preset.id ? "active" : ""}`}
                        onClick={() =>
                          handleNodeColorChange(activeSelectedNode.id, {
                            preset: preset.id,
                            fill: preset.id === "default" ? undefined : preset.fill,
                            stroke: preset.id === "default" ? undefined : preset.stroke,
                            text: preset.id === "default" ? undefined : preset.text,
                          })
                        }
                        style={{
                          background: preset.stroke,
                          borderColor: activeSelectedNode.data.colorPreset === preset.id ? "var(--accent-solid, #3b82f6)" : "transparent",
                        }}
                        title={preset.label}
                      />
                    ))}
                  </div>
                </div>

                <div className="drawer-footer">
                  <button className="drawer-delete-btn" onClick={() => handleNodeDelete(activeSelectedNode.id)}>
                    <Trash2 size={12} /> Delete Node
                  </button>
                </div>
              </div>
            )}

            {/* Edge Inspector Drawer */}
            {activeSelectedEdge && (
              <div className="mermify-inspector-drawer">
                <div className="drawer-header">
                  <Sliders size={14} />
                  <span>Connector Inspector</span>
                  <button className="drawer-close-btn" onClick={() => setSelectedElement(null)}>
                    <X size={12} />
                  </button>
                </div>

                <div className="drawer-section">
                  <label>Connector Label</label>
                  <input
                    type="text"
                    value={activeSelectedEdge.label || ""}
                    onChange={(e) => handleEdgeLabelChange(activeSelectedEdge.id, e.target.value)}
                    placeholder="e.g. Yes / No"
                    className="inspector-input"
                  />
                </div>

                <div className="drawer-section">
                  <label>Line Style</label>
                  <div className="shape-picker-grid">
                    {[
                      { id: "solid", label: "Solid (-->)" },
                      { id: "dashed", label: "Dashed (-.->)" },
                      { id: "thick", label: "Thick (==>)" },
                    ].map((ls) => (
                      <button
                        key={ls.id}
                        className={`shape-btn ${(activeSelectedEdge.data?.lineStyle || "solid") === ls.id ? "active" : ""}`}
                        onClick={() => handleEdgeLineStyleChange(activeSelectedEdge.id, ls.id)}
                      >
                        {ls.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="drawer-footer">
                  <button className="drawer-delete-btn" onClick={() => handleEdgeDelete(activeSelectedEdge.id)}>
                    <Trash2 size={12} /> Delete Connector
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Mermaid Code */}
        {activeTab === "code" && (
          <div className="mermaid-panel code-panel full-panel">
            <div className="code-editor-header">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span>Diagram Type:</span>
                <AppSelect
                  value={diagramType}
                  onChange={(e) => handleDiagramTypeChange(e.target.value)}
                  style={{ height: 24, fontSize: "0.76rem" }}
                >
                  <option value="flowchart">Flowchart</option>
                  <option value="sequence">Sequence Diagram</option>
                  <option value="class">Class Diagram</option>
                  <option value="state">State Diagram</option>
                </AppSelect>
              </div>
              {codeError && <span className="code-error-badge">{codeError}</span>}
            </div>

            {diagramType !== "flowchart" && (
              <div className="diagram-type-notice" style={{ padding: "8px 14px", background: "var(--surface-elevated)", borderBottom: "1px solid var(--border-soft)", fontSize: "0.78rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
                <Info size={14} style={{ color: "var(--accent-solid)" }} />
                <span>Editing <strong>{diagramType}</strong> syntax. Switch to <strong>Live Preview</strong> tab to see rendered diagram.</span>
              </div>
            )}

            <textarea
              value={mermaidCode}
              onChange={(e) => handleCodeChange(e.target.value)}
              placeholder="flowchart TD..."
              className="mermaid-code-input"
              spellCheck="false"
            />
          </div>
        )}

        {/* Tab 3: Fullpage Live Preview with Zoom */}
        {activeTab === "preview" && (
          <div className="mermaid-panel preview-panel full-panel">
            <FullpageMermaidPreview code={currentActiveCode} />
          </div>
        )}
      </div>
    </OverlayDialog>
  );
}
