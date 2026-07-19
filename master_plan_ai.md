# Notely AI Architecture Refactor — Master Plan

Transform the current ad-hoc AI implementation into a modular, local-first, provider-independent AI platform. Markdown remains the single source of truth. AI becomes a fully independent subsystem.

---

## Codebase Audit

### What Currently Exists

#### Backend — `electron/ai/aiHandlers.cjs` (559 lines)
- IPC handler registration for all AI channels
- Input validation & trusted sender guards
- Mixes config loading, provider wiring, and IPC dispatch in one file
- Directly requires `src/ai/**` — crosses the module boundary

#### Frontend AI — `src/ai/` (fully populated)

| Path | Status |
|---|---|
| `core/Agent.js` | Main orchestrator. Functional. |
| `core/ContextManager.js` | Context assembly. Functional. |
| `core/MemoryManager.js` | Interaction history. Functional. |
| `core/PatternDetector.js` | Detects editing patterns from interaction log. |
| `core/GraphAnalyzer.js` | BFS cluster/hub/path analysis over relationship tables. |
| `core/MemoryOptimizer.js` | DB VACUUM / cache purge. Keep. |
| `database/DatabaseManager.js` | SQLite operations on `app.sqlite`. |
| `database/migrations.js` | 7 migrations. All target `app.sqlite`. |
| `llm/LLMProvider.js` | Abstract base. Keep. |
| `llm/LLMRegistry.js` | Provider registry. Keep & extend. |
| `llm/providerRegistry.js` | Provider definitions registry. |
| `llm/providers/GeminiProvider.js` | Google Gemini. Functional. |
| `llm/providers/GroqProvider.js` | Groq. Functional. |
| `llm/providers/HuggingFaceEmbeddingProvider.js` | HF embeddings. Keep & extend. |
| `llm/providers/OpenAICompatibleProvider.js` | OpenAI stub. |
| `services/DocumentService.js` | File scanning. Keep. |
| `services/EmbeddingService.js` | Cosine similarity search. Keep & extend. |
| `services/RelationshipService.js` | Document relationships. |
| `services/QueryExecutor.js` | Query routing to provider. Keep. |
| `services/SemanticClusteringService.js` | Clustering on top of embeddings. Keep. |
| `utils/AIConfig.js` | Config read/write. Keep & extend. |
| `utils/aiUtils.js` | Helpers. Keep. |
| `utils/ipcProtocol.js` | IPC types. Keep. |
| `utils/logger.js` | Logger. Keep. |
| `index.js` | System bootstrap. |

---

## Target Architecture

### Data Locality Rules

**Global** (lives in `%AppData%/notely/`):
```
ai-config.json       <- API keys (encrypted via safeStorage), provider selections
ai-preferences.json  <- embedding provider choice, AI enabled, model selection, tuning
ai-model/            <- Downloaded ONNX models (BGE-small-en-v1.5, ~130MB)
```

**Workspace-scoped** (lives in `{workspace}/.notes-app/`):
```
ai-embeddings.db     <- chunks, vectors, content hashes, indexing queue
ai-graph.db          <- entity nodes, relationships
ai-memory.db         <- interaction history, conversations, candidate knowledge, patterns
```

---

## Phase Execution Plan

### Phase 1 — Refactoring & Cleanup [COMPLETED]
- Decoupled module boundaries, moved backend components to `/ai/`.
- Removed legacy `WorkspaceGraphPanel` React Flow references.

### Phase 2 — AI Foundation [COMPLETED]
- Integrated Vercel AI SDK wrappers and providers.
- Wired AI Onboarding step.

### Phase 3 — Knowledge Graph [COMPLETED]
- Created the new SQLite-backed Knowledge Graph utilizing recursive CTEs.
- Built the polished `KnowledgeGraph.jsx` sidebar layout and tree flow visualizer.

### Phase 4 — Embeddings Engine [PLANNED]
Establish a local-first embedding system utilizing SQLite and local ONNX model runtimes, accompanied by a dedicated dashboard layout matching the Knowledge Graph.

