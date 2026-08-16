import { getNotesApi } from "./base";

function requireGitApi(api, methodName) {
  if (typeof api[methodName] !== "function") {
    throw new Error(`Git action '${methodName}' unavailable. Please restart the app.`);
  }
}

export async function gitDetect() {
  const api = getNotesApi();
  requireGitApi(api, "gitDetect");
  return api.gitDetect();
}

export async function gitGetRepoInfo(workspacePath) {
  const api = getNotesApi();
  requireGitApi(api, "gitGetRepoInfo");
  return api.gitGetRepoInfo({ workspacePath });
}

export async function gitInitRepo(workspacePath) {
  const api = getNotesApi();
  requireGitApi(api, "gitInitRepo");
  return api.gitInitRepo({ workspacePath });
}

export async function gitGetStatus(workspacePath) {
  const api = getNotesApi();
  requireGitApi(api, "gitGetStatus");
  return api.gitGetStatus({ workspacePath });
}

export async function gitGetLog({ workspacePath, filePath, limit, skip, branch } = {}) {
  const api = getNotesApi();
  requireGitApi(api, "gitGetLog");
  return api.gitGetLog({ workspacePath, filePath, limit, skip, branch });
}

export async function gitGetCommitFiles({ workspacePath, commitHash } = {}) {
  const api = getNotesApi();
  requireGitApi(api, "gitGetCommitFiles");
  return api.gitGetCommitFiles({ workspacePath, commitHash });
}

export async function gitGetFileAtCommit({ workspacePath, commitHash, filePath } = {}) {
  const api = getNotesApi();
  requireGitApi(api, "gitGetFileAtCommit");
  return api.gitGetFileAtCommit({ workspacePath, commitHash, filePath });
}

export async function gitGetFileDiff({ workspacePath, fromHash, toHash, filePath } = {}) {
  const api = getNotesApi();
  requireGitApi(api, "gitGetFileDiff");
  return api.gitGetFileDiff({ workspacePath, fromHash, toHash, filePath });
}

export async function gitCommit({ workspacePath, message, filePaths } = {}) {
  const api = getNotesApi();
  requireGitApi(api, "gitCommit");
  return api.gitCommit({ workspacePath, message, filePaths });
}

export async function gitRestoreFileAtCommit({ workspacePath, commitHash, filePath } = {}) {
  const api = getNotesApi();
  requireGitApi(api, "gitRestoreFileAtCommit");
  return api.gitRestoreFileAtCommit({ workspacePath, commitHash, filePath });
}

export async function gitListBranches(workspacePath) {
  const api = getNotesApi();
  requireGitApi(api, "gitListBranches");
  return api.gitListBranches({ workspacePath });
}

export async function gitCreateBranch({ workspacePath, name, from } = {}) {
  const api = getNotesApi();
  requireGitApi(api, "gitCreateBranch");
  return api.gitCreateBranch({ workspacePath, name, from });
}

export async function gitRenameBranch({ workspacePath, oldName, newName } = {}) {
  const api = getNotesApi();
  requireGitApi(api, "gitRenameBranch");
  return api.gitRenameBranch({ workspacePath, oldName, newName });
}

export async function gitDeleteBranch({ workspacePath, name, force } = {}) {
  const api = getNotesApi();
  requireGitApi(api, "gitDeleteBranch");
  return api.gitDeleteBranch({ workspacePath, name, force });
}

export async function gitSwitchBranch({ workspacePath, name } = {}) {
  const api = getNotesApi();
  requireGitApi(api, "gitSwitchBranch");
  return api.gitSwitchBranch({ workspacePath, name });
}

export async function gitMergeBranch({ workspacePath, from } = {}) {
  const api = getNotesApi();
  requireGitApi(api, "gitMergeBranch");
  return api.gitMergeBranch({ workspacePath, from });
}

