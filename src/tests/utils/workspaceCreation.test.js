import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";

// Helper mirroring coreIpc workspace creation logic
async function createTestWorkspace(payload) {
  const {
    name = "TestWS",
    parentLocation,
    description = "",
    domainTags = [],
    projectType = "General",
    primaryGoal = "",
    icon = "",
    color = "",
    createWelcomeNote,
    initGit,
  } = payload || {};

  if (!name || !name.trim()) throw new Error("Workspace name is required.");
  if (!parentLocation || !parentLocation.trim()) throw new Error("Parent location is required.");

  const sanitizedName = name.trim().replace(/[\\/:*?"<>|]/g, "_");
  const newWorkspacePath = path.join(parentLocation.trim(), sanitizedName);
  const metaAppDir = path.join(newWorkspacePath, ".notes-app");

  fs.mkdirSync(newWorkspacePath, { recursive: true });
  fs.mkdirSync(metaAppDir, { recursive: true });

  const initialInfo = {
    name: name.trim(),
    description: description.trim(),
    domainTags: Array.isArray(domainTags) ? domainTags : [],
    projectType: projectType || "General",
    primaryGoal: primaryGoal.trim(),
    icon: icon || "",
    color: color || "",
  };

  const metaJsonPath = path.join(metaAppDir, "metadata.json");
  fs.writeFileSync(metaJsonPath, JSON.stringify({ info: initialInfo }, null, 2), "utf8");

  if (Boolean(initGit)) {
    try {
      const simpleGit = (await import("simple-git")).default;
      const git = simpleGit(newWorkspacePath);
      await git.init();
    } catch (gitErr) {
      console.warn("Git init warning:", gitErr?.message || gitErr);
    }
  }

  if (Boolean(createWelcomeNote)) {
    const readmePath = path.join(newWorkspacePath, "README.md");
    if (!fs.existsSync(readmePath)) {
      const readmeContent = `# ${name.trim()}\n\nThis is your Notely workspace.`;
      fs.writeFileSync(readmePath, readmeContent, "utf8");
    }
  }

  return { success: true, workspacePath: newWorkspacePath };
}

describe("Workspace Creation Flags", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "notely-ws-test-"));
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("creates neither README nor .git when both options are false", async () => {
    const res = await createTestWorkspace({
      name: "WS_None",
      parentLocation: tmpDir,
      createWelcomeNote: false,
      initGit: false,
    });

    const gitDir = path.join(res.workspacePath, ".git");
    const readmeFile = path.join(res.workspacePath, "README.md");
    const metaDir = path.join(res.workspacePath, ".notes-app");

    expect(fs.existsSync(metaDir)).toBe(true);
    expect(fs.existsSync(gitDir)).toBe(false);
    expect(fs.existsSync(readmeFile)).toBe(false);
  });

  it("creates only Git repository when initGit=true and createWelcomeNote=false", async () => {
    const res = await createTestWorkspace({
      name: "WS_GitOnly",
      parentLocation: tmpDir,
      createWelcomeNote: false,
      initGit: true,
    });

    const gitDir = path.join(res.workspacePath, ".git");
    const readmeFile = path.join(res.workspacePath, "README.md");

    expect(fs.existsSync(gitDir)).toBe(true);
    expect(fs.existsSync(readmeFile)).toBe(false);
  });

  it("creates only README.md when createWelcomeNote=true and initGit=false", async () => {
    const res = await createTestWorkspace({
      name: "WS_ReadmeOnly",
      parentLocation: tmpDir,
      createWelcomeNote: true,
      initGit: false,
    });

    const gitDir = path.join(res.workspacePath, ".git");
    const readmeFile = path.join(res.workspacePath, "README.md");

    expect(fs.existsSync(gitDir)).toBe(false);
    expect(fs.existsSync(readmeFile)).toBe(true);
  });

  it("creates both README.md and .git when both are true", async () => {
    const res = await createTestWorkspace({
      name: "WS_Both",
      parentLocation: tmpDir,
      createWelcomeNote: true,
      initGit: true,
    });

    const gitDir = path.join(res.workspacePath, ".git");
    const readmeFile = path.join(res.workspacePath, "README.md");

    expect(fs.existsSync(gitDir)).toBe(true);
    expect(fs.existsSync(readmeFile)).toBe(true);
  });
});
