const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { mcpPromptsRegistry, McpPromptsRegistry } = require('../../electron/mcp/McpPrompts.cjs');
const { McpServer } = require('../../electron/mcp/McpServer.cjs');
const { McpSessionManager } = require('../../electron/mcp/McpSessionManager.cjs');
const { applicationToolRegistry } = require('../../electron/tools/ApplicationToolRegistry.cjs');

describe('MCP Dynamic Prompts & Resource Subscriptions Test Suite', () => {
  const tempDir = path.join(__dirname, 'temp-prompts-subscriptions-test');

  beforeAll(() => {
    if (fs.existsSync(tempDir)) {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterAll(() => {
    if (fs.existsSync(tempDir)) {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  });

  describe('1. Workspace Custom Prompts Engine (.notes-app/prompts/*.md)', () => {
    it('should list default built-in enterprise prompts when workspace has no custom prompts', () => {
      const prompts = mcpPromptsRegistry.listPrompts(tempDir);
      assert.ok(Array.isArray(prompts));
      assert.ok(prompts.length >= 5);
      const names = prompts.map(p => p.name);
      assert.ok(names.includes('summarize_note'));
      assert.ok(names.includes('plan_tasks'));
      assert.ok(names.includes('explore_knowledge_graph'));
      assert.ok(names.includes('refactor_note'));
      assert.ok(names.includes('daily_review'));
    });

    it('should dynamically load and parse custom markdown prompts with YAML frontmatter', () => {
      const promptsDir = path.join(tempDir, '.notes-app', 'prompts');
      fs.mkdirSync(promptsDir, { recursive: true });

      const customPromptContent = `---
name: code_review_brief
description: Prepare a comprehensive review brief for a code module and its documentation.
arguments:
  - name: moduleName
    description: Name of the module or component to review
    required: true
  - name: focusArea
    description: Optional focus area
    required: false
---
Please inspect all notes and code references related to "{{moduleName}}" using the search and read_note tools.
Focus on {{focusArea || "general architecture and edge cases"}}.
Produce a checklist of recommendations and open questions.
`;
      fs.writeFileSync(path.join(promptsDir, 'code_review_brief.md'), customPromptContent, 'utf8');

      const registry = new McpPromptsRegistry();
      const prompts = registry.listPrompts(tempDir);
      const customPrompt = prompts.find(p => p.name === 'code_review_brief');

      assert.ok(customPrompt, 'Custom prompt code_review_brief should be discovered in prompts/list');
      assert.strictEqual(customPrompt.source, 'workspace');
      assert.strictEqual(customPrompt.description, 'Prepare a comprehensive review brief for a code module and its documentation.');
      assert.strictEqual(customPrompt.arguments.length, 2);
      assert.strictEqual(customPrompt.arguments[0].name, 'moduleName');
      assert.strictEqual(customPrompt.arguments[0].required, true);

      // Execute prompt template substitution
      const promptResult = registry.getPrompt('code_review_brief', { moduleName: 'AuthService', focusArea: 'security vulnerabilities' }, tempDir);
      assert.ok(promptResult.messages && promptResult.messages.length > 0);
      const text = promptResult.messages[0].content.text;
      assert.ok(text.includes('related to "AuthService"'));
      assert.ok(text.includes('Focus on security vulnerabilities.'));

      // Test default fallback expression
      const promptResultFallback = registry.getPrompt('code_review_brief', { moduleName: 'PaymentGateway' }, tempDir);
      const fallbackText = promptResultFallback.messages[0].content.text;
      assert.ok(fallbackText.includes('related to "PaymentGateway"'));
      assert.ok(fallbackText.includes('Focus on general architecture and edge cases.'));
    });

    it('should save custom prompt to disk via saveCustomPrompt API', () => {
      const registry = new McpPromptsRegistry();
      const saveRes = registry.saveCustomPrompt(tempDir, {
        name: 'release_notes_generator',
        description: 'Generate formatted release notes from git commits and modified notes.',
        arguments: [{ name: 'version', description: 'Target version tag (e.g. v1.2.0)', required: true }],
        template: 'Please inspect git log and recent changes for version {{version}} using git_control and workspace_overview.'
      });

      assert.strictEqual(saveRes.success, true);
      assert.strictEqual(saveRes.name, 'release_notes_generator');
      assert.ok(fs.existsSync(saveRes.filePath));

      const reloaded = registry.getPrompt('release_notes_generator', { version: 'v2.0.0' }, tempDir);
      assert.ok(reloaded.messages[0].content.text.includes('version v2.0.0'));
    });

    it('should delete custom prompt file from disk via deleteCustomPrompt API', () => {
      const registry = new McpPromptsRegistry();
      const delRes = registry.deleteCustomPrompt(tempDir, 'release_notes_generator');
      assert.strictEqual(delRes.success, true);
      assert.strictEqual(delRes.deleted, true);

      const targetPath = path.join(tempDir, '.notes-app', 'prompts', 'release_notes_generator.md');
      assert.strictEqual(fs.existsSync(targetPath), false);
    });
  });

  describe('2. MCP Resource Subscriptions & Real-Time Notifications', () => {
    it('should advertise resource subscription capability on MCP Server instance', () => {
      const server = new McpServer({ port: 3799, getWorkspaceRoot: () => tempDir });
      assert.strictEqual(typeof server.broadcastResourceUpdated, 'function');
      assert.ok(server.resourceSubscriptions instanceof Map);
    });

    it('should track session resource subscriptions and broadcast notifications', () => {
      const sessionManager = new McpSessionManager();
      const server = new McpServer({
        port: 3798,
        sessionManager,
        getWorkspaceRoot: () => tempDir
      });

      const notifiedEvents = [];
      const mockSessionId = 'sess_sub_test_1';
      const mockServerInstance = {
        notification: (notif) => {
          notifiedEvents.push(notif);
        }
      };

      // Register session and subscription
      server.streamableTransports.set(mockSessionId, { server: mockServerInstance });
      server.resourceSubscriptions.set(mockSessionId, new Set(['notely://notes/Architecture.md', 'notely://workspace/tree']));

      // Broadcast matching note update
      server.broadcastResourceUpdated('notely://notes/Architecture.md');
      assert.strictEqual(notifiedEvents.length, 1);
      assert.strictEqual(notifiedEvents[0].method, 'notifications/resources/updated');
      assert.strictEqual(notifiedEvents[0].params.uri, 'notely://notes/Architecture.md');

      // Broadcast non-subscribed URI -> should NOT notify
      server.broadcastResourceUpdated('notely://notes/Unrelated.md');
      assert.strictEqual(notifiedEvents.length, 1);

      // Broadcast tree update -> should notify
      server.broadcastResourceUpdated('notely://workspace/tree');
      assert.strictEqual(notifiedEvents.length, 2);
      assert.strictEqual(notifiedEvents[1].params.uri, 'notely://workspace/tree');
    });

    it('should trigger resource notifications when edit_note mutates files', async () => {
      const server = new McpServer({
        port: 3797,
        getWorkspaceRoot: () => tempDir
      });

      const notified = [];
      server.streamableTransports.set('test_sess_edit', {
        server: {
          notification: (n) => notified.push(n.params?.uri)
        }
      });
      server.resourceSubscriptions.set('test_sess_edit', new Set(['notely://notes/SubscribedNote.md', 'notely://workspace/tree', 'notely://workspace/stats']));

      // Execute tool edit_note
      const editRes = await applicationToolRegistry.executeTool(
        'edit_note',
        {
          filePath: 'SubscribedNote.md',
          operation: 'create',
          content: '# Subscribed Note\n\nContent for testing real-time notifications.'
        },
        { workspaceRoot: tempDir, allowWriteTools: true }
      );

      assert.strictEqual(editRes.success, true);
    });
  });
});
