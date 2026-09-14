---
title: MCP Tools & Capabilities Reference
description: Comprehensive reference documentation for Notely Model Context Protocol (MCP) server capabilities, tool suites, write permission controls, and SSE transport integration.
keywords: MCP, Model Context Protocol, SSE, AI, Claude Desktop, tools, capabilities, permissions
category: Developer
---

# Notely MCP Tools & Capabilities Reference

Notely embeds an **HTTP SSE (Server-Sent Events) Model Context Protocol (MCP)** server enabling external AI clients (such as Claude Desktop, Cursor, IDE agents, and LLMs) to query, search, analyze, and manipulate workspace content safely.

---

## 1. Server Architecture & Permission Control

- **Transport Protocol**: HTTP SSE listening by default on `http://127.0.0.1:3700/sse` (messages accepted at `/messages`).
- **Security Guard (`allowWriteTools`)**: Configurable toggle in MCP Settings. When set to `false`, all write operations (`[W]`) are automatically hidden from MCP capability advertisement (`tools/list`) and blocked with a `WRITE_DISABLED` error envelope.
- **Flight Log Telemetry**: All incoming tool call executions are recorded in the local SQLite telemetry database and broadcast via IPC to the **MCP Diagnostics** flight log viewer (`AIHealthPage`).
- **Total Capabilities**: **129 Tools** across 14 specialized suites.

---

## 2. Complete Tool Suites Reference (129 Tools)

### Suite 1: Notes & Document Management (`notes.*`) — 33 Tools

