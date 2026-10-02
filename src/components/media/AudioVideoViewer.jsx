import { useState, useRef, useEffect } from "react";
import { Volume2, VolumeX, MessageSquareText, PanelRightClose, PanelRightOpen } from "lucide-react";
import { TranscriptViewer } from "./TranscriptViewer";

export function AudioVideoViewer({
  src,
  mediaType,
  fileName,
  transcriptData = null,
  onSeek = null,
  onNotify = null,
}) {
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [transcriptOpen, setTranscriptOpen] = useState(Boolean(transcriptData));

  const audioRef = useRef(null);
  const videoRef = useRef(null);

  const activeMediaRef = mediaType === "video" ? videoRef : audioRef;

  const handleTimeUpdate = () => {
    if (activeMediaRef.current) {
      setCurrentTime(activeMediaRef.current.currentTime);
    }
  };

  const handleSeek = (seconds) => {
    if (activeMediaRef.current && typeof seconds === "number") {
      activeMediaRef.current.currentTime = seconds;
      if (activeMediaRef.current.paused) {
        activeMediaRef.current.play().catch(() => {});
      }
    }
    onSeek?.(seconds);
  };

  const handleSpeedChange = (rate) => {
    setPlaybackRate(rate);
    if (activeMediaRef.current) {
      activeMediaRef.current.playbackRate = rate;
    }
  };

  useEffect(() => {
    if (activeMediaRef.current) {
      activeMediaRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate, activeMediaRef]);

  const hasTranscript = Boolean(transcriptData);

  return (
    <div
      className="media-preview-av-layout"
      style={{
        display: "flex",
        flexDirection: "row",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Player Main Area */}
      <div
        className="media-preview-player-pane"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          gap: "16px",
          overflowY: "auto",
        }}
      >
        {mediaType === "video" ? (
          <div className="media-preview-video-container" style={{ width: "100%", maxWidth: "800px", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <video
              ref={videoRef}
              controls
              autoPlay={false}
              src={src}
              onTimeUpdate={handleTimeUpdate}
              style={{ width: "100%", maxHeight: "60vh", borderRadius: "var(--radius-default, 8px)", background: "#000" }}
            >
              <source src={src} />
              Your browser does not support the video tag.
            </video>
          </div>
        ) : (
          <div className="media-preview-audio-container" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px", width: "100%", maxWidth: "520px" }}>
            <div className="audio-visualizer" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
              <div className="audio-icon" style={{ fontSize: "40px" }}>🎵</div>
              <div className="audio-info" style={{ textAlign: "center" }}>
                <div className="audio-filename" style={{ fontWeight: 600, fontSize: "14px", color: "var(--text-strong)" }}>{fileName}</div>
              </div>
            </div>

            <audio
              ref={audioRef}
              controls
              src={src}
              muted={isMuted}
              onTimeUpdate={handleTimeUpdate}
              style={{ width: "100%", maxWidth: "500px" }}
            >
              <source src={src} />
              Your browser does not support the audio tag.
            </audio>
          </div>
        )}

        {/* Player Controls Bar: Playback speed + Mute + Transcript toggle */}
        <div
          className="media-player-extra-controls"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            background: "var(--surface-card, #1e293b)",
            padding: "6px 14px",
            borderRadius: "999px",
            border: "1px solid var(--border-default)",
          }}
        >
          {/* Playback speed selector */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px" }}>
            <span style={{ color: "var(--text-muted)", marginRight: "2px" }}>Speed:</span>
            {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
              <button
                key={rate}
                className="btn btn-tertiary"
                type="button"
                onClick={() => handleSpeedChange(rate)}
                style={{
                  padding: "1px 6px",
                  fontSize: "11px",
                  height: "22px",
                  borderRadius: "4px",
                  background: playbackRate === rate ? "var(--accent-solid, #38bdf8)" : "transparent",
                  color: playbackRate === rate ? "#ffffff" : "var(--text-secondary)",
                  fontWeight: playbackRate === rate ? 700 : 400,
                }}
              >
                {rate}x
              </button>
            ))}
          </div>

          <div style={{ width: "1px", height: "14px", background: "var(--border-default)" }} />

          {/* Mute button */}
          <button
            className="btn btn-tertiary"
            type="button"
            onClick={() => {
              setIsMuted(!isMuted);
              if (activeMediaRef.current) {
                activeMediaRef.current.muted = !isMuted;
              }
            }}
            style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", height: "22px", padding: "0 6px" }}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            <span>{isMuted ? "Muted" : "Mute"}</span>
          </button>

          {/* Transcript toggle button if transcript is available */}
          {hasTranscript && (
            <>
              <div style={{ width: "1px", height: "14px", background: "var(--border-default)" }} />
              <button
                className="btn btn-tertiary"
                type="button"
                onClick={() => setTranscriptOpen(!transcriptOpen)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "11px",
                  height: "22px",
                  padding: "0 8px",
                  background: transcriptOpen ? "rgba(56, 189, 248, 0.15)" : "transparent",
                  color: transcriptOpen ? "#38bdf8" : "var(--text-secondary)",
                  fontWeight: transcriptOpen ? 600 : 400,
                }}
              >
                <MessageSquareText size={14} />
                <span>Transcript</span>
                {transcriptOpen ? <PanelRightClose size={12} /> : <PanelRightOpen size={12} />}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Synchronized Transcript Drawer */}
      {hasTranscript && transcriptOpen && (
        <div
          className="media-preview-transcript-drawer"
          style={{
            width: "360px",
            minWidth: "300px",
            height: "100%",
            borderLeft: "1px solid var(--border-default)",
            background: "var(--surface-card, #1e293b)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <TranscriptViewer
            content={transcriptData}
            fileName={`${fileName.replace(/\.[^/.]+$/, "")}_transcript.json`}
            currentTime={currentTime}
            onSeek={handleSeek}
            onNotify={onNotify}
          />
        </div>
      )}
    </div>
  );
}

export default AudioVideoViewer;
