# Notely Operations Guide

## 1. Workspace Data Model

### Managed metadata directory

Notely writes app-managed metadata under `.notes-app` in the configured notes root.

### Key data artifacts

- `.notes-app/versions` note snapshot history
- `.notes-app/image-annotations.json` image annotation metadata
- `.notes-app/settings.json` workspace-level app settings

## 2. Safety and Recovery

- Version snapshots support historical restore and comparison.
- Removed notes/folders are moved to managed removed storage.
- P2P conflict artifacts can be inspected and resolved through the conflict center.

## 3. P2P Sync Operations

### Operator workflow

1. Open **P2P -> P2P Status**.
2. Start discovery and verify peer visibility.
3. Create and exchange invite code to establish trust.
4. Monitor sync events and resolve conflicts when reported.

### Security controls

- Trust is explicit and persisted per workspace.
- Encrypted sync payload transport uses workspace keying.
- Workspace keys can be rotated from menu controls.

## 4. AI Operations

- Configure providers in **AI -> AI Settings**.
- Generate embeddings for semantic operations.
- Monitor capability warnings when providers do not support embeddings.

## 5. Diagram Operations (Mermaid and Excalidraw)

- Treat Mermaid sources as code-reviewed markdown artifacts.
- Treat Excalidraw source + rendered output as paired deliverables.
- Verify diagram rendering after major dependency updates.
- Include diagram checks in pre-release content QA for documentation-heavy workspaces.

## 6. Build and Verification

Recommended local validation sequence before packaging:

1. `npm run lint`
2. `npm test`
3. `npm run build`
4. `npm run dist:win` (when preparing distributables)
