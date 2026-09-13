import { describe, it, expect } from "vitest";
import {
  detectMermaidType,
  extractMermaidTitle,
  normalizeAssetPath,
  extractWorkspaceUsedAssets,
  filterAssets,
} from "../../services/workspaceMediaService";

describe("workspaceMediaService", () => {
  it("detects Mermaid diagram types correctly", () => {
    expect(detectMermaidType("graph TD\nA --> B")).toBe("Flowchart");
    expect(detectMermaidType("flowchart LR\nA --> B")).toBe("Flowchart");
    expect(detectMermaidType("sequenceDiagram\nAlice->>Bob: Hello")).toBe("Sequence");
    expect(detectMermaidType("classDiagram\nclass BankAccount")).toBe("Class");
    expect(detectMermaidType("stateDiagram-v2\n[*] --> Still")).toBe("State");
    expect(detectMermaidType("erDiagram\nCUSTOMER ||--o{ ORDER : places")).toBe("Entity Relationship");
    expect(detectMermaidType("mindmap\nroot((Root))")).toBe("Mindmap");
  });

  it("extracts Mermaid titles from comments or syntax", () => {
    expect(extractMermaidTitle("%% Architecture Overview\ngraph TD\nA --> B")).toBe("Architecture Overview");
    expect(extractMermaidTitle("accTitle: User Login Flow\nsequenceDiagram\nA->>B: Hi")).toBe("User Login Flow");
    expect(extractMermaidTitle("graph TD\nA --> B")).toBe("Flowchart Diagram");
  });

  it("normalizes asset paths cleanly", () => {
    expect(normalizeAssetPath("./images/diagram.png")).toBe("images/diagram.png");
    expect(normalizeAssetPath(".\\assets\\report.pdf")).toBe("assets/report.pdf");
    expect(normalizeAssetPath("<./media/docs/manual.pdf>")).toBe("media/docs/manual.pdf");
  });

  it("extracts used diagrams, media, and PDFs with referencing notes and line numbers", () => {
    const documents = [
      {
        filePath: "/workspace/notes/SystemArchitecture.md",
        title: "System Architecture",
        content: `# System Architecture
Here is the core flowchart:
\`\`\`mermaid
%% Core Pipeline
graph TD
  A[Input] --> B[Processing]
  B --> C[Output]
\`\`\`

Also an architecture diagram image:
![Arch Diagram](./images/arch.png)

And a specification document:
[API Spec](/media/docs/api-spec.pdf)
`,
      },
      {
        filePath: "/workspace/notes/Deployment.md",
        title: "Deployment Guide",
        content: `# Deployment Guide
Referencing the same diagram:
\`\`\`mermaid
%% Core Pipeline
graph TD
  A[Input] --> B[Processing]
  B --> C[Output]
\`\`\`

And the same architecture image:
![Arch Diagram](./images/arch.png)
`,
      },
    ];

    const assets = extractWorkspaceUsedAssets(documents);
    expect(assets.length).toBe(3); // 1 deduplicated mermaid diagram, 1 deduplicated image, 1 pdf

    // 1. Mermaid diagram
    const mermaidItem = assets.find((a) => a.subType === "mermaid");
    expect(mermaidItem).toBeDefined();
    expect(mermaidItem.name).toBe("Core Pipeline");
    expect(mermaidItem.diagramType).toBe("Flowchart");
    expect(mermaidItem.referenceCount).toBe(2);
    expect(mermaidItem.referencedBy.length).toBe(2);
    expect(mermaidItem.referencedBy[0].noteTitle).toBe("System Architecture");
    expect(mermaidItem.referencedBy[0].lineNumber).toBe(3);
    expect(mermaidItem.referencedBy[1].noteTitle).toBe("Deployment Guide");

    // 2. Image
    const imageItem = assets.find((a) => a.path === "images/arch.png");
    expect(imageItem).toBeDefined();
    expect(imageItem.category).toBe("image");
    expect(imageItem.referenceCount).toBe(2);
    expect(imageItem.referencedBy.length).toBe(2);

    // 3. PDF
    const pdfItem = assets.find((a) => a.subType === "pdf");
    expect(pdfItem).toBeDefined();
    expect(pdfItem.category).toBe("pdf");
    expect(pdfItem.name).toBe("API Spec");
    expect(pdfItem.referenceCount).toBe(1);
    expect(pdfItem.referencedBy[0].noteTitle).toBe("System Architecture");
  });

  it("filters items by search query, categories, and reference count", () => {
    const items = [
      {
        id: "1",
        name: "Login Flow",
        category: "diagram",
        subType: "mermaid",
        referenceCount: 3,
        referencedBy: [{ noteTitle: "Auth Note", notePath: "/notes/auth.md" }],
      },
      {
        id: "2",
        name: "Company Logo",
        category: "image",
        subType: "png",
        referenceCount: 1,
        referencedBy: [{ noteTitle: "Branding", notePath: "/notes/brand.md" }],
      },
      {
        id: "3",
        name: "Annual Report",
        category: "pdf",
        subType: "pdf",
        referenceCount: 2,
        referencedBy: [{ noteTitle: "Finance Note", notePath: "/notes/fin.md" }],
      },
    ];

    // Search query
    expect(filterAssets(items, { searchQuery: "auth" }).length).toBe(1);
    expect(filterAssets(items, { searchQuery: "logo" }).length).toBe(1);

    // Category filter
    expect(filterAssets(items, { selectedCategories: { diagram: true, image: false, pdf: false } }).length).toBe(1);

    // Usage filter (multi notes)
    expect(filterAssets(items, { usageFilter: "multi" }).length).toBe(2);
    expect(filterAssets(items, { usageFilter: "single" }).length).toBe(1);
  });

  it("extracts Excalidraw and Draw.io diagrams with diagramId", () => {
    const documents = [
      {
        filePath: "/workspace/notes/Designs.md",
        title: "Designs Note",
        content: `# Designs
Draw.io:
![Drawio Diagram](media/draw.io/drawio_789.png)

Excalidraw:
![Excalidraw Diagram](media/excalidraw/exc_123/diagram.png)
`,
      },
    ];

    const assets = extractWorkspaceUsedAssets(documents);
    const drawio = assets.find((a) => a.subType === "drawio");
    const excalidraw = assets.find((a) => a.subType === "excalidraw");

    expect(drawio).toBeDefined();
    expect(drawio.category).toBe("diagram");
    expect(drawio.diagramId).toBe("drawio_789");

    expect(excalidraw).toBeDefined();
    expect(excalidraw.category).toBe("diagram");
    expect(excalidraw.diagramId).toBe("exc_123");
  });
});
