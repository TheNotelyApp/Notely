import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { applicationToolRegistry, ApplicationToolRegistry } = require('../../electron/tools/ApplicationToolRegistry.cjs');
const { assertPathInWorkspace, resolveNotePath } = require('../../electron/services/NoteApplicationService.cjs');

describe('Notely MCP Security & Boundary Enforcement Tests', () => {
  let tmpDir;
  let registry;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notely-security-test-'));
    registry = new ApplicationToolRegistry();

    // Create a dummy note inside the test workspace
    fs.writeFileSync(path.join(tmpDir, 'Welcome.md'), '# Welcome\n\nSecurity test note.', 'utf8');
  });

  afterAll(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  describe('1. Path Traversal & Workspace Isolation', () => {
    it('should throw when path points outside workspace root', () => {
      expect(() => {
        assertPathInWorkspace('../outside.txt', tmpDir);
      }).toThrow(/Path traversal rejected/);

      expect(() => {
        assertPathInWorkspace('../../etc/passwd', tmpDir);
      }).toThrow(/Path traversal rejected/);
    });

    it('should throw on path traversal in resolveNotePath rather than silently swallowing', () => {
      expect(() => {
        resolveNotePath('../../../secret.txt', tmpDir);
      }).toThrow(/Path traversal rejected/);
    });

    it('should resolve note inside workspace root safely', () => {
      const res = resolveNotePath('Welcome', tmpDir);
      expect(res.exists).toBe(true);
      expect(res.relativePath).toBe('Welcome.md');
    });
  });

  describe('2. Git Command Injection Immunity', () => {
    it('should reject git commands when not a git repository without spawning shell', async () => {
      const nonGitDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notely-nongit-'));
      try {
        const res = await registry.executeTool(
          'git_control',
          { action: 'status' },
          { workspaceRoot: nonGitDir }
        );
        expect(res.success).toBe(false);
        expect(res.error.message).toContain('not a git repository');
      } finally {
        fs.rmSync(nonGitDir, { recursive: true, force: true });
      }
    });

    it('should safely escape shell metacharacters in checkout branch name using execFileSync', async () => {
      // Create a real git repo
      const gitDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notely-gitsec-'));
      try {
        const { execFileSync } = require('child_process');
        execFileSync('git', ['init'], { cwd: gitDir });
        execFileSync('git', ['config', 'user.name', 'Security Tester'], { cwd: gitDir });
        execFileSync('git', ['config', 'user.email', 'sec@example.com'], { cwd: gitDir });

        fs.writeFileSync(path.join(gitDir, 'test.md'), '# Init', 'utf8');
        execFileSync('git', ['add', '-A'], { cwd: gitDir });
        execFileSync('git', ['commit', '-m', 'Initial commit'], { cwd: gitDir });

        // Attempt branch checkout with shell metacharacters (&, |, ;)
        const maliciousBranch = 'main; touch pwned.txt';
        const res = await registry.executeTool(
          'git_control',
          { action: 'checkout', branchName: maliciousBranch },
          { workspaceRoot: gitDir }
        );

        // Should fail git checkout normally, but NOT execute touch or create pwned.txt
        expect(res.success).toBe(false);
        expect(fs.existsSync(path.join(gitDir, 'pwned.txt'))).toBe(false);
      } finally {
        fs.rmSync(gitDir, { recursive: true, force: true });
      }
    });
  });

  describe('3. ReDoS Pattern Safety in Search', () => {
    it('should reject dangerous nested quantifier regex pattern in search', async () => {
      const evilPattern = '/(a+)+$/';
      const res = await registry.executeTool(
        'search',
        { query: evilPattern, mode: 'regex' },
        { workspaceRoot: tmpDir }
      );
      expect(res.success).toBe(false);
      expect(res.error.message).toContain('potential ReDoS');
    });

    it('should allow safe regex search pattern', async () => {
      const safePattern = '/Welcome/i';
      const res = await registry.executeTool(
        'search',
        { query: safePattern, mode: 'regex' },
        { workspaceRoot: tmpDir }
      );
      expect(res.success).toBe(true);
      expect(res.data.hits.length).toBeGreaterThan(0);
    });
  });

  describe('4. Write Protection & Permission Enforcement', () => {
    it('should block write tools when allowWriteTools is false', async () => {
      const writeOps = [
        { tool: 'edit_note', args: { filePath: 'New.md', operation: 'create', content: 'test' } },
        { tool: 'manage_tasks', args: { operation: 'create', notePath: 'Welcome.md', taskText: 'Write test' } },
        { tool: 'manage_diagrams', args: { operation: 'create', notePath: 'Welcome.md', content: 'graph TD; A-->B;' } },
        { tool: 'git_control', args: { action: 'commit', message: 'test commit' } }
      ];

      for (const op of writeOps) {
        const res = await registry.executeTool(op.tool, op.args, {
          allowWriteTools: false,
          workspaceRoot: tmpDir
        });
        expect(res.success).toBe(false);
        expect(res.error.code).toBe('WRITE_DISABLED');
      }
    });

    it('should permit read tools when allowWriteTools is false', async () => {
      const readOps = [
        { tool: 'search', args: { query: 'Welcome' } },
        { tool: 'read_note', args: { pathOrTitle: 'Welcome.md' } },
        { tool: 'workspace_overview', args: { operation: 'summary' } }
      ];

      for (const op of readOps) {
        const res = await registry.executeTool(op.tool, op.args, {
          allowWriteTools: false,
          workspaceRoot: tmpDir
        });
        expect(res.success).toBe(true);
      }
    });
  });

  describe('5. Schema Validation & Input Rejection', () => {
    it('should reject invalid enum values with INVALID_INPUT', async () => {
      const res = await registry.executeTool(
        'workspace_overview',
        { operation: 'invalid_non_existent_op' },
        { workspaceRoot: tmpDir }
      );
      expect(res.success).toBe(false);
      expect(res.error.code).toBe('INVALID_INPUT');
      expect(res.error.message).toContain('Invalid value "invalid_non_existent_op"');
    });

    it('should reject wrong parameter types with INVALID_INPUT', async () => {
      const res = await registry.executeTool(
        'search',
        { limit: 'twenty_not_a_number' },
        { workspaceRoot: tmpDir }
      );
      expect(res.success).toBe(false);
      expect(res.error.code).toBe('INVALID_INPUT');
      expect(res.error.message).toContain('Parameter "limit" must be a number');
    });
  });
});