- `notes.read`: Read content of a specific note file in the workspace.
- `notes.create` **[W]**: Create a new markdown note in the workspace.
- `notes.update` **[W]**: Update, append, or overwrite content in an existing note.
- `notes.delete` **[W]**: Delete a note file from the workspace.
- `notes.move` **[W]**: Move or rename a note file within the workspace.
- `notes.read_frontmatter`: Extract and parse YAML frontmatter metadata from a note file.
- `notes.extract_toc`: Extract heading outline (Table of Contents) from a note file.
- `notes.backlinks`: Find incoming and outgoing wiki-style links for a given note.
- `notes.search_replace` **[W]**: Bulk search and replace string or regex across workspace notes.
- `notes.history`: Retrieve revision history and commit logs for a note file.
- `notes.list`: List all markdown notes in the workspace with their paths, sizes, and last modified timestamps.
- `notes.rename` **[W]**: Rename a note file, preserving its folder location. Updates the filename on disk.
- `notes.append` **[W]**: Append text content to the end of an existing note without overwriting existing content.
- `notes.duplicate` **[W]**: Duplicate an existing note to a new path, creating an independent copy.
- `notes.extract_headings`: Extract all headings (H1–H6) from a note file with their levels and line numbers.
- `notes.find_broken_links`: Scan the workspace for [[wikilinks]] that point to notes which do not exist.
- `notes.frontmatter_update` **[W]**: Add or update specific YAML frontmatter fields in a note without touching the body content.
- `notes.count`: Count notes in the workspace, optionally grouped by top-level folder.
- `notes.get_links`: Extract all outgoing [[wikilinks]] and [markdown](links) from a note.
- `notes.insert_at` **[W]**: Insert content at a specific line number or directly after a named heading in a note.
- `notes.stats`: Get detailed stats for a single note: word count, line count, heading count, link count, task count, and file size.
- `notes.bulk_tag` **[W]**: Add or remove frontmatter tags from multiple notes matching a folder or name pattern.
- `notes.read_section`: Read only the content under a specific heading in a note, without reading the entire file.
- `notes.delete_lines` **[W]**: Delete a range of lines from a note file by start and end line number.
- `notes.replace_line` **[W]**: Replace the content of a specific line in a note by line number.
- `notes.extract_code`: Extract all fenced code blocks from a note with their language labels and content.
- `notes.table_of_contents`: Generate a Markdown Table of Contents from the headings in a note and optionally insert it.
- `notes.convert_to_checklist` **[W]**: Convert plain bullet list items (- item) to checklist items (- [ ] item) in a note.
- `notes.merge` **[W]**: Merge content from a source note into a target note with optional separator, and optionally delete source.
- `notes.archive` **[W]**: Move a note file into an Archive/ subfolder within the workspace.
- `notes.set_title` **[W]**: Update or insert the primary top-level heading (# Title) in a markdown note.
- `notes.prepend` **[W]**: Prepend text content to the beginning of a note (after frontmatter if present).
- `notes.template_apply` **[W]**: Instantiate a new note by applying variables ({{title}}, {{date}}, {{time}}, etc.) to a template string or existing template note.

### Suite 2: Workspace Index (`index.*`) — 4 Tools

- `index.build_index`: Generate multi-level index of workspace documents, folder trees, headers, code blocks, tasks, and tag map.
- `index.search_hierarchical`: Multi-level section block & header deep search across documents, headers, tasks, and tags.
- `index.get_tags`: Retrieve tag map and list of documents grouped by tag across the workspace.
- `index.list_notes`: Return a flat list of all notes in the workspace index with titles and relative paths.

### Suite 3: Workspace Metadata & Files (`workspace.*`) — 17 Tools

- `workspace.metadata`: Get workspace metadata, vault name, app version, root directory path, and environment details.
- `workspace.update_metadata` **[W]**: Update workspace metadata settings and configuration flags.
- `workspace.statistics`: Get workspace document counts, storage breakdown, task totals, and health metrics.
- `workspace.recent_activity`: Get chronological list of recently modified notes in the workspace.
- `workspace.export_pdf`: Export or render a note document into PDF format.
- `workspace.list_tree`: Get nested folder hierarchy tree with file counts and byte sizes.
- `workspace.create_folder` **[W]**: Create a new directory folder in the workspace.
- `workspace.delete_folder` **[W]**: Delete a folder directory in the workspace.
- `workspace.search_files`: Search workspace files by name pattern or extension. Returns matching file paths and metadata.
- `workspace.word_count`: Count words, characters, and lines in a note file or across the entire workspace.
- `workspace.rename_folder` **[W]**: Rename a folder in the workspace, preserving all its contents.
- `workspace.find_duplicates`: Find notes with identical titles or very similar filenames across the workspace.
- `workspace.get_size`: Calculate the total disk size of the workspace, broken down by file type.
- `workspace.export_zip` **[W]**: Export all markdown notes from the workspace into a single .zip archive.
- `workspace.lint`: Audit all notes for common quality issues: empty notes, missing H1, unclosed code blocks, and orphaned notes.
- `workspace.index_rebuild` **[W]**: Trigger full cache invalidation and rebuild of workspace search indices.
- `workspace.file_tree`: Generate a hierarchical folder and file tree of the workspace.

### Suite 4: Diagrams & Flowcharts (`diagrams.*`) — 6 Tools

- `diagrams.render`: Validate and format Mermaid diagram markup (flowchart, sequence, class, state, gantt, pie).
- `diagrams.create` **[W]**: Create a new diagram file or append a Mermaid diagram block to a note.
- `diagrams.list`: Scan workspace notes for all embedded Mermaid and Draw.io diagrams.
- `diagrams.read`: Read raw Mermaid diagram code blocks from a target note.
- `diagrams.update` **[W]**: Edit or replace a Mermaid diagram block inside a target note file.
- `diagrams.convert_to_image`: Render Mermaid code block to SVG graphic asset.

### Suite 5: Draw.io Vector Drawings (`drawio.*`) — 6 Tools

- `drawio.read_source`: Read XML diagram source data of a Draw.io file in the workspace.
- `drawio.write_source` **[W]**: Create or update Draw.io XML diagram source file.
- `drawio.write_image` **[W]**: Save rendered PNG/SVG preview image for a Draw.io diagram.
- `drawio.read`: Read raw Excalidraw JSON structure or Draw.io XML markup from drawing files.
- `drawio.update` **[W]**: Write back updated Excalidraw JSON elements or Draw.io XML markup to drawing files.
- `drawio.export_svg`: Export drawing file to clean SVG graphic file in Media/.

### Suite 6: Excalidraw Canvas Diagrams (`excalidraw.*`) — 6 Tools

- `excalidraw.read`: Read the JSON schema and element structure from an .excalidraw drawing file or diagram ID.
- `excalidraw.create` **[W]**: Create a new .excalidraw drawing with elements (rectangles, ellipses, arrows, text, etc.).
- `excalidraw.update` **[W]**: Update elements or add new elements to an existing .excalidraw drawing file.
- `excalidraw.list`: Find and list all Excalidraw drawing files and embedded diagram folders across the workspace.
- `excalidraw.extract_elements`: Extract text labels, shapes, and connected bindings from an Excalidraw drawing.
- `excalidraw.delete` **[W]**: Delete an .excalidraw drawing file and its associated preview PNG from the workspace.

### Suite 7: Media & Assets (`media.*`) — 7 Tools

- `media.list_assets`: Scan workspace for images, audio, video, PDFs, and attachment files.
- `media.extract_used_assets`: Catalog all referenced media files, diagrams, and PDFs with note line numbers and context snippets.
- `media.get_metadata`: Read file size, format, and dimensions of a workspace media asset.
- `media.save_asset` **[W]**: Save binary or base64 attachment file into workspace assets directory.
- `media.delete_asset` **[W]**: Delete a media attachment file from the workspace.
- `media.cleanup_unused`: Find media assets in the workspace that are not referenced by any note. Optionally delete them.
- `media.list`: List all image and media attachment files (.png, .jpg, .svg, .gif, .pdf, .mp3, .mp4, etc.) in the workspace with sizes.

### Suite 8: Task Workspace (`tasks.*`) — 11 Tools

- `tasks.extract`: Extract checklist tasks across notes in the workspace.
- `tasks.update_status` **[W]**: Update the status of a checklist task in a note. Supports open [ ], in-progress [/], and completed [x].
- `tasks.summary`: Group and summarize workspace tasks by note, completion rate, and status.
- `tasks.query`: Query checklist tasks by priority, due date range, status, or assignee tag.
- `tasks.summarize`: Generate summary report of completed vs open tasks across workspace.
- `tasks.create` **[W]**: Create a new checklist task item and append it to a note file.
- `tasks.complete` **[W]**: Mark a task as completed [x] by line number or by matching task text (convenience wrapper).
- `tasks.find_overdue`: Find open tasks with a due: YYYY-MM-DD date that has already passed.
- `tasks.due_today`: Find all checklist tasks in the workspace due today (matching due:YYYY-MM-DD tag with current date).
- `tasks.move` **[W]**: Cut a task line from a source note and append it to a target note.
- `tasks.archive_completed` **[W]**: Move all completed [x] tasks from a note to an archive section (## Completed Tasks) at the bottom.

### Suite 9: Search & Retrieval (`search.*`) — 7 Tools

- `search.notes`: Full-text keyword search across workspace notes.
- `search.similar`: Find semantically similar notes using vector embeddings.
- `search.hybrid`: Hybrid search combining full-text keyword search and vector similarity.
- `search.by_tag`: Find all notes that contain a specific tag in their YAML frontmatter.
- `search.by_date`: Find notes modified within a date range. Dates are ISO 8601 strings (e.g. "2024-01-01").
- `search.by_frontmatter`: Find notes where a specific YAML frontmatter field contains or equals a value.
- `search.regex`: Search all notes using a regular expression pattern. Returns matching lines with file and line context.

### Suite 10: Knowledge Graph & RAG (`knowledge.*`) — 9 Tools

- `knowledge.related_topics`: Traverse knowledge graph relationships around a note or topic.
- `knowledge.find_clusters`: Discover semantic topic clusters across the workspace.
- `knowledge.find_orphans`: Find orphan notes in the workspace that have no incoming or outgoing wiki links.
- `knowledge.status`: Get index status, graph DB node count, and embedding health.
- `knowledge.reindex` **[W]**: Force background reindexing of workspace knowledge graph and embeddings.
- `knowledge.unlinked_mentions`: Find plain text mentions of note titles that can be converted into [[Wikilinks]].
- `knowledge.auto_wikilink` **[W]**: Automatically convert unlinked plain text mentions into [[Wikilinks]] inside a note.
- `knowledge.note_summary`: Generate a structural summary of a note: title, headings, word count, tags, and first paragraph.
- `knowledge.link_graph`: Build a JSON graph of all [[wikilink]] connections between notes in the workspace.

### Suite 11: Git Version Control (`git.*`) — 12 Tools

- `git.status`: Check git working tree status and list modified note files.
- `git.log`: View recent git commit history of the workspace.
- `git.diff`: View git diff of modified notes in the workspace.
- `git.commit` **[W]**: Stage and commit workspace changes.
- `git.branch`: Get the current git branch name and list of all local branches in the workspace.
- `git.stash` **[W]**: Stash uncommitted workspace changes or list/pop existing stashes.
- `git.pull` **[W]**: Pull latest changes from the remote origin for the current branch.
- `git.push` **[W]**: Push committed changes to the remote origin.
- `git.checkout` **[W]**: Checkout an existing branch or create a new one in the workspace repository.
- `git.remote_list`: List all configured git remotes and their URLs for the workspace repository.
- `git.tag_list`: List all git tags in the workspace repository, newest first.
- `git.revert` **[W]**: Revert a specific git commit by its hash, creating a new undo commit.

### Suite 12: Diagnostics & Telemetry (`diagnostics.*`) — 3 Tools

- `diagnostics.check_health`: Run health diagnostics on AI providers, vector database, and graph DB.
- `diagnostics.get_telemetry`: Inspect MCP tool call latency metrics, execution flight logs, and error rates.
- `diagnostics.get_logs`: Fetch recent Notely application log entries from the electron log file.

### Suite 13: External Web (`web.*`) — 2 Tools

- `web.search`: Search the live web for external documentation or references.
- `web.fetch`: Fetch and read text content from a public web page URL.

### Suite 14: Personas & Agents (`personas.*`) — 4 Tools

- `personas.list`: List all available custom and system AI personas.
- `personas.get`: Get details of a specific AI persona by ID.
- `personas.create` **[W]**: Create a new custom AI persona.
- `personas.delete` **[W]**: Delete a custom persona by ID.

### Suite 15: Bundles & Packaging (`export.*`) — 2 Tools

- `export.create_package` **[W]**: Export note + linked media assets into an encrypted .note bundle file.
- `export.import_package` **[W]**: Import and extract a .note package bundle into the active workspace.

---

## 3. Client Integration Example (Claude Desktop)

To connect Claude Desktop to Notely MCP server, add this entry to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "notely": {
      "url": "http://127.0.0.1:3700/sse"
    }
  }
}
```

---

## 4. Write Operations Permission Table

When write access is disabled (`allowWriteTools: false`), all tools marked **[W]** are automatically filtered out from external discovery and blocked from execution. Read-only query tools remain active and safe to call.
