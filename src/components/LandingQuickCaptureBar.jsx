import React, { useState, useRef } from "react";
import { Camera, Video, Mic, Image as ImageIcon } from "lucide-react";
import { captureCurrentDisplay, getDesktopSources, saveImage, saveVideo } from "../services/electron/mediaService";
import { ScreenSourcePickerModal } from "./ScreenSourcePickerModal";
import AudioRecorderBar from "./AudioRecorderBar";
import { showToast } from "../utils/notificationUtils";

export default function LandingQuickCaptureBar({ onOpenGallery, onNotify }) {
  const [snipBusy, setSnipBusy] = useState(false);
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);
  const [desktopSources, setDesktopSources] = useState([]);
  const [audioRecorderOpen, setAudioRecorderOpen] = useState(false);
  const [screenRecording, setScreenRecording] = useState(false);

  const screenRecorderRef = useRef(null);
  const audioTrackRef = useRef(null);

  const notifyUser = (message, type = "info", action = null) => {
    if (typeof onNotify === "function") {
      onNotify(message, type);
    }
    showToast(message, type, action);
  };

  // 1. Screen Snip (Screenshot)
  const handleQuickSnip = async () => {
    if (snipBusy) return;
    setSnipBusy(true);
    notifyUser("Select area on screen to capture. Press Esc to cancel.", "info");

    try {
      const result = await captureCurrentDisplay();
      if (result?.canceled) {
        notifyUser("Screen capture canceled.", "info");
        return;
      }
      if (!result?.dataUrl) {
        throw new Error("Screen snip returned empty data.");
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const fileName = `snip_${timestamp}.png`;
      const savedPath = await saveImage(fileName, result.dataUrl, "");

      notifyUser(`Screenshot saved to Media Gallery (${savedPath}).`, "success", {
        label: "Open Gallery",
        onClick: () => onOpenGallery?.(),
      });
    } catch (err) {
      console.error("[LandingQuickCapture] Snip error:", err);
      notifyUser(err.message || "Failed to capture screen area.", "error");
    } finally {
      setSnipBusy(false);
    }
  };

  // 2. Screen Recording
  const handleOpenScreenRecorder = async () => {
    try {
      const sources = await getDesktopSources();
      if (!sources || sources.length === 0) {
        notifyUser("No display screens or windows found.", "warning");
        return;
      }
      setDesktopSources(sources);
      setSourcePickerOpen(true);
    } catch (err) {
      notifyUser(err.message || "Failed to retrieve desktop recording sources.", "error");
    }
  };

  const handleStartScreenRecording = async (source, { recordMic }) => {
    setSourcePickerOpen(false);
    try {
      let displayStream = null;
      try {
        displayStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            mandatory: {
              chromeMediaSource: "desktop",
            },
          },
          video: {
            mandatory: {
              chromeMediaSource: "desktop",
              chromeMediaSourceId: source.id,
            },
          },
        });
      } catch {
        displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      }

      let audioTrack = null;
      if (recordMic) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          audioTrack = micStream.getAudioTracks()[0] ?? null;
        } catch {
          // Mic denied or unavailable
        }
      }

      const tracks = [...displayStream.getTracks(), ...(audioTrack ? [audioTrack] : [])];
      const combined = new MediaStream(tracks);

      let mimeType = "video/webm";
      if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9")) {
        mimeType = "video/webm;codecs=vp9";
      }

      const recorder = new MediaRecorder(combined, { mimeType });
      const chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      recorder.start(1000);
      screenRecorderRef.current = recorder;
      audioTrackRef.current = audioTrack;
      setScreenRecording(true);

      // Open floating draggable overlay window and minimize main window
      window.notesApi?.openRecordingOverlay?.();
      setTimeout(() => {
        window.notesApi?.minimizeMainWindow?.();
      }, 250);

      let elapsedSec = 0;
      let isPaused = false;

      const pushState = () => {
        window.notesApi?.sendRecordingState?.({
          elapsed: elapsedSec,
          paused: isPaused,
          hasMic: Boolean(audioTrack),
          micEnabled: audioTrack ? audioTrack.enabled : false,
        });
      };

      pushState();

      const timerInterval = setInterval(() => {
        if (recorder.state === "recording") {
          elapsedSec += 1;
          pushState();
        }
      }, 1000);

      let finishing = false;
      const cleanupAndFinish = async (shouldSave) => {
        if (finishing) return;
        finishing = true;

        clearInterval(timerInterval);
        removeActionListener?.();
        setScreenRecording(false);
        screenRecorderRef.current = null;
        audioTrackRef.current = null;

        window.notesApi?.closeRecordingOverlay?.();
        window.notesApi?.restoreMainWindow?.();

        if (recorder.state !== "inactive") {
          await new Promise((resolve) => {
            recorder.addEventListener("stop", resolve, { once: true });
            try {
              recorder.stop();
            } catch {
              resolve();
            }
          });
        }

        combined.getTracks().forEach((t) => t.stop());

        if (shouldSave && chunks.length > 0) {
          const blob = new Blob(chunks, { type: mimeType });
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64Data = reader.result;
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
            const fileName = `rec_${timestamp}.webm`;
            try {
              const savedPath = await saveVideo(fileName, base64Data);
              notifyUser(`Screen recording saved to Media Gallery (${savedPath}).`, "success", {
                label: "Open Gallery",
                onClick: () => onOpenGallery?.(),
              });
            } catch (saveErr) {
              notifyUser("Failed to save screen recording: " + saveErr.message, "error");
            }
          };
          reader.readAsDataURL(blob);
        } else if (!shouldSave) {
          notifyUser("Screen recording canceled.", "info");
        }
      };

      const removeActionListener = window.notesApi?.onRecordingAction?.((action) => {
        if (action === "toggle-pause") {
          if (recorder.state === "recording") {
            recorder.pause();
            isPaused = true;
          } else if (recorder.state === "paused") {
            recorder.resume();
            isPaused = false;
          }
          pushState();
        } else if (action === "toggle-mic") {
          if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            pushState();
          }
        } else if (action === "stop") {
          cleanupAndFinish(true);
        } else if (action === "cancel") {
          cleanupAndFinish(false);
        }
      });

      displayStream.getVideoTracks()[0]?.addEventListener("ended", () => {
        cleanupAndFinish(true);
      });
    } catch (err) {
      notifyUser(err.message || "Failed to start screen recording.", "error");
    }
  };

  // 3. Audio Recording Success
  const handleAudioSaveSuccess = ({ audioPath }) => {
    notifyUser(`Audio & Transcript saved to Media Gallery (${audioPath}).`, "success", {
      label: "Open Gallery",
      onClick: () => onOpenGallery?.(),
    });
  };

  return (
    <div className="landing-quick-capture-bar">
      <span className="landing-quick-capture-label">
        Quick Capture
      </span>

      {/* Screen Snip Button */}
      <button
        type="button"
        onClick={handleQuickSnip}
        disabled={snipBusy || screenRecording}
        className="landing-quick-capture-btn"
        title="Capture screen area screenshot (Saved to Media Gallery)"
      >
        <Camera size={14} style={{ color: "var(--status-info-text, #38bdf8)" }} />
        <span>Snip Screen</span>
      </button>

      {/* Screen Record Button */}
      <button
        type="button"
        onClick={handleOpenScreenRecorder}
        disabled={snipBusy || screenRecording}
        className="landing-quick-capture-btn"
        title="Record desktop screen or app window (Saved to Media Gallery)"
      >
        <Video size={14} style={{ color: "var(--status-warning-text, #f59e0b)" }} />
        <span>Record Screen</span>
      </button>

      {/* Audio & Meeting Record Button */}
      <button
        type="button"
        onClick={() => setAudioRecorderOpen(true)}
        disabled={audioRecorderOpen || screenRecording}
        className="landing-quick-capture-btn"
        title="Record meeting (Mic + System Audio) with Whisper transcription"
      >
        <Mic size={14} style={{ color: "var(--accent-solid, #2f5d62)" }} />
        <span>Record Audio</span>
      </button>

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center" }}>
        <button
          type="button"
          onClick={onOpenGallery}
          className="landing-quick-gallery-link"
          title="Open Workspace Media & Diagrams Gallery"
        >
          <ImageIcon size={14} />
          <span>View Media Gallery</span>
        </button>
      </div>

      {/* Source Picker Modal for Screen Recording */}
      {sourcePickerOpen && (
        <ScreenSourcePickerModal
          sources={desktopSources}
          onSelect={handleStartScreenRecording}
          onClose={() => setSourcePickerOpen(false)}
        />
      )}

      {/* Audio Recorder Bar */}
      {audioRecorderOpen && (
        <div style={{ width: "100%", marginTop: "8px" }}>
          <AudioRecorderBar
            isOpen={audioRecorderOpen}
            onClose={() => setAudioRecorderOpen(false)}
            onSaveSuccess={handleAudioSaveSuccess}
            initialMode="meeting"
          />
        </div>
      )}
    </div>
  );
}
