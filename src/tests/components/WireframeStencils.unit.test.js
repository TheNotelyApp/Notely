import { describe, expect, it } from "vitest";
import { CATEGORIES, WIREFRAME_STENCILS } from "../../components/wireframe/stencils";

describe("Wireframe Stencils Modularity & Integrity", () => {
  it("exports valid CATEGORIES array with distinct IDs", () => {
    expect(CATEGORIES.length).toBeGreaterThan(5);
    const ids = CATEGORIES.map((c) => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("exports WIREFRAME_STENCILS with required fields", () => {
    expect(WIREFRAME_STENCILS.length).toBeGreaterThan(20);
    const validCategoryIds = new Set(CATEGORIES.map((c) => c.id));

    for (const stencil of WIREFRAME_STENCILS) {
      expect(stencil.id).toBeTruthy();
      expect(stencil.label).toBeTruthy();
      expect(stencil.category).toBeTruthy();
      expect(validCategoryIds.has(stencil.category)).toBe(true);
      expect(stencil.content).toContain("<");
      expect(stencil.icon).toBeTruthy();
    }
  });

  it("has unique stencil IDs", () => {
    const ids = WIREFRAME_STENCILS.map((s) => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});
