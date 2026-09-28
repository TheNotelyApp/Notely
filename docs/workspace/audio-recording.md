---
title: Audio Recording & Speech-to-Text
description: Record voice notes, conference meetings with dual-stream audio loopback, and generate AI transcripts with local Whisper.
keywords: audio recording, voice notes, meeting recorder, speech to text, whisper, transcription, transcript drawer
category: Workspace
---

# Audio Recording & Speech-to-Text

Notely includes a dual-stream audio recording engine and speech-to-text pipeline for voice notes and conference call transcriptions.

---

## 1. Recording Modes

Trigger audio recording via `Alt + V`, the **🎙️ Record Audio** toolbar button in the Markdown editor, or the **Quick Capture Bar** on the landing dashboard.

1. **Meeting Mode (Mic + System Loopback)**:
   - Captures microphone input and Windows system audio (Zoom, Google Meet, Microsoft Teams, YouTube) concurrently.
   - Merges both streams into a synchronized stereo track via Web Audio API.
2. **Microphone Only**:
   - Voice memo and dictation capture from your primary recording device.
3. **System Audio Only**:
   - Records desktop/speaker audio output without microphone commentary.

---

## 2. Speech-to-Text (STT) Engines

Configure STT preferences in **AI -> AI Settings -> Speech-to-Text**:

- **Local ONNX Whisper (Offline)**:
  - Runs on-device via WebAssembly/ONNX Runtime.
  - Models: `whisper-tiny.en` (~40MB), `whisper-base.en` (~140MB), `whisper-small` (~460MB).
  - Private, zero external network traffic.
- **Cloud Whisper**:
  - High-throughput cloud transcription via **Groq** (`whisper-large-v3`) or **OpenAI** (`whisper-1`).
  - Sub-second turnaround using your configured API keys.

---

## 3. Storage & Markdown Integration

- **Audio Files**: Stored in `{workspace}/media/audio/*.webm`.
- **Transcripts**: Stored alongside audio files in `{workspace}/media/audio/*.json`.
- **Note Insertion**: Inserting a recording places both the audio player and transcript block at your cursor:
  ```markdown
  ![Audio Recording](media/audio/recording-2026-09-26.webm)
  ```

---

## 4. Diagrams & Media Gallery Integration

- Filter by the **Transcripts** and **Audio** categories in `Workspace -> Diagrams & Media Gallery` (`Ctrl/Cmd + Alt + M`).
- **On-Demand AI Transcript Generation (`✨`)**: Run speech-to-text on any existing recording without re-recording.
