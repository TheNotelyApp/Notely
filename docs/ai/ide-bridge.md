---
title: External IDE & AI Bridge
description: Seamlessly bridge Notely knowledge vaults to external AI coding assistants including VS Code, Cursor, Claude Code, GitHub Copilot, Antigravity, and Windsurf with real-time context synchronization and live MCP server tooling.
keywords: ide bridge, vscode, cursor, claude code, github copilot, antigravity, windsurf, mcp, prompt transpilation, dynamic context
category: AI
---

# External IDE & AI Bridge

Notely's **External IDE & AI Bridge** turns any external AI coding assistant—such as **VS Code**, **Cursor**, **Claude Code**, **GitHub Copilot**, **Antigravity**, or **Windsurf**—into an expert assistant that natively understands your Notely workspace.

Whenever you open your vault outside of Notely (e.g. using *Open with VS Code* or directly in an external editor), external LLMs immediately receive **vault ontology rules, real-time dynamic context, live MCP server tools, visual diagram manipulation guides, task management capabilities, and prompt workflows**.

---

## 1. How It Works: The Multi-Layer Bridge Architecture

```
+-----------------------------------------------------------------------------+
|                               Notely Engine                                 |
|                                                                             |
|  [Notes Vault] + [Live MCP Server :3700] + [Document & Audio Extractors]    |
|                                     │                                       |
|                  Background AI Context Bridge Worker                        |
|                                     │                                       |
+─────────────────────────────────────┼───────────────────────────────────────+
                                      │ Auto-Sync (Debounced 5s)
                                      ▼
+─────────────────────────────────────────────────────────────────────────────+
|                         Generated Workspace Artifacts                       |
|                                                                             |
|  • .notes-app/ai/instructions.md    (Master conventions, syntax, schemas)  |
|  • .notes-app/ai/dynamic-context.md (Live note sitemap, tasks, graph hubs)  |
|  • .vscode/mcp.json                 (Live MCP server endpoint & auth)       |
|  • .vscode/prompts/*.prompt.md      (Transpiled VS Code slash commands)     |
|  • .cursor/rules/notely-*.mdc       (Transpiled Cursor MDC rules)           |
|  • AGENTS.md / CLAUDE.md / .cursorrules / .github/copilot-instructions.md   |
+─────────────────────────────────────┬───────────────────────────────────────+
                                      │
              ┌───────────────────────┼───────────────────────┐
              ▼                       ▼                       ▼
      [VS Code / Copilot]         [Cursor AI]         [Claude Code / Agent]
```

---

## 2. Generated Bridge Files & Locations

The background worker automatically generates and maintains the following files in your active workspace:

| Target File | Purpose | Target Tool |
| :--- | :--- | :--- |
| **`.notes-app/ai/instructions.md`** | Master instructions on Wikilinks, Markdown hierarchy, diagrams, tasks, and MCP tools. | All LLMs |
| **`.notes-app/ai/dynamic-context.md`** | Real-time workspace sitemap, top knowledge hubs, open tasks, recent activity, and extractions. | All LLMs |
| **`.vscode/mcp.json`** | Registers Notely's local MCP server endpoint and authentication tokens. | VS Code, Copilot, Cursor |
| **`.vscode/prompts/` & `.github/prompts/`** | Transpiles `.notes-app/prompts/*.md` into executable `.prompt.md` slash commands. | VS Code Chat, Copilot |
| **`.cursor/rules/notely-*.mdc`** | Transpiles prompt workflows into scoped Cursor rules. | Cursor AI |
| **`AGENTS.md`** | Root entry point for agentic CLI and AI assistants (Antigravity, Gemini CLI). | Antigravity, CLI Agents |
| **`CLAUDE.md`** | Root entry point for Anthropic Claude Code and Claude Desktop. | Claude Code |
| **`.cursorrules`** | Root configuration rules for Cursor. | Cursor |
| **`.github/copilot-instructions.md`** | Custom instructions for GitHub Copilot Chat. | GitHub Copilot |

---

## 3. Automatic `.gitignore` Isolation

Notely ensures that all machine-specific AI bridge files and local authentication tokens are safely isolated from version control. 

When a workspace is initialized or opened, Notely appends a dedicated, managed block to `.gitignore`:

```gitignore
# >>> Notely AI IDE Bridge Managed >>>
.notes-app/ai/
.vscode/mcp.json
.vscode/prompts/
.github/prompts/
.cursor/rules/notely-*.mdc
# <<< Notely AI IDE Bridge Managed <<<
```

::: tip Independent Git Tracking Toggle
This section is completely separated from `# >>> Notes App Managed >>>` (`.notes-app/`). Toggling whether to track or ignore `.notes-app/` in Git works independently and will never interfere with your AI IDE bridge rules.
:::

---

## 4. Visual Diagram & Prototyping Capabilities

External LLMs reading `instructions.md` are trained on Notely's 4 visual diagram formats and can create or manipulate them on demand:

