import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { createMainHelpers } from "../../../electron/lib/core/mainHelpers.cjs";
import { transferDocumentWorkspace, extractLocalAssetPaths } from "../../../electron/lib/core/noteMover.cjs";

describe("Full-Fledged Workspace Switch, Copy & Move Integration Test", () => {
  let rootTmpDir = "";
  let workspaceA = "";
  let workspaceB = "";

  const notesA = [
    {
      name: "AlphaNote1.md",
      subfolder: "",
      content: "# Alpha Note 1\nHere is an image: ![](media/images/alpha1.png)\nDiagram: ![](.notes-app/excali-diagrams/diagA.png)",
      assets: ["media/images/alpha1.png", ".notes-app/excali-diagrams/diagA.png"],
    },
    {
      name: "AlphaNote2.md",
      subfolder: "SubAlpha",
      content: "# Alpha Note 2\nPhoto: ![](../../media/images/alpha2.png)",
      assets: ["media/images/alpha2.png"],
    },
    {
      name: "AlphaNote3.md",
      subfolder: "",
      content: "# Alpha Note 3\nNo media here.",
      assets: [],
    },
  ];

  const notesB = [
    {
      name: "BetaNote1.md",
      subfolder: "",
      content: "# Beta Note 1\nAsset: ![](media/images/beta1.png)",
      assets: ["media/images/beta1.png"],
    },
    {
      name: "BetaNote2.md",
      subfolder: "SubBeta1",
      content: "# Beta Note 2\nDiagram: ![](.notes-app/drawio-diagrams/diagB.png)",
      assets: [".notes-app/drawio-diagrams/diagB.png"],
    },
    {
      name: "BetaNote3.md",
      subfolder: "SubBeta2",
      content: "# Beta Note 3\nImage: ![](media/images/beta3.png)",
      assets: ["media/images/beta3.png"],
    },
    {
      name: "BetaNote4.md",
      subfolder: "",
      content: "# Beta Note 4\nPlain text note.",
      assets: [],
    },
  ];

  beforeEach(() => {
    rootTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "notely-full-integration-"));
    workspaceA = path.join(rootTmpDir, "WorkspaceA");
    workspaceB = path.join(rootTmpDir, "WorkspaceB");

    fs.mkdirSync(workspaceA, { recursive: true });
    fs.mkdirSync(workspaceB, { recursive: true });

    // Seed WorkspaceA notes & media assets
    notesA.forEach((n) => {
      const targetDir = n.subfolder ? path.join(workspaceA, n.subfolder) : workspaceA;
      fs.mkdirSync(targetDir, { recursive: true });
      fs.writeFileSync(path.join(targetDir, n.name), n.content, "utf8");

      n.assets.forEach((relAsset) => {
        const assetPath = path.join(workspaceA, relAsset);
        fs.mkdirSync(path.dirname(assetPath), { recursive: true });
        fs.writeFileSync(assetPath, `dummy asset content for ${relAsset}`, "utf8");
      });
    });

    // Seed WorkspaceB notes & media assets
    notesB.forEach((n) => {
      const targetDir = n.subfolder ? path.join(workspaceB, n.subfolder) : workspaceB;
      fs.mkdirSync(targetDir, { recursive: true });
      fs.writeFileSync(path.join(targetDir, n.name), n.content, "utf8");

      n.assets.forEach((relAsset) => {
        const assetPath = path.join(workspaceB, relAsset);
        fs.mkdirSync(path.dirname(assetPath), { recursive: true });
        fs.writeFileSync(assetPath, `dummy asset content for ${relAsset}`, "utf8");
      });
    });
  });

  afterEach(() => {
    if (rootTmpDir && fs.existsSync(rootTmpDir)) {
      try {
        fs.rmSync(rootTmpDir, { recursive: true, force: true });
      } catch {
        // ignore teardown file lock issues
      }
    }
  });

  function createHelpersForWorkspace(currentNotesRoot, activeSlug = "root") {
    let currentRoot = currentNotesRoot;
    let activeProjectSlug = activeSlug;

    const helpers = createMainHelpers({
      fs,
      path,
      process,
      app: { getPath: () => rootTmpDir },
      projectRoot: rootTmpDir,
      userConfigPath: path.join(rootTmpDir, "user_settings.json"),
      ensureDir: (dirPath) => {
        if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
      },
      hashContent: (c) => String(c.length),
      rootProjectSlug: "root",
      getNotesRoot: () => currentRoot,
      getActiveProjectSlug: () => activeProjectSlug,
      setActiveProjectSlug: (slug) => {
        activeProjectSlug = slug;
      },
    });

    return {
      helpers,
      setNotesRoot: (newRoot) => {
        currentRoot = newRoot;
        activeProjectSlug = "root"; // Mimic applyNotesRoot reset
      },
      getActiveProjectSlug: () => activeProjectSlug,
    };
  }

  it("verifies initial workspace seeding for WorkspaceA (3 notes) and WorkspaceB (4 notes)", () => {
    const filesA = fs.readdirSync(workspaceA);
    expect(filesA).toContain("AlphaNote1.md");
    expect(filesA).toContain("AlphaNote3.md");
    expect(filesA).toContain("SubAlpha");
    expect(fs.existsSync(path.join(workspaceA, "media/images/alpha1.png"))).toBe(true);

    const filesB = fs.readdirSync(workspaceB);
    expect(filesB).toContain("BetaNote1.md");
    expect(filesB).toContain("BetaNote4.md");
    expect(filesB).toContain("SubBeta1");
    expect(filesB).toContain("SubBeta2");
    expect(fs.existsSync(path.join(workspaceB, "media/images/beta1.png"))).toBe(true);
  });

  it("switches workspace root cleanly and isolates project subfolders", () => {
    const env = createHelpersForWorkspace(workspaceA, "SubAlpha");

    // Initially in WorkspaceA with SubAlpha active
    let state = env.helpers.listProjectsState();
    expect(state.activeProject.slug).toBe("SubAlpha");
    expect(state.projects.map((p) => p.slug)).toContain("SubAlpha");
    expect(state.projects.map((p) => p.slug)).not.toContain("SubBeta1");

    // Switch workspace root to WorkspaceB
    env.setNotesRoot(workspaceB);
    state = env.helpers.listProjectsState();

    expect(state.activeProject.slug).toBe("root");
    expect(state.activeProject.rootPath).toBe(workspaceB);
    const bSlugs = state.projects.map((p) => p.slug);
    expect(bSlugs).toContain("root");
    expect(bSlugs).toContain("SubBeta1");
    expect(bSlugs).toContain("SubBeta2");
    expect(bSlugs).not.toContain("SubAlpha");

    // Switch back to WorkspaceA
    env.setNotesRoot(workspaceA);
    state = env.helpers.listProjectsState();
    expect(state.activeProject.slug).toBe("root");
    expect(state.activeProject.rootPath).toBe(workspaceA);
  });

  it("moves a note with media assets from WorkspaceA to WorkspaceB (subfolder)", () => {
    const sourceNotePath = path.join(workspaceA, "AlphaNote1.md");
    expect(fs.existsSync(sourceNotePath)).toBe(true);

    const mockDeps = {
      getNotesRoot: () => workspaceA,
      listProjectsState: () => ({
        projects: [{ slug: "root", name: "Root", rootPath: workspaceA }],
      }),
    };

    const targetSlug = `recent:${encodeURIComponent(workspaceB)}`;
    const res = transferDocumentWorkspace(mockDeps, {
      filePath: sourceNotePath,
      targetWorkspaceSlug: targetSlug,
      targetSubfolder: "SubBeta1",
      action: "move",
    });

    expect(res.success).toBe(true);
    expect(res.action).toBe("move");
    expect(res.transferredAssetsCount).toBe(2);

    // 1. Source note deleted from WorkspaceA
    expect(fs.existsSync(sourceNotePath)).toBe(false);

    // 2. Target note created in WorkspaceB/SubBeta1
    const expectedTargetFile = path.join(workspaceB, "SubBeta1", "AlphaNote1.md");
    expect(res.targetFilePath).toBe(expectedTargetFile);
    expect(fs.existsSync(expectedTargetFile)).toBe(true);

    // 3. Media assets copied to WorkspaceB
    expect(fs.existsSync(path.join(workspaceB, "media/images/alpha1.png"))).toBe(true);
    expect(fs.existsSync(path.join(workspaceB, ".notes-app/excali-diagrams/diagA.png"))).toBe(true);

    // 4. Note relative asset paths rewritten for subfolder depth (1 level deep = ../)
    const transferredContent = fs.readFileSync(expectedTargetFile, "utf8");
    expect(transferredContent).toContain("../media/images/alpha1.png");
    expect(transferredContent).toContain("../.notes-app/excali-diagrams/diagA.png");
  });

  it("copies a note with media assets from WorkspaceB (subfolder) to WorkspaceA", () => {
    const sourceNotePath = path.join(workspaceB, "SubBeta1", "BetaNote2.md");
    expect(fs.existsSync(sourceNotePath)).toBe(true);

    const mockDeps = {
      getNotesRoot: () => workspaceB,
      listProjectsState: () => ({
        projects: [{ slug: "root", name: "Root", rootPath: workspaceB }],
      }),
    };

    const targetSlug = `recent:${encodeURIComponent(workspaceA)}`;
    const res = transferDocumentWorkspace(mockDeps, {
      filePath: sourceNotePath,
      targetWorkspaceSlug: targetSlug,
      targetSubfolder: "",
      action: "copy",
    });

    expect(res.success).toBe(true);
    expect(res.action).toBe("copy");
    expect(res.transferredAssetsCount).toBe(1);

    // 1. Source note UNTOUCHED in WorkspaceB
    expect(fs.existsSync(sourceNotePath)).toBe(true);

    // 2. Target note created in WorkspaceA root
    const expectedTargetFile = path.join(workspaceA, "BetaNote2.md");
    expect(res.targetFilePath).toBe(expectedTargetFile);
    expect(fs.existsSync(expectedTargetFile)).toBe(true);

    // 3. Asset transferred to WorkspaceA
    expect(fs.existsSync(path.join(workspaceA, ".notes-app/drawio-diagrams/diagB.png"))).toBe(true);

    // 4. Asset path rewritten appropriately for root depth
    const copiedContent = fs.readFileSync(expectedTargetFile, "utf8");
    expect(copiedContent).toContain(".notes-app/drawio-diagrams/diagB.png");
  });
});
