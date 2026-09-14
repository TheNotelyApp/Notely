const fs = require('fs');
const path = require('path');
const { applicationToolRegistry } = require('./electron/tools/ApplicationToolRegistry.cjs');

const tools = applicationToolRegistry.toMcpSchemas();

const suiteNames = {
  notes: 'Suite 1: Notes & Document Management (`notes.*`)',
  index: 'Suite 2: Workspace Index (`index.*`)',
  workspace: 'Suite 3: Workspace Metadata & Files (`workspace.*`)',
  diagrams: 'Suite 4: Diagrams & Flowcharts (`diagrams.*`)',
  drawio: 'Suite 5: Draw.io Vector Drawings (`drawio.*`)',
  excalidraw: 'Suite 6: Excalidraw Canvas Diagrams (`excalidraw.*`)',
  media: 'Suite 7: Media & Assets (`media.*`)',
  tasks: 'Suite 8: Task Workspace (`tasks.*`)',
  search: 'Suite 9: Search & Retrieval (`search.*`)',
  knowledge: 'Suite 10: Knowledge Graph & RAG (`knowledge.*`)',
  git: 'Suite 11: Git Version Control (`git.*`)',
  diagnostics: 'Suite 12: Diagnostics & Telemetry (`diagnostics.*`)',
  web: 'Suite 13: External Web (`web.*`)',
  personas: 'Suite 14: Personas & Agents (`personas.*`)',
  export: 'Suite 15: Bundles & Packaging (`export.*`)'
};

const suites = {};
for (const key of Object.keys(suiteNames)) {
  suites[key] = { title: suiteNames[key], tools: [] };
}

for (const t of tools) {
  const p = t.name.split('.')[0];
  if (suites[p]) {
    suites[p].tools.push(t);
  } else {
    if (!suites.other) suites.other = { title: 'Other Tools', tools: [] };
    suites.other.tools.push(t);
  }
}

let md = `---
title: MCP Tools & Capabilities Reference
description: Comprehensive reference documentation for Notely Model Context Protocol (MCP) server capabilities, tool suites, write permission controls, and SSE transport integration.
keywords: MCP, Model Context Protocol, SSE, AI, Claude Desktop, tools, capabilities, permissions
category: Developer
---

# Notely MCP Tools & Capabilities Reference

Notely embeds an **HTTP SSE (Server-Sent Events) Model Context Protocol (MCP)** server enabling external AI clients (such as Claude Desktop, Cursor, IDE agents, and LLMs) to query, search, analyze, and manipulate workspace content safely.

---

## 1. Server Architecture & Permission Control

- **Transport Protocol**: HTTP SSE listening by default on \`http://127.0.0.1:3700/sse\` (messages accepted at \`/messages\`).
- **Security Guard (\`allowWriteTools\`)**: Configurable toggle in MCP Settings. When set to \`false\`, all write operations (\`[W]\`) are automatically hidden from MCP capability advertisement (\`tools/list\`) and blocked with a \`WRITE_DISABLED\` error envelope.
- **Flight Log Telemetry**: All incoming tool call executions are recorded in the local SQLite telemetry database and broadcast via IPC to the **MCP Diagnostics** flight log viewer (\`AIHealthPage\`).
- **Total Capabilities**: **${tools.length} Tools** across 14 specialized suites.

---

## 2. Complete Tool Suites Reference (${tools.length} Tools)

`;

for (const suite of Object.values(suites)) {
  md += `### ${suite.title} — ${suite.tools.length} Tools\n\n`;
  for (const t of suite.tools) {
    const wTag = t.isWrite ? ' **[W]**' : '';
    const cleanDesc = t.description.replace(/^\[WRITE\]\s*/i, '');
    md += `- \`${t.name}\`${wTag}: ${cleanDesc}\n`;
  }
  md += '\n';
}

md += `---

## 3. Client Integration Example (Claude Desktop)

To connect Claude Desktop to Notely MCP server, add this entry to \`claude_desktop_config.json\`:

\`\`\`json
{
  "mcpServers": {
    "notely": {
      "url": "http://127.0.0.1:3700/sse"
    }
  }
}
\`\`\`

---

## 4. Write Operations Permission Table

When write access is disabled (\`allowWriteTools: false\`), all tools marked **[W]** are automatically filtered out from external discovery and blocked from execution. Read-only query tools remain active and safe to call.
`;

const docPath = path.join(__dirname, 'docs', 'mcp-tools-reference.md');
fs.writeFileSync(docPath, md, 'utf8');
console.log(`Successfully generated docs/mcp-tools-reference.md with ${tools.length} tools.`);
