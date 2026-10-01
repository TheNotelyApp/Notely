import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { RepositoryScanner } from '../ai/graph/sources/code/RepositoryScanner';

describe('RepositoryScanner', () => {
  const tempDir = path.join(__dirname, 'temp-repo-scanner-test');

  beforeEach(() => {
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('supports standard programming language file extensions', () => {
    const scanner = new RepositoryScanner();
    expect(scanner.supports('app.js')).toBe(true);
    expect(scanner.supports('index.ts')).toBe(true);
    expect(scanner.supports('Component.jsx')).toBe(true);
    expect(scanner.supports('main.py')).toBe(true);
    expect(scanner.supports('server.go')).toBe(true);
    expect(scanner.supports('lib.rs')).toBe(true);
    expect(scanner.supports('readme.md')).toBe(false);
    expect(scanner.supports('photo.png')).toBe(false);
  });

  it('scans code files and ignores node_modules and dot folders', () => {
    const srcDir = path.join(tempDir, 'src');
    const nodeModulesDir = path.join(tempDir, 'node_modules', 'foo');
    const dotGitDir = path.join(tempDir, '.git');

    fs.mkdirSync(srcDir, { recursive: true });
    fs.mkdirSync(nodeModulesDir, { recursive: true });
    fs.mkdirSync(dotGitDir, { recursive: true });

    fs.writeFileSync(path.join(srcDir, 'index.ts'), 'export const x = 1;');
    fs.writeFileSync(path.join(srcDir, 'utils.js'), 'module.exports = {};');
    fs.writeFileSync(path.join(nodeModulesDir, 'ignored.js'), 'console.log();');
    fs.writeFileSync(path.join(dotGitDir, 'config.js'), 'ignored');

    const scanner = new RepositoryScanner();
    const files = scanner.scan(tempDir);

    expect(files.length).toBe(2);
    expect(files.some(f => f.endsWith('index.ts'))).toBe(true);
    expect(files.some(f => f.endsWith('utils.js'))).toBe(true);
    expect(files.some(f => f.includes('node_modules'))).toBe(false);
    expect(files.some(f => f.includes('.git'))).toBe(false);
  });

  it('ignores docs-site-dist, assets, chunks, and test files', () => {
    const srcDir = path.join(tempDir, 'src');
    const docsDistDir = path.join(tempDir, 'docs-site-dist', 'assets', 'chunks');
    const testsDir = path.join(tempDir, 'tests', 'unit');

    fs.mkdirSync(srcDir, { recursive: true });
    fs.mkdirSync(docsDistDir, { recursive: true });
    fs.mkdirSync(testsDir, { recursive: true });

    fs.writeFileSync(path.join(srcDir, 'CoreService.ts'), 'export class CoreService {}');
    fs.writeFileSync(path.join(srcDir, 'CoreService.test.ts'), 'test("core", () => {});');
    fs.writeFileSync(path.join(srcDir, 'CoreService.spec.js'), 'test("core", () => {});');
    fs.writeFileSync(path.join(docsDistDir, 'katex.C5jXJg4s.js'), 'var katex = {};');
    fs.writeFileSync(path.join(testsDir, 'test_runner.js'), 'run();');

    const scanner = new RepositoryScanner();
    const files = scanner.scan(tempDir);

    expect(files.length).toBe(1);
    expect(files[0].endsWith('CoreService.ts')).toBe(true);
    expect(files.some(f => f.includes('docs-site-dist'))).toBe(false);
    expect(files.some(f => f.includes('katex'))).toBe(false);
    expect(files.some(f => f.includes('.test.'))).toBe(false);
    expect(files.some(f => f.includes('.spec.'))).toBe(false);
    expect(files.some(f => f.endsWith('test_runner.js'))).toBe(false);
  });
});
