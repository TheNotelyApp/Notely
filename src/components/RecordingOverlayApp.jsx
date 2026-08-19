import { useEffect, useState } from "react";
import { Play, Pause, Mic, MicOff, Square, X, GripVertical } from "lucide-react";

/**
 * Floating draggable overlay window component.
 * Loaded when window.location.hash === "#recording-overlay".
 */
export function RecordingOverlayApp() {
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hasMic, setHasMic] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);

  useEffect(() => {
    // Listen to state updates pushed from main window
    const api = window.notesApi;
    if (!api?.onRecordingState) return;

    const cleanup = api.onRecordingState((state) => {
      if (!state) return;
      if (typeof state.elapsed === "number") setElapsed(state.elapsed);
      if (typeof state.paused === "boolean") setPaused(state.paused);
      if (typeof state.hasMic === "boolean") setHasMic(state.hasMic);
      if (typeof state.micEnabled === "boolean") setMicEnabled(state.micEnabled);
    });

    return () => cleanup();
  }, []);

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  function sendAction(action) {
    window.notesApi?.sendRecordingAction?.(action);
  }

  return (
    <div
      id="recording-overlay-root"
      aria-label="Screen recording controls"
      style={{
        width: "100vw",
        height: "100vh",
        margin: 0,
        padding: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
        overflow: "hidden",
        userSelect: "none",
      }}
    >
      <style>{`
        body, html {
          background: transparent !important;
          margin: 0;
          padding: 0;
          overflow: hidden;
        }
        @keyframes rec-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
        .overlay-drag-pill {
          -webkit-app-region: drag;
          cursor: grab;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: rgba(15, 23, 42, 0.92);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 999px;
          box-shadow: 0 12px 36px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.08);
          color: #f8fafc;
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 13px;
        }
        .overlay-drag-pill:active {
          cursor: grabbing;
        }
        .overlay-drag-pill button {
          -webkit-app-region: no-drag;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 8px;
          color: #f8fafc;
          cursor: pointer;
          padding: 5px 10px;
          font-size: 12px;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 5px;
          transition: background 0.15s, border-color 0.15s;
          white-space: nowrap;
        }
        .overlay-drag-pill button:hover {
          background: rgba(255, 255, 255, 0.18);
          border-color: rgba(255, 255, 255, 0.3);
        }
        .overlay-drag-pill .rec-stop-btn {
          background: rgba(239, 68, 68, 0.25);
          border-color: rgba(239, 68, 68, 0.5);
          color: #fca5a5;
        }
        .overlay-drag-pill .rec-stop-btn:hover {
          background: rgba(239, 68, 68, 0.45);
        }
      `}</style>

      <div className="overlay-drag-pill">
        {/* Drag handle icon */}
        <GripVertical size={14} style={{ opacity: 0.4, flexShrink: 0 }} />

        {/* Recording dot + timer */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: "52px" }}>
          <span
            aria-hidden="true"
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: paused ? "#94a3b8" : "#ef4444",
              flexShrink: 0,
              animation: paused ? "none" : "rec-pulse 1.4s ease-in-out infinite",
            }}
          />
          <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600, letterSpacing: "0.5px" }}>
            {formatTime(elapsed)}
          </span>
        </div>

        <span style={{ width: "1px", height: "18px", background: "rgba(255,255,255,0.15)" }} aria-hidden="true" />

        {/* Pause / Resume */}
        <button
          type="button"
          title={paused ? "Resume recording" : "Pause recording"}
          aria-label={paused ? "Resume recording" : "Pause recording"}
          onClick={() => sendAction("toggle-pause")}
        >
          {paused ? <Play size={14} /> : <Pause size={14} />}
          {paused ? "Resume" : "Pause"}
        </button>

        {/* Mic toggle */}
        {hasMic && (
          <button
            type="button"
            title={micEnabled ? "Mute microphone" : "Unmute microphone"}
            aria-label={micEnabled ? "Mute microphone" : "Unmute microphone"}
            onClick={() => sendAction("toggle-mic")}
          >
            {micEnabled ? <Mic size={14} /> : <MicOff size={14} />}
            {micEnabled ? "Mic" : "Muted"}
          </button>
        )}

        <span style={{ width: "1px", height: "18px", background: "rgba(255,255,255,0.15)" }} aria-hidden="true" />

        {/* Stop & Save */}
        <button
          type="button"
          className="rec-stop-btn"
          title="Stop and save recording"
          aria-label="Stop and save recording"
          onClick={() => sendAction("stop")}
        >
          <Square size={14} fill="currentColor" /> Stop
        </button>

        {/* Cancel */}
        <button
          type="button"
          title="Cancel recording"
          aria-label="Cancel recording"
          onClick={() => sendAction("cancel")}
          style={{ opacity: 0.6 }}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
