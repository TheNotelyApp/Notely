---
title: Feature Reference
description: Complete reference of all user-facing capabilities in Notely — workspace, editing, diagrams, media, Git, and settings.
keywords: feature reference, workspace, editor, diagrams, media gallery, git, shortcuts, typography
category: Reference
---

# Notely Feature Reference

This page explains every major user-facing feature in Notely.

## 1. Notes and Workspace

### Workspace selection

Use **File -> Open Workspace** to choose the folder where your notes are stored.

Use **File -> Open Recent** to reopen a recently used workspace quickly.

### Opening the workspace externally

On the landing screen, the **File** menu exposes two shortcuts for working with the workspace folder outside Notely:

- **File -> Open Workspace in VS Code** (`Ctrl/Cmd + Shift + O`) — opens the active workspace folder directly in VS Code. Falls back to the system default app if VS Code is not installed.
- **File -> Reveal Workspace in File Explorer** (`Ctrl/Cmd + Shift + J`) — opens the workspace folder in the native system file browser.

### Opening the website view

The **Web** menu provides quick access to the rendered website output:

- **Web -> Open Current Note Website View** (`Ctrl/Cmd + Shift + W`) — available when a note is open; renders the current note as a website preview in the default browser.
- **Web -> Open Project Website** (`Ctrl/Cmd + Shift + W`) — available on the landing screen; opens the project website.

### Project-aware workspace

You can keep notes grouped by project while still working inside one larger workspace.

### Landing dashboard

The landing view includes lightweight workspace overview panels so you can resume work quickly:

- **Continue Writing** shows the single most recently edited note so you can resume immediately.
- **Recent Notes** shows recently changed documents.
- **Favorites** collects starred notes.
- **Open Tasks** surfaces unchecked tasks across the workspace.

### Note and folder creation

- Create notes from **File -> New Note** (`Ctrl/Cmd + N`).
- Create folders to group related notes.
- Customize the icon and color of any folder or note by right-clicking it and selecting "Customize icon & color..." or from the context menu in the open tabs.
- Rename and delete notes from list actions.

### Trash & Recycle Bin

When folders or notes are deleted, they are moved to a temporary Trash Bin (`.notes-app/removed/`) instead of being permanently erased immediately. Notely features a dedicated Recycle Bin on the dashboard rail and a full recovery dialog:

- **Dashboard Recycle Bin Panel**: Positioned at the bottom of the left dashboard rail, displaying a live badge with the count of currently trashed items.
- **Drag-to-Trash**: Drag any note card, table row, or tree node directly over the Recycle Bin panel. The panel illuminates in warning red as a visual drop target.
- **Safe Deletion with Confirmation**: Dropping a note into the Recycle Bin triggers an explicit confirmation modal to prevent accidental loss.
- **1-Click Undo Toast**: After confirming deletion or moving notes between folders, an instant **Undo** action toast appears.
- **Trash Recovery Dialog**: Click the Recycle Bin panel (or select `Trash` from landing view actions) to browse deleted notes/folders with their original paths and deletion timestamps.
- **Restore & Empty**: Restore any deleted item back to its original location in one click, or choose **Empty Trash** to permanently erase items and free up disk space.

### Copying and moving notes across workspaces and folders

The top **File** menu provides multi-level fan-out submenus when a note is open:

- **File -> Copy Note -> To Workspace ▶** — Select any target workspace, then choose either `[ Workspace Root ]` or a specific subfolder.
- **File -> Copy Note -> To Folder (Current Workspace) ▶** — Choose a target subfolder inside the active workspace, or `[ Root / Top Level ]`.
- **File -> Move Note -> To Workspace ▶** — Move the note to another workspace root or subfolder.
- **File -> Move Note -> To Folder (Current Workspace) ▶** — Relocate the note to another subfolder inside the active workspace.

During transfer:
- Local media assets (`media/images/`, `media/uploads/`) and diagrams (`.notes-app/excali-diagrams/`, `.notes-app/drawio-diagrams/`) are automatically copied to the target workspace asset folders.
- Relative link paths inside the Markdown text are recalculated to match the destination folder depth, ensuring embedded images and diagrams render seamlessly.

