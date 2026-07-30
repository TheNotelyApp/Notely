import React, { useState, useEffect } from "react";
import { Trash2, RotateCcw, Folder, File, AlertCircle, X } from "lucide-react";
import { OverlayDialog } from "./OverlayDialog";
import { formatDate } from "../utils/dateUtils";

export function TrashDialog({ isOpen, onClose, onRestored }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchTrashItems = async () => {
    if (!window.notesApi?.trashList) return;
    setLoading(true);
    setError(null);
    try {
      const list = await window.notesApi.trashList();
      setItems(list || []);
    } catch (err) {
      console.error("Failed to read trash list:", err);
      setError("Failed to load trash list.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTrashItems();
    }
  }, [isOpen]);

  const handleRestore = async (item) => {
    if (!window.notesApi?.trashRestore) return;
    try {
      await window.notesApi.trashRestore({
        relativePath: item.relativePath,
        group: item.group
      });
      await fetchTrashItems();
      if (onRestored) {
        onRestored();
      }
    } catch (err) {
      console.error("Failed to restore item:", err);
      setError(`Failed to restore: ${err.message}`);
    }
  };

  const handleEmptyTrash = async () => {
    if (!window.notesApi?.trashEmpty) return;
    if (!window.confirm("Are you sure you want to permanently empty the trash? This cannot be undone.")) {
      return;
    }
    try {
      await window.notesApi.trashEmpty();
      setItems([]);
    } catch (err) {
      console.error("Failed to empty trash:", err);
      setError("Failed to empty trash.");
    }
  };

  return (
    <OverlayDialog open={isOpen} onClose={onClose} ariaLabel="Trash Recovery" cardClassName="trash-panel-card">
      <div className="overlay-dialog-header">
        <div className="trash-header-title">
          <Trash2 size={18} />
          <h2>Trash Bin</h2>
        </div>
        {items.length > 0 && (
          <button className="small-button danger-button" onClick={handleEmptyTrash}>
            Empty Trash
          </button>
        )}
        <button
          className="icon-button"
          onClick={onClose}
          type="button"
          aria-label="Close trash dialog"
        >
          <X size={16} />
        </button>
      </div>

      <div className="overlay-dialog-body trash-dialog-body">
        {error && (
          <div className="validation-banner danger">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="trash-empty-container">
            <span className="loading-spinner">Loading...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="trash-empty-container">
            <Trash2 size={20} className="trash-empty-icon" />
            <p className="trash-empty-text">Your trash bin is empty.</p>
          </div>
        ) : (
          <div className="trash-items-grid">
            {items.map((item, idx) => (
              <div key={idx} className="trash-item-card">
                <div className="trash-item-left">
                  {item.isDirectory ? (
                    <Folder size={16} style={{ color: "var(--status-warning-text)", flexShrink: 0 }} />
                  ) : (
                    <File size={16} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                  )}
                  <div className="trash-item-info">
                    <div className="trash-item-name">{item.name}</div>
                    <div className="trash-item-path">Original Path: {item.relativePath}</div>
                  </div>
                </div>

                <div className="trash-item-meta">
                  <span className="trash-item-date">
                    Deleted {formatDate(item.deletedAt)}
                  </span>
                  <button
                    className="small-button icon-only"
                    onClick={() => handleRestore(item)}
                    title="Restore file"
                    aria-label={`Restore ${item.name}`}
                  >
                    <RotateCcw size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </OverlayDialog>
  );
}
