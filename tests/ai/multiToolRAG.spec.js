import { describe, it, expect, beforeEach } from 'vitest';
import { applicationToolRegistry } from '../../electron/tools/ApplicationToolRegistry.cjs';

describe('Multi-Tool RAG Capabilities', () => {
  it('should register web_search and fetch_url tools', () => {
    const webSearchName = applicationToolRegistry.resolveToolName('web_search');
    const fetchUrlName = applicationToolRegistry.resolveToolName('fetch_url');

    expect(webSearchName).toBe('web.search@v1');
    expect(fetchUrlName).toBe('web.fetch@v1');
  });

  it('should export all registered tools to Vercel AI SDK format', async () => {
    const vercelTools = await applicationToolRegistry.toVercelTools();
    expect(vercelTools).toHaveProperty('web_search');
    expect(vercelTools).toHaveProperty('fetch_url');
    expect(vercelTools).toHaveProperty('hybrid_search');
    expect(vercelTools).toHaveProperty('get_graph');
    expect(vercelTools).toHaveProperty('read_note');
  });

  it('should validate tool inputs and return typed structured envelopes', async () => {
    const res = await applicationToolRegistry.executeTool('web_search', { query: '' });
    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('EXECUTION_ERROR');
  });
});
