import { describe, expect, it } from "vitest";
import { tableElementToPngDataUrl, svgElementToPngDataUrl } from "../../utils/exportUtils";

describe("exportUtils", () => {
  it("rejects invalid table elements gracefully", async () => {
    await expect(tableElementToPngDataUrl(null)).rejects.toThrow("Invalid Table element");
  });

  it("rejects invalid SVG elements gracefully", async () => {
    await expect(svgElementToPngDataUrl(null)).rejects.toThrow("Invalid SVG element");
  });
});
