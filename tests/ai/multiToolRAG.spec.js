import { describe, it, expect } from 'vitest';
import { applicationToolRegistry } from '../../electron/tools/ApplicationToolRegistry.cjs';

describe('Enterprise Unified Tool Capabilities', () => {
  it('should register enterprise unified tools', () => {
    const searchTool = applicationToolRegistry.resolveToolName('search');
    const readNoteTool = applicationToolRegistry.resolveToolName('read_note');
    const editNoteTool = applicationToolRegistry.resolveToolName('edit_note');

    expect(searchTool).toBe('search@v1');
    expect(readNoteTool).toBe('read_note@v1');
    expect(editNoteTool).toBe('edit_note@v1');
  });

  it('should export all registered enterprise tools to Vercel AI SDK format', async () => {
    const vercelTools = await applicationToolRegistry.toVercelTools();
    expect(vercelTools).toHaveProperty('search');
    expect(vercelTools).toHaveProperty('read_note');
    expect(vercelTools).toHaveProperty('edit_note');
    expect(vercelTools).toHaveProperty('manage_tasks');
    expect(vercelTools).toHaveProperty('manage_diagrams');
    expect(vercelTools).toHaveProperty('workspace_overview');
    expect(vercelTools).toHaveProperty('git_control');
  });

  it('should validate tool inputs and return typed structured envelopes', async () => {
    const res = await applicationToolRegistry.executeTool('search', { query: '' });
    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('EXECUTION_ERROR');
  });
});
