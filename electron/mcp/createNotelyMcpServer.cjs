/**
 * createNotelyMcpServer.cjs
 * Creates and configures a Model Context Protocol (MCP) server for Notely workspaces.
 * Exposes tools, prompts (Personas), and resources to external AI clients (Claude, Cursor, Antigravity).
 */

const fs = require('fs');
const path = require('path');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { z } = require('zod');

function normalizeToPosix(filePath) {
  return filePath ? filePath.replace(/\\/g, '/') : '';
}

function assertInWorkspace(workspaceRoot, targetPath) {
  const resolvedRoot = path.resolve(workspaceRoot);
  const resolvedTarget = path.isAbsolute(targetPath)
    ? path.resolve(targetPath)
    : path.resolve(resolvedRoot, targetPath);

  const relative = path.relative(resolvedRoot, resolvedTarget);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Path traversal denied: '${targetPath}' is outside workspace.`);
  }
  return resolvedTarget;
}

function collectMarkdownFiles(dir, rootDir = dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Exclude hidden dirs and build artifacts
      if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
        results.push(...collectMarkdownFiles(fullPath, rootDir));
      }
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      results.push(fullPath);
    }
  }
  return results;
}

function extractBacklinksAndLinks(content) {
  const wikilinkRegex = /\[\[([^[\]]+)\]\]/g;
  const links = [];
  let match;
  while ((match = wikilinkRegex.exec(content)) !== null) {
    const rawTarget = match[1].split('|')[0].trim();
    if (rawTarget && !links.includes(rawTarget)) {
      links.push(rawTarget);
    }
  }
  return links;
}

function createNotelyMcpServer({ getWorkspaceRoot }) {
  const server = new McpServer({
    name: 'Notely',
    version: '0.1.41'
  });

  function getRoot() {
    const root = typeof getWorkspaceRoot === 'function' ? getWorkspaceRoot() : getWorkspaceRoot;
    if (!root || !fs.existsSync(root)) {
      throw new Error('No active Notely workspace configured or folder does not exist.');
    }
    return root;
  }

  // --- MCP Tools -------------------------------------------------------------

  // 1. list_notes
  server.tool(
    'list_notes',
    'List markdown notes in the Notely workspace with relative paths, title, size, and modified time.',
    {
      folder: z.string().optional().describe('Optional subfolder path to filter notes.')
    },
    async ({ folder }) => {
      const root = getRoot();
      const searchDir = folder ? assertInWorkspace(root, folder) : root;
      const files = collectMarkdownFiles(searchDir, root);

      const notes = files.map((file) => {
        const relPath = normalizeToPosix(path.relative(root, file));
        const stat = fs.statSync(file);
        const name = path.basename(file, '.md');
        return {
          path: relPath,
          title: name,
          sizeBytes: stat.size,
          modifiedAt: stat.mtime.toISOString()
        };
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ total: notes.length, notes }, null, 2)
          }
        ]
      };
    }
  );

  // 2. read_note
  server.tool(
    'read_note',
    'Read the content of a markdown note in the workspace.',
    {
      path: z.string().describe('Relative path to the note file (e.g. "MeetingNotes.md" or "work/proj.md").'),
      startLine: z.number().optional().describe('1-indexed start line number.'),
      maxLines: z.number().optional().describe('Maximum number of lines to return.')
    },
    async ({ path: notePath, startLine, maxLines }) => {
      const root = getRoot();
      const fullPath = assertInWorkspace(root, notePath);
      if (!fs.existsSync(fullPath)) {
        throw new Error(`Note not found: '${notePath}'`);
      }

      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split(/\r?\n/);
      const start = Math.max(1, startLine || 1);
      const count = maxLines ? Math.max(1, maxLines) : lines.length;
      const slice = lines.slice(start - 1, start - 1 + count);

      return {
        content: [
          {
            type: 'text',
            text: slice.join('\n')
          }
        ]
      };
    }
  );

  // 3. create_note
  server.tool(
    'create_note',
    'Create a new markdown note in the workspace.',
    {
      path: z.string().describe('Relative path for the new note (e.g. "Research/Quantum.md").'),
      content: z.string().describe('Markdown text content of the note.'),
      overwrite: z.boolean().optional().describe('If true, overwrite existing file. Default false.')
    },
    async ({ path: notePath, content, overwrite }) => {
      const root = getRoot();
      const fullPath = assertInWorkspace(root, notePath);

      if (fs.existsSync(fullPath) && !overwrite) {
        throw new Error(`File already exists at '${notePath}'. Set overwrite: true to replace.`);
      }

      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content, 'utf8');

      return {
        content: [
          {
            type: 'text',
            text: `Successfully created note at: ${normalizeToPosix(path.relative(root, fullPath))}`
          }
        ]
      };
    }
  );

  // 4. update_note
  server.tool(
    'update_note',
    'Update or patch an existing note in the workspace.',
    {
      path: z.string().describe('Relative path to the note file.'),
      content: z.string().describe('Updated markdown content of the note.')
    },
    async ({ path: notePath, content }) => {
      const root = getRoot();
      const fullPath = assertInWorkspace(root, notePath);
      if (!fs.existsSync(fullPath)) {
        throw new Error(`Note not found: '${notePath}'`);
      }

      fs.writeFileSync(fullPath, content, 'utf8');
      return {
        content: [
          {
            type: 'text',
            text: `Successfully updated note at: ${normalizeToPosix(path.relative(root, fullPath))}`
          }
        ]
      };
    }
  );

  // 5. search_notes
  server.tool(
    'search_notes',
    'Search notes across the workspace by keyword and token relevance.',
    {
      query: z.string().describe('Search term or phrase to look for across notes.'),
      limit: z.number().optional().describe('Maximum number of results to return (default: 10).')
    },
    async ({ query, limit = 10 }) => {
      const root = getRoot();
      const files = collectMarkdownFiles(root);
      const cleanQuery = query.toLowerCase().trim();
      const tokens = cleanQuery.split(/\s+/).filter((t) => t.length >= 2);

      const matches = [];

      for (const file of files) {
        try {
          const text = fs.readFileSync(file, 'utf8');
          const lowerText = text.toLowerCase();
          const fileName = path.basename(file, '.md').toLowerCase();
          const relPath = normalizeToPosix(path.relative(root, file));

          let score = 0;
          if (fileName.includes(cleanQuery)) score += 10;
          if (lowerText.includes(cleanQuery)) score += 5;

          for (const token of tokens) {
            if (fileName.includes(token)) score += 3;
            const occurrences = (lowerText.match(new RegExp(token, 'g')) || []).length;
            score += Math.min(occurrences, 5);
          }

          if (score > 0) {
            // Find snippet around first match
            const idx = lowerText.indexOf(tokens[0] || cleanQuery);
            const start = Math.max(0, idx - 80);
            const end = Math.min(text.length, idx + 120);
            const snippet = (start > 0 ? '...' : '') + text.substring(start, end).replace(/\s+/g, ' ') + (end < text.length ? '...' : '');

            matches.push({
              path: relPath,
              title: path.basename(file, '.md'),
              score,
              snippet
            });
          }
        } catch {
          // ignore unreadable files
        }
      }

      matches.sort((a, b) => b.score - a.score);
      const results = matches.slice(0, limit);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ query, totalMatches: matches.length, results }, null, 2)
          }
        ]
      };
    }
  );

  // 6. get_note_graph
  server.tool(
    'get_note_graph',
    'Get backlinks and forward links for a specific note to explore knowledge graph relationships.',
    {
      path: z.string().describe('Relative path to the note file.')
    },
    async ({ path: notePath }) => {
      const root = getRoot();
      const targetFullPath = assertInWorkspace(root, notePath);
      if (!fs.existsSync(targetFullPath)) {
        throw new Error(`Note not found: '${notePath}'`);
      }

      const targetRelPath = normalizeToPosix(path.relative(root, targetFullPath));
      const targetBaseName = path.basename(targetFullPath, '.md').toLowerCase();
      const content = fs.readFileSync(targetFullPath, 'utf8');

      // Forward links from this note
      const forwardLinks = extractBacklinksAndLinks(content);

      // Scan other notes for backlinks pointing to target
      const allFiles = collectMarkdownFiles(root);
      const backlinks = [];

      for (const file of allFiles) {
        if (file === targetFullPath) continue;
        try {
          const otherContent = fs.readFileSync(file, 'utf8');
          const otherLinks = extractBacklinksAndLinks(otherContent);
          const pointsToTarget = otherLinks.some(
            (link) => link.toLowerCase() === targetBaseName || link.toLowerCase() === targetRelPath.toLowerCase()
          );
          if (pointsToTarget) {
            backlinks.push({
              path: normalizeToPosix(path.relative(root, file)),
              title: path.basename(file, '.md')
            });
          }
        } catch {
          // ignore
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                note: targetRelPath,
                forwardLinks,
                backlinksCount: backlinks.length,
                backlinks
              },
              null,
              2
            )
          }
        ]
      };
    }
  );

  // 7. list_tasks
  server.tool(
    'list_tasks',
    'Extract all markdown checklist tasks (- [ ] or - [x]) across workspace notes.',
    {
      completed: z.boolean().optional().describe('Filter by completed (true) or open (false). If omitted, returns open tasks.')
    },
    async ({ completed = false }) => {
      const root = getRoot();
      const files = collectMarkdownFiles(root);
      const tasks = [];
      const taskPattern = completed ? /^\s*-\s*\[[xX]\]\s+(.*)$/ : /^\s*-\s*\[\s\]\s+(.*)$/;

      for (const file of files) {
        try {
          const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
          const relPath = normalizeToPosix(path.relative(root, file));

          for (let i = 0; i < lines.length; i++) {
            const match = taskPattern.exec(lines[i]);
            if (match) {
              tasks.push({
                task: match[1].trim(),
                line: i + 1,
                file: relPath,
                completed
              });
            }
          }
        } catch {
          // ignore
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ count: tasks.length, tasks }, null, 2)
          }
        ]
      };
    }
  );

  // --- MCP Prompts (Personas) ------------------------------------------------

  const personas = [
    {
      id: 'general',
      name: 'General Assistant',
      description: 'Balanced, thoughtful knowledge partner for workspace notes.',
      instructions: 'Act as a thoughtful knowledge partner. Answer queries with clarity, cite relevant notes from the workspace, and structure responses logically.'
    },
    {
      id: 'software-engineer',
      name: 'Software Engineer',
      description: 'Focused on code analysis, refactoring, implementation patterns, and debugging.',
      instructions: 'Act as a senior software engineer evaluating notes. Emphasize code quality, design patterns, edge cases, and robust implementations.'
    },
    {
      id: 'technical-architect',
      name: 'Technical Architect',
      description: 'Focuses on system design, APIs, data flow, and architecture trade-offs.',
      instructions: 'Analyze workspace notes with an emphasis on system architecture, data models, modularity, and trade-off considerations.'
    },
    {
      id: 'research-assistant',
      name: 'Research Assistant',
      description: 'Synthesizes notes, identifies research gaps, and connects concepts.',
      instructions: 'Synthesize concepts across notes to highlight hidden relationships, unresolved questions, and logical next steps.'
    }
  ];

  for (const persona of personas) {
    server.prompt(
      persona.id,
      persona.description,
      {
        task: z.string().optional().describe('Specific task, note context, or question for this persona.')
      },
      (args) => ({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `${persona.instructions}\n\n${args?.task ? `Context / Task:\n${args.task}` : ''}`
            }
          }
        ]
      })
    );
  }

  // --- MCP Resources ---------------------------------------------------------
  server.resource(
    'workspace-note',
    'notely://note/{notePath}',
    async (uri, { notePath }) => {
      const root = getRoot();
      const fullPath = assertInWorkspace(root, notePath);
      const text = fs.readFileSync(fullPath, 'utf8');

      return {
        contents: [
          {
            uri: uri.href,
            text,
            mimeType: 'text/markdown'
          }
        ]
      };
    }
  );

  return server;
}

module.exports = {
  createNotelyMcpServer,
  collectMarkdownFiles
};
