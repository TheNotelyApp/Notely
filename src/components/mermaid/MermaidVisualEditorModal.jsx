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
  Plus,
  RotateCcw,
  Code2,
  Eye,
  Columns,
  Workflow,
  Sliders,
  Palette,
  Circle,
  Diamond,
  Trash2,
} from "lucide-react";
import { MermaidCanvas } from "./MermaidCanvas";
import { parseMermaidToFlow, generateMermaidFromFlow, COLOR_PRESETS } from "./mermaidParser";
import { MermaidBlock } from "../MermaidBlock";
import OverlayDialog from "../OverlayDialog";
import AppButton from "../AppButton";
import "../../styles/mermaidEditor.css";

export function MermaidVisualEditorModal({
  initialCode = "",
  isOpen = false,
  onClose,
  onSave,
}) {
  const [activeTab, setActiveTab] = useState("split"); // "split" | "visual" | "code"
  const [direction, setDirection] = useState("TD");
  const [mermaidCode, setMermaidCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [selectedElement, setSelectedElement] = useState(null); // { type: "node" | "edge", id: string }

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const saveButtonRef = useRef(null);
  const edgesRef = useRef(edges);
  edgesRef.current = edges;

  const directionRef = useRef(direction);
  directionRef.current = direction;

  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  // Sync canvas -> code
  const syncCodeFromFlow = useCallback(
    (currentNodes, currentEdges, currentDir) => {
      const code = generateMermaidFromFlow(currentNodes, currentEdges, currentDir);
      setMermaidCode(code);
      setCodeError("");
    },
    []
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

  // Track modal open state to run initialization ONLY when modal opens
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      wasOpenRef.current = true;
      const rawCode = initialCode.trim() || `flowchart TD\n    A["Start Task"] -->|Next| B("In Progress")\n    B --> C{"Is Done?"}\n    C -->|Yes| D(("Complete"))`;
      setMermaidCode(rawCode);

      try {
        const parsed = parseMermaidToFlow(rawCode);
        setDirection(parsed.direction || "TD");
        setNodes(attachNodeCallbacks(parsed.nodes));
        setEdges(parsed.edges);
        setCodeError("");
      } catch (err) {
        setCodeError(err.message || "Failed to parse initial Mermaid code.");
      }
    } else if (!isOpen) {
      wasOpenRef.current = false;
      setSelectedElement(null);
    }
  }, [isOpen, initialCode, attachNodeCallbacks, setEdges, setNodes]);

  // Sync code -> canvas on code edit
  const handleCodeChange = (newCode) => {
    setMermaidCode(newCode);
    try {
      const parsed = parseMermaidToFlow(newCode);
      setDirection(parsed.direction || "TD");
      setNodes(attachNodeCallbacks(parsed.nodes));
      setEdges(parsed.edges);
      setCodeError("");
    } catch (err) {
      setCodeError(err.message || "Invalid Mermaid flowchart syntax.");
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

  // Change direction (TD, LR, RL, BT)
  const handleDirectionChange = (newDir) => {
    setDirection(newDir);
    syncCodeFromFlow(nodesRef.current, edgesRef.current, newDir);
  };

  // Auto layout using Dagre
  const handleAutoLayout = () => {
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: direction, nodesep: 60, ranksep: 80 });
    g.setDefaultEdgeLabel(() => ({}));

    nodes.forEach((n) => g.setNode(n.id, { width: 150, height: 50 }));
    edges.forEach((e) => g.setEdge(e.source, e.target));

    dagre.layout(g);

    setNodes((nds) =>
      nds.map((node) => {
        const pos = g.node(node.id);
        return {
          ...node,
          position: {
            x: (pos?.x || 100) - 75,
            y: (pos?.y || 100) - 25,
          },
        };
      })
    );
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

  // Save handler
  const handleSave = () => {
    const finalCode = generateMermaidFromFlow(nodes, edges, direction);
    onSave?.(finalCode);
    onClose?.();
  };

  const activeSelectedNode = selectedElement?.type === "node" ? nodes.find((n) => n.id === selectedElement.id) : null;
  const activeSelectedEdge = selectedElement?.type === "edge" ? edges.find((e) => e.id === selectedElement.id) : null;

  if (!isOpen) return null;

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
      {/* Standard App Modal Header (matching Excalidraw) */}
      <div className="excalidraw-modal-header mermaid-modal-header">
        <div className="modal-title-group">
          <Workflow size={16} className="modal-title-icon" />
          <h2>Mermaid Visual Editor</h2>
        </div>

        {/* View Mode Tabs */}
        <div className="mermaid-view-tabs" role="tablist">
          <button
            className={`tab-btn ${activeTab === "split" ? "active" : ""}`}
            onClick={() => setActiveTab("split")}
          >
            <Columns size={14} />
            Split View
          </button>
          <button
            className={`tab-btn ${activeTab === "visual" ? "active" : ""}`}
            onClick={() => setActiveTab("visual")}
          >
            <Eye size={14} />
            Visual Canvas
          </button>
          <button
            className={`tab-btn ${activeTab === "code" ? "active" : ""}`}
            onClick={() => setActiveTab("code")}
          >
            <Code2 size={14} />
            Mermaid Code
          </button>
        </div>

        {/* Action buttons (matching Excalidraw) */}
        <div className="excalidraw-modal-actions">
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

      {/* Mermify Toolbar */}
      <div className="mermaid-editor-toolbar">
        <div className="toolbar-left">
          <div className="preset-insert-group">
            <button className="toolbar-btn primary" onClick={() => handleAddNodePreset("rectangle", "Process Step")}>
              <Plus size={14} />
              Add Node
            </button>
            <button className="toolbar-btn preset-btn" onClick={() => handleAddNodePreset("diamond", "Decision?")} title="Add Decision Node">
              <Diamond size={12} /> Decision
            </button>
            <button className="toolbar-btn preset-btn" onClick={() => handleAddNodePreset("stadium", "Start / End")} title="Add Start/End Node">
              <Circle size={12} /> Start/End
            </button>
          </div>

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

      {/* Modal Body / Views */}
      <div className={`mermaid-modal-body tab-${activeTab}`}>
        {(activeTab === "split" || activeTab === "visual") && (
          <div className="mermaid-panel canvas-panel" style={{ position: "relative" }}>
            <MermaidCanvas
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={handleNodeClick}
              onEdgeClick={handleEdgeClick}
              onPaneClick={handlePaneClick}
            />

            {/* Mermify Property Inspector Drawer */}
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

        {(activeTab === "split" || activeTab === "code") && (
          <div className="mermaid-panel code-panel">
            <div className="code-editor-header">
              <span>Mermaid Code</span>
              {codeError && <span className="code-error-badge">{codeError}</span>}
            </div>
            <textarea
              value={mermaidCode}
              onChange={(e) => handleCodeChange(e.target.value)}
              placeholder="flowchart TD..."
              className="mermaid-code-input"
              spellCheck="false"
            />
            <div className="code-preview-footer">
              <span className="preview-label">Live Preview:</span>
              <div className="live-mermaid-preview">
                <MermaidBlock code={mermaidCode} index={999} />
              </div>
            </div>
          </div>
        )}
      </div>
    </OverlayDialog>
  );
}
