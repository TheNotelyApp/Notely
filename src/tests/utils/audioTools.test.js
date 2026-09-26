import { describe, it, expect } from "vitest";
import { encodeWavBlob, extractAudioDataFromBuffer } from "../../utils/audioExtractor";

describe("audioExtractor & audioMixer", () => {
  it("extracts and resamples audio data from an AudioBuffer mock", () => {
    const mockChannelData = new Float32Array([0.1, -0.2, 0.3, -0.4, 0.5, -0.6]);
    const mockAudioBuffer = {
      duration: 0.1,
      numberOfChannels: 1,
      sampleRate: 48000,
      getChannelData: () => mockChannelData,
    };

    const result = extractAudioDataFromBuffer(mockAudioBuffer, 16000);
    expect(result.float32Array).toBeInstanceOf(Float32Array);
    expect(result.pcmData).toBe(result.float32Array);
    expect(result.sampleRate).toBe(16000);
    expect(result.duration).toBe(0.1);
  });

  it("encodes Float32Array PCM samples to a valid 16-bit PCM WAV Blob", async () => {
    // Generate 1 second of 440Hz sine wave at 16000Hz
    const sampleRate = 16000;
    const durationSec = 0.5;
    const numSamples = Math.floor(sampleRate * durationSec);
    const samples = new Float32Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
      samples[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.8;
    }

    const wavBlob = encodeWavBlob(samples, sampleRate);
    expect(wavBlob).toBeDefined();
    expect(wavBlob.type).toBe("audio/wav");

    const arrayBuffer = await wavBlob.arrayBuffer();
    expect(arrayBuffer.byteLength).toBe(44 + numSamples * 2);

    const view = new DataView(arrayBuffer);
    // Check RIFF header
    const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
    expect(riff).toBe("RIFF");

    const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
    expect(wave).toBe("WAVE");

    // Channels = 1 (mono)
    expect(view.getUint16(22, true)).toBe(1);

    // Sample rate = 16000
    expect(view.getUint32(24, true)).toBe(16000);

    // Bits per sample = 16
    expect(view.getUint16(34, true)).toBe(16);

    // Data header
    const dataTag = String.fromCharCode(view.getUint8(36), view.getUint8(37), view.getUint8(38), view.getUint8(39));
    expect(dataTag).toBe("data");
    expect(view.getUint32(40, true)).toBe(numSamples * 2);
  });
});
