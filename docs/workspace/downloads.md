---
title: Downloads & Export History
description: Manage and track all note exports, diagram renders, note packages, and workspace zip archives in Notely.
keywords: downloads, export history, exports, PDF, note package, excalidraw, draw.io, SQLite
category: Workspace
---

# Downloads & Export History

Notely includes a dedicated **Downloads & Export History Manager** that automatically tracks all document exports, workspace zip bundles, diagram renders, and media files created in your active workspace.

Access the downloads manager anytime via:
* Top **Workspace → Downloads & Export History** menu item
* Global keyboard shortcut **`Ctrl/Cmd + J`**
* Quick **📥 Download icon button** in the title bar
* **Command Palette** (`Ctrl/Cmd + Shift + P`) → search for *Open Downloads & Export History*

---

## 1. Features & Capabilities

| Feature | Description |
|---|---|
| **Automatic Tracking** | Every PDF export, `.note` package, workspace `.zip` archive, Excalidraw diagram, Draw.io diagram, and exported media file is logged automatically. |
| **Category Tabs** | Filter exports into **All**, **Documents** (PDF, HTML, packages), **Diagrams** (Excalidraw, Draw.io), or **Media** (images, video, audio) with live item counter badges. |
| **Show in Folder** | Opens the exact file location in Windows File Explorer or macOS Finder. |
| **Open File** | Launches the exported file directly in your system's default application. |
| **Downloads Directory** | Quick action button to open your system's default **Downloads** directory (`~/Downloads`). |
| **Disk Status Indicator** | Automatically checks if exported files still exist on disk or have been moved/deleted. |

---

## 2. Storage & Database Architecture

* Export history records are persisted locally per-workspace inside `{workspace}/.notes-app/export-history.db`.
* Built on Node 22 native **SQLite** (`node:sqlite` `DatabaseSync`).
* **Dynamic Connection Handling**: Automatically opens and queries the active workspace's SQLite database upon switching workspaces.
* **Deduplication**: Exporting a note or diagram to the same file path updates the timestamp and metadata without creating duplicate rows.

---

## 3. Supported Export & Download Formats

| Export Type | File Extension | Subsystem Category |
|---|---|---|
| **Single Note PDF** | `.pdf` | Documents |
| **Single Note HTML** | `.html` | Documents |
| **Note Package** | `.note` / `.nly` | Documents |
| **Workspace Zip Archive** | `.zip` | Documents |
| **Excalidraw Diagram** | `.png` | Diagrams |
| **Draw.io Diagram** | `.png` | Diagrams |
| **Exported Media Render** | `.png`, `.jpg`, `.webp` | Media |

---

## 4. System Downloads Directory

By default, all exports and downloads in Notely save directly to your system's **Downloads** folder (`app.getPath("downloads")`). You can customize the destination path during export prompts.
