import React, { useState, useEffect } from "react";
import { Download, Upload, X, CheckSquare, Square, FolderOpen } from "lucide-react";
import { OverlayDialog } from "./OverlayDialog";
import AppInput from "./AppInput";
import "../styles/ExportImportModal.css";

export function ExportImportModal({ isOpen, mode = "export", onClose, notify, reloadDocuments }) {
  const [tab, setTab] = useState(mode); // "export" or "import"
  const [availableNotes, setAvailableNotes] = useState([]);
  const [selectedNotes, setSelectedNotes] = useState(new Set());
  const [destinationPath, setDestinationPath] = useState("");
  const [fileName, setFileName] = useState("");
  const [importFilePath, setImportFilePath] = useState("");
  const [loading, setLoading] = useState(false);

  const [exportPassword, setExportPassword] = useState("");
  const [importPassword, setImportPassword] = useState("");
  const [requireImportPassword, setRequireImportPassword] = useState(false);

  // Sync tab with mode prop when dialog opens/mode changes
  useEffect(() => {
    setTab(mode);
    setExportPassword("");
    setImportPassword("");
    setRequireImportPassword(false);
  }, [mode, isOpen]);

  // Reset password fields if import file changes
  useEffect(() => {
    setImportPassword("");
    setRequireImportPassword(false);
  }, [importFilePath]);

  // Load default export path once when dialog opens
  useEffect(() => {
    if (!isOpen) return;
    const loadDefaults = async () => {
      try {
        const defaults = await window.notesApi.getNotePackageDefaults();
        if (defaults?.destinationPath) setDestinationPath(defaults.destinationPath);
        if (defaults?.fileName) setFileName(defaults.fileName);
      } catch {
        // ignore — user can still browse manually
      }
    };
    loadDefaults();
  }, [isOpen]);

  // Load all markdown notes in the workspace for selection (including subfolders)
  useEffect(() => {
    if (!isOpen || tab !== "export") return;

    const loadNotes = async () => {
      setLoading(true);
      try {
        let files = [];

        // Primary approach: listWorkspaceTaskDocuments gets all workspace markdown notes across subfolders recursively
        if (typeof window.notesApi?.listWorkspaceTaskDocuments === "function") {
          const docs = await window.notesApi.listWorkspaceTaskDocuments();
          if (Array.isArray(docs) && docs.length > 0) {
            files = docs.filter(
              (d) =>
                d?.entryType === "file" &&
                (d.fileName?.endsWith(".md") || d.filePath?.endsWith(".md"))
            );
          }
        }

        // Fallback approach: BFS walk using listDocuments with proper folderPath payload
        if (files.length === 0 && typeof window.notesApi?.listDocuments === "function") {
          const visited = new Set();
          const seenFiles = new Set();
          const queue = ["ROOT"];

          while (queue.length > 0) {
            const nextFolder = queue.shift();
            const folderArg = nextFolder === "ROOT" ? undefined : nextFolder;
            const entries = await window.notesApi.listDocuments(
              typeof folderArg === "string" ? { folderPath: folderArg } : folderArg
            );

            for (const entry of entries || []) {
              const key = String(entry?.filePath || "").toLowerCase();
              if (!key) continue;
              if (entry?.entryType === "folder") {
                if (visited.has(key)) continue;
                visited.add(key);
                queue.push(entry.filePath);
                continue;
              }
              if (seenFiles.has(key)) continue;
              seenFiles.add(key);
              if (entry.fileName?.endsWith(".md") || entry.filePath?.endsWith(".md")) {
                files.push(entry);
              }
            }
          }
        }

        setAvailableNotes(files);
        setSelectedNotes(new Set(files.map((f) => f.filePath)));
      } catch (err) {
        notify("Unable to load notes list: " + err.message, "error");
      } finally {
        setLoading(false);
      }
    };

    loadNotes();
  }, [isOpen, tab, notify]);

  const handleSelectAll = () => {
    if (selectedNotes.size === availableNotes.length) {
      setSelectedNotes(new Set());
    } else {
      setSelectedNotes(new Set(availableNotes.map((n) => n.filePath)));
    }
  };

  const handleSelectNote = (filePath) => {
    const next = new Set(selectedNotes);
    if (next.has(filePath)) {
      next.delete(filePath);
    } else {
      next.add(filePath);
    }
    setSelectedNotes(next);
  };

  const handleBrowseExport = async () => {
    try {
      const fn = window.notesApi?.selectExportPackageFolder || window.notesApi?.browseExportDestination;
      const res = await fn?.({ defaultFileName: fileName });
      if (!res || res.canceled) return;
      const selected = typeof res === "string" ? res : res.filePath;
      if (selected) {
        if (selected.endsWith(".nly") || selected.endsWith(".note")) {
          const parts = selected.replace(/\\/g, "/").split("/");
          const file = parts.pop();
          const dir = parts.join("/");
          if (dir) setDestinationPath(dir);
          if (file) setFileName(file);
        } else {
          setDestinationPath(selected);
        }
      }
    } catch (err) {
      notify("Failed to choose folder: " + err.message, "error");
    }
  };

  const handleBrowseImport = async () => {
    try {
      const fn = window.notesApi?.selectImportPackageFile || window.notesApi?.browseImportFile;
      const res = await fn?.();
      if (!res || res.canceled) return;
      const selected = typeof res === "string" ? res : res.filePath;
      if (selected) {
        setImportFilePath(selected);
      }
    } catch (err) {
      notify("Failed to choose import file: " + err.message, "error");
    }
  };

  const handleExport = async () => {
    if (selectedNotes.size === 0) {
      notify("Please select at least one note to export.", "warning");
      return;
    }

    setLoading(true);
    try {
      const { runExport } = await import("../services/electronService");
      const notePaths = Array.from(selectedNotes);
      const outputName = fileName ? (fileName.endsWith(".nly") ? fileName : `${fileName}.nly`) : undefined;

      const res = await runExport("note_package", {
        notePaths,
        fileName: outputName,
        password: exportPassword || undefined,
      });

      if (res?.success) {
        onClose();
      } else {
        notify("Export failed: " + (res?.error || "Unknown error"), "error");
      }
    } catch (err) {
      notify("Export failed: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!importFilePath) {
      notify("Please select a .nly or .note package to import.", "warning");
      return;
    }

    setLoading(true);
    try {
      const res = await window.notesApi.importNotePackage({
        packagePath: importFilePath,
        password: importPassword || undefined,
      });

      if (res?.success) {
        notify(`Imported ${res.importedNotesCount} note(s) into workspace.`, "success");
        if (reloadDocuments) await reloadDocuments();
        onClose();
      } else {
        if (res?.passwordRequired) {
          setRequireImportPassword(true);
          notify("This package is password-protected. Please enter the password.", "warning");
        } else {
          notify("Import failed: " + (res?.error || "Unknown error"), "error");
        }
      }
    } catch (err) {
      notify("Import failed: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <OverlayDialog
      open={isOpen}
      onClose={onClose}
      ariaLabel={tab === "export" ? "Export Note Package" : "Import Note Package"}
      cardClassName={`export-import-dialog-card ${tab === "import" ? "import-mode-card" : ""}`}
    >
      <div className="overlay-dialog-header">
        <h2 style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {tab === "export" ? <Upload size={18} /> : <Download size={18} />}
          <span>{tab === "export" ? "Export Note Package" : "Import Note Package"}</span>
        </h2>
        <button
          className="icon-button"
          onClick={onClose}
          type="button"
          aria-label="Close dialog"
          disabled={loading}
        >
          <X size={16} />
        </button>
      </div>

      {tab === "export" ? (
        <div className="tab-content export-tab">
          <p className="tab-description">
            Choose which notes to export. This will bundle all linked images, Excalidraw, and Draw.io diagrams into a secure, encrypted `.nly` file.
          </p>

          <div className="note-selector-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "4px 0" }}>
            <span className="selection-count" style={{ fontSize: "13px", color: "var(--text-muted)", fontWeight: 500 }}>
              {selectedNotes.size} of {availableNotes.length} notes selected
            </span>
            <button
              className="link-button"
              type="button"
              onClick={handleSelectAll}
              disabled={loading || availableNotes.length === 0}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px" }}
            >
              {selectedNotes.size === availableNotes.length ? (
                <>
                  <CheckSquare size={14} />
                  <span>Deselect All</span>
                </>
              ) : (
                <>
                  <Square size={14} />
                  <span>Select All</span>
                </>
              )}
            </button>
          </div>

          <div className="notes-list-container">
            {availableNotes.length === 0 ? (
              <div className="empty-list-message">No notes found.</div>
            ) : (
              availableNotes.map((note) => {
                const isSelected = selectedNotes.has(note.filePath);
                return (
                  <div
                    key={note.filePath}
                    className={`note-selector-row ${isSelected ? "selected" : ""}`}
                    onClick={() => handleSelectNote(note.filePath)}
                  >
                    {isSelected ? (
                      <CheckSquare size={16} className="checkbox-icon checked" />
                    ) : (
                      <Square size={16} className="checkbox-icon" />
                    )}
                    <span className="note-title-cell">{note.title || note.fileName}</span>
                    <span className="note-path-cell">{note.filePath}</span>
                  </div>
                );
              })
            )}
          </div>

          <div className="overlay-dialog-field">
            <span>Password (Optional)</span>
            <AppInput
              type="password"
              placeholder="Set a password to protect this package..."
              value={exportPassword}
              onChange={(e) => setExportPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="overlay-dialog-actions" style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px" }}>
            <button
              className="small-button"
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: "32px", minHeight: "32px" }}
            >
              <X size={14} />
              <span>Cancel</span>
            </button>
            <button
              className="primary-button"
              type="button"
              onClick={handleExport}
              disabled={loading || selectedNotes.size === 0}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: "32px", minHeight: "32px" }}
            >
              <Upload size={14} />
              <span>{loading ? "Exporting..." : "Export Package"}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="tab-content import-tab">
          <p className="tab-description">
            Select a `.nly` or `.note` package file to import notes and all of their dependencies into your current workspace. Any naming collisions will be resolved safely using the package mapping metadata.
          </p>

          <div className="overlay-dialog-field">
            <span>Select Package File</span>
            <div className="browse-row">
              <AppInput
                type="text"
                readOnly
                placeholder="Choose package to import..."
                value={importFilePath}
                disabled={loading}
              />
              <button
                className="small-button"
                type="button"
                onClick={handleBrowseImport}
                disabled={loading}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: "32px", minHeight: "32px" }}
              >
                <FolderOpen size={14} />
                <span>Browse</span>
              </button>
            </div>
          </div>

          {requireImportPassword && (
            <div className="overlay-dialog-field">
              <span>Password Required</span>
              <AppInput
                type="password"
                placeholder="Enter package password..."
                value={importPassword}
                onChange={(e) => setImportPassword(e.target.value)}
                disabled={loading}
              />
            </div>
          )}

          <div className="overlay-dialog-actions" style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px" }}>
            <button
              className="small-button"
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: "32px", minHeight: "32px" }}
            >
              <X size={14} />
              <span>Cancel</span>
            </button>
            <button
              className="primary-button"
              type="button"
              onClick={handleImport}
              disabled={loading || !importFilePath}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: "32px", minHeight: "32px" }}
            >
              <Download size={14} />
              <span>{loading ? "Importing..." : "Import Package"}</span>
            </button>
          </div>
        </div>
      )}
    </OverlayDialog>
  );
}

export default ExportImportModal;
