import { useCallback, useEffect, useMemo, useState } from "react";
import { FolderOutput, Copy, ArrowRight, Search, Check, Folder, Sparkles } from "lucide-react";
import OverlayDialog from "../OverlayDialog";
import AppButton from "../AppButton";
import AppInput from "../AppInput";
import { listProjects, transferDocumentWorkspace } from "../../services/electronService";

/**
 * TransferNoteWorkspaceModal
 *
 * Allows users to Copy or Move any note to another workspace/project in Notely.
 */
export function TransferNoteWorkspaceModal({
  isOpen,
  onClose,
  document: targetDoc,
  initialMode = "copy", // "copy" | "move"
  onTransferSuccess,
  onNotify,
}) {
  const [mode, setMode] = useState(initialMode); // "copy" | "move"
  const [projects, setProjects] = useState([]);
  const [selectedWorkspaceSlug, setSelectedWorkspaceSlug] = useState("");
  const [targetSubfolder, setTargetSubfolder] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchingProjects, setFetchingProjects] = useState(false);

  // Sync mode when initialMode prop changes
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode || "copy");
      setSearchQuery("");
      setTargetSubfolder("");
      setOverwrite(false);
    }
  }, [isOpen, initialMode]);

  // Fetch available projects/workspaces when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setFetchingProjects(true);

    listProjects()
      .then((res) => {
        if (!isMounted) return;
        const projectList = Array.isArray(res?.projects) ? res.projects : [];
        setProjects(projectList);

        // Default selection: first available project that is NOT the active workspace if possible
        const activeSlug = res?.activeProject?.slug || "root";
        const otherProject = projectList.find((p) => p.slug !== activeSlug) || projectList[0];
        if (otherProject) {
          setSelectedWorkspaceSlug(otherProject.slug);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        onNotify?.(`Failed to load workspaces: ${err?.message || "Unknown error"}`, "error");
      })
      .finally(() => {
        if (isMounted) setFetchingProjects(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, onNotify]);

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const q = searchQuery.toLowerCase().trim();
    return projects.filter((p) => p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q));
  }, [projects, searchQuery]);

  const handleTransfer = useCallback(async () => {
    if (!targetDoc?.filePath) {
      onNotify?.("No note selected for transfer.", "error");
      return;
    }

    if (!selectedWorkspaceSlug) {
      onNotify?.("Please select a target workspace.", "warning");
      return;
    }

    setLoading(true);

    try {
      const result = await transferDocumentWorkspace({
        filePath: targetDoc.filePath,
        targetWorkspaceSlug: selectedWorkspaceSlug,
        targetSubfolder,
        action: mode,
        overwrite,
      });

      if (result?.success) {
        const actionPast = mode === "move" ? "Moved" : "Copied";
        const wsName = result.targetWorkspaceName || selectedWorkspaceSlug;
        onNotify?.(`${actionPast} note "${result.fileName}" to workspace "${wsName}".`, "success");
        onTransferSuccess?.(result);
        onClose?.();
      }
    } catch (err) {
      onNotify?.(`Transfer failed: ${err?.message || "Unknown error"}`, "error");
    } finally {
      setLoading(false);
    }
  }, [targetDoc, selectedWorkspaceSlug, mode, overwrite, onNotify, onTransferSuccess, onClose]);

  if (!isOpen) return null;

  const docTitle = targetDoc?.title || (targetDoc?.filePath ? targetDoc.filePath.split(/[\\/]/).pop() : "Note");

  return (
    <OverlayDialog
      open={isOpen}
      onClose={onClose}
      ariaLabel="Transfer Note to Workspace"
      size="md"
    >
      <div style={{ padding: "20px 24px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              backgroundColor: "color-mix(in srgb, var(--accent-solid) 12%, transparent)",
              color: "var(--accent-solid)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {mode === "move" ? <FolderOutput size={20} /> : <Copy size={20} />}
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "var(--text-strong)" }}>
              {mode === "move" ? "Move Note to Workspace" : "Copy Note to Workspace"}
            </h3>
            <p style={{ margin: "2px 0 0", fontSize: "0.85rem", color: "var(--text-muted)" }}>
              Target note: <strong style={{ color: "var(--text-strong)" }}>{docTitle}</strong>
            </p>
          </div>
        </div>

        {/* Mode Switcher Tabs */}
        <div
          style={{
            display: "flex",
            gap: "4px",
            backgroundColor: "var(--surface-muted)",
            padding: "4px",
            borderRadius: "8px",
            marginBottom: "16px",
          }}
        >
          <button
            type="button"
            onClick={() => setMode("copy")}
            style={{
              flex: 1,
              padding: "7px 12px",
              border: "none",
              borderRadius: "6px",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
              backgroundColor: mode === "copy" ? "var(--surface-bg)" : "transparent",
              color: mode === "copy" ? "var(--text-strong)" : "var(--text-muted)",
              boxShadow: mode === "copy" ? "var(--shadow-sm)" : "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              transition: "all var(--motion-fast) ease",
            }}
          >
            <Copy size={14} />
            <span>Copy Note</span>
          </button>

          <button
            type="button"
            onClick={() => setMode("move")}
            style={{
              flex: 1,
              padding: "7px 12px",
              border: "none",
              borderRadius: "6px",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
              backgroundColor: mode === "move" ? "var(--surface-bg)" : "transparent",
              color: mode === "move" ? "var(--text-strong)" : "var(--text-muted)",
              boxShadow: mode === "move" ? "var(--shadow-sm)" : "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              transition: "all var(--motion-fast) ease",
            }}
          >
            <FolderOutput size={14} />
            <span>Move Note</span>
          </button>
        </div>

        {/* Workspace Search & Selector */}
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px" }}>
            Select Target Workspace
          </label>
          <AppInput
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search workspaces..."
            icon={<Search size={14} />}
            size="small"
            style={{ marginBottom: "10px" }}
          />

          <div
            style={{
              maxHeight: "180px",
              overflowY: "auto",
              border: "1px solid var(--border-default)",
              borderRadius: "8px",
              backgroundColor: "var(--surface-bg)",
            }}
          >
            {fetchingProjects ? (
              <div style={{ padding: "16px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                Loading workspaces...
              </div>
            ) : filteredProjects.length === 0 ? (
              <div style={{ padding: "16px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                No matching workspaces found.
              </div>
            ) : (
              filteredProjects.map((proj) => {
                const isSelected = selectedWorkspaceSlug === proj.slug;
                return (
                  <button
                    key={proj.slug}
                    type="button"
                    onClick={() => setSelectedWorkspaceSlug(proj.slug)}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      border: "none",
                      borderBottom: "1px solid var(--border-subtle)",
                      backgroundColor: isSelected
                        ? "color-mix(in srgb, var(--accent-solid) 10%, var(--surface-bg))"
                        : "transparent",
                      color: isSelected ? "var(--accent-solid)" : "var(--text-strong)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      cursor: "pointer",
                      textAlign: "left",
                      fontSize: "0.88rem",
                      fontWeight: isSelected ? 600 : 400,
                      transition: "background-color var(--motion-fast) ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <Folder size={16} style={{ opacity: 0.7 }} />
                      <span>{proj.name}</span>
                      {proj.isRoot && (
                        <span style={{ fontSize: "0.72rem", opacity: 0.6, fontStyle: "italic" }}>(Root)</span>
                      )}
                    </div>
                    {isSelected && <Check size={16} />}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Optional Target Subfolder */}
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px" }}>
            Target Subfolder <span style={{ fontWeight: 400, opacity: 0.7 }}>(Optional - leave blank for Workspace Root)</span>
          </label>
          <AppInput
            value={targetSubfolder}
            onChange={(e) => setTargetSubfolder(e.target.value)}
            placeholder="e.g. Subfolder or Project/Folder"
            icon={<Folder size={14} />}
            size="small"
          />
        </div>

        {/* Transfer Mode Helper Notice */}
        <div
          style={{
            padding: "10px 12px",
            borderRadius: "6px",
            backgroundColor: "var(--surface-muted)",
            fontSize: "0.8rem",
            color: "var(--text-muted)",
            marginBottom: "16px",
            lineHeight: 1.4,
          }}
        >
          {mode === "move" ? (
            <span>
              ℹ️ Moving will relocate this note and its image assets to the destination workspace and remove the original.
            </span>
          ) : (
            <span>
              ℹ️ Copying will create a new clone of this note and its assets in the destination workspace, leaving the original intact.
            </span>
          )}
        </div>

        {/* Footer Actions */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px" }}>
          <AppButton variant="small" onClick={onClose} disabled={loading}>
            Cancel
          </AppButton>
          <AppButton
            variant="primary"
            onClick={handleTransfer}
            disabled={loading || !selectedWorkspaceSlug}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <span>{mode === "move" ? "Move Note" : "Copy Note"}</span>
            <ArrowRight size={14} />
          </AppButton>
        </div>
      </div>
    </OverlayDialog>
  );
}
