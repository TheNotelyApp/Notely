import React, { useState, useEffect, useRef } from "react";
import { Mic, Volume2, Users, Square, Pause, Play, X, Loader2 } from "lucide-react";
import { createAudioMixer } from "../utils/audioMixer";
import { saveAudioRecording } from "../services/electron/mediaService";
import { transcribeAudio, getSTTPreferences } from "../services/sttService";

export default function AudioRecorderBar({
  isOpen,
  onClose,
  onSaveSuccess,
  initialMode = "meeting",
}) {
  const [sourceMode, setSourceMode] = useState(initialMode);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [statusText, setStatusText] = useState("Ready to record");
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const mixerRef = useRef(null);
  const timerRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const analyserRef = useRef(null);
  const streamsToStopRef = useRef([]);

  // Load preferred mode
  useEffect(() => {
    if (isOpen) {
      getSTTPreferences().then((prefs) => {
        if (prefs?.defaultSourceMode) {
          setSourceMode(prefs.defaultSourceMode);
        }
      }).catch(() => {});
    }
  }, [isOpen]);

  // Clean up on unmount or close
  useEffect(() => {
    return () => {
      cleanupStreams();
    };
  }, []);

  function cleanupStreams() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (mixerRef.current) {
      mixerRef.current.cleanup();
      mixerRef.current = null;
    }
    for (const s of streamsToStopRef.current) {
      s.getTracks().forEach((t) => t.stop());
    }
    streamsToStopRef.current = [];
  }

  // Draw audio visualizer
  function startVisualizer(audioContext, sourceStream) {
    if (!canvasRef.current || !sourceStream) return;
    try {
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      const source = audioContext.createMediaStreamSource(sourceStream);
      source.connect(analyser);
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      function draw() {
        animationFrameRef.current = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const barWidth = (canvas.width / bufferLength) * 1.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * canvas.height;
          ctx.fillStyle = isPaused ? "rgba(150, 150, 150, 0.6)" : "rgba(236, 72, 153, 0.85)";
          ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
          x += barWidth;
        }
      }
      draw();
    } catch (err) {
      console.warn("[AudioRecorderBar] Visualizer init failed:", err);
    }
  }

  const startRecording = async () => {
    setErrorMsg(null);
    setStatusText("Acquiring audio sources...");
    audioChunksRef.current = [];
    streamsToStopRef.current = [];

    try {
      let micStream = null;
      let systemStream = null;

      // Acquire Mic
      if (sourceMode === "meeting" || sourceMode === "mic") {
        try {
          micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          streamsToStopRef.current.push(micStream);
        } catch (err) {
          if (sourceMode === "mic") throw new Error("Microphone access denied or unavailable.");
          console.warn("[AudioRecorderBar] Mic acquisition failed in meeting mode:", err);
        }
      }

      // Acquire System Audio Loopback
      if (sourceMode === "meeting" || sourceMode === "system") {
        try {
          // getDisplayMedia allows capturing system audio in Chrome/Electron
          systemStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
            },
          });
          streamsToStopRef.current.push(systemStream);
        } catch (err) {
          if (sourceMode === "system") throw new Error("System audio capture was canceled or unavailable.");
          console.warn("[AudioRecorderBar] System audio capture omitted in meeting mode:", err);
        }
      }

      if (!micStream && !systemStream) {
        throw new Error("No audio source could be captured. Please check permissions.");
      }

      // Mix sources
      const mixer = createAudioMixer({
        micStream,
        systemStream,
        micGain: 1.0,
        systemGain: 1.0,
      });
      mixerRef.current = mixer;
      await mixer.resume();

      startVisualizer(mixer.audioContext, mixer.mixedStream);

      // Setup MediaRecorder
      let mimeType = "audio/webm";
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        mimeType = "audio/webm;codecs=opus";
      }

      const recorder = new MediaRecorder(mixer.mixedStream, { mimeType });
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.start(500);
      mediaRecorderRef.current = recorder;

      setIsRecording(true);
      setIsPaused(false);
      setElapsedSeconds(0);
      setStatusText(
        sourceMode === "meeting"
          ? "Recording meeting (Mic + System Audio)..."
          : sourceMode === "mic"
          ? "Recording microphone..."
          : "Recording system audio..."
      );

      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("[AudioRecorderBar] Failed to start:", err);
      cleanupStreams();
      setErrorMsg(err.message || "Failed to start audio recording.");
      setStatusText("Failed to start");
    }
  };

  const pauseResumeRecording = () => {
    if (!mediaRecorderRef.current) return;
    if (isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      setStatusText("Recording resumed");
    } else {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      setStatusText("Recording paused");
    }
  };

  const stopAndProcessRecording = async () => {
    if (!mediaRecorderRef.current || !isRecording) return;
    setIsProcessing(true);
    setStatusText("Finalizing audio file...");

    clearInterval(timerRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

    const recorder = mediaRecorderRef.current;

    await new Promise((resolve) => {
      recorder.onstop = resolve;
      recorder.stop();
    });

    const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
    cleanupStreams();
    setIsRecording(false);
    setIsPaused(false);

    let transcriptResult = null;
    try {
      const prefs = await getSTTPreferences();
      if (prefs.autoTranscribe) {
        setStatusText("Generating transcription with Whisper...");
        transcriptResult = await transcribeAudio(audioBlob, {
          sourceMode,
        });
      }
    } catch (transcribeErr) {
      console.warn("[AudioRecorderBar] Transcription warning:", transcribeErr);
      setStatusText("Saving audio (transcription skipped)...");
    }

    try {
      setStatusText("Saving to workspace...");
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const prefix = sourceMode === "meeting" ? "meeting" : "audio";
      const fileName = `${prefix}_${timestamp}.webm`;

      const saveRes = await saveAudioRecording({
        fileName,
        audioBlob,
        transcript: transcriptResult,
      });

      setIsProcessing(false);
      onSaveSuccess?.({
        audioPath: saveRes?.audioPath || `media/audio/${fileName}`,
        transcriptPath: saveRes?.transcriptPath || null,
        fileName,
        duration: elapsedSeconds,
        transcript: transcriptResult,
      });
      onClose();
    } catch (saveErr) {
      console.error("[AudioRecorderBar] Save failed:", saveErr);
      setIsProcessing(false);
      setErrorMsg(saveErr.message || "Failed to save audio recording.");
      setStatusText("Error saving audio");
    }
  };

  const cancelRecording = () => {
    cleanupStreams();
    setIsRecording(false);
    setIsPaused(false);
    setIsProcessing(false);
    onClose();
  };

  if (!isOpen) return null;

  const formatTimer = (sec) => {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div className="audio-recorder-bar">
      {/* Mode Selector & Status */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {!isRecording && !isProcessing && (
          <div className="audio-recorder-mode-group">
            <button
              type="button"
              onClick={() => setSourceMode("meeting")}
              className={`audio-recorder-mode-btn ${sourceMode === "meeting" ? "active" : ""}`}
              title="Meeting Mode: Records Microphone + System Audio Loopback"
            >
              <Users size={12} /> Meeting
            </button>
            <button
              type="button"
              onClick={() => setSourceMode("mic")}
              className={`audio-recorder-mode-btn ${sourceMode === "mic" ? "active" : ""}`}
              title="Microphone Only"
            >
              <Mic size={12} /> Mic
            </button>
            <button
              type="button"
              onClick={() => setSourceMode("system")}
              className={`audio-recorder-mode-btn ${sourceMode === "system" ? "active" : ""}`}
              title="System Audio Only"
            >
              <Volume2 size={12} /> System
            </button>
          </div>
        )}

        {/* Live Visualizer or Pulsing Dot */}
        {isRecording && (
          <div className="audio-recorder-timer-box">
            <span className={`audio-recorder-pulsing-dot ${isPaused ? "is-paused" : ""}`} />
            <span className="audio-recorder-timer-digits">
              {formatTimer(elapsedSeconds)}
            </span>
            <canvas ref={canvasRef} width="64" height="20" className="audio-recorder-canvas" />
          </div>
        )}

        <span className={`audio-recorder-status-msg ${errorMsg ? "is-error" : ""}`}>
          {errorMsg || statusText}
        </span>
      </div>

      {/* Action Buttons */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {!isRecording && !isProcessing && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={startRecording}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              padding: "5px 12px",
              fontSize: "12px",
              background: "var(--accent-red, #ef4444)",
              borderColor: "var(--accent-red, #ef4444)",
              color: "#fff",
              borderRadius: "var(--radius-md, 6px)",
              cursor: "pointer",
              fontWeight: "600",
            }}
          >
            <Mic size={14} /> Start Recording
          </button>
        )}

        {isRecording && (
          <>
            <button
              type="button"
              onClick={pauseResumeRecording}
              className="btn btn-secondary"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                padding: "5px 10px",
                fontSize: "12px",
              }}
            >
              {isPaused ? <Play size={12} /> : <Pause size={12} />}
              {isPaused ? "Resume" : "Pause"}
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={stopAndProcessRecording}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                padding: "5px 12px",
                fontSize: "12px",
                fontWeight: "600",
              }}
            >
              <Square size={12} fill="currentColor" /> Stop & Transcribe
            </button>
          </>
        )}

        {isProcessing && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--accent-solid)" }}>
            <Loader2 size={14} className="spin" />
            <span style={{ fontSize: "11px", fontWeight: "600" }}>Processing...</span>
          </div>
        )}

        <button
          type="button"
          onClick={cancelRecording}
          disabled={isProcessing}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            padding: "4px",
            display: "flex",
            alignItems: "center",
            borderRadius: "var(--radius-sm, 4px)",
          }}
          title="Cancel"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
