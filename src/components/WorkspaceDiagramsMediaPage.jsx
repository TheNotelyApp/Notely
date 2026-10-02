import { useState, useMemo, useEffect } from "react";
import {
  Search,
  FileText,
  ExternalLink,
  Copy,
  Check,
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
  AlertCircle,
  MessageSquareText,
  Loader2,
  X,
  LayoutTemplate,
  Info,
  Trash2,
} from "lucide-react";
import {
  extractWorkspaceUsedAssets,
  filterAssets,
  mergeDiskMediaIntoCatalog,
} from "../services/workspaceMediaService";
import { readImage, openMediaInDefaultApp, listDiskMediaAssets, deleteImage } from "../services/electronService";
import { readDrawioImage, deleteDrawio } from "../services/drawioService";
import { readDiagramImage, deleteDiagram } from "../services/diagramService";
import { readWireframeImage, deleteWireframe } from "../services/wireframeService";
import { saveAudioRecording } from "../services/electron/mediaService";
import { transcribeAudio } from "../services/sttService";
import { showToast } from "../utils/notificationUtils";
import AppSelect from "./AppSelect";
import OverlayDialog from "./OverlayDialog";
import AppIconButton from "./AppIconButton";
import AppButton from "./AppButton";
import SubpageHeader from "./layout/SubpageHeader";
import { MediaPreviewPane } from "./MediaPreviewPane";
import "../styles/WorkspaceDiagramsMedia.css";



function formatTranscriptSummary(summary) {
  if (!summary) return "";

  if (typeof summary === "string") return summary;
  if (typeof summary === "object") {
    const parts = [];
    if (Array.isArray(summary.keyPoints) && summary.keyPoints.length > 0) {
      parts.push(summary.keyPoints.join(" • "));
    }
    if (Array.isArray(summary.actionItems) && summary.actionItems.length > 0) {
      parts.push("Actions: " + summary.actionItems.join("; "));
    }
    return parts.join("\n\n");
  }
  return String(summary);
}