### Diagrams & Media Gallery

Open via **Workspace -> Diagrams & Media Gallery** (`Ctrl/Cmd + Alt + M`) or Command Palette:
- Catalogs all used diagrams (inline Mermaid, Draw.io, Excalidraw), images, videos, audio, and PDF documents in the workspace.
- **Physical Disk Scanner & Orphan Detection**: Scans workspace folders (`media/`, `assets/`, `images/`) to identify files present on disk that have zero note references.
- **Unused Media Filter**: Quickly isolate unreferenced assets with the `⚠️ Unused / Orphans` filter tab.
- **Audio & Media Preview**: Embedded audio players, video thumbnails, and transcript drawer with key points and action items.
- Reuses Knowledge Graph layout aesthetics with collapsible category filters, search, and stat indicators.
- Inspect details for any item with high-res/diagram live previews, file paths, and exact note references with line numbers and snippets.
- Direct "Open Note" navigation and "Copy Markdown Link" actions.

## 2. Editor and Writing Experience

### Multiple edit modes

- **Edit**: write markdown source.
- **Split**: source and preview side-by-side.
- **Preview**: read-only rendered output.
- **Web Preview**: richer rendering for selected notes.

### Markdown toolbar

Quick insert actions for headings, emphasis, lists, links, tables, diagrams, and validation.

### Inline table editor

When the cursor is inside a markdown table, Notely opens an inline table editor overlay with focused controls:

- Edit headers and cells in a grid view.
- Add/remove rows and columns from contextual action chips.
- Set per-column alignment (left, center, right) from header actions.
- Save and cancel explicitly from compact top controls.
- Background page scrolling is locked while editing to keep interaction scoped to the table editor.

### Code Blocks

Notely provides a rich experience for working with code snippets:
- **Auto-detection**: Paste a snippet without a language tag and Notely will automatically detect it (e.g., JavaScript, Python, HTML).
- **Auto-formatting**: Use the 🪄 Format button in the preview hover toolbar or inside the editor to instantly auto-indent and format your code using Prettier.
- **Dedicated Editor**: Click the ✎ Edit button on any code block in Preview mode to open a distraction-free Code Editor popup with syntax highlighting, search, and language selection.
- **Code Execution**: Click the ▶ Run button in the hover toolbar or inside the popup editor to execute JavaScript (`js`), Python (`py`), Bash (`sh`), PowerShell (`ps1`), and HTML live-preview snippets locally. Output is displayed in an integrated high-contrast dark terminal output drawer (with exit status and a "Clear" button). Execution times out automatically after 10 seconds to prevent hanging. For unsupported languages, the run button is disabled with a helpful tooltip.

### Find and replace

Search inside the current note and jump through results quickly.

### Outline navigation

Use **View -> Show Outline** to jump between sections in long notes.

### Focus mode

Use **View -> Focus Mode** to reduce visual distractions.

### Terminal and workspace tools

Use **View -> Show Terminal** to open the embedded terminal.

Use **View -> Terminal Shell** to switch between Auto, Bash, and CMD.

Use **Workspace -> Workspace Activity** to review recent changes across the active workspace.

### Appearance and layout

Notely includes view and appearance controls for different working styles:

- **Settings -> Theme**: System, Light, or Dark
- **View -> Font**: Select from 5 IDE-friendly typefaces (Inter, JetBrains Mono, Fira Code, Cascadia Code, Source Code Pro) applied across all UI labels and controls
- **View -> Tile Notes / Table Notes / Tree Notes**: landing list layout (`Ctrl/Cmd + 1` / `2` / `3`)
- **View -> Comfortable Density / Compact Density**: landing list density (`Ctrl/Cmd + 4` / `5`)
- **View -> Zoom In / Zoom Out / Reset Zoom**: app-scale display controls
- **Drag & Drop Organization**: Move notes between folders, across breadcrumb segments, between files in Tree View (with drop-insertion indicator), or into the Recycle Bin panel. Includes 600ms spring-loaded folder expansion on hover and 1-click Undo toast.

