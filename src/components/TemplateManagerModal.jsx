import React, { useEffect, useState } from "react";
import { X, FileText, Plus, Trash2, Edit3, Save, Check, Globe, Folder } from "lucide-react";
import { OverlayDialog } from "./OverlayDialog";
import { listTemplates, saveTemplate, deleteTemplate } from "../services/electronService";

export function TemplateManagerModal({ isOpen, onClose, notify }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateName, setTemplateName] = useState("");
  const [templateContent, setTemplateContent] = useState("");

  async function loadTemplates() {
    setLoading(true);
    try {
      const list = await listTemplates();
      setTemplates(list || []);
    } catch (err) {
      notify?.(err?.message || "Failed to load templates", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
      setEditingTemplate(null);
      setTemplateName("");
      setTemplateContent("");
    }
  }, [isOpen]);

  function handleStartNew() {
    setEditingTemplate("new");
    setTemplateName("");
    setTemplateContent(
      `# {{title}}\n\n**Date**: {{date}} | **Time**: {{time}} | **Year**: {{year}}\n**Location**: {{location}}\n**Persons**: {{persons}}\n**Tags**: #note #template\n\n---\n\n## #RawNotes\n- Initial notes...\n\n---\n\n## #Cleansed\n- Structured notes...\n`
    );
  }

  function handleSelectTemplate(tpl) {
    setEditingTemplate(tpl);
    setTemplateName(tpl.name);
    setTemplateContent(tpl.content);
  }

  function ensureSectionIntegrity(content) {
    let result = String(content || "");
    const hasRaw = /#\s*rawnotes/i.test(result);
    const hasCleansed = /#\s*cleansed/i.test(result);
    if (!hasRaw || !hasCleansed) {
      if (!hasRaw) {
        result += "\n\n---\n\n## #RawNotes\n- Initial notes...";
      }
      if (!hasCleansed) {
        result += "\n\n---\n\n## #Cleansed\n- Structured notes...";
      }
    }
    return result;
  }

  async function handleSave() {
    if (!templateName.trim()) {
      notify?.("Template name is required", "warning");
      return;
    }

    const validatedContent = ensureSectionIntegrity(templateContent);

    try {
      const targetFilePath = editingTemplate && editingTemplate !== "new" ? editingTemplate.filePath : null;
      await saveTemplate(templateName.trim(), validatedContent, targetFilePath);
      notify?.("Global template saved across workspaces!", "success");
      await loadTemplates();
      setEditingTemplate(null);
    } catch (err) {
      notify?.(err?.message || "Failed to save template", "error");
    }
  }

  async function handleDelete(tpl) {
    if (!window.confirm(`Delete template "${tpl.name}"?`)) return;
    try {
      await deleteTemplate(tpl.filePath);
      notify?.("Template deleted", "info");
      await loadTemplates();
      if (editingTemplate?.filePath === tpl.filePath) {
        setEditingTemplate(null);
      }
    } catch (err) {
      notify?.(err?.message || "Failed to delete template", "error");
    }
  }

  if (!isOpen) return null;

  return (
    <OverlayDialog open={isOpen} onClose={onClose} ariaLabel="Manage Templates">
      <div className="overlay-dialog-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Manage Note Templates</h2>
        <button type="button" className="icon-button" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: "1rem", marginTop: "1rem", minHeight: "350px" }}>
        {/* Sidebar: List of templates */}
        <div style={{ borderRight: "1px solid var(--border-color, #e2e8f0)", paddingRight: "0.75rem" }}>
          <button
            type="button"
            className="secondary-button"
            style={{ width: "100%", marginBottom: "0.75rem", display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
            onClick={handleStartNew}
          >
            <Plus size={14} /> New Template
          </button>
          {loading ? (
            <div style={{ fontSize: "0.85rem", color: "gray" }}>Loading...</div>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {templates.map((tpl) => (
                <li key={tpl.filePath} style={{ marginBottom: "0.35rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <button
                    type="button"
                    style={{
                      background: editingTemplate?.filePath === tpl.filePath ? "var(--accent-bg, #f1f5f9)" : "none",
                      border: "none",
                      textAlign: "left",
                      width: "100%",
                      padding: "0.4rem 0.5rem",
                      borderRadius: "4px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                      fontSize: "0.85rem",
                      fontWeight: editingTemplate?.filePath === tpl.filePath ? 600 : 400
                    }}
                    onClick={() => handleSelectTemplate(tpl)}
                  >
                    <FileText size={14} />
                    {tpl.name}
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    style={{ padding: "0.2rem" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(tpl);
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </li>
              ))}
              {templates.length === 0 && !loading && (
                <li style={{ fontSize: "0.8rem", color: "gray", fontStyle: "italic" }}>No templates found in templates/</li>
              )}
            </ul>
          )}
        </div>

        {/* Editor panel */}
        <div>
          {editingTemplate ? (
            <div>
              <div style={{ marginBottom: "0.75rem" }}>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                  Template Name
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g. Meeting Notes"
                  disabled={editingTemplate !== "new"}
                  style={{ width: "100%", padding: "0.4rem", borderRadius: "4px", border: "1px solid var(--border-color, #cbd5e1)" }}
                />
              </div>

              <div style={{ marginBottom: "0.75rem" }}>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                  Template Content (Variables: <code>{"{{title}}"}</code>, <code>{"{{date}}"}</code>, <code>{"{{time}}"}</code>, <code>{"{{year}}"}</code>)
                </label>
                <textarea
                  value={templateContent}
                  onChange={(e) => setTemplateContent(e.target.value)}
                  rows={10}
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid var(--border-color, #cbd5e1)", fontFamily: "monospace", fontSize: "0.85rem" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button type="button" className="secondary-button" onClick={() => setEditingTemplate(null)}>
                  Cancel
                </button>
                <button type="button" className="primary-button" onClick={handleSave}>
                  <Save size={14} /> Save Template
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "gray", fontSize: "0.9rem" }}>
              Select a template to edit or click <strong>+ New Template</strong>
            </div>
          )}
        </div>
      </div>
    </OverlayDialog>
  );
}
