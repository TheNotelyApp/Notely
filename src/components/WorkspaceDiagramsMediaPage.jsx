import { useState, useMemo, useEffect } from "react";
import {
  Search,
  FileText,
  ExternalLink,
  Copy,
  Check,
  PanelLeftClose,
  PanelLeftOpen,
  Eye,
  CheckSquare,
  Square,
  Layers,
  FileCode,
  Image as ImageIcon,
  FileDigit,
  Music,
  Video,
  File,
  Sparkles,
  ArrowRight,
  Filter,
} from "lucide-react";
import {
  extractWorkspaceUsedAssets,
  filterAssets,
} from "../services/workspaceMediaService";
import { readImage, openMediaInDefaultApp } from "../services/electronService";
import { readDrawioImage } from "../services/drawioService";
import { readDiagramImage } from "../services/diagramService";
import AppSelect from "./AppSelect";
import "../styles/WorkspaceDiagramsMedia.css";

// Harmonious category colors inspired by Knowledge Graph palette
const CATEGORY_THEMES = {
  diagram: { border: "#6366f1", bg: "rgba(99, 102, 241, 0.12)", text: "#818cf8", label: "Diagram" },
  image: { border: "#06b6d4", bg: "rgba(6, 182, 212, 0.12)", text: "#22d3ee", label: "Image" },
  pdf: { border: "#10b981", bg: "rgba(16, 185, 129, 0.12)", text: "#34d399", label: "PDF" },
  video: { border: "#f59e0b", bg: "rgba(245, 158, 11, 0.12)", text: "#fbbf24", label: "Video" },
  audio: { border: "#ec4899", bg: "rgba(236, 72, 153, 0.12)", text: "#f472b6", label: "Audio" },
  document: { border: "#8b5cf6", bg: "rgba(139, 92, 246, 0.12)", text: "#a78bfa", label: "Doc" },
};

function getCategoryTheme(category) {
  return CATEGORY_THEMES[category] || CATEGORY_THEMES.document;
}

// Mini Mermaid SVG Renderer component for card previews and inspector
function MermaidRenderer({ code, className = "", isCardPreview = false }) {
  const [svg, setSvg] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const cleanCode = (code || "").trim();
    if (!cleanCode) return;

    const renderId = `wdm-m-${Math.random().toString(36).substring(2, 9)}${Date.now()}`;

    async function renderMermaid() {
      try {
        const mermaidModule = await import("mermaid");
        const mermaid = mermaidModule?.default || mermaidModule;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "loose",
          theme: "default",
          fontFamily: "Inter, sans-serif",
        });

        const res = await mermaid.render(renderId, cleanCode);
        const svgContent = typeof res === "string" ? res : res?.svg || "";
        if (!cancelled) {
          setSvg(svgContent);
          setError(false);
        }
      } catch {
        if (!cancelled) {
          setError(true);
        }
      } finally {
        const temp = document.getElementById(renderId);
        if (temp) temp.remove();
        const tempD = document.getElementById(`d${renderId}`);
        if (tempD) tempD.remove();
      }
    }

    renderMermaid();
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (error || !svg) {
    return (
      <div className={className} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", color: "var(--text-muted)" }}>
        <FileCode size={20} style={{ width: isCardPreview ? 28 : 42, height: isCardPreview ? 28 : 42, opacity: 0.6 }} />
        <span style={{ fontSize: "10px", fontStyle: "italic" }}>
          {error ? "Mermaid Diagram" : "Loading Diagram…"}
        </span>
      </div>
    );
  }

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

