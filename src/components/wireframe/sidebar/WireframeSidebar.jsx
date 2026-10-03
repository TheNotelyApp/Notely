import React from "react";
import { Box, Inbox, Search, Trash2 } from "lucide-react";
import AppSelect from "../../AppSelect";

export function WireframeSidebar({
  combinedCategories,
  activeCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  filteredStencils,
  customSnippets: _customSnippets,
  onDeleteSnippet,
  onInsertStencil
}) {
  const categoryOptions = combinedCategories.map((c) => ({
    value: c.id,
    label: c.label
  }));

  return (
    <aside className="wireframe-stencil-sidebar">
      {/* Search Header */}
      <div className="wireframe-sidebar-header">
        <div className="wireframe-sidebar-search">
          <Search size={12} className="wireframe-search-icon" aria-hidden="true" />
          <input
            type="text"
            className="wireframe-search-input"
            placeholder="Search stencils..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="wireframe-search-clear"
              onClick={() => onSearchChange("")}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Category Horizontal Filter Pills */}
        <div className="wireframe-category-pills">
          {combinedCategories.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                className={`wireframe-cat-pill ${isActive ? "active" : ""}`}
                onClick={() => onSelectCategory(cat.id)}
              >
                {cat.label.replace("Components", "").trim()}
              </button>
            );
          })}
        </div>

        {/* Accessible hidden select for form/test bindings */}
        <div style={{ display: "none" }}>
          <AppSelect
            id="wireframe-category-select"
            value={activeCategory}
            options={categoryOptions}
            onChange={onSelectCategory}
          />
        </div>
      </div>

      {/* Stencil Tiles Grid */}
      <div className="wireframe-stencil-grid">
        {filteredStencils.length === 0 ? (
          <div className="wireframe-empty-stencils">
            <Inbox size={20} style={{ opacity: 0.5, marginBottom: "4px" }} />
            <div>No components found</div>
          </div>
        ) : (
          filteredStencils.map((stencil) => {
            const Icon = stencil.icon || Box;
            const isCustom = stencil.category === "custom";
            return (
              <div
                key={stencil.id}
                className="wireframe-stencil-tile"
                draggable
                data-gjs-type={stencil.id}
                onDragStart={(e) => {
                  try {
                    e.dataTransfer.setData("text/html", stencil.content);
                    e.dataTransfer.setData("text/plain", stencil.content);
                    e.dataTransfer.setData("gjs-type", stencil.id);
                    e.dataTransfer.effectAllowed = "copy";
                  } catch {
                    // ignore
                  }
                }}
                onClick={() => onInsertStencil?.(stencil)}
                title={`${stencil.label || stencil.name}\n${stencil.desc || ""}\n• Click or drag to canvas`}
              >
                {isCustom && (
                  <button
                    type="button"
                    className="wireframe-snippet-delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSnippet(stencil.id);
                    }}
                    title="Delete saved snippet"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
                <div className="wireframe-stencil-tile-icon">
                  <Icon size={16} />
                </div>
                <span className="wireframe-stencil-tile-name">{stencil.label || stencil.name}</span>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
