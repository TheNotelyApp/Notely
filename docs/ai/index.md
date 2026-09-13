---
title: MCP & Local AI Overview
description: Learn about Notely's Model Context Protocol (MCP) server, local-first ONNX embeddings, and SQLite Knowledge Graph engine.
keywords: mcp, model context protocol, local ai, embeddings, knowledge graph, claude desktop, cursor, antigravity
category: AI
---

# MCP & Local AI Overview

Notely provides a local-first platform designed around complete data sovereignty. Markdown notes, tasks, and graphs remain private on your device, while an embedded **Model Context Protocol (MCP)** server securely exposes them to external AI assistants (such as Claude Desktop, Cursor, and Antigravity).

---

## Capabilities at a Glance

### 1. Embedded Model Context Protocol (MCP) Server
- Runs an embedded HTTP Server-Sent Events (SSE) server at `http://127.0.0.1:3721/sse`.
- Supports standard I/O (Stdio) execution via `electron/mcp/cli.cjs` for desktop and command-line AI tools.
- Provides tools for note listing, reading, creation, updates, task aggregation, and semantic note graph traversal.

### 2. Local-First Knowledge Graph Engine
- Extracts entities, tags, and cross-note relations into `{workspace}/.notes-app/ai-graph.db`.
- Powered by an offline zero-shot ONNX model (`GLiNER2-Relex`) running entirely on-device without cloud API dependencies.
- Exposed directly as the `get_note_graph` MCP tool and interactive visualizer.

### 3. Local ONNX Vector Embeddings
- Offline vector embeddings powered by `bge-small-en-v1.5` running locally via ONNX Runtime.
- Notes are chunked and indexed into `{workspace}/.notes-app/ai-embeddings.db`.
- Enables semantic similarity search via the `search_notes` MCP tool.

### 4. Persona Prompts as MCP Prompts
- Authoritative system personas (`general`, `software-engineer`, `technical-architect`, `research-assistant`) and custom workspace personas are exposed through MCP `prompts/list` and `prompts/get`.
- External assistants can adopt your configured persona instructions instantly.

### 5. 1-Click Client Configuration
- Open **Settings → MCP Server** to view server health, port status, and copy ready-to-paste JSON configuration snippets for:
  - Claude Desktop (HTTP SSE)
  - Claude Desktop (Stdio CLI)
  - Cursor
  - Antigravity
