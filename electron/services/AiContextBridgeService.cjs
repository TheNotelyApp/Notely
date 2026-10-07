/**
 * AiContextBridgeService.cjs
 * Manages continuous synchronization of AI context, IDE rules, MCP configurations,
 * and prompt transpilation for external LLMs (VS Code, Cursor, Windsurf, Claude Code, Antigravity, Copilot).
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { collectMarkdownFiles } = require('./NoteApplicationService.cjs');
const { isWorkspaceIgnoredPath } = require('../lib/core/workspaceIgnorePolicy.cjs');
const { mcpPromptsRegistry } = require('../mcp/McpPrompts.cjs');

const AI_BRIDGE_GITIGNORE_START = '# >>> Notely AI IDE Bridge Managed >>>';
const AI_BRIDGE_GITIGNORE_END = '# <<< Notely AI IDE Bridge Managed <<<';

const ROOT_BRIDGE_MARKER_START = '<!-- NOTELY_AI_BRIDGE_START -->';
const ROOT_BRIDGE_MARKER_END = '<!-- NOTELY_AI_BRIDGE_END -->';

class AiContextBridgeService {
  constructor(options = {}) {
    this.workspaceRoot = options.workspaceRoot || null;
    this.getMcpConfig = options.getMcpConfig || null;
    this.debounceTimer = null;
    this.debounceDelayMs = options.debounceDelayMs || 5000;
    this.isSyncing = false;
    this.lastContextHash = '';
  }

  setWorkspaceRoot(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    if (workspaceRoot) {
      this.ensureGitignoreBridge(workspaceRoot);
      this.scheduleSync(100); // Immediate initial sync
    }
  }

  /**
   * Schedule a debounced context sync.
   */
  scheduleSync(delayMs = this.debounceDelayMs) {
    if (!this.workspaceRoot) return;
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.syncNow().catch((err) => {
        console.warn('[AiContextBridge] Background sync failed:', err?.message || err);
      });
    }, delayMs);
  }

  /**
   * Perform immediate synchronization of all AI context, bridge files, and prompt definitions.
   */
  async syncNow() {
    const root = this.workspaceRoot;
    if (!root || !fs.existsSync(root)) return { ok: false, error: 'Invalid workspace root' };
    if (this.isSyncing) return { ok: true, skipped: true, reason: 'Sync already in progress' };

    this.isSyncing = true;
    try {
      const aiDir = path.join(root, '.notes-app', 'ai');
      if (!fs.existsSync(aiDir)) {
        fs.mkdirSync(aiDir, { recursive: true });
      }

      const mcpConfig = this.getMcpConfig ? this.getMcpConfig() : { port: 3700, host: '127.0.0.1', bearerToken: '', enabled: true };

      // 1. Ensure .gitignore has the dedicated AI Bridge section
      this.ensureGitignoreBridge(root);

      // 2. Generate Master Static Instructions
      this.writeMasterInstructions(aiDir, mcpConfig);

      // 3. Generate Dynamic Workspace Context Snapshot
      await this.writeDynamicContext(aiDir, root, mcpConfig);

      // 4. Generate IDE MCP Configurations (.vscode/mcp.json)
      this.writeVsCodeMcpConfig(root, mcpConfig);

      // 5. Generate Root AI IDE Bridge Files (AGENTS.md, CLAUDE.md, .cursorrules, .github/copilot-instructions.md)
      this.writeRootBridgeFiles(root, mcpConfig);

      // 6. Transpile Custom & Built-in Prompts to IDE formats (.vscode/prompts/, .github/prompts/, .cursor/rules/)
      this.syncPromptsToIdes(root);

      return { ok: true, syncedAt: new Date().toISOString() };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Safely manage the separate AI Bridge section in .gitignore without touching .notes-app/ toggle section.
   */
  ensureGitignoreBridge(repoRoot) {
    try {
      const gitignorePath = path.join(repoRoot, '.gitignore');
      const existing = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';

      const bridgeBlock = [
        AI_BRIDGE_GITIGNORE_START,
        '.notes-app/ai/',
        '.vscode/mcp.json',
        '.vscode/prompts/',
        '.github/prompts/',
        '.cursor/rules/notely-*.mdc',
        AI_BRIDGE_GITIGNORE_END
      ].join('\n');

      if (existing.includes(AI_BRIDGE_GITIGNORE_START)) {
        const startIdx = existing.indexOf(AI_BRIDGE_GITIGNORE_START);
        const endIdx = existing.indexOf(AI_BRIDGE_GITIGNORE_END);
        if (startIdx !== -1 && endIdx !== -1) {
          const before = existing.slice(0, startIdx).trimEnd();
          const after = existing.slice(endIdx + AI_BRIDGE_GITIGNORE_END.length).trimStart();
          const updated = `${before}\n\n${bridgeBlock}\n\n${after}`.trim() + '\n';
          if (updated !== existing) {
            fs.writeFileSync(gitignorePath, updated, 'utf8');
          }
          return;
        }
      }

      const needsNewline = existing.length > 0 && !existing.endsWith('\n');
      const updated = `${existing}${needsNewline ? '\n' : ''}\n${bridgeBlock}\n`;
      fs.writeFileSync(gitignorePath, updated, 'utf8');
    } catch (err) {
      console.warn('[AiContextBridge] Unable to ensure .gitignore AI bridge block:', err.message);
    }
  }

  /**
   * Write master static rules & schema guidance for external LLMs.
   */
  writeMasterInstructions(aiDir, mcpConfig) {
    const targetFile = path.join(aiDir, 'instructions.md');
    const mcpUrl = `http://${mcpConfig.host || '127.0.0.1'}:${mcpConfig.port || 3700}/mcp`;
    const authNote = mcpConfig.bearerToken
      ? `Authorization header required: \`Bearer <token>\` (configured in \`.vscode/mcp.json\`)`
      : `No authentication required (local loopback mode).`;

    const content = `# Notely Workspace AI Instructions & Conventions

This workspace is a **Notely Knowledge Vault**. External LLMs, AI agents, and IDE assistants (VS Code, Cursor, Claude Code, Antigravity, Copilot) must follow these conventions:

## 1. Linking & Knowledge Graph Syntax
* **Wikilinks**: Connect concepts using \`[[Exact Note Title]]\` or with aliases \`[[Exact Note Title|Custom Display Text]]\`.
* **Atomicity**: Create atomic, focused markdown notes. Prefer adding wikilinks to existing hub notes rather than duplicating concepts.
* **Hierarchy**: Use standard Markdown headings (\`# H1\`, \`## H2\`, \`### H3\`). Limit each document to a single \`# H1\` title.

## 2. Visual Diagrams & Media Creation Manual
Notely natively renders three visual diagram formats:

### A. Mermaid Diagrams (Inline Markdown)
* **Syntax**: Write pure markdown fenced code blocks with \`\`\`mermaid ... \`\`\`.
* **Supported Types**: Flowcharts (\`graph TD / LR\`), Sequence Diagrams (\`sequenceDiagram\`), Class Diagrams (\`classDiagram\`), Entity Relationship (\`erDiagram\`), State Machines (\`stateDiagram-v2\`), Mindmaps (\`mindmap\`), and Timelines (\`timeline\`).
* **Example**:
\`\`\`mermaid
graph TD
  Client[MCP Client] -->|Call Tool| Server[Notely Local MCP]
  Server --> Vault[(Markdown Vault)]
\`\`\`

### B. Excalidraw Whiteboards (Interactive Drawings)
* **Storage Location**: \`.notes-app/excali-diagrams/<diagramId>/diagram.excalidraw\` (or \`media/excalidraw/<diagramId>/diagram.json\`) alongside \`diagram.png\`.
* **Embedding in Notes**:
  \`![Excalidraw Diagram](.notes-app/excali-diagrams/<diagramId>/diagram.png){data-diagram-id="<diagramId>"}\`
* **JSON Structure**: Elements array with shapes and text (\`rectangle\`, \`ellipse\`, \`arrow\`, \`text\`, \`line\`).
* **How LLMs Manipulate**: Generate or edit the JSON elements array directly on disk or use the MCP \`manage_diagrams\` tool.

### C. Draw.io Technical Flowcharts (mxGraph XML)
* **Storage Location**: \`.notes-app/drawio-diagrams/<diagramId>.drawio\` (or \`media/draw.io/<diagramId>.drawio\`) alongside \`<diagramId>.png\`.
* **Embedding in Notes**:
  \`![Draw.io Diagram](.notes-app/drawio-diagrams/<diagramId>.png){data-diagram-id="<diagramId>"}\`
* **XML Structure**: Standard mxGraph XML (\`<mxfile><diagram><mxGraphModel>...\`).
* **How LLMs Manipulate**: Write or update the \`.drawio\` XML source or use the MCP \`manage_diagrams\` tool.

### D. File & Media Operations
* **Adding Media**: Place images/assets in \`media/images/<name>.<ext>\` or \`.notes-app/assets/\` and reference with \`![caption](media/images/<name>.<ext>)\`.
* **Creating New Notes**: Create a \`.md\` file in any folder or subfolder. Use YAML frontmatter:
\`\`\`yaml
---
title: Note Title
tags: [architecture, backend]
aliases: [Core Arch]
created: YYYY-MM-DD
---
\`\`\`
* **Subfolder Organization**: You can freely nest folders (e.g. \`projects/\`, \`meetings/\`, \`docs/\`). Notely scans and indexes all subfolders recursively.

## 3. Checklist Tasks & Task Management System
Notely automatically syncs Markdown checklist checkboxes with its workspace-wide task engine:
* **Supported Task Checkbox Formats**:
  * Bullet Lists: \`- [ ] Open task\`, \`- [x] Completed task\`, \`* [ ] task\`, \`+ [ ] task\`
  * Numbered Lists: \`1. [ ] Numbered task\`, \`2. [x] Done numbered task\`
  * Standalone Paragraph Tasks: \`[ ] Standalone task\`
* **Due Dates & Scheduling Annotations**:
  * Due Date: \`@due(YYYY-MM-DD)\` or inline \`due:YYYY-MM-DD\` (e.g. \`- [ ] Ship release build @due(2026-10-25)\` or \`due:2026-10-25\`).
  * Scheduled Date: \`@sched(YYYY-MM-DD)\` or \`sched:YYYY-MM-DD\`.
  * Start & End Times: \`@start(YYYY-MM-DDTHH:mm)\`, \`@end(YYYY-MM-DDTHH:mm)\`.
* **Priorities & Categorization**:
  * Priority tags: \`#urgent\` / \`#p1\` (Urgent/High), \`#high\` / \`#p2\` (High), \`#medium\` / \`#p3\` (Medium), \`#low\` (Low).
  * Category tags: \`#work\`, \`#bug\`, \`#feature\`, \`#meeting\`.
  * Assignee / Mentions: \`@username\` or \`[[Person Note]]\`.
* **Managing Tasks as an AI Assistant**:
  * To complete a task, change \`[ ]\` to \`[x]\` directly in the source markdown note or call the MCP \`manage_tasks\` tool.
  * When generating checklists, use standard \`- [ ]\` checkboxes with optional \`@due(YYYY-MM-DD)\` and priority tags.

## 4. Attached Code Repositories & Cross-Linking
Notely allows attaching external GitHub and local git repositories to the workspace:
* **Catalog**: Attached repositories are listed in \`dynamic-context.md\` with branch, remote URL, and symbol indexing status.
* **Code References**: When referencing source code in notes, use code fences, backticks \`functionName()\`, or file links.
* **Cross-Repo Context**: When asked about features spanning notes and attached codebases, inspect both the notes vault and the attached repository paths.

## 5. Audio Transcriptions & Document Extractions (PDF, PPTX, DOCX, XLSX)
* **Audio Transcripts**: Spoken audio and meeting recordings in \`media/audio/\` or \`transcripts/\` are transcribed by Notely into formatted text with timestamps (\`transcript.json\` or companion \`.transcript.md\`).
* **Document Extractions**: Binary documents (\`.pdf\`, \`.pptx\`, \`.docx\`, \`.xlsx\`) are automatically parsed into structured text cached under \`.notes-app/cache/extracted/\`.
* **External LLM Usage**: External assistants should read these extracted companions directly or query them via Notely MCP tools.

## 6. Live Notely MCP Server Integration
Notely runs a local Model Context Protocol (MCP) server:
* **Endpoint**: \`${mcpUrl}\`
* **Auth**: ${authNote}
* **Available MCP Tools**:
  * \`read_note\`: Read note contents and parsed metadata (with full diagrams, tasks, backlinks).
  * \`edit_note\`: Edit or create notes safely with diff inspection.
  * \`manage_diagrams\`: Create, update, read, or list Mermaid diagrams, Excalidraw whiteboards, and Draw.io flowcharts.
  * \`search\`: Search full-text and semantic vector embeddings across all notes and extracted documents.
  * \`get_knowledge_graph\`: Retrieve node degree centrality, backlinks, and related clusters.
  * \`manage_tasks\`: Query, aggregate, and toggle tasks across the vault.
  * \`workspace_overview\`: Get high-level statistics and recent file activity.

> **Guideline**: Prefer invoking the Notely MCP server for semantic searches, task aggregation, and graph exploration rather than performing brute-force file greps.
`;

    this.atomicWriteFile(targetFile, content);
  }

  /**
   * Write dynamic snapshot containing complete note sitemap, graph hubs, task registry, and recent activity.
   */
  async writeDynamicContext(aiDir, root, mcpConfig) {
    const targetFile = path.join(aiDir, 'dynamic-context.md');
    const mdFiles = collectMarkdownFiles(root);

    const openTasks = [];
    let noteEntries = [];
    let recentNotes = [];
    const tagMap = new Map();
    const linkCounts = new Map();

    for (const filePath of mdFiles) {
      if (isWorkspaceIgnoredPath(filePath, root)) continue;
      const relPath = path.relative(root, filePath).replace(/\\/g, '/');

      try {
        const stat = fs.statSync(filePath);
        const text = fs.readFileSync(filePath, 'utf8');

        // Extract title
        let title = path.basename(filePath, path.extname(filePath));
        const fmMatch = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        if (fmMatch) {
          try {
            const fm = yaml.load(fmMatch[1]);
            if (fm && fm.title) title = String(fm.title);
          } catch { /* ignore */ }
        } else {
          const h1Match = text.match(/^#\s+(.+)$/m);
          if (h1Match) title = h1Match[1].trim();
        }

        // Tags
        const tags = Array.from(text.matchAll(/#([a-zA-Z0-9_/-]+)/g)).map(m => `#${m[1]}`);
        for (const tag of tags) {
          tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
        }

        // Wiki links
        const wikiLinks = Array.from(text.matchAll(/\[\[(.*?)\]\]/g)).map(m => m[1].split('|')[0].trim());
        linkCounts.set(relPath, (linkCounts.get(relPath) || 0) + wikiLinks.length);

        // Tasks
        const taskMatches = Array.from(text.matchAll(/^\s*[-*+]?\s*\[([ xX])\]\s*(.+)$/gm));
        for (const tm of taskMatches) {
          const isDone = tm[1].toLowerCase() === 'x';
          if (!isDone) {
            openTasks.push({
              note: relPath,
              title: tm[2].trim()
            });
          }
        }

        noteEntries.push({
          relPath,
          title,
          tags: Array.from(new Set(tags)).slice(0, 4).join(' '),
          links: wikiLinks.length,
          mtime: stat.mtime
        });
      } catch { /* skip */ }
    }

    // Sort notes by last modified for recent activity
    noteEntries.sort((a, b) => b.mtime - a.mtime);
    recentNotes = noteEntries.slice(0, 8);

    // Sort top hubs by link count
    const topHubs = [...noteEntries].sort((a, b) => b.links - a.links).slice(0, 6);

    // Top tags
    const topTags = Array.from(tagMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => `\`${tag}\` (${count})`)
      .join(', ');

    // Collect binary extractions (PDF, PPTX, DOCX, audio transcripts)
    const mediaExtractions = this.collectMediaAndExtractions(root);

    // Collect attached code repositories
    const attachedRepos = this.collectAttachedRepositories(root);

    const dynamicContent = `# Notely Dynamic Workspace Context
*Generated: ${new Date().toISOString()} • ${noteEntries.length} Notes • ${openTasks.length} Open Tasks • ${mediaExtractions.length} Extracted Assets • ${attachedRepos.length} Attached Repos • MCP Port: ${mcpConfig.port || 3700}*

## 1. Top Knowledge Hubs & Core Topics
${topHubs.length > 0 ? topHubs.map(h => `- [[${h.title}]] (\`${h.relPath}\`) — ${h.links} connections ${h.tags ? `[${h.tags}]` : ''}`).join('\n') : '_No hub notes detected yet._'}

## 2. Active Tags & Categorization
${topTags || '_No tags found._'}

## 3. Global Note Sitemap & Index
| Note Path | Title | Top Tags | Links | Last Modified |
| :--- | :--- | :--- | :--- | :--- |
${noteEntries.map(n => `| \`${n.relPath}\` | ${n.title} | ${n.tags || '-'} | ${n.links} | ${n.mtime.toISOString().slice(0, 16).replace('T', ' ')} |`).join('\n')}

## 4. Open Tasks Registry (Top ${Math.min(openTasks.length, 15)} of ${openTasks.length})
${openTasks.length > 0 ? openTasks.slice(0, 15).map(t => `- [ ] ${t.title} (\`${t.note}\`)`).join('\n') : '_No open tasks pending!_'}

## 5. Recent Activity
${recentNotes.map(r => `- **\`${r.relPath}\`** (${r.title}) — modified ${r.mtime.toISOString().slice(0, 16).replace('T', ' ')}`).join('\n')}

## 6. Extracted Documents & Audio Transcripts
${mediaExtractions.length > 0 ? `| Asset Path | Type | Extracted Companion / Transcript | Details |
| :--- | :--- | :--- | :--- |
${mediaExtractions.map(m => `| \`${m.assetPath}\` | ${m.type} | \`${m.extractedCompanion}\` | ${m.metrics} |`).join('\n')}` : '_No binary document extractions or audio transcripts found yet._'}

## 7. Attached Code Repositories
${attachedRepos.length > 0 ? `| Repository Name | Local Path | Branch | Remote URL | Code Metrics | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
${attachedRepos.map(r => `| \`${r.name}\` | \`${r.path}\` | \`${r.branch}\` | ${r.remoteUrl} | ${r.stats} | ${r.status} |`).join('\n')}` : '_No external code repositories attached to this workspace._'}
`;

    this.atomicWriteFile(targetFile, dynamicContent);
  }

  /**
   * Scan for attached code repositories from .notes-app/metadata.json.
   */
  collectAttachedRepositories(root) {
    const results = [];
    try {
      const metaPath = path.join(root, '.notes-app', 'metadata.json');
      if (fs.existsSync(metaPath)) {
        const raw = fs.readFileSync(metaPath, 'utf8');
        const data = JSON.parse(raw);
        if (Array.isArray(data.attachedRepos)) {
          for (const repo of data.attachedRepos) {
            results.push({
              name: repo.name || path.basename(repo.path || 'Repository'),
              path: repo.path || '',
              branch: repo.branch || 'main',
              remoteUrl: repo.remoteUrl || '-',
              stats: `${repo.symbolCount || 0} symbols • ${repo.fileCount || 0} files`,
              status: repo.status || 'active'
            });
          }
        }
      }
    } catch { /* ignore */ }
    return results;
  }

  /**
   * Scan for cached document extractions (PDF, PPTX, DOCX, XLSX) and audio transcripts.
   */
  collectMediaAndExtractions(root) {
    const results = [];

    // 1. Check DocumentCacheStore SQLite if available
    try {
      const { DocumentCacheStore } = require('../lib/documents/DocumentCacheStore.cjs');
      const store = new DocumentCacheStore(root);
      const records = store.getAllRecords();
      store.close();
      for (const rec of records) {
        if (rec.status === 'ready' && rec.extractedRelPath) {
          let label = 'Document';
          if (rec.mimeType?.includes('pdf') || rec.relativePath?.toLowerCase().endsWith('.pdf')) label = 'PDF Document';
          else if (rec.mimeType?.includes('presentation') || rec.relativePath?.toLowerCase().endsWith('.pptx') || rec.relativePath?.toLowerCase().endsWith('.ppt')) label = 'Slide Deck';
          else if (rec.mimeType?.includes('spreadsheet') || rec.relativePath?.toLowerCase().endsWith('.xlsx') || rec.relativePath?.toLowerCase().endsWith('.csv')) label = 'Spreadsheet';
          else if (rec.mimeType?.includes('word') || rec.relativePath?.toLowerCase().endsWith('.docx')) label = 'Word Document';

          results.push({
            assetPath: rec.relativePath,
            type: label,
            extractedCompanion: rec.extractedRelPath,
            metrics: `${rec.pageCount || 1} pages • ${rec.wordCount || 0} words`
          });
        }
      }
    } catch { /* ignore */ }

    // 2. Scan for Audio Transcripts in media/audio/ and transcripts/
    try {
      const mediaAudioDir = path.join(root, 'media', 'audio');
      if (fs.existsSync(mediaAudioDir)) {
        const entries = fs.readdirSync(mediaAudioDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const transcriptJson = path.join(mediaAudioDir, entry.name, 'transcript.json');
            if (fs.existsSync(transcriptJson)) {
              results.push({
                assetPath: `media/audio/${entry.name}`,
                type: 'Audio Recording',
                extractedCompanion: `media/audio/${entry.name}/transcript.json`,
                metrics: 'Transcribed Speech'
              });
            }
          }
        }
      }
    } catch { /* ignore */ }

    return results;
  }

  /**
   * Write .vscode/mcp.json for VS Code Copilot and Claude extensions.
   */
  writeVsCodeMcpConfig(root, mcpConfig) {
    const vscodeDir = path.join(root, '.vscode');
    if (!fs.existsSync(vscodeDir)) {
      fs.mkdirSync(vscodeDir, { recursive: true });
    }

    const mcpFilePath = path.join(vscodeDir, 'mcp.json');
    const mcpUrl = `http://${mcpConfig.host || '127.0.0.1'}:${mcpConfig.port || 3700}/mcp`;

    const serverDef = {
      url: mcpUrl
    };

    if (mcpConfig.bearerToken && mcpConfig.bearerToken.trim()) {
      serverDef.headers = {
        Authorization: `Bearer ${mcpConfig.bearerToken.trim()}`
      };
    }

    const payload = {
      mcpServers: {
        notely: serverDef
      }
    };

    this.atomicWriteFile(mcpFilePath, JSON.stringify(payload, null, 2));
  }

  /**
   * Write thin root bridge files (AGENTS.md, CLAUDE.md, .cursorrules, .github/copilot-instructions.md).
   */
  writeRootBridgeFiles(root, mcpConfig) {
    const bridgeText = [
      ROOT_BRIDGE_MARKER_START,
      `# Notely AI Assistant Bridge`,
      `This workspace is managed by Notely. When assisting in this project:`,
      `- **Vault Instructions & Rules**: Read [.notes-app/ai/instructions.md](.notes-app/ai/instructions.md)`,
      `- **Live Knowledge Snapshot & Sitemap**: Read [.notes-app/ai/dynamic-context.md](.notes-app/ai/dynamic-context.md)`,
      `- **Notely MCP Server**: \`http://${mcpConfig.host || '127.0.0.1'}:${mcpConfig.port || 3700}/mcp\` (Tools: \`search\`, \`read_note\`, \`edit_note\`, \`get_knowledge_graph\`, \`manage_tasks\`)`,
      ROOT_BRIDGE_MARKER_END
    ].join('\n');

    // 1. AGENTS.md
    this.updateManagedBlockInFile(path.join(root, 'AGENTS.md'), bridgeText);

    // 2. CLAUDE.md
    this.updateManagedBlockInFile(path.join(root, 'CLAUDE.md'), bridgeText);

    // 3. .cursorrules
    this.updateManagedBlockInFile(path.join(root, '.cursorrules'), bridgeText);

    // 4. .github/copilot-instructions.md
    const githubDir = path.join(root, '.github');
    if (!fs.existsSync(githubDir)) {
      fs.mkdirSync(githubDir, { recursive: true });
    }
    this.updateManagedBlockInFile(path.join(githubDir, 'copilot-instructions.md'), bridgeText);
  }

  /**
   * Safely update managed block inside a file without overwriting user customizations outside the block.
   */
  updateManagedBlockInFile(filePath, blockContent) {
    try {
      let existing = '';
      if (fs.existsSync(filePath)) {
        existing = fs.readFileSync(filePath, 'utf8');
      }

      if (existing.includes(ROOT_BRIDGE_MARKER_START)) {
        const startIdx = existing.indexOf(ROOT_BRIDGE_MARKER_START);
        const endIdx = existing.indexOf(ROOT_BRIDGE_MARKER_END);
        if (startIdx !== -1 && endIdx !== -1) {
          const before = existing.slice(0, startIdx).trimEnd();
          const after = existing.slice(endIdx + ROOT_BRIDGE_MARKER_END.length).trimStart();
          const updated = `${before ? before + '\n\n' : ''}${blockContent}${after ? '\n\n' + after : ''}\n`;
          if (updated !== existing) {
            fs.writeFileSync(filePath, updated, 'utf8');
          }
          return;
        }
      }

      const updated = existing ? `${existing.trimEnd()}\n\n${blockContent}\n` : `${blockContent}\n`;
      fs.writeFileSync(filePath, updated, 'utf8');
    } catch (err) {
      console.warn(`[AiContextBridge] Failed to update bridge in "${filePath}":`, err.message);
    }
  }

  /**
   * Transpile prompts in .notes-app/prompts/*.md to .vscode/prompts/, .github/prompts/, and .cursor/rules/
   */
  syncPromptsToIdes(root) {
    try {
      const prompts = mcpPromptsRegistry.listPrompts(root);

      const vscodePromptsDir = path.join(root, '.vscode', 'prompts');
      const githubPromptsDir = path.join(root, '.github', 'prompts');
      const cursorRulesDir = path.join(root, '.cursor', 'rules');

      fs.mkdirSync(vscodePromptsDir, { recursive: true });
      fs.mkdirSync(githubPromptsDir, { recursive: true });
      fs.mkdirSync(cursorRulesDir, { recursive: true });

      for (const prompt of prompts) {
        const promptName = prompt.name;
        const promptDesc = prompt.description || 'Notely Workspace Workflow Prompt';
        const template = prompt.template || (typeof prompt.generateMessages === 'function'
          ? prompt.generateMessages({})[0]?.content?.text || ''
          : '');

        // Generate VS Code / Copilot .prompt.md format
        const promptMdContent = [
          `---`,
          `name: ${promptName}`,
          `description: ${promptDesc}`,
          `---`,
          ``,
          `# ${promptName}`,
          `${promptDesc}`,
          ``,
          `## Instructions`,
          template
        ].join('\n') + '\n';

        this.atomicWriteFile(path.join(vscodePromptsDir, `${promptName}.prompt.md`), promptMdContent);
        this.atomicWriteFile(path.join(githubPromptsDir, `${promptName}.prompt.md`), promptMdContent);

        // Generate Cursor .mdc rule format
        const mdcContent = [
          `---`,
          `description: ${promptDesc}`,
          `globs: *.md, **/*.md`,
          `---`,
          ``,
          `# Notely Workflow: ${promptName}`,
          `${promptDesc}`,
          ``,
          `When executing this workflow in Notely:`,
          template
        ].join('\n') + '\n';

        this.atomicWriteFile(path.join(cursorRulesDir, `notely-${promptName}.mdc`), mdcContent);
      }
    } catch (err) {
      console.warn('[AiContextBridge] Error transpiling prompts to IDEs:', err.message);
    }
  }

  /**
   * Write file safely with atomic temp file rename.
   */
  atomicWriteFile(filePath, content) {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(filePath)) {
        const current = fs.readFileSync(filePath, 'utf8');
        if (current === content) return; // Unchanged, skip disk write
      }

      const tmpPath = path.join(dir, `.${path.basename(filePath)}.${Date.now()}.tmp`);
      fs.writeFileSync(tmpPath, content, 'utf8');
      fs.renameSync(tmpPath, filePath);
    } catch (err) {
      console.warn(`[AiContextBridge] Failed to write file "${filePath}":`, err.message);
    }
  }
}

module.exports = {
  AiContextBridgeService,
  AI_BRIDGE_GITIGNORE_START,
  AI_BRIDGE_GITIGNORE_END,
  ROOT_BRIDGE_MARKER_START,
  ROOT_BRIDGE_MARKER_END
};
