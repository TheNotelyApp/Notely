---
title: Enterprise MCP Tools & Prompts Reference
description: Reference documentation for Notely Model Context Protocol (MCP) server capabilities, 7 enterprise unified tools, MCP prompts, and dual-transport integration.
keywords: MCP, Model Context Protocol, SSE, Streamable HTTP, AI, Claude Desktop, Cursor, prompts, enterprise tools
category: Developer
---

# Notely Enterprise MCP Tools & Prompts Reference

Notely embeds a high-performance **dual-transport Model Context Protocol (MCP)** server (Streamable HTTP & SSE) enabling external AI clients (such as Google Antigravity, Claude Desktop, Cursor, IDE agents, and LLMs) to query, search, analyze, and manipulate workspace content safely and self-sufficiently without handholding.

---

## 1. Architecture Highlights

- **Dual Transport**: Supports Streamable HTTP (`http://127.0.0.1:3700/mcp`) and SSE (`http://127.0.0.1:3700/sse` with `/messages`).
- **Standard MCP Prompts**: Exposes MCP Prompts primitive (`prompts/list`, `prompts/get`, HTTP `GET /prompts`) for interactive workflows.
- **Enterprise Design**: Merged fragmented micro-tools into **7 self-sufficient, high-signal tools**. Every tool returns rich structured context (match breakdowns, cleansing, frontmatter, backlinks, git history).
- **Safety & Permissions**: Granular write protection toggle (`allowWriteTools`). All write tools require explicit permission. Dry-run mode (`dryRun: true`) supported on destructive operations.
- **Fuzzy Recovery**: Smart path resolution with Levenshtein-based `didYouMean` suggestions on missing files.
- **Atomic File I/O**: Temporary file staging with rename to prevent partial writes or corruption.

---

## 2. The 7 Unified Enterprise Tools

### `search` *(Read-Only)*

Multi-modal search engine for Notely notes & workspace. Supports fulltext keyword matching, regex, YAML frontmatter tags, author, and semantic graph. Optionally queries the web when source is "web" or "all". Returns scored hits with match breakdown.

**Parameters:**
- `query` (`string`): Search keyword, phrase, or regex pattern. Examples: "system architecture", "TODO", "/#v\d+/"
- `source` (`string`): Where to search: "notes" (workspace notes), "web" (external web search), or "all" (both)
- `mode` (`string`): Search strategy. "auto" intelligently detects regex, tags, and semantic intent
- `tags` (`array`): Filter notes matching specific tags (e.g. ["architecture", "draft"])
- `author` (`string`): Filter notes by author or creator from YAML frontmatter
- `folder` (`string`): Limit search scope to a subfolder within the workspace
- `limit` (`number`): Maximum number of results to return (default: 20, max: 50)

### `read_note` *(Read-Only)*

Comprehensive 360° note inspector. Retrieves complete note context in ONE call: raw markdown, cleansed plain text, heading outline, frontmatter metadata, inline tags, embedded media assets (with disk existence), Mermaid/Excalidraw diagrams, checklist tasks, outgoing links, backlinks from other notes, and recent git commit history.

**Parameters:**
- `pathOrTitle` (`string`, required): Note path (e.g. "docs/Architecture.md"), filename ("Architecture.md"), or note title / wikilink ("[[Architecture]]"). Auto-resolves case-insensitively and fuzzy matches if misspelled.
- `include` (`object`): Optional toggles to omit unneeded sections. Defaults to all true.
- `startLine` (`number`): Starting line number for pagination (default: 1)
- `maxLines` (`number`): Maximum lines to return per call to prevent context blowout (default: 400)

### `edit_note` **[W]**

Unified, atomic note authoring and editing engine. Supports creating new notes, replacing content, appending, prepending, line-range patching, heading-anchored insertion, frontmatter metadata merging, note renaming, and safe deletion. All operations use atomic disk staging to prevent file corruption.

**Parameters:**
- `filePath` (`string`, required): Target note path (e.g. "docs/Roadmap.md" or "NewNote.md")
- `operation` (`string`, required): Operation to perform: "create" (new note), "replace" (full content), "append" (add to bottom), "prepend" (add to top), "patch" (targeted search/replace or line edit), "insert_at" (insert at line or heading), "update_frontmatter" (merge metadata), "set_title" (update H1 and meta), "rename" (move/rename), "delete" (remove)
- `content` (`string`): Text content to write, append, prepend, or insert
- `frontmatter` (`object`): Key-value pairs to set or merge in YAML frontmatter
- `patch` (`object`): Parameters for "patch" operation: search and replace strings, or line numbers
- `targetHeading` (`string`): Heading text for "insert_at" operation (e.g. "## Next Steps")
- `newPath` (`string`): New path or filename when using "rename" operation
- `dryRun` (`boolean`): If true, computes and returns the diff without making changes on disk

