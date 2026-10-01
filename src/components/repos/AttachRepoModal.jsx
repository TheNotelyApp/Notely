import { useState, useEffect } from "react";
import { FolderOpen, Plus } from "lucide-react";
import OverlayDialog from "../OverlayDialog";
import AppButton from "../AppButton";
import AppInput from "../AppInput";

export function AttachRepoModal({
  open = false,
  onClose,
  onAttach
}) {
  const [newRepoPath, setNewRepoPath] = useState("");
  const [newRepoName, setNewRepoName] = useState("");
  const [newRepoBranch, setNewRepoBranch] = useState("main");

  useEffect(() => {
    if (!open) {
      setNewRepoPath("");
      setNewRepoName("");
      setNewRepoBranch("main");
    }
  }, [open]);

  const handleBrowse = async () => {
    try {
      if (window.notesApi?.showOpenDialog) {
        const result = await window.notesApi.showOpenDialog({
          title: "Select Git Repository Directory",
          properties: ["openDirectory"]
        });
        if (result && !result.canceled && result.filePaths?.length > 0) {
          const selected = result.filePaths[0];
          setNewRepoPath(selected);
          const baseName = selected.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || "repository";
          if (!newRepoName) setNewRepoName(baseName);
        }
      }
    } catch {
      // dialog cancelled or not available
    }
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!newRepoPath.trim()) return;
    if (typeof onAttach === "function") {
      onAttach({
        path: newRepoPath.trim(),
        name: newRepoName.trim() || newRepoPath.split(/[\\/]/).pop(),
        branch: newRepoBranch.trim() || "main"
      });
    }
  };

  if (!open) return null;

  return (
    <OverlayDialog
      open={open}
      onClose={onClose}
      title="Attach Git Repository"
      size="md"
    >
      <form onSubmit={handleSubmit} className="arp-dialog-form">
        <div>
          <label className="arp-form-label">
            Repository Folder Path *
          </label>
          <div className="arp-browse-row">
            <AppInput
              type="text"
              placeholder="C:/Projects/my-service or /home/user/code/my-repo"
              value={newRepoPath}
              onChange={(e) => setNewRepoPath(e.target.value)}
              required
            />
            <AppButton
              type="button"
              onClick={handleBrowse}
            >
              <FolderOpen size={14} className="arp-btn-icon-mr" />
              Browse
            </AppButton>
          </div>
        </div>

        <div>
          <label className="arp-form-label">
            Display / Alias Name (Optional)
          </label>
          <AppInput
            type="text"
            placeholder="e.g. backend-api, web-frontend"
            value={newRepoName}
            onChange={(e) => setNewRepoName(e.target.value)}
          />
        </div>

        <div>
          <label className="arp-form-label">
            Branch (Optional)
          </label>
          <AppInput
            type="text"
            placeholder="main or develop"
            value={newRepoBranch}
            onChange={(e) => setNewRepoBranch(e.target.value)}
          />
        </div>

        <div className="arp-form-hint">
          Notely will scan this repository for code files, classes, and exported functions and integrate them into your workspace&apos;s Knowledge Graph.
        </div>

        <div className="arp-dialog-actions">
          <AppButton
            type="button"
            onClick={onClose}
          >
            Cancel
          </AppButton>
          <AppButton
            type="submit"
            variant="primary"
          >
            <Plus size={14} className="arp-btn-icon-mr" />
            Attach Repository
          </AppButton>
        </div>
      </form>
    </OverlayDialog>
  );
}

export default AttachRepoModal;
