import { describe, it, expect } from "vitest";
import { parseDocumentMultiLevelIndex, buildWorkspaceIndex, searchMultiLevelIndex } from "../../services/workspaceIndexService";

describe("workspaceIndexService", () => {
  const mockDocs = [
    {
      id: "doc1",
      filePath: "notes/architecture.md",
      title: "Architecture",
      content: `# System Architecture\n\n## Database Indexing\n\`\`\`sql\nCREATE INDEX idx_test ON notes(id);\n\`\`\`\n- [ ] Task 1\n- [x] Task 2`,
    },
    {
      id: "doc2",
      filePath: "docs/api.md",
      title: "API Specs",
      content: `# API Specification\n\n## Authentication\nJWT Auth endpoints. #api`,
    },
  ];

  it("should parse multi-level document headers correctly", () => {
    const doc1Index = parseDocumentMultiLevelIndex(mockDocs[0]);
    expect(doc1Index.title).toBe("Architecture");
    expect(doc1Index.headers.length).toBe(1);
    expect(doc1Index.headers[0].text).toBe("System Architecture");
    expect(doc1Index.headers[0].children[0].text).toBe("Database Indexing");
    expect(doc1Index.headers[0].children[0].blocks.length).toBe(3); // code, task, task
    expect(doc1Index.taskCount).toBe(2);
    expect(doc1Index.completedTaskCount).toBe(1);
  });

  it("should build workspace index across documents", () => {
    const wsIndex = buildWorkspaceIndex(mockDocs);
    expect(wsIndex.stats.totalDocuments).toBe(2);
    expect(wsIndex.stats.totalHeaders).toBe(4);
    expect(wsIndex.stats.totalCodeBlocks).toBe(1);
    expect(wsIndex.tagMap["api"]).toBeDefined();
  });

  it("should search multi-level index by query", () => {
    const wsIndex = buildWorkspaceIndex(mockDocs);
    const results = searchMultiLevelIndex(wsIndex, "Database");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].header.text).toBe("Database Indexing");
  });

  it("should respect subfolders and distinguish folder entries from notes", () => {
    const mixedEntries = [
      {
        entryType: "folder",
        filePath: "C:/workspace/guides",
        title: "guides",
      },
      {
        entryType: "file",
        filePath: "C:/workspace/guides/setup.md",
        title: "Setup Guide",
        content: "# Setup Guide\n\n## Installation",
      },
      {
        entryType: "file",
        filePath: "C:/workspace/root_note.md",
        title: "Root Note",
        content: "# Root Note",
      },
    ];

    const wsIndex = buildWorkspaceIndex(mixedEntries, { workspacePath: "C:/workspace" });

    // Folder entries should not count as note documents
    expect(wsIndex.stats.totalDocuments).toBe(2);

    // Folder tree should contain guides folder containing setup.md
    expect(wsIndex.folderTree.children["guides"]).toBeDefined();
    expect(wsIndex.folderTree.children["guides"].type).toBe("folder");
    expect(wsIndex.folderTree.children["guides"].children["setup.md"]).toBeDefined();
    expect(wsIndex.folderTree.children["guides"].children["setup.md"].type).toBe("file");
    expect(wsIndex.folderTree.children["root_note.md"]).toBeDefined();
    expect(wsIndex.folderTree.children["root_note.md"].type).toBe("file");
  });
});
