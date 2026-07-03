# Notely Feature Reference

This page explains every major user-facing feature in Notely.

## 1. Notes and Workspace

### Notes folder selection

Use **File -> Notes Folder** to choose where your notes are stored.

### Project-aware workspace

Notely supports project scoping so you can keep notes organized by project while still using a shared root workspace.

### Note and folder creation

- Create notes from **File -> New Note** (`Ctrl/Cmd + N`).
- Create folders to group related notes.
- Rename and delete notes from list actions.

## 2. Editor and Writing Experience

### Multiple edit modes

- **Edit**: write markdown source.
- **Split**: source and preview side-by-side.
- **Preview**: read-only rendered output.
- **Web Preview**: richer rendering for selected notes.

### Markdown toolbar

Quick insert actions for headings, emphasis, lists, links, tables, diagrams, and validation.

### Find and replace

Search inside the current note and jump through results quickly.

### Outline navigation

Use **View -> Show Outline** to jump between sections in long notes.

### Focus mode

Use **View -> Focus Mode** to reduce visual distractions.

### Note statistics

When editing a note, the status bar displays:

- **Word count**: Live count of words in the active tab content (updates as you type).
- **Line count**: Total number of lines in the document.
- **Reading time**: Estimated reading time in minutes (calculated at 200 words per minute).

Statistics update independently for Raw and Formal editing modes.

### Copy and export

Export note content in different formats directly from the toolbar:

- **Copy as HTML**: Renders the markdown to HTML and copies to clipboard for pasting into blogs, wikis, or documentation.
- **Copy as Plain Text**: Copies the raw markdown source to clipboard for sharing with collaborators.

Both actions show success or error feedback via notifications.

### Breadcrumb navigation

The editor displays a breadcrumb trail showing the full folder hierarchy leading to the current note:

- Click any segment to navigate to that folder.
- Read-only display that helps orient you in deeply nested workspace structures.
- Updates dynamically when you switch notes.

## 3. Quality and Validation

### Markdown validation

Notely reports markdown issues while you edit.

### Typo checking

Spell and typo checks are integrated into the editor with ignore options for accepted words.

### Fix-focused workflow

Validation issues are listed with quick navigation to affected lines.

## 4. Search and Discovery

### Global search

Search by title, path, metadata, and note content across the entire workspace.

#### Regex search

For advanced pattern matching, enable regex mode in global search:

- Click the **`.*`** button in the search filter bar to toggle regex mode.
- Enter a regex pattern (e.g., `/function_name\(/`, `/Error: \[A-Z0-9_]+/`, `/\/api\/[a-z]+/`).
- Notely validates the pattern in real-time and shows errors if syntax is invalid.
- When invalid, the input field highlights in red and an error message appears.
- Search results update dynamically as you type.

**Example use cases:**
- Find function definitions: `function\s+\w+\s*\(`
- Find error patterns: `Error: \[[A-Z0-9_]+\]`
- Find API routes: `\/api\/[a-z]+`
- Find imports: `import\s+\{[\w\s,]+\}`

#### Code-aware search

Limit search results to code blocks only:

- Click the **`Code Blocks`** filter button in the search bar (appears alongside All, Notes, Folders, Current Note).
- Search now only matches inside markdown code blocks (` ``` ` triple backticks and `` ` `` inline code).
- Matches appear in code context, not surrounding prose.
- Works with or without regex mode enabled.

**Example use case:**
- Search for TypeScript patterns only: Select "Code Blocks" filter, search for `interface\s+\w+`

### Content snippets

Search results show match context so you can confirm relevance before opening.

### Workspace graph

Open **Workspace -> Workspace Graph** to visualize notes and media relationships.

Graph capabilities include:

- Visual note-to-note link mapping
- Media node visibility (images, videos, PDFs, and more)
- Interactive zoom, pan, and drag
- Mini-map for large workspaces

When embeddings are enabled, the graph can also show semantic clusters of related notes.

## 5. Tasks and Workflow

### Tasks overview

Tasks are parsed from markdown task syntax across workspace notes and surfaced in multiple places:

- **Open Tasks panel**: unchecked tasks (`- [ ]`) only.
- **All Tasks panel**: open + closed tasks in one searchable list.
- **Dashboard task summaries**: quick counts and drill-down from landing widgets.
- **Note-level task summary**: open/closed snapshot for the current note.

### Open Tasks panel

The Open Tasks panel aggregates unchecked task items from your entire workspace into a single searchable view.

