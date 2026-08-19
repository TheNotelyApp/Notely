import { useState } from "react";
import { Monitor, Layout, Check, X, Mic, MicOff, Video } from "lucide-react";
import OverlayDialog from "./OverlayDialog";
import AppButton from "./AppButton";
import AppIconButton from "./AppIconButton";

/**
 * Modal to pick screen or window for recording following Notely app standards.
 * Props:
 *   sources     - list of { id, name, thumbnail, appIcon, isScreen }
 *   onSelect(source, { recordMic }) - called when user confirms source
 *   onClose()   - called when modal is dismissed
 */
export function ScreenSourcePickerModal({ sources = [], onSelect, onClose }) {
  const [activeTab, setActiveTab] = useState("screens"); // "screens" | "windows"
  const [selectedId, setSelectedId] = useState(() => {
    const defaultScreen = sources.find((s) => s.isScreen);
    return defaultScreen ? defaultScreen.id : sources[0]?.id || "";
  });
  const [recordMic, setRecordMic] = useState(true);

  const screens = sources.filter((s) => s.isScreen);
  const windows = sources.filter((s) => !s.isScreen);
  const displayedSources = activeTab === "screens" ? screens : windows;
  const selectedSource = sources.find((s) => s.id === selectedId);

  return (
    <OverlayDialog
      open={true}
      onClose={onClose}
      ariaLabel="Select What to Record"
      size="lg"
      closeOnClickOutside
    >
      {/* Header */}
      <div className="overlay-dialog-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h3 className="overlay-dialog-title" style={{ margin: 0, display: "flex", alignItems: "center", gap: "6px" }}>
            <Video size={18} style={{ color: "var(--accent, #0ea5e9)" }} />
            Select What to Record
          </h3>
          <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--text-muted)" }}>
            Choose an entire screen or a specific application window
          </p>
        </div>
        <AppIconButton onClick={onClose} title="Close (Esc)">
          <X size={16} />
        </AppIconButton>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", margin: "14px 0 10px" }}>
        <button
          type="button"
          onClick={() => setActiveTab("screens")}
          className={activeTab === "screens" ? "primary-button" : "small-button"}
          style={{ height: "30px", minHeight: "30px", fontSize: "12px" }}
        >
          <Monitor size={14} style={{ marginRight: "4px" }} /> Screens ({screens.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("windows")}
          className={activeTab === "windows" ? "primary-button" : "small-button"}
          style={{ height: "30px", minHeight: "30px", fontSize: "12px" }}
        >
          <Layout size={14} style={{ marginRight: "4px" }} /> Windows ({windows.length})
        </button>
      </div>

      {/* Source Cards Grid */}
      <div
        style={{
          maxHeight: "52vh",
          overflowY: "auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: "12px",
          padding: "4px 2px",
          margin: "8px 0 16px",
        }}
      >
        {displayedSources.map((source) => {
          const isSelected = source.id === selectedId;
          return (
            <button
              key={source.id}
              type="button"
              onClick={() => setSelectedId(source.id)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "stretch",
                padding: "8px",
                borderRadius: "var(--radius-lg, 8px)",
                border: isSelected
                  ? "2px solid var(--accent, #0ea5e9)"
                  : "1px solid var(--border-soft)",
                background: isSelected
                  ? "var(--accent-glow, rgba(14, 165, 233, 0.12))"
                  : "var(--surface-muted, rgba(255,255,255,0.02))",
                cursor: "pointer",
                textAlign: "left",
                position: "relative",
                transition: "all var(--motion-fast, 0.15s ease)",
                outline: "none",
              }}
            >
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  aspectRatio: "16/9",
                  borderRadius: "var(--radius-md, 6px)",
                  overflow: "hidden",
                  background: "#000",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "8px",
                }}
              >
                {source.thumbnail ? (
                  <img
                    src={source.thumbnail}
                    alt={source.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : source.isScreen ? (
                  <Monitor size={20} style={{ color: "var(--text-muted)", opacity: 0.5 }} />
                ) : (
                  <Layout size={20} style={{ color: "var(--text-muted)", opacity: 0.5 }} />
                )}
                {isSelected && (
                  <div
                    style={{
                      position: "absolute",
                      top: "6px",
                      right: "6px",
                      background: "var(--accent, #0ea5e9)",
                      color: "#fff",
                      borderRadius: "50%",
                      width: "20px",
                      height: "20px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Check size={14} />
                  </div>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                {source.appIcon ? (
                  <img src={source.appIcon} alt="" style={{ width: "14px", height: "14px", flexShrink: 0 }} />
                ) : source.isScreen ? (
                  <Monitor size={14} style={{ color: "var(--accent, #0ea5e9)", flexShrink: 0 }} />
                ) : (
                  <Layout size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                )}
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 500,
                    color: isSelected ? "var(--app-text)" : "var(--text-muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {source.name || "Untitled Window"}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div
        className="overlay-dialog-actions"
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
      >
        <AppButton
          variant="small"
          onClick={() => setRecordMic((v) => !v)}
          title={recordMic ? "Mute microphone during recording" : "Unmute microphone during recording"}
        >
          {recordMic ? <Mic size={14} style={{ marginRight: "4px" }} /> : <MicOff size={14} style={{ marginRight: "4px" }} />}
          {recordMic ? "Mic: ON" : "Mic: OFF"}
        </AppButton>

        <div style={{ display: "flex", gap: "8px" }}>
          <AppButton variant="small" onClick={onClose}>
            <X size={14} style={{ marginRight: "4px" }} />
            Cancel
          </AppButton>
          <AppButton
            variant="primary"
            disabled={!selectedSource}
            onClick={() => {
              if (selectedSource) onSelect?.(selectedSource, { recordMic });
            }}
          >
            <Video size={14} style={{ marginRight: "4px" }} />
            Start Recording
          </AppButton>
        </div>
      </div>
    </OverlayDialog>
  );
}

export default ScreenSourcePickerModal;

