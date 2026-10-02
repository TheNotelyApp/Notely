import { useState, useMemo } from "react";
import {
  MessageSquareText,
  Copy,
  Check,
  Search,
  Sparkles,
  ListFilter,
  Clock,
  FileDown,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import AppButton from "../AppButton";

function formatSecondsToTimestamp(seconds) {
  if (typeof seconds !== "number" || isNaN(seconds)) return "00:00";
  const s = Math.floor(seconds);
  const mins = Math.floor(s / 60);
  const remainingSecs = s % 60;
  return `${String(mins).padStart(2, "0")}:${String(remainingSecs).padStart(2, "0")}`;
}

export function TranscriptViewer({
  content,
  dataUrl,
  fileName = "transcript.json",
  currentTime = null,
  showHeader = false,
  onSeek = null,
  onInsertIntoNote = null,
  onNotify = null,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedType, setCopiedType] = useState(null);

  // Parse transcript content
  const transcriptData = useMemo(() => {
    if (content && typeof content === "object") return content;

    let rawString = "";
    if (typeof content === "string") {
      rawString = content;
    } else if (typeof dataUrl === "string") {
      if (dataUrl.startsWith("data:")) {
        try {
          const base64 = dataUrl.split(",")[1];
          rawString = decodeURIComponent(escape(atob(base64)));
        } catch {
          try {
            rawString = atob(dataUrl.split(",")[1]);
          } catch {
            rawString = dataUrl;
          }
        }
      } else {
        rawString = dataUrl;
      }
    }

    if (!rawString) return null;

    try {
      return JSON.parse(rawString);
    } catch {
      return { text: rawString };
    }
  }, [content, dataUrl]);

  const summary = transcriptData?.summary;
  const rawText = transcriptData?.fullText || transcriptData?.text || "";
  const segments = Array.isArray(transcriptData?.segments) ? transcriptData.segments : [];

  const keyPoints = Array.isArray(summary?.keyPoints) ? summary.keyPoints : [];
  const actionItems = Array.isArray(summary?.actionItems) ? summary.actionItems : [];
  const hasSummary = Boolean(summary && (typeof summary === "string" || keyPoints.length > 0 || actionItems.length > 0));

  // Filter segments by search
  const filteredSegments = useMemo(() => {
    if (!searchQuery.trim()) return segments;
    const q = searchQuery.toLowerCase().trim();
    return segments.filter((seg) => (seg.text || "").toLowerCase().includes(q));
  }, [segments, searchQuery]);

  const handleCopy = (text, type, label) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
    onNotify?.(`${label} copied to clipboard`, "success");
  };

  const formattedMarkdown = useMemo(() => {
    const parts = [`# Speech-to-Text Transcript: ${fileName.replace(/\.json$/i, "")}\n`];
    if (hasSummary) {
      parts.push("## Summary");
      if (typeof summary === "string") {
        parts.push(summary);
      }
      if (keyPoints.length > 0) {
        parts.push("\n### Key Points");
        keyPoints.forEach((pt) => parts.push(`- ${pt}`));
      }
      if (actionItems.length > 0) {
        parts.push("\n### Action Items");
        actionItems.forEach((act) => parts.push(`- [ ] ${act}`));
      }
      parts.push("\n---\n");
    }
    parts.push("## Transcript");
    if (segments.length > 0) {
      segments.forEach((seg) => {
        parts.push(`**[${formatSecondsToTimestamp(seg.start)}]** ${seg.text}`);
      });
    } else {
      parts.push(rawText);
    }
    return parts.join("\n");
  }, [fileName, hasSummary, summary, keyPoints, actionItems, segments, rawText]);

  if (!transcriptData) {
    return (
      <div className="transcript-empty-state" style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)" }}>
        <MessageSquareText size={20} style={{ opacity: 0.5, marginBottom: "8px" }} />
        <div>No transcript content available</div>
      </div>
    );
  }

  return (
    <div className="transcript-viewer-container" style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", overflow: "hidden", background: "var(--surface-bg)" }}>
      {/* Optional Standalone Header Bar */}
      {showHeader && (
        <div className="transcript-viewer-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderBottom: "1px solid var(--border-default)", background: "var(--surface-elevated)", gap: "12px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "28px", height: "28px", borderRadius: "var(--radius-default)", background: "rgba(14, 165, 233, 0.15)", color: "#38bdf8", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MessageSquareText size={16} />
            </div>
            <div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-strong)" }}>{fileName}</div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                {segments.length > 0 ? `${segments.length} segments • Speech-to-Text` : "Transcript"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Body */}
      <div className="transcript-viewer-body" style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "14px" }}>
        {/* Top Control Bar: Search on left, Copy & Export actions on right */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
          {segments.length > 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--surface-elevated)", padding: "6px 10px", borderRadius: "var(--radius-default)", border: "1px solid var(--border-default)", flex: 1, minWidth: "200px" }}>
              <Search size={14} style={{ color: "var(--text-muted)" }} />
              <input
                type="text"
                placeholder="Search words or phrases in transcript…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--text-primary)", fontSize: "12px" }}
              />
              <span style={{ fontSize: "11px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                {searchQuery ? `${filteredSegments.length} of ${segments.length}` : `${segments.length} segments`}
              </span>
            </div>
          ) : (
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Speech-to-Text Transcript</div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "auto" }}>
            {onInsertIntoNote && (
              <AppButton variant="primary" onClick={() => onInsertIntoNote(formattedMarkdown)}>
                <FileDown size={14} />
                <span>Insert in Note</span>
              </AppButton>
            )}

            <AppButton
              variant="small"
              onClick={() => handleCopy(rawText || JSON.stringify(transcriptData, null, 2), "raw", "Full text")}
              title="Copy Raw Transcript Text"
            >
              {copiedType === "raw" ? <Check size={14} style={{ color: "#10b981" }} /> : <Copy size={14} />}
              <span>{copiedType === "raw" ? "Copied" : "Copy Text"}</span>
            </AppButton>

            <AppButton
              variant="small"
              onClick={() => handleCopy(formattedMarkdown, "markdown", "Markdown transcript")}
              title="Copy Formatted Markdown"
            >
              {copiedType === "markdown" ? <Check size={14} style={{ color: "#10b981" }} /> : <Copy size={14} />}
              <span>{copiedType === "markdown" ? "Copied" : "Copy Markdown"}</span>
            </AppButton>
          </div>
        </div>
        {/* Executive Summary Card */}
        {hasSummary && (
          <div
            className="transcript-summary-card"
            style={{
              padding: "14px 16px",
              background: "rgba(14, 165, 233, 0.08)",
              border: "1px solid rgba(14, 165, 233, 0.25)",
              borderRadius: "var(--radius-default, 8px)",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#38bdf8", fontWeight: 700, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                <Sparkles size={14} />
                <span>AI Summary & Highlights</span>
              </div>
              <AppButton
                variant="small"
                onClick={() => handleCopy(typeof summary === "string" ? summary : JSON.stringify(summary, null, 2), "summary", "Summary")}
                title="Copy AI summary text"
              >
                {copiedType === "summary" ? <Check size={12} style={{ color: "#10b981" }} /> : <Copy size={12} />}
                <span>{copiedType === "summary" ? "Copied" : "Copy Summary"}</span>
              </AppButton>
            </div>

            {typeof summary === "string" && summary && (
              <p style={{ margin: 0, fontSize: "12px", lineHeight: 1.5, color: "var(--text-secondary)" }}>
                {summary}
              </p>
            )}

            {keyPoints.length > 0 && (
              <div>
                <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>
                  Key Points:
                </span>
                <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "12px", lineHeight: 1.45, color: "var(--text-primary)" }}>
                  {keyPoints.map((pt, idx) => (
                    <li key={idx} style={{ marginBottom: "3px" }}>{pt}</li>
                  ))}
                </ul>
              </div>
            )}

            {actionItems.length > 0 && (
              <div>
                <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>
                  Action Items:
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {actionItems.map((act, idx) => (
                    <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "6px", fontSize: "12px", color: "var(--text-primary)" }}>
                      <CheckCircle2 size={14} style={{ color: "#10b981", marginTop: "2px", flexShrink: 0 }} />
                      <span>{act}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}


        {/* Timestamp Segments or Raw Text */}
        {segments.length > 0 ? (
          <div className="transcript-segments-list" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {filteredSegments.map((seg, idx) => {
              const isCurrent = typeof currentTime === "number" && currentTime >= (seg.start || 0) && currentTime < (seg.end || seg.start + 5);

              return (
                <div
                  key={idx}
                  className={`transcript-segment-row ${isCurrent ? "is-active" : ""}`}
                  onClick={() => {
                    if (typeof onSeek === "function" && typeof seg.start === "number") {
                      onSeek(seg.start);
                    }
                  }}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    padding: "8px 10px",
                    borderRadius: "var(--radius-default)",
                    background: isCurrent ? "rgba(56, 189, 248, 0.14)" : "var(--surface-elevated)",
                    border: isCurrent ? "1px solid var(--accent-solid, #38bdf8)" : "1px solid var(--border-soft)",
                    cursor: onSeek ? "pointer" : "default",
                    transition: "background 0.15s ease, border-color 0.15s ease",
                  }}
                >
                  <button
                    className="transcript-time-badge"
                    type="button"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "3px",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      background: "rgba(56, 189, 248, 0.12)",
                      color: "#38bdf8",
                      fontSize: "11px",
                      fontWeight: 600,
                      border: "none",
                      cursor: onSeek ? "pointer" : "default",
                      fontVariantNumeric: "tabular-nums",
                      flexShrink: 0,
                    }}
                    title={onSeek ? "Click to seek audio to this time" : undefined}
                  >
                    <Clock size={12} />
                    <span>{formatSecondsToTimestamp(seg.start || 0)}</span>
                  </button>

                  <div style={{ flex: 1, fontSize: "12px", lineHeight: 1.45, color: isCurrent ? "var(--text-strong)" : "var(--text-primary)" }}>
                    {seg.text}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: "12px", background: "var(--surface-elevated)", borderRadius: "var(--radius-default)", border: "1px solid var(--border-soft)", fontSize: "12px", lineHeight: 1.5, color: "var(--text-primary)", whiteSpace: "pre-wrap" }}>
            {rawText || "No text content available in transcript."}
          </div>
        )}
      </div>
    </div>
  );
}

export default TranscriptViewer;
