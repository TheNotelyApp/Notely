import { useEffect, useRef, useState } from "react";

/**
 * Floating recording bar overlay.
 * Props:
 *   mediaRecorder  - MediaRecorder instance (already started)
 *   audioTrack     - optional MediaStreamTrack for mic mute toggle
 *   onStop(blob)   - called with the recorded Blob when user clicks Stop
 *   onCancel()     - called when user clicks Cancel (no blob)
 */
export function ScreenRecordingBar({ mediaRecorder, audioTrack, onStop, onCancel }) {
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const chunksRef = useRef([]);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!mediaRecorder) return;

    chunksRef.current = [];

    const onData = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    mediaRecorder.addEventListener("dataavailable", onData);

    intervalRef.current = setInterval(() => {
      if (mediaRecorder.state === "recording") {
        setElapsed((s) => s + 1);
      }
    }, 1000);

    return () => {
      mediaRecorder.removeEventListener("dataavailable", onData);
      clearInterval(intervalRef.current);
    };
  }, [mediaRecorder]);

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  function handlePauseResume() {
    if (!mediaRecorder) return;
    if (mediaRecorder.state === "recording") {
      mediaRecorder.pause();
      setPaused(true);
    } else if (mediaRecorder.state === "paused") {
      mediaRecorder.resume();
      setPaused(false);
    }
  }

  function handleMicToggle() {
    if (!audioTrack) return;
    audioTrack.enabled = !audioTrack.enabled;
    setMicEnabled(audioTrack.enabled);
  }

  function handleStop() {
    if (!mediaRecorder) return;
    clearInterval(intervalRef.current);
    mediaRecorder.addEventListener(
      "stop",
      () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        onStop?.(blob);
      },
      { once: true }
    );
    mediaRecorder.stop();
  }

  function handleCancel() {
    if (!mediaRecorder) return;
    clearInterval(intervalRef.current);
    mediaRecorder.addEventListener("stop", () => onCancel?.(), { once: true });
    mediaRecorder.stop();
  }

  return (
    <div
      id="screen-recording-bar"
      aria-label="Screen recording controls"
      style={{
        position: "fixed",
        bottom: "32px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "10px 18px",
        background: "rgba(15, 20, 30, 0.92)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: "999px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)",
        color: "#f8fafc",
        fontFamily: "var(--font-ui, system-ui, sans-serif)",
        fontSize: "13px",
        fontWeight: 500,
        userSelect: "none",
      }}
    >
      <style>{`
        @keyframes rec-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        #screen-recording-bar button {
          background: transparent;
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 6px;
          color: #e2e8f0;
          cursor: pointer;
          padding: 4px 10px;
          font-size: 12px;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 4px;
          transition: background 0.15s, border-color 0.15s;
          white-space: nowrap;
        }
        #screen-recording-bar button:hover {
          background: rgba(255,255,255,0.1);
          border-color: rgba(255,255,255,0.3);
        }
        #screen-recording-bar .rec-stop-btn {
          background: rgba(239, 68, 68, 0.2);
          border-color: rgba(239, 68, 68, 0.4);
          color: #fca5a5;
        }
        #screen-recording-bar .rec-stop-btn:hover {
          background: rgba(239, 68, 68, 0.35);
        }
      `}</style>

      {/* Recording dot + timer */}
      <span style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: "56px" }}>
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
        <span style={{ fontVariantNumeric: "tabular-nums", letterSpacing: "0.5px" }}>
          {formatTime(elapsed)}
        </span>
      </span>

      <span style={{ width: "1px", height: "20px", background: "rgba(255,255,255,0.12)" }} aria-hidden="true" />

      {/* Pause / Resume */}
      <button
        type="button"
        title={paused ? "Resume recording" : "Pause recording"}
        aria-label={paused ? "Resume recording" : "Pause recording"}
        onClick={handlePauseResume}
      >
        {paused ? "▶ Resume" : "⏸ Pause"}
      </button>

      {/* Mic toggle — only shown if mic track available */}
      {audioTrack && (
        <button
          type="button"
          title={micEnabled ? "Mute microphone" : "Unmute microphone"}
          aria-label={micEnabled ? "Mute microphone" : "Unmute microphone"}
          onClick={handleMicToggle}
        >
          {micEnabled ? "🎙 Mic" : "🔇 Muted"}
        </button>
      )}

      <span style={{ width: "1px", height: "20px", background: "rgba(255,255,255,0.12)" }} aria-hidden="true" />

      {/* Stop & Save */}
      <button
        type="button"
        className="rec-stop-btn"
        title="Stop and save recording"
        aria-label="Stop and save recording"
        onClick={handleStop}
      >
        ⏹ Stop &amp; Save
      </button>

      {/* Cancel */}
      <button
        type="button"
        title="Cancel recording"
        aria-label="Cancel recording"
        onClick={handleCancel}
        style={{ opacity: 0.6 }}
      >
        ✕ Cancel
      </button>
    </div>
  );
}
