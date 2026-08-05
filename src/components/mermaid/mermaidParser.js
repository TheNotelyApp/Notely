import dagre from "dagre";

/**
 * Supported node shapes:
 * - rectangle: [text]
 * - rounded: (text)
 * - diamond: {text}
 * - circle: ((text))
 * - stadium: ([text])
 * - subroutine: [[text]]
 */

const SHAPE_REGEXES = [
  { type: "stadium", regex: /^([a-zA-Z0-9_-]+)\s*\(\[(.+?)\]\)$/ },
  { type: "subroutine", regex: /^([a-zA-Z0-9_-]+)\s*\[\[(.+?)\]\]$/ },
  { type: "circle", regex: /^([a-zA-Z0-9_-]+)\s*\(\((.+?)\)\)$/ },
  { type: "rounded", regex: /^([a-zA-Z0-9_-]+)\s*\((.+?)\)$/ },
  { type: "diamond", regex: /^([a-zA-Z0-9_-]+)\s*\{(.+?)\}$/ },
  { type: "rectangle", regex: /^([a-zA-Z0-9_-]+)\s*\[(.+?)\]$/ },
];

/**
 * Color preset map for style serialization
 */
export const COLOR_PRESETS = [
  { id: "default", label: "Default", fill: undefined, stroke: undefined, text: undefined },
  { id: "blue", label: "Ocean Blue", fill: "#1e3a8a", stroke: "#3b82f6", text: "#ffffff" },
  { id: "green", label: "Emerald Green", fill: "#064e3b", stroke: "#10b981", text: "#ffffff" },
  { id: "amber", label: "Amber Gold", fill: "#78350f", stroke: "#f59e0b", text: "#ffffff" },
  { id: "rose", label: "Rose Red", fill: "#881337", stroke: "#f43f5e", text: "#ffffff" },
  { id: "purple", label: "Royal Purple", fill: "#581c87", stroke: "#a855f7", text: "#ffffff" },
  { id: "cyan", label: "Cyan Breeze", fill: "#164e63", stroke: "#06b6d4", text: "#ffffff" },
  { id: "slate", label: "Dark Slate", fill: "#1e293b", stroke: "#64748b", text: "#ffffff" },
];

/**
 * Parses Mermaid flowchart string into React Flow nodes and edges.
 * Uses dagre to compute initial node layout coordinates.
 */
