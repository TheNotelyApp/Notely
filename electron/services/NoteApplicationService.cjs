/**
 * NoteApplicationService.cjs
 * Application service for Note capabilities consumed by the Tool Layer.
 * Enforces workspace boundary security and business validation.
 */

const fs = require('fs');
const path = require('path');

function toWorkspaceRelative(targetPath, workspaceRoot) {
  if (!targetPath || typeof targetPath !== 'string') return targetPath;
  if (!workspaceRoot || typeof workspaceRoot !== 'string') return targetPath;
  const resolvedRoot = path.resolve(workspaceRoot);
  const resolvedTarget = path.resolve(targetPath);
  const rel = path.relative(resolvedRoot, resolvedTarget);
  if (rel === '') return '.';
  return rel.split(/[\\/]+/).join('/');
}

function assertPathInWorkspace(targetPath, workspaceRoot) {
  if (!workspaceRoot || typeof workspaceRoot !== 'string') {
    throw new Error('Workspace root is required.');
  }
  if (!targetPath || typeof targetPath !== 'string') {
    throw new Error('Target path is required.');
  }
  const resolvedRoot = path.resolve(workspaceRoot);
  let cleaned = String(targetPath).trim();

  // If path has a Windows drive letter (e.g. C:\foo or C:/foo), treat as full absolute disk path
  const isWindowsAbsolute = /^[a-zA-Z]:[/\\]/.test(cleaned);

  if (!isWindowsAbsolute) {
    // Strip leading forward/back slashes and relative './' or '.\'
    // so '/Welcome.md', '\notes\doc.md', and './docs/read.md' resolve cleanly relative to workspace root
    cleaned = cleaned.replace(/^[/\\]+/, '');
    while (cleaned.startsWith('./') || cleaned.startsWith('.\\')) {
      cleaned = cleaned.slice(2);
    }
  }

  const resolvedTarget = isWindowsAbsolute
    ? path.resolve(cleaned)
    : path.resolve(resolvedRoot, cleaned);

  const relative = path.relative(resolvedRoot, resolvedTarget);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Path traversal rejected: target path is outside workspace root.');
  }
  return resolvedTarget;
}

