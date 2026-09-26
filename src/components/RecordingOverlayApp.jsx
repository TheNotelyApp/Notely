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
  const [finishing, setFinishing] = useState(false);

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

  // Local ticker fallback to keep elapsed time advancing smoothly
  useEffect(() => {
    if (paused || finishing) return;
    const timer = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [paused, finishing]);

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
          -webkit-app-region: no-drag;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: rgba(15, 23, 42, 0.94);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 999px;
          box-shadow: 0 12px 36px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1);
          color: #f8fafc;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 13px;
        }
        .overlay-drag-handle {
          -webkit-app-region: drag;
          cursor: grab;
          display: flex;
          align-items: center;
          gap: 6px;
          user-select: none;
        }
        .overlay-drag-handle:active {
          cursor: grabbing;
        }
        .overlay-drag-pill button {
          -webkit-app-region: no-drag !important;
          pointer-events: auto !important;
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
          transition: background 0.15s, border-color 0.15s, transform 0.1s;
          white-space: nowrap;
        }
        .overlay-drag-pill button * {
          pointer-events: none !important;
        }
        .overlay-drag-pill button:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.2);
          border-color: rgba(255, 255, 255, 0.35);
        }
        .overlay-drag-pill button:active:not(:disabled) {
          transform: scale(0.96);
        }
        .overlay-drag-pill button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }
        .overlay-drag-pill .rec-stop-btn {
          background: rgba(239, 68, 68, 0.25);
          border-color: rgba(239, 68, 68, 0.5);
          color: #fca5a5;
        }
        .overlay-drag-pill .rec-stop-btn:hover:not(:disabled) {
          background: rgba(239, 68, 68, 0.45);
        }
      `}</style>

      <div className="overlay-drag-pill">
        {/* Dedicated drag handle (grip + timer) */}
        <div className="overlay-drag-handle" title="Drag to reposition">
          <GripVertical size={14} style={{ opacity: 0.5, flexShrink: 0 }} />
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
        </div>

        <span style={{ width: "1px", height: "18px", background: "rgba(255,255,255,0.15)" }} aria-hidden="true" />

        {/* Pause / Resume */}
        <button
          type="button"
          disabled={finishing}
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
            disabled={finishing}
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
          disabled={finishing}
          title="Stop and save recording"
          aria-label="Stop and save recording"
          onClick={() => {
            setFinishing(true);
            sendAction("stop");
          }}
        >
          <Square size={14} fill="currentColor" /> {finishing ? "Saving..." : "Stop"}
        </button>

        {/* Cancel */}
        <button
          type="button"
          disabled={finishing}
          title="Cancel recording"
          aria-label="Cancel recording"
          onClick={() => {
            setFinishing(true);
            sendAction("cancel");
          }}
          style={{ opacity: 0.6 }}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
