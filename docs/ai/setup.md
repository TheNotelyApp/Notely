---
title: Setting Up AI Providers
description: Configure AI settings, API keys, local endpoints, and feature flags.
keywords: AI settings, API key, OpenAI, Gemini, Groq, HuggingFace, ONNX, BGE embeddings
category: AI
---

# AI Setup

Configure LLM provider models, API tokens, and local vector index settings inside **AI → AI Settings**.

---

## 1. Text Generation Providers

Notely connects to cloud and custom LLM providers using the **Vercel AI SDK**:
- **Google Gemini**: Requires a Gemini API key. Default provider (`gemini-2.0-flash`), recommended for rich tool calling.
- **Groq**: Requires a Groq API key (supports models like `llama-3.3-70b-versatile`, `llama-3.1-8b-instant`, `deepseek-r1-distill-llama-70b`).
- **OpenAI / OpenAI-Compatible**: Connect to OpenAI (`gpt-4o`, `gpt-4o-mini`) or custom compatible endpoints by setting an API Key and custom Base URL.
- **Connection Diagnostics**: Click the **Test** button next to any configured provider in **AI Settings** to verify connection status.

---

## 2. Embedding Index Setup

Vector embeddings enable Semantic Search and Context Retrieval:
- **Local BGE Model (Recommended)**: Runs entirely offline inside your app. Downloads a lightweight `BGE-small-en-v1.5` ONNX model (~130MB) into `%AppData%/notely/ai-model/` and runs vector calculations locally via `onnxruntime-node`.
- **HuggingFace API**: Runs cloud-based embeddings using an API key token.

---

## 3. Knowledge Graph Engine

Relationship extraction and entity graph generation:
- **GLiNER2-Relex ONNX (Always Local)**: The Knowledge Graph uses a dedicated `gliner2-multi-v1-onnx` model running locally via ONNX Runtime. This is separate from your text generation provider — it runs entirely offline with no API key required and is not user-configurable.
- **Model Location**: Downloaded automatically to `%AppData%/notely/models/gliner2-relex/` on first graph build.
- **Confidence Threshold**: Adjustable in AI Settings (`graphConfidence`, default 0.45–0.60). Higher values produce fewer but more precise relationships.

---

## 4. SQLite Database Locality

All AI databases are workspace-scoped and stored inside the hidden `{workspace}/.notes-app/` folder to keep your data local and portable:
1. `ai-embeddings.db`: Stores chunk text, line mappings, content hashes, and indexing queues.
2. `ai-graph.db`: Stores extracted entity nodes and relationships.
3. `ai-memory.db`: Stores conversation sessions, message logs, and persona configurations.
4. `ai-logs.db`: Stores 5-stage execution traces, flow telemetry logs (`FlowTracker`), and prompt tracking payloads (`LogDB`).

PRAGMA `journal_mode = WAL` and `synchronous = NORMAL` are enabled across all databases for high performance without write blocks.
