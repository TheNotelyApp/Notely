---
title: Tasks Management
description: Comprehensive documentation for task tracking, interactive preview task toggling, task detail modal, bi-directional markdown synchronization, and workspace-wide task management in Notely.
keywords: tasks, checklists, todos, task workspace, task detail modal, bi-directional sync, deduplication
category: Workspace
---

# Tasks & Checklists

Notely turns standard Markdown checklist checkboxes into a workspace-wide task management system. Tasks written inside any note automatically sync in real-time with a SQLite task database, providing bi-directional status updates, detail management, and workspace-wide task views.

---

## 1. Creating Tasks in Notes

Create tasks inside any note using standard Markdown checklist syntax:

```markdown
- [ ] Open task
- [x] Completed task
1. [ ] Numbered list task
- [ ] High priority task #work @alex
```

### Supported Formats
- **Bullet Lists**: `- [ ]`, `* [ ]`, `+ [ ]`
- **Numbered Lists**: `1. [ ]`, `2. [ ]`
- **Standalone Paragraph Tasks**: `[ ] Standalone task`

---

## 2. Interactive Preview Toggling & Task Modal

When viewing notes in **Preview Mode** or **Split View**:

- **Click to Toggle**: Clicking the `[ ]` checkbox directly toggles its status between `Open` (`[ ]`) and `Completed` (`[x]`).
- **Interactive Task Modal**: Clicking the task text opens the **Task Detail Modal** where you can manage extended task attributes:
  - **Status**: Toggle between `Open`, `In Progress`, and `Completed`.
  - **Priority**: Set priority levels (`Low`, `Medium`, `High`, `Urgent`).
  - **Due Date & Scheduling**: Assign due dates, start/end times, and all-day flags.
  - **Assignees & Tags**: Tag team members or add custom categories.
  - **Comments**: Add discussion threads to individual tasks.
  - **Note Source Link**: Jump directly to the exact line number in the source note.

---

## 3. Bi-Directional Markdown Synchronization

Task statuses update bi-directionally between your Markdown files and the Task Workspace:

```
+------------------+         Real-Time IPC         +-------------------+
|  Markdown Note   |  <=========================>  | SQLite Task DB &  |
| (- [x] Task 1)   |   Pre-Save Buffer Sync    | Task Workspace UI |
+------------------+                               +-------------------+
```

- **Markdown → Task DB**: Edits inside the text editor automatically sync to the task database whenever the note is saved.
- **Task DB → Markdown**: Updating task status from the Task Workspace or Task Detail Modal writes `- [x]` or `- [ ]` directly back into the `.md` file.
- **Buffer Safety**: Active unsaved editor changes are committed to disk before task updates execute, preventing data loss, file watcher hash mismatches, or disk conflict warnings.

---

## 4. Smart Alignment & Deduplication Engine

Notely uses a **4-pass alignment algorithm** to maintain task identity across note refactoring and line shifts:

1. **Pass 1: Exact Hash Match**: Matches `SHA1(filePath + title + occurrenceIndex)`.
2. **Pass 2: Line Number Match**: Preserves task identity when task titles are edited on the same line index.
3. **Pass 3: Fuzzy Similarity Match**: Uses Jaccard word similarity (>0.35 threshold) to track tasks when lines move and title text is tweaked simultaneously.
4. **Pass 4: Orphan Purging**: Auto-removes database records when tasks are permanently deleted from a Markdown file.

---

## 5. Note-Level Task Bar & Workspace Dashboard

### Note-Level Task Summary
When editing any note, the top header displays a live task completion progress indicator (e.g. `2/5 tasks`). Clicking this indicator opens the **Task Summary Popover**, listing all open and completed tasks for that note with direct line-jump buttons.

### Workspace Task Page
Access the full Task Workspace via the left sidebar or Command Palette (`Ctrl + Shift + T`):
- **Filter by Note**: Focus on tasks from the active note or view tasks across all project notes.
- **Status Tabs**: Easily switch between `All`, `Open`, `In Progress`, and `Completed`.
- **Search & Sort**: Filter tasks by title, priority, due date, or assignee.
