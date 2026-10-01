---
title: Attached Code Repositories
description: Guide to attaching, indexing, and monitoring external Git repositories in Notely.
keywords: git, repositories, code, ast, knowledge graph, code monitoring, symbols
category: Workspace
---

# Attached Code Repositories

Notely allows you to attach external local **Git repositories** to your workspace. This bridges the gap between your documentation notes and your codebase, powering deep AST symbol indexing, cross-referencing, and unified Knowledge Graph queries.

---

## 1. Overview & Capabilities

When you attach a code repository to Notely:
- **Zero Copying**: Your codebase stays in its original location on disk; Notely only registers its metadata path.
- **AST Symbol Extraction**: Notely's `CodeKnowledgeSource` engine scans code files across 8+ programming languages to extract modules, classes, functions, routes, and data models.
- **Bi-directional Knowledge Graph Links**: Code symbols and modules become first-class graph entities (`CodeModule`, `CodeClass`, `CodeFunction`, `APIEndpoint`, `DBModel`) that link semantically to your architectural and design notes.
- **Note Cross-Referencing**: Mention any repository name in your notes using `[[RepoName]]` or `@RepoName` to link your notes with that codebase.

---

## 2. Attaching a Repository

To attach a repository to your active workspace:

1. Open the **Attached Repositories** page:
   - Click the **Attached Repositories** button on the Landing Dashboard.
   - Or select **Workspace → Attached Code Repositories** in the top menu bar.
   - Or press `Cmd/Ctrl + K` and type `Attached Repositories`.
2. Click **Attach Repo** (`+`) in the top-right toolbar.
3. Provide repository details:
   - **Folder Path**: Enter or browse (`Browse`) to the local Git repository directory.
   - **Display / Alias Name**: (Optional) Friendly name for the repo (e.g. `backend-api`, `web-client`).
   - **Branch**: (Optional) Target tracking branch (defaults to `main`).
4. Click **Attach Repository**.

Notely immediately saves the repository entry into your workspace's `.notes-app/metadata.json` file.

---

## 3. Code Knowledge Graph & AST Indexing

Once attached, clicking **Rescan Graph** triggers Notely's offline AST parsing engine:

### Supported Languages & File Extensions
- **JavaScript & TypeScript**: `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`
- **Python**: `.py`
- **Go**: `.go`
- **Rust**: `.rs`
- **Java**: `.java`
- **C & C++**: `.c`, `.cpp`, `.h`, `.hpp`
- **C#**: `.cs`
- **Ruby & PHP**: `.rb`, `.php`
- **Frontend Components**: `.vue`, `.svelte`

### Extracted Entities & Relationships

| Entity Type | Description |
| :--- | :--- |
| `CodeModule` | Code file/module representation within the repository structure |
| `CodeClass` | Declared classes, struct definitions, and class inheritances |
| `CodeInterface` | TypeScript interfaces and type definitions |
| `CodeFunction` | Exported functions, arrow functions, and method definitions |
| `APIEndpoint` | HTTP routes (e.g. `GET /api/v1/users`, `POST /login`) |
| `DBModel` | Schema definitions and database models |

The graph automatically constructs `CONTAINS`, `IMPORTS`, and `DOCUMENTS` relationships, allowing you to explore your system architecture interactively in the **Knowledge Graph** view (`ai-graph`).

---

## 4. Monitoring & Inspector Drawer

Selecting any attached repository opens the **Inspector Drawer** on the right side:

- **Local Path & Commit Hash**: Displays the full directory path, tracking branch, and recent HEAD commit hash.
- **Referenced Notes**: Automatically queries all markdown documents in the workspace and lists notes mentioning the repository (`[[RepoName]]`), complete with 1-click note navigation.
- **Copy WikiLink (`[[Name]]`)**: Copies the formatted wikilink tag to your clipboard for quick pasting into markdown notes.
- **Open in VS Code**: Direct `vscode://file/...` protocol integration to open the selected repository in VS Code immediately.
- **Reveal in File Explorer**: Opens the repository root folder in the native operating system file manager.

---

## 5. Knowledge Graph Visualization

In the **Knowledge Graph** (`Workspace → Knowledge Graph` or `Cmd/Ctrl + G`), code entities from attached repositories appear with distinct visual badges and colors:

- **Purple**: Classes (`CodeClass`) and Interfaces (`CodeInterface`)
- **Sky Blue**: Functions (`CodeFunction`) and Exports
- **Indigo**: Modules (`CodeModule`) and Import chains
- **Amber**: API Endpoints (`APIEndpoint`)
- **Emerald Green**: Data Models (`DBModel`)

Clicking any code node highlights its incoming and outgoing dependencies, enabling architecture verification directly within your note-taking environment.
