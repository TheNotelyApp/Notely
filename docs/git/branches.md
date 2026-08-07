---
title: Branches and Remote Repositories
description: Learn how to manage branches, stash changes, and sync with Git remotes.
keywords: git branch, remote, push, pull, stash, origin, sync
category: Git
---

# Branches & Remote

For advanced collaboration, Notely supports branch switching, tag markers, and remote syncing.

## 1. Branch Management

Switch or create branches in the **Branch** tab of the Version Control page:
- Select from local branches.
- Create a new branch from your current HEAD checkpoint.
- Switch branches to test features or review colleagues' work.

---

## 2. Remote Synchronization (Push/Pull)

Configure an upstream remote (like GitHub, GitLab, or a self-hosted Git server) to sync notes:
- **Pull**: Fetch and merge changes from the remote repository to update your local workspace.
- **Push**: Upload your local commits to the remote repository.

Authentication uses Personal Access Tokens (PAT). When performing remote actions with a PAT, Notely temporarily injects the token into the git remote URL for the operation and immediately restores the clean original URL afterwards, keeping plain-text credentials out of persistent repository settings.

---

## 3. Stashing Changes

If you need to switch branches but have unstaged edits that you aren't ready to commit:
- Click **Stash Changes** to save your work to a temporary shelf.
- To recover stashed work, navigate to the Stash manager and click **Apply Stash**.
