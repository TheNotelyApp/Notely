import { useState, useRef } from "react";
import { Volume2, VolumeX } from "lucide-react";

export function AudioVideoViewer({ src, mediaType, fileName }) {
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef(null);
  const videoRef = useRef(null);

  if (mediaType === "video") {
    return (
      <div className="media-preview-video-container">
        <video
          ref={videoRef}
          controls
          autoPlay={false}
          src={src}
          style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: "6px" }}
        >
          <source src={src} />
          Your browser does not support the video tag.
        </video>
      </div>
    );
  }

  return (
    <div className="media-preview-audio-container">
      <div className="audio-visualizer">
        <div className="audio-icon">🎵</div>
        <div className="audio-info">
          <div className="audio-filename">{fileName}</div>
        </div>
      </div>
      <audio
        ref={audioRef}
        controls
        src={src}
        muted={isMuted}
        style={{ width: "100%", maxWidth: "500px" }}
      >
        <source src={src} />
        Your browser does not support the audio tag.
      </audio>
      <button
        className="audio-mute-button"
        type="button"
        onClick={() => {
          setIsMuted(!isMuted);
          if (audioRef.current) {
            audioRef.current.muted = !isMuted;
          }
        }}
        data-tooltip={isMuted ? "Unmute" : "Mute"}
        aria-label={isMuted ? "Unmute audio" : "Mute audio"}
      >
        {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>
    </div>
  );
}
