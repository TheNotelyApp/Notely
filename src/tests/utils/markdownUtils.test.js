import { describe, expect, it } from "vitest";
import { getLineStartOffset, resolveTargetLine } from "../../utils/markdownUtils";

describe("getLineStartOffset", () => {
  it("computes exact character offset for LF line endings", () => {
    const text = "Line 1\nLine 2\n- [ ] Task line";
    expect(getLineStartOffset(text, 1)).toBe(0);
    expect(getLineStartOffset(text, 2)).toBe(7);
    expect(getLineStartOffset(text, 3)).toBe(14);
    expect(text.slice(getLineStartOffset(text, 3))).toBe("- [ ] Task line");
  });

  it("computes exact character offset for CRLF line endings without landing on upper CR", () => {
    const text = "Line 1\r\nLine 2\r\n- [ ] Task line";
    expect(getLineStartOffset(text, 1)).toBe(0);
    expect(getLineStartOffset(text, 2)).toBe(8);
    expect(getLineStartOffset(text, 3)).toBe(16);
    expect(text.slice(getLineStartOffset(text, 3))).toBe("- [ ] Task line");
  });

  it("handles line targets past end of text gracefully by returning last line start", () => {
    const text = "Alpha\nBeta";
    expect(getLineStartOffset(text, 10)).toBe(6);
  });
});

describe("resolveTargetLine", () => {
  it("resolves target line when line index is accurate", () => {
    const text = "\n\n[ ] A for apple";
    expect(resolveTargetLine(text, 3, "A for apple")).toBe(3);
  });

  it("resolves line via text matching when line index is offset by headers or empty lines", () => {
    const text = "\n\n[ ] A for apple";
    expect(resolveTargetLine(text, 6, "A for apple")).toBe(3);
  });
});

