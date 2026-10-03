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

- **Asset Bundles**: Audio and video recordings are stored inside isolated bundle directories:
  - Audio: `{workspace}/media/audio/<recording_id>/<recording_id>.webm`
  - Companion Transcripts: `{workspace}/media/audio/<recording_id>/transcript.json`
- **Editor Markdown Preview**:
  - Audio files render interactive player cards with waveform visualizers.
  - Companion transcripts render rich `.markdown-transcript-card` elements with View, Copy Text/Markdown, and Download actions.
- **Synchronized Transcript Drawer**: Clicking any audio or video recording with companion transcript data opens the media player alongside an interactive, timestamp-synchronized side drawer.

---

## 4. Diagrams & Media Asset Manager Integration

- Filter by **Audio**, **Videos**, and **Transcripts** categories in `Workspace -> Diagrams & Media` (`Ctrl/Cmd + Alt + M`).
- **On-Demand AI Transcript Generation (`✨`)**: Run speech-to-text on any existing recording without re-recording.
- **Reference Tracking**: View exactly which notes and lines reference the audio/video recordings and transcripts.
