import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { applicationToolRegistry } from '../electron/tools/ApplicationToolRegistry.cjs';

describe('MCP Repository Tools & Extensions', () => {
  const tempWorkspace = path.join(__dirname, 'temp-mcp-repo-test');
  const tempRepo = path.join(__dirname, 'temp-mcp-attached-repo');

  beforeEach(() => {
    if (fs.existsSync(tempWorkspace)) fs.rmSync(tempWorkspace, { recursive: true, force: true });
    if (fs.existsSync(tempRepo)) fs.rmSync(tempRepo, { recursive: true, force: true });

    fs.mkdirSync(path.join(tempWorkspace, '.notes-app'), { recursive: true });
    fs.mkdirSync(tempRepo, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tempWorkspace)) fs.rmSync(tempWorkspace, { recursive: true, force: true });
    if (fs.existsSync(tempRepo)) fs.rmSync(tempRepo, { recursive: true, force: true });
  });

  it('manage_repositories: list returns empty array initially', async () => {
    const res = await applicationToolRegistry.executeTool('manage_repositories', { action: 'list' }, { workspaceRoot: tempWorkspace });
    expect(res.success).toBe(true);
    expect(res.data.count).toBe(0);
    expect(res.data.repositories).toEqual([]);
  });

  it('manage_repositories: add and remove attached repository', async () => {
    // Add repo
    const addRes = await applicationToolRegistry.executeTool('manage_repositories', {
      action: 'add',
      path: tempRepo,
      name: 'test-backend',
      branch: 'main'
    }, { workspaceRoot: tempWorkspace });

    expect(addRes.success).toBe(true);
    expect(addRes.data.repo.name).toBe('test-backend');
    expect(addRes.data.repositories.length).toBe(1);

    const repoId = addRes.data.repo.id;

    // Status check
    const statusRes = await applicationToolRegistry.executeTool('manage_repositories', {
      action: 'status',
      repoId
    }, { workspaceRoot: tempWorkspace });
    expect(statusRes.success).toBe(true);
    expect(statusRes.data.repo.id).toBe(repoId);

    // Remove repo
    const removeRes = await applicationToolRegistry.executeTool('manage_repositories', {
      action: 'remove',
      repoId
    }, { workspaceRoot: tempWorkspace });

    expect(removeRes.success).toBe(true);
    expect(removeRes.data.repositories.length).toBe(0);
  });

  it('workspace_overview: repos operation returns attached repositories', async () => {
    // Write metadata with repo
    const metaPath = path.join(tempWorkspace, '.notes-app', 'metadata.json');
    fs.writeFileSync(metaPath, JSON.stringify({
      attachedRepos: [
        { id: 'repo-1', name: 'frontend', path: tempRepo, branch: 'main', status: 'indexed', symbolCount: 42 }
      ]
    }, null, 2));

    const res = await applicationToolRegistry.executeTool('workspace_overview', {
      operation: 'repos'
    }, { workspaceRoot: tempWorkspace });

    expect(res.success).toBe(true);
    expect(res.data.operation).toBe('repos');
    expect(res.data.count).toBe(1);
    expect(res.data.repositories[0].name).toBe('frontend');
    expect(res.data.repositories[0].symbolCount).toBe(42);
  });
});