### Note statistics

When editing a note, the status bar displays:

- **Word count**: Live count of words in the active tab content (updates as you type).
- **Line count**: Total number of lines in the document.
- **Reading time**: Estimated reading time in minutes (calculated at 200 words per minute).

Statistics update independently for Raw and Formal editing modes.

### Copy and export

Export note content in different formats directly from the toolbar:

- **Copy as HTML**: copies a nicely formatted version you can paste into other apps
- **Copy as Plain Text**: copies the plain note text

Both actions show success or error feedback via notifications.

### Breadcrumb navigation

The editor displays a breadcrumb trail showing the full folder hierarchy leading to the current note:

- Click any segment to navigate to that folder.
- Helps you keep track of where the current note lives.
- Updates dynamically when you switch notes.

## 3. Quality and Validation

### Markdown validation

Notely reports markdown issues while you edit.

### Typo checking & Spelling Dictionary

Notely flags likely spelling mistakes in real-time as you write (excluding code blocks and raw markdown syntax). 
- **Hunspell engine**: Powered by Hunspell under the hood for accurate, high-quality dictionary checks.
- **Ignore / Add to dictionary**: Right-click on a flagged spelling error in the editor to immediately ignore the word, or click **Add to dictionary** to add it to your custom workspace spelling dictionary.
- **Spelling Dictionary Manager**: Open the command palette (`Ctrl/Cmd+K`) and run **Manage Spelling Dictionary** (or click the settings menu option) to view all custom added words, search them, remove individual words, or clear the dictionary completely.

### Quick problem fixing

When Notely finds a problem, it shows you where it is so you can jump there quickly.

## 4. Search and Discovery

### Global search

Search by note title, folder, details, and note content across the whole workspace.

#### Advanced search patterns

If you know advanced search patterns, you can turn on advanced matching in global search:

- Click the **`.*`** button in the search bar.
- Type your search pattern.
- Notely checks the pattern as you type and tells you if it is invalid.
- Results update as you type.

**Example use cases:**
- Find function definitions: `function\s+\w+\s*\(`
- Find error patterns: `Error: \[[A-Z0-9_]+\]`
- Find API routes: `\/api\/[a-z]+`
- Find imports: `import\s+\{[\w\s,]+\}`

#### Code-aware search

Limit search results to code blocks only:

- Click the **`Code Blocks`** filter button in the search bar (appears alongside All, Notes, Folders, Current Note).
- Search now only matches code sections inside notes.
- Matches appear in code, not normal writing.
- Works with or without advanced matching turned on.

**Example use case:**
- Search for TypeScript patterns only: Select "Code Blocks" filter, search for `interface\s+\w+`

### Content snippets

Search results show match context so you can confirm relevance before opening.

### Workspace graph

Open **Workspace -> Workspace Graph** to see how notes and files connect to each other.

Graph capabilities include:

- Visual note-to-note link mapping
- Media node visibility (images, videos, PDFs, and more)
- Interactive zoom, pan, and drag
- Mini-map for large workspaces

When AI search data is available, the graph can also group notes that are closely related.

## 5. Tasks and Workflow

### Tasks overview

Task checkboxes from your notes appear in several places:

- **Open Tasks panel**: unchecked tasks (`- [ ]`) only.
- **All Tasks panel**: open + closed tasks in one searchable list.
- **Dashboard task summaries**: quick counts and drill-down from landing widgets.
- **Note-level task summary**: open/closed snapshot for the current note.

### Open Tasks panel

The Open Tasks panel collects unfinished tasks from all of your notes into one searchable list.

#### Opening the Open Tasks panel

Open the panel using the Command Palette:

- Press `Ctrl/Cmd + K` to open the command palette.
- Search for "Open Tasks Panel" (or type "tasks", "todos", "checkboxes").
- Press Enter to open.

#### Using the Open Tasks panel

