/**
 * Workspace Media & Diagrams Service
 * Scans workspace notes and extracts all actively referenced diagrams, media (images, video, audio),
 * and PDFs/documents with their referencing notes and line numbers.
 */

import { getMediaTypeFromExtension } from "../utils/mediaUtils.js";
import { isDiagramReference, parseDiagramReference } from "../utils/diagramFileUtils.js";

/**
 * Determine the specific Mermaid diagram type from code content.
 */
export function detectMermaidType(code) {
  if (!code || typeof code !== "string") return "diagram";
  const lines = code.split("\n");
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("%%")) continue;
    const firstWord = line.split(/[\s:{([]/)[0].toLowerCase();
    if (["graph", "flowchart"].includes(firstWord)) return "Flowchart";
    if (firstWord === "sequencediagram") return "Sequence";
    if (firstWord === "classdiagram") return "Class";
    if (firstWord.startsWith("statediagram")) return "State";
    if (firstWord === "erdiagram") return "Entity Relationship";
    if (firstWord === "gantt") return "Gantt";
    if (firstWord === "pie") return "Pie Chart";
    if (firstWord === "gitgraph") return "Git Graph";
    if (firstWord === "mindmap") return "Mindmap";
    if (firstWord === "timeline") return "Timeline";
    if (firstWord === "quadrantchart") return "Quadrant Chart";
    if (firstWord === "c4context") return "C4 Diagram";
    if (firstWord === "sankey-beta") return "Sankey";
    if (firstWord === "block-beta") return "Block";
    return firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
  }
  return "Diagram";
}

/**
 * Extract a human-readable title or label from Mermaid diagram code.
 */
export function extractMermaidTitle(code) {
  if (!code) return "Mermaid Diagram";
  const lines = code.split("\n");
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith("%%") && line.replace(/^%%\s*/, "").trim()) {
      return line.replace(/^%%\s*/, "").trim();
    }
    if (/^accTitle:\s*(.+)$/i.test(line)) {
      return line.match(/^accTitle:\s*(.+)$/i)[1].trim();
    }
    if (/^title\s+(.+)$/i.test(line)) {
      return line.match(/^title\s+(.+)$/i)[1].trim();
    }
  }
  return `${detectMermaidType(code)} Diagram`;
}

/**
 * Generate a deterministic hash for a string.
 */
