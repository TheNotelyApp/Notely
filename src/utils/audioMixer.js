/**
 * Audio Mixer Utility
 * Mixes multiple audio sources (e.g. Microphone and System / Desktop Audio loopback)
 * into a single unified MediaStream track using Web Audio API AudioContext.
 */

export function createAudioMixer(options = {}) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error("Web Audio API AudioContext is not supported in this environment.");
  }

  const audioCtx = new AudioContextClass();
  const destination = audioCtx.createMediaStreamDestination();

  let micSourceNode = null;
  let micGainNode = null;
  let systemSourceNode = null;
  let systemGainNode = null;

  // Add Microphone Stream
  if (options.micStream && options.micStream.getAudioTracks().length > 0) {
    try {
      micSourceNode = audioCtx.createMediaStreamSource(options.micStream);
      micGainNode = audioCtx.createGain();
      micGainNode.gain.value = options.micGain !== undefined ? options.micGain : 1.0;
      micSourceNode.connect(micGainNode);
      micGainNode.connect(destination);
    } catch (err) {
      console.warn("[audioMixer] Failed to connect microphone stream:", err);
    }
  }

  // Add System / Desktop Audio Stream
  if (options.systemStream && options.systemStream.getAudioTracks().length > 0) {
    try {
      systemSourceNode = audioCtx.createMediaStreamSource(options.systemStream);
      systemGainNode = audioCtx.createGain();
      systemGainNode.gain.value = options.systemGain !== undefined ? options.systemGain : 1.0;
      systemSourceNode.connect(systemGainNode);
      systemGainNode.connect(destination);
    } catch (err) {
      console.warn("[audioMixer] Failed to connect system audio stream:", err);
    }
  }

  // If neither stream was provided, ensure destination still has output
  const mixedStream = destination.stream;
  const mixedAudioTrack = mixedStream.getAudioTracks()[0] || null;

  return {
    mixedStream,
    mixedAudioTrack,
    audioContext: audioCtx,
    setMicGain(value) {
      if (micGainNode) micGainNode.gain.value = Math.max(0, Math.min(2, value));
    },
    setSystemGain(value) {
      if (systemGainNode) systemGainNode.gain.value = Math.max(0, Math.min(2, value));
    },
    async resume() {
      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }
    },
    cleanup() {
      try {
        if (micSourceNode) micSourceNode.disconnect();
        if (micGainNode) micGainNode.disconnect();
        if (systemSourceNode) systemSourceNode.disconnect();
        if (systemGainNode) systemGainNode.disconnect();
        if (mixedAudioTrack) mixedAudioTrack.stop();
        if (audioCtx.state !== "closed") {
          audioCtx.close().catch(() => {});
        }
      } catch (err) {
        console.warn("[audioMixer] Cleanup error:", err);
      }
    },
  };
}
