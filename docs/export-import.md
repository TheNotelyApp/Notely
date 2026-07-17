# Export / Import Note Package

Notely can package one or more notes — together with all their linked assets — into a single portable `.note` file that can be shared with other Notely users and imported directly into any workspace.

## Opening the dialog

Go to **File → Export / Import Note Package** (or use the app menu from the landing screen).

The dialog has two tabs:

| Tab | Purpose |
|---|---|
| **Export Package** | Bundle selected notes into a `.note` file |
| **Import Package** | Unpack a `.note` file into the current workspace |

## Exporting

1. **Select notes** — the list shows every `.md` file in the current workspace. Use **Select All / Deselect All** or click individual rows. The list scrolls when the workspace is large.
2. **Save location** — defaults to the last-used export path with the filename `{workspaceName}.note`. Click **Browse** to choose a different destination.
3. Click **Export Package**.

### What gets bundled

| Asset type | Where it lives | Included |
|---|---|---|
| Markdown files | anywhere in the workspace | ✅ |
| Images / screenshots | `media/images/` | ✅ |
| Excalidraw diagrams | `.notes-app/excali-diagrams/` | ✅ |
| Draw.io diagrams + thumbnails | `media/draw.io/` | ✅ |
| Package metadata | `metadata.json` inside bundle | ✅ auto-generated |

Assets that are locked, missing, or inaccessible at export time are silently skipped; the note itself is still exported.

### Security

- The bundle is **AES-256 encrypted** using a shared app-level key so it is not readable by generic ZIP tools.
- Every file in the bundle is **SHA-256 hashed** and the hashes are stored in `metadata.json`. On import, Notely verifies each hash and rejects tampered packages.

## Importing

1. Switch to the **Import Package** tab.
2. Click **Browse** and pick a `.note` file.
3. Click **Import Package**.

Notely will:

- Decrypt and verify the integrity of the bundle.
- Copy notes into the workspace root (or appropriate subfolder).
- Restore all media assets to their original relative paths.
- Resolve filename collisions automatically so existing files are never overwritten.
- Reload the workspace document list so imported notes appear immediately.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "Export failed: EPERM" | Destination folder is inside an OneDrive-synced path being actively synced | Wait a moment and retry, or choose a local (non-OneDrive) folder |
| "Import failed: integrity check" | The `.note` file was modified or corrupted in transit | Request a fresh export from the sender |
| Notes appear in workspace root instead of a subfolder | Package was exported from a flat workspace | Expected — the import mirrors the original layout |
