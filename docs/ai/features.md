---
title: Using AI Features
description: Learn how to invoke AI chat, use the AI rewrite palette, and explore semantic search.
keywords: AI chat, AI palette, rewrite, summarize, translate, semantic search, diagnostic trace, references
category: AI
---

# AI Features

AI capabilities in Notely are integrated across your editor workspace, left panel dashboards, and settings.

---

## 1. Global & Note-Scoped Chat Panel

You can chat with Notely's assistant in two ways:
- **Note-Scoped**: While editing a note, toggle the assistant from the right side edge or the toolbar to brainstorm inside the active document.
- **Global Chat**: While on the landing page (with no note open), click the **Sparkles** icon under the **Quick Actions** toolbar on the left panel rail. This opens the AI sidebar to chat about the entire workspace.

### Context Scope Options
Inside the chat panel, you can choose what context to send with your message:
1. **Auto**: Selects highlighted text if active, otherwise the current note.
2. **Selection**: Restricts context to active text selection.
3. **Block**: Restricts context to active cursor paragraph.
4. **Note**: Sends the entire note.
5. **Workspace**: Extends context by searching relevant chunks across the whole note library.

### Sourced References
Whenever the assistant retrieves documents to answer your question, a **Referred Notes** chip list is rendered under the assistant message bubble. Hover over these chips to see file paths and relevance match percentages.

---

## 2. AI Palette Actions

Refactor or rewrite text inside the editor:
1. Highlight target text selection in the Markdown editor.
2. Press **`Ctrl + Space`** or right-click and select **AI Actions**.
3. Choose an action from the palette (e.g. Summarize, Change Tone, Improve Readability).

---

## 3. Persona Customization & Markdown Source of Truth

Customize how the AI talks to you:
- Open **AI Settings** and click **Manage Personas**.
- **Markdown Source of Truth**: All personas (builtin and custom) are authored as Markdown files (`.md`) with YAML frontmatter. Custom personas created in the UI are persisted as formatted `.md` files to disk (`appData/personas/*.md`), while SQLite acts strictly as an index.
- Select or edit custom personas, modify frontmatter metadata (tone, verbosity, structure), and update prompt instructions.
- Select a preset emoji avatar (🤖, 💻, 🧠, etc.) next to the custom avatar field to represent them in the chat panel.

---

## 4. Diagnostics, Flow Telemetry & Prompt Tracker Log

If you want to inspect how the AI retrieves data, what system prompts are assembled, or what tools it invokes:
1. Go to **AI Diagnostics** / **AI Health** page.
2. Select a conversation session from the list.
3. Use the dual-tab inspector pane:
   - **Messages**: View clean chat conversation transcript (technical tool execution boxes separated for clutter-free reading).
   - **Flow Telemetry**: View a 3-column continuous timeline stream connecting 5-stage execution breakdown (`AIFlow.js`), latency metrics, persistent session tokens (`LogDB`), expandable tool call arguments/outputs, zero-latency Context Compaction stats (`ai/compaction/`), system prompt inspector (with Copy/Expand), and full flow trace JSON export.