#### 4.1 Separate Embedding Database
- **[NEW] [EmbeddingDB.js](file:///c:/Users/oksbw/OneDrive/Desktop/Antigravity%20Workspace/Notely/ai/embeddings/EmbeddingDB.js)**: Connection manager targeting `ai-embeddings.db`.
- Schema: `chunks`, `note_hashes`, `indexing_queue`, `indexing_log`.
- One-time migration: copy embedding data from `app.sqlite` to `ai-embeddings.db` on first boot.

#### 4.2 Markdown-Aware Chunker
- **[NEW] [MarkdownChunker.js](file:///c:/Users/oksbw/OneDrive/Desktop/Antigravity%20Workspace/Notely/ai/embeddings/MarkdownChunker.js)**: Parsers to split markdown logically by headings, paragraphs, lists, tables, and code blocks.
- Configurable max chunk size; small chunks preferred.

#### 4.3 Hash Manager & Change Detection
- **[NEW] [HashManager.js](file:///c:/Users/oksbw/OneDrive/Desktop/Antigravity%20Workspace/Notely/ai/embeddings/HashManager.js)**: Prevent redundant operations using SHA-256 checks.
- SHA-256 per note; compare on file change; enqueue only on difference.

#### 4.4 Priority Queue & Worker
- **[NEW] [IndexQueue.js](file:///c:/Users/oksbw/OneDrive/Desktop/Antigravity%20Workspace/Notely/ai/queue/IndexQueue.js)**: Handle queue priority (Current note = 3, Recent = 2, Linked = 1, Other = 0).
- **[NEW] [IndexWorker.js](file:///c:/Users/oksbw/OneDrive/Desktop/Antigravity%20Workspace/Notely/ai/queue/IndexWorker.js)**: Non-blocking background indexing tasks.
- IPC: `ai:worker:pause`, `ai:worker:resume`.

#### 4.5 ONNX Local Embeddings
- Install `onnxruntime-node` and package in `asarUnpack`.
- **[NEW] [ONNXEmbedder.js](file:///c:/Users/oksbw/OneDrive/Desktop/Antigravity%20Workspace/Notely/ai/embeddings/ONNXEmbedder.js)**: Local BGE-small-en-v1.5 vectorization.
- **[NEW] [ModelDownloader.js](file:///c:/Users/oksbw/OneDrive/Desktop/Antigravity%20Workspace/Notely/ai/embeddings/ModelDownloader.js)**: Download assets to `%AppData%/notely/ai-model/`.
- **[NEW] [HFEmbedder.js](file:///c:/Users/oksbw/OneDrive/Desktop/Antigravity%20Workspace/Notely/ai/embeddings/HFEmbedder.js)**: HuggingFace API fallback.
- Global config state: `embeddingProvider: 'internal' | 'huggingface' | 'provider'`.
- Embedding Settings dropdown options:
  - Active LLM Text Provider (use text model if embeddings are supported)
  - HuggingFace API (cloud-based embedding model selection)
  - Local BGE Model (local ONNX model)

#### 4.6 Embeddings UI
- **[NEW] [EmbeddingsPage.jsx](file:///c:/Users/oksbw/OneDrive/Desktop/Antigravity%20Workspace/Notely/src/components/EmbeddingsPage.jsx)**: Full-screen dashboard overlay.
  - Match navigation style, breadcrumbs, topbar, and layout of the Knowledge Graph page.
  - Implement active queue size, processing speed, database size, and logs.
  - Include an interactive "Recreate/Rebuild Everything" button to wipe the store and index the workspace from scratch.
  - Include an embedding data inspector/preview section displaying extracted note chunks, text, line coordinates, and embedding details.

---

### Phase 5 — Context Engine [PLANNED]
**Goal:** Everything sent to an LLM passes through one context assembly pipeline.
- Assemble prompt context from active note, backlinks, graph traversal, and semantic retrieval.
- Create `/ai/context/ContextEngine.js` and `/ai/context/PromptAssembler.js`.
- **[NEW] [SemanticRetriever.js](file:///c:/Users/oksbw/OneDrive/Desktop/Antigravity%20Workspace/Notely/ai/context/SemanticRetriever.js)**: Cosine search over `ai-embeddings.db`.
- **[NEW] [GraphRetriever.js](file:///c:/Users/oksbw/OneDrive/Desktop/Antigravity%20Workspace/Notely/ai/context/GraphRetriever.js)**: KuzuDB / SQLite graph traversals.
- **[NEW] [MemoryDB.js](file:///c:/Users/oksbw/OneDrive/Desktop/Antigravity%20Workspace/Notely/ai/memory/MemoryDB.js)**: SQLite on `ai-memory.db` for conversations.
- **[NEW] [ConversationStore.js](file:///c:/Users/oksbw/OneDrive/Desktop/Antigravity%20Workspace/Notely/ai/memory/ConversationStore.js)**.
- IPC: `ai:conversation:list`, `ai:conversation:get`, `ai:conversation:delete`.
- Candidate knowledge extraction: user confirmation required before writing to graph.

---

### Phase 6 — Settings Overhaul [PLANNED]
**Goal:** Accurate, live, grouped AI settings. No hardcoded lists.
- Refactor `AISettings.jsx` to dynamically load providers and configurations.
- Provider list fetched from `ai:config:get-provider-list`.
- Add Gemini, OpenAI entries (Vercel SDK).
- Dedicated section or page for Embedding settings.
- Tuning Behaviour audit: rename `maxTokensPerQuery` -> `contextTokenBudget`.
- **[NEW] [AIHealthPage.jsx](file:///c:/Users/oksbw/OneDrive/Desktop/Antigravity%20Workspace/Notely/src/components/AIHealthPage.jsx)**: Diagnostic dashboard.

---

### Phase 7 — Finalization [PLANNED]
**Goal:** Tests, docs, legacy removal, zero regression.
- Complete tests: `chunker.test.js`, `embeddings.test.js`, `hash.test.js`, `queue.test.js`, `worker.test.js`, `graph.test.js`, `search.test.js`, `context.test.js`, `provider.test.js`, `tools.test.js`.
- Remove legacy backend JS from `src/ai/`.
- WAL + `synchronous=NORMAL` on all new `.db` files.
- In-memory cache for hot embedding vectors.
- Debounce file-change -> queue: 500ms.
- Graph query result cache TTL: 60s.
- Update `src/ai/README.md` and create `/ai/README.md` with Mermaid diagrams.

---

## Migration Strategy: `app.sqlite` -> Separate `.db` Files
On first boot after upgrade:
1. Detect if `ai_document_embeddings` exists in `app.sqlite`.
2. If yes: copy rows to `ai-embeddings.db`; copy `ai_interactions` + `ai_patterns` to `ai-memory.db`.
3. Drop old `ai_*` tables from `app.sqlite`.
4. Write a migration flag to `app.sqlite` to prevent double-run.

Runs once, atomically, during app startup before AI init.

---

## Key Dependencies to Add

| Package | Phase | Purpose |
|---|---|---|
| `ai` | P2 | Vercel AI SDK core |
| `@ai-sdk/google` | P2 | Gemini provider |
| `@ai-sdk/openai` | P2 | OpenAI + Groq (compatible) |
| `kuzu` | P3 | Knowledge graph database (Optional / Replaced by SQLite) |
| `onnxruntime-node` | P4 | Local ONNX model runtime |

---

## Verification Plan

| After Phase | Check |
|---|---|
| 1 | `npm run dev` boots, AI palette works, WorkspaceGraph gone from menu |
| 2 | enable/disable works, Vercel SDK providers connect, tools callable |
| 3 | Graph page opens, nodes render, rebuild works |
| 4 | Local embedding runs, background indexing works, status accurate |
| 5 | Chat uses embeddings + graph context, conversations persist |
| 6 | Settings show live data, no hardcoded lists |
| 7 | `npm run test` green, `npm run lint` clean, build succeeds |
