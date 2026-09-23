import { describe, expect, it } from "vitest";
import { getLineStartOffset, resolveTargetLine, toRelativeDocPath } from "../../utils/markdownUtils";

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

describe("toRelativeDocPath", () => {
  it("calculates relative path from a nested note to media/excalidraw folder", () => {
    const notePath = "C:/workspace/docs/sub/note.md";
    const rel = toRelativeDocPath(notePath, "C:/workspace/media/excalidraw/12345678/diagram.png");
    expect(rel).toBe("../../media/excalidraw/12345678/diagram.png");
  });

  it("handles root note relative path to media/excalidraw folder", () => {
    const notePath = "C:/workspace/note.md";
    const rel = toRelativeDocPath(notePath, "C:/workspace/media/excalidraw/12345678/diagram.png");
    expect(rel).toBe("media/excalidraw/12345678/diagram.png");
  });

  it("correctly resolves a workspace-relative media path from a root note without extra parent levels", () => {
    const notePath = "C:/Users/oksbw/Documents/Notely Notes/MyRootNote.md";
    const workspacePath = "C:/Users/oksbw/Documents/Notely Notes";
    const mediaPath = "media/excalidraw/e900911f/diagram.png";
    const rel = toRelativeDocPath(notePath, mediaPath, workspacePath);
    expect(rel).toBe("media/excalidraw/e900911f/diagram.png");
  });

  it("correctly resolves a workspace-relative media path from a 1-level nested note", () => {
    const notePath = "C:/Users/oksbw/Documents/Notely Notes/Guides/MyGuide.md";
    const workspacePath = "C:/Users/oksbw/Documents/Notely Notes";
    const mediaPath = "media/excalidraw/e900911f/diagram.png";
    const rel = toRelativeDocPath(notePath, mediaPath, workspacePath);
    expect(rel).toBe("../media/excalidraw/e900911f/diagram.png");
  });

  it("correctly resolves a workspace-relative media path from a 2-level nested note", () => {
    const notePath = "C:/Users/oksbw/Documents/Notely Notes/Guides/Advanced/MyGuide.md";
    const workspacePath = "C:/Users/oksbw/Documents/Notely Notes";
    const mediaPath = "media/excalidraw/e900911f/diagram.png";
    const rel = toRelativeDocPath(notePath, mediaPath, workspacePath);
    expect(rel).toBe("../../media/excalidraw/e900911f/diagram.png");
  });
});
