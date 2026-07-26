---
title: AI Overview
description: Learn about Notely's 13-domain modular, local-first AI platform, AIFlow master orchestrator, and Context Compaction engine.
keywords: ai, local llm, openai, huggingface, vector database, knowledge graph, AIFlow, compaction
category: AI
---

# AI Subsystem Overview

Notely features a 13-domain modular, local-first AI platform designed around private data control. Markdown files remain the absolute source of truth, parsed and indexed into offline-first databases to fuel assistant reasoning.

---

## Capabilities at a Glance

### 1. Master Flow Orchestrator (`AIFlow.js`) & 13-Domain Architecture
- All LLM queries flow through **`AIFlow.js`**, executing a 5-stage pipeline across 13 decoupled domain module facades (`compaction`, `planner`, `personas`, `prompts`, `context`, `graph`, `embeddings`, `memory`, `executor`, `tools`, `grounding`, `formatter`, `testing`).

### 2. Zero-Latency Context Compaction (`ai/compaction/`)
- Automatically compacts long chat sessions (>4 messages) into an Executive Memory Summary + recent 4 turns verbatim, slashing LLM input tokens by **~75-80%** with 0ms overhead.

### 3. SQLite Knowledge Graph
- Outbound relations, tags, and CTE traversals mapped into `ai-graph.db`.
- Visualized interactively in the sidebar.

### 4. Local Embedding Indexer
- High-performance `ai-embeddings.db` storing note chunk vectors.
- Runs entirely offline using a local ONNX runtime for `BGE-small-en-v1.5` embeddings, or falls back to HuggingFace APIs.
- Background Index Worker priority queues processing note changes debounced.

### 5. Persona Registry (Markdown Source of Truth)
- All personas (builtin and custom) use `.md` files with YAML frontmatter as their authoritative Source of Truth.
- SQLite (`personas.db`) acts strictly as an index registry. Custom personas persist as formatted `.md` files to disk (`appData/personas/*.md`).
- Customize instructions, descriptions, metadata, and preset avatar icons (🤖, 💻, 🧠, etc.).

### 6. Diagnostics, Flow Telemetry & Trace Logs
- Professional **AI Health** panel to verify subsystem initialization.
- **Flow Telemetry** tab displaying 5-stage timeline cards, system prompt viewer (Copy/Expand), tool calls, compaction stats, and latency breakdown.
