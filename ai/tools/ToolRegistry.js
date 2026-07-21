/**
 * ToolRegistry - Registry of tools available to the AI agent during chat sessions
 */

const { createLogger } = require('../core/logger');
const fs = require('fs');

const log = createLogger('ToolRegistry');

async function getTools(agentInstance) {
  try {
    const { tool } = await import('ai');
    const { z } = await import('zod');

    return {
      read_note: tool({
        description: 'Read the contents of a specific note file in the workspace.',
        parameters: z.object({
          file_path: z.string().describe('The relative or absolute path to the note file to read.'),
          start_line: z.number().int().min(1).optional().describe('Start line number to read (optional, default 1).'),
          end_line: z.number().int().min(1).optional().describe('End line number to read (optional, default: reads up to 10,000 chars).')
        }),
        execute: async (args) => {
          log.info(`Executing read_note tool with raw args: ${JSON.stringify(args)}`);
          let filePath = args?.file_path || args?.filePath;
          const startLine = args?.start_line || args?.startLine || 1;
          const endLine = args?.end_line || args?.endLine || null;
          try {
            if (!filePath) return 'Error: file_path is required.';
            const path = require('path');
            if (!path.isAbsolute(filePath) && agentInstance?.workspaceRoot) {
              filePath = path.resolve(agentInstance.workspaceRoot, filePath);
            }
            if (!fs.existsSync(filePath)) {
              return `Error: Note file at path "${filePath}" does not exist.`;
            }
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split(/\r?\n/);
            
            if (endLine !== null) {
              const sliced = lines.slice(startLine - 1, endLine).join('\n');
              return sliced;
            }

            // Default: read from startLine, cap output size at 10,000 characters
            const remainingText = lines.slice(startLine - 1).join('\n');
            if (remainingText.length > 10000) {
              return remainingText.slice(0, 10000) + '\n\n... [Content truncated due to size. Use start_line and end_line parameters to read further.]';
            }
            return remainingText;
          } catch (err) {
            return `Error reading file: ${err.message}`;
          }
        }
      }),

      search_notes: tool({
        description: 'Search for note files containing a query string in the workspace.',
        parameters: z.object({
          query: z.string().describe('The search term or phrase.')
        }),
        execute: async (args) => {
          log.info(`Executing search_notes tool with raw args: ${JSON.stringify(args)}`);
          const { query } = args || {};
          try {
            if (!query) return '[]';
            if (!agentInstance || !agentInstance.documentService) {
              return 'Error: Document indexing service is not active.';
            }
            const files = agentInstance.documentService._collectMarkdownFiles(agentInstance.workspaceRoot);
            const results = [];
            for (const filePath of files) {
              try {
                const text = fs.readFileSync(filePath, 'utf8');
                if (filePath.toLowerCase().includes(query.toLowerCase()) || text.toLowerCase().includes(query.toLowerCase())) {
                  results.push({ path: filePath, preview: text.slice(0, 150) + '...' });
                }
              } catch {
                // skip unreadable
              }
            }
            return JSON.stringify(results.slice(0, 10), null, 2);
          } catch (err) {
            return `Error searching: ${err.message}`;
          }
        }
      }),

      workspace_stats: tool({
        description: 'Get total notes and workspace information.',
        parameters: z.object({}),
        execute: async () => {
          log.info('Executing workspace_stats tool');
          try {
            const files = agentInstance.documentService._collectMarkdownFiles(agentInstance.workspaceRoot);
            return JSON.stringify({
              totalNotes: files.length,
              workspaceRoot: agentInstance.workspaceRoot,
              indexingStatus: 'complete'
            }, null, 2);
          } catch (err) {
            return `Error getting stats: ${err.message}`;
          }
        }
      }),

      get_tasks: tool({
        description: 'Get all checklist tasks across all notes in the workspace, including open, in-progress, and completed items.',
        parameters: z.object({
          status: z.enum(['all', 'open', 'completed']).optional().describe('Filter tasks by status: open (unchecked/in-progress), completed (checked), or all.')
        }),
        execute: async (args) => {
          log.info(`Executing get_tasks tool with raw args: ${JSON.stringify(args)}`);
          const statusFilter = args?.status || 'all';
          try {
            if (!agentInstance || !agentInstance.workspaceRoot) {
              return 'Error: No workspace active.';
            }
            const files = agentInstance.documentService._collectMarkdownFiles(agentInstance.workspaceRoot);
            const tasksList = [];
            for (const filePath of files) {
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
                    
                    if (statusFilter === 'open' && !isOpen) return;
                    if (statusFilter === 'completed' && !isCompleted) return;
                    
                    tasksList.push({
                      note: filePath.split(/[\\/]/).pop(),
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
            return JSON.stringify(tasksList.slice(0, 50), null, 2);
          } catch (err) {
            return `Error listing tasks: ${err.message}`;
          }
        }
      }),

      list_notes: tool({
        description: 'List all note files in the workspace (optionally filtered by subfolder).',
        parameters: z.object({
          subfolder: z.string().optional().describe('An optional relative subfolder path within the workspace to restrict listing to.')
        }),
        execute: async (args) => {
          log.info(`Executing list_notes tool with raw args: ${JSON.stringify(args)}`);
          const subfolder = args?.subfolder || '';
          try {
            if (!agentInstance || !agentInstance.workspaceRoot) {
              return 'Error: No workspace active.';
            }
            const path = require('path');
            const files = agentInstance.documentService._collectMarkdownFiles(agentInstance.workspaceRoot);
            const matchedFiles = files.filter(filePath => {
              if (!subfolder) return true;
              const relativePath = path.relative(agentInstance.workspaceRoot, filePath);
              return relativePath.toLowerCase().includes(subfolder.toLowerCase());
            });
            return JSON.stringify(matchedFiles.map(filePath => ({
              fileName: filePath.split(/[\\/]/).pop(),
              filePath: filePath
            })).slice(0, 100), null, 2);
          } catch (err) {
            return `Error listing notes: ${err.message}`;
          }
        }
      }),

      get_tags: tool({
        description: 'List all unique tags used across workspace notes, with the notes that carry each tag.',
        parameters: z.object({
          tag: z.string().optional().describe('Filter to notes that have this specific tag (case-insensitive).')
        }),
        execute: async (args) => {
          log.info(`Executing get_tags tool with raw args: ${JSON.stringify(args)}`);
          const filterTag = (args?.tag || '').toLowerCase();
          try {
            if (!agentInstance || !agentInstance.workspaceRoot) return 'Error: No workspace active.';
            const files = agentInstance.documentService._collectMarkdownFiles(agentInstance.workspaceRoot);
            const tagMap = {}; // tag -> [filenames]
            for (const filePath of files) {
              try {
                const text = fs.readFileSync(filePath, 'utf8');
                const fmMatch = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
                if (!fmMatch) continue;
                const fmBlock = fmMatch[1];
                // Extract tags list items
                const tagSection = fmBlock.match(/^tags:\s*\n((?:\s+-\s+.+\n?)*)/m);
                if (!tagSection) continue;
                const tagLines = tagSection[1].matchAll(/^\s+-\s+(.+)$/gm);
                const noteName = filePath.split(/[\\/]/).pop();
                for (const tl of tagLines) {
                  const t = tl[1].trim().toLowerCase();
                  if (!tagMap[t]) tagMap[t] = [];
                  tagMap[t].push(noteName);
                }
              } catch { /* skip */ }
            }
            if (filterTag) {
              const notes = tagMap[filterTag] || [];
              return JSON.stringify({ tag: filterTag, notes }, null, 2);
            }
            return JSON.stringify(tagMap, null, 2);
          } catch (err) {
            return `Error getting tags: ${err.message}`;
          }
        }
      }),

      get_recent_notes: tool({
        description: 'List recently modified notes in the workspace, newest first.',
        parameters: z.object({
          limit: z.number().int().min(1).max(20).optional().describe('Max number of notes to return (default 10).')
        }),
        execute: async (args) => {
          log.info(`Executing get_recent_notes tool with raw args: ${JSON.stringify(args)}`);
          const limit = args?.limit || 10;
          try {
            if (!agentInstance || !agentInstance.workspaceRoot) return 'Error: No workspace active.';
            const files = agentInstance.documentService._collectMarkdownFiles(agentInstance.workspaceRoot);
            const withMtime = files.map(filePath => {
              try {
                const mtime = fs.statSync(filePath).mtime;
                return { fileName: filePath.split(/[\\/]/).pop(), filePath, modifiedAt: mtime.toISOString() };
              } catch {
                return null;
              }
            }).filter(Boolean);
            withMtime.sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));
            return JSON.stringify(withMtime.slice(0, limit), null, 2);
          } catch (err) {
            return `Error getting recent notes: ${err.message}`;
          }
        }
      }),

      get_headings: tool({
        description: 'Extract markdown headings from a specific note or, if no file path given, from all notes in the workspace.',
        parameters: z.object({
          file_path: z.string().optional().describe('Absolute path to a specific note. Omit to scan all notes.'),
          max_level: z.number().int().min(1).max(6).optional().describe('Maximum heading level to include (1=H1 only, 6=all).')
        }),
        execute: async (args) => {
          log.info(`Executing get_headings tool with raw args: ${JSON.stringify(args)}`);
          const maxLevel = args?.max_level || 6;
          const headingRegex = new RegExp(`^(#{1,${maxLevel}})\\s+(.+)$`, 'gm');
          try {
            if (!agentInstance || !agentInstance.workspaceRoot) return 'Error: No workspace active.';
            const files = args?.file_path
              ? [args.file_path]
              : agentInstance.documentService._collectMarkdownFiles(agentInstance.workspaceRoot);
            const results = [];
            for (const filePath of files) {
              try {
                const text = fs.readFileSync(filePath, 'utf8');
                const headings = [];
                let m;
                headingRegex.lastIndex = 0;
                while ((m = headingRegex.exec(text)) !== null) {
                  headings.push({ level: m[1].length, text: m[2].trim() });
                }
                if (headings.length) {
                  results.push({ note: filePath.split(/[\\/]/).pop(), filePath, headings });
                }
              } catch { /* skip */ }
            }
            return JSON.stringify(results, null, 2);
          } catch (err) {
            return `Error getting headings: ${err.message}`;
          }
        }
      }),

      get_current_date: tool({
        description: 'Returns the current date and time. Use this before answering any question involving "today", "this week", "upcoming", "overdue", or relative time.',
        parameters: z.object({}),
        execute: async () => {
          log.info('Executing get_current_date tool');
          const now = new Date();
          return JSON.stringify({
            iso: now.toISOString(),
            date: now.toLocaleDateString('en-CA'), // YYYY-MM-DD
            time: now.toLocaleTimeString('en-GB', { hour12: false }),
            dayOfWeek: now.toLocaleDateString('en-US', { weekday: 'long' }),
          }, null, 2);
        }
      }),

      get_people: tool({
        description: 'Find people mentioned in workspace notes via @mentions or frontmatter attendees/people fields.',
        parameters: z.object({
          name: z.string().optional().describe('Filter to notes that mention this specific person (case-insensitive).')
        }),
        execute: async (args) => {
          log.info(`Executing get_people tool with raw args: ${JSON.stringify(args)}`);
          const filterName = (args?.name || '').toLowerCase();
          try {
            if (!agentInstance || !agentInstance.workspaceRoot) return 'Error: No workspace active.';
            const files = agentInstance.documentService._collectMarkdownFiles(agentInstance.workspaceRoot);
            const personMap = {}; // person -> [filenames]
            for (const filePath of files) {
              try {
                const text = fs.readFileSync(filePath, 'utf8');
                const noteName = filePath.split(/[\\/]/).pop();
                const people = new Set();

                // 1. Frontmatter attendees / people list
                const fmMatch = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
                if (fmMatch) {
                  const fmBlock = fmMatch[1];
                  for (const field of ['attendees', 'people', 'participants', 'authors']) {
                    const section = fmBlock.match(new RegExp(`^${field}:\\s*\\n((?:\\s+-\\s+.+\\n?)*)`, 'm'));
                    if (section) {
                      for (const m of section[1].matchAll(/^\s+-\s+(.+)$/gm)) {
                        people.add(m[1].trim().toLowerCase());
                      }
                    }
                    // also handle inline: attendees: Alice, Bob
                    const inline = fmBlock.match(new RegExp(`^${field}:\\s*(.+)$`, 'm'));
                    if (inline) {
                      inline[1].split(',').forEach(p => people.add(p.trim().toLowerCase()));
                    }
                  }
                }

                // 2. @mention pattern in body
                for (const m of text.matchAll(/@([\w.-]+)/g)) {
                  people.add(m[1].toLowerCase());
                }

                for (const person of people) {
                  if (!personMap[person]) personMap[person] = [];
                  personMap[person].push(noteName);
                }
              } catch { /* skip */ }
            }

            if (filterName) {
              // Find exact match or partial
              const matched = Object.entries(personMap)
                .filter(([p]) => p.includes(filterName))
                .reduce((acc, [p, notes]) => { acc[p] = notes; return acc; }, {});
              return JSON.stringify(matched, null, 2);
            }
            return JSON.stringify(personMap, null, 2);
          } catch (err) {
            return `Error getting people: ${err.message}`;
          }
        }
      }),

      git_diff: tool({
        description: 'Get local git diff of modified and unstaged note changes in the active workspace.',
        parameters: z.object({}),
        execute: async () => {
          log.info('Executing git_diff tool');
          try {
            if (!agentInstance || !agentInstance.workspaceRoot) {
              return 'Error: No workspace active.';
            }
            const simpleGit = require('simple-git');
            const git = simpleGit(agentInstance.workspaceRoot);
            const diff = await git.diff();
            return diff || 'No local changes detected.';
          } catch (err) {
            return `Error getting git diff: ${err.message}`;
          }
        }
      }),

      git_commit: tool({
        description: 'Stage all files and commit note changes in the active workspace with a commit message.',
        parameters: z.object({
          message: z.string().describe('The commit message summarizing the changes.')
        }),
        execute: async (args) => {
          log.info(`Executing git_commit tool with args: ${JSON.stringify(args)}`);
          const { message } = args || {};
          try {
            if (!message) return 'Error: Commit message is required.';
            if (!agentInstance || !agentInstance.workspaceRoot) {
              return 'Error: No workspace active.';
            }
            const simpleGit = require('simple-git');
            const git = simpleGit(agentInstance.workspaceRoot);
            await git.add('./*');
            const commitResult = await git.commit(message);
            return JSON.stringify(commitResult, null, 2);
          } catch (err) {
            return `Error committing changes: ${err.message}`;
          }
        }
      }),

      read_pdf: tool({
        description: 'Read and extract plain text from a specific PDF document attachment in the workspace.',
        parameters: z.object({
          file_path: z.string().describe('The absolute path to the PDF file to read.')
        }),
        execute: async (args) => {
          log.info(`Executing read_pdf tool with args: ${JSON.stringify(args)}`);
          let filePath = args?.file_path || args?.filePath;
          try {
            if (!filePath) return 'Error: file_path is required.';
            const path = require('path');
            if (!path.isAbsolute(filePath) && agentInstance?.workspaceRoot) {
              filePath = path.resolve(agentInstance.workspaceRoot, filePath);
            }
            if (!fs.existsSync(filePath)) {
              return `Error: PDF file at path "${filePath}" does not exist.`;
            }
            const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
            const data = new Uint8Array(fs.readFileSync(filePath));
            const loadingTask = pdfjsLib.getDocument({ data, useSystemFonts: true });
            const pdf = await loadingTask.promise;
            let textContent = '';
            for (let i = 1; i <= Math.min(pdf.numPages, 50); i++) { // cap at 50 pages to prevent context blowup
              const page = await pdf.getPage(i);
              const textObj = await page.getTextContent();
              const pageText = textObj.items.map(item => item.str).join(' ');
              textContent += `--- Page ${i} ---\n${pageText}\n\n`;
            }
            return textContent || 'No text content found in PDF.';
          } catch (err) {
            return `Error reading PDF: ${err.message}`;
          }
        }
      }),

      resolve_folder_link: tool({
        description: 'Resolves relative subfolder paths to list note files inside them.',
        parameters: z.object({
          folder_path: z.string().describe('The relative or absolute folder path to resolve.')
        }),
        execute: async (args) => {
          log.info(`Executing resolve_folder_link tool with args: ${JSON.stringify(args)}`);
          const folderPath = args?.folder_path || args?.folderPath;
          try {
            if (!agentInstance || !agentInstance.workspaceRoot) return 'Error: No workspace active.';
            const path = require('path');
            const targetPath = path.isAbsolute(folderPath) ? folderPath : path.resolve(agentInstance.workspaceRoot, folderPath);
            if (!fs.existsSync(targetPath)) return `Error: Folder path "${targetPath}" does not exist.`;
            const stats = fs.statSync(targetPath);
            if (!stats.isDirectory()) return `Error: "${targetPath}" is a file, not a directory.`;
            
            const entries = fs.readdirSync(targetPath);
            const notes = entries.filter(f => f.endsWith('.md')).map(f => ({
              fileName: f,
              filePath: path.join(targetPath, f)
            }));
            return JSON.stringify(notes, null, 2);
          } catch (err) {
            return `Error resolving folder: ${err.message}`;
          }
        }
      })
    };
  } catch (err) {
    log.error('Failed to initialize tools:', err.message);
    return {};
  }
}

module.exports = { getTools };
