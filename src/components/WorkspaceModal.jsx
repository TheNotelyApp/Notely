import React, { useState, useEffect, useRef } from "react";
import { Folder, Sparkles, Check, Info, X, FolderPlus, Save, FolderOpen, FileText, GitBranch } from "lucide-react";
import { OverlayDialog } from "./OverlayDialog";
import useConfirm from "../hooks/useConfirm";
import AppButton from "./AppButton";
import AppSelect from "./AppSelect";

const PROJECT_TYPES = [
  { value: "General", label: "General Workspace" },
  { value: "Software Development", label: "Software Development" },
  { value: "Research & Study", label: "Research & Study" },
  { value: "Personal Notes", label: "Personal Notes" },
  { value: "Documentation", label: "Documentation" },
];

const EMOJI_OPTIONS = ["📝", "🚀", "💻", "🧠", "📚", "🎨", "⚡", "🔍", "🛠️", "🌐", "💡", "🎯", "🔥", "✨"];

export function WorkspaceModal({
  isOpen,
  mode = "create", // "create" | "info"
  initialInfo = {},
  defaultParentLocation = "",
  onClose,
  onSubmit,
  onPickParentLocation,
}) {
  const { confirm } = useConfirm();
  const [name, setName] = useState("");
  const [parentLocation, setParentLocation] = useState("");
  const [description, setDescription] = useState("");
  const [domainTags, setDomainTags] = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [projectType, setProjectType] = useState("General");
  const [primaryGoal, setPrimaryGoal] = useState("");
  const [icon, setIcon] = useState("📝");
  const [createWelcomeNote, setCreateWelcomeNote] = useState(true);
  const [initGit, setInitGit] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [parentWarning, setParentWarning] = useState("");
  const [isNestedWorkspace, setIsNestedWorkspace] = useState(false);

  useEffect(() => {
    if (mode === "create" && parentLocation.trim() && window.notesApi?.validateWorkspace) {
      window.notesApi.validateWorkspace(parentLocation.trim()).then((res) => {
        if (res?.isWorkspace) {
          setParentWarning("Parent location is an existing Notely workspace. Nested workspaces are not allowed.");
          setIsNestedWorkspace(true);
        } else {
          setParentWarning("");
          setIsNestedWorkspace(false);
        }
      }).catch(() => {
        setParentWarning("");
        setIsNestedWorkspace(false);
      });
    } else {
      setParentWarning("");
      setIsNestedWorkspace(false);
    }
  }, [parentLocation, mode]);

  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setError("");
      setParentWarning("");
      setSubmitting(false);
      setTagInput("");
      if (mode === "create") {
        setName(initialInfo.name || "");
        setParentLocation(initialInfo.parentLocation || defaultParentLocation || "");
        setDescription(initialInfo.description || "");
        setDomainTags(Array.isArray(initialInfo.domainTags) ? initialInfo.domainTags : []);
        setProjectType(initialInfo.projectType || "General");
        setPrimaryGoal(initialInfo.primaryGoal || "");
        setIcon(initialInfo.icon || "📝");
        setCreateWelcomeNote(initialInfo.createWelcomeNote !== false);
        setInitGit(initialInfo.initGit !== false);
      } else {
        // "info" mode
        setName(initialInfo.name || "");
        setDescription(initialInfo.description || "");
        setDomainTags(Array.isArray(initialInfo.domainTags) ? initialInfo.domainTags : []);
        setProjectType(initialInfo.projectType || "General");
        setPrimaryGoal(initialInfo.primaryGoal || "");
        setIcon(initialInfo.icon || "📝");
      }
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, mode, initialInfo, defaultParentLocation]);

  const addTag = (raw) => {
    const cleaned = String(raw || "").replace(/^[#\s]+/, "").replace(/\s+/g, "").trim();
    if (!cleaned) return;
    if (!domainTags.includes(cleaned)) {
      setDomainTags((prev) => [...prev, cleaned]);
    }
    setTagInput("");
  };

  const removeTag = (indexToRemove) => {
    setDomainTags((prev) => prev.filter((_, i) => i !== indexToRemove));
  };

  const handleTagKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " " || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === "Backspace" && !tagInput && domainTags.length > 0) {
      removeTag(domainTags.length - 1);
    }
  };

  if (!isOpen) return null;

  const handleBrowseLocation = async () => {
    if (onPickParentLocation) {
      const selected = await onPickParentLocation();
      if (selected) {
        setParentLocation(selected);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Workspace name is required.");
      return;
    }

    if (mode === "create" && !parentLocation.trim()) {
      setError("Please select a parent location folder.");
      return;
    }

    let finalTags = [...domainTags];
    if (tagInput.trim()) {
      const cleaned = tagInput.replace(/^[#\s]+/, "").replace(/\s+/g, "").trim();
      if (cleaned && !finalTags.includes(cleaned)) {
        finalTags.push(cleaned);
      }
    }

    if (mode === "create") {
      const summaryList = ["• Create .notes-app configuration & metadata"];
      if (createWelcomeNote) summaryList.push("• Create README.md note");
      if (initGit) summaryList.push("• Initialize Git repository (.git)");

      const confirmed = await confirm({
        title: "Confirm Workspace Setup",
        message: `Setting up workspace "${trimmedName}":\n\n${summaryList.join("\n")}\n\nProceed with initialization?`,
        confirmLabel: "Initialize",
        cancelLabel: "Back to Edit",
        variant: "primary"
      });
      if (!confirmed) {
        return;
      }
    }

    setSubmitting(true);
    try {
      if (mode === "create") {
        await onSubmit?.({
          name: trimmedName,
          parentLocation: parentLocation.trim(),
          description: description.trim(),
          domainTags: finalTags,
          projectType,
          primaryGoal: primaryGoal.trim(),
          icon,
          createWelcomeNote,
          initGit,
        });
      } else {
        await onSubmit?.({
          name: trimmedName,
          description: description.trim(),
          domainTags: finalTags,
          projectType,
          primaryGoal: primaryGoal.trim(),
          icon,
        });
      }
      onClose?.();
    } catch (err) {
      setError(err?.message || "Failed to save workspace.");
    } finally {
      setSubmitting(false);
    }
  };

  const isCreate = mode === "create";

  return (
    <OverlayDialog
      open={isOpen}
      onClose={onClose}
      ariaLabel={isCreate ? "Create New Workspace" : "Workspace Information"}
      cardClassName="tasks-panel-card workspace-modal-card"
    >
      <div className="overlay-dialog-header tasks-panel-header">
        <div className="tasks-panel-title-group">
          {isCreate ? <Folder size={18} /> : <Info size={18} />}
          <h2>{isCreate ? "Create New Workspace" : "Workspace Information"}</h2>
        </div>
        <button
          className="icon-button assets-close-button"
          onClick={onClose}
          type="button"
          aria-label="Close workspace modal"
        >
          <X size={16} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="workspace-modal-form">
        {error && <div className="workspace-modal-error">{error}</div>}

        <div className="workspace-modal-grid">
          <div className="workspace-modal-field">
            <label htmlFor="ws-name">Workspace Name *</label>
            <input
              id="ws-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Engineering Docs"
              required
              autoFocus
            />
          </div>

          <div className="workspace-modal-field">
            <label htmlFor="ws-project-type">Project Type</label>
            <AppSelect
              id="ws-project-type"
              value={projectType}
              onChange={(e) => setProjectType(e.target.value)}
            >
              {PROJECT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </AppSelect>
          </div>
        </div>

        {isCreate && (
          <div className="workspace-modal-field">
            <label htmlFor="ws-parent-location">Parent Folder Location *</label>
            <div className="workspace-modal-location-input">
              <input
                id="ws-parent-location"
                type="text"
                value={parentLocation}
                onChange={(e) => setParentLocation(e.target.value)}
                placeholder="Select parent folder path..."
                required
              />
              <AppButton
                type="button"
                variant="small"
                onClick={handleBrowseLocation}
                style={{ height: "34px", minHeight: "34px", display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <FolderOpen size={14} />
                <span>Browse</span>
              </AppButton>
            </div>
            {parentWarning && (
              <div className="workspace-modal-warning-box">
                <Info size={14} style={{ flexShrink: 0 }} />
                <span>{parentWarning}</span>
              </div>
            )}
          </div>
        )}

        <div className="workspace-modal-field">
          <label htmlFor="ws-tag-input">Domain / Topic Tags</label>
          <div className="workspace-tags-container">
            {domainTags.map((tag, idx) => (
              <span key={`${tag}-${idx}`} className="workspace-tag-chip">
                #{tag}
                <button
                  type="button"
                  className="workspace-tag-remove"
                  onClick={() => removeTag(idx)}
                  aria-label={`Remove tag ${tag}`}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
            <input
              id="ws-tag-input"
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              onBlur={() => addTag(tagInput)}
              placeholder={domainTags.length === 0 ? "Type tag & press Enter/Space..." : "Add tag..."}
            />
          </div>
        </div>

        <div className="workspace-modal-field">
          <label htmlFor="ws-description">
            <Sparkles size={12} style={{ display: "inline", marginRight: "4px" }} />
            Project Overview / Description (Used by AI & Knowledge Graph)
          </label>
          <textarea
            id="ws-description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Summarize what this workspace contains to help AI Assistant and Knowledge Graph better understand your project context..."
          />
        </div>

        <div className="workspace-modal-field">
          <label>Workspace Icon / Emoji</label>
          <div className="workspace-modal-emoji-row">
            {EMOJI_OPTIONS.map((e) => (
              <button
                type="button"
                key={e}
                className={`workspace-emoji-btn ${icon === e ? "active" : ""}`}
                onClick={() => setIcon(e)}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        {isCreate && (
          <div className="workspace-modal-toggles-row">
            <button
              type="button"
              className={`workspace-toggle-card ${createWelcomeNote ? "active" : ""}`}
              onClick={() => setCreateWelcomeNote(!createWelcomeNote)}
            >
              <div className="toggle-card-left">
                <FileText size={14} className="toggle-card-icon" />
                <span>Create README.md note</span>
              </div>
              <div className={`toggle-switch-track ${createWelcomeNote ? "active" : ""}`}>
                <div className="toggle-switch-thumb" />
              </div>
            </button>

            <button
              type="button"
              className={`workspace-toggle-card ${initGit ? "active" : ""}`}
              onClick={() => setInitGit(!initGit)}
            >
              <div className="toggle-card-left">
                <GitBranch size={14} className="toggle-card-icon" />
                <span>Initialize Git Repository</span>
              </div>
              <div className={`toggle-switch-track ${initGit ? "active" : ""}`}>
                <div className="toggle-switch-thumb" />
              </div>
            </button>
          </div>
        )}

        <div className="workspace-modal-actions">
          <AppButton
            type="button"
            variant="small"
            onClick={onClose}
            disabled={submitting}
            style={{ height: "32px", minHeight: "32px", display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <X size={14} />
            <span>Cancel</span>
          </AppButton>
          <AppButton
            type="submit"
            variant="primary"
            disabled={submitting || !name.trim() || (isCreate && !parentLocation.trim()) || (isCreate && isNestedWorkspace)}
            style={{ height: "32px", minHeight: "32px", display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            {isCreate ? <FolderPlus size={14} /> : <Save size={14} />}
            <span>{submitting ? "Saving..." : isCreate ? "Create Workspace" : "Save Changes"}</span>
          </AppButton>
        </div>
      </form>
    </OverlayDialog>
  );
}
