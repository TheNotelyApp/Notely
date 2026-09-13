import React, { useState } from "react";
import { X, Settings, Sliders, Type, Network, Cpu, Share2 } from "lucide-react";
import { OverlayDialog } from "./OverlayDialog";
import AppSelect from "./AppSelect";
import AppIconButton from "./AppIconButton";
import { MCPSettingsContent } from "./MCPSettingsModal";
import { EmbeddingsSettings } from "./EmbeddingsSettings";
import KnowledgeGraphSettings from "./KnowledgeGraphSettings";

export function SettingsModal({
  isOpen,
  onClose,
  activeTab: initialTab = "general",
  // Theme & Appearance
  themePreference,
  onThemeChange,
  zoomFactor,
  onZoomChange,
  // Editor preferences
  autosaveEnabled,
  onAutosaveToggle,
  typoCheckEnabled,
  onTypoCheckToggle,
  outlineEnabled,
  onOutlineToggle,
  previewImageMode,
  onPreviewImageModeChange,
  embeddedMarkdownMode,
  onEmbeddedMarkdownModeToggle,
}) {
  const [activeTab, setActiveTab] = useState(initialTab);

  if (!isOpen) return null;

  const tabs = [
    { id: "general", label: "General", icon: Sliders },
    { id: "editor", label: "Editor", icon: Type },
    { id: "embeddings", label: "Local Embeddings", icon: Cpu },
    { id: "graph", label: "Knowledge Graph", icon: Share2 },
    { id: "mcp", label: "MCP Server", icon: Network },
  ];

  const handleZoomChange = (e) => {
    const nextZoom = parseFloat(e.target.value);
    onZoomChange?.(nextZoom);
  };

  return (
    <OverlayDialog open={isOpen} onClose={onClose} ariaLabel="Application Settings" cardClassName="settings-dialog-card">
      <div className="overlay-dialog-header">
        <div className="settings-header-title">
          <Settings size={18} />
          <h2>Settings</h2>
        </div>
        <AppIconButton onClick={onClose} aria-label="Close Settings">
          <X size={16} />
        </AppIconButton>
      </div>

      <div className="settings-layout">
        {/* Left Tab Rail */}
        <aside className="settings-tab-rail" role="tablist" aria-label="Settings categories">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`settings-tab-btn ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </aside>

        {/* Right Content Panel */}
        <main className="settings-content-panel">
          {activeTab === "general" && (
            <div className="settings-tab-pane">
              <h3>General Settings</h3>
              <p className="settings-pane-intro">Personalize application appearance, zoom settings, and layouts.</p>

              <div className="settings-field-group">
                <label className="settings-field-label">Color Theme</label>
                <AppSelect
                  value={themePreference}
                  onChange={(e) => onThemeChange?.(e.target.value)}
                >
                  <option value="auto">System Default</option>
                  <option value="light">Light Mode</option>
                  <option value="dark">Dark Mode</option>
                </AppSelect>
              </div>

              <div className="settings-field-group">
                <label className="settings-field-label">Zoom Scale</label>
                <div className="settings-zoom-control">
                  <input
                    type="range"
                    min="0.75"
                    max="1.75"
                    step="0.05"
                    value={zoomFactor || 1.0}
                    onChange={handleZoomChange}
                    className="slider zoom-slider"
                  />
                  <span className="settings-zoom-value">{Math.round((zoomFactor || 1.0) * 100)}%</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === "editor" && (
            <div className="settings-tab-pane">
              <h3>Editor Settings</h3>
              <p className="settings-pane-intro">Configure writing preference and automation rules in the document editor.</p>

              <div className="settings-toggle-row">
                <div className="settings-toggle-copy">
                  <strong>Auto-Save Note Changes</strong>
                  <span>Automatically save modifications on disk after a short typing pause.</span>
                </div>
                <input
                  type="checkbox"
                  checked={autosaveEnabled}
                  onChange={() => onAutosaveToggle?.(!autosaveEnabled)}
                  className="settings-toggle-checkbox"
                />
              </div>

              <div className="settings-toggle-row">
                <div className="settings-toggle-copy">
                  <strong>Typo & Grammar Check</strong>
                  <span>Enable inline checking and error highlight markers in markdown content.</span>
                </div>
                <input
                  type="checkbox"
                  checked={typoCheckEnabled}
                  onChange={() => onTypoCheckToggle?.(!typoCheckEnabled)}
                  className="settings-toggle-checkbox"
                />
              </div>

              <div className="settings-toggle-row">
                <div className="settings-toggle-copy">
                  <strong>Show Document Outline</strong>
                  <span>Toggle document outlines automatically on newly opened notes.</span>
                </div>
                <input
                  type="checkbox"
                  checked={outlineEnabled}
                  onChange={() => onOutlineToggle?.(!outlineEnabled)}
                  className="settings-toggle-checkbox"
                />
              </div>

              <div className="settings-toggle-row">
                <div className="settings-toggle-copy">
                  <strong>Embedded Markdown Note Rendering</strong>
                  <span>Resolve and embed wiki-style linked notes directly in preview screens.</span>
                </div>
                <input
                  type="checkbox"
                  checked={embeddedMarkdownMode}
                  onChange={() => onEmbeddedMarkdownModeToggle?.(!embeddedMarkdownMode)}
                  className="settings-toggle-checkbox"
                />
              </div>

              <div className="settings-field-group">
                <label className="settings-field-label">Linked Image Resolution Mode</label>
                <AppSelect
                  value={previewImageMode}
                  onChange={(e) => onPreviewImageModeChange?.(e.target.value)}
                >
                  <option value="thumbnail">Optimized Thumbnail</option>
                  <option value="original">Original Resolution</option>
                </AppSelect>
              </div>
            </div>
          )}

          {activeTab === "embeddings" && (
            <div className="settings-tab-pane">
              <h3>Local Embeddings Generator</h3>
              <p className="settings-pane-intro">Configure offline ONNX vector embeddings for semantic search, vector indexing, and chunking.</p>
              <EmbeddingsSettings />
            </div>
          )}

          {activeTab === "graph" && (
            <div className="settings-tab-pane">
              <h3>Knowledge Graph Engine</h3>
              <p className="settings-pane-intro">Configure offline entity and relationship discovery models, extraction thresholds, and graph caching.</p>
              <KnowledgeGraphSettings />
            </div>
          )}

          {activeTab === "mcp" && (
            <div className="settings-tab-pane mcp-tab-pane">
              <h3>Model Context Protocol (MCP) Server</h3>
              <p className="settings-pane-intro">Connect your external AI applications (Claude Desktop, Cursor, Antigravity) directly to your Notely notes, tasks, and knowledge graph.</p>
              <MCPSettingsContent />
            </div>
          )}
        </main>
      </div>
    </OverlayDialog>
  );
}
