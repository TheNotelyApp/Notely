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

- **Transport Protocol**: HTTP SSE listening by default on `http://127.0.0.1:3700/sse`.
- **Security Guard (`allowWriteTools`)**: Configurable toggle in MCP Settings. When set to `false` (default: `true`), all write/modification operations (`[W]`) are rejected immediately with a `WRITE_DISABLED` error envelope.
- **Flight Log Telemetry**: All incoming tool call executions are recorded in the local SQLite telemetry database and broadcast via IPC to the **MCP Diagnostics** flight log viewer (`AIHealthPage`).

---

## 2. Complete Tool Suites Reference (50 Tools)

### Suite 1: Notes & Document Management (`notes.*`) — 8 Tools
- `notes.read`: Read content of a note file with start line and max lines parameters.
- `notes.create` **[W]**: Create a new markdown note document in the workspace.
- `notes.update` **[W]**: Update, append, prepend, or overwrite content in a note file.
- `notes.delete` **[W]**: Delete a note file from the workspace directory.
- `notes.move` **[W]**: Move or rename a note file within the workspace.
- `notes.read_frontmatter`: Extract and parse YAML frontmatter metadata from a note header.
- `notes.extract_toc`: Extract heading outline (Table of Contents) from a note.
- `notes.backlinks`: Find incoming and outgoing wiki-style links (`[[Link]]`) for a note.

### Suite 2: Workspace Index (`index.*`) — 3 Tools
- `index.build_index`: Generate multi-level index of workspace documents, folder trees, headers, code blocks, tasks, and tag map.
- `index.search_hierarchical`: Multi-level section block & header deep search across documents, headers, tasks, and tags.
- `index.get_tags`: Retrieve tag map and list of documents grouped by tag across the workspace.

### Suite 3: Workspace Metadata & Analytics (`workspace.*`) — 5 Tools
- `workspace.metadata`: Get workspace metadata, vault name, app version, root directory path, and environment details.
- `workspace.update_metadata` **[W]**: Update workspace metadata settings and configuration flags.
- `workspace.statistics`: Get workspace document counts, storage breakdown, task totals, and health metrics.
- `workspace.recent_activity`: Get chronological list of recently modified notes in the workspace.
- `workspace.export_pdf`: Export or render a note document into PDF format.

### Suite 4: Diagrams & Flowcharts (`diagrams.*`) — 3 Tools
- `diagrams.render`: Validate and format Mermaid diagram markup (flowchart, sequence, class, state, gantt, pie).
- `diagrams.create` **[W]**: Create a new diagram file or append a Mermaid diagram block to a note.
- `diagrams.extract`: Extract all Mermaid diagram code blocks from a workspace note.

### Suite 5: Draw.io Vector Drawings (`drawio.*`) — 2 Tools
- `drawio.create` **[W]**: Create a new `.excalidraw` / `.drawio` vector drawing asset file in the workspace.
- `drawio.inspect`: Parse element count, layers, and text blocks from a `.excalidraw` drawing file.

### Suite 6: Media & Assets (`media.*`) — 3 Tools
- `media.scan_assets`: Scan workspace `Media/` assets directory for images, audio, video, and attachments.
- `media.extract_exif`: Extract EXIF metadata, dimensions, and camera specs from image assets.
- `media.convert_format` **[W]**: Convert image or media asset files between supported formats.

### Suite 7: Task Workspace (`tasks.*`) — 3 Tools
- `tasks.extract`: Extract all GFM checklist tasks (`- [ ]`, `- [x]`) across workspace notes.
- `tasks.update_status` **[W]**: Toggle task status (completed/pending) in source note file.
- `tasks.create_task` **[W]**: Append a new GFM task item to a note file.

### Suite 8: Knowledge & Vector RAG (`knowledge.*`) — 4 Tools
- `knowledge.query_graph`: Query Knowledge Graph entity nodes, relations, and connected concepts.
- `knowledge.semantic_search`: Perform vector similarity RAG search over note embeddings.
- `knowledge.extract_entities`: Run NLP entity extraction on text to identify topics and relationships.
- `knowledge.build_embeddings` **[W]**: Rebuild workspace vector embeddings database.

### Suite 9: Git & Diagnostics (`git.*`, `diagnostics.*`) — 4 Tools
- `git.status`: Get Git working tree status (modified, staged, untracked files).
- `git.recent_commits`: Retrieve commit history log for the active workspace repository.
- `diagnostics.health_check`: Get MCP server status, memory usage, uptime, and database health.
- `diagnostics.flight_log`: Retrieve telemetry event log of recent MCP tool executions.

### Suite 10: Web & Personas (`web.*`, `personas.*`) — 4 Tools
- `web.search`: Search external web resources and documentation.
- `web.fetch_page`: Fetch and index web page content into markdown.
- `personas.list`: Retrieve list of configured AI system personas and prompt presets.
- `personas.switch` **[W]**: Switch active AI system persona configuration.

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
