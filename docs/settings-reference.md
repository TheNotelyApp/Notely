# Settings Reference

Use this page when you want to understand what each configurable option does in Notely.

## 1. Appearance

### Theme

Open **Settings -> Theme**.

- **System**: follows the operating system theme
- **Light**: always uses the light theme
- **Dark**: always uses the dark theme

Default: **System**

Use this when you want Notely to stay consistent with your desktop or when you need a fixed light or dark theme.

### Zoom

Open **View -> Zoom In**, **Zoom Out**, or **Reset Zoom**.

- Minimum zoom: 75%
- Default zoom: 80%
- Maximum zoom: 200%

Use zoom when UI text or panels feel too small or too large on your display.

## 2. Landing View

### View Mode

Open **View -> Tile Notes** or **View -> Table Notes**.

- **Tile Notes**: visual cards with previews and summary details
- **Table Notes**: denser list-style view for scanning many notes quickly

### Density

Open **View -> Comfortable Density** or **Compact Density**.

- **Comfortable**: more whitespace and larger rows
- **Compact**: denser rows for large workspaces

Use compact density when you want to see more notes at once.

## 3. Editor and Writing

### Typo Check

Open **Edit -> Enable Typo Check**.

- When enabled, Notely checks note text for spelling and typo issues.
- It skips code and diagram content so it does not flag technical text unnecessarily.

Default: **On**

### Outline

Open **View -> Show Outline**.

- Shows a headings-based side panel for the current note
- Hidden automatically while Focus Mode is active

Shortcut: `Ctrl/Cmd + Alt + L`

### Focus Mode

Open **View -> Focus Mode**.

- Hides the outline and reduces surrounding distractions
- Useful for concentrated writing sessions

Shortcut: `Ctrl/Cmd + Alt + F`

## 4. Terminal

### Show Terminal

Open **View -> Show Terminal**.

- Opens or hides the embedded terminal panel
- Useful for project-local commands while staying in Notely

### Terminal Shell

Open **View -> Terminal Shell**.

- **Auto**: lets Notely choose the shell
- **Bash**: prefers Bash when available
- **CMD**: uses Windows Command Prompt

Use Bash if you prefer a Unix-style command line. Use CMD if you prefer standard Windows commands.

## 5. Screen Capture

Open **Settings -> Screen Capture**.

- **Auto Insert**: inserts the captured image immediately into the note
- **Review Before Insert**: opens the review editor before saving and inserting

Default: **Auto Insert**

The toolbar capture button shows the current mode:

- `A` = Auto Insert
- `R` = Review Before Insert

## 6. Local Embeddings, Knowledge Graph & MCP Server

Open **Settings** (`Ctrl/Cmd + ,`) and switch to the desired configuration tab.

### Local Embeddings

- **Offline Vector Model**: Download and manage local ONNX weights (`bge-small-en-v1.5`, 130 MB) for on-device vector search.
- **Active Vector Provider**: Choose between Local ONNX Engine (offline) or HuggingFace Cloud Inference API.
- **Automatic Vector Generation**: Toggle background embedding generation upon note save.
- **Vector Index Statistics & Maintenance**: View total chunks, indexed notes, and database size; trigger index rebuilds or clear the vector cache.

### Knowledge Graph

- **Offline Extraction Model**: Download and manage `GLiNER2-Relex` ONNX weights for zero-shot entity and relation extraction without cloud APIs.
- **Active Extraction Engine**: Select between the local ONNX model or Cloud AI provider.
- **Automatic Relationship Discovery**: Toggle background entity and link extraction when notes are saved.
- **Confidence Threshold**: Fine-tune the extraction confidence slider (30% to 95%).

### Model Context Protocol (MCP) Server

- **Status & Control**: Toggle the embedded HTTP Server-Sent Events (SSE) server on `http://127.0.0.1:3721/sse`.
- **Client Configuration Export**: 1-click JSON snippet generator for **Claude Desktop (SSE)**, **Claude Desktop (Stdio)**, **Cursor**, and **Antigravity**.
- **Exposed Tools & Prompts**: Live list of available tools (`list_notes`, `read_note`, `create_note`, `update_note`, `search_notes`, `get_note_graph`, `list_tasks`) and personas exposed as prompts.

## 7. Workspace Metadata and Git Safety

If your workspace is also a Git folder, Notely can help keep its own support files out of version control.

- **Ignore .notes-app: On**: automatically keeps `.notes-app/` ignored in `.gitignore`
- **Ignore .notes-app: Off**: leaves Git ignore management to you

Use this when your team stores notes in Git but does not want Notely's private support files committed with them.

## 8. Environment Variables

Notely respects system environment variables for advanced runtime configuration:

| Variable | Values | Purpose |
|---|---|---|
| `NOTELY_TERMINAL_POLICY` | `permissive` \| `strict` | Sets execution policy for embedded terminal. `strict` enforces role and command allowlists. |
| `NOTELY_TERMINAL_REQUIRED_ROLE` | `developer` (default) | Required user role when operating in strict terminal policy. |
| `NOTELY_TERMINAL_ALLOWLIST` | Comma-separated strings | Allowed command executables in strict terminal mode (e.g. `git,npm,node`). |
| `NOTELY_BASH_PATH` | File path | Explicit path to Bash binary on Windows hosts. |
| `GIT_BASH_PATH` | File path | Fallback Git Bash executable path on Windows hosts. |
| `NOTELY_LOG_LEVEL` | `debug` \| `info` \| `warn` \| `error` | System logging threshold for `LogDB`. |
| `NOTES_ROOT` | Workspace path | Environment variable override for default workspace directory path. |