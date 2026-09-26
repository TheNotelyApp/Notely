import { describe, it, expect } from "vitest";
import {
  detectMermaidType,
  extractMermaidTitle,
  normalizeAssetPath,
  extractWorkspaceUsedAssets,
  filterAssets,
  mergeDiskMediaIntoCatalog,
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

    // Usage filter (unused / orphans)
    const itemsWithUnused = [
      ...items,
      {
        id: "disk-4",
        name: "meeting_recording.webm",
        category: "audio",
        subType: "webm",
        referenceCount: 0,
        referencedBy: [],
        isUnused: true,
      },
    ];
    expect(filterAssets(itemsWithUnused, { usageFilter: "unused" }).length).toBe(1);
    expect(filterAssets(itemsWithUnused, { usageFilter: "unused" })[0].name).toBe("meeting_recording.webm");
  });

  it("merges physical disk files into catalog and identifies unreferenced orphans", () => {
    const usedAssets = [
      {
        id: "1",
        name: "logo.png",
        path: "images/logo.png",
        category: "image",
        referenceCount: 1,
        referencedBy: [{ noteTitle: "Intro" }],
      },
    ];

    const diskFiles = [
      { path: "images/logo.png", name: "logo.png", ext: "png", size: 1024 },
      { path: "media/audio/meeting_2026.webm", name: "meeting_2026.webm", ext: "webm", size: 50000 },
      { path: "media/snips/snip_123.png", name: "snip_123.png", ext: "png", size: 24000 },
    ];

    const combined = mergeDiskMediaIntoCatalog(usedAssets, diskFiles);
    expect(combined.length).toBe(3);

    const unusedAudio = combined.find((a) => a.name === "meeting_2026.webm");
    expect(unusedAudio).toBeDefined();
    expect(unusedAudio.category).toBe("audio");
    expect(unusedAudio.referenceCount).toBe(0);
    expect(unusedAudio.isUnused).toBe(true);

    const unusedSnip = combined.find((a) => a.name === "snip_123.png");
    expect(unusedSnip).toBeDefined();
    expect(unusedSnip.referenceCount).toBe(0);
    expect(unusedSnip.isUnused).toBe(true);

    // Existing used logo kept its references
    const logo = combined.find((a) => a.name === "logo.png");
    expect(logo.referenceCount).toBe(1);
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

  it("identifies audio companion transcripts and filters them by transcript category", () => {
    const diskFiles = [
      {
        path: "media/audio/meeting_2026-09-26.webm",
        name: "meeting_2026-09-26.webm",
        ext: "webm",
        size: 500000,
        mtime: "2026-09-26T10:00:00Z",
      },
      {
        path: "media/audio/meeting_2026-09-26.json",
        name: "meeting_2026-09-26.json",
        ext: "json",
        size: 1200,
        mtime: "2026-09-26T10:01:00Z",
      },
      {
        path: "media/interview_transcript.json",
        name: "interview_transcript.json",
        ext: "json",
        size: 2400,
        mtime: "2026-09-26T11:00:00Z",
      },
    ];

    const catalog = mergeDiskMediaIntoCatalog([], diskFiles);
    const transcripts = catalog.filter((a) => a.category === "transcript");

    expect(transcripts.length).toBe(2);
    expect(transcripts.map((t) => t.name)).toContain("meeting_2026-09-26.json");
    expect(transcripts.map((t) => t.name)).toContain("interview_transcript.json");

    const filtered = filterAssets(catalog, {
      selectedCategories: { transcript: true, audio: false, video: false, image: false, diagram: false, document: false, pdf: false },
    });
    expect(filtered.length).toBe(2);
  });
});
