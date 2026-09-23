import { useEffect, useRef, useState, useCallback } from "react";
import { Save, X, Download } from "lucide-react";
import AppButton from "./AppButton";
import OverlayDialog from "./OverlayDialog";
import useConfirm from "../hooks/useConfirm";
import { writeWireframeSource, writeWireframeImage } from "../services/wireframeService";
import { runExport } from "../services/electronService";
import "../styles/ExcalidrawEditor.css";
import "../styles/WireframeEditor.css";

// ── Wireframe component definitions ─────────────────────────────────────────

const WIREFRAME_COMPONENTS = [
  {
    id: "wf-frame",
    label: "Frame",
    icon: "🖼️",
    content: `<div style="width:375px;min-height:667px;border:2px solid #888;background:#fff;position:relative;box-sizing:border-box;padding:16px;font-family:system-ui,sans-serif;">
      <div style="font-size:12px;color:#888;text-align:center;border-bottom:1px solid #ddd;padding-bottom:8px;margin-bottom:12px;">Screen / Frame</div>
    </div>`,
    category: "Layout",
  },
  {
    id: "wf-container",
    label: "Container",
    icon: "📦",
    content: `<div style="border:1px dashed #999;padding:12px;min-height:60px;box-sizing:border-box;background:#f9f9f9;font-family:system-ui,sans-serif;font-size:11px;color:#999;display:flex;align-items:center;justify-content:center;">Container</div>`,
    category: "Layout",
  },
  {
    id: "wf-header",
    label: "Header",
    icon: "🔝",
    content: `<header style="background:#e0e0e0;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;font-family:system-ui,sans-serif;box-sizing:border-box;">
      <div style="font-size:14px;font-weight:700;color:#333;">App Name</div>
      <div style="display:flex;gap:12px;font-size:11px;color:#555;">
        <span>Nav 1</span><span>Nav 2</span><span>Nav 3</span>
      </div>
    </header>`,
    category: "Layout",
  },
  {
    id: "wf-footer",
    label: "Footer",
    icon: "🔻",
    content: `<footer style="background:#e0e0e0;padding:10px 16px;text-align:center;font-family:system-ui,sans-serif;font-size:11px;color:#777;box-sizing:border-box;">Footer content · Links · Copyright</footer>`,
    category: "Layout",
  },
  {
    id: "wf-navbar",
    label: "Navbar",
    icon: "🧭",
    content: `<nav style="background:#d4d4d4;padding:8px 16px;display:flex;align-items:center;gap:16px;font-family:system-ui,sans-serif;font-size:12px;color:#333;box-sizing:border-box;">
      <span style="font-weight:700;">Logo</span>
      <span>Home</span><span>About</span><span>Contact</span>
      <span style="margin-left:auto;background:#888;color:#fff;padding:4px 10px;border-radius:4px;font-size:11px;">Button</span>
    </nav>`,
    category: "Layout",
  },
  {
    id: "wf-sidebar",
    label: "Sidebar",
    icon: "📋",
    content: `<aside style="width:200px;min-height:300px;background:#ebebeb;border-right:1px solid #ccc;padding:12px;font-family:system-ui,sans-serif;box-sizing:border-box;">
      <div style="font-size:11px;font-weight:700;color:#555;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.05em;">Menu</div>
      <div style="display:flex;flex-direction:column;gap:4px;font-size:12px;color:#444;">
        <div style="padding:5px 8px;background:#fff;border-radius:3px;border-left:2px solid #888;">Item 1</div>
        <div style="padding:5px 8px;">Item 2</div>
        <div style="padding:5px 8px;">Item 3</div>
      </div>
    </aside>`,
    category: "Layout",
  },
  {
    id: "wf-text",
    label: "Text",
    icon: "📝",
    content: `<p style="font-family:system-ui,sans-serif;font-size:13px;color:#333;margin:0;line-height:1.5;">Text content goes here. Click to edit this placeholder text.</p>`,
    category: "Elements",
  },
  {
    id: "wf-heading",
    label: "Heading",
    icon: "H",
    content: `<h2 style="font-family:system-ui,sans-serif;font-size:20px;font-weight:700;color:#222;margin:0 0 8px;">Page Heading</h2>`,
    category: "Elements",
  },
  {
    id: "wf-button",
    label: "Button",
    icon: "🔘",
    content: `<button style="background:#555;color:#fff;border:none;padding:8px 16px;border-radius:4px;font-family:system-ui,sans-serif;font-size:12px;font-weight:500;cursor:pointer;display:inline-block;">Button</button>`,
    category: "Elements",
  },
  {
    id: "wf-input",
    label: "Input",
    icon: "✏️",
    content: `<input type="text" placeholder="Input field..." style="border:1px solid #bbb;border-radius:4px;padding:7px 10px;font-family:system-ui,sans-serif;font-size:12px;width:100%;box-sizing:border-box;background:#fff;color:#333;" />`,
    category: "Elements",
  },
  {
    id: "wf-select",
    label: "Select",
    icon: "🔽",
    content: `<select style="border:1px solid #bbb;border-radius:4px;padding:7px 10px;font-family:system-ui,sans-serif;font-size:12px;width:100%;box-sizing:border-box;background:#fff;color:#333;appearance:auto;">
      <option>Option 1</option><option>Option 2</option><option>Option 3</option>
    </select>`,
    category: "Elements",
  },
  {
    id: "wf-checkbox",
    label: "Checkbox",
    icon: "☑️",
    content: `<label style="display:flex;align-items:center;gap:6px;font-family:system-ui,sans-serif;font-size:12px;color:#333;cursor:pointer;">
      <input type="checkbox" style="width:14px;height:14px;" /> Checkbox label
    </label>`,
    category: "Elements",
  },
  {
    id: "wf-radio",
    label: "Radio",
    icon: "🔵",
    content: `<div style="display:flex;flex-direction:column;gap:5px;font-family:system-ui,sans-serif;font-size:12px;color:#333;">
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;"><input type="radio" name="wf-r" /> Option A</label>
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;"><input type="radio" name="wf-r" /> Option B</label>
    </div>`,
    category: "Elements",
  },
  {
    id: "wf-image",
    label: "Image",
    icon: "🖼",
    content: `<div style="background:#d8d8d8;border:1px dashed #aaa;display:flex;align-items:center;justify-content:center;width:200px;height:150px;font-family:system-ui,sans-serif;font-size:12px;color:#888;border-radius:4px;">[ Image ]</div>`,
    category: "Elements",
  },
  {
    id: "wf-divider",
    label: "Divider",
    icon: "➖",
    content: `<hr style="border:none;border-top:1px solid #ccc;margin:8px 0;" />`,
    category: "Elements",
  },
  {
    id: "wf-card",
    label: "Card",
    icon: "🃏",
    content: `<div style="border:1px solid #ccc;border-radius:6px;overflow:hidden;font-family:system-ui,sans-serif;background:#fff;">
      <div style="background:#ddd;height:100px;display:flex;align-items:center;justify-content:center;color:#999;font-size:11px;">[ Image Area ]</div>
      <div style="padding:12px;">
        <div style="font-size:14px;font-weight:700;color:#222;margin-bottom:4px;">Card Title</div>
        <div style="font-size:11px;color:#666;line-height:1.4;">Card description text goes here.</div>
        <button style="margin-top:10px;background:#555;color:#fff;border:none;padding:5px 12px;border-radius:3px;font-size:11px;cursor:pointer;">Action</button>
      </div>
    </div>`,
    category: "Patterns",
  },
  {
    id: "wf-list",
    label: "List",
    icon: "📄",
    content: `<ul style="font-family:system-ui,sans-serif;font-size:12px;color:#333;margin:0;padding-left:16px;line-height:1.8;">
      <li>List item 1</li><li>List item 2</li><li>List item 3</li>
    </ul>`,
    category: "Elements",
  },
  {
    id: "wf-table",
    label: "Table",
    icon: "📊",
    content: `<table style="border-collapse:collapse;width:100%;font-family:system-ui,sans-serif;font-size:11px;">
      <thead>
        <tr>
          <th style="border:1px solid #ccc;padding:6px 8px;background:#e8e8e8;text-align:left;color:#333;">Col 1</th>
          <th style="border:1px solid #ccc;padding:6px 8px;background:#e8e8e8;text-align:left;color:#333;">Col 2</th>
          <th style="border:1px solid #ccc;padding:6px 8px;background:#e8e8e8;text-align:left;color:#333;">Col 3</th>
        </tr>
      </thead>
      <tbody>
        <tr><td style="border:1px solid #ccc;padding:6px 8px;color:#555;">Data</td><td style="border:1px solid #ccc;padding:6px 8px;color:#555;">Data</td><td style="border:1px solid #ccc;padding:6px 8px;color:#555;">Data</td></tr>
        <tr style="background:#f9f9f9;"><td style="border:1px solid #ccc;padding:6px 8px;color:#555;">Data</td><td style="border:1px solid #ccc;padding:6px 8px;color:#555;">Data</td><td style="border:1px solid #ccc;padding:6px 8px;color:#555;">Data</td></tr>
      </tbody>
    </table>`,
    category: "Patterns",
  },
  {
    id: "wf-tabs",
    label: "Tabs",
    icon: "🗂️",
    content: `<div style="font-family:system-ui,sans-serif;">
      <div style="display:flex;border-bottom:2px solid #ccc;">
        <div style="padding:6px 14px;border-bottom:2px solid #555;margin-bottom:-2px;font-size:12px;font-weight:600;color:#333;cursor:pointer;">Tab 1</div>
        <div style="padding:6px 14px;font-size:12px;color:#888;cursor:pointer;">Tab 2</div>
        <div style="padding:6px 14px;font-size:12px;color:#888;cursor:pointer;">Tab 3</div>
      </div>
      <div style="padding:12px;border:1px solid #ccc;border-top:none;font-size:11px;color:#666;min-height:60px;">Tab content area</div>
    </div>`,
    category: "Patterns",
  },
  {
    id: "wf-modal",
    label: "Modal",
    icon: "🪟",
    content: `<div style="position:relative;font-family:system-ui,sans-serif;">
      <div style="background:rgba(0,0,0,0.3);position:absolute;inset:0;border-radius:4px;"></div>
      <div style="position:relative;background:#fff;border:1px solid #ccc;border-radius:6px;padding:16px;min-width:280px;box-shadow:0 4px 20px rgba(0,0,0,0.15);margin:20px auto;max-width:360px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <div style="font-size:14px;font-weight:700;color:#222;">Modal Title</div>
          <div style="font-size:16px;color:#888;cursor:pointer;">✕</div>
        </div>
        <div style="font-size:12px;color:#555;margin-bottom:16px;line-height:1.5;">Modal content and description text goes here.</div>
        <div style="display:flex;justify-content:flex-end;gap:8px;">
          <button style="padding:6px 12px;border:1px solid #ccc;border-radius:4px;background:#fff;font-size:11px;cursor:pointer;color:#555;">Cancel</button>
          <button style="padding:6px 12px;border:none;border-radius:4px;background:#555;color:#fff;font-size:11px;cursor:pointer;">Confirm</button>
        </div>
      </div>
    </div>`,
    category: "Patterns",
  },
  {
    id: "wf-form",
    label: "Form",
    icon: "📋",
    content: `<form style="font-family:system-ui,sans-serif;font-size:12px;display:flex;flex-direction:column;gap:10px;padding:16px;border:1px solid #ccc;border-radius:6px;background:#fff;">
      <div style="font-size:14px;font-weight:700;color:#222;">Form Title</div>
      <label style="display:flex;flex-direction:column;gap:3px;color:#555;">
        <span>Label</span>
        <input type="text" placeholder="Field..." style="border:1px solid #bbb;border-radius:3px;padding:6px 8px;font-size:12px;" />
      </label>
      <label style="display:flex;flex-direction:column;gap:3px;color:#555;">
        <span>Label</span>
        <input type="text" placeholder="Field..." style="border:1px solid #bbb;border-radius:3px;padding:6px 8px;font-size:12px;" />
      </label>
      <button style="background:#555;color:#fff;border:none;padding:7px 14px;border-radius:4px;font-size:12px;cursor:pointer;align-self:flex-start;">Submit</button>
    </form>`,
    category: "Patterns",
  },
];

