---
title: AI & MCP Capabilities
description: Overview of Notely's Model Context Protocol (MCP) server, external AI integration, local ONNX embeddings, and Knowledge Graph capabilities.
keywords: AI features, MCP, Model Context Protocol, Claude Desktop, Cursor, Antigravity, knowledge graph, vector embeddings, diagnostics
category: AI
---

# AI & MCP Capabilities

Notely adopts a privacy-first, local-centric AI architecture. Rather than relying on intrusive in-editor generative sidebars, conversational interaction is driven by an embedded **Model Context Protocol (MCP)** server, while local background workers handle semantic search embeddings and knowledge graph relation discovery.

---

## 1. External AI Integration via Model Context Protocol (MCP)

Notely embeds a dual-transport **Model Context Protocol (MCP)** server running on port `3700` (`http://127.0.0.1:3700/mcp` and `/sse`). This allows external LLM agents and desktop AI clients (such as Google Antigravity, Claude Desktop, Cursor, and IDE extensions) to interact directly with your notes, tasks, and diagrams.

### 7 Enterprise Unified Tools
External AI assistants have access to self-contained, structured tools:
1. **`search`**: Semantic hybrid search (FTS5 + BGE dense vector cosine similarity).
2. **`read_note`**: Read note content, frontmatter, backlinks, and git revision history.
3. **`edit_note`**: Create, overwrite, or surgical chunk-replace note text with atomic write safety.
4. **`manage_tasks`**: Aggregate open/completed tasks, toggle status, and append checklist items.
5. **`manage_diagrams`**: Read, create, and modify Mermaid, Draw.io, and Excalidraw diagrams.
6. **`workspace_overview`**: Inspect file trees, broken link integrity, graph relations, and disk storage stats.
7. **`git_control`**: Review stage status, commit diffs, commit history, and branches.

### Standard MCP Prompts
Exposes ready-to-run interactive workflows to MCP clients:
- `summarize_note`: Generate executive summaries from note contents.
- `plan_tasks`: Extract action items and checklists from freeform notes.
- `explore_knowledge_graph`: Traverse semantic relationships around specific concepts.
- `refactor_note`: Clean up structure, formatting, and heading hierarchy.
- `daily_review`: Synthesize recently modified notes and pending workspace tasks.

For full schema details and client configuration, see the [Enterprise MCP Tools Reference](/mcp-tools-reference) and [Developer MCP Guide](/developer/mcp).

---

## 2. Local-First Vector Embeddings

Notely indexes your workspace into `{workspace}/.notes-app/ai-embeddings.db`:
- **Local BGE Model**: Uses `BGE-small-en-v1.5` (~130MB) executed on-device via `onnxruntime-node`.
- **Hybrid Semantic Search**: Combines full-text search (SQLite FTS5) with 384-dimensional dense vector embeddings for semantic similarity queries.
- **Background Utility Process**: Document chunking and vector calculations run in a dedicated background worker to keep the editor UI fast and stutter-free.

---

## 3. Knowledge Graph Engine

Notely features an offline, 8-stage Knowledge Graph engine mapped into `{workspace}/.notes-app/ai-graph.db`:
- **Neural Zero-Shot Extraction**: Powered by an offline `gliner2-multi-v1-onnx` neural model running locally.
- **Concept Deduplication & Alias Fusion**: Automatically merges variations of the same concept (e.g. "SQLite DB" and "SQLite Database") using cosine vector similarity (>0.88 threshold).
- **Interactive Visualization**: Explore entity clusters, backlinks, tags, and document references interactively from **Workspace → Workspace Graph** (`Ctrl/Cmd + Shift + G`).

---

## 4. MCP Tools Catalog & Diagnostics

Inspect and test AI operations inside the app:
- **MCP Tools Catalog** (`Ctrl/Cmd + Shift + M`): View all registered MCP tools, test tool execution live with custom arguments, and inspect JSON responses.
- **MCP Diagnostics & Telemetry**: Accessible from the Diagnostics panel, this dashboard displays live connection status, active client sessions, request rates, execution latency, and error logs.
- **AI Settings** (`Ctrl/Cmd + Shift + ,`): Configure LLM provider API keys (Gemini, Groq, OpenAI), embedding engine mode, and Knowledge Graph confidence thresholds.