- **Filter tasks**: Use the search input to filter by task text or source note title.
- **View task count**: The header shows the total number of open tasks.
- **Group by source**: Tasks stay grouped by the note they came from.
- **Open source note**: Click the "Open note" link next to any task to navigate to that note and close the panel.
- **Supported task syntax**: Recognizes all markdown task formats:
  - `- [ ] Task text` (dash)
  - `* [ ] Task text` (asterisk)
  - `+ [ ] Task text` (plus)

### All Tasks panel

Use All Tasks when you need both open and completed work in one place.

- Includes open (`[ ]`) and closed (`[x]`) tasks.
- Supports quick filtering and note-grouped review.
- Useful for status reviews, audits, and release checklists.

#### Use cases

- Track action items across project notes
- Get a quick overview of all pending work
- Find tasks by keyword without opening individual notes
- Maintain accountability in team workspaces

## 6. Git Version Control and History

### Native Git Repository
Notely integrates native Git versioning to track your document history. Workspaces can be initialized as Git repositories directly from the Version Control panel.

### Compare, Restore, and Tagging
Open **Version Control -> History** (`Ctrl/Cmd + Shift + H`) or click the **History** button in the note top bar to:
- Compare commits with word-level difference highlighting.
- Toggle between rich **Markdown Preview Mode** and raw **Code View** for line differences.
- Restore the active note to an older revision.
- Add tag references to commits directly from the history timeline.

### Branch, Stash, and Sync Management
The full **Version Control Page** includes tabs to switch branches, create tags, push/pull changes to remote repositories, and stash unstaged changes to keep your workspace tidy.

## 7. Media Management

### Image and file linking

Add images and other files to your notes and link to them when needed.

### Media actions

Rename, replace, annotate, and open media in default apps.

### Screen capture & video recording

Notely supports area-based screen capture and full screen/window video recording directly from the editor.

- **Static Screen Snipping**:
  - Trigger capture from the toolbar icon or `Ctrl/Cmd + Shift + S`.
  - Insert behavior is controlled by **Settings -> Screen Capture** (`Auto Insert` vs `Review Before Insert`).
- **Screen Video Recording**:
  - Click **🎥 Record** on the editor toolbar to open the source picker.
  - **Source Picker**: Choose any connected desktop screen or application window with live thumbnail previews. Includes a **Microphone Toggle (ON/OFF)**.
  - **Auto-Minimize**: Notely automatically minimizes to clear the desktop recording area.
  - **Draggable Floating Overlay**: Always-on-top pill window with timer (`00:00`), Pause/Resume, Mic Mute/Unmute, Stop & Save (`⏹`), and Cancel (`✕`).
  - **Auto-Save & Linking**: Saves `.webm` files under `media/recordings/` and inserts `![Screen Recording](media/recordings/*.webm)` into the note.
  - **Note Preview & Modal Player**: Renders video links as interactive thumbnail cards with `▶ Play Video` badges and frame decoding. Clicking opens a full-screen playback modal with Download and Copy Path options.

### Audio & Meeting Recording with Speech-to-Text

Record voice notes or entire conference calls (Zoom, Google Meet, Teams, YouTube) directly into Notely with synchronized audio and transcription.

- **Dual-Stream Audio Capture**:
  - **Meeting Mode**: Simultaneously captures your local microphone and Windows desktop/system audio loopback, combining them into a single stereo track with Web Audio API mixer.
  - **Microphone Only**: Dedicated voice memo recording.
  - **System Audio Only**: Captures speakers/audio loopback without mic.
- **Speech-to-Text (STT) Transcription**:
  - **Local ONNX Whisper (Offline)**: Runs locally in-app via WebAssembly/ONNX runtime (`whisper-tiny.en`, `whisper-base.en`, `whisper-small`). No internet connection or cloud API keys required.
  - **Cloud Whisper**: High-speed cloud transcription using Groq (`whisper-large-v3`) or OpenAI (`whisper-1`) with API keys configured in AI Settings.
- **Transcript Storage**:
  - Audio files are stored under `media/audio/*.webm`.
  - Transcripts are saved alongside audio in `media/audio/*.json` containing segmented timestamps, speaker attributions, key points, and action items.