#### Opening the Open Tasks panel

Open the panel using the Command Palette:

- Press `Ctrl/Cmd + K` to open the command palette.
- Search for "Open Tasks Panel" (or type "tasks", "todos", "checkboxes").
- Press Enter to open.

#### Using the Open Tasks panel

- **Filter tasks**: Use the search input to filter by task text or source note title.
- **View task count**: The header shows the total number of open tasks.
- **Group by source**: Tasks are organized by the note they come from for easy navigation.
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

## 6. Version History and Recovery

### Version snapshots

Notely stores historical versions of notes to support recovery.

### Compare and restore

Open **File -> Versions** (`Ctrl/Cmd + Shift + H`) to compare current and previous versions, then restore when needed.

## 7. Media Management

### Image and file linking

Insert local media and linked files from note workflows.

### Media actions

Rename, replace, annotate, and open media in default apps.

### Screen capture (Windows)

Notely supports area-based screen capture directly from the editor.

- Trigger capture from the toolbar screen icon or `Ctrl/Cmd + Shift + S`.
- Use Windows snip overlay to select an area.
- Insert behavior is controlled by **Settings -> Screen Capture**:
  - **Auto Insert**: captured image is inserted immediately.
  - **Review Before Insert**: open review editor first, then save to insert.
- In review mode, edits are optional; you can save as-is.

The toolbar capture icon shows current mode:

- `A` = Auto Insert
- `R` = Review Before Insert

### Media preview tools

Use zoom and media-aware preview controls to inspect assets.

### Workspace Health media checks

Notely helps detect and manage:

- Missing linked files
- Duplicate media
- Unused media
- Preview failures

You can inspect usage and run cleanup actions, including bulk delete for unused assets.

### Image annotation and lifecycle

Image annotations are stored as metadata (not burned into pixels), so notes remain editable and cleaner over time.

Notely also preserves metadata behavior across replace, rename, and delete actions.

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
- Start converted diagrams with the original image on canvas as a resizable base element for tracing and annotation.
- Use diagram-specific right-click actions on Excalidraw previews (separate from normal image actions).
- Restore the original image reference when a diagram was created from an image. Restore is only shown when origin metadata exists.

## 9. AI Assistance

### AI settings

Configure providers and API keys in **AI -> AI Settings**.

Supported provider setup types:

- Text generation providers (for chat and writing assistance)
- Embedding providers (for semantic and relationship features)

### AI chat and commands

Use AI for writing support, note understanding, and quick content actions.

### Semantic features

When embeddings are enabled, Notely supports semantic search, relationship analysis, and pattern detection.

### Provider capabilities and model selection

Provider capabilities are not identical. Some providers support text generation only, while others also support embeddings.

Notely shows capability warnings in settings when a selected provider cannot run a feature.

You can also choose provider models directly in AI settings.

### AI operation feedback

Long-running AI actions show in-progress and completion feedback so users know what is happening.

### Embedding freshness indicators

Notely tracks embedding freshness and shows staleness indicators in graph workflows.

## 10. Peer-to-Peer Sync

### Discovery and pairing

Pair trusted peers using invite codes from **P2P -> P2P Status**.

### Sync status and conflicts

Monitor sync progress and resolve conflicts with built-in conflict tools.

### Security controls

Workspace trust and key policies help keep collaboration safe.

## 11. Help and Product Info

### Documentation

Open **Help -> Documentation** (`F1`) for in-app help.

### Keyboard shortcuts

Open **Help -> Keyboard Shortcuts** (`Ctrl/Cmd + /`).

### About dialog

Open **Help -> About Notely** to view app identity and version information.

## 12. Preview and Export

### Web preview

Use Web Preview for richer rendered note viewing with media and diagram support.

### PDF export

Export notes to PDF using the same workspace-aware rendering pipeline.

PDF workflows support image quality behavior and preserve annotation overlays in exported output.

### Website-style rendering

Website output uses the same content pipeline so rendered notes stay consistent across preview and export surfaces.

### Workspace zip export

From the landing screen, choose **File -> Export Workspace as Zip**.

The workspace export dialog includes:

- **Export format**:
  - Notes as-is (markdown + assets)
  - PDF-only workspace bundle
  - Web format static package
- **Metadata toggle**: include `.notes-app` folder (default off)
- **Destination**: browse folder and reuse remembered location
- **Filename**: default `notelyproject.zip`, editable before export

This flow is intended for backups, handoff, archival snapshots, and portable workspace sharing.