export async function gitListTags(workspacePath) {
  const api = getNotesApi();
  requireGitApi(api, "gitListTags");
  return api.gitListTags({ workspacePath });
}

export async function gitCreateTag({ workspacePath, name, commitHash, message } = {}) {
  const api = getNotesApi();
  requireGitApi(api, "gitCreateTag");
  return api.gitCreateTag({ workspacePath, name, commitHash, message });
}

export async function gitDeleteTag({ workspacePath, name } = {}) {
  const api = getNotesApi();
  requireGitApi(api, "gitDeleteTag");
  return api.gitDeleteTag({ workspacePath, name });
}

export async function gitStashList(workspacePath) {
  const api = getNotesApi();
  requireGitApi(api, "gitStashList");
  return api.gitStashList({ workspacePath });
}

export async function gitStashPush({ workspacePath, message } = {}) {
  const api = getNotesApi();
  requireGitApi(api, "gitStashPush");
  return api.gitStashPush({ workspacePath, message });
}

export async function gitStashPop({ workspacePath, index } = {}) {
  const api = getNotesApi();
  requireGitApi(api, "gitStashPop");
  return api.gitStashPop({ workspacePath, index });
}

export async function gitStashDrop({ workspacePath, index } = {}) {
  const api = getNotesApi();
  requireGitApi(api, "gitStashDrop");
  return api.gitStashDrop({ workspacePath, index });
}

export async function gitListRemotes(workspacePath) {
  const api = getNotesApi();
  requireGitApi(api, "gitListRemotes");
  return api.gitListRemotes({ workspacePath });
}

export async function gitAddRemote({ workspacePath, name, url } = {}) {
  const api = getNotesApi();
  requireGitApi(api, "gitAddRemote");
  return api.gitAddRemote({ workspacePath, name, url });
}

export async function gitRemoveRemote({ workspacePath, name } = {}) {
  const api = getNotesApi();
  requireGitApi(api, "gitRemoveRemote");
  return api.gitRemoveRemote({ workspacePath, name });
}

export async function gitPush({ workspacePath, remote, branch, auth } = {}) {
  const api = getNotesApi();
  requireGitApi(api, "gitPush");
  return api.gitPush({ workspacePath, remote, branch, auth });
}

export async function gitPull({ workspacePath, remote, branch, auth } = {}) {
  const api = getNotesApi();
  requireGitApi(api, "gitPull");
  return api.gitPull({ workspacePath, remote, branch, auth });
}

export async function gitFetch({ workspacePath, remote, auth } = {}) {
  const api = getNotesApi();
  requireGitApi(api, "gitFetch");
  return api.gitFetch({ workspacePath, remote, auth });
}

export async function gitSearch({ workspacePath, query, type } = {}) {
  const api = getNotesApi();
  requireGitApi(api, "gitSearch");
  return api.gitSearch({ workspacePath, query, type });
}

export async function gitGetDeletedFiles(workspacePath) {
  const api = getNotesApi();
  requireGitApi(api, "gitGetDeletedFiles");
  return api.gitGetDeletedFiles({ workspacePath });
}

export async function gitGetWorkspaceStats(workspacePath) {
  const api = getNotesApi();
  requireGitApi(api, "gitGetWorkspaceStats");
  return api.gitGetWorkspaceStats({ workspacePath });
}

export async function gitMigrateLegacy(workspacePath) {
  const api = getNotesApi();
  requireGitApi(api, "gitMigrateLegacy");
  return api.gitMigrateLegacy({ workspacePath });
}

export async function gitEnsureManagedGitignore(workspacePath) {
  const api = getNotesApi();
  requireGitApi(api, "gitEnsureManagedGitignore");
  return api.gitEnsureManagedGitignore({ workspacePath });
}

export async function gitRemoveManagedGitignore(workspacePath) {
  const api = getNotesApi();
  requireGitApi(api, "gitRemoveManagedGitignore");
  return api.gitRemoveManagedGitignore({ workspacePath });
}
