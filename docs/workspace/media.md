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

## 4. Diagrams & Media Asset Manager

Notely provides a dedicated full-screen asset manager under **Workspace > Diagrams & Media** (shortcut: `Ctrl+Alt+M` or `Cmd+Alt+M`):
- **Dense Asset Table Layout**: High-density table displaying Asset Name, Type Badge, File Size, Reference Status, and Quick Action buttons.
- **Fixed Sidebar & Category Filters**: Left sidebar (260px) with real-time counters for Diagrams, UI Prototypes, Images, PDFs, Videos, Audio, Transcripts, and Documents.
- **Physical Disk Scanner & Orphan Detection**: Discovers assets on disk across `media/`, `assets/`, and `images/`. Unreferenced assets are highlighted with the `⚠️ Unused / Orphans` badge and filter tab.
- **Asset Bundles**: Audio and video recordings are organized into bundle folders (`media/audio/<id>/` and `media/video/<id>/`) containing the primary recording alongside companion `transcript.json`.
- **Integrated Full-Screen Media Viewer**: Standardized modal viewer with 100% full-width layout, subtitle/transcript side drawer, playback speed controls, and copy/download tools.
- **Safe Asset Deletion**: Remove unwanted assets with safety confirmation modals that check note references and warn before removing actively linked files.
- **Referenced Notes & Line Jumping**: Inspect reference pills to view note names, line numbers, and markdown context snippets, with 1-click navigation to jump directly to the editor position.
