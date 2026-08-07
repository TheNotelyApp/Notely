---
title: Peer-to-Peer Sync
description: Sync notes securely between devices using peer-to-peer pairing over local networks.
keywords: P2P, sync, peer-to-peer, discovery, invite code, conflict resolution
category: Sync
---

# P2P Sync

Notely includes a native peer-to-peer (P2P) synchronization subsystem (`p2pLive.cjs` & `p2pSyncEngine.cjs`), allowing you to replicate notes directly between local devices without cloud servers or third-party storage.

---

## 1. Network Discovery & Transport Security

- **UDP Network Discovery (Port 47653)**: Devices broadcast periodic UDP discovery packets every 4 seconds across the local network subnet to locate active Notely peers.
- **TLS/TCP Transport**: Peer-to-peer payload transfers execute over encrypted TCP connections.
- **AES-256-GCM End-to-End Encryption**: Note deltas and workspace data payloads are encrypted using 256-bit AES-GCM with unique 12-byte initialization vectors (`iv`) and auth tags (`tag`).
- **Workspace Keys & Key TTL**: Pairing generates a 256-bit workspace key stored in global `app.sqlite`. Workspace key expiration (TTL) is configurable from **1 to 365 days** (default 30 days). Expired keys automatically trigger re-authentication.

---

## 2. Pairing Devices & Invite Flow

1. Open **P2P → P2P Status** (`Ctrl/Cmd + Shift + P`) on both devices.
2. Click **Start Discovery** to scan the local subnet for peers on port 47653.
3. On device A, click **Generate Invite** to create a short-lived, 5-minute invite code (`INVITE_TTL_MS = 300000`).
4. On device B, click **Pair with Peer**, enter the invite code, and confirm authorization.
5. Once accepted, add the peer to your **Trusted Peers** whitelist.

---

## 3. Delta Note Merging & Conflict Resolution

- **3-Way Line Delta Engine**: Edits are processed incrementally using line-level note diffs (`buildNoteDelta` / `applyNoteDelta`). Small non-overlapping changes merge automatically without prompting.
- **Automatic Retry Policy**: Unreachable or interrupted sync requests automatically retry up to **5 times** at 2-second intervals (`SYNC_RETRY_INTERVAL_MS = 2000`).
- **Conflict Snapshot Copying**: If simultaneous edits modify the exact same line block on two devices before a delta is applied:
  1. Notely creates a timestamped conflict file: `[note-name].sync-conflict-[timestamp].md`.
  2. Automated sync halts for that specific note to prevent data corruption.
  3. The **P2P Status Panel** alerts you to the conflict.
  4. Open the **Conflict Resolution Panel** to compare versions side-by-side and choose **Keep Local**, **Keep Remote**, or **Merge Manually**.

---

## 4. Key Rotation & Security Controls

- **Rotate Keys**: Generate a new 256-bit workspace key at any time from P2P Settings. Rotated keys are pushed securely to connected trusted peers.
- **Revoke Peers**: Remove any device from your **Trusted Peers** list to block future connection handshakes instantly.

