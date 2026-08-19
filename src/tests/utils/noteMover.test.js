import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import {
  extractLocalAssetPaths,
  transferDocumentWorkspace,
} from "../../../electron/lib/core/noteMover.cjs";

describe("noteMover core utility", () => {
  let tmpDir = "";
  let sourceWorkspace = "";
  let targetWorkspace = "";

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "notely-mover-test-"));
    sourceWorkspace = path.join(tmpDir, "SourceWS");
    targetWorkspace = path.join(tmpDir, "TargetWS");
    fs.mkdirSync(sourceWorkspace, { recursive: true });
    fs.mkdirSync(targetWorkspace, { recursive: true });
  });

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("extracts local asset paths correctly from Markdown content", () => {
    const md = `
# Sample Note
Here is an Excalidraw diagram: ![](.notes-app/excali-diagrams/diag1/diagram.png)
Here is a media image: ![](media/images/photo.png)
Here is a Draw.io diagram: ![](.notes-app/drawio-diagrams/diag2.png)
    `;
    const assets = extractLocalAssetPaths(md);
    expect(assets).toContain(".notes-app/excali-diagrams/diag1/diagram.png");
    expect(assets).toContain("media/images/photo.png");
    expect(assets).toContain(".notes-app/drawio-diagrams/diag2.png");
  });

  it("copies a note to target workspace without altering source note", () => {
    const notePath = path.join(sourceWorkspace, "MyNote.md");
    fs.writeFileSync(notePath, "# Hello World\nSome content.", "utf8");

    const mockDeps = {
      getNotesRoot: () => tmpDir,
      listProjectsState: () => ({
        projects: [
          { slug: "source", name: "SourceWS", rootPath: sourceWorkspace },
          { slug: "target", name: "TargetWS", rootPath: targetWorkspace },
        ],
      }),
    };

    const res = transferDocumentWorkspace(mockDeps, {
      filePath: notePath,
      targetWorkspaceSlug: "target",
      action: "copy",
    });

    expect(res.success).toBe(true);
    expect(res.action).toBe("copy");
    expect(fs.existsSync(notePath)).toBe(true); // Original note remains
    expect(fs.existsSync(res.targetFilePath)).toBe(true); // Target note created
    expect(fs.readFileSync(res.targetFilePath, "utf8")).toBe("# Hello World\nSome content.");
  });

  it("moves a note to target workspace and removes source note", () => {
    const notePath = path.join(sourceWorkspace, "MoveMe.md");
    fs.writeFileSync(notePath, "# Move Test", "utf8");

    const mockDeps = {
      getNotesRoot: () => tmpDir,
      listProjectsState: () => ({
        projects: [
          { slug: "source", name: "SourceWS", rootPath: sourceWorkspace },
          { slug: "target", name: "TargetWS", rootPath: targetWorkspace },
        ],
      }),
    };

    const res = transferDocumentWorkspace(mockDeps, {
      filePath: notePath,
      targetWorkspaceSlug: "target",
      action: "move",
    });

    expect(res.success).toBe(true);
    expect(res.action).toBe("move");
    expect(fs.existsSync(notePath)).toBe(false); // Source removed
    expect(fs.existsSync(res.targetFilePath)).toBe(true); // Target created
    expect(fs.readFileSync(res.targetFilePath, "utf8")).toBe("# Move Test");
  });

  it("auto-renames note when destination has duplicate filename", () => {
    const notePath = path.join(sourceWorkspace, "Duplicate.md");
    const existingTargetPath = path.join(targetWorkspace, "Duplicate.md");

    fs.writeFileSync(notePath, "# Source Version", "utf8");
    fs.writeFileSync(existingTargetPath, "# Pre-existing Target Version", "utf8");

    const mockDeps = {
      getNotesRoot: () => tmpDir,
      listProjectsState: () => ({
        projects: [
          { slug: "source", name: "SourceWS", rootPath: sourceWorkspace },
          { slug: "target", name: "TargetWS", rootPath: targetWorkspace },
        ],
      }),
    };

    const res = transferDocumentWorkspace(mockDeps, {
      filePath: notePath,
      targetWorkspaceSlug: "target",
      action: "copy",
      overwrite: false,
    });

    expect(res.success).toBe(true);
    expect(res.fileName).not.toBe("Duplicate.md");
    expect(res.fileName).toContain("Duplicate Copy (1).md");
    expect(fs.readFileSync(existingTargetPath, "utf8")).toBe("# Pre-existing Target Version");
    expect(fs.readFileSync(res.targetFilePath, "utf8")).toBe("# Source Version");
  });

  it("transfers associated media assets along with note", () => {
    const assetRelPath = "media/images/hero.png";
    const sourceAssetPath = path.join(sourceWorkspace, assetRelPath);
    fs.mkdirSync(path.dirname(sourceAssetPath), { recursive: true });
    fs.writeFileSync(sourceAssetPath, "fake-image-bytes", "utf8");

    const notePath = path.join(sourceWorkspace, "WithImage.md");
    fs.writeFileSync(notePath, `# Note\n![](media/images/hero.png)`, "utf8");

    const mockDeps = {
      getNotesRoot: () => tmpDir,
      listProjectsState: () => ({
        projects: [
          { slug: "source", name: "SourceWS", rootPath: sourceWorkspace },
          { slug: "target", name: "TargetWS", rootPath: targetWorkspace },
        ],
      }),
    };

    const res = transferDocumentWorkspace(mockDeps, {
      filePath: notePath,
      targetWorkspaceSlug: "target",
      action: "copy",
    });

    expect(res.success).toBe(true);
    expect(res.transferredAssetsCount).toBe(1);
    const targetAssetPath = path.join(targetWorkspace, assetRelPath);
    expect(fs.existsSync(targetAssetPath)).toBe(true);
    expect(fs.readFileSync(targetAssetPath, "utf8")).toBe("fake-image-bytes");
  });

  it("rewrites asset relative paths when transferring to a target subfolder", () => {
    const assetRelPath = "media/images/diagram.png";
    const sourceAssetPath = path.join(sourceWorkspace, assetRelPath);
    fs.mkdirSync(path.dirname(sourceAssetPath), { recursive: true });
    fs.writeFileSync(sourceAssetPath, "diagram-data", "utf8");

    const notePath = path.join(sourceWorkspace, "NestedNote.md");
    fs.writeFileSync(notePath, `# Note\n![](media/images/diagram.png)`, "utf8");

    const mockDeps = {
      getNotesRoot: () => tmpDir,
      listProjectsState: () => ({
        projects: [
          { slug: "source", name: "SourceWS", rootPath: sourceWorkspace },
          { slug: "target", name: "TargetWS", rootPath: targetWorkspace },
        ],
      }),
    };

    const res = transferDocumentWorkspace(mockDeps, {
      filePath: notePath,
      targetWorkspaceSlug: "target",
      targetSubfolder: "Projects/SubProject",
      action: "copy",
    });

    expect(res.success).toBe(true);
    expect(res.transferredAssetsCount).toBe(1);

    // Verify written target note content has rewritten relative asset path
    const movedNoteContent = fs.readFileSync(res.targetFilePath, "utf8");
    expect(movedNoteContent).toContain("../..");
    expect(movedNoteContent).toContain("media/images/diagram.png");
  });

  it("handles transfer when targetWorkspaceSlug is a recent: prefixed URI", () => {
    const notePath = path.join(sourceWorkspace, "RecentTarget.md");
    fs.writeFileSync(notePath, "# Recent Transfer", "utf8");

    const mockDeps = {
      getNotesRoot: () => tmpDir,
      listProjectsState: () => ({ projects: [] }),
    };

    const recentTargetSlug = `recent:${encodeURIComponent(targetWorkspace)}`;
    const res = transferDocumentWorkspace(mockDeps, {
      filePath: notePath,
      targetWorkspaceSlug: recentTargetSlug,
      action: "copy",
    });

    expect(res.success).toBe(true);
    expect(fs.existsSync(res.targetFilePath)).toBe(true);
    expect(fs.readFileSync(res.targetFilePath, "utf8")).toBe("# Recent Transfer");
  });
});