// Transcript Preview Component
function TranscriptPreviewItem({ asset, basePath, isCardPreview = false, onNotify }) {
  const [transcriptData, setTranscriptData] = useState(null);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadTranscript() {
      try {
        const res = await readImage(basePath || "", asset.path);
        if (!cancelled && res) {
          let text = "";
          if (res.startsWith("data:")) {
            const base64 = res.split(",")[1];
            text = decodeURIComponent(escape(atob(base64)));
          } else {
            text = res;
          }
          try {
            const parsed = JSON.parse(text);
            if (!cancelled) setTranscriptData(parsed);
          } catch {
            if (!cancelled) setTranscriptData({ text });
          }
        }
      } catch {
        if (!cancelled) setError(true);
      }
    }
    loadTranscript();
    return () => { cancelled = true; };
  }, [asset, basePath]);

  const summaryText = formatTranscriptSummary(transcriptData?.summary);
  const rawText = transcriptData?.fullText || transcriptData?.text || "";

  if (isCardPreview) {
    const previewSnippet = summaryText || rawText || (error ? "Transcript" : "Loading transcript...");
    return (
      <div style={{ padding: "12px", width: "100%", height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "4px", fontSize: "11px", color: "var(--text-muted)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#38bdf8", fontWeight: 600 }}>
          <MessageSquareText size={14} />
          <span style={{ fontSize: "10px", letterSpacing: "0.05em" }}>TRANSCRIPT</span>
        </div>
        <p style={{ margin: "4px 0 0 0", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.35, fontSize: "11px", color: "var(--text-secondary)" }}>
          {previewSnippet}
        </p>
      </div>
    );
  }

  const handleCopyText = () => {
    const fullText = rawText || JSON.stringify(transcriptData, null, 2);
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onNotify?.("Transcript copied to clipboard", "success");
  };

  const hasStructuredSummary = Boolean(
    transcriptData?.summary &&
    typeof transcriptData.summary === "object" &&
    ((Array.isArray(transcriptData.summary.keyPoints) && transcriptData.summary.keyPoints.length > 0) ||
     (Array.isArray(transcriptData.summary.actionItems) && transcriptData.summary.actionItems.length > 0))
  );

  return (
    <div style={{ padding: "12px", width: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#38bdf8", fontWeight: 600, fontSize: "12px" }}>
          <MessageSquareText size={16} />
          <span>Speech-to-Text Transcript</span>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          type="button"
          onClick={handleCopyText}
          style={{ display: "flex", alignItems: "center", gap: "4px", height: "24px", fontSize: "11px", padding: "0 8px" }}
        >
          {copied ? <Check size={12} style={{ color: "#10b981" }} /> : <Copy size={12} />}
          <span>{copied ? "Copied" : "Copy Full Text"}</span>
        </button>
      </div>

      {hasStructuredSummary ? (
        <div style={{ padding: "8px 10px", background: "rgba(56, 189, 248, 0.08)", border: "1px solid rgba(56, 189, 248, 0.2)", borderRadius: "var(--radius-default)", fontSize: "11px", lineHeight: 1.4 }}>
          <strong style={{ color: "#38bdf8", display: "block", marginBottom: "4px" }}>Summary</strong>
          {Array.isArray(transcriptData.summary.keyPoints) && transcriptData.summary.keyPoints.length > 0 && (
            <div style={{ marginBottom: "6px" }}>
              <div style={{ fontWeight: 600, color: "var(--text-secondary)", marginBottom: "2px" }}>Key Points</div>
              <ul style={{ margin: 0, paddingLeft: "16px", color: "var(--text-primary)" }}>
                {transcriptData.summary.keyPoints.map((pt, idx) => (
                  <li key={idx} style={{ marginBottom: "2px" }}>{pt}</li>
                ))}
              </ul>
            </div>
          )}
          {Array.isArray(transcriptData.summary.actionItems) && transcriptData.summary.actionItems.length > 0 && (
            <div>
              <div style={{ fontWeight: 600, color: "var(--text-secondary)", marginBottom: "2px" }}>Action Items</div>
              <ul style={{ margin: 0, paddingLeft: "16px", color: "var(--text-primary)" }}>
                {transcriptData.summary.actionItems.map((act, idx) => (
                  <li key={idx} style={{ marginBottom: "2px" }}>{act}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : summaryText ? (
        <div style={{ padding: "8px 10px", background: "rgba(56, 189, 248, 0.08)", border: "1px solid rgba(56, 189, 248, 0.2)", borderRadius: "var(--radius-default)", fontSize: "11px", lineHeight: 1.4 }}>
          <strong style={{ color: "#38bdf8", display: "block", marginBottom: "2px" }}>Summary</strong>
          <span>{summaryText}</span>
        </div>
      ) : null}

      {transcriptData?.segments && transcriptData.segments.length > 0 ? (
        <div style={{ maxHeight: "200px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px", paddingRight: "4px" }}>
          {transcriptData.segments.map((seg, idx) => (
            <div key={idx} style={{ fontSize: "11px", lineHeight: 1.35, display: "flex", gap: "6px" }}>
              <span style={{ fontSize: "10px", color: "var(--text-muted)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                [{Math.floor(seg.start || 0)}s]
              </span>
              <span>{seg.text}</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ maxHeight: "200px", overflowY: "auto", fontSize: "11px", lineHeight: 1.4, whiteSpace: "pre-wrap", color: "var(--text-secondary)" }}>
          {rawText || "No text content available in transcript."}
        </div>
      )}
    </div>
  );
}

// Harmonious high-contrast category colors inspired by Knowledge Graph palette
const CATEGORY_THEMES = {
  diagram: { border: "rgba(99, 102, 241, 0.4)", bg: "rgba(99, 102, 241, 0.18)", text: "#a5b4fc", label: "Diagram" },
  wireframe: { border: "rgba(20, 184, 166, 0.4)", bg: "rgba(20, 184, 166, 0.18)", text: "#5eead4", label: "UI Prototype" },
  image: { border: "rgba(6, 182, 212, 0.4)", bg: "rgba(6, 182, 212, 0.18)", text: "#67e8f9", label: "Image" },
  pdf: { border: "rgba(16, 185, 129, 0.4)", bg: "rgba(16, 185, 129, 0.18)", text: "#6ee7b7", label: "PDF" },
  video: { border: "rgba(245, 158, 11, 0.4)", bg: "rgba(245, 158, 11, 0.18)", text: "#fcd34d", label: "Video" },
  audio: { border: "rgba(236, 72, 153, 0.4)", bg: "rgba(236, 72, 153, 0.18)", text: "#f9a8d4", label: "Audio" },
  transcript: { border: "rgba(14, 165, 233, 0.4)", bg: "rgba(14, 165, 233, 0.18)", text: "#7dd3fc", label: "Transcript" },
  document: { border: "rgba(139, 92, 246, 0.4)", bg: "rgba(139, 92, 246, 0.18)", text: "#c4b5fd", label: "Doc" },
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

        // 3. If Wireframe diagram, try readWireframeImage
        if (!res && asset.subType === "wireframe") {
          const diagId = asset.diagramId || asset.path?.match(/(?:wireframe|wireframes)[\\/]([^/.]+)/i)?.[1] || (asset.fileName || asset.name || "").replace(/\.png$/i, "");
          if (diagId) {
            try {
              res = await readWireframeImage(diagId, basePath || "");
            } catch {
              // fallback
            }
          }
        }

        // 4. Try previewPath if available
        if (!res && asset.previewPath) {
          try {
            res = await readImage(basePath || "", asset.previewPath);
          } catch {
            // fallback
          }
        }

        // 5. Fallback to readImage with asset path
        if (!res && asset.path) {
          try {
            res = await readImage(basePath || "", asset.path);
          } catch {
            // fallback
          }
        }

        // 6. Fallback to readImage with rawPath
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
    const isDiagram = asset?.category === "diagram" || asset?.subType === "drawio" || asset?.subType === "excalidraw" || asset?.subType === "wireframe";
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
  onNotify,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [viewingAsset, setViewingAsset] = useState(null);
  const [inspectingAsset, setInspectingAsset] = useState(null);
  const [assetToDelete, setAssetToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [usageFilter, setUsageFilter] = useState("all"); // all, single, multi
  const [sortOrder, setSortOrder] = useState("ref-desc"); // ref-desc, ref-asc, name-asc, name-desc

  // Category filters
  const [selectedCategories, setSelectedCategories] = useState({
    diagram: true,
    wireframe: true,
    image: true,
    pdf: true,
    video: true,
    audio: true,
    transcript: true,
    document: true,
  });

  const [diskFiles, setDiskFiles] = useState([]);
  const [transcribingAssetId, setTranscribingAssetId] = useState(null);
  const [transcriptionStatus, setTranscriptionStatus] = useState("");

  const showNotification = (message, type = "info") => {
    if (typeof onNotify === "function") {
      onNotify(message, type);
    } else {
      showToast(message, type);
    }
  };

  const refreshDiskFiles = async () => {
    try {
      const files = await listDiskMediaAssets();
      if (Array.isArray(files)) {
        setDiskFiles(files);
      }
    } catch {
      // ignore
    }
  };

  const handleDeleteAsset = async (asset) => {
    if (!asset || deleting) return;
    setDeleting(true);
    try {
      const targetBase = asset.referencedBy[0]?.notePath || workspacePath || "";

      if (asset.subType === "drawio") {
        const diagId = asset.diagramId || (asset.fileName || asset.name || "").replace(/\.png$/i, "");
        if (diagId) {
          await deleteDrawio(diagId, targetBase).catch(() => {});
        }
      } else if (asset.subType === "excalidraw") {
        const diagId = asset.diagramId || asset.path?.match(/(?:excalidraw|excali-diagrams)[\\/]([^/]+)/i)?.[1];
        if (diagId) {
          await deleteDiagram(targetBase, diagId).catch(() => {});
        }
      } else if (asset.subType === "wireframe") {
        const diagId = asset.diagramId || asset.path?.match(/(?:wireframe|wireframes)[\\/]([^/.]+)/i)?.[1] || (asset.fileName || asset.name || "").replace(/\.png$/i, "");
        if (diagId) {
          await deleteWireframe(diagId, targetBase).catch(() => {});
        }
      }

      if (asset.path && !asset.path.startsWith("inline:")) {
        await deleteImage(targetBase, asset.path, { removeAllReferences: false }).catch(() => {});
      }
      if (asset.previewPath && asset.previewPath !== asset.path) {
        await deleteImage(targetBase, asset.previewPath, { removeAllReferences: false }).catch(() => {});
      }

      await refreshDiskFiles();
      if (viewingAsset?.id === asset.id) setViewingAsset(null);
      if (inspectingAsset?.id === asset.id) setInspectingAsset(null);
      setAssetToDelete(null);
      showNotification(`Deleted "${asset.name}"`, "success");
    } catch (err) {
      showNotification(`Failed to delete asset: ${err.message || err}`, "error");
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    listDiskMediaAssets().then((files) => {
      if (!cancelled && Array.isArray(files)) {
        setDiskFiles(files);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [workspacePath, documents]);

  // Extract catalog from documents
  const allUsedAssets = useMemo(() => {
    return extractWorkspaceUsedAssets(documents);
  }, [documents]);

  // Merge referenced assets with physical files on disk
  const allCatalogAssets = useMemo(() => {
    return mergeDiskMediaIntoCatalog(allUsedAssets, diskFiles);
  }, [allUsedAssets, diskFiles]);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = allCatalogAssets.length;
    const diagrams = allCatalogAssets.filter((a) => a.category === "diagram").length;
    const wireframes = allCatalogAssets.filter((a) => a.category === "wireframe" || a.subType === "wireframe").length;
    const images = allCatalogAssets.filter((a) => a.category === "image").length;
    const pdfs = allCatalogAssets.filter((a) => a.category === "pdf").length;
    const media = allCatalogAssets.filter((a) => a.category === "video" || a.category === "audio").length;
    const transcripts = allCatalogAssets.filter((a) => a.category === "transcript").length;
    const docs = allCatalogAssets.filter((a) => a.category === "document").length;
    const unused = allCatalogAssets.filter((a) => (a.referenceCount || 0) === 0).length;
    return { total, diagrams, wireframes, images, pdfs, media, transcripts, docs, unused };
  }, [allCatalogAssets]);

  // Generate transcript from audio or video asset
  const handleGenerateTranscript = async (asset) => {
    if (!asset || transcribingAssetId) return;
    setTranscribingAssetId(asset.id);
    setTranscriptionStatus("Loading media file...");
    showNotification(`Transcribing "${asset.name}" with Whisper...`, "info");

    // Yield to let React render spinner
    await new Promise((resolve) => setTimeout(resolve, 30));

    try {
      const targetNotePath = asset.referencedBy[0]?.notePath || workspacePath || "";
      const dataUrl = await readImage(targetNotePath, asset.path);
      if (!dataUrl) {
        throw new Error("Could not read media file data from disk.");
      }

      // Convert data URL to Blob — sttService.transcribeAudio handles decode/resample internally
      const res = await fetch(dataUrl);
      const audioBlob = await res.blob();

      setTranscriptionStatus("Transcribing audio with Whisper...");
      await new Promise((resolve) => setTimeout(resolve, 10));
      const result = await transcribeAudio(audioBlob, {
        language: "auto",
        generateSummary: true,
        onProgress: (info) => {
          if (info?.status === "progress" && typeof info.progress === "number") {
            const percent = Math.min(100, Math.round(info.progress));
            if (percent >= 100) {
              setTranscriptionStatus("Decoding text & generating summary...");
            } else {
              setTranscriptionStatus(`Transcribing audio... ${percent}%`);
            }
          } else if (info?.status === "done") {
            setTranscriptionStatus("Finalizing transcript & generating summary...");
          }
        },
      });

      setTranscriptionStatus("Saving companion transcript...");
      const baseName = asset.name.replace(/\.[^/.]+$/, "");
      const assetDir = asset.path ? asset.path.replace(/\\/g, "/").substring(0, asset.path.lastIndexOf("/")) : "";
      const transcriptFileName = assetDir ? `${assetDir}/transcript.json` : `${baseName}_transcript.json`;

      await saveAudioRecording({
        fileName: transcriptFileName,
        audioBlob: null,
        transcript: {
          ...result,
          sourceMedia: asset.path,
          createdAt: new Date().toISOString(),
        },
      });

      await refreshDiskFiles();
      showNotification(`Transcript generated for "${asset.name}"!`, "success");
    } catch (err) {
      showNotification(`Transcription failed: ${err.message || err}`, "error");
    } finally {
      setTranscribingAssetId(null);
      setTranscriptionStatus("");
    }
  };

  // Filtered & searched assets
  const filteredAssets = useMemo(() => {
    return filterAssets(allCatalogAssets, {
      searchQuery,
      selectedCategories,
      usageFilter,
      sortOrder,
    });
  }, [allCatalogAssets, searchQuery, selectedCategories, usageFilter, sortOrder]);

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
      wireframe: true,
      image: true,
      pdf: true,
      video: true,
      audio: true,
      transcript: true,
      document: true,
    });
  };

  const selectNoneCategories = () => {
    setSelectedCategories({
      diagram: false,
      wireframe: false,
      image: false,
      pdf: false,
      video: false,
      audio: false,
      transcript: false,
      document: false,
    });
  };

  // Copy Markdown Link or Raw Code
  const handleCopy = (asset, e) => {
    if (e) e.stopPropagation();
    let textToCopy = "";
    if (asset.subType === "mermaid") {
      textToCopy = `\`\`\`mermaid\n${asset.rawCode}\n\`\`\``;
    } else if (asset.isImageSyntax || asset.category === "image" || asset.category === "diagram" || asset.category === "wireframe") {
      textToCopy = `![${asset.name}](${asset.path})`;
    } else {
      textToCopy = `[${asset.name}](${asset.path})`;
    }

    navigator.clipboard.writeText(textToCopy);
    setCopiedId(asset.id);
    setTimeout(() => setCopiedId(null), 1800);
    showNotification(`Copied reference for "${asset.name}" to clipboard`, "success");
  };

  return (
    <div className="workspace-diagrams-media-page">
      {/* Top Breadcrumb Bar */}
      <SubpageHeader
        breadcrumbCurrent="Diagrams & Media"
        onBack={onBack}
      />

      <div className="wdm-container">
        {/* Header Bar */}
        <div className="wdm-header-actions">
          {/* Search Input */}
          <div className="wdm-search-wrapper">
            <Search size={14} className="wdm-search-icon" />
            <input
              type="text"
              className="wdm-search-input"
              placeholder="Search media, diagrams, PDFs, or note references…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Compact Stats Pill */}
          <div className="wdm-stats-pill">
            <span>
              <strong>{filteredAssets.length}</strong> {filteredAssets.length === 1 ? "item" : "items"}
            </span>
            {stats.unused > 0 && (
              <>
                <span style={{ opacity: 0.3 }}>|</span>
                <span
                  onClick={() => setUsageFilter(usageFilter === "unused" ? "all" : "unused")}
                  style={{
                    cursor: "pointer",
                    color: "var(--accent-strong, #f59e0b)",
                    fontWeight: usageFilter === "unused" ? 700 : 500,
                  }}
                  title="Click to toggle Unused / Orphaned assets"
                >
                  ⚠️ <strong>{stats.unused}</strong> unused
                </span>
              </>
            )}
          </div>
        </div>

        {/* Main Body with Split View */}
        <div className="wdm-body">
          {/* Static Left Sidebar */}
          <div className="wdm-sidebar">
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

                <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                  {[
                    { key: "diagram", label: "Diagrams", icon: FileCode, count: stats.diagrams, color: CATEGORY_THEMES.diagram.border },
                    { key: "wireframe", label: "UI Prototypes", icon: LayoutTemplate, count: stats.wireframes, color: CATEGORY_THEMES.wireframe.border },
                    { key: "image", label: "Images", icon: ImageIcon, count: stats.images, color: CATEGORY_THEMES.image.border },
                    { key: "pdf", label: "PDFs", icon: FileDigit, count: stats.pdfs, color: CATEGORY_THEMES.pdf.border },
                    { key: "video", label: "Videos", icon: Video, count: allCatalogAssets.filter((a) => a.category === "video").length, color: CATEGORY_THEMES.video.border },
                    { key: "audio", label: "Audio", icon: Music, count: allCatalogAssets.filter((a) => a.category === "audio").length, color: CATEGORY_THEMES.audio.border },
                    { key: "transcript", label: "Transcripts", icon: MessageSquareText, count: stats.transcripts, color: CATEGORY_THEMES.transcript.border },
                    { key: "document", label: "Documents", icon: File, count: stats.docs, color: CATEGORY_THEMES.document.border },
                  ].map(({ key, label, count, color }) => (
                    <label key={key} className="wdm-filter-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedCategories[key] !== false}
                        onChange={() => toggleCategory(key)}
                      />
                      <span className="wdm-filter-dot" style={{ background: color }} />
                      <span className="wdm-filter-label" style={{ color: selectedCategories[key] !== false ? "var(--text-strong)" : "var(--text-secondary)" }}>
                        {label}
                      </span>
                      <span className="wdm-filter-count">{count}</span>
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
                <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                  {[
                    { id: "all", label: "All Items", count: stats.total },
                    { id: "single", label: "Single Note", count: allCatalogAssets.filter((a) => a.referenceCount === 1).length },
                    { id: "multi", label: "Multi-Note", count: allCatalogAssets.filter((a) => a.referenceCount > 1).length },
                    { id: "unused", label: "Unused / Orphan", count: stats.unused, isWarn: stats.unused > 0 },
                  ].map((opt) => (
                    <label key={opt.id} className="wdm-filter-checkbox">
                      <input
                        type="radio"
                        name="usageFilter"
                        checked={usageFilter === opt.id}
                        onChange={() => setUsageFilter(opt.id)}
                      />
                      <span
                        className="wdm-filter-label"
                        style={{
                          color: opt.isWarn ? "var(--accent-strong, #f59e0b)" : (usageFilter === opt.id ? "var(--text-strong)" : "var(--text-secondary)"),
                          fontWeight: usageFilter === opt.id ? 600 : 400,
                        }}
                      >
                        {opt.label}
                      </span>
                      <span
                        className="wdm-filter-count"
                        style={{ color: opt.isWarn ? "var(--accent-strong, #f59e0b)" : undefined }}
                      >
                        {opt.count}
                      </span>
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
                <div className="wdm-table-container">
                  <table className="wdm-table">
                    <thead>
                      <tr>
                        <th>Asset Name</th>
                        <th style={{ width: "120px" }}>Type</th>
                        <th style={{ width: "90px" }}>Size</th>
                        <th style={{ width: "200px" }}>Referenced In</th>
                        <th style={{ width: "150px" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAssets.map((asset) => {
                        const theme = getCategoryTheme(asset.category);
                        const isSelected = viewingAsset?.id === asset.id || inspectingAsset?.id === asset.id;
                        const CategoryIcon = (() => {
                          switch (asset.category) {
                            case "diagram": return FileCode;
                            case "wireframe": return LayoutTemplate;
                            case "image": return ImageIcon;
                            case "pdf": return FileDigit;
                            case "video": return Video;
                            case "audio": return Music;
                            case "transcript": return MessageSquareText;
                            default: return File;
                          }
                        })();

                        const typeLabel = (() => {
                          if (asset.category === "wireframe" || asset.subType === "wireframe") return "WIREFRAME";
                          if (asset.subType === "excalidraw") return "EXCALIDRAW";
                          if (asset.subType === "drawio") return "DRAW.IO";
                          if (asset.subType === "mermaid") return asset.diagramType ? asset.diagramType.toUpperCase() : "MERMAID";
                          if (asset.category === "transcript" || asset.subType === "transcript") return "TRANSCRIPT";
                          const raw = asset.diagramType || (asset.subType && asset.subType.length <= 10 && !asset.subType.includes("/") ? asset.subType : "") || asset.extension || asset.category || "FILE";
                          return String(raw).toUpperCase();
                        })();

                        const formattedSize = (() => {
                          if (typeof asset.size !== "number" || asset.size <= 0) return "—";
                          if (asset.size < 1024) return `${asset.size} B`;
                          if (asset.size < 1024 * 1024) return `${(asset.size / 1024).toFixed(1)} KB`;
                          return `${(asset.size / (1024 * 1024)).toFixed(1)} MB`;
                        })();

                        return (
                          <tr
                            key={asset.id}
                            className={`wdm-table-row ${isSelected ? "selected" : ""}`}
                            onClick={() => setViewingAsset(asset)}
                            title="Click to preview asset"
                          >
                            {/* Asset Name with Icon & Sub-path */}
                            <td>
                              <div className="wdm-asset-name-cell">
                                <div className={`wdm-asset-icon-box wdm-badge-${asset.category}`}>
                                  <CategoryIcon size={14} />
                                </div>
                                <div className="wdm-asset-name-info">
                                  <span className="wdm-asset-main-name" title={asset.name}>
                                    {asset.name}
                                  </span>
                                  <span className="wdm-asset-sub-path" title={asset.path}>
                                    {asset.path?.startsWith("inline:") ? "Inline Diagram" : asset.path}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Type Badge & Companion Transcript Indicator */}
                            <td>
                              <div style={{ display: "inline-flex", alignItems: "center", flexWrap: "nowrap" }}>
                                <span className={`wdm-badge wdm-badge-${asset.category}`}>
                                  {typeLabel}
                                </span>
                                {(asset.hasTranscript || asset.linkedTranscriptId || asset.linkedTranscriptPath) && (
                                  <span
                                    className="wdm-transcript-indicator"
                                    title="Speech-to-Text transcript attached"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setInspectingAsset(asset);
                                    }}
                                  >
                                    <MessageSquareText size={12} />
                                    Transcript
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* File Size */}
                            <td style={{ color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                              {formattedSize}
                            </td>

                            {/* Referenced Notes / Unused badge */}
                            <td>
                              {asset.referenceCount === 0 ? (
                                <span className="wdm-ref-pill is-unused" title="Unlinked asset in workspace">
                                  <AlertCircle size={12} />
                                  Unused
                                </span>
                              ) : asset.referenceCount === 1 ? (
                                <button
                                  className="wdm-ref-pill-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenNote?.(asset.referencedBy[0].notePath, asset.referencedBy[0].lineNumber);
                                  }}
                                  title={`Open ${asset.referencedBy[0].noteTitle}:${asset.referencedBy[0].lineNumber}`}
                                >
                                  <FileText size={12} />
                                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {asset.referencedBy[0].noteTitle}
                                  </span>
                                </button>
                              ) : (
                                <button
                                  className="wdm-ref-pill-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setInspectingAsset(asset);
                                  }}
                                  title="Click to view all referenced notes in inspector"
                                >
                                  <FileText size={12} />
                                  <span>{asset.referenceCount} notes</span>
                                </button>
                              )}
                            </td>

                            {/* Actions Column */}
                            <td>
                              <div className="wdm-table-action-btns">
                                {(asset.category === "audio" || asset.category === "video") && (
                                  <button
                                    className="wdm-icon-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleGenerateTranscript(asset);
                                    }}
                                    disabled={Boolean(transcribingAssetId)}
                                    title={transcribingAssetId === asset.id ? transcriptionStatus : "Generate AI Speech-to-Text Transcript"}
                                    style={{ color: "#38bdf8" }}
                                  >
                                    {transcribingAssetId === asset.id ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
                                  </button>
                                )}

                                <button
                                  className="wdm-icon-btn"
                                  onClick={(e) => handleCopy(asset, e)}
                                  title="Copy Markdown Link / Embed"
                                >
                                  {copiedId === asset.id ? <Check size={14} style={{ color: "#10b981" }} /> : <Copy size={14} />}
                                </button>

                                {asset.path && !asset.path.startsWith("inline:") && (
                                  <button
                                    className="wdm-icon-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const targetBase = asset.referencedBy[0]?.notePath || workspacePath || "";
                                      openMediaInDefaultApp(targetBase, asset.path).catch((err) => {
                                        showNotification(`Failed to open in default app: ${err.message || err}`, "error");
                                      });
                                    }}
                                    title="Open in OS Default App"
                                  >
                                    <ExternalLink size={14} />
                                  </button>
                                )}

                                <button
                                  className="wdm-icon-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setInspectingAsset(asset);
                                  }}
                                  title="Inspect Metadata & Note References"
                                >
                                  <Info size={14} />
                                </button>

                                {asset.path && !asset.path.startsWith("inline:") && (
                                  <button
                                    className="wdm-icon-btn wdm-delete-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setAssetToDelete(asset);
                                    }}
                                    title="Delete Asset from Disk"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          {/* Full Asset Viewer Modal (uses standardized MediaPreviewPane from Editor) */}
          {viewingAsset && (
            <OverlayDialog
              open={Boolean(viewingAsset)}
              onClose={() => setViewingAsset(null)}
              ariaLabel={viewingAsset.name || "Asset Viewer"}
              size="xl"
            >
              {viewingAsset.subType === "mermaid" ? (
                <div style={{ display: "flex", flexDirection: "column", height: "80vh" }}>
                  <div className="overlay-dialog-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderBottom: "1px solid var(--border-default)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span className="wdm-badge" style={{ background: getCategoryTheme("diagram").bg, color: getCategoryTheme("diagram").text, border: `1px solid ${getCategoryTheme("diagram").border}`, fontSize: "10px", padding: "2px 6px" }}>
                        MERMAID
                      </span>
                      <h2 style={{ margin: 0, fontSize: "14px", fontWeight: 600 }}>{viewingAsset.name}</h2>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={(e) => handleCopy(viewingAsset, e)}
                        style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px" }}
                      >
                        <Copy size={12} />
                        <span>Copy Code</span>
                      </button>
                      <button
                        className="wdm-icon-btn"
                        onClick={() => {
                          const a = viewingAsset;
                          setViewingAsset(null);
                          setInspectingAsset(a);
                        }}
                        title="Inspect Metadata & Notes"
                      >
                        <Info size={16} />
                      </button>
                      <AppIconButton onClick={() => setViewingAsset(null)} aria-label="Close viewer">
                        <X size={16} />
                      </AppIconButton>
                    </div>
                  </div>
                  <div style={{ flex: 1, overflow: "auto", padding: "20px", display: "flex", justifyContent: "center", alignItems: "center", background: "var(--surface-subtle)" }}>
                    <MermaidRenderer code={viewingAsset.rawCode} isCardPreview={false} />
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", height: "82vh" }}>
                  <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                    <MediaPreviewPane
                      mediaPath={viewingAsset.previewPath || viewingAsset.path}
                      mediaType={viewingAsset.category}
                      basePath={viewingAsset.referencedBy[0]?.notePath || workspacePath}
                      onClose={() => setViewingAsset(null)}
                      onMediaChanged={refreshDiskFiles}
                    />
                  </div>
                </div>
              )}

              {/* Referenced Notes Footer */}
              {viewingAsset.referencedBy && viewingAsset.referencedBy.length > 0 && (
                <div style={{ padding: "8px 16px", borderTop: "1px solid var(--border-default)", background: "var(--surface-subtle)", display: "flex", alignItems: "center", gap: "10px", fontSize: "11px", flexShrink: 0 }}>
                  <span style={{ fontWeight: 600, color: "var(--text-secondary)", flexShrink: 0 }}>
                    Referenced in ({viewingAsset.referencedBy.length}):
                  </span>
                  <div style={{ display: "flex", gap: "6px", overflowX: "auto", flex: 1, paddingBottom: "2px" }}>
                    {viewingAsset.referencedBy.map((ref, idx) => (
                      <button
                        key={idx}
                        className="btn btn-tertiary btn-sm"
                        style={{ fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px", whiteSpace: "nowrap" }}
                        onClick={() => {
                          setViewingAsset(null);
                          onOpenNote?.(ref.notePath, ref.lineNumber);
                        }}
                        title={`Open ${ref.noteTitle} at line ${ref.lineNumber}`}
                      >
                        <FileText size={12} />
                        <span>{ref.noteTitle}:{ref.lineNumber}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </OverlayDialog>
          )}

          {/* Asset Inspector Modal (Metadata, Properties, and Note References) */}
          {inspectingAsset && (
            <OverlayDialog
              open={Boolean(inspectingAsset)}
              onClose={() => setInspectingAsset(null)}
              ariaLabel={inspectingAsset.name || "Asset Inspector"}
              size="lg"
            >
              <div className="overlay-dialog-header">
                <h2>
                  <Info size={16} style={{ color: "var(--accent-solid)", marginRight: 8, display: "inline-block", verticalAlign: "middle" }} />
                  Asset Inspector
                </h2>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      const a = inspectingAsset;
                      setInspectingAsset(null);
                      setViewingAsset(a);
                    }}
                    style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px" }}
                  >
                    <Eye size={12} />
                    <span>Open Viewer</span>
                  </button>
                  <AppIconButton onClick={() => setInspectingAsset(null)} aria-label="Close inspector">
                    <X size={16} />
                  </AppIconButton>
                </div>
              </div>

              <div className="wdm-details-body">
                {/* Thumbnail Preview */}
                <div className="wdm-details-preview">
                  {inspectingAsset.subType === "mermaid" ? (
                    <MermaidRenderer code={inspectingAsset.rawCode} isCardPreview={false} />
                  ) : (
                    <DiagramOrImagePreviewItem
                      asset={inspectingAsset}
                      basePath={inspectingAsset.referencedBy[0]?.notePath || workspacePath}
                      className="wdm-details-img"
                    />
                  )}
                </div>

                {/* Metadata details */}
                <div className="wdm-detail-row">
                  <span className="label">Name</span>
                  <strong>{inspectingAsset.name}</strong>
                </div>

                <div className="wdm-detail-row">
                  <span className="label">Category & Format</span>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <span className={`wdm-badge wdm-badge-${inspectingAsset.category}`}>
                      {inspectingAsset.category.toUpperCase()}
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
                      {(() => {
                        if (inspectingAsset.category === "wireframe" || inspectingAsset.subType === "wireframe") {
                          return "UI PROTOTYPE (WIREFRAME)";
                        }
                        if (inspectingAsset.subType === "excalidraw") {
                          return "EXCALIDRAW DIAGRAM";
                        }
                        if (inspectingAsset.subType === "drawio") {
                          return "DRAW.IO DIAGRAM";
                        }
                        if (inspectingAsset.subType === "mermaid") {
                          return inspectingAsset.diagramType ? `MERMAID (${inspectingAsset.diagramType})` : "MERMAID DIAGRAM";
                        }
                        if (inspectingAsset.category === "transcript") {
                          return "SPEECH-TO-TEXT TRANSCRIPT";
                        }
                        const raw = inspectingAsset.diagramType || inspectingAsset.extension || (inspectingAsset.subType && inspectingAsset.subType.length <= 12 && !inspectingAsset.subType.includes("/") ? inspectingAsset.subType : "") || inspectingAsset.category || "FILE";
                        return String(raw).toUpperCase();
                      })()}
                    </span>
                  </div>
                </div>

                {inspectingAsset.path && !inspectingAsset.path.startsWith("inline:") && (
                  <div className="wdm-detail-row">
                    <span className="label">File Path</span>
                    <code>{inspectingAsset.path}</code>
                  </div>
                )}

                {inspectingAsset.previewPath && inspectingAsset.previewPath !== inspectingAsset.path && (
                  <div className="wdm-detail-row">
                    <span className="label">Rendered Preview</span>
                    <code>{inspectingAsset.previewPath}</code>
                  </div>
                )}

                {inspectingAsset.size > 0 && (
                  <div className="wdm-detail-row">
                    <span className="label">File Size</span>
                    <span>{Math.round(inspectingAsset.size / 1024)} KB</span>
                  </div>
                )}

                {/* Linked media row */}
                {inspectingAsset.linkedTranscriptName && (
                  <div className="wdm-detail-row">
                    <span className="label">Linked Transcript</span>
                    <button
                      className="btn btn-tertiary"
                      style={{ fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                      onClick={() => {
                        const tr = allCatalogAssets.find((a) => a.id === inspectingAsset.linkedTranscriptId);
                        if (tr) setInspectingAsset(tr);
                      }}
                    >
                      <MessageSquareText size={12} />
                      {inspectingAsset.linkedTranscriptName}
                    </button>
                  </div>
                )}

                {inspectingAsset.linkedAudioName && (
                  <div className="wdm-detail-row">
                    <span className="label">Source Audio</span>
                    <button
                      className="btn btn-tertiary"
                      style={{ fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                      onClick={() => {
                        const av = allCatalogAssets.find((a) => a.id === inspectingAsset.linkedAudioId);
                        if (av) setInspectingAsset(av);
                      }}
                    >
                      <Music size={12} />
                      {inspectingAsset.linkedAudioName}
                    </button>
                  </div>
                )}

                {/* Open in external OS default app and Delete (for files) */}
                {inspectingAsset.path && !inspectingAsset.path.startsWith("inline:") && (
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        const targetBase = inspectingAsset.referencedBy[0]?.notePath || workspacePath || "";
                        openMediaInDefaultApp(targetBase, inspectingAsset.path).catch((err) => {
                          showNotification(`Failed to open in default app: ${err.message || err}`, "error");
                        });
                      }}
                      style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", height: "30px", fontSize: "11px" }}
                    >
                      <ExternalLink size={12} />
                      Open in Default App
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => setAssetToDelete(inspectingAsset)}
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", height: "30px", fontSize: "11px", padding: "0 12px" }}
                      title="Delete asset from disk"
                    >
                      <Trash2 size={12} />
                      Delete
                    </button>
                  </div>
                )}

                {/* Referenced Notes Section */}
                <div className="wdm-referenced-notes-section">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span className="label" style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)" }}>
                      Referenced In Notes ({inspectingAsset.referencedBy.length})
                    </span>
                  </div>

                  {inspectingAsset.referencedBy.length === 0 ? (
                    <div style={{ padding: "12px", background: "var(--status-warning-bg)", border: "1px solid var(--status-warning-border)", borderRadius: "var(--radius-default)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--status-warning-text)", fontWeight: "600", fontSize: "12px", marginBottom: "4px" }}>
                        <AlertCircle size={14} /> Unused Media File
                      </div>
                      <p style={{ margin: "0 0 8px 0", fontSize: "11px", color: "var(--text-muted)" }}>
                        This asset is saved in your workspace media storage but is not yet embedded or linked in any note.
                      </p>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px" }}
                        onClick={(e) => handleCopy(inspectingAsset, e)}
                      >
                        <Copy size={12} /> Copy Markdown Embed
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {inspectingAsset.referencedBy.map((ref, idx) => (
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

                          <AppButton
                            variant="primary"
                            onClick={() => {
                              if (onOpenNote) {
                                onOpenNote(ref.notePath, ref.lineNumber);
                              }
                            }}
                            style={{
                              width: "100%",
                              marginTop: "2px",
                            }}
                          >
                            <span>Open Note</span>
                            <ArrowRight size={12} />
                          </AppButton>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </OverlayDialog>
          )}

          {/* Delete Confirmation Modal */}
          {assetToDelete && (
            <OverlayDialog
              open={Boolean(assetToDelete)}
              onClose={() => !deleting && setAssetToDelete(null)}
              ariaLabel="Confirm Delete Asset"
              size="sm"
            >
              <div className="overlay-dialog-header">
                <h2>Delete Asset</h2>
                <AppIconButton
                  onClick={() => setAssetToDelete(null)}
                  disabled={deleting}
                  aria-label="Close dialog"
                >
                  <X size={16} />
                </AppIconButton>
              </div>
              <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px", fontSize: "12px" }}>
                <p style={{ margin: 0, color: "var(--text-primary)" }}>
                  Are you sure you want to permanently delete <strong>{assetToDelete.name}</strong> from disk?
                </p>
                {assetToDelete.referenceCount > 0 && (
                  <div style={{ padding: "8px 10px", background: "var(--status-warning-bg)", border: "1px solid var(--status-warning-border)", borderRadius: "var(--radius-default)", color: "var(--status-warning-text)", fontSize: "11px" }}>
                    ⚠️ This asset is referenced in <strong>{assetToDelete.referenceCount} note{assetToDelete.referenceCount === 1 ? "" : "s"}</strong>. Note embeds may become broken links.
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setAssetToDelete(null)}
                    disabled={deleting}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDeleteAsset(assetToDelete)}
                    disabled={deleting}
                    style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
                  >
                    {deleting ? <Loader2 size={12} className="spin" /> : <Trash2 size={12} />}
                    <span>{deleting ? "Deleting..." : "Delete Asset"}</span>
                  </button>
                </div>
              </div>
            </OverlayDialog>
          )}
        </div>
      </div>
    </div>
  );
}