function collectMarkdownFiles(dirPath, fileList = []) {
  if (!fs.existsSync(dirPath)) return fileList;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      collectMarkdownFiles(fullPath, fileList);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

class NoteApplicationService {
  /**
   * Read note content with pagination and workspace security validation.
   */
  async readNote(args = {}) {
    const { workspaceRoot } = args;
    const targetFile = args.filePath || args.file_path;
    const startLine = Number(args.startLine || args.start_line || 1);
    let maxLines = Number(args.maxLines || args.max_lines || 500);

    if (args.endLine || args.end_line) {
      const endLine = Number(args.endLine || args.end_line);
      maxLines = Math.max(1, endLine - startLine + 1);
    }

    const validPath = assertPathInWorkspace(targetFile, workspaceRoot);
    if (!fs.existsSync(validPath)) {
      throw new Error(`Note file at path "${targetFile}" does not exist.`);
    }

    const content = fs.readFileSync(validPath, 'utf8');
    const lines = content.split(/\r?\n/);
    const totalLines = lines.length;
    const startIdx = Math.max(0, startLine - 1);
    const endIdx = startIdx + Math.min(maxLines, 10000);
    const slicedContent = lines.slice(startIdx, endIdx).join('\n');
    let finalContent = slicedContent;
    let isTruncated = endIdx < totalLines;

    if (finalContent.length > 10000) {
      finalContent = finalContent.slice(0, 10000) + '\n\n... [Content truncated due to size. Use start_line and max_lines parameters to read further.]';
      isTruncated = true;
    }

    return {
      path: validPath,
      content: finalContent,
      startLine: startIdx + 1,
      linesRead: Math.min(endIdx - startIdx, totalLines - startIdx),
      totalLines,
      truncated: isTruncated
    };
  }

  /**
   * Create a new note safely inside the workspace.
   */
  async createNote({ workspaceRoot, title, content = '', folder = '' }) {
    if (!title || typeof title !== 'string' || !title.trim()) {
      throw new Error('Note title is required.');
    }
    const cleanTitle = title.trim();
    let normalizedFolder = folder ? folder.trim() : '';
    if (
      normalizedFolder.toLowerCase() === 'root'
      || normalizedFolder === '/'
      || normalizedFolder === '.'
      || normalizedFolder === './'
    ) {
      normalizedFolder = '';
    }
    const targetFolder = normalizedFolder ? assertPathInWorkspace(normalizedFolder, workspaceRoot) : path.resolve(workspaceRoot);
    
    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true });
    }

    const safeBaseName = cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled';
    let fileName = `${safeBaseName}.md`;
    let filePath = path.join(targetFolder, fileName);
    let counter = 2;

    while (fs.existsSync(filePath)) {
      fileName = `${safeBaseName}-${counter}.md`;
      filePath = path.join(targetFolder, fileName);
      counter += 1;
    }

    const fileContent = content.startsWith('# ') ? content : `# ${cleanTitle}\n\n${content}`;
    fs.writeFileSync(filePath, fileContent, 'utf8');

    return {
      path: filePath,
      title: cleanTitle,
      created: true
    };
  }

  /**
   * Move or rename a note inside the workspace.
   */
  async moveNote({ workspaceRoot, sourcePath, targetPath }) {
    const validSource = assertPathInWorkspace(sourcePath, workspaceRoot);
    const validTarget = assertPathInWorkspace(targetPath, workspaceRoot);

    if (!fs.existsSync(validSource)) {
      throw new Error(`Source file "${sourcePath}" does not exist.`);
    }

    const targetDir = path.dirname(validTarget);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    fs.renameSync(validSource, validTarget);
    return {
      previousPath: validSource,
      newPath: validTarget,
      moved: true
    };
  }

  /**
   * Extract checklist tasks across notes in the workspace.
   */
  async extractTasks({ workspaceRoot, notePath, status = 'all' }) {
    const files = notePath
      ? [assertPathInWorkspace(notePath, workspaceRoot)]
      : collectMarkdownFiles(workspaceRoot);

    const tasks = [];
    for (const filePath of files) {
      if (!fs.existsSync(filePath)) continue;
      try {
        const text = fs.readFileSync(filePath, 'utf8');
        const lines = text.split(/\r?\n/);
        lines.forEach((line, index) => {
          const match = line.match(/^\s*[-*+]?\s*\[([ xX/])\]\s+(.+)$/);
          if (match) {
            const symbol = match[1].toLowerCase();
            const taskText = match[2].trim();
            const isCompleted = symbol === 'x';
            const isOpen = symbol === ' ' || symbol === '/';

            if (status === 'open' && !isOpen) return;
            if (status === 'completed' && !isCompleted) return;

            tasks.push({
              note: path.basename(filePath),
              path: filePath,
              line: index + 1,
              text: taskText,
              status: isCompleted ? 'completed' : symbol === '/' ? 'in-progress' : 'open'
            });
          }
        });
      } catch {
        // skip unreadable
      }
    }
    return tasks.slice(0, 100);
  }

  /**
   * Update or append content to an existing note safely inside the workspace.
   */
  async updateNote({ workspaceRoot, filePath, content, mode = 'append' }) {
    if (!filePath) {
      throw new Error('filePath is required for updating note.');
    }
    const validPath = assertPathInWorkspace(filePath, workspaceRoot);
    if (!fs.existsSync(validPath)) {
      throw new Error(`Note file at path "${filePath}" does not exist.`);
    }

    const currentContent = fs.readFileSync(validPath, 'utf8');
    let newContent = currentContent;

    if (mode === 'overwrite' || mode === 'replace') {
      newContent = String(content || '');
    } else if (mode === 'prepend') {
      newContent = String(content || '') + '\n\n' + currentContent;
    } else {
      // Default: append
      newContent = currentContent + '\n\n' + String(content || '');
    }

    fs.writeFileSync(validPath, newContent, 'utf8');
    return {
      path: validPath,
      updated: true,
      mode,
      bytesWritten: Buffer.byteLength(newContent, 'utf8')
    };
  }

  /**
   * Delete or trash a note safely inside the workspace.
   */
  async deleteNote({ workspaceRoot, filePath }) {
    if (!filePath) {
      throw new Error('filePath is required for deleting note.');
    }
    const validPath = assertPathInWorkspace(filePath, workspaceRoot);
    if (!fs.existsSync(validPath)) {
      throw new Error(`Note file at path "${filePath}" does not exist.`);
    }

    fs.unlinkSync(validPath);
    return {
      path: validPath,
      deleted: true
    };
  }
  /**
   * Bulk search and replace across notes in the workspace.
   */
  async searchReplace({ workspaceRoot, query, replace = '', isRegex = false, notePath }) {
    if (!query) throw new Error('Search query is required.');
    const files = notePath
      ? [assertPathInWorkspace(notePath, workspaceRoot)]
      : collectMarkdownFiles(workspaceRoot);

    let regex;
    if (isRegex) {
      regex = new RegExp(query, 'g');
    } else {
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      regex = new RegExp(escaped, 'g');
    }

    let modifiedCount = 0;
    let totalReplacements = 0;
    const modifiedFiles = [];

    for (const filePath of files) {
      if (!fs.existsSync(filePath)) continue;
      try {
        const text = fs.readFileSync(filePath, 'utf8');
        const matches = text.match(regex);
        if (matches && matches.length > 0) {
          const newText = text.replace(regex, replace);
          fs.writeFileSync(filePath, newText, 'utf8');
          modifiedCount++;
          totalReplacements += matches.length;
          modifiedFiles.push({ path: filePath, replacements: matches.length });
        }
      } catch { /* skip */ }
    }

    return {
      query,
      replace,
      modifiedFilesCount: modifiedCount,
      totalReplacements,
      modifiedFiles
    };
  }

  /**
   * Read raw Mermaid code blocks from a target note.
   */
  async readDiagram({ workspaceRoot, filePath }) {
    const validPath = assertPathInWorkspace(filePath, workspaceRoot);
    if (!fs.existsSync(validPath)) throw new Error(`File at "${filePath}" does not exist.`);
    const text = fs.readFileSync(validPath, 'utf8');
    const regex = /```mermaid\r?\n([\s\S]*?)\r?\n```/g;
    const diagrams = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      diagrams.push({
        code: match[1],
        fullMatch: match[0]
      });
    }
    return { filePath: validPath, totalDiagrams: diagrams.length, diagrams };
  }

  /**
   * Update or replace a Mermaid code block in a note file.
   */
  async updateDiagram({ workspaceRoot, filePath, code, diagramIndex = 0 }) {
    if (!code) throw new Error('Diagram code is required.');
    const validPath = assertPathInWorkspace(filePath, workspaceRoot);
    if (!fs.existsSync(validPath)) throw new Error(`File at "${filePath}" does not exist.`);
    let text = fs.readFileSync(validPath, 'utf8');
    const regex = /```mermaid\r?\n([\s\S]*?)\r?\n```/g;
    const matches = Array.from(text.matchAll(regex));

    if (matches.length === 0) {
      // Append new mermaid block if none exists
      text += `\n\n\`\`\`mermaid\n${code}\n\`\`\`\n`;
    } else {
      const targetMatch = matches[Math.min(diagramIndex, matches.length - 1)];
      const replacement = `\`\`\`mermaid\n${code}\n\`\`\``;
      text = text.substring(0, targetMatch.index) + replacement + text.substring(targetMatch.index + targetMatch[0].length);
    }

    fs.writeFileSync(validPath, text, 'utf8');
    return { filePath: validPath, updated: true, diagramIndex };
  }

  /**
   * Read raw Excalidraw JSON or Draw.io XML from drawing files.
   */
  async readDrawio({ workspaceRoot, filePath }) {
    const validPath = assertPathInWorkspace(filePath, workspaceRoot);
    if (!fs.existsSync(validPath)) throw new Error(`Drawing file at "${filePath}" does not exist.`);
    const raw = fs.readFileSync(validPath, 'utf8');
    let parsed = null;
    let format = 'text';
    if (validPath.endsWith('.excalidraw') || raw.trim().startsWith('{')) {
      format = 'excalidraw-json';
      try { parsed = JSON.parse(raw); } catch { parsed = raw; }
    } else if (raw.trim().startsWith('<')) {
      format = 'drawio-xml';
      parsed = raw;
    }
    return { filePath: validPath, format, data: parsed };
  }

  /**
   * Write back updated Excalidraw JSON or Draw.io XML to drawing files.
   */
  async updateDrawio({ workspaceRoot, filePath, content }) {
    if (!filePath || content == null) throw new Error('filePath and content are required.');
    const validPath = assertPathInWorkspace(filePath, workspaceRoot);
    const targetDir = path.dirname(validPath);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    let stringified = typeof content === 'object' ? JSON.stringify(content, null, 2) : String(content);
    fs.writeFileSync(validPath, stringified, 'utf8');
    return { filePath: validPath, updated: true, bytesWritten: Buffer.byteLength(stringified, 'utf8') };
  }

  /**
   * Find unlinked plain text mentions of note titles that could be wikilinked.
   */
  async unlinkedMentions({ workspaceRoot, noteTitle }) {
    if (!noteTitle) throw new Error('noteTitle is required.');
    const files = collectMarkdownFiles(workspaceRoot);
    const targetTitle = noteTitle.trim().toLowerCase();
    const unlinked = [];

    for (const filePath of files) {
      if (!fs.existsSync(filePath)) continue;
      const baseName = path.basename(filePath, '.md').toLowerCase();
      if (baseName === targetTitle) continue;

      try {
        const text = fs.readFileSync(filePath, 'utf8');
        const lines = text.split(/\r?\n/);
        lines.forEach((line, idx) => {
          // Check if line contains title but not already inside [[Title]]
          const regex = new RegExp(`(?<!\\[\\[)${noteTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?!\\]\\])`, 'gi');
          if (regex.test(line)) {
            unlinked.push({
              filePath,
              fileName: path.basename(filePath),
              line: idx + 1,
              snippet: line.trim()
            });
          }
        });
      } catch { /* skip */ }
    }

    return { noteTitle, totalUnlinkedMentions: unlinked.length, mentions: unlinked.slice(0, 50) };
  }

  /**
   * Automatically convert unlinked text mentions into [[Wikilinks]] inside a note.
   */
  async autoWikilink({ workspaceRoot, filePath }) {
    const validPath = assertPathInWorkspace(filePath, workspaceRoot);
    if (!fs.existsSync(validPath)) throw new Error(`Note file at "${filePath}" does not exist.`);

    const files = collectMarkdownFiles(workspaceRoot);
    const availableTitles = files.map(f => path.basename(f, '.md')).filter(Boolean);

    let text = fs.readFileSync(validPath, 'utf8');
    let replacementCount = 0;

    for (const title of availableTitles) {
      if (title.length < 3) continue; // Skip very short titles to avoid false positives
      const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(?<!\\[\\[)\\b${escaped}\\b(?!\\]\\])`, 'gi');
      const matches = text.match(regex);
      if (matches) {
        text = text.replace(regex, `[[${title}]]`);
        replacementCount += matches.length;
      }
    }

    if (replacementCount > 0) {
      fs.writeFileSync(validPath, text, 'utf8');
    }

    return { filePath: validPath, replacementCount, updated: replacementCount > 0 };
  }
}

module.exports = {
  NoteApplicationService,
  assertPathInWorkspace,
  toWorkspaceRelative,
  collectMarkdownFiles
};
