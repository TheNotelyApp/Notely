---
title: Embedded Terminal
description: Work with terminal commands, local scripts, and build tools directly inside Notely.
keywords: terminal, shell, bash, cmd, powershell, pty, node-pty, terminal policy, allowlist
category: Workspace
---

# Embedded Terminal

Notely features an integrated, full-featured **Embedded Terminal** powered by `node-pty`. Run project-local commands, build scripts, git commands, and shell utilities without leaving your workspace.

---

## 1. Opening & Toggling the Terminal

- **View Menu**: Open **View → Show Terminal**.
- **Command Palette**: Press `Ctrl/Cmd + K` and select **Show Terminal**.
- **Bottom Panel**: Toggle the terminal drawer at the bottom of your workspace layout.

---

## 2. Shell Selection & Configuration

Select your preferred shell from **View → Terminal Shell**:

- **Auto**: Automatically selects the default shell based on your host operating system.
- **Bash**: Prefers Bash when installed (e.g. Git Bash on Windows or native Bash on macOS/Linux).
- **CMD**: Uses standard Windows Command Prompt (`cmd.exe`).
- **PowerShell**: Uses PowerShell (`powershell.exe` or `pwsh`).

### Custom Shell Path Overrides (Environment Variables)

On Windows systems, you can override default shell binary paths using environment variables:

- `NOTELY_BASH_PATH`: Absolute path to a specific Bash executable.
- `GIT_BASH_PATH`: Fallback path to Git Bash executable.

---

## 3. Working Directory & Lifecycle

- **Workspace Alignment**: The terminal automatically sets its initial working directory (CWD) to your active project workspace root (`{workspace}/`).
- **Session Lifecycle**: Terminal PTY sessions persist as long as the panel is open. Closing the terminal drawer terminates the PTY subprocess cleanly to free system resources.
- **Resize Behavior**: The terminal automatically adjusts its columns and rows dynamically as you resize the panel drawer.

---

## 4. Security Policies & Strict Allowlist Mode

Notely includes enterprise security controls to restrict terminal command execution when operating in sensitive workspace environments:

### Policy Modes (`NOTELY_TERMINAL_POLICY`)

- **Permissive Mode (`permissive`, default)**: Standard interactive shell access allowing any user command.
- **Strict Mode (`strict`)**: Restricts command execution to a pre-approved list of command binaries and enforces user role policies.

### Environment Variable Security Flags

| Variable | Description |
|---|---|
| `NOTELY_TERMINAL_POLICY` | Set to `strict` to enforce command allowlisting. |
| `NOTELY_TERMINAL_REQUIRED_ROLE` | Required user role (defaults to `developer`). |
| `NOTELY_TERMINAL_ALLOWLIST` | Comma-separated list of allowed command executables (e.g. `git,npm,node,dir,ls`). |

::: warning Strict Policy Enforcement
When `NOTELY_TERMINAL_POLICY=strict` is active, any command execution attempt outside the `NOTELY_TERMINAL_ALLOWLIST` is blocked by IPC security guards before spawning.
:::
