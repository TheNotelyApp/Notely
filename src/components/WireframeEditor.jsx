import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  Save,
  X,
  Download,
  Search,
  Monitor,
  Tablet,
  Smartphone,
  Undo2,
  Redo2,
  Trash2,
  Eye,
  EyeOff,
  Layers,
  Palette,
  Layout,
  Sliders,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import AppButton from "./AppButton";
import AppSelect from "./AppSelect";
import OverlayDialog from "./OverlayDialog";
import useConfirm from "../hooks/useConfirm";
import { writeWireframeSource, writeWireframeImage } from "../services/wireframeService";
import { runExport } from "../services/electronService";
import { CATEGORIES, WIREFRAME_STENCILS } from "./wireframe/stencils";
import { exportWireframeToPng } from "./wireframe/exportUtils";
import "grapesjs/dist/css/grapes.min.css";
import "../styles/ExcalidrawEditor.css";
import "../styles/WireframeEditor.css";

// --- WireframeEditor Component ---

export function WireframeEditor({
  initialData,
  diagramId,
  documentPath,
  onClose,
  onSave,
  onNotify
}) {
  const editorRef = useRef(null);
  const editorContainerRef = useRef(null);
  const saveButtonRef = useRef(null);
  const { confirm } = useConfirm();

  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Editor controls state
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeDevice, setActiveDevice] = useState("Desktop");
  const [gridVisible, setGridVisible] = useState(true);
  const [activeRightTab, setActiveRightTab] = useState("styles");
  const [zoomLevel, setZoomLevel] = useState(100);

  const filteredStencils = useMemo(() => {
    return WIREFRAME_STENCILS.filter((item) => {
      const matchCat = activeCategory === "all" || item.category === activeCategory;
      const matchSearch =
        !searchQuery ||
        item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.desc.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [activeCategory, searchQuery]);

  const handleClose = useCallback(async () => {
    if (hasUnsavedChanges) {
      const confirmed = await confirm({
        title: "Discard Changes?",
        message: "You have unsaved wireframe changes. Are you sure you want to discard them?",
        confirmLabel: "Discard",
        cancelLabel: "Cancel",
        variant: "danger"
      });
      if (!confirmed) return;
    }
    onClose?.();
  }, [hasUnsavedChanges, onClose, confirm]);

  // Initialize GrapesJS
  useEffect(() => {
    if (!editorContainerRef.current || editorRef.current) return;

    let destroyed = false;

    async function initGrapesJS() {
      try {
        const grapesjs = (await import("grapesjs")).default;
        if (destroyed || !editorContainerRef.current) return;

        const editor = grapesjs.init({
          container: editorContainerRef.current,
          height: "100%",
          width: "100%",
          storageManager: false,
          undoManager: true,
          deviceManager: {
            devices: [
              { name: "Desktop", width: "" },
              { name: "Tablet", width: "768px" },
              { name: "Mobile", width: "375px" }
            ]
          },
          panels: { defaults: [] },
          styleManager: {
            appendTo: ".wireframe-sm-container",
            sectors: [
              {
                name: "Layout & Flexbox",
                open: true,
                properties: [
                  "display",
                  "flex-direction",
                  "justify-content",
                  "align-items",
                  "gap",
                  "padding",
                  "margin",
                  "width",
                  "max-width",
                  "min-height"
                ]
              },
              {
                name: "Typography",
                open: true,
                properties: ["font-size", "font-weight", "color", "text-align", "line-height"]
              },
              {
                name: "Fill & Stroke",
                open: true,
                properties: ["background-color", "border", "border-radius", "box-shadow", "opacity"]
              }
            ]
          },
          layerManager: {
            appendTo: ".wireframe-layers-container"
          },
          traitManager: {
            appendTo: ".wireframe-traits-container"
          },
          cssIcons: "",
          canvas: {
            styles: ["https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"],
            scripts: [],
            frameStyle: `
              *, *::before, *::after { box-sizing: border-box; }
              html {
                height: 100%;
                background: #f1f5f9;
              }
              body {
                margin: 0;
                padding: 40px 24px;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                background: #f8fafc;
                min-height: 100%;
                color: #0f172a;
              }
              .gjs-selected {
                outline: 2px solid var(--accent-solid, #2f5d62) !important;
                outline-offset: 2px !important;
                box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-solid, #2f5d62) 20%, transparent) !important;
              }
              .gjs-hovered {
                outline: 1px dashed var(--accent-solid, #2f5d62) !important;
                outline-offset: 1px !important;
              }
            `
          }
        });

        editorRef.current = editor;

        // Register components into BlockManager
        const bm = editor.BlockManager;
        WIREFRAME_STENCILS.forEach((stencil) => {
          bm.add(stencil.id, {
            label: stencil.label,
            category: stencil.category,
            content: stencil.content
          });
        });

        // Load project data
        if (initialData) {
          try {
            const parsed = typeof initialData === "string" ? JSON.parse(initialData) : initialData;
            if (parsed && typeof parsed === "object") {
              editor.loadProjectData(parsed);
            } else if (typeof initialData === "string" && initialData.trim().startsWith("<")) {
              editor.setComponents(initialData);
            }
          } catch {
            // ignore malformed JSON
          }
        }

        // Track dirty state
        editor.on("component:add component:remove component:update style:change", () => {
          setHasUnsavedChanges(true);
        });

        // Ensure canvas iframe head has FontAwesome
        editor.on("load", () => {
          try {
            const doc = editor.Canvas?.getDocument?.();
            if (doc && !doc.querySelector("link[data-fa='true']")) {
              const link = doc.createElement("link");
              link.rel = "stylesheet";
              link.href =
                "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css";
              link.setAttribute("data-fa", "true");
              doc.head?.appendChild(link);
            }
          } catch {
            // ignore canvas frame access errors
          }
        });

        setIsLoading(false);
      } catch (err) {
        console.error("Failed to initialize GrapesJS:", err);
        setIsLoading(false);
      }
    }

    void initGrapesJS();

    return () => {
      destroyed = true;
      if (editorRef.current) {
        try {
          editorRef.current.destroy();
        } catch {
          // ignore
        }
        editorRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escape key handler
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [handleClose]);

  // Keyboard shortcut Ctrl+S
  const handleSaveRef = useRef(null);
  useEffect(() => {
    handleSaveRef.current = handleSave;
  });
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key?.toLowerCase() === "s") {
        e.preventDefault();
        e.stopPropagation();
        handleSaveRef.current?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, []);

  // Device switcher
  const handleSetDevice = (device) => {
    setActiveDevice(device);
    editorRef.current?.setDevice(device);
  };

  // Zoom controls
  const handleZoom = (delta) => {
    const nextZoom = Math.min(Math.max(zoomLevel + delta, 40), 200);
    setZoomLevel(nextZoom);
    editorRef.current?.Canvas?.setZoom(nextZoom);
  };

  const handleZoomReset = () => {
    setZoomLevel(100);
    editorRef.current?.Canvas?.setZoom(100);
  };

  // Canvas Actions
  const handleUndo = () => editorRef.current?.UndoManager?.undo();
  const handleRedo = () => editorRef.current?.UndoManager?.redo();
  const handleClear = () => {
    if (window.confirm("Clear the current wireframe canvas?")) {
      editorRef.current?.runCommand("core:canvas-clear");
      setHasUnsavedChanges(true);
    }
  };

  const handleToggleBorders = () => {
    setGridVisible(!gridVisible);
    editorRef.current?.runCommand("sw-visibility");
  };

  // Direct component insertion onto canvas
  const handleInsertStencil = (stencil) => {
    const editor = editorRef.current;
    if (!editor) return;
    const selected = editor.getSelected();
    if (selected) {
      selected.append(stencil.content);
    } else {
      editor.addComponents(stencil.content);
    }
    setHasUnsavedChanges(true);
  };

  // Drag-and-drop handler for stencils
  const handleStencilDragStart = (e, stencil) => {
    try {
      e.dataTransfer.setData("text/html", stencil.content);
      e.dataTransfer.setData("text/plain", stencil.content);
      e.dataTransfer.effectAllowed = "copy";
    } catch {
      // fallback
    }
  };

  // Save handler
  const handleSave = async () => {
    const editor = editorRef.current;
    if (!editor || isSaving) return;

    setIsSaving(true);
    try {
      const projectData = editor.getProjectData();
      const projectJson = JSON.stringify(projectData);

      const pngDataUrl = await exportWireframeToPng(editor);

      if (diagramId) {
        await writeWireframeSource(diagramId, projectJson, documentPath);
        if (pngDataUrl) {
          await writeWireframeImage(diagramId, pngDataUrl, documentPath);
        }
      }

      setHasUnsavedChanges(false);
      onSave?.(projectJson, pngDataUrl);
      onNotify?.("Wireframe saved successfully.", "success");
    } catch (err) {
      console.error("Failed to save wireframe:", err);
      onNotify?.(err?.message || "Failed to save wireframe.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Download handler
  const handleDownload = async () => {
    const editor = editorRef.current;
    if (!editor || isExporting) return;

    setIsExporting(true);
    try {
      const pngDataUrl = await exportWireframeToPng(editor);
      if (!pngDataUrl) {
        onNotify?.("Failed to generate wireframe image.", "error");
        return;
      }

      const filename = `${diagramId || "wireframe"}.png`;
      const result = await runExport("diagram_image", {
        dataUrl: pngDataUrl,
        filename,
        customExportType: "diagram_wireframe",
        category: "diagram"
      });

      if (result?.success) {
        onNotify?.(`Wireframe exported to ${result.filename}`, "success");
      } else {
        onNotify?.(result?.error || "Failed to export wireframe.", "error");
      }
    } catch (err) {
      console.error("Failed to download wireframe:", err);
      onNotify?.("Failed to export wireframe.", "error");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <OverlayDialog
      onClose={handleClose}
      closeOnClickOutside={false}
      ariaLabel="Wireframe Studio"
      overlayClassName="excalidraw-modal-overlay"
      cardClassName="excalidraw-modal-container wireframe-modal-container"
      useDefaultCardClass={false}
      size=""
      initialFocusRef={saveButtonRef}
    >
      {/* Dark Studio Top Toolbar */}
      <div className="wireframe-studio-header">
        {/* Brand */}
        <div className="wireframe-studio-title-group">
          <div className="wireframe-studio-logo">
            <Layout size={14} color="var(--text-on-accent, #ffffff)" />
          </div>
          <span className="wireframe-studio-title">Wireframe Studio</span>
        </div>

        <div className="wireframe-header-divider" />

        {/* Viewport switchers */}
        <div className="wireframe-viewport-controls">
          <button
            type="button"
            className={`wireframe-vp-btn ${activeDevice === "Desktop" ? "active" : ""}`}
            onClick={() => handleSetDevice("Desktop")}
            data-tooltip="Desktop viewport (Full)"
            aria-label="Desktop viewport"
          >
            <Monitor size={14} />
            <span>Desktop</span>
          </button>
          <button
            type="button"
            className={`wireframe-vp-btn ${activeDevice === "Tablet" ? "active" : ""}`}
            onClick={() => handleSetDevice("Tablet")}
            data-tooltip="Tablet viewport (768px)"
            aria-label="Tablet viewport"
          >
            <Tablet size={14} />
            <span>Tablet</span>
          </button>
          <button
            type="button"
            className={`wireframe-vp-btn ${activeDevice === "Mobile" ? "active" : ""}`}
            onClick={() => handleSetDevice("Mobile")}
            data-tooltip="Mobile viewport (375px)"
            aria-label="Mobile viewport"
          >
            <Smartphone size={14} />
            <span>Mobile</span>
          </button>
        </div>

        <div className="wireframe-header-divider" />

        {/* Canvas tool icons */}
        <div className="wireframe-canvas-tools">
          <button
            type="button"
            className="wireframe-tool-icon-btn"
            onClick={handleUndo}
            data-tooltip="Undo (Ctrl+Z)"
            aria-label="Undo"
          >
            <Undo2 size={14} />
          </button>
          <button
            type="button"
            className="wireframe-tool-icon-btn"
            onClick={handleRedo}
            data-tooltip="Redo (Ctrl+Y)"
            aria-label="Redo"
          >
            <Redo2 size={14} />
          </button>
          <span className="wireframe-tool-sep" />
          <button
            type="button"
            className={`wireframe-tool-icon-btn ${gridVisible ? "active" : ""}`}
            onClick={handleToggleBorders}
            data-tooltip="Toggle Layout Bounds"
            aria-label="Toggle layout bounds"
          >
            {gridVisible ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
          <button
            type="button"
            className="wireframe-tool-icon-btn danger"
            onClick={handleClear}
            data-tooltip="Clear Canvas"
            aria-label="Clear canvas"
          >
            <Trash2 size={14} />
          </button>
        </div>

        {/* Action buttons */}
        <div className="wireframe-action-buttons">
          {hasUnsavedChanges && <span className="wf-unsaved-dot" title="Unsaved changes" />}
          <AppButton
            variant="small"
            onClick={handleDownload}
            disabled={isSaving || isExporting || isLoading}
            title="Export wireframe as PNG"
          >
            <Download size={14} aria-hidden="true" />
            <span>{isExporting ? "Exporting..." : "Export PNG"}</span>
          </AppButton>
          <AppButton
            ref={saveButtonRef}
            variant="primary"
            onClick={handleSave}
            disabled={isSaving || isExporting || isLoading}
            title="Save wireframe (Ctrl+S)"
          >
            <Save size={14} aria-hidden="true" />
            <span>{isSaving ? "Saving..." : "Save"}</span>
          </AppButton>
          <AppButton
            variant="small"
            iconOnly
            onClick={handleClose}
            disabled={isSaving || isExporting}
            title="Close"
            aria-label="Close"
          >
            <X size={14} aria-hidden="true" />
          </AppButton>
        </div>
      </div>

      {/* Studio Body */}
      <div className="wireframe-studio-body">
        {isLoading && (
          <div className="wireframe-editor-loading">
            <div className="wireframe-spinner" />
            <span>Loading Wireframe Studio...</span>
          </div>
        )}

        {/* Left Sidebar: Stencil Library */}
        <aside className="wireframe-stencil-sidebar">
          <div className="wireframe-sidebar-header">
            <div className="wireframe-sidebar-label">Components Library</div>
            <div className="wireframe-sidebar-search">
              <Search size={14} className="wireframe-search-icon" />
              <input
                type="text"
                placeholder="Search components..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="wireframe-search-input"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="wireframe-search-clear"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="wireframe-category-select-wrapper">
              <AppSelect
                id="wireframe-category-select"
                className="wireframe-category-select"
                value={activeCategory}
                onChange={(e) => setActiveCategory(e.target.value)}
                aria-label="Filter components by category"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </AppSelect>
            </div>
          </div>

          <div className="wireframe-stencil-grid">
            {filteredStencils.length === 0 ? (
              <div className="wireframe-empty-stencils">
                No components match
                <br />
                <strong>{searchQuery}</strong>
              </div>
            ) : (
              filteredStencils.map((stencil) => {
                const StencilIcon = stencil.icon || Layout;
                return (
                  <div
                    key={stencil.id}
                    className="wireframe-stencil-tile"
                    draggable
                    onDragStart={(e) => handleStencilDragStart(e, stencil)}
                    onClick={() => handleInsertStencil(stencil)}
                    title={`${stencil.label}\n${stencil.desc}\n• Click or drag to canvas`}
                  >
                    <div className="wireframe-stencil-tile-icon">
                      <StencilIcon size={16} />
                    </div>
                    <span className="wireframe-stencil-tile-name">{stencil.label}</span>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Center Canvas */}
        <main className="wireframe-canvas-container">
          <div className="wireframe-canvas-top-tag">
            <span className="wireframe-artboard-pill">
              {activeDevice === "Desktop" && "Desktop Screen · 1200px"}
              {activeDevice === "Tablet" && "Tablet Viewport · 768px"}
              {activeDevice === "Mobile" && "Mobile Device · 375px"}
            </span>
          </div>
          <div className="wireframe-gjs-host">
            <div
              ref={editorContainerRef}
              style={{ width: "100%", height: "100%" }}
              aria-label="Wireframe canvas"
            />
          </div>
          {/* Status bar with Zoom */}
          <div className="wireframe-canvas-statusbar">
            <span className="wireframe-canvas-statusbar-dot" />
            <span>Ready · {activeDevice}</span>

            {/* Zoom Controls */}
            <div className="wireframe-zoom-controls">
              <button
                type="button"
                className="wireframe-zoom-btn"
                onClick={() => handleZoom(-10)}
                data-tooltip="Zoom Out"
                aria-label="Zoom out"
              >
                <ZoomOut size={12} />
              </button>
              <button
                type="button"
                className="wireframe-zoom-label"
                onClick={handleZoomReset}
                data-tooltip="Reset Zoom (100%)"
                aria-label="Reset zoom"
              >
                {zoomLevel}%
              </button>
              <button
                type="button"
                className="wireframe-zoom-btn"
                onClick={() => handleZoom(10)}
                data-tooltip="Zoom In"
                aria-label="Zoom in"
              >
                <ZoomIn size={12} />
              </button>
            </div>

            <div className="wireframe-canvas-tip">
              <span>Drag or click stencil to add</span>
              <span className="wf-tip-dot">·</span>
              <kbd>Ctrl+S</kbd> to save
            </div>
          </div>
        </main>

        {/* Right Inspector Panel */}
        <aside className="wireframe-inspector-panel">
          <div className="wireframe-inspector-tabs">
            <button
              type="button"
              className={`wireframe-inspector-tab ${activeRightTab === "styles" ? "active" : ""}`}
              onClick={() => setActiveRightTab("styles")}
            >
              <Palette size={14} />
              <span>Design</span>
            </button>
            <button
              type="button"
              className={`wireframe-inspector-tab ${activeRightTab === "traits" ? "active" : ""}`}
              onClick={() => setActiveRightTab("traits")}
            >
              <Sliders size={14} />
              <span>Props</span>
            </button>
            <button
              type="button"
              className={`wireframe-inspector-tab ${activeRightTab === "layers" ? "active" : ""}`}
              onClick={() => setActiveRightTab("layers")}
            >
              <Layers size={14} />
              <span>Layers</span>
            </button>
          </div>

          <div className="wireframe-inspector-content">
            <div
              className="wireframe-sm-container"
              style={{ display: activeRightTab === "styles" ? "block" : "none" }}
            />
            <div
              className="wireframe-traits-container"
              style={{ display: activeRightTab === "traits" ? "block" : "none" }}
            >
              {activeRightTab === "traits" && (
                <div className="wireframe-inspector-empty">
                  <Sliders size={20} className="wireframe-empty-icon-svg" />
                  <span>Select an element to edit component attributes</span>
                </div>
              )}
            </div>
            <div
              className="wireframe-layers-container"
              style={{ display: activeRightTab === "layers" ? "block" : "none" }}
            />
          </div>
        </aside>
      </div>
    </OverlayDialog>
  );
}

export default WireframeEditor;
