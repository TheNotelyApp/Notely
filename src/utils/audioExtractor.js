/**
 * Audio Extractor & Resampler Utility
 * Prepares audio blobs/buffers for Speech-to-Text transcription engines
 * (resampling to 16kHz mono Float32Array or standard 16-bit PCM WAV).
 */

/**
 * Safely converts a data: URL (base64) to an ArrayBuffer without calling fetch() (which violates connect-src CSP).
 * @param {string} dataUrl
 * @returns {ArrayBuffer}
 */
export function dataUrlToArrayBuffer(dataUrl) {
  if (typeof dataUrl !== "string") {
    throw new Error("dataUrl must be a string");
  }
  const commaIndex = dataUrl.indexOf(",");
  const base64Data = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
  const binaryString = atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Extracts mono Float32Array from an AudioBuffer, resampling to targetSampleRate (default 16000).
 * @param {AudioBuffer} audioBuffer
 * @param {number} targetSampleRate Default 16000
 * @returns {{ float32Array: Float32Array, pcmData: Float32Array, duration: number, sampleRate: number }}
 */
export function extractAudioDataFromBuffer(audioBuffer, targetSampleRate = 16000) {
  if (!audioBuffer) {
    throw new Error("Invalid AudioBuffer provided");
  }

  const duration = audioBuffer.duration;
  const numChannels = audioBuffer.numberOfChannels;
  const srcSampleRate = audioBuffer.sampleRate;

  // Mixdown to mono
  let monoSamples;
  if (numChannels === 1) {
    monoSamples = audioBuffer.getChannelData(0);
  } else {
    const left = audioBuffer.getChannelData(0);
    const right = audioBuffer.getChannelData(1);
    monoSamples = new Float32Array(left.length);
    for (let i = 0; i < left.length; i++) {
      monoSamples[i] = (left[i] + right[i]) * 0.5;
    }
  }

  // Resample to targetSampleRate (e.g. 16000Hz) if needed
  if (srcSampleRate === targetSampleRate) {
    return {
      float32Array: monoSamples,
      pcmData: monoSamples,
      duration,
      sampleRate: targetSampleRate,
    };
  }

  const ratio = srcSampleRate / targetSampleRate;
  const targetLength = Math.round(monoSamples.length / ratio);
  const resampled = new Float32Array(targetLength);

  for (let i = 0; i < targetLength; i++) {
    const srcIndex = i * ratio;
    const indexFloor = Math.floor(srcIndex);
    const indexCeil = Math.min(monoSamples.length - 1, indexFloor + 1);
    const frac = srcIndex - indexFloor;
    resampled[i] = monoSamples[indexFloor] * (1 - frac) + monoSamples[indexCeil] * frac;
  }

  return {
    float32Array: resampled,
    pcmData: resampled,
    duration,
    sampleRate: targetSampleRate,
  };
}

/**
 * Resamples and converts an AudioBuffer or audio Blob to a 16kHz mono Float32Array.
 * @param {Blob|ArrayBuffer|AudioBuffer} audioData
 * @param {number} targetSampleRate Default 16000
 * @returns {Promise<{ float32Array: Float32Array, pcmData: Float32Array, duration: number, sampleRate: number }>}
 */
export async function decodeAudioTo16kMono(audioData, targetSampleRate = 16000) {
  if (typeof AudioBuffer !== "undefined" && audioData instanceof AudioBuffer) {
    return extractAudioDataFromBuffer(audioData, targetSampleRate);
  }

  if (audioData instanceof Float32Array) {
    return {
      float32Array: audioData,
      pcmData: audioData,
      duration: audioData.length / targetSampleRate,
      sampleRate: targetSampleRate,
    };
  }

  let arrayBuffer;
  if (audioData instanceof Blob) {
    arrayBuffer = await audioData.arrayBuffer();
  } else if (audioData instanceof ArrayBuffer) {
    arrayBuffer = audioData;
  } else {
    throw new Error("Invalid audio data provided to decodeAudioTo16kMono");
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error("Web Audio API AudioContext not supported.");
  }

  const audioCtx = new AudioContextClass();
  try {
    const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    return extractAudioDataFromBuffer(decodedBuffer, targetSampleRate);
  } finally {
    if (audioCtx.state !== "closed") {
      audioCtx.close().catch(() => {});
    }
  }
}

/**
 * Encodes Float32Array PCM samples to a 16-bit linear PCM WAV Blob.
 * @param {Float32Array} pcmData
 * @param {number} sampleRate
 * @returns {Blob}
 */
export function encodeWavBlob(pcmData, sampleRate = 16000) {
  const numChannels = 1;
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcmData.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  function writeString(offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  // RIFF header
  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");

  // fmt subchunk
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // SubChunk1Size (16 for PCM)
  view.setUint16(20, 1, true);  // AudioFormat (1 = PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bitsPerSample

  // data subchunk
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  // Write PCM audio samples clamped to [-1, 1] converted to 16-bit signed int
  let offset = 44;
  for (let i = 0; i < pcmData.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, pcmData[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}

/**
 * Converts a recorded Blob (e.g. audio/webm) directly into a 16kHz mono WAV Blob.
 * @param {Blob} rawBlob
 * @returns {Promise<{ wavBlob: Blob, duration: number, pcmData: Float32Array }>}
 */
export async function convertTo16kWavBlob(rawBlob) {
  const { pcmData, duration } = await decodeAudioTo16kMono(rawBlob, 16000);
  const wavBlob = encodeWavBlob(pcmData, 16000);
  return { wavBlob, duration, pcmData };
}