export function hashString(str) {
  let hash = 0;
  const s = String(str || "");
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Normalize an asset path for consistent grouping across different document locations.
 */
export function normalizeAssetPath(rawPath) {
  let p = String(rawPath || "").trim();
  if (p.startsWith("<") && p.endsWith(">")) {
    p = p.slice(1, -1).trim();
  }
  return p.replace(/\\/g, "/").replace(/^\.\//, "");
}

/**
 * Scans all workspace documents and returns catalog of all used diagrams, media, and PDFs.
 * STRICT: Only items with at least one note reference are included.
 *
 * @param {Array} documents - List of documents in workspace ({ filePath, title, content, ... })
 * @returns {Array} Catalog of used items with metadata and references
 */
export function extractWorkspaceUsedAssets(documents = []) {
  if (!Array.isArray(documents)) return [];

  const diagramMap = new Map();
  const fileAssetMap = new Map();

  for (const doc of documents) {
    const filePath = doc?.filePath || doc?.path || "";
    const noteTitle = doc?.title || doc?.name || (filePath ? filePath.split(/[\\/]/).pop()?.replace(/\.md$/i, "") : "Untitled Note");
    const content = String(doc?.content || doc?.searchText || "");
    if (!content) continue;

    const lines = content.split("\n");

    // 1. Scan for inline Mermaid diagrams: ```mermaid ... ```
    const mermaidRegex = /```mermaid\s*([\s\S]*?)```/gi;
    let match;
    while ((match = mermaidRegex.exec(content)) !== null) {
      const rawCode = (match[1] || "").trim();
      if (!rawCode) continue;

      const codeHash = hashString(rawCode);
      const matchIndex = match.index;
      // Determine line number
      const lineNumber = content.substring(0, matchIndex).split("\n").length;
      const diagramType = detectMermaidType(rawCode);
      const title = extractMermaidTitle(rawCode);

      const snippet = rawCode.split("\n").slice(0, 3).join(" ").substring(0, 80);

      const ref = {
        notePath: filePath,
        noteTitle,
        lineNumber,
        snippet: snippet.length >= 80 ? `${snippet}…` : snippet,
      };

      const existing = diagramMap.get(codeHash);
      if (existing) {
        existing.referencedBy.push(ref);
        existing.referenceCount += 1;
      } else {
        diagramMap.set(codeHash, {
          id: `mermaid-${codeHash}`,
          name: title,
          category: "diagram",
          subType: "mermaid",
          diagramType,
          rawCode,
          path: `inline:mermaid/${codeHash}`,
          extension: "mermaid",
          referenceCount: 1,
          referencedBy: [ref],
          createdAt: doc?.updatedAt || null,
        });
      }
    }

    // 2. Scan for markdown media references: ![alt](path) and [label](path)
    const mediaRegex = /(!)?\[([^\]]*)\]\((<[^>]+>|[^)]+)\)/g;
    while ((match = mediaRegex.exec(content)) !== null) {
      const isImageSyntax = Boolean(match[1]);
      const rawAlt = (match[2] || "").trim();
      const rawPath = (match[3] || "").trim();
      const normalizedPath = normalizeAssetPath(rawPath);

      if (!normalizedPath || /^(https?:|data:|blob:|mailto:|#)/i.test(normalizedPath)) {
        continue;
      }

      const matchIndex = match.index;
      const lineNumber = content.substring(0, matchIndex).split("\n").length;
      const contextLine = (lines[lineNumber - 1] || "").trim();

      const ext = (normalizedPath.split(".").pop() || "").toLowerCase();
      const isDiagram = isDiagramReference(normalizedPath) || /draw\.?io|excalidraw/i.test(rawAlt);

      let category = "media";
      let subType = ext || "file";
      let diagramId = null;

      if (isDiagram) {
        category = "diagram";
        if (normalizedPath.includes("draw.io") || normalizedPath.includes("drawio")) {
          subType = "drawio";
          const matchId = normalizedPath.match(/(?:draw\.io|drawio|drawio-diagrams)[\\/]([^/.]+)\.png/i);
          diagramId = matchId ? matchId[1] : (normalizedPath.split("/").pop() || "").replace(/\.png$/i, "");
        } else if (normalizedPath.includes("excalidraw") || normalizedPath.includes("excali")) {
          subType = "excalidraw";
          const parsed = parseDiagramReference(`![${rawAlt}](${rawPath})`);
          diagramId = parsed?.diagramId || null;
          if (!diagramId) {
            const matchId = normalizedPath.match(/(?:excalidraw|excali-diagrams)[\\/]([^/]+)(?:[\\/]diagram\.png|\.png)?/i);
            diagramId = matchId ? matchId[1] : null;
          }
        } else {
          subType = "diagram";
        }
      } else {
        const detectedType = getMediaTypeFromExtension(ext);
        if (detectedType === "pdf") {
          category = "pdf";
          subType = "pdf";
        } else if (detectedType === "image") {
          category = "image";
          subType = ext;
        } else if (detectedType === "video" || detectedType === "audio") {
          category = detectedType;
          subType = ext;
        } else if (detectedType === "document") {
          category = "document";
          subType = ext;
        } else if (isImageSyntax) {
          category = "image";
          subType = ext || "png";
        }
      }

      const fileName = normalizedPath.split("/").pop() || "Media";
      const displayName = rawAlt && rawAlt !== "Image" && rawAlt !== "Media" ? rawAlt : fileName;

      const ref = {
        notePath: filePath,
        noteTitle,
        lineNumber,
        snippet: contextLine.length > 90 ? `${contextLine.slice(0, 90)}…` : contextLine,
      };

      const assetKey = normalizedPath.toLowerCase();
      const existing = fileAssetMap.get(assetKey);
      if (existing) {
        existing.referencedBy.push(ref);
        existing.referenceCount += 1;
        if (!existing.diagramId && diagramId) {
          existing.diagramId = diagramId;
        }
      } else {
        fileAssetMap.set(assetKey, {
          id: `asset-${hashString(assetKey)}`,
          name: displayName,
          fileName,
          category,
          subType,
          diagramId,
          path: normalizedPath,
          rawPath,
          extension: ext,
          isImageSyntax,
          referenceCount: 1,
          referencedBy: [ref],
          createdAt: doc?.updatedAt || null,
        });
      }
    }
  }

  // Combine diagrams and media/PDFs
  const results = [...Array.from(diagramMap.values()), ...Array.from(fileAssetMap.values())];

  // Sort default: most referenced first
  return results.sort((a, b) => b.referenceCount - a.referenceCount);
}

/**
 * Filter and search catalog items.
 */
export function filterAssets(items = [], { searchQuery = "", selectedCategories = {}, selectedSubtypes = {}, usageFilter = "all", sortOrder = "ref-desc" } = {}) {
  let filtered = [...items];

  // Search query
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    filtered = filtered.filter((item) => {
      const nameMatch = item.name.toLowerCase().includes(q);
      const pathMatch = (item.path || "").toLowerCase().includes(q);
      const subTypeMatch = (item.subType || "").toLowerCase().includes(q);
      const categoryMatch = (item.category || "").toLowerCase().includes(q);
      const noteMatch = item.referencedBy.some(
        (ref) => ref.noteTitle.toLowerCase().includes(q) || ref.notePath.toLowerCase().includes(q)
      );
      const codeMatch = item.rawCode ? item.rawCode.toLowerCase().includes(q) : false;
      return nameMatch || pathMatch || subTypeMatch || categoryMatch || noteMatch || codeMatch;
    });
  }

  // Category filter
  if (Object.keys(selectedCategories).length > 0) {
    filtered = filtered.filter((item) => selectedCategories[item.category] !== false);
  }

  // Subtype filter
  if (Object.keys(selectedSubtypes).length > 0) {
    filtered = filtered.filter((item) => selectedSubtypes[item.subType] !== false);
  }

  // Usage filter (e.g. single vs multiple note references)
  if (usageFilter === "single") {
    filtered = filtered.filter((item) => item.referenceCount === 1);
  } else if (usageFilter === "multi") {
    filtered = filtered.filter((item) => item.referenceCount > 1);
  }

  // Sort order
  if (sortOrder === "ref-desc") {
    filtered.sort((a, b) => b.referenceCount - a.referenceCount);
  } else if (sortOrder === "ref-asc") {
    filtered.sort((a, b) => a.referenceCount - b.referenceCount);
  } else if (sortOrder === "name-asc") {
    filtered.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortOrder === "name-desc") {
    filtered.sort((a, b) => b.name.localeCompare(a.name));
  }

  return filtered;
}
