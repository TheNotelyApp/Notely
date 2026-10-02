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
  AlertCircle,
  MessageSquareText,
  Loader2,
  X,
  LayoutTemplate,
} from "lucide-react";
import {
  extractWorkspaceUsedAssets,
  filterAssets,
  mergeDiskMediaIntoCatalog,
} from "../services/workspaceMediaService";
import { readImage, openMediaInDefaultApp, listDiskMediaAssets } from "../services/electronService";
import { readDrawioImage } from "../services/drawioService";
import { readDiagramImage } from "../services/diagramService";
import { readWireframeImage } from "../services/wireframeService";
import { saveAudioRecording } from "../services/electron/mediaService";
import { transcribeAudio } from "../services/sttService";
import { showToast } from "../utils/notificationUtils";
import AppSelect from "./AppSelect";
import OverlayDialog from "./OverlayDialog";
import AppIconButton from "./AppIconButton";
import AppButton from "./AppButton";
import SubpageHeader from "./layout/SubpageHeader";
import "../styles/WorkspaceDiagramsMedia.css";

// Audio Preview Component
function AudioPlayerPreviewItem({ asset, basePath }) {
  const [dataUrl, setDataUrl] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadAudio() {
      try {
        const res = await readImage(basePath || "", asset.path);
        if (!cancelled && res) {
          setDataUrl(res);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    }
    loadAudio();
    return () => { cancelled = true; };
  }, [asset, basePath]);

  if (error || !dataUrl) {
    return (
      <div style={{ padding: "16px", textAlign: "center" }}>
        <Music size={20} style={{ width: 32, height: 32, color: "var(--accent-solid, #ec4899)", marginBottom: "8px" }} />
        <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{asset.name}</div>
      </div>
    );
  }

  return (
    <div style={{ padding: "12px", width: "100%", display: "flex", flexDirection: "column", gap: "8px", alignItems: "center" }}>
      <audio controls src={dataUrl} style={{ width: "100%", maxHeight: "36px" }} />
    </div>
  );
}

// Video Preview Component
function VideoPlayerPreviewItem({ asset, basePath }) {
  const [dataUrl, setDataUrl] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadVideo() {
      try {
        const res = await readImage(basePath || "", asset.path);
        if (!cancelled && res) {
          setDataUrl(res);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    }
    loadVideo();
    return () => { cancelled = true; };
  }, [asset, basePath]);

  if (error || !dataUrl) {
    return (
      <div style={{ padding: "16px", textAlign: "center" }}>
        <Video size={20} style={{ width: 32, height: 32, color: "var(--accent-solid, #f59e0b)", marginBottom: "8px" }} />
        <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{asset.name}</div>
      </div>
    );
  }

  return (
    <div style={{ padding: "8px", width: "100%", display: "flex", flexDirection: "column", gap: "8px", alignItems: "center" }}>
      <video controls src={dataUrl} style={{ width: "100%", maxHeight: "240px", borderRadius: "6px", background: "#000" }} />
    </div>
  );
}

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
        <div style={{ padding: "8px 10px", background: "rgba(56, 189, 248, 0.08)", border: "1px solid rgba(56, 189, 248, 0.2)", borderRadius: "6px", fontSize: "11px", lineHeight: 1.4 }}>
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
        <div style={{ padding: "8px 10px", background: "rgba(56, 189, 248, 0.08)", border: "1px solid rgba(56, 189, 248, 0.2)", borderRadius: "6px", fontSize: "11px", lineHeight: 1.4 }}>
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

