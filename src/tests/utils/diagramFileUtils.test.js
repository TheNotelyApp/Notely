import { describe, expect, it } from "vitest";
import { createDiagramMarkdown, extractDiagramReferences, parseDiagramReference } from "../../utils/diagramFileUtils";
import { parseDiagramBlocks } from "../../utils/renderUtils";

describe("diagramFileUtils & renderUtils relative path handling", () => {
  it("creates diagram markdown with relative paths when relativeToDocPath is provided", () => {
    // 2-levels deep inside workspace
    const mdNested = createDiagramMarkdown("my-doc", "diag1234", "subfolder/nested/page.md");
    expect(mdNested).toContain("../../media/excalidraw/diag1234/diagram.png");

    // Root note inside workspace: C:/project/page.md with workspace C:/project
    const mdRoot = createDiagramMarkdown("my-doc", "diag1234", "C:/project/page.md", "C:/project");
    expect(mdRoot).toContain("media/excalidraw/diag1234/diagram.png");

    // 1-level deep note: C:/project/subfolder/page.md with workspace C:/project
    const mdSub = createDiagramMarkdown("my-doc", "diag1234", "C:/project/subfolder/page.md", "C:/project");
    expect(mdSub).toContain("../media/excalidraw/diag1234/diagram.png");
  });

  it("parses diagram reference with relative path prefixes (../../media/...)", () => {
    const ref = "![Excalidraw Diagram](../../media/excalidraw/diag1234/diagram.png)";
    const parsed = parseDiagramReference(ref);
    expect(parsed).not.toBeNull();
    expect(parsed.diagramId).toBe("diag1234");
    expect(parsed.fullPath).toBe("../../media/excalidraw/diag1234/diagram.png");
  });

  it("extracts diagram references with relative paths and data attributes", () => {
    const markdown = '![Excalidraw Diagram](../../media/excalidraw/diag5678/diagram.png){data-diagram-id="diag5678" data-diagram-type="excalidraw"}';
    const refs = extractDiagramReferences(markdown);
    expect(refs).toHaveLength(1);
    expect(refs[0].diagramId).toBe("diag5678");
    expect(refs[0].imagePath).toBe("../../media/excalidraw/diag5678/diagram.png");
  });

  it("parseDiagramBlocks parses relative excalidraw diagram image references", () => {
    const content = "# Architecture\n\n![Excalidraw Diagram](../../media/excalidraw/diag9999/diagram.png){data-diagram-id=\"diag9999\" data-diagram-type=\"excalidraw\"}";
    const blocks = parseDiagramBlocks(content);
    const excalidrawBlock = blocks.find((b) => b.type === "excalidraw");
    expect(excalidrawBlock).toBeDefined();
    expect(excalidrawBlock.diagramId).toBe("diag9999");
    expect(excalidrawBlock.imagePath).toBe("../../media/excalidraw/diag9999/diagram.png");
  });

  it("maintains backward compatibility with all legacy diagram reference formats", () => {
    // 1. Current flat root format: media/excalidraw/[id]/diagram.png
    const parsedCurrent = parseDiagramReference("![Excalidraw Diagram](media/excalidraw/cur123/diagram.png)");
    expect(parsedCurrent?.diagramId).toBe("cur123");

    // 2. Legacy .notes-app format: .notes-app/excali-diagrams/[id]/diagram.png
    const parsedNotesApp = parseDiagramReference("![Excalidraw Diagram](.notes-app/excali-diagrams/legacy1/diagram.png)");
    expect(parsedNotesApp?.diagramId).toBe("legacy1");

    // 3. Legacy slugged format: excali-diagrams/[slug]/[id]/diagram.png
    const parsedSlugged = parseDiagramReference("![Excalidraw Diagram](excali-diagrams/myslug/slug123/diagram.png)");
    expect(parsedSlugged?.diagramId).toBe("slug123");

    // 4. Legacy flat diagrams format: media/diagrams/[id].png
    const parsedFlat = parseDiagramReference("![Excalidraw Diagram](media/diagrams/flat123.png)");
    expect(parsedFlat?.diagramId).toBe("flat123");

    // 5. Calling createDiagramMarkdown without doc path yields backward-compatible standard root path
    const standardMd = createDiagramMarkdown("my-doc", "std123");
    expect(standardMd).toBe('![Excalidraw Diagram](media/excalidraw/std123/diagram.png){data-diagram-id="std123" data-diagram-type="excalidraw"}');
  });

  it("parseDiagramBlocks parses relative draw.io diagram image references", () => {
    const content = '![Draw.io Diagram](../../media/draw.io/dio1234.png){data-diagram-id="dio1234"}';
    const blocks = parseDiagramBlocks(content);
    const drawioBlock = blocks.find((b) => b.type === "drawio");
    expect(drawioBlock).toBeDefined();
    expect(drawioBlock.diagramId).toBe("dio1234");
    expect(drawioBlock.imagePath).toBe("../../media/draw.io/dio1234.png");
  });
});

