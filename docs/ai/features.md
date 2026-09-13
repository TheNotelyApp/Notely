---
title: MCP Tools & Prompts Reference
description: Reference of tools, prompts, and resources exposed by Notely's Model Context Protocol (MCP) server.
keywords: MCP tools, MCP prompts, personas, list_notes, read_note, create_note, search_notes, get_note_graph
category: AI
---

# MCP Tools & Prompts Reference

Notely transforms your local note workspace into an MCP endpoint for AI assistants. External models can read notes, create structured documentation, search meaning vectors, and traverse relation graphs.

---

## 1. Exposed MCP Tools

The embedded MCP server exposes the following tools to connected AI assistants:

| Tool Name | Parameters | Description |
|---|---|---|
| `list_notes` | `{ folder?: string, tag?: string }` | List notes in the current workspace with optional folder or tag filtering. |
| `read_note` | `{ notePath: string }` | Read the markdown content and frontmatter metadata of a specific note. |
| `create_note` | `{ title: string, content: string, folder?: string }` | Create a new note file in the workspace with automatic filename sanitization. |
| `update_note` | `{ notePath: string, content: string }` | Replace or update the content of an existing markdown note. |
| `search_notes` | `{ query: string, limit?: number }` | Search workspace notes by keyword or semantic similarity matching. |
| `get_note_graph` | `{ notePath?: string }` | Retrieve the knowledge graph relations, wikilinks, and connections for a note or entire workspace. |
| `list_tasks` | `{ completed?: boolean, notePath?: string }` | Retrieve all pending or completed Markdown tasks across workspace notes. |

---

## 2. MCP Prompts (Personas)

Notely exposes built-in and workspace custom personas as structured MCP Prompts through `prompts/list` and `prompts/get`:

- **`general`**: Balanced, helpful, concise note assistant.
- **`software-engineer`**: Focuses on clean code architecture, design patterns, testing, and debugging.
- **`technical-architect`**: Specializes in system design, trade-offs, scalability, and technical RFC authoring.
- **`research-assistant`**: Emphasizes synthesis, citation, structured analysis, and critical evaluation.
- **Custom Workspace Personas**: Any custom personas authored in your workspace are automatically exposed as prompts.

---

## 3. MCP Resources

- **`notely://note/{notePath}`**: Exposes individual note files directly as Markdown resources with live content subscription capabilities.
