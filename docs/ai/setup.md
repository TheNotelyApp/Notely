---
title: Setting Up MCP & Local AI Engines
description: Configure the embedded MCP server, offline ONNX embedding models, and Knowledge Graph extraction settings.
keywords: MCP server setup, local embeddings, ONNX, Knowledge Graph, GLiNER, Claude Desktop, Cursor
category: AI
---

# Setting Up MCP & Local AI Engines

Configure your local AI models and external AI connections under **Settings** (`Ctrl/Cmd + ,`).

---

## 1. Model Context Protocol (MCP) Server

The embedded MCP server enables external AI applications to interact safely with your Notely workspace:

1. Open **Settings → MCP Server**.
2. Check that the server status indicates **Running (HTTP SSE)** on `http://127.0.0.1:3721/sse`.
3. Select your external client tab:
   - **Claude Desktop (SSE)**: Copy the `notely-sse` JSON configuration snippet into your `claude_desktop_config.json`.
   - **Claude Desktop (Stdio)**: Copy the Stdio CLI command configuration.
   - **Cursor**: Copy the mcpServers definition for Cursor settings.
   - **Antigravity**: Copy the Antigravity IDE configuration block.
4. Restart or reload your AI assistant to establish the connection.

---

## 2. Local Embeddings Setup

Semantic search and vector retrieval run completely offline on your device:

1. Open **Settings → Local Embeddings**.
2. Under **Offline Vector Weights**, click **Download (130 MB)** if weights are not yet present on disk.
3. The model (`bge-small-en-v1.5`) is stored locally in `%AppData%/Notely/notely/ai-model/` and executed via `onnxruntime-node`.
4. Check **Automatic Vector Generation** to keep note vectors updated whenever notes are saved.
5. Click **Rebuild Vector Index** if you modify embedding providers or want a clean index.

---

## 3. Knowledge Graph Engine Setup

Offline entity and relationship extraction:

1. Open **Settings → Knowledge Graph**.
2. Download the offline `GLiNER2-Relex` ONNX model weights to enable zero-shot extraction.
3. Adjust the **Extraction Confidence Threshold** slider (default 60%) to balance recall and precision.
4. Check **Automatic Relationship Discovery** to continuously update the knowledge graph in the background as you write.

---

## 4. Local Database Storage

All local AI indexes are workspace-scoped and stored inside the hidden `{workspace}/.notes-app/` folder:

- `ai-embeddings.db`: Vector chunk records, hashes, and indexing queues.
- `ai-graph.db`: Extracted entity nodes and relation edges.
- `personas.db`: Index of system and workspace personas.
