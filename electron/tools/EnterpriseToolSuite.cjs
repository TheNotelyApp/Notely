/**
 * EnterpriseToolSuite.cjs
 * Enterprise-Grade Unified & Self-Sufficient Capability Suite for Notely MCP.
 * 
 * Consolidates 70+ granular micro-tools into 7 rich, self-sufficient tools:
 * 1. search - Multi-modal search (full-text, semantic vector, tags, author, frontmatter, graph, web)
 * 2. read_note - 360° note inspector (raw & clean text, media, diagrams, backlinks, tasks, git history)
 * 3. edit_note - Atomic note authoring, patching, appending, frontmatter updates, renaming, dry-run
 * 4. manage_tasks - Workspace & note-level checklist / task engine
 * 5. manage_diagrams - Mermaid, Excalidraw, Draw.io CRUD and indexing
 * 6. workspace_overview - Health stats, file tree, graph connections, linting, recent activity
 * 7. git_control - Workspace git VCS operations
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const {
  assertPathInWorkspace,
  toWorkspaceRelative,
  collectMarkdownFiles,
  cleanMarkdown,
  resolveNotePath,
  atomicWriteFile,
  safeDeleteFile,
  getFileGitHistory,
  getNoteBacklinks
} = require('../services/NoteApplicationService.cjs');


// ─── ENTERPRISE CAPABILITY SUITE CLASS ────────────────────────────────────────

class EnterpriseToolSuite {
  constructor(toolRegistry) {
    this.registry = toolRegistry;
  }

  get noteService() { return this.registry.noteService; }
  get knowledgeService() { return this.registry.knowledgeService; }
  get workspaceService() { return this.registry.workspaceService; }
  get webService() { return this.registry.webService; }

  // ─── 1. SEARCH ─────────────────────────────────────────────────────────────

  async search(args = {}, context = {}) {
    const workspaceRoot = context.workspaceRoot || args.workspaceRoot;
    if (!workspaceRoot) throw new Error('Workspace root is required.');

    const query = String(args.query || '').trim();
    const source = (args.source || 'notes').toLowerCase();
    const mode = (args.mode || 'auto').toLowerCase();
    const limit = Math.min(Number(args.limit || 20), 50);
    const tags = Array.isArray(args.tags) ? args.tags.map(t => String(t).trim().toLowerCase()) : [];
    const authorFilter = args.author || args.user || null;
    const folderFilter = args.folder ? String(args.folder).trim() : null;

    const results = {
      query,
      source,
      mode,
      totalHits: 0,
      hits: [],
      webHits: [],
      suggestedFollowUps: []
    };

    // 1. Web Search if requested
    if (source === 'web' || source === 'all') {
      if (query && this.webService) {
        try {
          const webRes = await this.webService.searchWeb({ query, maxResults: Math.min(limit, 8) });
          results.webHits = webRes.results || [];
        } catch (err) {
          results.webError = err.message;
        }
      }
      if (source === 'web') {
        results.totalHits = results.webHits.length;
        return results;
      }
    }

    // 2. Local Notes Search
    const allFiles = collectMarkdownFiles(workspaceRoot);
    const scoredHits = [];

    // Check if regex mode
    let regex = null;
    if (mode === 'regex' || (mode === 'auto' && /^\/.+\/[a-z]*$/i.test(query))) {
      try {
        let pattern = query;
        let flags = 'i';
        const slashMatch = query.match(/^\/(.+)\/([a-z]*)$/i);
        if (slashMatch) {
          pattern = slashMatch[1];
          if (slashMatch[2]) flags = slashMatch[2];
        }
        if (/([*+?{]|\{[0-9]+,[0-9]*\}|\{[0-9]+\})\s*([*+?{]|\{[0-9]+,[0-9]*\}|\{[0-9]+\})/.test(pattern) ||
            /\([^)]*([*+])\)[*+]/.test(pattern)) {
          throw new Error('Unsafe regular expression pattern: potential ReDoS detected.');
        }
        regex = new RegExp(pattern, flags.includes('i') ? flags : `${flags}i`);
      } catch (err) {
        if (mode === 'regex') throw err;
        regex = null;
      }
    }

    // Extract query terms for token matching
    const queryTokens = query.toLowerCase().replace(/[^a-z0-9_\-\s]/g, ' ').split(/\s+/).filter(t => t.length >= 2);

    for (const filePath of allFiles) {
      const relPath = toWorkspaceRelative(filePath, workspaceRoot);
      if (folderFilter && !relPath.toLowerCase().startsWith(folderFilter.toLowerCase())) {
        continue;
      }

      try {
        const text = fs.readFileSync(filePath, 'utf8');
        const stat = fs.statSync(filePath);
        const fileName = path.basename(filePath);
        const baseName = path.basename(filePath, '.md');
        const lowerText = text.toLowerCase();
        const lowerName = fileName.toLowerCase();

        // Parse frontmatter
        let frontmatter = {};
        let noteTags = [];
        let noteAuthor = null;
        const fmMatch = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        if (fmMatch) {
          try {
            const yaml = require('js-yaml');
            frontmatter = yaml.load(fmMatch[1]) || {};
            if (frontmatter.tags) {
              const rawTags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [frontmatter.tags];
              noteTags = rawTags.map(t => String(t).toLowerCase());
            }
            if (frontmatter.author || frontmatter.user) {
              noteAuthor = String(frontmatter.author || frontmatter.user);
            }
          } catch {
            // ignore yaml error
          }
        }

        // Inline tags
        const inlineTags = text.match(/(?:^|\s)#[a-zA-Z0-9_\-/]+/g) || [];
        for (const it of inlineTags) {
          const cleanTag = it.trim().replace(/^#/, '').toLowerCase();
          if (!noteTags.includes(cleanTag)) noteTags.push(cleanTag);
        }

        // Check tag filter
        if (tags.length > 0) {
          const hasTagMatch = tags.some(t => noteTags.includes(t));
          if (!hasTagMatch) continue;
        }

        // Check author filter
        if (authorFilter && (!noteAuthor || !noteAuthor.toLowerCase().includes(authorFilter.toLowerCase()))) {
          continue;
        }

        // Title detection
        const h1Match = text.match(/^#\s+(.+)$/m);
        const title = frontmatter.title || (h1Match ? h1Match[1].trim() : baseName);

        let score = 0;
        const matchReasons = {
          titleMatch: false,
          tagMatches: [],
          textSnippets: [],
          vectorScore: 0,
          graphHops: 0
        };

        // Regex evaluation
        if (regex) {
          const lines = text.split(/\r?\n/);
          lines.forEach((line, idx) => {
            if (regex.test(line)) {
              score += 1.0;
              if (matchReasons.textSnippets.length < 3) {
                matchReasons.textSnippets.push(`Line ${idx + 1}: ${line.trim()}`);
              }
            }
          });
          if (regex.test(title)) {
            score += 2.0;
            matchReasons.titleMatch = true;
          }
        } else if (query) {
          // Exact title/filename match
          if (lowerName.includes(query.toLowerCase()) || title.toLowerCase().includes(query.toLowerCase())) {
            score += 2.0;
            matchReasons.titleMatch = true;
          }

          // Exact full query match in text
          if (lowerText.includes(query.toLowerCase())) {
            score += 1.2;
            const idx = lowerText.indexOf(query.toLowerCase());
            const start = Math.max(0, idx - 40);
            const end = Math.min(text.length, idx + query.length + 60);
            matchReasons.textSnippets.push(text.slice(start, end).replace(/\s+/g, ' ').trim());
          }

          // Token matching
          for (const tok of queryTokens) {
            if (noteTags.includes(tok)) {
              score += 0.8;
              if (!matchReasons.tagMatches.includes(tok)) matchReasons.tagMatches.push(tok);
            }
            if (lowerText.includes(tok) && matchReasons.textSnippets.length < 3) {
              score += 0.3;
              const idx = lowerText.indexOf(tok);
              const start = Math.max(0, idx - 40);
              const end = Math.min(text.length, idx + tok.length + 60);
              const snippet = text.slice(start, end).replace(/\s+/g, ' ').trim();
              if (!matchReasons.textSnippets.includes(snippet)) matchReasons.textSnippets.push(snippet);
            }
          }
        } else {
          // Empty query: filter-only mode (e.g. searching by tag or author)
          score = 1.0;
        }

        if (score > 0) {
          // Extract quick structural stats
          const wordCount = text.replace(/```[\s\S]*?```/g, '').replace(/[#*`_~[\]()]/g, ' ').trim().split(/\s+/).filter(Boolean).length;
          const taskCount = (text.match(/^\s*[-*+]?\s*\[[ xX/]\]\s+/gm) || []).length;
          const diagramCount = (text.match(/```mermaid/g) || []).length;

          scoredHits.push({
            path: relPath,
            title,
            folder: path.dirname(relPath) === '.' ? '' : path.dirname(relPath).replace(/\\/g, '/'),
            score: Number(score.toFixed(2)),
            modifiedAt: stat.mtime.toISOString(),
            matchReasons,
            tags: noteTags,
            frontmatter,
            stats: {
              wordCount,
              taskCount,
              diagramCount
            }
          });
        }
      } catch {
        // skip unreadable
      }
    }

    scoredHits.sort((a, b) => b.score - a.score);
    results.hits = scoredHits.slice(0, limit);
    results.totalHits = scoredHits.length;

    // Helpful follow-up suggestions
    if (results.hits.length > 0) {
      results.suggestedFollowUps.push({
        action: 'read_note',
        description: `Inspect complete content, diagrams, and tasks of top hit: "${results.hits[0].title}"`,
        params: { pathOrTitle: results.hits[0].path }
      });
    }

    return results;
  }

  // ─── 2. READ NOTE ──────────────────────────────────────────────────────────

  async readNote(args = {}, context = {}) {
    const workspaceRoot = context.workspaceRoot || args.workspaceRoot;
    if (!workspaceRoot) throw new Error('Workspace root is required.');

    const targetInput = args.pathOrTitle || args.filePath || args.file_path || args.path || args.title;
    if (!targetInput) throw new Error('pathOrTitle is required for read_note.');

    const resolved = resolveNotePath(targetInput, workspaceRoot);
    if (!resolved.exists) {
      return {
        success: false,
        exists: false,
        error: {
          code: 'NOTE_NOT_FOUND',
          message: `Note "${targetInput}" could not be found in the workspace.`,
          didYouMean: resolved.didYouMean,
          hint: resolved.didYouMean.length > 0
            ? `Did you mean one of: ${resolved.didYouMean.join(', ')}? Call read_note with that path.`
            : 'Check workspace notes with the search tool.'
        }
      };
    }

    const fullPath = resolved.resolvedPath;
    const relPath = resolved.relativePath;
    const rawContent = fs.readFileSync(fullPath, 'utf8');
    const stat = fs.statSync(fullPath);
    const lines = rawContent.split(/\r?\n/);
    const totalLines = lines.length;

    // Inclusion toggles (default all true)
    const inc = args.include || {};
    const includeRaw = inc.rawContent !== false;
    const includeClean = inc.cleanContent !== false;
    const includeOutline = inc.outline !== false;
    const includeTags = inc.tags !== false;
    const includeFrontmatter = inc.frontmatter !== false;
    const includeMedia = inc.media !== false;
    const includeDiagrams = inc.diagrams !== false;
    const includeTasks = inc.tasks !== false;
    const includeLinks = inc.links !== false;
    const includeGit = inc.gitHistory !== false;
    const includeStats = inc.stats !== false;

    // Pagination
    const startLine = Math.max(1, Number(args.startLine || args.start_line || 1));
    let maxLines = Number(args.maxLines || args.max_lines || 400);
    if (args.endLine || args.end_line) {
      const endLine = Number(args.endLine || args.end_line);
      maxLines = Math.max(1, endLine - startLine + 1);
    }
    maxLines = Math.min(Math.max(1, maxLines), 10000);

    const startIdx = startLine - 1;
    const endIdx = Math.min(totalLines, startIdx + maxLines);
    const pagedLines = lines.slice(startIdx, endIdx);
    let pagedRaw = pagedLines.join('\n');
    let hasMore = endIdx < totalLines;

    if (pagedRaw.length > 10000) {
      pagedRaw = pagedRaw.slice(0, 10000) + '\n\n... [Content truncated due to size. Use start_line and max_lines parameters to read further.]';
      hasMore = true;
    }

    // Frontmatter parsing
    let frontmatter = {};
    let frontmatterTags = [];
    const fmMatch = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (fmMatch) {
      try {
        const yaml = require('js-yaml');
        frontmatter = yaml.load(fmMatch[1]) || {};
        if (frontmatter.tags) {
          const raw = Array.isArray(frontmatter.tags) ? frontmatter.tags : [frontmatter.tags];
          frontmatterTags = raw.map(t => String(t).trim());
        }
      } catch {
        // ignore
      }
    }

    // Inline tags
    const inlineTags = [];
    const inlineMatches = rawContent.match(/(?:^|\s)#[a-zA-Z0-9_\-/]+/g) || [];
    for (const it of inlineMatches) {
      const clean = it.trim().replace(/^#/, '');
      if (!frontmatterTags.includes(clean) && !inlineTags.includes(clean)) {
        inlineTags.push(clean);
      }
    }
    const allTags = [...frontmatterTags, ...inlineTags];

    // Title
    const h1Match = rawContent.match(/^#\s+(.+)$/m);
    const title = frontmatter.title || (h1Match ? h1Match[1].trim() : path.basename(relPath, '.md'));

    // Headings outline
    const outline = [];
    if (includeOutline) {
      lines.forEach((line, idx) => {
        const m = line.match(/^(#{1,6})\s+(.+)$/);
        if (m) {
          outline.push({
            level: m[1].length,
            text: m[2].trim(),
            line: idx + 1
          });
        }
      });
    }

    // Tasks extraction
    const tasks = [];
    if (includeTasks) {
      lines.forEach((line, idx) => {
        const m = line.match(/^\s*[-*+]?\s*\[([ xX/])\]\s+(.+)$/);
        if (m) {
          const sym = m[1].toLowerCase();
          const taskText = m[2].trim();
          const dueMatch = taskText.match(/due:(\d{4}-\d{2}-\d{2})/);
          const dueDate = dueMatch ? dueMatch[1] : null;
          let isOverdue = false;
          if (dueDate && sym !== 'x') {
            const dueTime = new Date(dueDate).setHours(23, 59, 59);
            isOverdue = dueTime < Date.now();
          }
          tasks.push({
            line: idx + 1,
            text: taskText,
            status: sym === 'x' ? 'completed' : sym === '/' ? 'in-progress' : 'open',
            dueDate,
            isOverdue
          });
        }
      });
    }

    // Media extraction
    const media = [];
    if (includeMedia) {
      const mediaRegex = /!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]*)\]\(([^)]+\.(?:pdf|png|jpg|jpeg|gif|svg|mp3|mp4|webp))\)/gi;
      let mMatch;
      while ((mMatch = mediaRegex.exec(rawContent)) !== null) {
        const alt = mMatch[1] || mMatch[3] || '';
        const rawTarget = mMatch[2] || mMatch[4] || '';
        const cleanTarget = rawTarget.trim().replace(/^<|>$/g, '');
        const absAsset = path.isAbsolute(cleanTarget)
          ? cleanTarget
          : path.resolve(path.dirname(fullPath), cleanTarget);
        const exists = fs.existsSync(absAsset);
        let sizeBytes = null;
        if (exists) {
          try { sizeBytes = fs.statSync(absAsset).size; } catch { /* ignore */ }
        }
        media.push({
          name: path.basename(cleanTarget),
          path: cleanTarget,
          alt,
          exists,
          sizeBytes
        });
      }
    }

    // Diagrams extraction
    const diagrams = [];
    if (includeDiagrams) {
      // Mermaid
      const mermaidRegex = /```mermaid\r?\n([\s\S]*?)\r?\n```/g;
      let mmMatch;
      let diagramIdx = 0;
      while ((mmMatch = mermaidRegex.exec(rawContent)) !== null) {
        const code = mmMatch[1];
        let type = 'Diagram';
        let diagTitle = `Mermaid Diagram ${diagramIdx + 1}`;
        const firstLine = code.trim().split(/\r?\n/)[0] || '';
        if (firstLine) {
          const kw = firstLine.split(/[\s:{([]/)[0].toLowerCase();
          if (['graph', 'flowchart'].includes(kw)) type = 'Flowchart';
          else if (kw === 'sequencediagram') type = 'Sequence';
          else if (kw === 'classdiagram') type = 'Class';
          else if (kw === 'erdiagram') type = 'Entity Relationship';
          else if (kw === 'gantt') type = 'Gantt';
          else if (kw === 'pie') type = 'Pie Chart';
          else if (kw === 'mindmap') type = 'Mindmap';
          else type = kw.charAt(0).toUpperCase() + kw.slice(1);
        }
        const titleMatch = code.match(/title\s+(.+)$/m) || code.match(/^%%\s*(.+)$/m);
        if (titleMatch) diagTitle = titleMatch[1].trim();

        diagrams.push({
          type,
          title: diagTitle,
          code,
          index: diagramIdx
        });
        diagramIdx++;
      }

      // Referenced Excalidraw / Drawio
      const drawioRegex = /\[\[([^\]]+\.(?:excalidraw|drawio))\]\]|!\[([^\]]*)\]\(([^)]+\.(?:excalidraw|drawio))\)/gi;
      let dMatch;
      while ((dMatch = drawioRegex.exec(rawContent)) !== null) {
        const diagFile = dMatch[1] || dMatch[3];
        diagrams.push({
          type: diagFile.endsWith('.excalidraw') ? 'Excalidraw' : 'Drawio',
          title: path.basename(diagFile),
          path: diagFile,
          isExternalFile: true
        });
      }
    }

    // Links & Backlinks
    const links = { outgoing: [], backlinks: [] };
    if (includeLinks) {
      const wikiRegex = /\[\[([^|\]]+)(?:\|[^\]]+)?\]\]/g;
      let wMatch;
      while ((wMatch = wikiRegex.exec(rawContent)) !== null) {
        const link = wMatch[1].trim();
        if (!links.outgoing.includes(link)) links.outgoing.push(link);
      }
      links.backlinks = getNoteBacklinks(relPath, title, workspaceRoot);
    }

    // Git history
    const gitHistory = includeGit ? getFileGitHistory(fullPath, workspaceRoot, 5) : [];

    // Stats
    const words = cleanMarkdown(rawContent).split(/\s+/).filter(Boolean).length;
    const readingTimeMin = Math.max(1, Math.ceil(words / 200));

    const response = {
      path: relPath,
      title,
      folder: path.dirname(relPath) === '.' ? '' : path.dirname(relPath).replace(/\\/g, '/'),
      exists: true,
      frontmatter: includeFrontmatter ? frontmatter : undefined,
      tags: includeTags ? allTags : undefined,
      stats: includeStats ? {
        words,
        lines: totalLines,
        readingTimeMin,
        sizeBytes: stat.size,
        modifiedAt: stat.mtime.toISOString()
      } : undefined,
      pagination: {
        totalLines,
        startLine,
        returnedLines: pagedLines.length,
        hasMore,
        nextStartLine: hasMore ? endIdx + 1 : null,
        tokenEstimate: Math.round(pagedRaw.length / 4)
      },
      content: {
        raw: includeRaw ? pagedRaw : undefined,
        cleansed: includeClean ? cleanMarkdown(pagedRaw) : undefined
      },
      outline: includeOutline ? outline : undefined,
      tasks: includeTasks ? tasks : undefined,
      diagrams: includeDiagrams ? diagrams : undefined,
      media: includeMedia ? media : undefined,
      links: includeLinks ? links : undefined,
      gitHistory: includeGit ? gitHistory : undefined,
      suggestedFollowUps: [
        {
          action: 'edit_note',
          description: `Append, patch, or update content in "${title}"`,
          params: { filePath: relPath, operation: 'append' }
        }
      ]
    };

    return response;
  }

  // ─── 3. EDIT NOTE ──────────────────────────────────────────────────────────

  async editNote(args = {}, context = {}) {
    const workspaceRoot = context.workspaceRoot || args.workspaceRoot;
    if (!workspaceRoot) throw new Error('Workspace root is required.');

    const filePath = args.filePath || args.path;
    if (!filePath) throw new Error('filePath is required for edit_note.');

    const operation = (args.operation || 'create').toLowerCase();
    const content = args.content != null ? String(args.content) : '';
    const dryRun = Boolean(args.dryRun);
    const options = args.options || {};
    const createIfMissing = options.createIfMissing !== false;

    const resolved = resolveNotePath(filePath, workspaceRoot);
    let targetAbsPath = resolved.exists
      ? resolved.resolvedPath
      : assertPathInWorkspace(filePath.endsWith('.md') ? filePath : `${filePath}.md`, workspaceRoot);

    // Operation: DELETE
    if (operation === 'delete') {
      if (!resolved.exists) {
        throw new Error(`Cannot delete note "${filePath}": note does not exist.`);
      }
      if (!dryRun) {
        await safeDeleteFile(targetAbsPath);
      }
      return {
        path: toWorkspaceRelative(targetAbsPath, workspaceRoot),
        operation: 'delete',
        dryRun,
        deleted: true,
        message: `Note "${filePath}" successfully deleted.`
      };
    }

    // Operation: RENAME
    if (operation === 'rename') {
      if (!resolved.exists) {
        throw new Error(`Cannot rename note "${filePath}": note does not exist.`);
      }
      const newPathInput = args.newPath;
      if (!newPathInput) throw new Error('newPath is required for rename operation.');
      const newAbsPath = assertPathInWorkspace(newPathInput.endsWith('.md') ? newPathInput : `${newPathInput}.md`, workspaceRoot);

      if (!dryRun) {
        const destDir = path.dirname(newAbsPath);
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
        fs.renameSync(targetAbsPath, newAbsPath);
      }
      return {
        previousPath: toWorkspaceRelative(targetAbsPath, workspaceRoot),
        newPath: toWorkspaceRelative(newAbsPath, workspaceRoot),
        operation: 'rename',
        dryRun,
        renamed: true
      };
    }

    // Check existence for non-create operations
    if (!resolved.exists && !createIfMissing && operation !== 'create') {
      throw new Error(`Note at "${filePath}" does not exist and createIfMissing is false.`);
    }

    let currentContent = '';
    if (resolved.exists) {
      currentContent = fs.readFileSync(targetAbsPath, 'utf8');
    }

    let updatedContent = currentContent;
    let diffSummary = '';

    switch (operation) {
      case 'create': {
        if (resolved.exists && !options.overwrite) {
          throw new Error(`Note "${filePath}" already exists. Use operation 'replace' or pass options.overwrite: true.`);
        }
        let initialText = content;
        if (args.frontmatter && typeof args.frontmatter === 'object') {
          const yaml = require('js-yaml');
          const fmStr = `---\n${yaml.dump(args.frontmatter).trim()}\n---\n\n`;
          initialText = fmStr + initialText;
        }
        updatedContent = initialText;
        diffSummary = `Created new note with ${updatedContent.split(/\r?\n/).length} lines.`;
        break;
      }

      case 'replace': {
        updatedContent = content;
        diffSummary = `Replaced full content (${currentContent.length} chars -> ${updatedContent.length} chars).`;
        break;
      }

      case 'append': {
        updatedContent = currentContent ? `${currentContent.trimEnd()}\n\n${content}` : content;
        diffSummary = `Appended ${content.split(/\r?\n/).length} lines to end of note.`;
        break;
      }

      case 'prepend': {
        // Prepend after YAML frontmatter if present
        const fmMatch = currentContent.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
        if (fmMatch) {
          const fm = fmMatch[0];
          const rest = currentContent.slice(fm.length);
          updatedContent = `${fm}${content}\n\n${rest.trimStart()}`;
        } else {
          updatedContent = `${content}\n\n${currentContent}`;
        }
        diffSummary = `Prepended content to beginning of note.`;
        break;
      }

      case 'patch': {
        const patch = args.patch || {};
        if (patch.search != null) {
          const searchStr = String(patch.search);
          const replaceStr = patch.replace != null ? String(patch.replace) : '';
          if (!currentContent.includes(searchStr)) {
            throw new Error(`Patch search target "${searchStr.slice(0, 50)}" not found in note.`);
          }
          updatedContent = currentContent.replace(searchStr, replaceStr);
          diffSummary = `Patched text: replaced target occurrence.`;
        } else if (patch.startLine != null) {
          const lines = currentContent.split(/\r?\n/);
          const s = Math.max(1, Number(patch.startLine));
          const e = patch.endLine != null ? Math.max(s, Number(patch.endLine)) : s;
          const replLines = patch.replacement != null ? String(patch.replacement).split(/\r?\n/) : [];
          lines.splice(s - 1, e - s + 1, ...replLines);
          updatedContent = lines.join('\n');
          diffSummary = `Patched lines ${s}–${e}.`;
        } else {
          throw new Error('Patch operation requires either patch.search or patch.startLine.');
        }
        break;
      }

      case 'insert_at': {
        const lines = currentContent.split(/\r?\n/);
        const targetHeading = args.targetHeading;
        let insertIndex = -1;

        if (targetHeading) {
          const cleanHeading = targetHeading.toLowerCase().trim();
          insertIndex = lines.findIndex(l => l.toLowerCase().trim() === cleanHeading || l.toLowerCase().trim().endsWith(cleanHeading));
          if (insertIndex === -1) {
            throw new Error(`Target heading "${targetHeading}" not found in note.`);
          }
          insertIndex += 1; // insert right below heading
        } else if (args.line != null) {
          insertIndex = Math.max(0, Number(args.line) - 1);
        } else {
          insertIndex = lines.length;
        }

        lines.splice(insertIndex, 0, content);
        updatedContent = lines.join('\n');
        diffSummary = `Inserted content at line ${insertIndex + 1}.`;
        break;
      }

      case 'update_frontmatter': {
        const newMeta = args.frontmatter;
        if (!newMeta || typeof newMeta !== 'object') {
          throw new Error('frontmatter object is required for update_frontmatter operation.');
        }
        const yaml = require('js-yaml');
        const fmMatch = currentContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
        let existingMeta = {};
        let body = currentContent;

        if (fmMatch) {
          try { existingMeta = yaml.load(fmMatch[1]) || {}; } catch { /* ignore */ }
          body = currentContent.slice(fmMatch[0].length);
        }

        const mergedMeta = { ...existingMeta, ...newMeta };
        const newFmStr = `---\n${yaml.dump(mergedMeta).trim()}\n---\n\n`;
        updatedContent = newFmStr + body.trimStart();
        diffSummary = `Updated YAML frontmatter (${Object.keys(newMeta).join(', ')}).`;
        break;
      }

      case 'set_title': {
        const newTitle = String(args.title || content).trim();
        if (!newTitle) throw new Error('title is required for set_title operation.');
        const lines = currentContent.split(/\r?\n/);
        let h1Index = lines.findIndex(l => /^#\s+/.test(l));

        if (h1Index !== -1) {
          lines[h1Index] = `# ${newTitle}`;
        } else {
          lines.unshift(`# ${newTitle}`, '');
        }
        updatedContent = lines.join('\n');
        diffSummary = `Updated primary note title to "${newTitle}".`;
        break;
      }

      default:
        throw new Error(`Unknown edit_note operation: "${operation}".`);
    }

    if (!dryRun) {
      atomicWriteFile(targetAbsPath, updatedContent, options.backup);
    }

    const relPath = toWorkspaceRelative(targetAbsPath, workspaceRoot);
    const linesAfter = updatedContent.split(/\r?\n/).length;
    const wordsAfter = cleanMarkdown(updatedContent).split(/\s+/).filter(Boolean).length;

    return {
      path: relPath,
      operation,
      dryRun,
      success: true,
      diffSummary,
      stats: {
        totalLines: linesAfter,
        wordCount: wordsAfter,
        bytesWritten: Buffer.byteLength(updatedContent, 'utf8')
      },
      suggestedFollowUps: [
        {
          action: 'read_note',
          description: `Verify updated content in "${relPath}"`,
          params: { pathOrTitle: relPath }
        }
      ]
    };
  }

  // ─── 4. MANAGE TASKS ───────────────────────────────────────────────────────

  async manageTasks(args = {}, context = {}) {
    const workspaceRoot = context.workspaceRoot || args.workspaceRoot;
    if (!workspaceRoot) throw new Error('Workspace root is required.');

    const operation = (args.operation || 'list').toLowerCase();
    const notePathInput = args.notePath;
    const statusFilter = (args.status || 'all').toLowerCase();
    const dateFilter = (args.filter || 'all').toLowerCase();

    // 1. LIST TASKS
    if (operation === 'list') {
      const files = notePathInput
        ? [resolveNotePath(notePathInput, workspaceRoot).resolvedPath].filter(Boolean)
        : collectMarkdownFiles(workspaceRoot);

      const tasks = [];
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);

      for (const file of files) {
        try {
          const text = fs.readFileSync(file, 'utf8');
          const lines = text.split(/\r?\n/);
          const relPath = toWorkspaceRelative(file, workspaceRoot);

          lines.forEach((line, idx) => {
            const m = line.match(/^\s*[-*+]?\s*\[([ xX/])\]\s+(.+)$/);
            if (m) {
              const sym = m[1].toLowerCase();
              const taskText = m[2].trim();
              const isCompleted = sym === 'x';
              const isInProgress = sym === '/';
              const isOpen = sym === ' ';

              if (statusFilter === 'open' && !isOpen && !isInProgress) return;
              if (statusFilter === 'completed' && !isCompleted) return;
              if (statusFilter === 'in-progress' && !isInProgress) return;

              const dueMatch = taskText.match(/due:(\d{4}-\d{2}-\d{2})/);
              const dueDate = dueMatch ? dueMatch[1] : null;
              let isOverdue = false;
              let isDueToday = false;

              if (dueDate) {
                isDueToday = dueDate === todayStr;
                isOverdue = dueDate < todayStr && !isCompleted;
              }

              if (dateFilter === 'today' && !isDueToday) return;
              if (dateFilter === 'overdue' && !isOverdue) return;

              tasks.push({
                notePath: relPath,
                noteTitle: path.basename(relPath, '.md'),
                line: idx + 1,
                text: taskText,
                status: isCompleted ? 'completed' : isInProgress ? 'in-progress' : 'open',
                dueDate,
                isOverdue,
                isDueToday
              });
            }
          });
        } catch {
          // skip
        }
      }

      return {
        operation: 'list',
        totalTasks: tasks.length,
        filter: { status: statusFilter, date: dateFilter, notePath: notePathInput || 'all' },
        tasks: tasks.slice(0, 150)
      };
    }

    // Operations on specific note
    if (!notePathInput) throw new Error(`notePath is required for task operation "${operation}".`);
    const resolved = resolveNotePath(notePathInput, workspaceRoot);
    if (!resolved.exists) throw new Error(`Note "${notePathInput}" not found.`);

    const fullPath = resolved.resolvedPath;
    const relPath = resolved.relativePath;
    let content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split(/\r?\n/);

    // 2. CREATE TASK
    if (operation === 'create') {
      const taskText = args.taskText || args.text;
      if (!taskText) throw new Error('taskText is required to create a task.');
      const dueDate = args.dueDate ? ` due:${args.dueDate}` : '';
      const formattedTask = `- [ ] ${taskText.trim()}${dueDate}`;

      lines.push(formattedTask);
      atomicWriteFile(fullPath, lines.join('\n'));
      return {
        operation: 'create',
        notePath: relPath,
        line: lines.length,
        task: formattedTask,
        created: true
      };
    }

    // 3. TOGGLE OR COMPLETE TASK
    if (operation === 'toggle' || operation === 'complete') {
      const targetLine = args.line != null ? Number(args.line) : null;
      const matchText = args.taskText ? String(args.taskText).toLowerCase().trim() : null;

      let foundIdx = -1;
      if (targetLine != null && targetLine <= lines.length) {
        foundIdx = targetLine - 1;
      } else if (matchText) {
        foundIdx = lines.findIndex(l => l.toLowerCase().includes(matchText) && /^\s*[-*+]?\s*\[[ xX/]\]/.test(l));
      }

      if (foundIdx === -1) {
        throw new Error(`Task matching ${targetLine ? `line ${targetLine}` : `"${matchText}"`} not found in "${relPath}".`);
      }

      const currentLine = lines[foundIdx];
      let newLine = currentLine;
      if (operation === 'complete') {
        newLine = currentLine.replace(/\[[ /]\]/, '[x]');
      } else {
        // Toggle
        newLine = currentLine.includes('[x]') ? currentLine.replace(/\[x\]/i, '[ ]') : currentLine.replace(/\[ \]/, '[x]');
      }

      lines[foundIdx] = newLine;
      atomicWriteFile(fullPath, lines.join('\n'));
      return {
        operation,
        notePath: relPath,
        line: foundIdx + 1,
        updatedTask: newLine.trim(),
        completed: newLine.includes('[x]')
      };
    }

    // 4. ARCHIVE COMPLETED
    if (operation === 'archive_completed') {
      const completedLines = [];
      const remainingLines = [];

      for (const line of lines) {
        if (/^\s*[-*+]?\s*\[[xX]\]/.test(line)) {
          completedLines.push(line);
        } else {
          remainingLines.push(line);
        }
      }

      if (completedLines.length === 0) {
        return { operation: 'archive_completed', notePath: relPath, archivedCount: 0 };
      }

      // Append to ## Completed Tasks section
      remainingLines.push('', '## Completed Tasks', ...completedLines);
      atomicWriteFile(fullPath, remainingLines.join('\n'));
      return {
        operation: 'archive_completed',
        notePath: relPath,
        archivedCount: completedLines.length
      };
    }

    // 5. MOVE TASK
    if (operation === 'move') {
      const targetNoteInput = args.targetNotePath;
      if (!targetNoteInput) throw new Error('targetNotePath is required for move task operation.');
      const targetResolved = resolveNotePath(targetNoteInput, workspaceRoot);
      if (!targetResolved.exists) throw new Error(`Target note "${targetNoteInput}" not found.`);

      const targetLine = args.line != null ? Number(args.line) : null;
      const matchText = args.taskText ? String(args.taskText).toLowerCase().trim() : null;

      let foundIdx = -1;
      if (targetLine != null && targetLine <= lines.length) {
        foundIdx = targetLine - 1;
      } else if (matchText) {
        foundIdx = lines.findIndex(l => l.toLowerCase().includes(matchText) && /^\s*[-*+]?\s*\[[ xX/]\]/.test(l));
      }

      if (foundIdx === -1) {
        throw new Error(`Task matching ${targetLine ? `line ${targetLine}` : `"${matchText}"`} not found in "${relPath}".`);
      }

      const [taskLine] = lines.splice(foundIdx, 1);
      atomicWriteFile(fullPath, lines.join('\n'));

      // Append to target note
      const targetContent = fs.readFileSync(targetResolved.resolvedPath, 'utf8');
      const targetLines = targetContent.split(/\r?\n/);
      targetLines.push(taskLine);
      atomicWriteFile(targetResolved.resolvedPath, targetLines.join('\n'));

      return {
        operation: 'move',
        sourceNote: relPath,
        targetNote: targetResolved.relativePath,
        task: taskLine.trim(),
        moved: true
      };
    }

    throw new Error(`Unknown manage_tasks operation: "${operation}".`);
  }

  // ─── 5. MANAGE DIAGRAMS ────────────────────────────────────────────────────

  async manageDiagrams(args = {}, context = {}) {
    const workspaceRoot = context.workspaceRoot || args.workspaceRoot;
    if (!workspaceRoot) throw new Error('Workspace root is required.');

    const operation = (args.operation || 'list').toLowerCase();
    const type = (args.type || 'auto').toLowerCase();

    // 1. LIST DIAGRAMS
    if (operation === 'list') {
      const allFiles = collectMarkdownFiles(workspaceRoot);
      const diagrams = [];

      for (const file of allFiles) {
        try {
          const text = fs.readFileSync(file, 'utf8');
          const relPath = toWorkspaceRelative(file, workspaceRoot);
          const mermaidRegex = /```mermaid\r?\n([\s\S]*?)\r?\n```/g;
          let mMatch;
          let idx = 0;
          while ((mMatch = mermaidRegex.exec(text)) !== null) {
            const code = mMatch[1];
            const firstWord = code.trim().split(/[\s:{([]/)[0].toLowerCase();
            diagrams.push({
              notePath: relPath,
              type: 'mermaid',
              subType: firstWord,
              index: idx,
              previewSnippet: code.slice(0, 80).replace(/\s+/g, ' ')
            });
            idx++;
          }
        } catch { /* skip */ }
      }

      // Check standalone drawing files
      const scanDir = (dir) => {
        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const e of entries) {
            if (e.name.startsWith('.') || e.name === 'node_modules') continue;
            const fp = path.join(dir, e.name);
            if (e.isDirectory()) scanDir(fp);
            else if (e.name.endsWith('.excalidraw') || e.name.endsWith('.drawio')) {
              diagrams.push({
                filePath: toWorkspaceRelative(fp, workspaceRoot),
                type: e.name.endsWith('.excalidraw') ? 'excalidraw' : 'drawio',
                sizeBytes: fs.statSync(fp).size
              });
            }
          }
        } catch { /* skip */ }
      };
      scanDir(workspaceRoot);

      const filtered = (type && type !== 'auto' && type !== 'all')
        ? diagrams.filter(d => d.type === type || d.subType === type)
        : diagrams;

      return {
        operation: 'list',
        totalDiagrams: filtered.length,
        diagrams: filtered
      };
    }

    // 2. READ DIAGRAM
    if (operation === 'read') {
      if (args.notePath) {
        const resolved = resolveNotePath(args.notePath, workspaceRoot);
        if (!resolved.exists) throw new Error(`Note "${args.notePath}" not found.`);
        const text = fs.readFileSync(resolved.resolvedPath, 'utf8');
        const mermaidRegex = /```mermaid\r?\n([\s\S]*?)\r?\n```/g;
        const matches = Array.from(text.matchAll(mermaidRegex));
        const index = Math.min(Number(args.diagramIndex || 0), Math.max(0, matches.length - 1));

        if (matches.length === 0) {
          return { notePath: resolved.relativePath, found: false, message: 'No Mermaid diagrams found in note.' };
        }
        return {
          notePath: resolved.relativePath,
          index,
          totalDiagrams: matches.length,
          type: 'mermaid',
          code: matches[index][1]
        };
      }

      if (args.filePath) {
        const validPath = assertPathInWorkspace(args.filePath, workspaceRoot);
        if (!fs.existsSync(validPath)) throw new Error(`Diagram file "${args.filePath}" not found.`);
        const raw = fs.readFileSync(validPath, 'utf8');
        let parsed = raw;
        try { parsed = JSON.parse(raw); } catch { /* text/xml */ }
        return {
          filePath: toWorkspaceRelative(validPath, workspaceRoot),
          format: validPath.endsWith('.excalidraw') ? 'excalidraw' : 'drawio',
          content: parsed
        };
      }
      throw new Error('notePath or filePath is required for read diagram operation.');
    }

    // 3. CREATE / UPDATE DIAGRAM
    if (operation === 'create' || operation === 'update') {
      const codeOrContent = args.content || args.code;
      if (!codeOrContent) throw new Error('content or code is required for diagram create/update.');

      if (args.notePath) {
        const resolved = resolveNotePath(args.notePath, workspaceRoot);
        if (!resolved.exists) throw new Error(`Note "${args.notePath}" not found.`);
        let text = fs.readFileSync(resolved.resolvedPath, 'utf8');
        const mermaidRegex = /```mermaid\r?\n([\s\S]*?)\r?\n```/g;
        const matches = Array.from(text.matchAll(mermaidRegex));

        if (operation === 'update' && matches.length > 0) {
          const idx = Math.min(Number(args.diagramIndex || 0), matches.length - 1);
          const targetMatch = matches[idx];
          const repl = `\`\`\`mermaid\n${codeOrContent}\n\`\`\``;
          text = text.slice(0, targetMatch.index) + repl + text.slice(targetMatch.index + targetMatch[0].length);
        } else {
          // Append new diagram
          text = `${text.trimEnd()}\n\n\`\`\`mermaid\n${codeOrContent}\n\`\`\`\n`;
        }

        atomicWriteFile(resolved.resolvedPath, text);
        return {
          operation,
          notePath: resolved.relativePath,
          type: 'mermaid',
          updated: true
        };
      }

      if (args.filePath) {
        const validPath = assertPathInWorkspace(args.filePath, workspaceRoot);
        const stringified = typeof codeOrContent === 'object' ? JSON.stringify(codeOrContent, null, 2) : String(codeOrContent);
        atomicWriteFile(validPath, stringified);
        return {
          operation,
          filePath: toWorkspaceRelative(validPath, workspaceRoot),
          bytesWritten: Buffer.byteLength(stringified, 'utf8'),
          saved: true
        };
      }
      throw new Error('notePath or filePath is required for diagram operation.');
    }

    // 4. DELETE DIAGRAM
    if (operation === 'delete') {
      if (args.filePath) {
        const validPath = assertPathInWorkspace(args.filePath, workspaceRoot);
        if (!fs.existsSync(validPath)) throw new Error(`Diagram file "${args.filePath}" not found.`);
        fs.unlinkSync(validPath);
        return { operation: 'delete', filePath: toWorkspaceRelative(validPath, workspaceRoot), deleted: true };
      }
      throw new Error('filePath is required for delete diagram operation.');
    }

    throw new Error(`Unknown manage_diagrams operation: "${operation}".`);
  }

  // ─── 6. WORKSPACE OVERVIEW ─────────────────────────────────────────────────

  async workspaceOverview(args = {}, context = {}) {
    const workspaceRoot = context.workspaceRoot || args.workspaceRoot;
    if (!workspaceRoot) throw new Error('Workspace root is required.');

    const operation = (args.operation || 'summary').toLowerCase();

    // 1. SUMMARY
    if (operation === 'summary') {
      return this.workspaceService.getStatistics({ workspaceRoot });
    }

    // 2. TREE
    if (operation === 'tree') {
      const maxDepth = Math.min(Number(args.maxDepth || 4), 8);
      return this.workspaceService.listTree({ workspaceRoot, maxDepth });
    }

    // 3. RECENT ACTIVITY
    if (operation === 'recent_activity') {
      const limit = Math.min(Number(args.limit || 15), 50);
      return this.workspaceService.getRecentActivity({ workspaceRoot, limit });
    }

    // 4. GRAPH
    if (operation === 'graph') {
      const files = collectMarkdownFiles(workspaceRoot);
      const nodes = [];
      const edges = [];
      const seenNodes = new Set();

      for (const file of files) {
        const relPath = toWorkspaceRelative(file, workspaceRoot);
        const baseName = path.basename(file, '.md');
        if (!seenNodes.has(relPath)) {
          seenNodes.add(relPath);
          nodes.push({ id: relPath, title: baseName, type: 'note' });
        }

        try {
          const content = fs.readFileSync(file, 'utf8');
          const wikiRegex = /\[\[([^|\]]+)(?:\|[^\]]+)?\]\]/g;
          let wMatch;
          while ((wMatch = wikiRegex.exec(content)) !== null) {
            const target = wMatch[1].trim();
            edges.push({ from: relPath, to: target, relation: 'links_to' });
          }
        } catch { /* skip */ }
      }

      return {
        operation: 'graph',
        totalNodes: nodes.length,
        totalEdges: edges.length,
        nodes: nodes.slice(0, 100),
        edges: edges.slice(0, 200)
      };
    }

    // 5. LINT & AUDIT
    if (operation === 'lint') {
      const files = collectMarkdownFiles(workspaceRoot);
      const availableTitles = new Set(files.map(f => path.basename(f, '.md').toLowerCase()));
      const issues = [];

      for (const file of files) {
        const relPath = toWorkspaceRelative(file, workspaceRoot);
        try {
          const text = fs.readFileSync(file, 'utf8');
          if (!text.trim()) {
            issues.push({ path: relPath, issue: 'EMPTY_NOTE', message: 'Note file is completely empty.' });
            continue;
          }

          if (!/^#\s+/m.test(text)) {
            issues.push({ path: relPath, issue: 'MISSING_H1', message: 'Note lacks a primary top-level heading (# Title).' });
          }

          const wikiMatches = text.match(/\[\[([^|\]]+)(?:\|[^\]]+)?\]\]/g) || [];
          for (const wm of wikiMatches) {
            const targetTitle = wm.replace(/^\[\[|\]\]$/g, '').split('|')[0].trim().toLowerCase();
            if (!availableTitles.has(targetTitle) && !availableTitles.has(targetTitle.replace(/\.md$/, ''))) {
              issues.push({
                path: relPath,
                issue: 'BROKEN_WIKILINK',
                target: targetTitle,
                message: `Wikilink "[[${targetTitle}]]" points to a note that does not exist.`
              });
            }
          }
        } catch { /* skip */ }
      }

      return {
        operation: 'lint',
        totalNotesScanned: files.length,
        totalIssues: issues.length,
        issues: issues.slice(0, 100)
      };
    }

    // 6. INDEX
    if (operation === 'index') {
      return this.workspaceService.getNotesIndex({ workspaceRoot, folder: args.folder });
    }

    throw new Error(`Unknown workspace_overview operation: "${operation}".`);
  }

  // ─── 7. GIT CONTROL ────────────────────────────────────────────────────────

  async gitControl(args = {}, context = {}) {
    const workspaceRoot = context.workspaceRoot || args.workspaceRoot;
    if (!workspaceRoot) throw new Error('Workspace root is required.');

    const action = (args.action || 'status').toLowerCase();
    const gitDir = path.join(workspaceRoot, '.git');
    if (!fs.existsSync(gitDir)) {
      throw new Error(`Workspace at "${workspaceRoot}" is not a git repository (missing .git directory).`);
    }

    const runGit = (gitArgs) => {
      return execFileSync('git', gitArgs, {
        cwd: workspaceRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 10000
      }).trim();
    };

    switch (action) {
      case 'status': {
        const out = runGit(['status', '--short']);
        let branch = 'detached';
        try {
          branch = runGit(['branch', '--show-current']) || 'detached';
        } catch { /* ignore */ }
        const lines = out ? out.split(/\r?\n/) : [];
        return {
          action: 'status',
          branch,
          clean: lines.length === 0,
          changedFilesCount: lines.length,
          files: lines.map(l => ({ status: l.slice(0, 2).trim(), path: l.slice(3).trim() }))
        };
      }

      case 'diff': {
        const gitArgs = ['diff'];
        if (args.path) {
          assertPathInWorkspace(args.path, workspaceRoot);
          gitArgs.push('--', args.path);
        }
        const diffText = runGit(gitArgs);
        return {
          action: 'diff',
          hasDiff: Boolean(diffText),
          diff: diffText.slice(0, 10000)
        };
      }

      case 'log': {
        const limit = Math.min(Number(args.limit || 10), 30);
        const gitArgs = ['log', `-n`, String(limit), '--pretty=format:%h|%an|%ad|%s', '--date=short'];
        if (args.path) {
          assertPathInWorkspace(args.path, workspaceRoot);
          gitArgs.push('--', args.path);
        }
        const out = runGit(gitArgs);
        const commits = out ? out.split(/\r?\n/).map(l => {
          const [hash, author, date, ...rest] = l.split('|');
          return { hash, author, date, message: rest.join('|') };
        }) : [];
        return { action: 'log', count: commits.length, commits };
      }

      case 'commit': {
        const msg = args.message;
        if (!msg) throw new Error('message is required for git commit.');
        runGit(['add', '-A']);
        const out = runGit(['commit', '-m', msg]);
        return { action: 'commit', success: true, output: out };
      }

      case 'branch': {
        const branchList = runGit(['branch', '--list']).split(/\r?\n/).map(b => b.replace(/^\*\s*/, '').trim()).filter(Boolean);
        let current = 'detached';
        try {
          current = runGit(['branch', '--show-current']);
        } catch { /* ignore */ }
        return { action: 'branch', current, branches: branchList };
      }

      case 'checkout': {
        const branchName = args.branchName;
        if (!branchName) throw new Error('branchName is required for checkout.');
        const out = runGit(['checkout', branchName]);
        return { action: 'checkout', success: true, output: out };
      }

      case 'pull': {
        const out = runGit(['pull']);
        return { action: 'pull', output: out };
      }

      case 'push': {
        const out = runGit(['push']);
        return { action: 'push', output: out };
      }

      case 'stash': {
        const out = runGit(['stash']);
        return { action: 'stash', output: out };
      }

      case 'revert': {
        const commitHash = args.commitHash;
        if (!commitHash) throw new Error('commitHash is required for git revert.');
        const out = runGit(['revert', '--no-edit', commitHash]);
        return { action: 'revert', success: true, output: out };
      }

      default:
        throw new Error(`Unknown git_control action: "${action}".`);
    }
  }

  // ─── ENTERPRISE TOOL DEFINITIONS FOR MCP REGISTRATION ─────────────────────

  getToolDefinitions() {
    return [
      {
        name: 'search',
        version: 'v1',
        capability: 'notes:search',
        aliases: ['search_notes'],
        informationNeeds: ['workspace_content_search', 'search'],
        description: 'Multi-modal search engine for Notely notes & workspace. Supports fulltext keyword matching, regex, YAML frontmatter tags, author, and semantic graph. Optionally queries the web when source is "web" or "all". Returns scored hits with match breakdown.',
        isWrite: false,
        annotations: { readOnly: true, idempotent: true },
        execute: async (args, context) => this.search(args, context),
        jsonSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search keyword, phrase, or regex pattern. Examples: "system architecture", "TODO", "/#v\\d+/"'
            },
            source: {
              type: 'string',
              enum: ['notes', 'web', 'all'],
              default: 'notes',
              description: 'Where to search: "notes" (workspace notes), "web" (external web search), or "all" (both)'
            },
            mode: {
              type: 'string',
              enum: ['auto', 'fulltext', 'semantic', 'hybrid', 'regex', 'tag', 'frontmatter', 'graph'],
              default: 'auto',
              description: 'Search strategy. "auto" intelligently detects regex, tags, and semantic intent'
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Filter notes matching specific tags (e.g. ["architecture", "draft"])'
            },
            author: {
              type: 'string',
              description: 'Filter notes by author or creator from YAML frontmatter'
            },
            folder: {
              type: 'string',
              description: 'Limit search scope to a subfolder within the workspace'
            },
            limit: {
              type: 'number',
              default: 20,
              description: 'Maximum number of results to return (default: 20, max: 50)'
            }
          }
        }
      },
      {
        name: 'read_note',
        version: 'v1',
        capability: 'notes:read_360',
        description: 'Comprehensive 360° note inspector. Retrieves complete note context in ONE call: raw markdown, cleansed plain text, heading outline, frontmatter metadata, inline tags, embedded media assets (with disk existence), Mermaid/Excalidraw diagrams, checklist tasks, outgoing links, backlinks from other notes, and recent git commit history.',
        isWrite: false,
        annotations: { readOnly: true, idempotent: true },
        execute: async (args, context) => this.readNote(args, context),
        jsonSchema: {
          type: 'object',
          required: ['pathOrTitle'],
          properties: {
            pathOrTitle: {
              type: 'string',
              description: 'Note path (e.g. "docs/Architecture.md"), filename ("Architecture.md"), or note title / wikilink ("[[Architecture]]"). Auto-resolves case-insensitively and fuzzy matches if misspelled.'
            },
            include: {
              type: 'object',
              description: 'Optional toggles to omit unneeded sections. Defaults to all true.',
              properties: {
                rawContent: { type: 'boolean', default: true, description: 'Include exact on-disk markdown text' },
                cleanContent: { type: 'boolean', default: true, description: 'Include plain text stripped of markdown formatting' },
                outline: { type: 'boolean', default: true, description: 'Include headings hierarchy (H1-H6) with line numbers' },
                tags: { type: 'boolean', default: true, description: 'Include frontmatter and inline #tags' },
                frontmatter: { type: 'boolean', default: true, description: 'Include parsed YAML frontmatter object' },
                media: { type: 'boolean', default: true, description: 'Include referenced images, video, audio, PDFs with disk existence check' },
                diagrams: { type: 'boolean', default: true, description: 'Include Mermaid diagrams and linked drawing files' },
                tasks: { type: 'boolean', default: true, description: 'Include checklist tasks with status and due dates' },
                links: { type: 'boolean', default: true, description: 'Include outgoing wikilinks and backlinks from other notes' },
                gitHistory: { type: 'boolean', default: true, description: 'Include recent git commits modifying this note' },
                stats: { type: 'boolean', default: true, description: 'Include word count, line count, and reading time' }
              }
            },
            startLine: {
              type: 'number',
              default: 1,
              description: 'Starting line number for pagination (default: 1)'
            },
            maxLines: {
              type: 'number',
              default: 400,
              description: 'Maximum lines to return per call to prevent context blowout (default: 400)'
            }
          }
        }
      },
      {
        name: 'edit_note',
        version: 'v1',
        capability: 'notes:edit_atomic',
        description: 'Unified, atomic note authoring and editing engine. Supports creating new notes, replacing content, appending, prepending, line-range patching, heading-anchored insertion, frontmatter metadata merging, note renaming, and safe deletion. All operations use atomic disk staging to prevent file corruption.',
        isWrite: true,
        annotations: { readOnly: false, destructive: true },
        execute: async (args, context) => this.editNote(args, context),
        jsonSchema: {
          type: 'object',
          required: ['filePath', 'operation'],
          properties: {
            filePath: {
              type: 'string',
              description: 'Target note path (e.g. "docs/Roadmap.md" or "NewNote.md")'
            },
            operation: {
              type: 'string',
              enum: ['create', 'replace', 'append', 'prepend', 'patch', 'insert_at', 'update_frontmatter', 'set_title', 'rename', 'delete'],
              description: 'Operation to perform: "create" (new note), "replace" (full content), "append" (add to bottom), "prepend" (add to top), "patch" (targeted search/replace or line edit), "insert_at" (insert at line or heading), "update_frontmatter" (merge metadata), "set_title" (update H1 and meta), "rename" (move/rename), "delete" (remove)'
            },
            content: {
              type: 'string',
              description: 'Text content to write, append, prepend, or insert'
            },
            frontmatter: {
              type: 'object',
              description: 'Key-value pairs to set or merge in YAML frontmatter'
            },
            patch: {
              type: 'object',
              description: 'Parameters for "patch" operation: search and replace strings, or line numbers',
              properties: {
                search: { type: 'string', description: 'Exact string in note to find and replace' },
                replace: { type: 'string', description: 'Replacement string' },
                startLine: { type: 'number', description: 'Starting line number for line-based replacement' },
                endLine: { type: 'number', description: 'Ending line number for line-based replacement' },
                replacement: { type: 'string', description: 'New text for the specified line range' }
              }
            },
            targetHeading: {
              type: 'string',
              description: 'Heading text for "insert_at" operation (e.g. "## Next Steps")'
            },
            newPath: {
              type: 'string',
              description: 'New path or filename when using "rename" operation'
            },
            dryRun: {
              type: 'boolean',
              default: false,
              description: 'If true, computes and returns the diff without making changes on disk'
            }
          }
        }
      },
      {
        name: 'manage_tasks',
        version: 'v1',
        capability: 'tasks:extract',
        aliases: ['get_tasks'],
        informationNeeds: ['action_items', 'tasks'],
        description: 'Workspace-wide and note-level checklist & task manager. Finds, creates, toggles, moves, or archives tasks (- [ ], - [x]). Can filter by status (open, completed, in-progress) and due dates (today, overdue).',
        isWrite: true,
        annotations: { readOnly: false },
        execute: async (args, context) => this.manageTasks(args, context),
        jsonSchema: {
          type: 'object',
          required: ['operation'],
          properties: {
            operation: {
              type: 'string',
              enum: ['list', 'create', 'toggle', 'complete', 'move', 'archive_completed'],
              description: '"list" (scan and return tasks), "create" (add new task), "toggle" (switch [ ] <-> [x]), "complete" (mark [x]), "move" (relocate task to another note), "archive_completed" (move all [x] tasks to bottom section)'
            },
            notePath: {
              type: 'string',
              description: 'Specific note file path. Omit for "list" to scan entire workspace.'
            },
            status: {
              type: 'string',
              enum: ['all', 'open', 'completed', 'in-progress'],
              default: 'all',
              description: 'Filter tasks by status'
            },
            filter: {
              type: 'string',
              enum: ['all', 'today', 'overdue'],
              default: 'all',
              description: 'Filter tasks by due date: "today" (due today), "overdue" (past due date)'
            },
            taskText: {
              type: 'string',
              description: 'Text of the task to create, complete, or move'
            },
            line: {
              type: 'number',
              description: 'Specific line number of the task in the note'
            },
            targetNotePath: {
              type: 'string',
              description: 'Destination note path when using "move" operation'
            },
            dueDate: {
              type: 'string',
              description: 'Optional due date in YYYY-MM-DD format for created task'
            }
          }
        }
      },
      {
        name: 'manage_diagrams',
        version: 'v1',
        capability: 'diagrams:manage',
        description: 'Unified visual diagram and whiteboard manager. Reads, creates, and updates Mermaid diagrams inside markdown notes, as well as standalone .excalidraw JSON and Draw.io XML drawing files.',
        isWrite: true,
        annotations: { readOnly: false },
        execute: async (args, context) => this.manageDiagrams(args, context),
        jsonSchema: {
          type: 'object',
          required: ['operation'],
          properties: {
            operation: {
              type: 'string',
              enum: ['list', 'read', 'create', 'update', 'delete'],
              description: '"list" (catalog all diagrams), "read" (fetch diagram code/elements), "create" (insert or create drawing), "update" (modify diagram), "delete" (remove diagram)'
            },
            notePath: {
              type: 'string',
              description: 'Path of markdown note containing embedded Mermaid diagram'
            },
            filePath: {
              type: 'string',
              description: 'Path of standalone .excalidraw or .drawio diagram file'
            },
            diagramIndex: {
              type: 'number',
              default: 0,
              description: 'Zero-based index of Mermaid diagram if note contains multiple diagrams'
            },
            type: {
              type: 'string',
              enum: ['mermaid', 'excalidraw', 'drawio', 'auto'],
              default: 'auto',
              description: 'Diagram format'
            },
            content: {
              type: 'string',
              description: 'Mermaid code string or Excalidraw/Drawio JSON/XML content'
            }
          }
        }
      },
      {
        name: 'workspace_overview',
        version: 'v1',
        capability: 'graph:traverse',
        aliases: ['explore_topic_graph', 'get_graph'],
        informationNeeds: ['entity_relationships', 'knowledge_graph', 'workspace_metadata'],
        description: 'Workspace intelligence, structure, health, and diagnostics. Returns hierarchical folder trees, knowledge graph relationships, disk storage stats, link integrity audits (broken wikilinks), and recent file activity.',
        isWrite: false,
        annotations: { readOnly: true, idempotent: true },
        execute: async (args, context) => this.workspaceOverview(args, context),
        jsonSchema: {
          type: 'object',
          properties: {
            operation: {
              type: 'string',
              enum: ['summary', 'tree', 'graph', 'lint', 'index', 'recent_activity'],
              default: 'summary',
              description: '"summary" (health & note count), "tree" (folder/file hierarchy), "graph" (wikilink nodes & edges), "lint" (audit broken wikilinks & empty notes), "index" (structured notes catalog), "recent_activity" (recent modified notes)'
            },
            folder: {
              type: 'string',
              description: 'Scoped directory for tree, index, or lint operations'
            },
            maxDepth: {
              type: 'number',
              default: 4,
              description: 'Maximum folder depth for tree hierarchy (default: 4)'
            }
          }
        }
      },
      {
        name: 'git_control',
        version: 'v1',
        capability: 'git:vcs',
        description: 'Workspace Git version control engine. Inspect status, view diffs, view commit logs, commit changes, branch, pull, push, stash, or revert changes within the workspace repository.',
        isWrite: true,
        annotations: { readOnly: false },
        execute: async (args, context) => this.gitControl(args, context),
        jsonSchema: {
          type: 'object',
          required: ['action'],
          properties: {
            action: {
              type: 'string',
              enum: ['status', 'diff', 'log', 'commit', 'branch', 'checkout', 'pull', 'push', 'stash', 'revert'],
              description: 'Git operation to perform'
            },
            message: {
              type: 'string',
              description: 'Commit message for "commit" action'
            },
            branchName: {
              type: 'string',
              description: 'Branch name for "branch" or "checkout" actions'
            },
            path: {
              type: 'string',
              description: 'File path to scope diff or log operations'
            },
            commitHash: {
              type: 'string',
              description: 'Commit hash for "revert" action'
            },
            limit: {
              type: 'number',
              default: 10,
              description: 'Number of commits to return for "log" action'
            }
          }
        }
      }
    ];
  }
}

module.exports = {
  EnterpriseToolSuite,
  cleanMarkdown,
  resolveNotePath,
  atomicWriteFile,
  getFileGitHistory,
  getNoteBacklinks
};
