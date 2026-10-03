import { describe, expect, it } from "vitest";
import { CATEGORIES, WIREFRAME_STENCILS, COMPONENT_REGISTRY } from "../../components/wireframe/stencils";

describe("Wireframe Stencils & Component Registry", () => {
  it("exports exactly the required 6 semantic categories + 'all'", () => {
    const categoryIds = CATEGORIES.map((c) => c.id);
    expect(categoryIds).toEqual(["all", "layout", "navigation", "controls", "data", "feedback", "content"]);
  });

  it("exports all expected atomic wireframe components with valid metadata", () => {
    expect(WIREFRAME_STENCILS.length).toBeGreaterThanOrEqual(35);
    const validCategoryIds = new Set(["layout", "navigation", "controls", "data", "feedback", "content"]);

    for (const stencil of WIREFRAME_STENCILS) {
      expect(stencil.id).toBeTruthy();
      expect(stencil.name).toBeTruthy();
      expect(stencil.label).toBeTruthy();
      expect(stencil.category).toBeTruthy();
      expect(validCategoryIds.has(stencil.category)).toBe(true);
      expect(stencil.content).toContain("<");
      expect(stencil.content).toContain("data-dev-note");
      expect(stencil.content).toContain("data-wf-type");
      expect(stencil.icon).toBeTruthy();
      expect(stencil.defaults).toBeDefined();
    }
  });

  it("has strictly unique stencil IDs", () => {
    const ids = WIREFRAME_STENCILS.map((s) => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("strictly excludes forbidden full-page screen templates", () => {
    const forbiddenPatterns = [
      /dashboard/i,
      /user management/i,
      /analytics/i,
      /thingworx/i,
      /login screen/i,
      /settings page/i,
      /saas/i,
      /admin/i
    ];

    for (const stencil of WIREFRAME_STENCILS) {
      for (const pattern of forbiddenPatterns) {
        expect(stencil.name).not.toMatch(pattern);
        expect(stencil.label).not.toMatch(pattern);
      }
    }
  });

  it("includes all essential atomic primitives", () => {
    const ids = new Set(WIREFRAME_STENCILS.map((s) => s.id));
    
    // Layout
    expect(ids.has("wf-page")).toBe(true);
    expect(ids.has("wf-container")).toBe(true);
    expect(ids.has("wf-row")).toBe(true);
    expect(ids.has("wf-column")).toBe(true);
    expect(ids.has("wf-header-bar")).toBe(true);
    expect(ids.has("wf-topbar-compact")).toBe(true);
    expect(ids.has("wf-sidebar")).toBe(true);
    expect(ids.has("wf-sidebar-collapsed")).toBe(true);
    expect(ids.has("wf-content-area")).toBe(true);
    expect(ids.has("wf-card")).toBe(true);
    expect(ids.has("wf-toolbar")).toBe(true);
    expect(ids.has("wf-footer")).toBe(true);
    expect(ids.has("wf-divider")).toBe(true);
    expect(ids.has("wf-spacer")).toBe(true);

    // Navigation
    expect(ids.has("wf-breadcrumb")).toBe(true);
    expect(ids.has("wf-nav-item")).toBe(true);
    expect(ids.has("wf-tabs")).toBe(true);
    expect(ids.has("wf-menu")).toBe(true);
    expect(ids.has("wf-dropdown")).toBe(true);
    expect(ids.has("wf-pagination")).toBe(true);

    // Controls
    expect(ids.has("wf-button")).toBe(true);
    expect(ids.has("wf-icon-button")).toBe(true);
    expect(ids.has("wf-input")).toBe(true);
    expect(ids.has("wf-search-input")).toBe(true);
    expect(ids.has("wf-select")).toBe(true);
    expect(ids.has("wf-checkbox")).toBe(true);
    expect(ids.has("wf-radio")).toBe(true);
    expect(ids.has("wf-toggle")).toBe(true);
    expect(ids.has("wf-date-input")).toBe(true);
    expect(ids.has("wf-textarea")).toBe(true);

    // Data
    expect(ids.has("wf-data-table")).toBe(true);
    expect(ids.has("wf-list")).toBe(true);
    expect(ids.has("wf-badge")).toBe(true);
    expect(ids.has("wf-status-indicator")).toBe(true);

    // Feedback
    expect(ids.has("wf-alert")).toBe(true);
    expect(ids.has("wf-toast")).toBe(true);
    expect(ids.has("wf-modal")).toBe(true);
    expect(ids.has("wf-confirm-dialog")).toBe(true);
    expect(ids.has("wf-loading")).toBe(true);
    expect(ids.has("wf-empty-state")).toBe(true);

    // Content
    expect(ids.has("wf-heading")).toBe(true);
    expect(ids.has("wf-text")).toBe(true);
    expect(ids.has("wf-image-placeholder")).toBe(true);
  });
});