// Diagram or Image preview resolver component (supports Draw.io, Excalidraw, and raster/vector images)
function DiagramOrImagePreviewItem({ asset, basePath, className = "" }) {
  const [dataUrl, setDataUrl] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!asset) return;

    async function loadPreview() {
      try {
        let res = null;

        // 1. If Draw.io diagram, try readDrawioImage
        if (asset.subType === "drawio") {
          const diagId = asset.diagramId || (asset.fileName || asset.name || "").replace(/\.png$/i, "");
          if (diagId) {
            try {
              res = await readDrawioImage(diagId, basePath || "");
            } catch {
              // fallback
            }
          }
        }

        // 2. If Excalidraw diagram, try readDiagramImage
        if (!res && asset.subType === "excalidraw") {
          const diagId = asset.diagramId || asset.path?.match(/(?:excalidraw|excali-diagrams)[\\/]([^/]+)/i)?.[1];
          if (diagId) {
            try {
              res = await readDiagramImage(basePath || "", diagId);
            } catch {
              // fallback
            }
          }
        }

        // 3. Fallback to readImage with asset path
        if (!res && asset.path) {
          try {
            res = await readImage(basePath || "", asset.path);
          } catch {
            // fallback
          }
        }

        // 4. Fallback to readImage with rawPath
        if (!res && asset.rawPath) {
          try {
            res = await readImage(basePath || "", asset.rawPath);
          } catch {
            // fallback
          }
        }

        if (!cancelled) {
          if (res) {
            setDataUrl(res);
            setError(false);
          } else {
            setError(true);
          }
        }
      } catch {
        if (!cancelled) {
          setError(true);
        }
      }
    }

    loadPreview();
    return () => {
      cancelled = true;
    };
  }, [asset, basePath]);

  if (error || !dataUrl) {
    const isDiagram = asset?.category === "diagram" || asset?.subType === "drawio" || asset?.subType === "excalidraw";
    return (
      <div className={className} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "6px", color: "var(--text-muted)", width: "100%", height: "100%", boxSizing: "border-box", padding: "10px" }}>
        {isDiagram ? <FileCode size={20} style={{ width: 34, height: 34, opacity: 0.6 }} /> : <ImageIcon size={20} style={{ width: 34, height: 34, opacity: 0.5 }} />}
        <span style={{ fontSize: "10px", textTransform: "capitalize" }}>
          {asset?.subType || "Diagram"}
        </span>
      </div>
    );
  }

  return <img src={dataUrl} alt={asset?.name || "preview"} className={className} />;
}

