---
title: Media Management
description: How to manage files, images, PDFs, annotations, and health checks in Notely.
keywords: media, assets, images, pdf, workspace health, annotations
category: Workspace
---

# Media

Notely includes an integrated asset library for linking, viewing, and managing media files inside your notes.

## 1. Asset Storage

All inserted files (images, PDFs, documents) are stored inside the `assets/` subfolder in your workspace. Markdown links refer to them relatively:
```markdown
![My Image](./assets/image.png)
```

---

## 2. Image Tools & Annotation

When viewing a note in Preview mode, hover over an image or right-click to access tools:
- **Crop**: Recut and trim the image in-app.
- **Annotate**: Draw callout lines, arrows, highlights, and text notes on top of the image.
- **Original Restore**: Notely stores a backup of the original asset before your first edit, letting you revert changes later.

---

## 3. Workspace Health Checks

Keep your assets tidy using the Media Health Dashboard:
- **Unused Media**: Lists media files in `assets/` not referenced by any note. Offers bulk-deletion.
- **Missing Assets**: Displays links in notes pointing to files that do not exist.
- **Duplicate Media**: Highlights duplicate file contents to save storage.

---

## 4. Diagrams & Media Gallery

Notely provides a dedicated full-screen page under **Workspace > Diagrams & Media Gallery** (shortcut: `Ctrl+Alt+M` or `Cmd+Alt+M`) inspired by the Knowledge Graph layout:
- **Only Used Items**: Displays every diagram (inline Mermaid, Draw.io, Excalidraw), image, audio, video, and PDF actively referenced in notes.
- **Collapsible Category Filter**: Filter by category (Diagrams, Images, PDFs, Videos, Audio, Documents) and usage scope (Single-note vs Multi-note).
- **Referenced Notes & Line Jumping**: Click any item to inspect details and see all notes referencing it, complete with line numbers and markdown snippets. Click **Open Note** to jump directly to the note and line.
- **Live Previews**: Interactive rendered Mermaid previews and high-resolution media previews.
