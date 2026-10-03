import React from "react";
import {
  ArrowDown,
  ArrowUp,
  Bookmark,
  Box,
  ChevronDown,
  ChevronRight,
  Columns,
  Copy,
  CornerDownRight,
  FileText,
  FolderMinus,
  FolderPlus,
  Lock,
  Plus,
  Rows,
  Sliders,
  Trash2,
  Unlock
} from "lucide-react";

export function PropertiesSection({
  isOpen,
  onToggle,
  selectedComp,
  compMeta,
  isLocked,
  onToggleLock,
  onGroupSelection,
  onUngroupSelection,
  isSavingSnippet,
  onToggleSavingSnippet,
  snippetNameInput,
  onSnippetNameChange,
  onSaveSnippet,
  onDuplicateSelected,
  onDeleteSelected,
  quickAddStencilId,
  onQuickAddStencilChange,
  onInsertRelative,
  onAddColumn,
  onAddRow,
  onSetColumnsPreset,
  customSnippets,
  devNote,
  onDevNoteChange,
  propText,
  onTextChange,
  propWidth,
  onWidthChange,
  propHeight,
  onHeightChange,
  propVariant,
  onVariantChange,
  propGap,
  onGapChange,
  propPadding,
  onPaddingChange,
  propDirection,
  onDirectionChange,
  advancedOpen,
  onToggleAdvanced
}) {
  const SelectedIcon = compMeta.icon || Box;
  const isContainer =
    compMeta.name === "Container" ||
    compMeta.name === "Row" ||
    compMeta.name === "Column" ||
    compMeta.name === "Stack" ||
    (selectedComp?.components?.()?.length || 0) > 0;

  return (
    <div className={`wireframe-section ${isOpen ? "open" : "collapsed"}`}>
      <button
        type="button"
        className="wireframe-section-header"
        onClick={onToggle}
      >
        <div className="wireframe-section-title-wrap">
          <Sliders size={14} />
          <span>Properties</span>
        </div>
        <div className="wireframe-section-chevron">
          {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </div>
      </button>

      <div
        className="wireframe-section-body"
        style={{ display: isOpen ? "block" : "none" }}
      >
        {!selectedComp ? (
          <div className="wireframe-inspector-empty">
            <Sliders size={20} className="wireframe-empty-icon-svg" />
            <span>Select any element on canvas to inspect & configure</span>
          </div>
        ) : (
          <div className="wireframe-prop-form">
            {/* Selected Component Header */}
            <div className="wireframe-prop-header">
              <div className="wireframe-prop-header-info">
                <div className="wireframe-prop-icon">
                  <SelectedIcon size={14} />
                </div>
                <span className="wireframe-prop-name">{compMeta.name}</span>
                {isLocked && (
                  <span className="wireframe-locked-pill" title="Element is locked from edits and drag">
                    <Lock size={12} />
                    <span>Locked</span>
                  </span>
                )}
              </div>
              <div className="wireframe-prop-actions">
                <button
                  type="button"
                  className={`wireframe-prop-btn ${isLocked ? "active" : ""}`}
                  onClick={onToggleLock}
                  title={isLocked ? "Unlock element" : "Lock element"}
                  aria-label={isLocked ? "Unlock element" : "Lock element"}
                >
                  {isLocked ? <Lock size={12} /> : <Unlock size={12} />}
                </button>
                <button
                  type="button"
                  className="wireframe-prop-btn"
                  onClick={isContainer ? onUngroupSelection : onGroupSelection}
                  disabled={isLocked}
                  title={isContainer ? "Ungroup container" : "Group into container"}
                  aria-label={isContainer ? "Ungroup container" : "Group into container"}
                >
                  {isContainer ? <FolderMinus size={12} /> : <FolderPlus size={12} />}
                </button>
                <button
                  type="button"
                  className="wireframe-prop-btn"
                  onClick={onToggleSavingSnippet}
                  title="Save as Stencil Snippet"
                  aria-label="Save as Stencil Snippet"
                  disabled={isLocked}
                >
                  <Bookmark size={12} />
                </button>
                <button
                  type="button"
                  className="wireframe-prop-btn"
                  onClick={onDuplicateSelected}
                  title="Duplicate element"
                  aria-label="Duplicate element"
                  disabled={isLocked}
                >
                  <Copy size={12} />
                </button>
                <button
                  type="button"
                  className="wireframe-prop-btn danger"
                  onClick={onDeleteSelected}
                  title="Delete element"
                  aria-label="Delete element"
                  disabled={isLocked}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>

            {/* Inline Save Snippet Bar */}
            {isSavingSnippet && (
              <div
                className="wireframe-prop-group"
                style={{
                  background: "var(--surface-subtle)",
                  padding: "8px",
                  borderRadius: "var(--radius-sm)"
                }}
              >
                <label className="wireframe-prop-label">
                  <Bookmark size={12} />
                  <span>Save Selection as Stencil</span>
                </label>
                <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                  <input
                    type="text"
                    className="wireframe-prop-input"
                    placeholder={compMeta.name || "Snippet Name"}
                    value={snippetNameInput}
                    onChange={(e) => onSnippetNameChange(e.target.value)}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="wireframe-quick-add-submit"
                    onClick={onSaveSnippet}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className="wireframe-prop-btn"
                    onClick={onToggleSavingSnippet}
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}

            {/* Quick Relative Insertion Toolbar */}
            <div className="wireframe-prop-group wireframe-quick-insert-group">
              <label className="wireframe-prop-label">
                <Plus size={12} />
                <span>Insert Nearby</span>
              </label>
              <div className="wireframe-quick-insert-actions">
                <button
                  type="button"
                  className="wireframe-quick-insert-btn"
                  onClick={() => onInsertRelative("above")}
                  title="Insert container directly above this element"
                  disabled={isLocked}
                >
                  <ArrowUp size={12} />
                  <span>Above</span>
                </button>
                <button
                  type="button"
                  className="wireframe-quick-insert-btn"
                  onClick={() => onInsertRelative("below")}
                  title="Insert container directly below this element"
                  disabled={isLocked}
                >
                  <ArrowDown size={12} />
                  <span>Below</span>
                </button>
                <button
                  type="button"
                  className="wireframe-quick-insert-btn"
                  onClick={() => onInsertRelative("inside")}
                  title="Insert child inside this container"
                  disabled={isLocked}
                >
                  <CornerDownRight size={12} />
                  <span>Inside</span>
                </button>
              </div>

              {/* Pick component to insert */}
              <div className="wireframe-quick-add-picker">
                <select
                  className="wireframe-quick-add-select"
                  aria-label="Component type to insert"
                  value={quickAddStencilId}
                  onChange={(e) => onQuickAddStencilChange(e.target.value)}
                  disabled={isLocked}
                >
                  <optgroup label="Layout">
                    <option value="wf-container">Container</option>
                    <option value="wf-row">Row</option>
                    <option value="wf-column">Column</option>
                    <option value="wf-card">Card</option>
                    <option value="wf-divider">Divider</option>
                    <option value="wf-spacer">Spacer</option>
                  </optgroup>
                  <optgroup label="Controls & Data">
                    <option value="wf-button">Button</option>
                    <option value="wf-input">Text Input</option>
                    <option value="wf-data-table">Data Table</option>
                    <option value="wf-heading">Heading</option>
                    <option value="wf-text">Text</option>
                    <option value="wf-alert">Alert</option>
                  </optgroup>
                  {customSnippets.length > 0 && (
                    <optgroup label="Saved Snippets">
                      {customSnippets.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label || s.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <button
                  type="button"
                  className="wireframe-quick-add-submit"
                  onClick={() => onInsertRelative("inside", quickAddStencilId)}
                  title="Add selected component inside"
                  disabled={isLocked}
                >
                  + Add
                </button>
              </div>
            </div>

            {/* Developer Note (First-Class Feature & Callout Pin) */}
            <div className="wireframe-prop-group wireframe-dev-note-group">
              <label className="wireframe-prop-label">
                <FileText size={12} />
                <span>Developer Note & Callout Pin</span>
              </label>
              <textarea
                className="wireframe-dev-note-input"
                rows={3}
                placeholder="Add implementation notes, API links, or interaction specs..."
                value={devNote}
                onChange={(e) => onDevNoteChange(e.target.value)}
              />
            </div>

            {/* Text Field (for buttons, headings, text) */}
            {propText !== "" && (
              <div className="wireframe-prop-group">
                <label className="wireframe-prop-label">Text Content</label>
                <input
                  type="text"
                  className="wireframe-prop-input"
                  value={propText}
                  onChange={(e) => onTextChange(e.target.value)}
                  disabled={isLocked}
                />
              </div>
            )}

            {/* Dimensions Row + Presets */}
            <div className="wireframe-prop-row">
              <div className="wireframe-prop-group">
                <label className="wireframe-prop-label">Width</label>
                <input
                  type="text"
                  className="wireframe-prop-input"
                  placeholder="e.g. 100%, 240px, auto"
                  value={propWidth}
                  onChange={(e) => onWidthChange(e.target.value)}
                  disabled={isLocked}
                />
                <div className="wireframe-size-chips">
                  <button
                    type="button"
                    className={`wireframe-size-chip ${propWidth === "100%" ? "active" : ""}`}
                    onClick={() => onWidthChange("100%")}
                    disabled={isLocked}
                  >
                    100%
                  </button>
                  <button
                    type="button"
                    className={`wireframe-size-chip ${propWidth === "50%" ? "active" : ""}`}
                    onClick={() => onWidthChange("50%")}
                    disabled={isLocked}
                  >
                    50%
                  </button>
                  <button
                    type="button"
                    className={`wireframe-size-chip ${propWidth === "auto" ? "active" : ""}`}
                    onClick={() => onWidthChange("auto")}
                    disabled={isLocked}
                  >
                    Auto
                  </button>
                </div>
              </div>
              <div className="wireframe-prop-group">
                <label className="wireframe-prop-label">Height</label>
                <input
                  type="text"
                  className="wireframe-prop-input"
                  placeholder="e.g. 56px, auto"
                  value={propHeight}
                  onChange={(e) => onHeightChange(e.target.value)}
                  disabled={isLocked}
                />
                <div className="wireframe-size-chips">
                  <button
                    type="button"
                    className={`wireframe-size-chip ${propHeight === "auto" ? "active" : ""}`}
                    onClick={() => onHeightChange("auto")}
                    disabled={isLocked}
                  >
                    Auto
                  </button>
                  <button
                    type="button"
                    className={`wireframe-size-chip ${propHeight === "160px" ? "active" : ""}`}
                    onClick={() => onHeightChange("160px")}
                    disabled={isLocked}
                  >
                    160px
                  </button>
                  <button
                    type="button"
                    className={`wireframe-size-chip ${propHeight === "320px" ? "active" : ""}`}
                    onClick={() => onHeightChange("320px")}
                    disabled={isLocked}
                  >
                    320px
                  </button>
                </div>
              </div>
            </div>

            {/* Variant / Style for Buttons */}
            {compMeta.name === "Button" && (
              <div className="wireframe-prop-group">
                <label className="wireframe-prop-label">Variant</label>
                <div className="wireframe-segmented-control">
                  <button
                    type="button"
                    className={`wireframe-seg-btn ${propVariant === "primary" ? "active" : ""}`}
                    onClick={() => onVariantChange("primary")}
                    disabled={isLocked}
                  >
                    Primary
                  </button>
                  <button
                    type="button"
                    className={`wireframe-seg-btn ${propVariant === "secondary" ? "active" : ""}`}
                    onClick={() => onVariantChange("secondary")}
                    disabled={isLocked}
                  >
                    Secondary
                  </button>
                  <button
                    type="button"
                    className={`wireframe-seg-btn ${propVariant === "outline" ? "active" : ""}`}
                    onClick={() => onVariantChange("outline")}
                    disabled={isLocked}
                  >
                    Outline
                  </button>
                  <button
                    type="button"
                    className={`wireframe-seg-btn ${propVariant === "danger" ? "active" : ""}`}
                    onClick={() => onVariantChange("danger")}
                    disabled={isLocked}
                  >
                    Danger
                  </button>
                </div>
              </div>
            )}

            {/* Layout Controls (Containers, Rows, Columns, Page) */}
            {(compMeta.name === "Container" ||
              compMeta.name === "Row" ||
              compMeta.name === "Column" ||
              compMeta.name === "Page" ||
              compMeta.name === "Stack" ||
              compMeta.name === "Content Area" ||
              isContainer) && (
              <>
                <div className="wireframe-prop-row">
                  <div className="wireframe-prop-group">
                    <label className="wireframe-prop-label">Gap</label>
                    <input
                      type="text"
                      className="wireframe-prop-input"
                      placeholder="e.g. 16px"
                      value={propGap}
                      onChange={(e) => onGapChange(e.target.value)}
                      disabled={isLocked}
                    />
                  </div>
                  <div className="wireframe-prop-group">
                    <label className="wireframe-prop-label">Padding</label>
                    <input
                      type="text"
                      className="wireframe-prop-input"
                      placeholder="e.g. 16px"
                      value={propPadding}
                      onChange={(e) => onPaddingChange(e.target.value)}
                      disabled={isLocked}
                    />
                  </div>
                </div>

                <div className="wireframe-prop-group">
                  <label className="wireframe-prop-label">Direction</label>
                  <div className="wireframe-segmented-control">
                    <button
                      type="button"
                      className={`wireframe-seg-btn ${propDirection === "column" ? "active" : ""}`}
                      onClick={() => onDirectionChange("column")}
                      disabled={isLocked}
                    >
                      Vertical (Column)
                    </button>
                    <button
                      type="button"
                      className={`wireframe-seg-btn ${propDirection === "row" ? "active" : ""}`}
                      onClick={() => onDirectionChange("row")}
                      disabled={isLocked}
                    >
                      Horizontal (Row)
                    </button>
                  </div>
                </div>

                {/* Multi-Column & Multi-Row Grid Management */}
                <div className="wireframe-prop-group">
                  <label className="wireframe-prop-label">
                    <Columns size={12} />
                    <span>Columns Preset</span>
                  </label>
                  <div className="wireframe-size-chips" style={{ marginTop: "4px" }}>
                    <button
                      type="button"
                      className="wireframe-size-chip"
                      onClick={() => onSetColumnsPreset?.(2)}
                      disabled={isLocked}
                      title="Split into 2 equal columns (50% / 50%)"
                    >
                      2 Cols
                    </button>
                    <button
                      type="button"
                      className="wireframe-size-chip"
                      onClick={() => onSetColumnsPreset?.(3)}
                      disabled={isLocked}
                      title="Split into 3 equal columns (33% each)"
                    >
                      3 Cols
                    </button>
                    <button
                      type="button"
                      className="wireframe-size-chip"
                      onClick={() => onSetColumnsPreset?.(4)}
                      disabled={isLocked}
                      title="Split into 4 equal columns (25% each)"
                    >
                      4 Cols
                    </button>
                    <button
                      type="button"
                      className="wireframe-size-chip"
                      onClick={() => onSetColumnsPreset?.("split-1-2")}
                      disabled={isLocked}
                      title="Split 1/3 sidebar + 2/3 main area"
                    >
                      1/3 + 2/3
                    </button>
                  </div>
                </div>

                <div className="wireframe-prop-row" style={{ marginTop: "4px", gap: "6px" }}>
                  <button
                    type="button"
                    className="wireframe-quick-insert-btn"
                    onClick={onAddColumn}
                    disabled={isLocked}
                    title="Add another column to this row/container"
                    style={{ flex: 1, padding: "5px 8px" }}
                  >
                    <Columns size={12} />
                    <span>+ Column</span>
                  </button>
                  <button
                    type="button"
                    className="wireframe-quick-insert-btn"
                    onClick={onAddRow}
                    disabled={isLocked}
                    title="Add another row below or inside container"
                    style={{ flex: 1, padding: "5px 8px" }}
                  >
                    <Rows size={12} />
                    <span>+ Row</span>
                  </button>
                </div>
              </>
            )}

            {/* Collapsible Advanced Section */}
            <div className="wireframe-advanced-section">
              <button
                type="button"
                className="wireframe-advanced-toggle"
                onClick={onToggleAdvanced}
              >
                {advancedOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <span>Advanced CSS & Attributes</span>
              </button>

              <div
                className="wireframe-advanced-body"
                style={{ display: advancedOpen ? "block" : "none" }}
              >
                <div className="wireframe-sm-container" />
                <div className="wireframe-traits-container" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
