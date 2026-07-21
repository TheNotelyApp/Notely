---
title: Website View
description: How the Notely website preview works — live local server, note rendering, project index, and full-text search.
keywords: website view, web preview, local server, note rendering, search index, markdown
category: User Guide
---

# Website View

The **Website View** renders your workspace notes as a fully navigable, styled static website served locally by Notely. Unlike the in-editor Markdown Preview pane, the website view runs inside your browser and includes a project index, full-text search, and cross-note navigation.

---

## Opening the Website View

Access via the **Web** top-level menu:

| Action | Context | Shortcut |
|---|---|---|
| **Web → Open Project Website** | Landing screen (no note open) | `Ctrl/Cmd + Shift + W` |
| **Web → Open Current Note Website View** | When a note is active | `Ctrl/Cmd + Shift + W` |

Both actions start the local preview server (if not already running) and open the rendered page in your default browser.

---

## How It Works

### Local HTTP Server
Notely starts a **local HTTP server** (`webPreview.cjs`) on a random available port. The server binds to `127.0.0.1` only and is never accessible from other devices.

The server handles five route types:

| Route | What it serves |
|---|---|
| `GET /` | Project index page — a listing of all workspace notes |
| `GET /view/{note-path}` | Individual note rendered as a website page |
| `GET /pdf/{note-path}` | Note rendered in PDF-optimised layout |
| `GET /search` | Full-text search results page |
| `GET /search-index.json` | Search index JSON (used by the search page) |
| `GET /raw/{asset-path}` | Static file passthrough for media assets (images, PDFs, Excalidraw PNGs) |

All responses include `Cache-Control: no-store` so you always see the latest saved version.

### Live Content Overrides
When you open the current note's website view while editing, Notely passes the **unsaved editor buffer** as a content override so you see real-time changes without needing to save first.

---

## Page Rendering Pipeline (`websiteRenderer.cjs`)

Each note is processed through a custom rendering pipeline before being served:

1. **Markdown-It parser** with `linkify` and `typographer` enabled.
2. **Syntax highlighting** (`highlight.js`) with numbered lines and a one-click copy button on every code block.
3. **Heading slug generation** — all headings get deterministic `id` attributes (deduplicated with counters) enabling anchor links.
4. **Asset path rewriting** — relative image/media paths are rewritten to `/raw/{path}` server routes. Legacy Excalidraw diagram paths are automatically migrated to the current `.notes-app/excali-diagrams/` layout.
5. **Markdown link rewriting** — `.md` links become `/view/{note-path}` server routes, enabling seamless cross-note navigation.
6. **HTML injection** into `websiteTemplate.cjs` which adds navigation, project sidebar, and the Notely website stylesheet.

### What renders in website view
* Standard GFM markdown (headings, lists, tables, blockquotes, task lists)
* Fenced code blocks with syntax highlighting and line numbers
* Inline and block images (`.png`, `.jpg`, `.gif`, `.svg`, `.webp`)
* Embedded Excalidraw diagram previews (rendered PNG thumbnails)
* Embedded PDF documents
* Cross-note Wikilinks and relative `.md` links

> [!NOTE]
> Mermaid diagram live rendering is handled client-side via a Mermaid.js script tag injected by `websiteTemplate.cjs`.

---

## Project Index Page

The root `/` page lists all `.md` files in the active workspace (or project scope), sorted alphabetically. Notes in excluded directories (`.notes-app/`, `.git/`, `node_modules/`) are omitted.

---

## Full-Text Search

The `/search` page provides client-side full-text search across all workspace notes:

* The server builds a **search index JSON** (`/search-index.json`) by reading and indexing all `.md` files in scope at request time.
* The search page fetches this JSON and runs matching in the browser — no external search service required.
* Results include the note title, matching excerpt, and a direct link to the note's website view.

---

## Website Scope

The website scope tracks the **active project** (or workspace root if no project is open):

* Switching workspace or project updates the scope — the server scope syncs on the next page load.
* On scope change, the content override cache is cleared so you don't see stale overrides from a previous workspace.

---

## Comparison: Website View vs Preview Pane vs PDF Export

| Feature | Preview Pane | Website View | PDF Export |
|---|---|---|---|
| Rendered in | Electron app window | Your browser | Headless Chromium |
| Navigation | Single note only | Cross-note links, project index | Single note only |
| Full-text search | ❌ | ✅ (client-side) | ❌ |
| Live refresh | ✅ (auto on typing) | Manual browser refresh | One-shot render |
| Media resolved | ✅ | ✅ | ✅ |
| Syntax highlighting | ✅ | ✅ (with line numbers) | ✅ |
| Shareable output | ❌ | ❌ (local only) | ✅ (save as file) |

To publish the website view as a static site, use **File → Export Workspace → Web Format** which packages the full rendered HTML output as a `.zip` archive you can host on GitHub Pages, Netlify, or any static server. See [Export Reference](/export-reference) for details.