1. **Mermaid Diagrams**: Inline fenced code blocks (` ```mermaid `) supporting Flowcharts, Sequence Diagrams, Gantt Charts, Class Diagrams, State Diagrams, ER Models, Mindmaps, and Timelines.
2. **Excalidraw Whiteboards**: Stored under `.notes-app/excali-diagrams/<id>/diagram.excalidraw` (JSON shapes) and embedded with `![Excalidraw Diagram](.notes-app/excali-diagrams/<id>/diagram.png){data-diagram-id="<id>"}`.
3. **Draw.io Technical Flowcharts**: Stored under `.notes-app/drawio-diagrams/<id>.drawio` (mxGraph XML) and embedded with `![Draw.io Diagram](.notes-app/drawio-diagrams/<id>.png){data-diagram-id="<id>"}`.
4. **Wireframe Studio**: Stored under `.notes-app/wireframes/<id>.wireframe.json` and embedded with `![Wireframe Diagram](media/wireframes/<id>.png){data-diagram-id="<id>"}`.

---

## 5. Multimodal Assets: Audio & Document Extractions

External coding assistants cannot natively read binary files (`.pdf`, `.pptx`, `.docx`, `.mp3`, `.m4a`). Notely solves this by automatically indexing companion text:

* **Audio Transcripts**: Speech-to-text transcripts generated by Notely are cataloged in `dynamic-context.md` (located in `media/audio/<name>/transcript.json`).
* **Document Extractions**: Extracted text from PDFs, slide decks, spreadsheets, and Word documents is cached under `.notes-app/cache/extracted/` and exposed directly to external assistants and the MCP semantic search engine.

---

## 6. Global Task Management Support

External LLMs are instructed on Notely's task grammar:

* **Checkboxes**: `- [ ]` (open), `- [x]` (completed), `* [ ]`, `1. [ ]`, `[ ]`.
* **Due Dates & Times**: `@due(YYYY-MM-DD)` or `due:YYYY-MM-DD`, `@sched(YYYY-MM-DD)`, `@start()`, `@end()`.
* **Priorities**: `#urgent` / `#p1`, `#high` / `#p2`, `#medium` / `#p3`, `#low`.
* **Mentions & Context**: `@username`, `#category`, `[[Person Note]]`.

External assistants can update task checkbox states directly in the Markdown text or call the live MCP tool `manage_tasks`.

---

## 7. Reusable Prompt Workflows

Custom prompts created in Notely (`.notes-app/prompts/*.md`) or bundled enterprise prompts are automatically transpiled into:

* **VS Code Slash Commands** (e.g. `/summarize_note`, `/plan_tasks`, `/refactor_note`, `/daily_review`, `/synthesize_document`, `/create_diagram`, `/atomic_split`, `/codebase_sync`, `/explore_knowledge_graph`)
* **Cursor Rules** (e.g. `@notely-summarize_note`, `@notely-plan_tasks`)

### Built-in Workflow Prompt Library:

| Prompt Name | Description | Key Arguments |
| :--- | :--- | :--- |
| `summarize_note` | Executive summary, takeaways, and open tasks for any note. | `notePath`, `depth` |
| `plan_tasks` | Break down a feature goal into phased actionable checklist tasks. | `goal`, `targetNote`, `includeDates` |
| `explore_knowledge_graph` | Analyze backlinks, conceptual clusters, and build Mermaid relationships. | `topicOrNote`, `maxDepth` |
| `refactor_note` | Clean note hierarchy, YAML frontmatter, and convert mentions to wikilinks. | `notePath` |
| `daily_review` | Briefing of overdue/today tasks and recently modified notes. | `filter` (`today`, `overdue`, `all`) |
| `synthesize_document` | Read extracted PDF/PPTX/DOCX or audio transcript and produce a structured study note. | `assetPath`, `targetNote` |
| `create_diagram` | Generate a Mermaid flowchart, sequence, class, state, or ER diagram from a note. | `notePath`, `diagramType` |
| `atomic_split` | Split a monolithic document into atomic notes and create an index MOC note. | `sourceNote`, `outputFolder` |
| `codebase_sync` | Cross-reference attached Git repository code against notes for documentation gaps. | `repoName` |

---

## 8. Live MCP Server Integration

When your external IDE is configured with Notely's MCP server (`.vscode/mcp.json`), external agents gain access to 7 high-performance tools:

| MCP Tool | Capability |
| :--- | :--- |
| `read_note` | 360° note inspector (clean text, headings, frontmatter, diagrams, tasks, backlinks, git commits). |
| `edit_note` | Safe, atomic note modifier with diff preview and dry-run safety. |
| `manage_diagrams` | Create, update, read, and list Mermaid, Excalidraw, and Draw.io visual diagrams. |
| `manage_tasks` | Query, aggregate, toggle, and filter tasks across the entire vault. |
| `search` | Hybrid full-text and semantic vector search across notes and extracted binary documents. |
| `get_knowledge_graph` | Explore node degree centrality, backlinks, and conceptual clusters. |
| `workspace_overview` | High-level vault health, statistics, and recent activity feed. |
