---
title: Data & Sync Security
description: Security, storage layout, local encryption, and data protection guidelines for Notely workspaces.
keywords: data, security, sync, git, local storage, notes-app
category: Sync
---

# Data & Sync

This guide explains how Notely stores your data and how to keep work safe when collaborating.

## 1. Where Notely Stores App Data

Notely keeps your notes in your selected workspace folder.

It also creates a `.notes-app` folder for app-managed data such as:

- Note version history
- Workspace settings
- Image annotations

You usually do not need to open or edit those files yourself.

## 2. Keep Your Notes Safe

Notely includes built-in safety features:

- Version history for restoring previous note content
- Managed handling for removed notes/folders
- Conflict tools when synced changes overlap

Best practice: make sure your workspace folder is backed up regularly.

## 3. Sync with Remote Repositories (Git)

1. Open **Tools -> Version Control** (`Ctrl/Cmd + Shift + G`).
2. Add your remote repository URL (GitHub, GitLab, self-hosted).
3. Use **Sync (Pull then Push)** to synchronize note changes across devices.
4. If merge conflicts occur, use the built-in visual diff tool to resolve them cleanly.

## 4. AI & MCP Integration for Daily Use

1. Open **AI -> AI Settings** (`Ctrl/Cmd + Shift + ,`).
2. Configure your preferred Speech-to-Text engine (Local ONNX Whisper or Cloud Groq/OpenAI) and API keys.
3. Connect external AI assistants (Google Antigravity, Claude Desktop, Cursor) directly to Notely via the built-in MCP server on port `3700`.
4. Use hybrid semantic search and knowledge graph discovery locally and securely.

## 5. When to Use Workspace Graph

Open **Workspace -> Workspace Graph** when you want to:

- Find related notes quickly
- Spot disconnected notes
- Understand media-to-note relationships

## 6. Before Sharing or Releasing Notes

Do this quick check:

1. Validate markdown issues.
2. Review typo warnings.
3. Open important diagrams in preview.
4. Confirm linked files still open correctly.
