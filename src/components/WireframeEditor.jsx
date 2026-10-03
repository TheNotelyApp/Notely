import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import OverlayDialog from "./OverlayDialog";
import useConfirm from "../hooks/useConfirm";
import { writeWireframeSource, writeWireframeImage } from "../services/wireframeService";
import { runExport } from "../services/electronService";
import {
  CATEGORIES,
  WIREFRAME_STENCILS,
  exportWireframeToPng,
  getSavedSnippets,
  persistSavedSnippets,
  getComponentMeta,
  WireframeToolbar,
  WireframeSidebar,
  WireframeInspector
} from "./wireframe";
import "grapesjs/dist/css/grapes.min.css";
import "../styles/ExcalidrawEditor.css";
import "../styles/WireframeEditor.css";

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

  // Custom snippets state
  const [customSnippets, setCustomSnippets] = useState(() => getSavedSnippets());
  const [isSavingSnippet, setIsSavingSnippet] = useState(false);
  const [snippetNameInput, setSnippetNameInput] = useState("");

  // Editor controls state
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeDevice, setActiveDevice] = useState("Desktop");
  // Right Inspector Collapsible Sections State
  const [propertiesOpen, setPropertiesOpen] = useState(true);
  const [structureOpen, setStructureOpen] = useState(true);
  const [annotationsOpen, setAnnotationsOpen] = useState(true);
  const [gridVisible, setGridVisible] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [annotations, setAnnotations] = useState([]);

  // Simplified Inspector State
  const [selectedComp, setSelectedComp] = useState(null);
  const [compMeta, setCompMeta] = useState({ id: "none", name: "No Selection", icon: Box });
  const [isLocked, setIsLocked] = useState(false);
  const [devNote, setDevNote] = useState("");
  const [propText, setPropText] = useState("");
  const [propWidth, setPropWidth] = useState("");
  const [propHeight, setPropHeight] = useState("");
  const [propVariant, setPropVariant] = useState("primary");
  const [propGap, setPropGap] = useState("16px");
  const [propPadding, setPropPadding] = useState("16px");
  const [propDirection, setPropDirection] = useState("column");
  const [propAlign, setPropAlign] = useState("stretch");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [quickAddStencilId, setQuickAddStencilId] = useState("wf-container");

  // Synchronize annotations list from canvas components
  const updateAnnotations = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const wrapper = editor.getWrapper?.();
    if (!wrapper) return;
    const list = [];
    const traverse = (comp) => {
      if (!comp) return;
      const attrs = comp.getAttributes?.() || {};
      const note = (attrs["data-dev-note"] || "").trim();
      if (note) {
        const meta = getComponentMeta(comp);
        list.push({
          cid: comp.cid || comp.getId?.() || String(Math.random()),
          name: meta.name,
          icon: meta.icon || Box,
          note,
          comp
        });
      }
      comp.components?.()?.forEach((child) => traverse(child));
    };
    wrapper.components?.()?.forEach((child) => traverse(child));
    setAnnotations(list);
  }, []);

  // Synchronize inspector when a component is selected in GrapesJS
  const syncInspectorFromComponent = useCallback((comp) => {
    if (!comp) {
      setSelectedComp(null);
      setCompMeta({ id: "none", name: "No Selection", icon: Box });
      setIsLocked(false);
      setDevNote("");
      setPropText("");
      setPropWidth("");
      setPropHeight("");
      return;
    }

    setPropertiesOpen(true);
    setSelectedComp(comp);
    const meta = getComponentMeta(comp);
    setCompMeta(meta);

    const attrs = comp.getAttributes() || {};
    setIsLocked(!!(comp.get?.("locked") || attrs["data-wf-locked"] === "true"));
    setDevNote(attrs["data-dev-note"] || "");

    const style = comp.getStyle() || {};
    setPropWidth(style.width || "");
    setPropHeight(style.height || style["min-height"] || "");
    setPropGap(style.gap || "16px");
    setPropPadding(style.padding || "16px");
    setPropDirection(style["flex-direction"] || "column");
    setPropAlign(style["align-items"] || "stretch");

    // Text content extraction
    const textOnly = (comp.get("content") || "").replace(/<[^>]+>/g, "").trim();
    setPropText(textOnly || "");

    // Variant estimation
    const bg = style["background-color"] || style.background || "";
    if (bg.includes("dc2626") || bg.includes("red")) {
      setPropVariant("danger");
    } else if (bg.includes("transparent") || bg === "none") {
      setPropVariant("outline");
    } else if (bg.includes("f1f5f9") || bg.includes("f8fafc") || bg.includes("ffffff")) {
      setPropVariant("secondary");
    } else {
      setPropVariant("primary");
    }
  }, []);

  const allStencils = useMemo(() => {
    return [...WIREFRAME_STENCILS, ...customSnippets];
  }, [customSnippets]);

  const combinedCategories = useMemo(() => {
    return [
      ...CATEGORIES,
      {
        id: "custom",
        label:
          customSnippets.length > 0
            ? `Saved Snippets (${customSnippets.length})`
            : "Saved Snippets"
      }
    ];
  }, [customSnippets.length]);

  const filteredStencils = useMemo(() => {
    return allStencils.filter((item) => {
      const matchCat = activeCategory === "all" || item.category === activeCategory;
      const matchSearch =
        !searchQuery ||
        (item.label || item.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.desc || "").toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [allStencils, activeCategory, searchQuery]);

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
                name: "Dimensions & Spacing",
                open: false,
                properties: ["width", "height", "min-height", "padding", "margin", "gap"]
              },
              {
                name: "Typography",
                open: false,
                properties: ["font-size", "font-weight", "color", "text-align", "line-height"]
              },
              {
                name: "Appearance",
                open: false,
                properties: ["background-color", "border", "border-radius", "opacity", "box-shadow"]
              }
            ]
          },
          layerManager: {
            appendTo: ".wireframe-layers-container",
            sortable: true,
            hidable: true
          },
          traitManager: {
            appendTo: ".wireframe-traits-container"
          },
          blockManager: {
            appendTo: null,
            custom: true,
            blocks: []
          },
          canvas: {
            styles: [
              "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
              "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"
            ],
            frameStyle: `
              :root {
                --gjs-color-blue: #2f5d62 !important;
                --gjs-color-highlight: #4f7f8a !important;
                --gjs-primary-color: #2f5d62 !important;
              }
              ::selection {
                background: #2f5d62;
                color: #ffffff;
              }
              body {
                margin: 0;
                padding: 12px;
                background-color: #f8fafc;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                box-sizing: border-box;
                counter-reset: dev-note-counter;
                min-height: 100%;
                color: #0f172a;
              }
              /* Schematic Wireframe Structure */
              .wf-page, .wf-container, .wf-row, .wf-column, .wf-stack,
              .wf-header-bar, .wf-topbar-compact, .wf-sidebar, .wf-sidebar-collapsed, .wf-content-area,
              .wf-split-pane, .wf-card, .wf-toolbar, .wf-footer, .wf-data-table,
              .wf-alert, .wf-modal, .wf-confirm, .wf-empty-state, .wf-image-placeholder {
                position: relative;
              }

              /* Numbered Callout Pin Badge */
              [data-dev-note]:not([data-dev-note=""]) {
                counter-increment: dev-note-counter;
                position: relative;
              }

              [data-dev-note]:not([data-dev-note=""])::after {
                content: counter(dev-note-counter);
                position: absolute;
                top: -8px;
                right: -8px;
                width: 18px;
                height: 18px;
                background: #2f5d62;
                color: #ffffff;
                font-size: 10px;
                font-weight: 700;
                border-radius: 999px;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 2px 4px rgba(0,0,0,0.18);
                pointer-events: none;
                z-index: 9999;
                border: 1.5px solid #ffffff;
                font-family: inherit;
              }
            `
          }
        });

        editorRef.current = editor;

        const resizeConfig = {
          tl: 1,
          tc: 1,
          tr: 1,
          cl: 1,
          cr: 1,
          bl: 1,
          bc: 1,
          br: 1,
          minDim: 8,
          step: 1
        };

        // Enable 8-point interactive resizing on default components
        try {
          const compManager = editor.Components || editor.DomComponents;
          if (compManager?.addType) {
            compManager.addType("default", {
              extend: "default",
              model: {
                defaults: {
                  resizable: resizeConfig
                }
              }
            });
          }
        } catch {
          // fallback to dynamic assignment
        }

        // Register all block primitives
        WIREFRAME_STENCILS.forEach((stencil) => {
          editor.BlockManager.add(stencil.id, {
            id: stencil.id,
            label: stencil.name || stencil.label,
            category: stencil.category,
            content: stencil.content
          });
        });

        // Register saved snippets
        const snippets = getSavedSnippets();
        snippets.forEach((s) => {
          editor.BlockManager.add(s.id, {
            id: s.id,
            label: s.label || s.name,
            category: "custom",
            content: s.content
          });
        });

        // Load Initial Project Data
        if (initialData) {
          try {
            const parsed = typeof initialData === "string" ? JSON.parse(initialData) : initialData;
            editor.loadProjectData?.(parsed);
          } catch {
            if (typeof initialData === "string" && initialData.trim()) {
              editor.setComponents?.(initialData) || editor.addComponents?.(initialData);
            }
          }
        } else {
          // Default Starter Wireframe
          const defaultStarter = `
            <div class="wf-page" data-wf-type="page" data-dev-note="" style="width: 100%; min-height: 540px; padding: 20px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; display: flex; flex-direction: column; gap: 16px; box-sizing: border-box;">
              <header class="wf-header-bar" data-wf-type="header-bar" data-dev-note="Main application header with user navigation" style="width: 100%; height: 52px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; box-sizing: border-box;">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <div style="width: 24px; height: 24px; background: #0f172a; border-radius: 4px;"></div>
                  <strong style="font-size: 14px; color: #0f172a;">Application Studio</strong>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <div style="font-size: 11px; color: #64748b; padding: 4px 8px; background: #f1f5f9; border-radius: 3px;">v2.0</div>
                  <div style="width: 28px; height: 28px; border-radius: 999px; background: #cbd5e1;"></div>
                </div>
              </header>

              <div class="wf-row" data-wf-type="row" data-dev-note="" style="width: 100%; min-height: 380px; display: flex; flex-direction: row; gap: 16px; box-sizing: border-box;">
                <aside class="wf-sidebar" data-wf-type="sidebar" data-dev-note="Collapsible navigation sidebar" style="width: 220px; min-height: 360px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; display: flex; flex-direction: column; gap: 4px; padding: 12px; box-sizing: border-box;">
                  <div style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; padding: 4px 6px;">Menu</div>
                  <div style="padding: 6px 8px; background: #e2e8f0; border-radius: 4px; font-size: 12px; font-weight: 600; color: #0f172a;">📊 Dashboard</div>
                  <div style="padding: 6px 8px; border-radius: 4px; font-size: 12px; color: #475569;">📁 Projects</div>
                  <div style="padding: 6px 8px; border-radius: 4px; font-size: 12px; color: #475569;">⚙️ Settings</div>
                </aside>

                <main class="wf-content-area" data-wf-type="content-area" data-dev-note="Primary work area containing dashboard metrics and data table" style="flex: 1; min-height: 360px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; padding: 16px; display: flex; flex-direction: column; gap: 16px; box-sizing: border-box;">
                  <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">
                    <div>
                      <h2 style="margin: 0; font-size: 16px; font-weight: 700; color: #0f172a;">Project Overview</h2>
                      <span style="font-size: 11px; color: #64748b;">Wireframe blueprint and composition layout</span>
                    </div>
                    <button class="wf-button" data-wf-type="button" data-dev-note="Primary CTA for adding a new record" style="padding: 6px 12px; background: #0f172a; color: #ffffff; border: none; border-radius: 3px; font-size: 11px; font-weight: 500; cursor: pointer;">+ New Item</button>
                  </div>

                  <div class="wf-row" data-wf-type="row" data-dev-note="" style="display: flex; gap: 12px;">
                    <div class="wf-card" data-wf-type="card" data-dev-note="" style="flex: 1; padding: 12px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px;">
                      <div style="font-size: 11px; color: #64748b;">Active Tasks</div>
                      <div style="font-size: 20px; font-weight: 700; color: #0f172a; margin-top: 4px;">24</div>
                    </div>
                    <div class="wf-card" data-wf-type="card" data-dev-note="" style="flex: 1; padding: 12px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px;">
                      <div style="font-size: 11px; color: #64748b;">Completed</div>
                      <div style="font-size: 20px; font-weight: 700; color: #16a34a; margin-top: 4px;">142</div>
                    </div>
                  </div>
                </main>
              </div>
            </div>
          `;
          editor.setComponents?.(defaultStarter) || editor.addComponents?.(defaultStarter);
        }

        // Event bindings
        editor.on("component:selected", (comp) => {
          if (comp && !comp.get("resizable")) {
            comp.set("resizable", resizeConfig);
          }
          syncInspectorFromComponent(comp);
        });

        editor.on("component:deselected", () => {
          syncInspectorFromComponent(null);
        });

        editor.on("update", () => {
          setHasUnsavedChanges(true);
          updateAnnotations();
        });

        editor.on("component:add", () => {
          setHasUnsavedChanges(true);
          updateAnnotations();
        });

        editor.on("component:remove", () => {
          setHasUnsavedChanges(true);
          updateAnnotations();
        });

        // Initial scan for annotations
        setTimeout(() => {
          updateAnnotations();
          setIsLoading(false);
        }, 150);
      } catch (err) {
        console.error("Failed to initialize GrapesJS Wireframe Studio:", err);
        setIsLoading(false);
      }
    }

    initGrapesJS();

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
  }, [syncInspectorFromComponent, updateAnnotations]);

  // Escape key handler
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [handleClose]);

  // Save handler
  const handleSave = useCallback(async () => {
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
  }, [diagramId, documentPath, isSaving, onNotify, onSave]);

  // Keyboard shortcut Ctrl+S
  const handleSaveRef = useRef(null);
  useEffect(() => {
    handleSaveRef.current = handleSave;
  });

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSaveRef.current?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // PNG Export / Download handler
  const handleDownload = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor || isExporting) return;

    setIsExporting(true);
    try {
      const dataUrl = await exportWireframeToPng(editor);
      if (!dataUrl) {
        throw new Error("Canvas export produced an empty image.");
      }

      const defaultFilename = `wireframe-${Date.now()}.png`;

      // Use Electron native export if available
      try {
        const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
        const res = await runExport("png", base64Data, defaultFilename, documentPath);
        if (res?.success) {
          onNotify?.(`Wireframe exported successfully to ${res.filePath || defaultFilename}`, "success");
          return;
        }
      } catch {
        // Fallback to browser standard blob download
      }

      const blob = await (await fetch(dataUrl)).blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = defaultFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      onNotify?.("Wireframe exported as PNG.", "success");
    } catch (err) {
      console.error("Failed to export wireframe PNG:", err);
      onNotify?.(err?.message || "Failed to export PNG.", "error");
    } finally {
      setIsExporting(false);
    }
  }, [documentPath, isExporting, onNotify]);

  // Viewport Device switching
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
  const handleToggleBorders = () => {
    setGridVisible(!gridVisible);
    editorRef.current?.runCommand("sw-visibility");
  };

  const handleDeleteSelected = () => {
    if (selectedComp && !isLocked) {
      selectedComp.remove();
      syncInspectorFromComponent(null);
      updateAnnotations();
      setHasUnsavedChanges(true);
    }
  };

  const handleDuplicateSelected = () => {
    if (selectedComp && !isLocked) {
      const clone = selectedComp.clone();
      selectedComp.parent()?.append(clone);
      editorRef.current?.select(clone);
      updateAnnotations();
      setHasUnsavedChanges(true);
    }
  };

  // Lock / Unlock Action
  const handleToggleLock = () => {
    if (!selectedComp) return;
    const nextLocked = !isLocked;
    try {
      selectedComp.set({
        locked: nextLocked,
        draggable: !nextLocked,
        removable: !nextLocked,
        copyable: !nextLocked,
        resizable: !nextLocked
      });
      const attrs = { ...(selectedComp.getAttributes?.() || {}) };
      if (nextLocked) {
        attrs["data-wf-locked"] = "true";
      } else {
        delete attrs["data-wf-locked"];
      }
      selectedComp.setAttributes(attrs);
    } catch {
      // ignore
    }
    setIsLocked(nextLocked);
    setHasUnsavedChanges(true);
  };

  // Group / Ungroup Actions
  const handleGroupSelection = () => {
    if (!selectedComp || isLocked) return;
    try {
      const parent = selectedComp.parent?.();
      if (!parent) return;
      const index = selectedComp.index?.() ?? 0;
      const groupWrapper = parent.append(
        {
          tagName: "div",
          classes: ["wf-container"],
          attributes: { "data-wf-type": "container", "data-dev-note": "" },
          style: {
            width: "100%",
            padding: "16px",
            display: "flex",
            "flex-direction": "column",
            gap: "16px",
            background: "#f8fafc",
            border: "1px dashed #94a3b8",
            "border-radius": "4px",
            "box-sizing": "border-box"
          }
        },
        { at: index }
      )[0];

      if (groupWrapper) {
        groupWrapper.append(selectedComp);
        editorRef.current?.select(groupWrapper);
        setHasUnsavedChanges(true);
        updateAnnotations();
      }
    } catch (err) {
      console.error("Failed to group component:", err);
    }
  };

  const handleUngroupSelection = () => {
    if (!selectedComp || isLocked) return;
    try {
      const parent = selectedComp.parent?.();
      const children = selectedComp.components?.()?.models || [];
      if (!parent || children.length === 0) return;

      const index = selectedComp.index?.() ?? 0;
      const clonedChildren = children.map((c) => c.clone());
      clonedChildren.forEach((clone, i) => {
        parent.append(clone, { at: index + i });
      });
      selectedComp.remove();
      if (clonedChildren[0]) {
        editorRef.current?.select(clonedChildren[0]);
      } else {
        syncInspectorFromComponent(null);
      }
      setHasUnsavedChanges(true);
      updateAnnotations();
    } catch (err) {
      console.error("Failed to ungroup component:", err);
    }
  };

  // Custom Snippets Actions
  const handleSaveCustomSnippet = () => {
    if (!selectedComp) return;
    const name = (snippetNameInput || compMeta.name || "Custom Snippet").trim();
    const html = selectedComp.toHTML();
    const newSnippet = {
      id: `snippet-${Date.now()}`,
      name,
      label: name,
      category: "custom",
      icon: Box,
      desc: "User saved component snippet",
      content: html
    };

    const nextSnippets = [newSnippet, ...customSnippets];
    setCustomSnippets(nextSnippets);
    persistSavedSnippets(nextSnippets);

    // Also register into GrapesJS BlockManager so drag-drop works
    editorRef.current?.BlockManager?.add(newSnippet.id, {
      id: newSnippet.id,
      label: newSnippet.name,
      category: "custom",
      content: newSnippet.content
    });

    setIsSavingSnippet(false);
    setSnippetNameInput("");
    onNotify?.(`Snippet "${name}" saved to palette.`, "success");
  };

  const handleDeleteCustomSnippet = (snippetId) => {
    const nextSnippets = customSnippets.filter((s) => s.id !== snippetId);
    setCustomSnippets(nextSnippets);
    persistSavedSnippets(nextSnippets);
    editorRef.current?.BlockManager?.remove(snippetId);
    onNotify?.("Snippet removed from palette.", "info");
  };

  // Relative insertion handler
  const handleInsertRelative = (position, stencilId = "wf-container") => {
    const editor = editorRef.current;
    if (!editor || !selectedComp) return;

    const stencil = allStencils.find((s) => s.id === stencilId);
    const content = stencil?.content || '<div class="wf-container" style="padding: 16px;">Container</div>';

    try {
      if (position === "inside") {
        const appended = selectedComp.append(content)[0];
        if (appended) editor.select(appended);
      } else {
        const parent = selectedComp.parent();
        if (parent) {
          const index = selectedComp.index();
          const targetIndex = position === "above" ? index : index + 1;
          const inserted = parent.append(content, { at: targetIndex })[0];
          if (inserted) editor.select(inserted);
        }
      }
      setHasUnsavedChanges(true);
      updateAnnotations();
    } catch (err) {
      console.error("Failed to insert element relatively:", err);
    }
  };

  // Property Change Handlers
  const handleTextChange = (val) => {
    setPropText(val);
    if (!selectedComp) return;
    selectedComp.set("content", val);
    setHasUnsavedChanges(true);
  };

  const handleWidthChange = (val) => {
    setPropWidth(val);
    if (!selectedComp) return;
    selectedComp.addStyle({ width: val });
    setHasUnsavedChanges(true);
  };

  const handleHeightChange = (val) => {
    setPropHeight(val);
    if (!selectedComp) return;
    selectedComp.addStyle({ height: val, "min-height": val });
    setHasUnsavedChanges(true);
  };

  const handleGapChange = (val) => {
    setPropGap(val);
    if (!selectedComp) return;
    selectedComp.addStyle({ gap: val });
    setHasUnsavedChanges(true);
  };

  const handlePaddingChange = (val) => {
    setPropPadding(val);
    if (!selectedComp) return;
    selectedComp.addStyle({ padding: val });
    setHasUnsavedChanges(true);
  };

  const handleDirectionChange = (val) => {
    setPropDirection(val);
    if (!selectedComp) return;
    selectedComp.addStyle({ "flex-direction": val });
    setHasUnsavedChanges(true);
  };

  const handleVariantChange = (val) => {
    setPropVariant(val);
    if (!selectedComp) return;
    if (val === "primary") {
      selectedComp.addStyle({
        background: "#0f172a",
        color: "#ffffff",
        border: "1px solid #0f172a"
      });
    } else if (val === "secondary") {
      selectedComp.addStyle({
        background: "#f1f5f9",
        color: "#0f172a",
        border: "1px solid #cbd5e1"
      });
    } else if (val === "outline") {
      selectedComp.addStyle({
        background: "transparent",
        color: "#0f172a",
        border: "1px solid #0f172a"
      });
    } else if (val === "danger") {
      selectedComp.addStyle({
        background: "#dc2626",
        color: "#ffffff",
        border: "1px solid #dc2626"
      });
    }
    setHasUnsavedChanges(true);
  };

  const handleDevNoteChange = (val) => {
    setDevNote(val);
    if (!selectedComp) return;
    const attrs = { ...(selectedComp.getAttributes?.() || {}) };
    if (val.trim()) {
      attrs["data-dev-note"] = val.trim();
    } else {
      delete attrs["data-dev-note"];
    }
    selectedComp.setAttributes(attrs);
    updateAnnotations();
    setHasUnsavedChanges(true);
  };

  // Structure Section Toggle Handler
  const handleToggleStructure = () => {
    const nextState = !structureOpen;
    setStructureOpen(nextState);
    if (nextState && editorRef.current) {
      setTimeout(() => {
        try {
          editorRef.current.LayerManager?.render();
        } catch {
          // ignore
        }
      }, 50);
    }
  };

  // Annotations List Actions
  const handleSelectAnnotation = (item) => {
    if (item.comp && editorRef.current) {
      editorRef.current.select(item.comp);
      item.comp.scrollIntoView?.({ behavior: "smooth", block: "center" });
    }
  };

  const handleDeleteAnnotation = (item) => {
    if (item.comp) {
      const attrs = { ...(item.comp.getAttributes?.() || {}) };
      delete attrs["data-dev-note"];
      item.comp.setAttributes(attrs);
      updateAnnotations();
      if (selectedComp === item.comp) {
        setDevNote("");
      }
      setHasUnsavedChanges(true);
    }
  };

  const handleCopySpecMarkdown = () => {
    if (annotations.length === 0) return;
    let md = `### Wireframe Component Specifications\n\n`;
    md += `| # | Component | Developer Spec / Notes |\n`;
    md += `| :--- | :--- | :--- |\n`;
    annotations.forEach((item, idx) => {
      md += `| **[${idx + 1}]** | \`${item.name}\` | ${item.note.replace(/\|/g, "\\|")} |\n`;
    });
    navigator.clipboard?.writeText(md);
    onNotify?.("Specifications table copied to clipboard in Markdown format.", "success");
  };

  // Direct component insertion onto canvas or selected element
  const handleInsertStencil = useCallback((stencil) => {
    const editor = editorRef.current;
    if (!editor || !stencil?.content) return;
    try {
      const selected = editor.getSelected?.();
      if (selected) {
        const added = selected.append(stencil.content)[0];
        if (added) editor.select(added);
      } else {
        const added = editor.addComponents(stencil.content)[0];
        if (added) editor.select(added);
      }
      setHasUnsavedChanges(true);
      updateAnnotations();
    } catch (err) {
      console.error("Failed to insert stencil:", err);
    }
  }, [updateAnnotations]);

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
      {/* Studio Top Toolbar */}
      <WireframeToolbar
        activeDevice={activeDevice}
        onSetDevice={handleSetDevice}
        gridVisible={gridVisible}
        onToggleBorders={handleToggleBorders}
        onUndo={handleUndo}
        onRedo={handleRedo}
        hasUnsavedChanges={hasUnsavedChanges}
        isSaving={isSaving}
        isExporting={isExporting}
        isLoading={isLoading}
        onDownload={handleDownload}
        onSave={handleSave}
        onClose={handleClose}
        saveButtonRef={saveButtonRef}
      />

      {/* Studio Body */}
      <div className="wireframe-studio-body">
        {/* Left Stencil Palette */}
        <WireframeSidebar
          combinedCategories={combinedCategories}
          activeCategory={activeCategory}
          onSelectCategory={setActiveCategory}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filteredStencils={filteredStencils}
          customSnippets={customSnippets}
          onDeleteSnippet={handleDeleteCustomSnippet}
          onInsertStencil={handleInsertStencil}
        />

        {/* Center Canvas Area */}
        <main className="wireframe-canvas-container">
          {/* GrapesJS Canvas Container */}
          <div
            ref={editorContainerRef}
            className="wireframe-gjs-host"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const html = e.dataTransfer.getData("text/html");
              const type =
                e.dataTransfer.getData("gjs-type") || e.dataTransfer.getData("text/plain");
              if (editorRef.current) {
                if (html && !html.includes("<!DOCTYPE")) {
                  const added = editorRef.current.addComponents(html)[0];
                  if (added) editorRef.current.select(added);
                  setHasUnsavedChanges(true);
                  updateAnnotations();
                } else if (type) {
                  const block = editorRef.current.BlockManager.get(type);
                  if (block) {
                    const added = editorRef.current.addComponents(block.get("content"))[0];
                    if (added) editorRef.current.select(added);
                    setHasUnsavedChanges(true);
                    updateAnnotations();
                  }
                }
              }
            }}
          />

          {/* Bottom Status / Zoom Bar */}
          <footer className="wireframe-canvas-statusbar">
            <div className="wireframe-canvas-statusbar-dot" />
            <span className="wireframe-artboard-pill">
              {activeDevice === "Desktop" && "Desktop Screen · 1200px"}
              {activeDevice === "Tablet" && "Tablet Screen · 768px"}
              {activeDevice === "Mobile" && "Mobile Screen · 375px"}
            </span>

            <div className="wireframe-zoom-controls" style={{ marginLeft: "8px" }}>
              <button
                type="button"
                className="wireframe-zoom-btn"
                onClick={() => handleZoom(-10)}
                title="Zoom Out"
              >
                <ZoomOut size={12} />
              </button>
              <button
                type="button"
                className="wireframe-zoom-label"
                onClick={handleZoomReset}
                title="Reset Zoom to 100%"
              >
                {zoomLevel}%
              </button>
              <button
                type="button"
                className="wireframe-zoom-btn"
                onClick={() => handleZoom(10)}
                title="Zoom In"
              >
                <ZoomIn size={12} />
              </button>
            </div>

            <div className="wireframe-canvas-tip">
              <span>Numbered pins [1] match Developer Notes</span>
              <span className="wf-tip-dot">·</span>
              <span><kbd>Ctrl+S</kbd> to save</span>
            </div>
          </footer>

          {/* Loading state overlay */}
          {isLoading && (
            <div className="wireframe-editor-loading">
              <div className="wireframe-spinner" />
              <span>Loading Wireframe Studio...</span>
            </div>
          )}
        </main>

        {/* Right Inspector Panel: 3 Stacked Vertical Collapsible Sections */}
        <WireframeInspector
          propertiesOpen={propertiesOpen}
          onToggleProperties={() => setPropertiesOpen(!propertiesOpen)}
          structureOpen={structureOpen}
          onToggleStructure={handleToggleStructure}
          annotationsOpen={annotationsOpen}
          onToggleAnnotations={() => {
            setAnnotationsOpen(!annotationsOpen);
            updateAnnotations();
          }}
          selectedComp={selectedComp}
          compMeta={compMeta}
          isLocked={isLocked}
          onToggleLock={handleToggleLock}
          onGroupSelection={handleGroupSelection}
          onUngroupSelection={handleUngroupSelection}
          isSavingSnippet={isSavingSnippet}
          onToggleSavingSnippet={() => setIsSavingSnippet(!isSavingSnippet)}
          snippetNameInput={snippetNameInput}
          onSnippetNameChange={setSnippetNameInput}
          onSaveSnippet={handleSaveCustomSnippet}
          onDuplicateSelected={handleDuplicateSelected}
          onDeleteSelected={handleDeleteSelected}
          quickAddStencilId={quickAddStencilId}
          onQuickAddStencilChange={setQuickAddStencilId}
          onInsertRelative={handleInsertRelative}
          customSnippets={customSnippets}
          devNote={devNote}
          onDevNoteChange={handleDevNoteChange}
          propText={propText}
          onTextChange={handleTextChange}
          propWidth={propWidth}
          onWidthChange={handleWidthChange}
          propHeight={propHeight}
          onHeightChange={handleHeightChange}
          propVariant={propVariant}
          onVariantChange={handleVariantChange}
          propGap={propGap}
          onGapChange={handleGapChange}
          propPadding={propPadding}
          onPaddingChange={handlePaddingChange}
          propDirection={propDirection}
          onDirectionChange={handleDirectionChange}
          advancedOpen={advancedOpen}
          onToggleAdvanced={() => setAdvancedOpen(!advancedOpen)}
          annotations={annotations}
          onSelectAnnotation={handleSelectAnnotation}
          onDeleteAnnotation={handleDeleteAnnotation}
          onCopySpecMarkdown={handleCopySpecMarkdown}
        />
      </div>
    </OverlayDialog>
  );
}

export default WireframeEditor;
