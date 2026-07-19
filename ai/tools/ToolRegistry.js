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
          file_path: z.string().describe('The absolute path to the note file to read.')
        }),
        execute: async (args) => {
          log.info(`Executing read_note tool with raw args: ${JSON.stringify(args)}`);
          const filePath = args?.file_path || args?.filePath;
          try {
            if (!filePath || !fs.existsSync(filePath)) {
              return `Error: Note file at path "${filePath}" does not exist.`;
            }
            const content = fs.readFileSync(filePath, 'utf8');
            return content;
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
            // Fallback to simple title/content match or semantic search if active
            const files = agentInstance.db.getWorkspaceFiles ? agentInstance.db.getWorkspaceFiles() : [];
            const results = [];
            for (const f of files) {
              try {
                const text = fs.readFileSync(f.file_path, 'utf8');
                if (f.file_path.toLowerCase().includes(query.toLowerCase()) || text.toLowerCase().includes(query.toLowerCase())) {
                  results.push({ path: f.file_path, preview: text.slice(0, 150) + '...' });
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
            const files = agentInstance.db.getWorkspaceFiles ? agentInstance.db.getWorkspaceFiles() : [];
            return JSON.stringify({
              totalNotes: files.length,
              workspaceRoot: agentInstance.workspaceRoot,
              indexingStatus: 'complete'
            }, null, 2);
          } catch (err) {
            return `Error getting stats: ${err.message}`;
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
