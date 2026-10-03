---
title: Git Synchronization & Remote Backup
description: Sync notes securely between devices using Git remote repositories (GitHub, GitLab, self-hosted).
keywords: Git, sync, remote, push, pull, version control, backup
category: Sync
---

# Git Sync

Notely integrates directly with Git to provide robust, decentralized version control and multi-device synchronization.

---

## 1. Setting Up Remote Sync

1. Open **Tools → Version Control** (`Ctrl/Cmd + Shift + G`).
2. If the workspace is not initialized, click **Initialize Git Repository**.
3. Under the **Remotes** section, add your remote repository URL (e.g. `git@github.com:username/notes.git` or `https://...`).
4. Configure SSH keys or credential helpers as needed.

---

## 2. Syncing Notes (Pull & Push)

- **One-Click Sync**: Use the title bar menu **Tools → Version Control → Sync (Pull then Push)** or the Git sidebar action.
- **Pull**: Fetches and merges updates from the configured tracking branch.
- **Push**: Publishes local commits to the remote repository.

---

## 3. Conflict Resolution

- When remote changes overlap with local edits, Git creates conflict markers.
- Notely's built-in **Git Version Control** panel highlights conflicted files with a dedicated diff viewer, allowing you to resolve and stage changes seamlessly.

