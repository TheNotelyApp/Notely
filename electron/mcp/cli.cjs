#!/usr/bin/env node
/**
 * cli.cjs
 * Standalone Stdio Model Context Protocol (MCP) server for Notely.
 * Can be run via: node electron/mcp/cli.cjs --workspace <path>
 */

const path = require('path');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { createNotelyMcpServer } = require('./createNotelyMcpServer.cjs');

function parseArgs() {
  const args = process.argv.slice(2);
  let workspace = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--workspace' || args[i] === '-w' || args[i] === '--dir') {
      workspace = args[i + 1];
      i++;
    }
  }

  if (!workspace) {
    workspace = process.env.NOTELY_WORKSPACE || process.cwd();
  }

  return { workspace: path.resolve(workspace) };
}

async function main() {
  const { workspace } = parseArgs();

  // Create MCP Server bound to workspace
  const server = createNotelyMcpServer({
    getWorkspaceRoot: () => workspace
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('[Notely MCP CLI Error]:', err);
  process.exit(1);
});