export function parseMermaidToFlow(code = "") {
  const lines = code
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("```"));

  let direction = "TD";
  if (lines.length > 0) {
    const headerMatch = lines[0].match(/^(?:flowchart|graph)\s+(TD|LR|RL|BT)/i);
    if (headerMatch) {
      direction = headerMatch[1].toUpperCase();
    }
  }

  const nodesMap = new Map();
  const nodeStylesMap = new Map();
  const edges = [];
  let edgeIdCounter = 1;

  const RESERVED_KEYWORDS = new Set(["end", "subgraph", "flowchart", "graph", "style", "classdef", "class", "click", "direction", "linkstyle"]);

  function ensureNode(token) {
    if (!token) return null;
    let raw = token.trim();
    if (!raw) return null;

    // Check if token matches node declaration with shape: e.g. A[Label]
    for (const { type, regex } of SHAPE_REGEXES) {
      const match = raw.match(regex);
      if (match) {
        const id = match[1];
        if (RESERVED_KEYWORDS.has(id.toLowerCase())) return null;
        const label = match[2].replace(/^["']|["']$/g, "").trim();
        nodesMap.set(id, { id, label, shape: type });
        return id;
      }
    }

    // Bare node ID (e.g. "A")
    const idMatch = raw.match(/^([a-zA-Z0-9_-]+)$/);
    if (idMatch) {
      const id = idMatch[1];
      if (RESERVED_KEYWORDS.has(id.toLowerCase())) return null;
      if (!nodesMap.has(id)) {
        nodesMap.set(id, { id, label: id, shape: "rectangle" });
      }
      return id;
    }

    return null;
  }

  // Edge regex matching arrows with optional labels, e.g. -->|label| or ==> or -.-
  const EDGE_REGEX = /^(.+?)\s*(==>(?:\|[^|]+\|)?|-->(?:\|[^|]+\|)?|---(?:\|[^|]+\|)?|-\.->(?:\|[^|]+\|)?)\s*(.+)$/;

  // Parse lines for nodes, connections, and styles
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();

    // Skip header line, comments, subgraphs, end declarations, classDef, style directives
    if (
      (i === 0 && (lower.startsWith("flowchart") || lower.startsWith("graph"))) ||
      lower.startsWith("%%") ||
      lower.startsWith("subgraph") ||
      lower === "end" ||
      lower.startsWith("end ") ||
      lower.startsWith("classdef ") ||
      lower.startsWith("direction ") ||
      lower.startsWith("linkstyle ") ||
      lower.startsWith("click ")
    ) {
      continue;
    }

    // Parse style directives, e.g. style A fill:#1e3a8a,stroke:#3b82f6,color:#ffffff
    if (line.toLowerCase().startsWith("style ")) {
      const styleMatch = line.match(/^style\s+([a-zA-Z0-9_-]+)\s+(.+)$/i);
      if (styleMatch) {
        const nodeId = styleMatch[1];
        const styleRules = styleMatch[2];
        const fillMatch = styleRules.match(/fill:([^,;\s]+)/i);
        const strokeMatch = styleRules.match(/stroke:([^,;\s]+)/i);
        const textMatch = styleRules.match(/color:([^,;\s]+)/i);

        const preset = COLOR_PRESETS.find(
          (p) => p.fill === fillMatch?.[1] && p.stroke === strokeMatch?.[1]
        );

        nodeStylesMap.set(nodeId, {
          preset: preset?.id || "custom",
          fill: fillMatch?.[1] || undefined,
          stroke: strokeMatch?.[1] || undefined,
          text: textMatch?.[1] || undefined,
        });
      }
      continue;
    }

    const edgeMatch = line.match(EDGE_REGEX);

    if (edgeMatch) {
      const leftPart = edgeMatch[1].trim();
      const connSymbol = edgeMatch[2].trim();
      const rightPart = edgeMatch[3].trim();

      const sourceId = ensureNode(leftPart);
      const targetId = ensureNode(rightPart);

      let label = "";
      let animated = false;
      let lineStyle = "solid"; // "solid" | "dashed" | "thick"
      let style = {};

      if (connSymbol.includes("|")) {
        const labelPart = connSymbol.split("|")[1] || "";
        label = labelPart.replace(/^["']|["']$/g, "").trim();
      }

      if (connSymbol.startsWith("-.-")) {
        animated = true;
        lineStyle = "dashed";
        style = { strokeDasharray: "5,5", strokeWidth: 2 };
      } else if (connSymbol.startsWith("==")) {
        lineStyle = "thick";
        style = { strokeWidth: 4 };
      } else {
        style = { strokeWidth: 2 };
      }

      if (sourceId && targetId) {
        edges.push({
          id: `e-${sourceId}-${targetId}-${edgeIdCounter++}`,
          source: sourceId,
          target: targetId,
          label: label.trim(),
          animated,
          style,
          data: { lineStyle },
        });
      }
    } else {
      // Line might just be a standalone node definition: e.g. A[Hello World]
      ensureNode(line);
    }
  }

  // Fallback if graph is empty
  if (nodesMap.size === 0) {
    nodesMap.set("node-1", { id: "node-1", label: "Start", shape: "stadium" });
    nodesMap.set("node-2", { id: "node-2", label: "Process", shape: "rectangle" });
    nodesMap.set("node-3", { id: "node-3", label: "Decision?", shape: "diamond" });
    nodesMap.set("node-4", { id: "node-4", label: "End", shape: "circle" });

    edges.push(
      { id: "e-node-1-node-2", source: "node-1", target: "node-2", label: "Next", data: { lineStyle: "solid" } },
      { id: "e-node-2-node-3", source: "node-2", target: "node-3", label: "Check", data: { lineStyle: "solid" } },
      { id: "e-node-3-node-4", source: "node-3", target: "node-4", label: "Yes", data: { lineStyle: "thick" } }
    );
  }

  // Apply Dagre layout for x,y positions
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: direction, nodesep: 60, ranksep: 80 });
  g.setDefaultEdgeLabel(() => ({}));

  const nodeWidth = 150;
  const nodeHeight = 50;

  nodesMap.forEach((node) => {
    g.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  const nodes = Array.from(nodesMap.values()).map((node) => {
    const nodeWithPos = g.node(node.id);
    const customStyle = nodeStylesMap.get(node.id) || {};
    return {
      id: node.id,
      type: "mermaidNode",
      data: {
        label: node.label,
        shape: node.shape || "rectangle",
        colorPreset: customStyle.preset || "default",
        fillColor: customStyle.fill,
        strokeColor: customStyle.stroke,
        textColor: customStyle.text,
      },
      position: {
        x: (nodeWithPos?.x || 100) - nodeWidth / 2,
        y: (nodeWithPos?.y || 100) - nodeHeight / 2,
      },
    };
  });

  return { nodes, edges, direction };
}

/**
 * Converts React Flow nodes and edges state back to Mermaid flowchart code.
 */
export function generateMermaidFromFlow(nodes = [], edges = [], direction = "TD") {
  const lines = [`flowchart ${direction}`];
  const styleDirectives = [];

  // Map nodes to mermaid node declarations
  nodes.forEach((node) => {
    const id = node.id;
    const label = node.data?.label || id;
    const shape = node.data?.shape || "rectangle";

    let nodeDecl = "";
    switch (shape) {
      case "stadium":
        nodeDecl = `${id}(["${label}"])`;
        break;
      case "subroutine":
        nodeDecl = `${id}[["${label}"]]`;
        break;
      case "rounded":
        nodeDecl = `${id}("${label}")`;
        break;
      case "diamond":
        nodeDecl = `${id}{"${label}"}`;
        break;
      case "circle":
        nodeDecl = `${id}(("${label}"))`;
        break;
      case "rectangle":
      default:
        nodeDecl = `${id}["${label}"]`;
        break;
    }
    lines.push(`    ${nodeDecl}`);

    // Generate style directive if node has custom colors (only for valid non-var colors)
    const fill = node.data?.fillColor && !node.data.fillColor.startsWith("var(") ? node.data.fillColor : null;
    const stroke = node.data?.strokeColor && !node.data.strokeColor.startsWith("var(") ? node.data.strokeColor : null;
    const text = node.data?.textColor && !node.data.textColor.startsWith("var(") ? node.data.textColor : null;

    if (fill || stroke || text) {
      const parts = [];
      if (fill) parts.push(`fill:${fill}`);
      if (stroke) parts.push(`stroke:${stroke}`);
      if (text) parts.push(`color:${text}`);
      styleDirectives.push(`    style ${id} ${parts.join(",")}`);
    }
  });

  // Map edges to mermaid connection lines
  edges.forEach((edge) => {
    const source = edge.source;
    const target = edge.target;
    const label = edge.label ? `|${edge.label}|` : "";
    const lineStyle = edge.data?.lineStyle || (edge.animated ? "dashed" : "solid");

    let arrow = "-->";
    if (lineStyle === "dashed" || edge.animated) {
      arrow = "-.->";
    } else if (lineStyle === "thick") {
      arrow = "==>";
    }

    if (source && target) {
      lines.push(`    ${source} ${arrow}${label} ${target}`);
    }
  });

  // Append style directives at the end
  if (styleDirectives.length > 0) {
    lines.push(...styleDirectives);
  }

  return lines.join("\n");
}