- **Workflow Differences**:
- **Media Gallery Integration & Transcripts Filter**:
  - The **Diagrams, Media & PDFs** gallery (`Workspace -> Diagrams, Media & PDFs`) includes a dedicated **Transcripts** filter category alongside Diagrams, Images, Videos, Audio, PDFs, and Documents.
  - Selecting a transcript in the gallery opens a rich inspector showing the AI executive summary, timestamped speaker segments, and a one-click button to copy the full transcript text.
  - **On-Demand Transcript Generation**: Any existing audio or video recording in the Media Gallery has a **Generate AI Transcript** button (`✨`). Clicking it decodes the media track, resamples it to 16kHz mono Float32, runs Whisper (Local ONNX or Cloud Groq/OpenAI based on your AI Settings), and saves a companion transcript JSON file in `media/audio/`.

### Media preview tools

Use zoom and media-aware preview controls to inspect assets.

### Workspace Health media checks

Notely helps detect and manage:

- Missing linked files
- Duplicate media
- Unused media
- Preview failures

You can review where files are used and clean up unused items.

### Image annotation and lifecycle

Image notes and markups are saved separately from the picture itself, so you can keep editing them later.

Those notes stay in sync when you replace, rename, or remove an image.

### Original image backup and restore

Before first edit, Notely stores an original image backup and allows restoring it later.

This helps recover from aggressive crops or accidental edits.

## 8. Diagram Features

### Mermaid diagrams

- Insert Mermaid blocks from the toolbar.
- Write Mermaid syntax in markdown.
- Render in preview modes.

### Excalidraw diagrams

- Insert Excalidraw diagrams in notes.
- Edit visually and save.
- Re-open diagrams from preview for updates.
- Convert an existing note image to an Excalidraw diagram from image right-click menu (**Edit with Excalidraw**).
- Converted diagrams open with the original image already placed underneath so you can trace or mark it up.
- Excalidraw previews have their own right-click actions.
- If the diagram started from an image, you can switch back to the original image later.

## 9. AI Assistance

### AI settings

Set up AI services and sign-in details in **AI -> AI Settings**.

You can set up:

- a writing assistant service for chat and rewriting
- a separate service for smarter search and graph features

### AI chat and commands

Use AI for writing support, note understanding, and quick content actions.

### Semantic features

When AI search data is turned on, Notely can find related notes by meaning, not just exact words.

### What each AI service can do

Not every AI service supports every feature.

Notely shows capability warnings in settings when a selected provider cannot run a feature.

You can also choose which AI model to use in AI settings.

### AI operation feedback

Longer AI actions show progress and completion messages so you know something is happening.

### How recent the AI search data is

Notely shows whether its AI search data is fresh or getting old.

## 10. Peer-to-Peer Sync

### Discovery and pairing

Pair trusted peers using invite codes from **P2P -> P2P Status**.

### Sync status and conflicts

Monitor sync progress and resolve conflicts with built-in conflict tools.

### Security controls

Trust and access controls help keep shared workspaces safer.

## 11. Help and Product Info

### Documentation

Open **Help -> Help Center** (`F1`) for in-app help.

### Keyboard shortcuts

Open **Help -> Keyboard Shortcuts** (`Ctrl/Cmd + /`).

### About dialog

Open **Help -> About Notely** to view app identity and version information.

## 12. Preview and Export

### Web preview

Use Web Preview for richer rendered note viewing with media and diagram support.

### PDF export

Export notes to PDF using the same note preview system used inside the app.

PDF export keeps image quality options and visible image notes where possible.

### Website-style rendering

Website-style output is designed to look close to what you see in preview.

### Workspace zip export

From the landing screen, choose **File -> Export Workspace as Zip**.

The workspace export dialog includes:

- **Export format**:
  - Notes as-is (markdown + assets)
  - PDF-only workspace bundle
  - Web format static package
- **App data toggle**: include the `.notes-app` folder (off by default)
- **Destination**: browse folder and reuse remembered location
- **Filename**: default `notelyproject.zip`, editable before export

This flow is intended for backups, handoff, archival snapshots, and portable workspace sharing.
