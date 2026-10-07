import { describe, it, expect } from "vitest";
import {
  detectMermaidType,
  extractMermaidTitle,
  normalizeAssetPath,
  extractWorkspaceUsedAssets,
  filterAssets,
  mergeDiskMediaIntoCatalog,
  autoLinkAudioAndTranscripts,
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
    expect(normalizeAssetPath("images/photo%20with%20spaces.png \"My Title\"")).toBe("images/photo with spaces.png");
    expect(normalizeAssetPath("images/test.png?v=123#page=1")).toBe("images/test.png");
    expect(normalizeAssetPath("../../../../media/excalidraw/e900811f/diagram.png")).toBe("media/excalidraw/e900811f/diagram.png");
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

  it("extracts Wikilinks and HTML media tags correctly", () => {
    const documents = [
      {
        filePath: "/workspace/notes/ObsidianNotes.md",
        title: "Obsidian Notes",
        content: `# Note
Wikilink Image:
![[media/images/screenshot.png|My Screenshot]]

Wikilink Document:
[[media/docs/specs.pdf|Product Specs]]

HTML Image:
<img src="./images/banner.png" alt="Header Banner" />

HTML Audio:
<audio src="/media/audio/podcast.mp3" controls></audio>
`,
      },
    ];

    const assets = extractWorkspaceUsedAssets(documents);
    expect(assets.length).toBe(4);

    const wikiImg = assets.find((a) => a.path.includes("screenshot.png"));
    expect(wikiImg).toBeDefined();
    expect(wikiImg.name).toBe("My Screenshot");
    expect(wikiImg.category).toBe("image");

    const wikiDoc = assets.find((a) => a.path.includes("specs.pdf"));
    expect(wikiDoc).toBeDefined();
    expect(wikiDoc.name).toBe("Product Specs");
    expect(wikiDoc.category).toBe("pdf");

    const htmlImg = assets.find((a) => a.path.includes("banner.png"));
    expect(htmlImg).toBeDefined();
    expect(htmlImg.name).toBe("Header Banner");

    const htmlAudio = assets.find((a) => a.path.includes("podcast.mp3"));
    expect(htmlAudio).toBeDefined();
    expect(htmlAudio.category).toBe("audio");
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

  it("merges physical disk files into catalog and prevents false unused due to alt text", () => {
    // Note uses custom alt text: ![Custom Banner Caption](./images/logo.png)
    const usedAssets = [
      {
        id: "1",
        name: "Custom Banner Caption",
        fileName: "logo.png",
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

    // logo.png should NOT be added again as an unused orphan
    const logoItems = combined.filter((a) => (a.fileName || a.name) === "logo.png" || a.path === "images/logo.png");
    expect(logoItems.length).toBe(1);
    expect(logoItems[0].referenceCount).toBe(1);
    expect(logoItems[0].size).toBe(1024); // enriched with disk file size

    const unusedAudio = combined.find((a) => a.name === "meeting_2026.webm");
    expect(unusedAudio).toBeDefined();
    expect(unusedAudio.category).toBe("audio");
    expect(unusedAudio.referenceCount).toBe(0);
    expect(unusedAudio.isUnused).toBe(true);

    const unusedSnip = combined.find((a) => a.name === "snip_123.png");
    expect(unusedSnip).toBeDefined();
    expect(unusedSnip.category).toBe("image");
    expect(unusedSnip.referenceCount).toBe(0);
    expect(unusedSnip.isUnused).toBe(true);
  });

  it("links companion audio files with transcripts automatically", () => {
    const assets = [
      {
        id: "audio-1",
        name: "standup_meeting.webm",
        fileName: "standup_meeting.webm",
        path: "media/audio/standup_meeting.webm",
        category: "audio",
        referenceCount: 1,
        referencedBy: [{ noteTitle: "Daily Standup" }],
      },
      {
        id: "tr-1",
        name: "standup_meeting_transcript.json",
        fileName: "standup_meeting_transcript.json",
        path: "media/audio/standup_meeting_transcript.json",
        category: "transcript",
        referenceCount: 1,
        referencedBy: [{ noteTitle: "Daily Standup" }],
      },
    ];

    autoLinkAudioAndTranscripts(assets);

    expect(assets[0].linkedTranscriptId).toBe("tr-1");
    expect(assets[0].linkedTranscriptPath).toBe("media/audio/standup_meeting_transcript.json");

    expect(assets[1].linkedAudioId).toBe("audio-1");
    expect(assets[1].linkedAudioPath).toBe("media/audio/standup_meeting.webm");
  });

  it("extracts and identifies Draw.io diagrams correctly", () => {
    const documents = [
      {
        filePath: "/notes/cloud.md",
        title: "Cloud Infrastructure",
        content: `
# Cloud Architecture
Here is the cloud diagram:
![Drawio Diagram](media/draw.io/drawio_789.png)
        `,
      },
    ];

    const assets = extractWorkspaceUsedAssets(documents);
    const drawio = assets.find((a) => a.subType === "drawio");

    expect(drawio).toBeDefined();
    expect(drawio.category).toBe("diagram");
    expect(drawio.diagramId).toBe("drawio_789");
  });

  it("extracts and identifies Wireframe diagrams and merges them without duplication", () => {
    const documents = [
      {
        filePath: "/notes/mobile-app.md",
        title: "Mobile App Wireframe",
        content: `
# Mobile App Wireframe
Here is the dashboard UI prototype:
![Wireframe Diagram](media/wireframes/f7f1c107.png)
        `,
      },
    ];

    const diskFiles = [
      {
        path: "media/wireframes/f7f1c107.wireframe.json",
        name: "f7f1c107.wireframe.json",
        ext: "json",
        size: 2400,
        mtime: "2026-09-28T10:00:00Z",
      },
      {
        path: "media/wireframes/f7f1c107.png",
        name: "f7f1c107.png",
        ext: "png",
        size: 15400,
        mtime: "2026-09-28T10:00:00Z",
      },
      {
        path: "media/wireframes/unused_orphan.wireframe.json",
        name: "unused_orphan.wireframe.json",
        ext: "json",
        size: 1500,
        mtime: "2026-09-27T11:00:00Z",
      },
      {
        path: "media/wireframes/unused_orphan.png",
        name: "unused_orphan.png",
        ext: "png",
        size: 12000,
        mtime: "2026-09-27T11:00:00Z",
      },
    ];

    const usedAssets = extractWorkspaceUsedAssets(documents);
    const catalog = mergeDiskMediaIntoCatalog(usedAssets, diskFiles);

    // Only 2 wireframe items should exist total (f7f1c107 and unused_orphan)
    const wireframes = catalog.filter((a) => a.category === "wireframe");
    expect(wireframes.length).toBe(2);

    // Used wireframe
    const usedWireframe = wireframes.find((a) => a.diagramId === "f7f1c107");
    expect(usedWireframe).toBeDefined();
    expect(usedWireframe.referenceCount).toBe(1);

    // Unused wireframe
    const unusedWireframe = wireframes.find((a) => a.diagramId === "unused_orphan");
    expect(unusedWireframe).toBeDefined();
    expect(unusedWireframe.referenceCount).toBe(0);
    expect(unusedWireframe.isUnused).toBe(true);
    expect(unusedWireframe.previewPath).toBe("media/wireframes/unused_orphan.png");
  });

  it("deduplicates Excalidraw and Draw.io diagram rendered preview images from catalog", () => {
    const documents = [
      {
        filePath: "/notes/architecture.md",
        title: "System Architecture",
        content: `
# Architecture
![Excalidraw Diagram](../../media/excalidraw/diag_123/diagram.png){data-diagram-id="diag_123" data-diagram-type="excalidraw"}
![Drawio Diagram](media/draw.io/chart_456.png)
        `,
      },
    ];

    const diskFiles = [
      {
        path: "media/excalidraw/diag_123/diagram.excalidraw",
        name: "diagram.excalidraw",
        ext: "excalidraw",
        size: 5000,
        mtime: "2026-09-29T12:00:00Z",
      },
      {
        path: "media/excalidraw/diag_123/diagram.png",
        name: "diagram.png",
        ext: "png",
        size: 25000,
        mtime: "2026-09-29T12:00:00Z",
      },
      {
        path: "media/draw.io/chart_456.drawio",
        name: "chart_456.drawio",
        ext: "drawio",
        size: 3200,
        mtime: "2026-09-29T13:00:00Z",
      },
      {
        path: "media/draw.io/chart_456.png",
        name: "chart_456.png",
        ext: "png",
        size: 18000,
        mtime: "2026-09-29T13:00:00Z",
      },
      // Unreferenced on disk
      {
        path: "media/draw.io/unreferenced_flow.drawio",
        name: "unreferenced_flow.drawio",
        ext: "drawio",
        size: 2000,
        mtime: "2026-09-29T14:00:00Z",
      },
      {
        path: "media/draw.io/unreferenced_flow.png",
        name: "unreferenced_flow.png",
        ext: "png",
        size: 14000,
        mtime: "2026-09-29T14:00:00Z",
      },
    ];

    const usedAssets = extractWorkspaceUsedAssets(documents);
    const catalog = mergeDiskMediaIntoCatalog(usedAssets, diskFiles);

    // No items should be categorized as generic "image"
    const images = catalog.filter((a) => a.category === "image");
    expect(images.length).toBe(0);

    // Exactly 3 diagrams total (diag_123, chart_456, unreferenced_flow)
    const diagrams = catalog.filter((a) => a.category === "diagram");
    expect(diagrams.length).toBe(3);

    const excalidraw = diagrams.find((d) => d.diagramId === "diag_123");
    expect(excalidraw).toBeDefined();
    expect(excalidraw.subType).toBe("excalidraw");
    expect(excalidraw.previewPath).toBe("media/excalidraw/diag_123/diagram.png");

    const drawio = diagrams.find((d) => d.diagramId === "chart_456");
    expect(drawio).toBeDefined();
    expect(drawio.subType).toBe("drawio");
    expect(drawio.previewPath).toBe("media/draw.io/chart_456.png");

    const unrefDrawio = diagrams.find((d) => d.diagramId === "unreferenced_flow");
    expect(unrefDrawio).toBeDefined();
    expect(unrefDrawio.isUnused).toBe(true);
    expect(unrefDrawio.previewPath).toBe("media/draw.io/unreferenced_flow.png");
  });

  it("does not include referenced markdown notes in diagrams and media catalog", () => {
    const documents = [
      {
        filePath: "/workspace/notes/ProjectAlpha.md",
        title: "Project Alpha",
        content: `# Project Alpha
See the related notes:
- [System Architecture](./Architecture/System%20Architecture.md)
- [[Deployment Guide]]
- [API Reference](../docs/api.markdown)

And actual media & documents:
- ![Design Mockup](./images/mockup.png)
- [Project Plan](./docs/plan.xlsx)
`,
      },
    ];

    const assets = extractWorkspaceUsedAssets(documents);
    // Should only contain the image (mockup.png) and the spreadsheet document (plan.xlsx), NOT the referenced markdown notes
    expect(assets.length).toBe(2);
    expect(assets.some((a) => a.name.includes("System Architecture"))).toBe(false);
    expect(assets.some((a) => a.name.includes("Deployment Guide"))).toBe(false);
    expect(assets.some((a) => a.name.includes("api.markdown"))).toBe(false);
    expect(assets.some((a) => a.path.includes("mockup.png"))).toBe(true);
    expect(assets.some((a) => a.path.includes("plan.xlsx"))).toBe(true);
  });
});