### `manage_tasks` **[W]**

Workspace-wide and note-level checklist & task manager. Finds, creates, toggles, moves, or archives tasks (- [ ], - [x]). Can filter by status (open, completed, in-progress) and due dates (today, overdue).

**Parameters:**
- `operation` (`string`, required): "list" (scan and return tasks), "create" (add new task), "toggle" (switch [ ] <-> [x]), "complete" (mark [x]), "move" (relocate task to another note), "archive_completed" (move all [x] tasks to bottom section)
- `notePath` (`string`): Specific note file path. Omit for "list" to scan entire workspace.
- `status` (`string`): Filter tasks by status
- `filter` (`string`): Filter tasks by due date: "today" (due today), "overdue" (past due date)
- `taskText` (`string`): Text of the task to create, complete, or move
- `line` (`number`): Specific line number of the task in the note
- `targetNotePath` (`string`): Destination note path when using "move" operation
- `dueDate` (`string`): Optional due date in YYYY-MM-DD format for created task

### `manage_diagrams` **[W]**

Unified visual diagram and whiteboard manager. Reads, creates, and updates Mermaid diagrams inside markdown notes, as well as standalone .excalidraw JSON and Draw.io XML drawing files.

**Parameters:**
- `operation` (`string`, required): "list" (catalog all diagrams), "read" (fetch diagram code/elements), "create" (insert or create drawing), "update" (modify diagram), "delete" (remove diagram)
- `notePath` (`string`): Path of markdown note containing embedded Mermaid diagram
- `filePath` (`string`): Path of standalone .excalidraw or .drawio diagram file
- `diagramIndex` (`number`): Zero-based index of Mermaid diagram if note contains multiple diagrams
- `type` (`string`): Diagram format
- `content` (`string`): Mermaid code string or Excalidraw/Drawio JSON/XML content

### `workspace_overview` *(Read-Only)*

Workspace intelligence, structure, health, and diagnostics. Returns hierarchical folder trees, knowledge graph relationships, disk storage stats, link integrity audits (broken wikilinks), and recent file activity.

**Parameters:**
- `operation` (`string`): "summary" (health & note count), "tree" (folder/file hierarchy), "graph" (wikilink nodes & edges), "lint" (audit broken wikilinks & empty notes), "index" (structured notes catalog), "recent_activity" (recent modified notes)
- `folder` (`string`): Scoped directory for tree, index, or lint operations
- `maxDepth` (`number`): Maximum folder depth for tree hierarchy (default: 4)

### `git_control` **[W]**

Workspace Git version control engine. Inspect status, view diffs, view commit logs, commit changes, branch, pull, push, stash, or revert changes within the workspace repository.

**Parameters:**
- `action` (`string`, required): Git operation to perform
- `message` (`string`): Commit message for "commit" action
- `branchName` (`string`): Branch name for "branch" or "checkout" actions
- `path` (`string`): File path to scope diff or log operations
- `commitHash` (`string`): Commit hash for "revert" action
- `limit` (`number`): Number of commits to return for "log" action

---

## 3. Standard MCP Prompts Reference (5 Prompts)

Notely registers 5 standard MCP prompt templates discoverable via `prompts/list` and executable via `prompts/get`:

| Prompt Name | Arguments | Description |
| :--- | :--- | :--- |
| `summarize_note` | `notePath (req), depth` | Generate an executive summary, key takeaways, and action items for a workspace note. |
| `plan_tasks` | `goal (req), targetNote, includeDates` | Break down a project goal or feature into actionable checklist tasks and append them to a note. |
| `explore_knowledge_graph` | `topicOrNote (req), maxDepth` | Analyze relationships, backlinks, and conceptual clusters around a topic or note in the workspace. |
| `refactor_note` | `notePath (req)` | Clean up an unstructured note: format frontmatter, ensure clean H1-H3 hierarchy, and detect unlinked mentions. |
| `daily_review` | `filter` | Perform a daily briefing: inspect open/overdue tasks across the workspace and summarize recently edited notes. |

---

## 4. Claude Desktop & External Client Configuration

Add Notely to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "notely": {
      "url": "http://127.0.0.1:3700/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_OPTIONAL_TOKEN"
      }
    }
  }
}
```

---

## 5. Write Operations Permission Control

When write access is disabled (`allowWriteTools: false`), all tools marked **[W]** (`edit_note`, `manage_tasks`, `manage_diagrams`, `git_control`) are automatically filtered out from external discovery (`tools/list`) and blocked with a `WRITE_DISABLED` error envelope. Read-only query tools (`search`, `read_note`, `workspace_overview`) remain active and safe to call.
