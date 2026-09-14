/**
 * generate-mcp-docs.cjs
 * Generates docs/mcp-tools-reference.md from ApplicationToolRegistry and McpPrompts.
 */

const fs = require('fs');
const path = require('path');
const { applicationToolRegistry } = require('./electron/tools/ApplicationToolRegistry.cjs');
const { ENTERPRISE_PROMPTS } = require('./electron/mcp/McpPrompts.cjs');

const tools = applicationToolRegistry.toMcpSchemas();
const prompts = ENTERPRISE_PROMPTS || [];

let md = `---
title: Enterprise MCP Tools & Prompts Reference
description: Reference documentation for Notely Model Context Protocol (MCP) server capabilities, 7 enterprise unified tools, MCP prompts, and dual-transport integration.
keywords: MCP, Model Context Protocol, SSE, Streamable HTTP, AI, Claude Desktop, Cursor, prompts, enterprise tools
category: Developer
---

# Notely Enterprise MCP Tools & Prompts Reference

Notely embeds a high-performance **dual-transport Model Context Protocol (MCP)** server (Streamable HTTP & SSE) enabling external AI clients (such as Google Antigravity, Claude Desktop, Cursor, IDE agents, and LLMs) to query, search, analyze, and manipulate workspace content safely and self-sufficiently without handholding.

---

## 1. Architecture Highlights

- **Dual Transport**: Supports Streamable HTTP (\`http://127.0.0.1:3700/mcp\`) and SSE (\`http://127.0.0.1:3700/sse\` with \`/messages\`).
- **Standard MCP Prompts**: Exposes MCP Prompts primitive (\`prompts/list\`, \`prompts/get\`, HTTP \`GET /prompts\`) for interactive workflows.
- **Enterprise Design**: Merged fragmented micro-tools into **${tools.length} self-sufficient, high-signal tools**. Every tool returns rich structured context (match breakdowns, cleansing, frontmatter, backlinks, git history).
- **Safety & Permissions**: Granular write protection toggle (\`allowWriteTools\`). All write tools require explicit permission. Dry-run mode (\`dryRun: true\`) supported on destructive operations.
- **Fuzzy Recovery**: Smart path resolution with Levenshtein-based \`didYouMean\` suggestions on missing files.
- **Atomic File I/O**: Temporary file staging with rename to prevent partial writes or corruption.

---

## 2. The ${tools.length} Unified Enterprise Tools

`;

for (const t of tools) {
  const wTag = t.isWrite ? ' **[W]**' : ' *(Read-Only)*';
  const cleanDesc = t.description.replace(/^\[WRITE\]\s*/i, '');
  md += `### \`${t.name}\`${wTag}\n\n`;
  md += `${cleanDesc}\n\n`;
  if (t.inputSchema && t.inputSchema.properties) {
    md += '**Parameters:**\n';
    for (const [pKey, pVal] of Object.entries(t.inputSchema.properties)) {
      const req = (t.inputSchema.required || []).includes(pKey) ? ', required' : '';
      md += `- \`${pKey}\` (\`${pVal.type || 'any'}\`${req}): ${pVal.description || ''}\n`;
    }
    md += '\n';
  }
}

md += `---

## 3. Standard MCP Prompts Reference (${prompts.length} Prompts)

Notely registers ${prompts.length} standard MCP prompt templates discoverable via \`prompts/list\` and executable via \`prompts/get\`:

| Prompt Name | Arguments | Description |
| :--- | :--- | :--- |
`;

for (const p of prompts) {
  const args = (p.arguments || []).map(a => `${a.name}${a.required ? ' (req)' : ''}`).join(', ');
  md += `| \`${p.name}\` | \`${args || 'none'}\` | ${p.description} |\n`;
}

md += `\n---

## 4. Claude Desktop & External Client Configuration

Add Notely to your \`claude_desktop_config.json\`:

\`\`\`json
{
  "mcpServers": {
    "notely": {
      "url": "http://127.0.0.1:3700/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_OPTIONAL_TOKEN"
      }
    }
  }
}
\`\`\`

---

## 5. Write Operations Permission Control

When write access is disabled (\`allowWriteTools: false\`), all tools marked **[W]** (\`edit_note\`, \`manage_tasks\`, \`manage_diagrams\`, \`git_control\`) are automatically filtered out from external discovery (\`tools/list\`) and blocked with a \`WRITE_DISABLED\` error envelope. Read-only query tools (\`search\`, \`read_note\`, \`workspace_overview\`) remain active and safe to call.
`;

const docPath = path.join(__dirname, 'docs', 'mcp-tools-reference.md');
fs.writeFileSync(docPath, md, 'utf8');
console.log(`[generate-mcp-docs] Successfully wrote ${docPath} (${tools.length} tools, ${prompts.length} prompts)`);
