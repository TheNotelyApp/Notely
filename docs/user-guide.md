# Notely User Guide

## 1. Product Scope

Notely is a desktop Markdown workspace for structured notes, media-rich documentation, note history, and team collaboration features such as peer-to-peer sync and conflict handling.

## 2. First-Time Setup

### Prerequisites

- Local write access to a workspace directory
- Desktop app installation (development or packaged build)

### Procedure

1. Launch Notely.
2. Open **File -> Notes Folder**.
3. Select the workspace root directory for notes.
4. Confirm the folder path and save.

### Expected Result

- Notely initializes workspace metadata under `.notes-app`.
- Notes and folders become visible in the landing view.

## 3. Authoring Workflow

### Create and organize content

1. Use **File -> New Note** (`Ctrl/Cmd+N`) to create a document.
2. Use folder creation controls to structure the workspace.
3. Use tags in metadata for improved discovery.

### Edit with quality controls

1. Use editor modes (`Edit`, `Split`, `Preview`) based on task.
2. Run **Find or Replace** (`Ctrl/Cmd+F`) for targeted updates.
3. Address validation and typo findings shown by the editor.

### Manage versions

1. Open **File -> Versions** (`Ctrl/Cmd+Shift+H`).
2. Compare current note with a historical snapshot.
3. Restore or delete historical versions as needed.

## 4. Media and Diagram Operations

- Insert, replace, rename, and remove images from note workflows.
- Use image editing controls (crop, rotate, annotations) without destructive text overlays.
- Use Mermaid and Excalidraw support for visual documentation.

### Mermaid workflow

1. Insert a Mermaid block from the markdown toolbar.
2. Write valid Mermaid syntax for the selected diagram type.
3. Use split or preview mode to confirm rendering.
4. Keep diagram sources in-note for Git-friendly review and diffs.

### Excalidraw workflow

1. Insert an Excalidraw diagram from the editor workflow.
2. Edit in the Excalidraw surface and save changes.
3. Notely stores source and rendered image assets for portability.
4. Re-open and iterate directly from the note preview when needed.

### Diagram governance recommendations

- Prefer one diagram per conceptual section to limit review scope.
- Use deterministic naming for diagram assets in long-lived notes.
- Validate rendering before release or export workflows.
- Keep textual explanation below each diagram for accessibility and audits.

## 5. Workspace Navigation and View Controls

- Use **View -> Show Outline** for structure navigation.
- Use **View -> Split Preview** for source/preview synchronization.
- Use **View -> Focus Mode** for distraction reduction.
- Open **Workspace -> Workspace Graph** to explore linked documents and assets.

## 6. Help and Support Surfaces

- **Help -> Help Center** (`F1`) for in-app product documentation.
- **Help -> Keyboard Shortcuts** (`Ctrl/Cmd+/`) for key bindings.
- **Help -> About Notely** for version and build identification.
