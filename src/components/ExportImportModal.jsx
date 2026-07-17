import React, { useState, useEffect } from "react";
import { Download, Upload, X, CheckSquare, Square } from "lucide-react";
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

  // Sync tab with mode prop when dialog opens/mode changes
  useEffect(() => {
    setTab(mode);
  }, [mode, isOpen]);

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

  // Load all markdown notes in the workspace for selection
  useEffect(() => {
    if (!isOpen || tab !== "export") return;

    const loadNotes = async () => {
      setLoading(true);
      try {
        const files = [];
        const visited = new Set();
        const seenFiles = new Set();
        const queue = ["ROOT"];

        while (queue.length > 0) {
          const nextFolder = queue.shift();
          const folderArg = nextFolder === "ROOT" ? undefined : nextFolder;
          const entries = await window.notesApi.listDocuments(folderArg);

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
        setAvailableNotes(files);
      } catch (err) {
        notify("Failed to list workspace notes: " + err.message, "error");
      } finally {
        setLoading(false);
      }
    };

    loadNotes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, tab]);

  if (!isOpen) return null;

  const handleSelectNote = (filePath) => {
    const next = new Set(selectedNotes);
    if (next.has(filePath)) {
      next.delete(filePath);
    } else {
      next.add(filePath);
    }
    setSelectedNotes(next);
  };

  const handleSelectAll = () => {
    if (selectedNotes.size === availableNotes.length) {
      setSelectedNotes(new Set());
    } else {
      setSelectedNotes(new Set(availableNotes.map(n => n.filePath)));
    }
  };

  const handleBrowseExport = async () => {
    try {
      const defaultName = `export_${Date.now()}.note`;
      const result = await window.notesApi.browseExportDestination({ defaultFileName: defaultName });
      if (!result.canceled && result.filePath) {
        // Extract dir and file
        const fullPath = result.filePath.replace(/\\/g, "/");
        const idx = fullPath.lastIndexOf("/");
        const dir = fullPath.slice(0, idx);
        const name = fullPath.slice(idx + 1);
        setDestinationPath(dir);
        setFileName(name);
      }
    } catch (err) {
      notify("Folder browser failed: " + err.message, "error");
    }
  };

  const handleBrowseImport = async () => {
    try {
      const result = await window.notesApi.browseImportFile();
      if (!result.canceled && result.filePath) {
        setImportFilePath(result.filePath);
      }
    } catch (err) {
      notify("File browser failed: " + err.message, "error");
    }
  };

  const handleExport = async () => {
    if (selectedNotes.size === 0) {
      notify("Please select at least one note to export.", "warning");
      return;
    }
    if (!destinationPath || !fileName) {
      notify("Please select an export destination.", "warning");
      return;
    }

    setLoading(true);
    try {
      const result = await window.notesApi.exportNotePackage({
        noteFilePaths: Array.from(selectedNotes),
        destinationPath,
        fileName
      });
      if (result.success) {
        notify("Notes successfully exported!", "success");
        onClose();
      } else {
        notify("Export failed: " + result.error, "error");
      }
    } catch (err) {
      notify("Export failed: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!importFilePath) {
      notify("Please select a .note package file.", "warning");
      return;
    }

    setLoading(true);
    try {
      const result = await window.notesApi.importNotePackage({
        packageFilePath: importFilePath
      });
      if (result.success) {
        notify(`Successfully imported ${result.importedNotes.length} notes!`, "success");
        if (typeof reloadDocuments === "function") {
          reloadDocuments();
        }
        onClose();
      } else {
        notify("Import failed: " + result.error, "error");
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
      ariaLabel="Export / Import Note Packages"
      cardClassName="export-import-dialog-card"
    >
      <div className="overlay-dialog-header">
        <h2>Shareable Note Package</h2>
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

      <div className="dialog-tabs">
        <button
          className={`dialog-tab ${tab === "export" ? "active" : ""}`}
          onClick={() => setTab("export")}
          disabled={loading}
        >
          Export Package
        </button>
        <button
          className={`dialog-tab ${tab === "import" ? "active" : ""}`}
          onClick={() => setTab("import")}
          disabled={loading}
        >
          Import Package
        </button>
      </div>

      {tab === "export" ? (
        <div className="tab-content export-tab">
          <p className="tab-description">
            Choose which notes to export. This will bundle all linked images, Excalidraw, and Draw.io diagrams into a secure, encrypted `.note` file.
          </p>

          <div className="note-selector-header">
            <span>Select Notes ({selectedNotes.size} of {availableNotes.length})</span>
            <button
              className="link-button"
              type="button"
              onClick={handleSelectAll}
              disabled={loading || availableNotes.length === 0}
            >
              {selectedNotes.size === availableNotes.length ? "Deselect All" : "Select All"}
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
            <span>Save Location</span>
            <div className="browse-row">
              <AppInput
                type="text"
                readOnly
                placeholder="Choose destination path..."
                value={destinationPath ? `${destinationPath}/${fileName}` : ""}
                disabled={loading}
              />
              <button
                className="small-button"
                type="button"
                onClick={handleBrowseExport}
                disabled={loading}
              >
                Browse
              </button>
            </div>
          </div>

          <div className="overlay-dialog-actions">
            <button className="small-button" type="button" onClick={onClose} disabled={loading}>
              <span>Cancel</span>
            </button>
            <button
              className="primary-button"
              type="button"
              onClick={handleExport}
              disabled={loading || selectedNotes.size === 0 || !destinationPath}
            >
              <Download size={14} />
              <span>{loading ? "Exporting..." : "Export Package"}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="tab-content import-tab">
          <p className="tab-description">
            Select a `.note` package file to import notes and all of their dependencies into your current workspace. Any naming collisions will be resolved safely using the package mapping metadata.
          </p>

          <div className="overlay-dialog-field">
            <span>Select .note file</span>
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
              >
                Browse
              </button>
            </div>
          </div>

          {/* Spacer: keeps import tab the same height as export tab */}
          <div className="import-tab-spacer" />

          <div className="overlay-dialog-actions">
            <button className="small-button" type="button" onClick={onClose} disabled={loading}>
              <span>Cancel</span>
            </button>
            <button
              className="primary-button"
              type="button"
              onClick={handleImport}
              disabled={loading || !importFilePath}
            >
              <Upload size={14} />
              <span>{loading ? "Importing..." : "Import Package"}</span>
            </button>
          </div>
        </div>
      )}
    </OverlayDialog>
  );
}

export default ExportImportModal;
