---
title: Screen Capture & Video Recording
description: Capture screen areas and record video walk-throughs with custom source selection and auto-minimize.
keywords: screen capture, screenshot, screen recording, video recording, window picker, overlay controls, markdown video
category: Workspace
---

# Screen Capture & Video Recording

Notely supports both static screen area capture (snipping) and full screen/application window video recording directly into your notes.

---

## 1. Static Screen Capture

1. Position your cursor in the editor where you want the image link placed.
2. Click the toolbar **📷 Capture** button or press **`Ctrl + Shift + S`**.
3. Select the target area using the snip overlay.

### Modes (Settings → Screen Capture)
- **Auto Insert (`📷 A`)**: Inserts the captured image immediately into `media/` as a Markdown reference.
- **Review Before Insert (`📷 R`)**: Opens an image crop and annotation editor before saving.

---

## 2. Screen Video Recording

Capture high-definition screen video recordings with audio directly into your active note.

### Recording Workflow

1. Click **🎥 Record** on the Markdown editor toolbar.
2. **Select Recording Source**:
   - **Screens**: Choose any connected desktop display.
   - **Application Windows**: Select any open application window with live thumbnail previews.
   - **Microphone Toggle**: Toggle **Mic: ON / OFF** to capture audio commentary.
3. Click **Start Recording**:
   - Notely automatically minimizes to clear the desktop recording area.
   - A floating, always-on-top draggable control overlay pill appears on screen.
4. **Recording Overlay Controls**:
   - **Timer (`00:00`)**: Displays elapsed recording duration.
   - **Pause / Resume**: Pause and resume video capture seamlessly.
   - **Microphone Toggle**: Mute or unmute your mic mid-recording.
   - **Stop & Save (`⏹`)**: Stops recording, restores the Notely window, saves a `.webm` file into `media/recordings/`, and inserts the video card into your note.
   - **Cancel (`✕`)**: Cancels the recording session without saving.

---

## 3. Video Playback & Note Preview

Video links are rendered inside notes as interactive video cards:

- **Inline Frame Thumbnail**: Shows a live visual thumbnail frame of the recording inside the note preview.
- **`▶ Play Video` Badge**: Displays a centered play badge indicator over the thumbnail card.
- **Modal Player**: Clicking the video card opens a full-screen player modal featuring:
  - Play, pause, volume, and playback speed controls.
  - **Copy Path**: Instantly copy the video's local disk path to your clipboard.
  - **Download Video**: Export or download the WebM recording file.
