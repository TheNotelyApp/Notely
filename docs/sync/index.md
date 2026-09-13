---
title: Workspace Synchronization
description: Synchronize notes securely using Git version control, note packages, and external syncing solutions.
keywords: sync, git sync, note package, remote, backup
category: Sync
---

# Workspace Synchronization

Notely prioritizes transparent, file-based data sovereignty. Your notes are standard Markdown files stored on your local disk, giving you full freedom to choose how you back up and synchronize them.

---

## 1. Git Version Control (Recommended)

Notely includes full native Git integration directly within the desktop app:

- **Local & Remote Syncing**: Commit, branch, push, and pull changes directly to your private Git repositories (GitHub, GitLab, self-hosted).
- **History & Restore**: Inspect visual diffs for every note change and restore previous versions safely.
- **Git Tab**: Open **Git** in the sidebar to review status, staged files, branches, and remote repositories.

---

## 2. Note Packages (`.note`)

For sharing self-contained project archives without full Git setups:

- Export selected notes with all linked media, Excalidraw whiteboards, and Draw.io diagrams into a single `.note` package via **File → Export / Import Note Package**.
- Bundles are AES-256 encrypted with SHA-256 integrity checks.

---

## 3. External File Synchronization

Because Notely workspaces are regular folders containing Markdown files, you can synchronize them with any trusted file synchronization service:

- **Syncthing**: For decentralized, private device-to-device file replication.
- **Nextcloud / OwnCloud**: For self-hosted private cloud storage.
- **OneDrive / Google Drive / Dropbox**: Standard cloud storage providers.

To keep internal metadata private, Notely automatically manages `.gitignore` to keep `.notes-app/` ignored when version control is active.
