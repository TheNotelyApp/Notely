---
title: Export & Import Reference
description: Complete reference for all Notely export and import features — workspace exports, PDF/HTML rendering, note packages, and workspace bundles.
keywords: export, import, PDF, HTML, workspace, note package, zip, AES-256
category: User Guide
---

# Export & Import Reference

Notely provides three distinct export systems depending on the scope and format needed:

| System | Scope | Format | Where to find |
|---|---|---|---|
| **Single Note Export** | One note | PDF, HTML | File menu or Toolbar button |
| **Workspace Export** | Entire workspace | `.zip` (Raw, PDF, or Web) | File → Export Workspace |
| **Note Package** | Selected notes + assets | `.note` (encrypted bundle) | File → Export / Import Note Package |

---

## 1. Single Note Export (PDF & HTML)

Exports the currently active markdown note as a standalone rendered document.

### PDF Export
* Renders the note through a **Headless Chromium** window with the active Notely theme CSS applied.
* **Local media resolved**: Embedded images and diagrams are referenced via their absolute file:// paths before rendering.
* **Mermaid diagrams** and **LaTeX equations** are rendered as vector SVG and KaTeX HTML inside the PDF.
* Output path defaults to the last-used export directory. The app remembers the path (`getLastPdfExportPath`).
* PDF write failures (EPERM, EBUSY on OneDrive paths) are automatically retried up to 3 times with increasing delays (120ms → 320ms → 700ms).

### HTML Export
* Produces a self-contained HTML file with inline CSS and resolved media references.
* Suitable for publishing notes to static web servers or opening in any browser without Notely.

---

## 2. Workspace Export (Full ZIP Bundle)

Exports the entire active workspace as a `.zip` archive. Accessed via **File → Export Workspace**.

### Export Modes

| Mode | What is exported |
|---|---|
| **Raw Docs** (`raw`) | Plain `.md` files as-is, preserving original workspace folder structure |
| **PDF** (`pdf`) | Each note rendered to a themed PDF file inside the archive |
| **Web / HTML** (`web`) | Each note rendered to a standalone HTML page |

### Content Modes (for PDF & Web)

| Content Mode | Behaviour |
|---|---|
| **Combined** | Raw notes and cleansed/structured content merged into one file per note |
| **Separate** | Raw and Cleansed versions saved as separate files per note |
| **Raw Only** | Only raw markdown source content |
| **Cleansed Only** | Only the structured/processed note content |

### Archive Structure
* The ZIP root folder is named after the workspace (sanitized): `{workspaceName}_docs_DD_MM_YYYY.zip`.
* Hidden subsystem directories (`.notes-app/`, `.git/`) are excluded from all workspace exports.
* A progress event stream (`workspace-export:progress`) reports real-time file count progress to the UI.

---

## 3. Note Package Export & Import (`.note` Bundle)

For sharing specific notes between Notely users. Accessed via **File → Export / Import Note Package**.

### Exporting a Package

1. **Select notes** — choose any `.md` files from the current workspace.
2. **Save location** — defaults to `{workspaceName}.note`. Click **Browse** to choose a different path.
3. **Password (Optional)** — restricts import. Stores a salted SHA-256 password hash in the bundle manifest.
4. Click **Export Package**.

**What gets bundled:**

| Asset | Source Path | Included |
|---|---|---|
| Markdown notes | `{workspace}/**/*.md` | ✅ |
| Images / screenshots | `media/images/` | ✅ |
| Excalidraw diagrams | `.notes-app/excali-diagrams/` | ✅ |
| Draw.io diagrams + thumbnails | `media/draw.io/` | ✅ |
| Package metadata manifest | `metadata.json` inside bundle | ✅ auto-generated |

Assets that are locked, missing, or inaccessible at export time are silently skipped — the note is still exported.

### Security

* **AES-256 encrypted** bundle — not readable by generic ZIP tools.
* Every file in the bundle is **SHA-256 hashed** and the hashes are verified on import. Tampered packages are rejected.
* Password protection stores a salted SHA-256 signature in the manifest. The password is verified in memory before any files are written.

### Importing a Package

1. Switch to the **Import Package** tab.
2. Click **Browse** and select a `.note` file.
3. Click **Import Package**.
4. Enter the password if prompted.

Notely will:
- Decrypt and verify bundle integrity.
- Authenticate the password against the manifest signature.
- Copy notes into the workspace root (or appropriate subfolder).
- Restore all media assets to their original relative paths.
- **Resolve filename collisions** automatically — existing files are never overwritten.
- Reload the workspace document list so imported notes appear immediately.

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| "Export failed: EPERM" | Destination inside an actively syncing OneDrive path | Wait a moment and retry, or choose a local (non-OneDrive) folder |
| "Import failed: integrity check" | `.note` file was modified or corrupted in transit | Request a fresh export from the sender |
| "Incorrect password" | Password doesn't match package hash | Confirm password with the package creator |
| Notes appear in workspace root | Package was exported from a flat workspace | Expected — import mirrors the original layout |
| PDF looks wrong on export | Note uses unsupported CSS or external fonts | Use built-in Notely themes; avoid `@import` of remote fonts |
