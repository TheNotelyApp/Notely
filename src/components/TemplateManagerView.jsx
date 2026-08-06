import React, { useEffect, useState, useRef } from "react";
import {
  FileText,
  Plus,
  Trash2,
  Save,
  Search,
  Globe,
  Folder,
  Sparkles,
  LayoutTemplate
} from "lucide-react";
import { listTemplates, saveTemplate, deleteTemplate } from "../services/electronService";
import { MarkdownEditor } from "./MarkdownEditor";
import { MarkdownToolbar } from "./MarkdownToolbar";

import "../styles/KnowledgeGraph.css";
import "../styles/AISettings.css";
import "../styles/editor.css";

export function TemplateManagerView({ onBack, notify }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [templateName, setTemplateName] = useState("");
  const [templateContent, setTemplateContent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [dirty, setDirty] = useState(false);

  const editorRef = useRef(null);

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
    loadTemplates();
  }, []);

  function handleStartNew() {
    setSelected("new");
    setTemplateName("");
    setTemplateContent(
      `# {{title}}\n\n**Date**: {{date}} | **Time**: {{time}} | **Year**: {{year}}\n**Location**: {{location}}\n**Persons**: {{persons}}\n**Tags**: #note #template\n\n---\n\n## #RawNotes\n- Initial notes...\n\n---\n\n## #CleansedNotes\n- Structured notes...\n`
    );
    setDirty(false);
  }

  function handleSelectTemplate(tpl) {
    if (dirty && !window.confirm("You have unsaved template changes. Discard them?")) {
      return;
    }
    setSelected(tpl);
    setTemplateName(tpl.name);
    setTemplateContent(tpl.content);
    setDirty(false);
  }

  function handleInsertPlaceholder(varName) {
    setTemplateContent((prev) => prev + ` {{${varName}}}`);
    setDirty(true);
  }

  function handleAddCustomVariable() {
    const customVar = window.prompt("Enter custom metadata field variable name (e.g. project, status, priority):");
    if (customVar && customVar.trim()) {
      const cleanKey = customVar.trim().replace(/[^a-zA-Z0-9_]/g, "");
      setTemplateContent((prev) => `${cleanKey.charAt(0).toUpperCase() + cleanKey.slice(1)}: {{${cleanKey}}}\n` + prev);
      setDirty(true);
    }
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
      const targetFilePath = selected && selected !== "new" ? selected.filePath : null;
      await saveTemplate(templateName.trim(), validatedContent, targetFilePath);
      notify?.("Global template saved across workspaces!", "success");
      setTemplateContent(validatedContent);
      setDirty(false);
      await loadTemplates();
      setSelected(null);
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
      if (selected?.filePath === tpl.filePath) {
        setSelected(null);
      }
    } catch (err) {
      notify?.(err?.message || "Failed to delete template", "error");
    }
  }

  const variables = ["title", "date", "time", "year", "location", "persons", "tags"];

  const filteredTemplates = templates.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="knowledge-graph-page">
      {/* Top Breadcrumb Bar */}
      <div className="detail-topbar">
        <nav className="detail-breadcrumb" aria-label="Template manager location">
          <span className="detail-breadcrumb-part">
            <button className="detail-breadcrumb-link" type="button" onClick={onBack}>
              Notes
            </button>
            <span className="detail-breadcrumb-separator" aria-hidden="true">
              /
            </span>
          </span>
          <span className="detail-breadcrumb-current">Note Templates Manager</span>
        </nav>
      </div>

      <div className="knowledge-graph-container">
        {/* Header Actions Bar */}
        <div className="kg-header-actions" style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 16px", height: "52px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <LayoutTemplate size={20} style={{ color: "var(--accent-solid, #6366f1)" }} />
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 600 }}>Note Templates Engine</h3>
          </div>

          <div className="kg-stats-pill" style={{ marginLeft: "auto", display: "flex", gap: "12px" }}>
            <span><strong>{templates.length}</strong> Templates</span>
            <span style={{ opacity: 0.5 }}>|</span>
            <span>Global AppData Storage</span>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleStartNew}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px" }}
          >
            <Plus size={14} /> New Template
          </button>
        </div>

        {/* Main Body */}
        <div className="kg-body">
          {/* Sidebar */}
          <div className="kg-sidebar" style={{ width: "300px" }}>
            <div className="kg-sidebar-section" style={{ display: "flex", flexDirection: "column", gap: "12px", height: "100%", borderBottom: "none", padding: "12px" }}>
              <h4 style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", margin: 0, fontWeight: 600 }}>
                Available Templates
              </h4>

              <div className="kg-search-wrapper" style={{ width: "100%", flex: "none" }}>
                <Search size={16} className="kg-search-icon" />
                <input
                  type="text"
                  placeholder="Search templates..."
                  className="kg-search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px", overflowY: "auto", flex: 1, marginTop: "4px" }}>
                {loading ? (
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", padding: "16px 0", textAlign: "center" }}>Loading templates...</div>
                ) : (
                  filteredTemplates.map((tpl) => {
                    const isSelected = selected?.filePath === tpl.filePath;
                    return (
                      <div
                        key={tpl.filePath}
                        onClick={() => handleSelectTemplate(tpl)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: "6px",
                          cursor: "pointer",
                          background: isSelected ? "var(--accent-light, rgba(99, 102, 241, 0.12))" : "transparent",
                          color: isSelected ? "var(--accent-hover)" : "var(--text-primary)",
                          borderLeft: isSelected ? "3px solid var(--accent-default)" : "3px solid transparent",
                          fontSize: "13px",
                          transition: "all 0.15s ease"
                        }}
                      >
                        <FileText size={16} style={{ flexShrink: 0, opacity: isSelected ? 1 : 0.7 }} />
                        <div style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          <div style={{ fontWeight: isSelected ? 600 : 400 }}>{tpl.name}</div>
                          <div style={{ fontSize: "10px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "3px" }}>
                            {tpl.scope === "global" ? <Globe size={12} /> : <Folder size={12} />}
                            <span style={{ textTransform: "capitalize" }}>{tpl.scope || "global"}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="icon-button"
                          style={{ padding: "3px" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(tpl);
                          }}
                          title="Delete template"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })
                )}
                {filteredTemplates.length === 0 && !loading && (
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic", textAlign: "center", padding: "24px 8px" }}>
                    No templates found. Click "+ New Template" to create one.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Content Pane */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "var(--bg-editor)" }}>
            {selected ? (
              <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "16px", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <h4 style={{ fontSize: "14px", margin: 0, fontWeight: 600 }}>
                    {selected === "new" ? "Create New Global Template" : `Editing Template: ${selected.name}`}
                  </h4>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setSelected(null)}>
                      Cancel
                    </button>
                    <button type="button" className="btn btn-primary" onClick={handleSave} style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                      <Save size={14} /> Save Template
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Template Name
                  </label>
                  <input
                    type="text"
                    className="kg-search-input"
                    value={templateName}
                    onChange={(e) => {
                      setTemplateName(e.target.value);
                      setDirty(true);
                    }}
                    placeholder="e.g. Meeting Notes, Daily Journal, Technical Spec"
                    disabled={selected !== "new"}
                    style={{ padding: "8px 12px" }}
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Quick Insert Placeholders
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {variables.map((varName) => (
                      <button
                        key={varName}
                        type="button"
                        style={{
                          background: "var(--accent-light, rgba(99, 102, 241, 0.12))",
                          border: "1px solid var(--accent-default, #6366f1)",
                          color: "var(--accent-hover, #4f46e5)",
                          borderRadius: "12px",
                          padding: "2px 8px",
                          fontSize: "11px",
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px"
                        }}
                        onClick={() => handleInsertPlaceholder(varName)}
                      >
                        <Sparkles size={12} /> {`{{${varName}}}`}
                      </button>
                    ))}
                    <button
                      type="button"
                      style={{
                        background: "var(--surface-subtle, rgba(255, 255, 255, 0.08))",
                        border: "1px dashed var(--border-default, #cbd5e1)",
                        color: "var(--text-primary)",
                        borderRadius: "12px",
                        padding: "2px 8px",
                        fontSize: "11px",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px"
                      }}
                      onClick={handleAddCustomVariable}
                    >
                      <Plus size={12} /> Add Custom Field
                    </button>
                  </div>
                </div>

                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px", minHeight: 0 }}>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Template Content (Markdown)
                  </label>
                  <textarea
                    value={templateContent}
                    onChange={(e) => {
                      setTemplateContent(e.target.value);
                      setDirty(true);
                    }}
                    style={{
                      width: "100%",
                      flex: 1,
                      padding: "12px",
                      borderRadius: "6px",
                      border: "1px solid var(--border-default)",
                      background: "var(--surface-bg)",
                      color: "var(--text-strong)",
                      fontFamily: "monospace",
                      fontSize: "13px",
                      lineHeight: 1.6,
                      resize: "none",
                      outline: "none"
                    }}
                  />
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, color: "var(--text-muted)" }}>
                <LayoutTemplate size={20} style={{ opacity: 0.4, marginBottom: "12px" }} />
                <div style={{ fontSize: "14px", fontWeight: 600, marginBottom: "4px" }}>No Template Selected</div>
                <div style={{ fontSize: "12px" }}>Select a template from the list on the left to edit, or click "+ New Template" to create a global template.</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