// ── PNG export helper ────────────────────────────────────────────────────────

async function exportWireframeToPng(editor) {
  return new Promise((resolve) => {
    try {
      if (!editor) {
        resolve(createFallbackPng(editor));
        return;
      }

      const html = editor.getHtml?.() || "";
      const css = editor.getCss?.() || "";

      const width = 1200;
      const height = 800;

      const svgDoc = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
          <foreignObject width="100%" height="100%">
            <div xmlns="http://www.w3.org/1999/xhtml" style="background:#ffffff;width:${width}px;height:${height}px;box-sizing:border-box;overflow:hidden;font-family:system-ui, -apple-system, sans-serif;">
              <style>
                *, *::before, *::after { box-sizing: border-box; }
                body { margin: 0; padding: 0; background: #ffffff; }
                ${css}
              </style>
              <div style="padding:16px;">
                ${html}
              </div>
            </div>
          </foreignObject>
        </svg>
      `;

      const blob = new Blob([svgDoc], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const img = new Image();

      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL("image/png"));
        } catch {
          URL.revokeObjectURL(url);
          resolve(createFallbackPng(editor));
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(createFallbackPng(editor));
      };

      img.src = url;
    } catch {
      resolve(createFallbackPng(editor));
    }
  });
}

function createFallbackPng(editor) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 800;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 1200, 800);

  // Border
  ctx.strokeStyle = '#cccccc';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, 1180, 780);

  // Label
  ctx.fillStyle = '#888888';
  ctx.font = '16px system-ui, sans-serif';
  ctx.textAlign = 'center';

  const html = editor?.getHtml?.() || '';
  const hasContent = html.replace(/<[^>]+>/g, '').trim().length > 10;
  ctx.fillText(hasContent ? 'Wireframe Preview' : 'Empty Wireframe', 600, 410);

  return canvas.toDataURL('image/png');
}

// ── WireframeEditor component ────────────────────────────────────────────────

export function WireframeEditor({
  initialData,  // JSON string of GrapesJS project data
  diagramId,
  documentPath,
  onClose,
  onSave,
  onNotify,
}) {
  const editorRef = useRef(null);
  const editorContainerRef = useRef(null);
  const saveButtonRef = useRef(null);
  const { confirm } = useConfirm();
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const handleClose = useCallback(async () => {
    if (hasUnsavedChanges) {
      const confirmed = await confirm({
        title: "Discard Changes?",
        message: "You have unsaved changes. Are you sure you want to discard them?",
        confirmLabel: "Discard",
        cancelLabel: "Cancel",
        variant: "danger",
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
        const grapesjs = (await import('grapesjs')).default;

        if (destroyed || !editorContainerRef.current) return;

        const editor = grapesjs.init({
          container: editorContainerRef.current,
          height: '100%',
          width: '100%',
          storageManager: false,   // We manage persistence manually
          undoManager: true,
          deviceManager: {
            devices: [
              { name: 'Desktop', width: '' },
              { name: 'Tablet', width: '768px' },
              { name: 'Mobile', width: '375px' },
            ],
          },
          // Minimal panel set — strip website builder UI
          panels: {
            defaults: [
              {
                id: 'panel-top',
                el: '.panel__top',
                buttons: [],
              },
              {
                id: 'commands',
                buttons: [],
              },
              {
                id: 'options',
                buttons: [
                  {
                    active: true,
                    id: 'sw-visibility',
                    command: 'sw-visibility',
                    label: '<span style="font-size:13px" title="Component borders">⬜</span>',
                  },
                  {
                    id: 'preview',
                    command: 'preview',
                    label: '<span style="font-size:13px" title="Preview">👁</span>',
                  },
                  {
                    id: 'fullscreen',
                    command: 'fullscreen',
                    label: '<span style="font-size:13px" title="Fullscreen">⛶</span>',
                  },
                  {
                    id: 'undo',
                    command: 'core:undo',
                    label: '<span style="font-size:12px" title="Undo">↩</span>',
                  },
                  {
                    id: 'redo',
                    command: 'core:redo',
                    label: '<span style="font-size:12px" title="Redo">↪</span>',
                  },
                  {
                    id: 'clear-canvas',
                    command: 'core:canvas-clear',
                    label: '<span style="font-size:12px" title="Clear canvas">🗑</span>',
                  },
                ],
              },
              {
                id: 'views',
                buttons: [
                  {
                    id: 'open-blocks',
                    active: true,
                    command: 'open-blocks',
                    label: '<span title="Components">⊞</span>',
                  },
                  {
                    id: 'open-sm',
                    command: 'open-sm',
                    label: '<span title="Styles">🎨</span>',
                  },
                  {
                    id: 'open-layers',
                    command: 'open-layers',
                    label: '<span title="Layers">≡</span>',
                  },
                ],
              },
            ],
          },
          blockManager: {
            appendTo: '.wireframe-blocks-panel',
          },
          styleManager: {
            appendTo: '.wireframe-sm-panel',
            sectors: [
              {
                name: 'Layout',
                open: true,
                properties: ['display', 'flex-direction', 'align-items', 'justify-content', 'gap', 'padding', 'margin', 'width', 'height', 'min-height'],
              },
              {
                name: 'Typography',
                open: false,
                properties: ['font-family', 'font-size', 'font-weight', 'color', 'text-align', 'line-height'],
              },
              {
                name: 'Appearance',
                open: false,
                properties: ['background-color', 'border', 'border-radius', 'opacity'],
              },
            ],
          },
          layerManager: {
            appendTo: '.wireframe-layers-panel',
          },
          traitManager: {
            appendTo: '.wireframe-traits-panel',
          },
          // Wireframe-optimised CSS defaults
          protectedCss: `
            * { box-sizing: border-box; }
            body { margin: 0; padding: 16px; font-family: system-ui, sans-serif; background: #fff; }
          `,
          canvas: {
            styles: [`
              * { box-sizing: border-box; }
              body { margin: 0; font-family: system-ui, sans-serif; }
            `],
          },
        });

        editorRef.current = editor;

        // Register wireframe component blocks
        const blockManager = editor.BlockManager;
        WIREFRAME_COMPONENTS.forEach((comp) => {
          blockManager.add(comp.id, {
            label: `<div class="gjs-block__media">${comp.icon}</div><div>${comp.label}</div>`,
            category: comp.category,
            content: comp.content,
            attributes: { class: 'fa fa-th' },
          });
        });

        // Load existing project data
        if (initialData) {
          try {
            const parsed = typeof initialData === 'string' ? JSON.parse(initialData) : initialData;
            if (parsed && typeof parsed === 'object') {
              editor.loadProjectData(parsed);
            } else if (typeof initialData === 'string' && initialData.trim().startsWith('<')) {
              // Legacy: raw HTML
              editor.setComponents(initialData);
            }
          } catch {
            // Ignore parse errors for corrupted data
          }
        }

        // Mark dirty on change
        editor.on('component:add component:remove component:update style:change', () => {
          setHasUnsavedChanges(true);
        });

        setIsLoading(false);
      } catch (err) {
        console.error('Failed to initialize GrapesJS:', err);
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
    const handleEscape = (event) => {
      if (event.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [handleClose]);

  // Ctrl+S handler
  const handleSaveRef = useRef(null);
  useEffect(() => { handleSaveRef.current = handleSave; });
  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key?.toLowerCase() === 's') {
        event.preventDefault();
        event.stopPropagation();
        handleSaveRef.current?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  const handleSave = async () => {
    const editor = editorRef.current;
    if (!editor || isSaving) return;

    setIsSaving(true);
    try {
      const projectData = editor.getProjectData();
      const projectJson = JSON.stringify(projectData);

      // Render preview PNG
      const pngDataUrl = await exportWireframeToPng(editor);

      // Persist source
      if (diagramId) {
        await writeWireframeSource(diagramId, projectJson, documentPath);
        if (pngDataUrl) {
          await writeWireframeImage(diagramId, pngDataUrl, documentPath);
        }
      }

      setHasUnsavedChanges(false);
      onSave?.(projectJson, pngDataUrl);
      onNotify?.('Wireframe saved successfully.', 'success');
    } catch (err) {
      console.error('Failed to save wireframe:', err);
      onNotify?.(err?.message || 'Failed to save wireframe.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = async () => {
    const editor = editorRef.current;
    if (!editor || isExporting) return;

    setIsExporting(true);
    try {
      const pngDataUrl = await exportWireframeToPng(editor);
      if (!pngDataUrl) {
        onNotify?.('Failed to generate wireframe image.', 'error');
        return;
      }

      const filename = `${diagramId || 'wireframe'}.png`;
      const result = await runExport('diagram_image', {
        dataUrl: pngDataUrl,
        filename,
        customExportType: 'diagram_wireframe',
        category: 'diagram',
      });

      if (result?.success) {
        onNotify?.(`Wireframe exported to ${result.filename}`, 'success');
      } else {
        onNotify?.(result?.error || 'Failed to export wireframe.', 'error');
      }
    } catch (err) {
      console.error('Failed to download wireframe:', err);
      onNotify?.('Failed to export wireframe.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <OverlayDialog
      onClose={handleClose}
      closeOnClickOutside={false}
      ariaLabel="Create or edit wireframe"
      overlayClassName="excalidraw-modal-overlay"
      cardClassName="excalidraw-modal-container wireframe-modal-container"
      useDefaultCardClass={false}
      size=""
      initialFocusRef={saveButtonRef}
    >
      <div className="excalidraw-modal-header">
        <h2>Wireframe Editor</h2>
        <div className="excalidraw-modal-actions">
          <AppButton
            variant="small"
            onClick={handleDownload}
            disabled={isSaving || isExporting || isLoading}
          >
            <Download size={14} aria-hidden="true" />
            {isExporting ? 'Exporting...' : 'Download'}
          </AppButton>
          <AppButton
            ref={saveButtonRef}
            variant="primary"
            onClick={handleSave}
            disabled={isSaving || isExporting || isLoading}
          >
            <Save size={14} aria-hidden="true" />
            {isSaving ? 'Saving...' : 'Save'}
          </AppButton>
          <AppButton variant="small" onClick={handleClose} disabled={isSaving || isExporting}>
            <X size={14} aria-hidden="true" />
            Close
          </AppButton>
        </div>
      </div>

      <div className="wireframe-editor-wrapper">
        {isLoading && (
          <div className="wireframe-editor-loading">
            <span>Loading Wireframe Editor...</span>
          </div>
        )}
        <div className="wireframe-sidebar">
          <div className="wireframe-blocks-panel" />
          <div className="wireframe-sm-panel" style={{ display: 'none' }} />
          <div className="wireframe-layers-panel" style={{ display: 'none' }} />
          <div className="wireframe-traits-panel" style={{ display: 'none' }} />
        </div>
        <div
          ref={editorContainerRef}
          style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}
          aria-label="GrapesJS wireframe canvas"
        />
      </div>
    </OverlayDialog>
  );
}

export default WireframeEditor;
