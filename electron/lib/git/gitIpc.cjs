/**
 * gitIpc.cjs — Registers all git:* IPC handlers.
 *
 * Pattern mirrors documentIpc.cjs: each handler validates the sender,
 * calls gitService, and returns { ok, data/error }.
 */

const gitService = require("./gitService.cjs");

/**
 * @param {Electron.IpcMain} ipcMain
 * @param {{ assertTrustedIpcSender: Function, BrowserWindow: any, getNotesRoot: Function }} deps
 */
function registerGitIpcHandlers(ipcMain, deps) {
  const { assertTrustedIpcSender, BrowserWindow, getNotesRoot } = deps;

  function handle(channel, fn) {
    ipcMain.handle(channel, async (event, ...args) => {
      assertTrustedIpcSender(BrowserWindow, event, channel);
      try {
        return await fn(event, ...args);
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    });
  }

  // ── Detection & Repo Info ──────────────────────────────────────────────────

  handle("git:detect", async () => {
    return gitService.detectGit();
  });

  handle("git:get-repo-info", async (_event, { workspacePath } = {}) => {
    const root = workspacePath || getNotesRoot();
    if (!root) return { ok: false, error: "No workspace path." };
    return gitService.getRepoInfo(root);
  });

  handle("git:init-repo", async (_event, { workspacePath } = {}) => {
    const root = workspacePath || getNotesRoot();
    if (!root) return { ok: false, error: "No workspace path." };
    return gitService.initRepo(root);
  });

  // ── Status ─────────────────────────────────────────────────────────────────

  handle("git:get-status", async (_event, { workspacePath } = {}) => {
    const root = workspacePath || getNotesRoot();
    if (!root) return { ok: false, error: "No workspace path." };
    return gitService.getStatus(root);
  });

  // ── Log ────────────────────────────────────────────────────────────────────

  handle("git:get-log", async (_event, { workspacePath, filePath, limit, skip, branch } = {}) => {
    const root = workspacePath || getNotesRoot();
    if (!root) return { ok: false, error: "No workspace path." };
    return gitService.getLog(root, { filePath, limit, skip, branch });
  });

  handle("git:get-commit-files", async (_event, { workspacePath, commitHash } = {}) => {
    const root = workspacePath || getNotesRoot();
    if (!root) return { ok: false, error: "No workspace path." };
    if (!commitHash) return { ok: false, error: "commitHash required." };
    return gitService.getCommitFiles(root, commitHash);
  });

  handle("git:get-file-at-commit", async (_event, { workspacePath, commitHash, filePath } = {}) => {
    const root = workspacePath || getNotesRoot();
    if (!root) return { ok: false, error: "No workspace path." };
    if (!commitHash) return { ok: false, error: "commitHash required." };
    if (!filePath) return { ok: false, error: "filePath required." };
    return gitService.getFileAtCommit(root, commitHash, filePath);
  });

  handle("git:get-file-diff", async (_event, { workspacePath, fromHash, toHash, filePath } = {}) => {
    const root = workspacePath || getNotesRoot();
    if (!root) return { ok: false, error: "No workspace path." };
    if (!fromHash) return { ok: false, error: "fromHash required." };
    if (!toHash) return { ok: false, error: "toHash required." };
    return gitService.getFileDiff(root, fromHash, toHash, filePath || null);
  });

  // ── Commit (user-triggered only) ───────────────────────────────────────────

  handle("git:commit", async (_event, { workspacePath, message, filePaths } = {}) => {
    const root = workspacePath || getNotesRoot();
    if (!root) return { ok: false, error: "No workspace path." };
    if (!message) return { ok: false, error: "Commit message required." };
    return gitService.commit(root, { message, filePaths });
  });

  handle("git:restore-file-at-commit", async (_event, { workspacePath, commitHash, filePath } = {}) => {
    const root = workspacePath || getNotesRoot();
    if (!root) return { ok: false, error: "No workspace path." };
    if (!commitHash) return { ok: false, error: "commitHash required." };
    if (!filePath) return { ok: false, error: "filePath required." };
    return gitService.restoreFileAtCommit(root, commitHash, filePath);
  });

  // ── Branches ───────────────────────────────────────────────────────────────

  handle("git:list-branches", async (_event, { workspacePath } = {}) => {
    const root = workspacePath || getNotesRoot();
    if (!root) return { ok: false, error: "No workspace path." };
    return gitService.listBranches(root);
  });

  handle("git:create-branch", async (_event, { workspacePath, name, from } = {}) => {
    const root = workspacePath || getNotesRoot();
    if (!root) return { ok: false, error: "No workspace path." };
    if (!name) return { ok: false, error: "Branch name required." };
    return gitService.createBranch(root, name, from || null);
  });

  handle("git:rename-branch", async (_event, { workspacePath, oldName, newName } = {}) => {
    const root = workspacePath || getNotesRoot();
    if (!root) return { ok: false, error: "No workspace path." };
    if (!oldName || !newName) return { ok: false, error: "oldName and newName required." };
    return gitService.renameBranch(root, oldName, newName);
  });

  handle("git:delete-branch", async (_event, { workspacePath, name, force } = {}) => {
    const root = workspacePath || getNotesRoot();
    if (!root) return { ok: false, error: "No workspace path." };
    if (!name) return { ok: false, error: "Branch name required." };
    return gitService.deleteBranch(root, name, force === true);
  });

  handle("git:switch-branch", async (_event, { workspacePath, name } = {}) => {
    const root = workspacePath || getNotesRoot();
    if (!root) return { ok: false, error: "No workspace path." };
    if (!name) return { ok: false, error: "Branch name required." };
    return gitService.switchBranch(root, name);
  });

  handle("git:merge-branch", async (_event, { workspacePath, from } = {}) => {
    const root = workspacePath || getNotesRoot();
    if (!root) return { ok: false, error: "No workspace path." };
    if (!from) return { ok: false, error: "Source branch required." };
    return gitService.mergeBranch(root, from);
  });

  // ── Tags ───────────────────────────────────────────────────────────────────

  handle("git:list-tags", async (_event, { workspacePath } = {}) => {
    const root = workspacePath || getNotesRoot();
    if (!root) return { ok: false, error: "No workspace path." };
    return gitService.listTags(root);
  });

  handle("git:create-tag", async (_event, { workspacePath, name, commitHash, message } = {}) => {
    const root = workspacePath || getNotesRoot();
    if (!root) return { ok: false, error: "No workspace path." };
    if (!name) return { ok: false, error: "Tag name required." };
    return gitService.createTag(root, { name, commitHash, message });
  });

  handle("git:delete-tag", async (_event, { workspacePath, name } = {}) => {
    const root = workspacePath || getNotesRoot();
    if (!root) return { ok: false, error: "No workspace path." };
    if (!name) return { ok: false, error: "Tag name required." };
    return gitService.deleteTag(root, name);
  });

  // ── Stash ──────────────────────────────────────────────────────────────────

  handle("git:stash-list", async (_event, { workspacePath } = {}) => {
    const root = workspacePath || getNotesRoot();
    if (!root) return { ok: false, error: "No workspace path." };
    return gitService.stashList(root);
  });

  handle("git:stash-push", async (_event, { workspacePath, message } = {}) => {
    const root = workspacePath || getNotesRoot();
    if (!root) return { ok: false, error: "No workspace path." };
    return gitService.stashPush(root, message || null);
  });

  handle("git:stash-pop", async (_event, { workspacePath, index } = {}) => {
    const root = workspacePath || getNotesRoot();
    if (!root) return { ok: false, error: "No workspace path." };
    return gitService.stashPop(root, index != null ? Number(index) : null);
  });

  handle("git:stash-drop", async (_event, { workspacePath, index } = {}) => {
    const root = workspacePath || getNotesRoot();
    if (!root) return { ok: false, error: "No workspace path." };
    if (index == null) return { ok: false, error: "Stash index required." };
    return gitService.stashDrop(root, Number(index));
  });

  // ── Remotes ────────────────────────────────────────────────────────────────

  handle("git:list-remotes", async (_event, { workspacePath } = {}) => {
    const root = workspacePath || getNotesRoot();
    if (!root) return { ok: false, error: "No workspace path." };
    return gitService.listRemotes(root);
  });

  handle("git:add-remote", async (_event, { workspacePath, name, url } = {}) => {
    const root = workspacePath || getNotesRoot();
    if (!root) return { ok: false, error: "No workspace path." };
    if (!name) return { ok: false, error: "Remote name required." };
    if (!url) return { ok: false, error: "Remote URL required." };
    return gitService.addRemote(root, name, url);
  });

  handle("git:remove-remote", async (_event, { workspacePath, name } = {}) => {
    const root = workspacePath || getNotesRoot();
    if (!root) return { ok: false, error: "No workspace path." };
    if (!name) return { ok: false, error: "Remote name required." };
    return gitService.removeRemote(root, name);
  });

  handle("git:push", async (_event, { workspacePath, remote, branch, auth } = {}) => {
    const root = workspacePath || getNotesRoot();
    if (!root) return { ok: false, error: "No workspace path." };
    return gitService.push(root, { remote, branch, auth });
  });

  handle("git:pull", async (_event, { workspacePath, remote, branch, auth } = {}) => {
    const root = workspacePath || getNotesRoot();
    if (!root) return { ok: false, error: "No workspace path." };
    return gitService.pull(root, { remote, branch, auth });
  });

  handle("git:fetch", async (_event, { workspacePath, remote, auth } = {}) => {
    const root = workspacePath || getNotesRoot();
    if (!root) return { ok: false, error: "No workspace path." };
    return gitService.fetch(root, { remote, auth });
  });

  // ── Search ─────────────────────────────────────────────────────────────────

  handle("git:search", async (_event, { workspacePath, query, type } = {}) => {
    const root = workspacePath || getNotesRoot();
    if (!root) return { ok: false, error: "No workspace path." };
    return gitService.search(root, { query, type });
  });

  // ── Extras ─────────────────────────────────────────────────────────────────

  handle("git:get-deleted-files", async (_event, { workspacePath } = {}) => {
    const root = workspacePath || getNotesRoot();
    if (!root) return { ok: false, error: "No workspace path." };
    return gitService.getDeletedFiles(root);
  });

  handle("git:get-workspace-stats", async (_event, { workspacePath } = {}) => {
    const root = workspacePath || getNotesRoot();
    if (!root) return { ok: false, error: "No workspace path." };
    return gitService.getWorkspaceStats(root);
  });

  // ── Migration ──────────────────────────────────────────────────────────────

  handle("git:migrate-legacy", async (_event, { workspacePath } = {}) => {
    const root = workspacePath || getNotesRoot();
    if (!root) return { ok: false, error: "No workspace path." };
    // metadataStore not accessible here — migration is triggered from main.cjs
    return gitService.migrateFromLegacy(root, null);
  });

  // ── Gitignore ──────────────────────────────────────────────────────────────

  handle("git:ensure-managed-gitignore", async (_event, { workspacePath } = {}) => {
    const root = workspacePath || getNotesRoot();
    if (!root) return { ok: false, error: "No workspace path." };
    const repoRoot = await gitService.findRepoRoot(root);
    if (!repoRoot) return { ok: false, error: "Not a git repository." };
    return gitService.ensureManagedGitignoreBlock(repoRoot);
  });

  handle("git:remove-managed-gitignore", async (_event, { workspacePath } = {}) => {
    const root = workspacePath || getNotesRoot();
    if (!root) return { ok: false, error: "No workspace path." };
    const repoRoot = await gitService.findRepoRoot(root);
    if (!repoRoot) return { ok: false, error: "Not a git repository." };
    return gitService.removeManagedGitignoreBlock(repoRoot);
  });
}

module.exports = { registerGitIpcHandlers };