// Harmonious category colors inspired by Knowledge Graph palette
const CATEGORY_THEMES = {
  diagram: { border: "#6366f1", bg: "rgba(99, 102, 241, 0.12)", text: "#818cf8", label: "Diagram" },
  wireframe: { border: "#14b8a6", bg: "rgba(20, 184, 166, 0.12)", text: "#2dd4bf", label: "UI Prototype" },
  image: { border: "#06b6d4", bg: "rgba(6, 182, 212, 0.12)", text: "#22d3ee", label: "Image" },
  pdf: { border: "#10b981", bg: "rgba(16, 185, 129, 0.12)", text: "#34d399", label: "PDF" },
  video: { border: "#f59e0b", bg: "rgba(245, 158, 11, 0.12)", text: "#fbbf24", label: "Video" },
  audio: { border: "#ec4899", bg: "rgba(236, 72, 153, 0.12)", text: "#f472b6", label: "Audio" },
  transcript: { border: "#0ea5e9", bg: "rgba(14, 165, 233, 0.12)", text: "#38bdf8", label: "Transcript" },
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

        // 4. Fallback to readImage with asset path
        if (!res && asset.path) {
          try {
            res = await readImage(basePath || "", asset.path);
          } catch {
            // fallback
          }
        }

        // 5. Fallback to readImage with rawPath
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState(null);
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
    }
    showToast(message, type);
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
      const transcriptFileName = `${baseName}_transcript.json`;

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
    } else if (asset.isImageSyntax || asset.category === "image") {
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
        breadcrumbCurrent="Media Gallery"
        onBack={onBack}
      />

      <div className="wdm-container">
        {/* Header Bar */}
        <div className="wdm-header-actions">
          <AppIconButton
            onClick={() => setSidebarOpen((prev) => !prev)}
            aria-label={sidebarOpen ? "Hide filters sidebar" : "Show filters sidebar"}
            title={sidebarOpen ? "Hide filters sidebar" : "Show filters sidebar"}
          >
            {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
          </AppIconButton>

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
                          ) : (asset.category === "image" || asset.category === "wireframe" || asset.subType === "wireframe" || asset.subType === "drawio" || asset.subType === "excalidraw" || asset.category === "diagram") ? (
                            <DiagramOrImagePreviewItem
                              asset={asset}
                              basePath={asset.referencedBy[0]?.notePath || workspacePath}
                              className="wdm-card-img"
                            />
                          ) : asset.category === "pdf" ? (
                            <div className="wdm-card-preview-doc">
                              <div className="wdm-card-icon-frame" style={{ background: theme.bg, color: theme.text, border: `1px solid ${theme.border}` }}>
                                <FileDigit size={20} />
                              </div>
                            </div>
                          ) : asset.category === "video" ? (
                            <div className="wdm-card-preview-doc">
                              <div className="wdm-card-icon-frame" style={{ background: theme.bg, color: theme.text, border: `1px solid ${theme.border}` }}>
                                <Video size={20} />
                              </div>
                            </div>
                          ) : asset.category === "audio" ? (
                            <div className="wdm-card-preview-doc">
                              <div className="wdm-card-icon-frame" style={{ background: theme.bg, color: theme.text, border: `1px solid ${theme.border}` }}>
                                <Music size={20} />
                              </div>
                            </div>
                          ) : asset.category === "transcript" ? (
                            <TranscriptPreviewItem
                              asset={asset}
                              basePath={asset.referencedBy[0]?.notePath || workspacePath}
                              isCardPreview={true}
                            />
                          ) : (
                            <div className="wdm-card-preview-doc">
                              <div className="wdm-card-icon-frame" style={{ background: theme.bg, color: theme.text, border: `1px solid ${theme.border}` }}>
                                <File size={20} />
                              </div>
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
                              {(() => {
                                if (asset.category === "wireframe" || asset.subType === "wireframe") {
                                  return "WIREFRAME";
                                }
                                const raw = asset.diagramType || (asset.subType && asset.subType.length <= 8 && !asset.subType.includes("/") ? asset.subType : "") || asset.extension || asset.category || "FILE";
                                return String(raw).toUpperCase();
                              })()}
                            </span>

                            <span
                              className={`wdm-reference-count-badge ${asset.referenceCount === 0 ? "is-unused" : ""}`}
                            >
                              {asset.referenceCount === 0 ? (
                                <>
                                  <AlertCircle size={12} />
                                  Unused
                                </>
                              ) : (
                                <>
                                  <FileText size={12} />
                                  {asset.referenceCount} {asset.referenceCount === 1 ? "note" : "notes"}
                                </>
                              )}
                            </span>
                          </div>
                        </div>

                        {/* Card Footer Actions */}
                        <div className="wdm-card-footer">
                          <span
                            className={`wdm-card-footer-path ${asset.referenceCount === 0 ? "is-unused" : ""}`}
                            title={asset.referencedBy[0]?.noteTitle || (asset.referenceCount === 0 ? "Unlinked asset in workspace" : "Referenced in workspace")}
                          >
                            {asset.referencedBy[0]?.noteTitle || (asset.referenceCount === 0 ? "Unlinked" : "Referenced in workspace")}
                          </span>

                          <div className="wdm-card-footer-actions">
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
                                {transcribingAssetId === asset.id ? <Loader2 size={12} className="spin" /> : <Sparkles size={12} />}
                              </button>
                            )}

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

          {/* Standard Notely OverlayDialog Inspector */}
          {selectedAsset && (
            <OverlayDialog
              open={Boolean(selectedAsset)}
              onClose={() => setSelectedAsset(null)}
              ariaLabel={selectedAsset.subType === "mermaid" ? "Diagram Inspector" : "Asset Inspector"}
              size="lg"
            >
              <div className="overlay-dialog-header">
                <h2>
                  <Sparkles size={16} style={{ color: "var(--accent-solid)", marginRight: 8, display: "inline-block", verticalAlign: "middle" }} />
                  {selectedAsset.subType === "mermaid" ? "Diagram Inspector" : "Asset Inspector"}
                </h2>
                <AppIconButton onClick={() => setSelectedAsset(null)} aria-label="Close inspector">
                  <X size={16} />
                </AppIconButton>
              </div>

              <div className="wdm-details-body">
                {/* Full Live Preview */}
                <div className="wdm-details-preview">
                  {selectedAsset.subType === "mermaid" ? (
                    <MermaidRenderer
                      code={selectedAsset.rawCode}
                      className="wdm-details-preview-mermaid"
                    />
                  ) : (selectedAsset.category === "image" || selectedAsset.category === "wireframe" || selectedAsset.subType === "wireframe" || selectedAsset.subType === "drawio" || selectedAsset.subType === "excalidraw" || selectedAsset.category === "diagram") ? (
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
                  ) : selectedAsset.category === "video" ? (
                    <VideoPlayerPreviewItem
                      asset={selectedAsset}
                      basePath={selectedAsset.referencedBy[0]?.notePath || workspacePath}
                    />
                  ) : selectedAsset.category === "audio" ? (
                    <AudioPlayerPreviewItem
                      asset={selectedAsset}
                      basePath={selectedAsset.referencedBy[0]?.notePath || workspacePath}
                    />
                  ) : selectedAsset.category === "transcript" ? (
                    <TranscriptPreviewItem
                      asset={selectedAsset}
                      basePath={selectedAsset.referencedBy[0]?.notePath || workspacePath}
                      isCardPreview={false}
                      onNotify={showNotification}
                    />
                  ) : (
                    <div style={{ textAlign: "center", padding: "16px" }}>
                      <File size={20} style={{ width: 48, height: 48, color: CATEGORY_THEMES.document.text, marginBottom: "8px" }} />
                      <div style={{ fontSize: "13px", fontWeight: 600 }}>{selectedAsset.name}</div>
                    </div>
                  )}
                </div>

                {/* Generate AI Transcript action card for audio and video assets */}
                {(selectedAsset.category === "audio" || selectedAsset.category === "video") && (
                  <div style={{ margin: "10px 0", padding: "10px 12px", background: "var(--status-info-bg)", border: "1px solid var(--status-info-border)", borderRadius: "var(--radius-md, 8px)", display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--status-info-text)" }}>
                        Speech-to-Text Transcription
                      </span>
                      <AppButton
                        variant="primary"
                        onClick={() => handleGenerateTranscript(selectedAsset)}
                        disabled={Boolean(transcribingAssetId)}
                      >
                        {transcribingAssetId === selectedAsset.id ? <Loader2 size={12} className="spin" /> : <Sparkles size={12} />}
                        <span>{transcribingAssetId === selectedAsset.id ? "Transcribing..." : "Generate AI Transcript"}</span>
                      </AppButton>
                    </div>
                    {transcribingAssetId === selectedAsset.id && (
                      <span style={{ fontSize: "11px", color: "var(--status-info-text)", fontStyle: "italic" }}>
                        {transcriptionStatus}
                      </span>
                    )}
                  </div>
                )}

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
                      {(() => {
                        const raw = selectedAsset.diagramType || selectedAsset.extension || (selectedAsset.subType && selectedAsset.subType.length <= 8 && !selectedAsset.subType.includes("/") ? selectedAsset.subType : "") || selectedAsset.category || "FILE";
                        return String(raw).toUpperCase();
                      })()}
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
                      const targetBase = selectedAsset.referencedBy[0]?.notePath || workspacePath || "";
                      openMediaInDefaultApp(targetBase, selectedAsset.path).catch((err) => {
                        showNotification(`Failed to open in default app: ${err.message || err}`, "error");
                      });
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

                  {selectedAsset.referencedBy.length === 0 ? (
                    <div style={{ padding: "12px", background: "var(--status-warning-bg)", border: "1px solid var(--status-warning-border)", borderRadius: "var(--radius-md, 6px)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--status-warning-text)", fontWeight: "600", fontSize: "12px", marginBottom: "4px" }}>
                        <AlertCircle size={14} /> Unused Media File
                      </div>
                      <p style={{ margin: "0 0 8px 0", fontSize: "11px", color: "var(--text-muted)" }}>
                        This asset is saved in your workspace media storage but is not yet embedded or linked in any note.
                      </p>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px" }}
                        onClick={(e) => handleCopy(selectedAsset, e)}
                      >
                        <Copy size={12} /> Copy Markdown Embed
                      </button>
                    </div>
                  ) : (
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
        </div>
      </div>
    </div>
  );
}
