// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExportImportModal } from "../../components/ExportImportModal";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("ExportImportModal subfolder notes integration", () => {
  let host;
  let root;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    window.notesApi = {
      getNotePackageDefaults: vi.fn().mockResolvedValue({
        destinationPath: "C:/exports",
        fileName: "export_package.nly",
      }),
      listWorkspaceTaskDocuments: vi.fn(),
      listDocuments: vi.fn(),
      selectExportPackageFolder: vi.fn(),
    };
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root.unmount();
      });
    }
    document.body.innerHTML = "";
    delete window.notesApi;
  });

  it("renders notes from subfolders via listWorkspaceTaskDocuments", async () => {
    const subfolderNotes = [
      { entryType: "file", fileName: "root_note.md", filePath: "C:/notes/root_note.md", title: "Root Note" },
      { entryType: "file", fileName: "sub_note.md", filePath: "C:/notes/folder/sub_note.md", title: "Subfolder Note" },
    ];
    window.notesApi.listWorkspaceTaskDocuments.mockResolvedValue(subfolderNotes);

    await act(async () => {
      root.render(<ExportImportModal isOpen={true} mode="export" onClose={vi.fn()} notify={vi.fn()} />);
    });

    const rows = host.querySelectorAll(".note-selector-row");
    expect(rows.length).toBe(2);
    expect(host.textContent).toContain("Root Note");
    expect(host.textContent).toContain("Subfolder Note");
    expect(host.textContent).toContain("2 of 2 notes selected");
  });

  it("falls back to BFS listDocuments with folderPath payload when listWorkspaceTaskDocuments is empty", async () => {
    window.notesApi.listWorkspaceTaskDocuments.mockResolvedValue([]);
    window.notesApi.listDocuments.mockImplementation(async (payload) => {
      if (!payload || !payload.folderPath) {
        return [
          { entryType: "file", fileName: "root.md", filePath: "C:/notes/root.md", title: "Root Note" },
          { entryType: "folder", filePath: "C:/notes/project_a", title: "Project A" },
        ];
      }
      if (payload.folderPath === "C:/notes/project_a") {
        return [
          { entryType: "file", fileName: "nested.md", filePath: "C:/notes/project_a/nested.md", title: "Nested Note" },
        ];
      }
      return [];
    });

    await act(async () => {
      root.render(<ExportImportModal isOpen={true} mode="export" onClose={vi.fn()} notify={vi.fn()} />);
    });

    const rows = host.querySelectorAll(".note-selector-row");
    expect(rows.length).toBe(2);
    expect(host.textContent).toContain("Root Note");
    expect(host.textContent).toContain("Nested Note");
    expect(window.notesApi.listDocuments).toHaveBeenCalledWith({ folderPath: "C:/notes/project_a" });
  });
});
