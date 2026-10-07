import { useState, useMemo, useEffect } from "react";
import {
  FileText,
  Search,
  Download,
  Copy,
  Check,
  Eye,
  FileCode,
  Sparkles,
  Loader2,
  Layers,
  Clock,
  Hash,
  CheckCircle2,
} from "lucide-react";
import AppButton from "../AppButton";
import { renderMarkdown } from "../../utils/renderUtils";
import { showToast } from "../../utils/notificationUtils";
import { getExtractedContent, forceReextract } from "../../services/documentExtractionService";
import { runExport } from "../../services/electronService";
import "../../styles/mediaPreview.css";

export function ExtractedContentViewer({
  mediaPath,
  fileName,
  fileExtension,
  extractionRecord = null,
  onNotify = null,
}) {
  const [extractedMarkdownText, setExtractedMarkdownText] = useState(
    extractionRecord?.extractedText || ""
  );
  const [loading, setLoading] = useState(!extractionRecord?.extractedText);
  const [reextracting, setReextracting] = useState(false);
  const [viewMode, setViewMode] = useState("rendered"); // "rendered" | "raw"
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);

  const notify = (msg, type = "info") => {
    if (typeof onNotify === "function") {
      onNotify(msg, type);
    } else {
      showToast(msg, type);
    }
  };

  useEffect(() => {
    let cancelled = false;
    if (extractionRecord?.extractedText) {
      setExtractedMarkdownText(extractionRecord.extractedText);
      setLoading(false);
      return;
    }
    if (!mediaPath && !fileName) {
      setExtractedMarkdownText("");
      setLoading(false);
      return;
    }

    setLoading(true);
    const targetPath = mediaPath || fileName || "";
    getExtractedContent(targetPath)
      .then((content) => {
        if (!cancelled) {
          setExtractedMarkdownText(content || "");
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mediaPath, fileName, extractionRecord?.extractedText]);

  const searchMatchCount = useMemo(() => {
    if (!searchQuery.trim() || !extractedMarkdownText) return 0;
    try {
      const q = searchQuery.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(q, "gi");
      const matches = extractedMarkdownText.match(regex);
      return matches ? matches.length : 0;
    } catch {
      return 0;
    }
  }, [searchQuery, extractedMarkdownText]);

  const renderedHtml = useMemo(() => {
    if (!extractedMarkdownText) return "";
    try {
      let html = renderMarkdown(extractedMarkdownText);
      if (searchQuery.trim()) {
        const q = searchQuery.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`(?![^<]*>)(${q})`, "gi");
        html = html.replace(regex, `<mark class="wdm-search-highlight">$1</mark>`);
      }
      return html;
    } catch {
      return `<pre>${extractedMarkdownText}</pre>`;
    }
  }, [extractedMarkdownText, searchQuery]);

  const rawLines = useMemo(() => {
    if (!extractedMarkdownText) return [];
    return extractedMarkdownText.split("\n");
  }, [extractedMarkdownText]);

  const estimatedReadTime = useMemo(() => {
    const words = extractionRecord?.wordCount || (extractedMarkdownText ? extractedMarkdownText.trim().split(/\s+/).length : 0);
    if (!words) return "< 1 min read";
    const mins = Math.max(1, Math.round(words / 200));
    return `~${mins} min read`;
  }, [extractionRecord, extractedMarkdownText]);

  const handleCopyMarkdown = () => {
    if (!extractedMarkdownText) return;
    navigator.clipboard.writeText(extractedMarkdownText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    notify("Copied extracted Markdown to clipboard", "success");
  };

  const handleDownloadMarkdown = async () => {
    if (!extractedMarkdownText) return;
    const baseName = (fileName || mediaPath || "extracted-document").split(/[\\/]/).pop().replace(/\.[^/.]+$/, "");
    const downloadFilename = `${baseName}.extracted.md`;

    try {
      await runExport("markdown", {
        content: extractedMarkdownText,
        filename: downloadFilename,
        defaultFilename: downloadFilename,
        category: "document",
      });
      notify(`Exported "${downloadFilename}"`, "success");
    } catch {
      try {
        const blob = new Blob([extractedMarkdownText], { type: "text/markdown;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = downloadFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        notify(`Downloaded "${downloadFilename}"`, "success");
      } catch (err) {
        notify(`Failed to download: ${err.message || err}`, "error");
      }
    }
  };

  const handleReextract = async () => {
    if (reextracting) return;
    setReextracting(true);
    const target = mediaPath || fileName || "";
    try {
      notify(`Re-extracting text from "${fileName || target}"...`, "info");
      await forceReextract(target);
      const content = await getExtractedContent(target);
      setExtractedMarkdownText(content || "");
      notify("Document text re-extracted successfully", "success");
    } catch (err) {
      notify(`Re-extraction failed: ${err.message || err}`, "error");
    } finally {
      setReextracting(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", overflow: "hidden", background: "var(--surface-subtle)" }}>
      {/* Viewer Sub-Toolbar */}
      <div className="wdm-extracted-modal-toolbar">
        <div className="wdm-extracted-toolbar-left">
          <div className="wdm-view-toggle">
            <button
              type="button"
              className={`wdm-view-toggle-btn ${viewMode === "rendered" ? "active" : ""}`}
              onClick={() => setViewMode("rendered")}
            >
              <Eye size={12} />
              <span>Formatted Reading View</span>
            </button>
            <button
              type="button"
              className={`wdm-view-toggle-btn ${viewMode === "raw" ? "active" : ""}`}
              onClick={() => setViewMode("raw")}
            >
              <FileCode size={12} />
              <span>Markdown Source ({rawLines.length} lines)</span>
            </button>
          </div>

          {/* In-Document Search */}
          {extractedMarkdownText && (
            <div className="wdm-extracted-search-wrap">
              <Search size={14} className="wdm-extracted-search-icon" />
              <input
                type="text"
                className="wdm-extracted-search-input"
                placeholder="Search document..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <span className="wdm-extracted-search-match-count">
                  {searchMatchCount} {searchMatchCount === 1 ? "match" : "matches"}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="wdm-extracted-toolbar-right">
          {extractionRecord?.wordCount ? (
            <span className="wdm-extracted-stat-chip">
              <FileText size={12} />
              <span><strong>{extractionRecord.wordCount.toLocaleString()}</strong> words</span>
            </span>
          ) : null}
          {extractionRecord?.pageCount ? (
            <span className="wdm-extracted-stat-chip">
              <Layers size={12} />
              <span><strong>{extractionRecord.pageCount}</strong> {String(fileExtension || "").toLowerCase() === "pptx" ? "slides" : "pages"}</span>
            </span>
          ) : null}
          {extractionRecord?.contentHash ? (
            <span className="wdm-extracted-stat-chip" title={`SHA-256: ${extractionRecord.contentHash}`}>
              <Hash size={12} />
              <span style={{ fontFamily: "var(--font-mono, monospace)" }}>
                {extractionRecord.contentHash.substring(0, 8)}
              </span>
            </span>
          ) : null}

          <AppButton
            variant="secondary"
            disabled={!extractedMarkdownText || loading}
            onClick={handleDownloadMarkdown}
            title="Download extracted Markdown file (.md)"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <Download size={12} />
            <span>Download</span>
          </AppButton>

          <AppButton
            variant="secondary"
            disabled={!extractedMarkdownText || loading}
            onClick={handleCopyMarkdown}
            title="Copy extracted Markdown to clipboard"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            {copied ? <Check size={12} style={{ color: "var(--accent-solid)" }} /> : <Copy size={12} />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </AppButton>

          <AppButton
            variant="ghost"
            disabled={loading || reextracting}
            onClick={handleReextract}
            title="Re-run text extraction pipeline from file"
            style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
          >
            {reextracting ? (
              <Loader2 size={12} className="spin" />
            ) : (
              <Sparkles size={12} style={{ color: "var(--accent-solid)" }} />
            )}
            <span>Re-extract</span>
          </AppButton>
        </div>
      </div>

      {/* Main Viewport */}
      <div className="wdm-extracted-viewport">
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: "12px", color: "var(--text-muted)" }}>
            <Loader2 size={20} className="spin" style={{ color: "var(--accent-solid)" }} />
            <span style={{ fontSize: "13.5px", fontWeight: 500 }}>Extracting document structure and text...</span>
          </div>
        ) : extractedMarkdownText ? (
          viewMode === "rendered" ? (
            <div className="wdm-extracted-canvas-scroll">
              <div className="wdm-extracted-document-sheet">
                <div className="wdm-extracted-doc-hero">
                  <h1 className="wdm-extracted-hero-title">
                    {(fileName || mediaPath || "Document").split(/[\\/]/).pop().replace(/\.[^/.]+$/, "")}
                  </h1>
                  <div className="wdm-extracted-hero-pills">
                    <span className="wdm-extracted-hero-pill">
                      <CheckCircle2 size={12} style={{ color: "var(--accent-solid)" }} />
                      Extracted & Indexed
                    </span>
                    {extractionRecord?.pageCount ? (
                      <span className="wdm-extracted-hero-pill">
                        <Layers size={12} />
                        {extractionRecord.pageCount} {String(fileExtension || "").toLowerCase() === "pptx" ? "slides" : "pages"}
                      </span>
                    ) : null}
                    {extractionRecord?.wordCount ? (
                      <span className="wdm-extracted-hero-pill">
                        <FileText size={12} />
                        {extractionRecord.wordCount.toLocaleString()} words
                      </span>
                    ) : null}
                    <span className="wdm-extracted-hero-pill">
                      <Clock size={12} />
                      {estimatedReadTime}
                    </span>
                  </div>
                </div>

                <div
                  className="wdm-extracted-prose"
                  dangerouslySetInnerHTML={{ __html: renderedHtml }}
                />
              </div>
            </div>
          ) : (
            <div className="wdm-extracted-raw-wrapper">
              <div className="wdm-extracted-raw-code-pane">
                <pre className="wdm-extracted-raw-pre">
                  {rawLines.map((line, idx) => (
                    <div key={`raw-line-${idx}`} className="wdm-extracted-raw-line">
                      <span className="wdm-extracted-line-num" aria-hidden="true">{idx + 1}</span>
                      <span className="wdm-extracted-line-content">
                        {searchQuery.trim() && line ? (
                          line.split(new RegExp(`(${searchQuery.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi")).map((part, pIdx) =>
                            part.toLowerCase() === searchQuery.trim().toLowerCase() ? (
                              <mark key={pIdx} className="wdm-search-highlight">{part}</mark>
                            ) : (
                              part
                            )
                          )
                        ) : (
                          line || " "
                        )}
                      </span>
                    </div>
                  ))}
                </pre>
              </div>
            </div>
          )
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: "16px", textAlign: "center", padding: "40px 20px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "52px",
                height: "52px",
                borderRadius: "var(--radius-lg)",
                background: "var(--surface-muted)",
                color: "var(--text-muted)",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
              }}
            >
              <FileText size={20} />
            </div>
            <div style={{ maxWidth: "420px" }}>
              <p style={{ margin: "0 0 6px 0", fontSize: "15px", fontWeight: 600, color: "var(--text-strong)" }}>
                No Cached Text Available
              </p>
              <p style={{ margin: 0, fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                {extractionRecord?.status === "encrypted"
                  ? "This document is password-protected and cannot be extracted without decryption credentials."
                  : extractionRecord?.status === "empty"
                  ? "This file appears to be a scanned bitmap or empty archive with no embedded OCR text layer."
                  : "This document has not been indexed yet, or extraction is pending in the background worker."}
              </p>
            </div>
            <AppButton
              variant="primary"
              disabled={loading || reextracting}
              onClick={handleReextract}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginTop: "4px" }}
            >
              {reextracting ? (
                <Loader2 size={14} className="spin" />
              ) : (
                <Sparkles size={14} />
              )}
              <span>Extract Document Text Now</span>
            </AppButton>
          </div>
        )}
      </div>

      {/* Footer Status Bar */}
      <div className="wdm-extracted-modal-footer">
        <div className="wdm-extracted-footer-left">
          <span className="wdm-extracted-footer-path" title={mediaPath || fileName}>
            Location: {mediaPath || fileName}
          </span>
          <span>•</span>
          <span>Store: SQLite & Disk Cache</span>
        </div>
        <div className="wdm-extracted-footer-right">
          <span>{estimatedReadTime}</span>
          <span>•</span>
          <span>{extractedMarkdownText ? `${extractedMarkdownText.length.toLocaleString()} characters` : "0 characters"}</span>
        </div>
      </div>
    </div>
  );
}
