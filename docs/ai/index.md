---
title: AI & MCP Overview
description: Learn about Notely's local-first AI platform, embedded Model Context Protocol (MCP) server, SQLite Knowledge Graph, and ONNX vector embeddings.
keywords: ai, mcp, model context protocol, claude desktop, cursor, antigravity, vector database, knowledge graph, bge embeddings
category: AI
---

# AI & MCP Subsystem Overview

Notely features a modular, local-first AI platform designed around private data control. Markdown files remain the absolute source of truth, parsed and indexed into offline-first SQLite databases to fuel semantic search, knowledge discovery, and external agent integrations via Model Context Protocol (MCP).

---

## Capabilities at a Glance

### 1. Embedded Model Context Protocol (MCP) Server
- Runs a dual-transport (Streamable HTTP and SSE) MCP server on `http://127.0.0.1:3700`.
- Connects external AI assistants (Google Antigravity, Claude Desktop, Cursor, and IDE agents) directly to workspace notes, tasks, and diagrams.
- Exposes **7 high-signal enterprise tools** (`search`, `read_note`, `edit_note`, `manage_tasks`, `manage_diagrams`, `workspace_overview`, `git_control`) with atomic write safety and dry-run options.
- Exposes **5 standard MCP prompts** (`summarize_note`, `plan_tasks`, `explore_knowledge_graph`, `refactor_note`, `daily_review`).

### 2. SQLite Knowledge Graph Engine
- Extracts conceptual entities and typed relationships from Markdown documents using an offline `gliner2-multi-v1-onnx` neural model.
- Outbound relations, tags, and CTE traversals are mapped into `{workspace}/.notes-app/ai-graph.db`.
- Explore notes and entity clusters interactively via **Workspace → Workspace Graph** (`Ctrl/Cmd + Shift + G`).

### 3. Local Vector Embedding Indexer
- High-performance vector database (`{workspace}/.notes-app/ai-embeddings.db`) storing note chunk vectors.
- Runs entirely offline using a local ONNX runtime for `BGE-small-en-v1.5` 384-dimensional dense vectors, with optional fallback to cloud embedding APIs.
- Background worker process handles queue processing and debounced note indexing to prevent UI thread latency.

### 4. In-App Tools Catalog & MCP Diagnostics
- **MCP Tools Page** (`Ctrl/Cmd + Shift + M`): Interactive catalog to view tool definitions, test inputs, and verify outputs.
- **AI Health / Diagnostics**: Real-time telemetry dashboard monitoring MCP connection status, client sessions, request volume, and error diagnostics.
- **AI Settings** (`Ctrl/Cmd + Shift + ,`): Configure API providers, embedding options, and Knowledge Graph extraction confidence thresholds.