export default function WorkspaceDiagramsMediaPage({
  documents = [],
  workspacePath = "",
  onBack,
  onOpenNote,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [usageFilter, setUsageFilter] = useState("all"); // all, single, multi
  const [sortOrder, setSortOrder] = useState("ref-desc"); // ref-desc, ref-asc, name-asc, name-desc

  // Category filters
  const [selectedCategories, setSelectedCategories] = useState({
    diagram: true,
    image: true,
    pdf: true,
    video: true,
    audio: true,
    document: true,
  });

  // Extract catalog from documents
  const allUsedAssets = useMemo(() => {
    return extractWorkspaceUsedAssets(documents);
  }, [documents]);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = allUsedAssets.length;
    const diagrams = allUsedAssets.filter((a) => a.category === "diagram").length;
    const images = allUsedAssets.filter((a) => a.category === "image").length;
    const pdfs = allUsedAssets.filter((a) => a.category === "pdf").length;
    const media = allUsedAssets.filter((a) => a.category === "video" || a.category === "audio").length;
    const docs = allUsedAssets.filter((a) => a.category === "document").length;
    return { total, diagrams, images, pdfs, media, docs };
  }, [allUsedAssets]);

  // Filtered & searched assets
  const filteredAssets = useMemo(() => {
    return filterAssets(allUsedAssets, {
      searchQuery,
      selectedCategories,
      usageFilter,
      sortOrder,
    });
  }, [allUsedAssets, searchQuery, selectedCategories, usageFilter, sortOrder]);

  // Handle toggling categories
  const toggleCategory = (cat) => {
    setSelectedCategories((prev) => ({
      ...prev,
      [cat]: !prev[cat],
    }));
  };

  const selectAllCategories = () => {
    setSelectedCategories({
      diagram: true,
      image: true,
      pdf: true,
      video: true,
      audio: true,
      document: true,
    });
  };

  const selectNoneCategories = () => {
    setSelectedCategories({
      diagram: false,
      image: false,
      pdf: false,
      video: false,
      audio: false,
      document: false,
    });
  };

  // Copy Markdown Link or Raw Code
  const handleCopy = (asset, e) => {
    if (e) e.stopPropagation();
    let textToCopy = "";
    if (asset.subType === "mermaid") {
      textToCopy = `\`\`\`mermaid\n${asset.rawCode}\n\`\`\``;
    } else if (asset.isImageSyntax || asset.category === "image") {
      textToCopy = `![${asset.name}](${asset.path})`;
    } else {
      textToCopy = `[${asset.name}](${asset.path})`;
    }

    navigator.clipboard.writeText(textToCopy);
    setCopiedId(asset.id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  return (
    <div className="workspace-diagrams-media-page">
      {/* Top Breadcrumb Bar */}
      <div className="detail-topbar">
        <nav className="detail-breadcrumb" aria-label="Workspace Diagrams & Media navigation">
          <span className="detail-breadcrumb-part">
            <button className="detail-breadcrumb-link" type="button" onClick={onBack}>
              Workspace
            </button>
            <span className="detail-breadcrumb-separator" aria-hidden="true">
              /
            </span>
          </span>
          <span className="detail-breadcrumb-current">Diagrams, Media & PDFs</span>
        </nav>
      </div>

      <div className="wdm-container">
        {/* Header Bar */}
        <div className="wdm-header-actions">
          {/* Search Input */}
          <div className="wdm-search-wrapper">
            <Search size={14} className="wdm-search-icon" />
            <input
              type="text"
              className="wdm-search-input"
              placeholder="Search diagrams, media, PDFs, or note references…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Stats Pill */}
          <div className="wdm-stats-pill">
            <span>
              Total: <strong>{stats.total}</strong>
            </span>
            <span style={{ opacity: 0.3 }}>|</span>
            <span>
              Diagrams: <strong>{stats.diagrams}</strong>
            </span>
            <span style={{ opacity: 0.3 }}>|</span>
            <span>
              Images: <strong>{stats.images}</strong>
            </span>
            <span style={{ opacity: 0.3 }}>|</span>
            <span>
              PDFs: <strong>{stats.pdfs}</strong>
            </span>
          </div>
        </div>

        {/* Main Body with Split View */}
        <div className="wdm-body">
          {/* Collapsible Left Sidebar */}
          <div
            className="wdm-sidebar"
            style={{
              width: sidebarOpen ? "270px" : "0px",
              minWidth: sidebarOpen ? "270px" : "0px",
              opacity: sidebarOpen ? 1 : 0,
              pointerEvents: sidebarOpen ? "auto" : "none",
              borderRight: sidebarOpen ? "1px solid var(--border-default)" : "none",
              transition: "width 0.22s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.18s ease",
            }}
          >
            <div className="wdm-sidebar-section-scroll">
              {/* Category Filter Section */}
              <div className="wdm-sidebar-section">
                <div className="wdm-sidebar-section-title">
                  <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                    <Layers size={12} />
                    Category Filters
                  </span>
                  <div style={{ display: "flex", gap: "4px" }}>
                    <button
                      className="btn btn-tertiary"
                      onClick={selectAllCategories}
                      style={{ padding: "1px 4px", fontSize: "9px", height: "18px", display: "inline-flex", alignItems: "center", gap: "2px" }}
                    >
                      <CheckSquare size={12} /> All
                    </button>
                    <button
                      className="btn btn-tertiary"
                      onClick={selectNoneCategories}
                      style={{ padding: "1px 4px", fontSize: "9px", height: "18px", display: "inline-flex", alignItems: "center", gap: "2px" }}
                    >
                      <Square size={12} /> None
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {[
                    { key: "diagram", label: "Diagrams", icon: FileCode, count: stats.diagrams, color: CATEGORY_THEMES.diagram.border },
                    { key: "image", label: "Images", icon: ImageIcon, count: stats.images, color: CATEGORY_THEMES.image.border },
                    { key: "pdf", label: "PDF Documents", icon: FileDigit, count: stats.pdfs, color: CATEGORY_THEMES.pdf.border },
                    { key: "video", label: "Videos", icon: Video, count: allUsedAssets.filter((a) => a.category === "video").length, color: CATEGORY_THEMES.video.border },
                    { key: "audio", label: "Audio", icon: Music, count: allUsedAssets.filter((a) => a.category === "audio").length, color: CATEGORY_THEMES.audio.border },
                    { key: "document", label: "Other Documents", icon: File, count: stats.docs, color: CATEGORY_THEMES.document.border },
                  ].map(({ key, label, count, color }) => (
                    <label key={key} className="wdm-filter-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedCategories[key] !== false}
                        onChange={() => toggleCategory(key)}
                      />
                      <span className="wdm-filter-dot" style={{ background: color }} />
                      <span style={{ color: selectedCategories[key] !== false ? "var(--text-strong)" : "var(--text-secondary)" }}>
                        {label} ({count})
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Usage Filter Section */}
              <div className="wdm-sidebar-section">
                <div className="wdm-sidebar-section-title">
                  <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                    <Filter size={12} />
                    Note Usage Scope
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {[
                    { id: "all", label: `All Used (${stats.total})` },
                    { id: "single", label: `Single Note Only (${allUsedAssets.filter((a) => a.referenceCount === 1).length})` },
                    { id: "multi", label: `Reused in Multi Notes (${allUsedAssets.filter((a) => a.referenceCount > 1).length})` },
                  ].map((opt) => (
                    <label key={opt.id} className="wdm-filter-checkbox">
                      <input
                        type="radio"
                        name="usageFilter"
                        checked={usageFilter === opt.id}
                        onChange={() => setUsageFilter(opt.id)}
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Sort Order Section */}
              <div className="wdm-sidebar-section">
                <div className="wdm-sidebar-section-title">
                  <span>Sort Order</span>
                </div>
                <AppSelect
                  className="wdm-sort-select"
                  placement="top"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                >
                  <option value="ref-desc">Most Referenced First</option>
                  <option value="ref-asc">Least Referenced First</option>
                  <option value="name-asc">Name (A to Z)</option>
                  <option value="name-desc">Name (Z to A)</option>
                </AppSelect>
              </div>
            </div>
          </div>

          {/* Main Gallery Area */}
          <div className="wdm-canvas-wrapper">
            {/* Sidebar toggle button */}
            <button
              className="wdm-sidebar-toggle-btn"
              onClick={() => setSidebarOpen((prev) => !prev)}
              title={sidebarOpen ? "Hide filters sidebar" : "Show filters sidebar"}
            >
              {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
            </button>

            <div style={{ paddingLeft: sidebarOpen ? "0px" : "36px", transition: "padding-left 0.2s ease" }}>
              {filteredAssets.length === 0 ? (
                <div className="wdm-empty-state">
                  <Layers size={20} style={{ width: 40, height: 40, opacity: 0.3 }} />
                  <div>
                    <h3 style={{ margin: "0 0 6px 0", fontSize: "16px", color: "var(--text-strong)" }}>
                      No Used Diagrams or Media Found
                    </h3>
                    <p style={{ margin: 0, fontSize: "12px", maxWidth: "380px" }}>
                      {searchQuery
                        ? "Try clearing your search query or selecting more categories in the filter sidebar."
                        : "Embed Mermaid diagrams (```mermaid), Draw.io/Excalidraw, images, or PDFs in your workspace notes to see them cataloged here."}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="wdm-card-grid">
                  {filteredAssets.map((asset) => {
                    const theme = getCategoryTheme(asset.category);
                    const isSelected = selectedAsset?.id === asset.id;

                    return (
                      <div
                        key={asset.id}
                        className={`wdm-card ${isSelected ? "selected" : ""}`}
                        onClick={() => setSelectedAsset(asset)}
                      >
                        {/* Visual Thumbnail Area */}
                        <div className="wdm-card-preview-area">
                          {asset.subType === "mermaid" ? (
                            <MermaidRenderer
                              code={asset.rawCode}
                              className="wdm-card-preview-mermaid"
                              isCardPreview={true}
                            />
                          ) : (asset.category === "image" || asset.subType === "drawio" || asset.subType === "excalidraw" || asset.category === "diagram") ? (
                            <DiagramOrImagePreviewItem
                              asset={asset}
                              basePath={asset.referencedBy[0]?.notePath || workspacePath}
                              className="wdm-card-img"
                            />
                          ) : asset.category === "pdf" ? (
                            <div className="wdm-card-preview-doc">
                              <FileDigit size={20} style={{ width: 38, height: 38, color: theme.text }} />
                              <span style={{ fontSize: "10px", fontWeight: 700, color: theme.text }}>
                                PDF DOCUMENT
                              </span>
                            </div>
                          ) : asset.category === "video" ? (
                            <div className="wdm-card-preview-doc">
                              <Video size={20} style={{ width: 38, height: 38, color: theme.text }} />
                              <span style={{ fontSize: "10px", fontWeight: 700, color: theme.text }}>
                                {asset.subType.toUpperCase()} VIDEO
                              </span>
                            </div>
                          ) : asset.category === "audio" ? (
                            <div className="wdm-card-preview-doc">
                              <Music size={20} style={{ width: 38, height: 38, color: theme.text }} />
                              <span style={{ fontSize: "10px", fontWeight: 700, color: theme.text }}>
                                {asset.subType.toUpperCase()} AUDIO
                              </span>
                            </div>
                          ) : (
                            <div className="wdm-card-preview-doc">
                              <File size={20} style={{ width: 38, height: 38, color: theme.text }} />
                              <span style={{ fontSize: "10px", fontWeight: 700, color: theme.text }}>
                                {asset.subType.toUpperCase()} FILE
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Card Content */}
                        <div className="wdm-card-content">
                          <div className="wdm-card-title-row">
                            <h4 className="wdm-card-title" title={asset.name}>
                              {asset.name}
                            </h4>
                          </div>

                          <div className="wdm-card-badges">
                            <span
                              className="wdm-badge"
                              style={{
                                background: theme.bg,
                                color: theme.text,
                                border: `1px solid ${theme.border}`,
                              }}
                            >
                              {asset.diagramType || asset.subType.toUpperCase()}
                            </span>

                            <span className="wdm-reference-count-badge">
                              <FileText size={12} />
                              {asset.referenceCount} {asset.referenceCount === 1 ? "note" : "notes"}
                            </span>
                          </div>
                        </div>

                        {/* Card Footer Actions */}
                        <div className="wdm-card-footer">
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "160px" }}>
                            {asset.referencedBy[0]?.noteTitle || "Referenced in workspace"}
                          </span>

                          <div className="wdm-card-footer-actions">
                            <button
                              className="wdm-icon-btn"
                              onClick={(e) => handleCopy(asset, e)}
                              title="Copy Markdown Link"
                            >
                              {copiedId === asset.id ? <Check size={12} style={{ color: "#10b981" }} /> : <Copy size={12} />}
                            </button>

                            <button
                              className="wdm-icon-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedAsset(asset);
                              }}
                              title="Inspect Details & Notes"
                            >
                              <Eye size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Slide-out Inspector Drawer (Knowledge Graph inspired) */}
          {selectedAsset && (
            <div className="wdm-details-overlay">
              <div className="wdm-details-header">
                <h3>
                  <Sparkles size={14} style={{ color: "var(--accent-solid)" }} />
                  {selectedAsset.subType === "mermaid" ? "Diagram Inspector" : "Asset Inspector"}
                </h3>
                <button
                  className="wdm-details-close"
                  onClick={() => setSelectedAsset(null)}
                  title="Close Inspector"
                >
                  ✕
                </button>
              </div>

              <div className="wdm-details-body">
                {/* Full Live Preview */}
                <div className="wdm-details-preview">
                  {selectedAsset.subType === "mermaid" ? (
                    <MermaidRenderer
                      code={selectedAsset.rawCode}
                      className="wdm-details-preview-mermaid"
                    />
                  ) : (selectedAsset.category === "image" || selectedAsset.subType === "drawio" || selectedAsset.subType === "excalidraw" || selectedAsset.category === "diagram") ? (
                    <DiagramOrImagePreviewItem
                      asset={selectedAsset}
                      basePath={selectedAsset.referencedBy[0]?.notePath || workspacePath}
                      className="wdm-details-img"
                    />
                  ) : selectedAsset.category === "pdf" ? (
                    <div style={{ textAlign: "center", padding: "16px" }}>
                      <FileDigit size={20} style={{ width: 48, height: 48, color: CATEGORY_THEMES.pdf.text, marginBottom: "8px" }} />
                      <div style={{ fontSize: "13px", fontWeight: 600 }}>{selectedAsset.name}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>PDF Document</div>
                    </div>
                  ) : (
                    <div style={{ textAlign: "center", padding: "16px" }}>
                      <File size={20} style={{ width: 48, height: 48, color: CATEGORY_THEMES.document.text, marginBottom: "8px" }} />
                      <div style={{ fontSize: "13px", fontWeight: 600 }}>{selectedAsset.name}</div>
                    </div>
                  )}
                </div>

                {/* Metadata details */}
                <div className="wdm-detail-row">
                  <span className="label">Name</span>
                  <strong>{selectedAsset.name}</strong>
                </div>

                <div className="wdm-detail-row">
                  <span className="label">Category & Format</span>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <span
                      className="wdm-badge"
                      style={{
                        background: getCategoryTheme(selectedAsset.category).bg,
                        color: getCategoryTheme(selectedAsset.category).text,
                        border: `1px solid ${getCategoryTheme(selectedAsset.category).border}`,
                        padding: "3px 8px",
                      }}
                    >
                      {selectedAsset.category.toUpperCase()}
                    </span>
                    <span
                      className="wdm-badge"
                      style={{
                        background: "var(--surface-subtle)",
                        color: "var(--text-secondary)",
                        border: "1px solid var(--border-soft)",
                        padding: "3px 8px",
                      }}
                    >
                      {selectedAsset.diagramType || selectedAsset.subType.toUpperCase()}
                    </span>
                  </div>
                </div>

                {selectedAsset.path && !selectedAsset.path.startsWith("inline:") && (
                  <div className="wdm-detail-row">
                    <span className="label">File Path</span>
                    <code>{selectedAsset.path}</code>
                  </div>
                )}

                {/* Open in external OS default app (for files) */}
                {selectedAsset.path && !selectedAsset.path.startsWith("inline:") && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      if (openMediaInDefaultApp) {
                        openMediaInDefaultApp(selectedAsset.path);
                      }
                    }}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", height: "30px", fontSize: "11px" }}
                  >
                    <ExternalLink size={12} />
                    Open in Default App
                  </button>
                )}

                {/* Referenced Notes Section (Crucial user requirement) */}
                <div className="wdm-referenced-notes-section">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span className="label" style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)" }}>
                      Referenced In Notes ({selectedAsset.referencedBy.length})
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {selectedAsset.referencedBy.map((ref, idx) => (
                      <div key={idx} className="wdm-note-reference-card">
                        <div className="wdm-note-reference-header">
                          <span className="wdm-note-reference-title" title={ref.notePath}>
                            <FileText size={12} style={{ color: "var(--accent-solid)", flexShrink: 0 }} />
                            {ref.noteTitle}
                          </span>
                          {ref.lineNumber ? (
                            <span className="wdm-note-line-badge">
                              Line {ref.lineNumber}
                            </span>
                          ) : null}
                        </div>

                        {ref.snippet && (
                          <div className="wdm-note-snippet" title={ref.snippet}>
                            {ref.snippet}
                          </div>
                        )}

                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            if (onOpenNote) {
                              onOpenNote(ref.notePath, ref.lineNumber);
                            }
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "6px",
                            height: "28px",
                            fontSize: "11px",
                            marginTop: "2px",
                          }}
                        >
                          <span>Open Note</span>
                          <ArrowRight size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
