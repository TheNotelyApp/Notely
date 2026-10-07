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
 * Strips angle brackets, title quotes, query/hashes, and decodes URI entities.
 */
export function normalizeAssetPath(rawPath) {
  let p = String(rawPath || "").trim();
  if (!p) return "";

  // 1. Strip angle brackets: <images/pic.png>
  if (p.startsWith("<") && p.endsWith(">")) {
    p = p.slice(1, -1).trim();
  }

  // 2. Strip title quote suffixes: "images/pic.png \"My Title\"" -> images/pic.png
  p = p.replace(/\s+["'][^"']*["']\s*$/, "").trim();

  // 3. Strip query parameters and hash fragments (e.g. ?v=1 or #page=2)
  p = p.split("?")[0].split("#")[0].trim();

  // 4. Repeated URI decoding for paths with %20 spaces or symbols
  for (let i = 0; i < 3; i++) {
    try {
      const decoded = decodeURIComponent(p);
      if (decoded === p) break;
      p = decoded;
    } catch {
      break;
    }
  }

  // 5. Normalize path separators to forward slash and strip leading ./ and ../
  const normalized = p.replace(/\\/g, "/").replace(/^\.\//, "");
  return normalized.replace(/^(\.\.\/)+/, "");
}

/**
 * Scans all workspace documents and returns catalog of all used diagrams, media, and PDFs.
 * Supports standard Markdown, Wikilinks (![[...]], [[...]]), HTML media tags, and Mermaid blocks.
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
          fileName: `${title}.mermaid`,
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

    const processMediaCandidate = ({ rawPath, rawAlt, isImageSyntax, matchIndex }) => {
      const normalizedPath = normalizeAssetPath(rawPath);
      if (!normalizedPath || /^(https?:|data:|blob:|mailto:|#)/i.test(normalizedPath)) {
        return;
      }

      const lineNumber = content.substring(0, matchIndex).split("\n").length;
      const contextLine = (lines[lineNumber - 1] || "").trim();

      const lastSegment = (normalizedPath.split("/").pop() || "").split("?")[0].split("#")[0];
      const hasDot = lastSegment.includes(".") && !lastSegment.startsWith(".");
      const ext = hasDot ? (lastSegment.split(".").pop() || "").toLowerCase().slice(0, 10) : "";
      const isDiagram = isDiagramReference(normalizedPath) ||
        /draw\.?io|excalidraw|wireframe|prototype/i.test(rawAlt) ||
        /media\/(wireframes|draw\.io|excalidraw|diagrams)/i.test(normalizedPath) ||
        /excali-diagrams|drawio-diagrams/i.test(normalizedPath) ||
        /\.wireframe\.json$/i.test(normalizedPath) ||
        /\.excalidraw$/i.test(normalizedPath) ||
        /\.drawio$/i.test(normalizedPath);

      // Skip markdown note references (.md, .markdown) and extensionless wikilinks to notes
      // Note-to-note references belong to the knowledge graph / backlinks, not Diagrams & Media
      if (ext === "md" || ext === "markdown" || (!isImageSyntax && !hasDot && !isDiagram)) {
        return;
      }

      let category = "document";
      let subType = ext || "link";
      let diagramId = null;

      if (isDiagram) {
        category = "diagram";
        if (normalizedPath.includes("draw.io") || normalizedPath.includes("drawio") || ext === "drawio") {
          subType = "drawio";
          const matchId = normalizedPath.match(/(?:draw\.io|drawio|drawio-diagrams)[\\/]([^/.]+)/i);
          diagramId = matchId ? matchId[1].replace(/\.(?:drawio|png|svg|xml)$/i, "") : (normalizedPath.split("/").pop() || "").replace(/\.(?:drawio|png|svg|xml)$/i, "");
        } else if (normalizedPath.includes("excalidraw") || normalizedPath.includes("excali") || ext === "excalidraw") {
          subType = "excalidraw";
          const parsed = parseDiagramReference(`![${rawAlt}](${rawPath})`);
          diagramId = parsed?.diagramId || null;
          if (!diagramId) {
            const matchId = normalizedPath.match(/(?:excalidraw|excali-diagrams)[\\/]([^/]+)(?:[\\/]diagram\.(?:png|excalidraw|svg)|\.png|\.excalidraw)?/i);
            diagramId = matchId ? matchId[1].replace(/\.(?:excalidraw|png|svg)$/i, "") : null;
          }
        } else if (normalizedPath.includes("wireframe") || /\.wireframe\.json$/i.test(normalizedPath) || /wireframe|prototype/i.test(rawAlt)) {
          category = "wireframe";
          subType = "wireframe";
          const matchId = normalizedPath.match(/(?:wireframe|wireframes)[\\/]([^/.]+)/i);
          diagramId = matchId ? matchId[1].replace(/\.(?:wireframe\.json|png|svg|json)$/i, "") : (normalizedPath.split("/").pop() || "").replace(/\.(?:wireframe\.json|png|svg|json)$/i, "");
        } else {
          subType = "diagram";
        }
      } else {
        const detectedType = ext ? getMediaTypeFromExtension(ext, normalizedPath) : null;
        if (detectedType) {
          category = detectedType;
          subType = ext;
        } else if (isImageSyntax) {
          category = "image";
          subType = ext || "image";
        } else {
          category = "document";
          subType = ext || "link";
        }
      }

      // Check if it's a transcript file
      if (ext === "json" && (/[/\\]audio[/\\]/i.test(normalizedPath) || /transcript/i.test(normalizedPath) || /transcript/i.test(rawAlt))) {
        category = "transcript";
        subType = "json";
      }

      let fileName = normalizedPath.split("/").pop() || "Media";
      if (category === "wireframe" && diagramId) {
        fileName = `${diagramId}.wireframe.json`;
      } else if (subType === "drawio" && diagramId) {
        fileName = `${diagramId}.drawio`;
      } else if (subType === "excalidraw" && diagramId) {
        fileName = `${diagramId}.excalidraw`;
      }

      const isGenericAlt = ["Image", "Media", "Wireframe Diagram", "Drawio Diagram", "Excalidraw Diagram", "Diagram"].includes(rawAlt);
      const displayName = rawAlt && !isGenericAlt ? rawAlt : (diagramId || fileName);

      const ref = {
        notePath: filePath,
        noteTitle,
        lineNumber,
        snippet: contextLine.length > 90 ? `${contextLine.slice(0, 90)}…` : contextLine,
      };

      const assetKey = diagramId ? `diag:${category}:${diagramId.toLowerCase()}` : normalizedPath.toLowerCase();
      const isPreviewImg = isDiagram && ["png", "svg", "webp"].includes(ext);
      const existing = fileAssetMap.get(assetKey);
      if (existing) {
        existing.referencedBy.push(ref);
        existing.referenceCount += 1;
        if (!existing.diagramId && diagramId) {
          existing.diagramId = diagramId;
        }
        if (isPreviewImg && !existing.previewPath) {
          existing.previewPath = normalizedPath;
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
          previewPath: isPreviewImg ? normalizedPath : null,
          rawPath,
          extension: ext,
          isImageSyntax,
          referenceCount: 1,
          referencedBy: [ref],
          createdAt: doc?.updatedAt || null,
        });
      }
    };

    // 2. Scan standard markdown media references: ![alt](path "title") and [label](path)
    const mediaRegex = /(!)?\[([^\]]*)\]\((<[^>]+>|[^)]+)\)/g;
    while ((match = mediaRegex.exec(content)) !== null) {
      processMediaCandidate({
        rawPath: match[3] || "",
        rawAlt: (match[2] || "").trim(),
        isImageSyntax: Boolean(match[1]),
        matchIndex: match.index,
      });
    }

    // 3. Scan Obsidian-style Wikilinks: ![[path|alt]] and [[path|alt]]
    const wikilinkRegex = /(!)?\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
    while ((match = wikilinkRegex.exec(content)) !== null) {
      const isImage = Boolean(match[1]);
      const rawTarget = (match[2] || "").trim();
      const rawLabel = (match[3] || "").trim();
      processMediaCandidate({
        rawPath: rawTarget,
        rawAlt: rawLabel,
        isImageSyntax: isImage,
        matchIndex: match.index,
      });
    }

    // 4. Scan HTML media tags: <img src="...">, <video src="...">, <audio src="...">, <source src="...">
    const htmlTagRegex = /<(?:img|audio|video|source)\b([^>]*)\bsrc=["']([^"']+)["']([^>]*)>/gi;
    while ((match = htmlTagRegex.exec(content)) !== null) {
      const beforeAttrs = match[1] || "";
      const src = match[2] || "";
      const afterAttrs = match[3] || "";
      const combinedAttrs = `${beforeAttrs} ${afterAttrs}`;
      const altMatch = combinedAttrs.match(/\balt=["']([^"']+)["']/i);
      const titleMatch = combinedAttrs.match(/\btitle=["']([^"']+)["']/i);
      const rawAlt = altMatch ? altMatch[1].trim() : (titleMatch ? titleMatch[1].trim() : "");
      processMediaCandidate({
        rawPath: src,
        rawAlt,
        isImageSyntax: true,
        matchIndex: match.index,
      });
    }
  }

  // Combine diagrams and media/PDFs
  const results = [...Array.from(diagramMap.values()), ...Array.from(fileAssetMap.values())];
  autoLinkAudioAndTranscripts(results);

  // Sort default: most referenced first
  return results.sort((a, b) => b.referenceCount - a.referenceCount);
}

/**
 * Automatically link companion audio/video files with transcripts.
 * Pairs assets where transcript name matches audio base name or sourceMedia reference.
 */
export function autoLinkAudioAndTranscripts(assets = []) {
  if (!Array.isArray(assets) || assets.length === 0) return;

  const audioFiles = assets.filter((a) => a.category === "audio" || a.category === "video");
  const transcripts = assets.filter((a) => a.category === "transcript" || a.subType === "transcript");

  for (const audio of audioFiles) {
    const audioDir = audio.path ? audio.path.replace(/\\/g, "/").substring(0, audio.path.lastIndexOf("/")) : "";
    const audioBaseName = (audio.fileName || audio.name || "").replace(/\.[^/.]+$/, "").toLowerCase();
    const audioPathNorm = (audio.path || "").toLowerCase();

    for (const tr of transcripts) {
      const trDir = tr.path ? tr.path.replace(/\\/g, "/").substring(0, tr.path.lastIndexOf("/")) : "";
      const sameFolder = audioDir && trDir && audioDir.toLowerCase() === trDir.toLowerCase();

      const trBaseName = (tr.fileName || tr.name || "")
        .replace(/_transcript\.json$/i, "")
        .replace(/\.transcript\.json$/i, "")
        .replace(/\.json$/i, "")
        .toLowerCase();
      const trPathNorm = (tr.path || "").toLowerCase();

      const nameMatch = audioBaseName && (audioBaseName === trBaseName || audioBaseName.includes(trBaseName) || trBaseName.includes(audioBaseName));
      const pathMatch = trPathNorm.includes(audioBaseName) || audioPathNorm.includes(trBaseName);

      if (sameFolder || nameMatch || pathMatch) {
        audio.linkedTranscriptId = tr.id;
        audio.linkedTranscriptPath = tr.path;
        audio.linkedTranscriptName = tr.name;

        tr.linkedAudioId = audio.id;
        tr.linkedAudioPath = audio.path;
        tr.linkedAudioName = audio.name;
        break;
      }
    }
  }
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
      const fileNameMatch = item.fileName ? item.fileName.toLowerCase().includes(q) : false;
      const pathMatch = (item.path || "").toLowerCase().includes(q);
      const subTypeMatch = (item.subType || "").toLowerCase().includes(q);
      const categoryMatch = (item.category || "").toLowerCase().includes(q);
      const noteMatch = item.referencedBy.some(
        (ref) => ref.noteTitle.toLowerCase().includes(q) || ref.notePath.toLowerCase().includes(q)
      );
      const codeMatch = item.rawCode ? item.rawCode.toLowerCase().includes(q) : false;
      return nameMatch || fileNameMatch || pathMatch || subTypeMatch || categoryMatch || noteMatch || codeMatch;
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

  // Usage filter (e.g. single vs multiple note references, or unused orphans)
  if (usageFilter === "single") {
    filtered = filtered.filter((item) => item.referenceCount === 1);
  } else if (usageFilter === "multi") {
    filtered = filtered.filter((item) => item.referenceCount > 1);
  } else if (usageFilter === "unused") {
    filtered = filtered.filter((item) => (item.referenceCount || 0) === 0);
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

/**
 * Merges physical media files found on disk with catalog assets discovered from note references.
 * Physical disk files that are not referenced by any document are added with referenceCount: 0.
 *
 * @param {Array} usedAssets - Catalog from extractWorkspaceUsedAssets()
 * @param {Array} diskFiles - Array of { path, name, ext, size, mtime } from listDiskMediaAssets()
 * @returns {Array} Combined catalog containing used and unused media assets
 */
export function mergeDiskMediaIntoCatalog(usedAssets = [], diskFiles = []) {
  if (!Array.isArray(diskFiles) || diskFiles.length === 0) {
    return usedAssets;
  }

  const results = [...usedAssets];
  const knownPaths = new Set(
    usedAssets.map((a) => normalizeAssetPath(a.path).toLowerCase())
  );
  const knownFileNames = new Set(
    usedAssets.map((a) => (a.fileName || a.name).toLowerCase())
  );
  const knownNames = new Set(
    usedAssets.map((a) => a.name.toLowerCase())
  );
  const knownDiagramIds = new Set(
    usedAssets.filter((a) => a.diagramId).map((a) => a.diagramId.toLowerCase())
  );

  for (const file of diskFiles) {
    const norm = normalizeAssetPath(file.path).toLowerCase();
    const diskFileName = (file.name || "").toLowerCase();
    const ext = (file.ext || "").toLowerCase();

    // Skip markdown notes
    if (ext === "md" || ext === "markdown") {
      continue;
    }

    // Check if this file is a diagram or rendered diagram preview
    const isDiagramFile =
      file.path.includes("wireframe") ||
      file.name.includes("wireframe") ||
      file.path.endsWith(".wireframe.json") ||
      file.path.includes("drawio") ||
      file.path.includes("draw.io") ||
      file.path.includes("excalidraw") ||
      file.path.includes("excali-diagrams") ||
      file.path.includes("drawio-diagrams") ||
      isDiagramReference(file.path) ||
      ext === "excalidraw" ||
      ext === "drawio";

    let diagramCategory = null;
    let diagramSubType = null;
    let diagramId = null;

    if (isDiagramFile) {
      if (file.path.includes("wireframe") || file.name.includes("wireframe") || file.path.endsWith(".wireframe.json")) {
        diagramCategory = "wireframe";
        diagramSubType = "wireframe";
        const matchId = file.path.match(/(?:wireframe|wireframes)[\\/]([^/.]+)/i);
        diagramId = matchId ? matchId[1].replace(/\.(?:wireframe\.json|png|svg|json)$/i, "") : file.name.replace(/\.(?:wireframe\.json|png|svg|json)$/i, "");
      } else if (file.path.includes("draw.io") || file.path.includes("drawio") || ext === "drawio") {
        diagramCategory = "diagram";
        diagramSubType = "drawio";
        const matchId = file.path.match(/(?:draw\.io|drawio|drawio-diagrams)[\\/]([^/.]+)/i);
        diagramId = matchId ? matchId[1].replace(/\.(?:drawio|png|svg|xml)$/i, "") : file.name.replace(/\.(?:drawio|png|svg|xml)$/i, "");
      } else if (file.path.includes("excalidraw") || file.path.includes("excali") || ext === "excalidraw") {
        diagramCategory = "diagram";
        diagramSubType = "excalidraw";
        const matchId = file.path.match(/(?:excalidraw|excali-diagrams)[\\/]([^/]+)(?:[\\/]diagram\.(?:png|excalidraw|svg)|\.png|\.excalidraw)?/i);
        diagramId = matchId ? matchId[1].replace(/\.(?:excalidraw|png|svg)$/i, "") : file.name.replace(/\.(?:excalidraw|png|svg)$/i, "");
      }
    }

    // 1. If this is a diagram file and diagramId is already known in results:
    if (diagramId && knownDiagramIds.has(diagramId.toLowerCase())) {
      const existingDiagram = results.find(
        (a) => a.diagramId && a.diagramId.toLowerCase() === diagramId.toLowerCase()
      );
      if (existingDiagram) {
        if (!existingDiagram.size && file.size) existingDiagram.size = file.size;
        if (!existingDiagram.createdAt && file.mtime) existingDiagram.createdAt = file.mtime;
        if (["png", "svg", "webp"].includes(ext)) {
          existingDiagram.previewPath = file.path;
        } else if (["excalidraw", "drawio", "json"].includes(ext)) {
          existingDiagram.diskPath = file.path;
        }
      }
      continue;
    }

    // 2. Check if this disk file is already matched to a referenced asset
    const existingAsset = results.find((a) => {
      const assetNorm = normalizeAssetPath(a.path).toLowerCase();
      const assetFileName = (a.fileName || a.name || "").toLowerCase();
      return (
        assetNorm === norm ||
        assetNorm.endsWith(`/${diskFileName}`) ||
        assetNorm === diskFileName ||
        assetFileName === diskFileName ||
        (a.diagramId && diagramId && a.diagramId.toLowerCase() === diagramId.toLowerCase())
      );
    });

    if (existingAsset) {
      // Enrich existing used asset with disk file metadata
      if (!existingAsset.size && file.size) existingAsset.size = file.size;
      if (!existingAsset.createdAt && file.mtime) existingAsset.createdAt = file.mtime;
      if (!existingAsset.diskPath) existingAsset.diskPath = file.path;
      if (["png", "svg", "webp"].includes(ext) && !existingAsset.previewPath) {
        existingAsset.previewPath = file.path;
      }
      continue;
    }

    if (knownPaths.has(norm) || knownFileNames.has(diskFileName) || knownNames.has(diskFileName)) {
      continue;
    }

    // Determine category
    let category = diagramCategory || getMediaTypeFromExtension(file.ext, file.path) || "document";
    let subType = diagramSubType || file.ext || "file";

    if (file.ext === "webm" && file.path.toLowerCase().includes("recordings")) {
      category = "video";
    }

    // Identify transcripts on disk
    if (file.ext === "json" && (file.path.toLowerCase().includes("audio") || file.name.toLowerCase().includes("transcript"))) {
      category = "transcript";
      subType = "json";
    }

    let fileName = file.name;
    let displayName = file.name;
    if (diagramCategory) {
      if (diagramSubType === "wireframe") {
        fileName = `${diagramId}.wireframe.json`;
        displayName = diagramId;
      } else if (diagramSubType === "drawio") {
        fileName = `${diagramId}.drawio`;
        displayName = diagramId;
      } else if (diagramSubType === "excalidraw") {
        fileName = `${diagramId}.excalidraw`;
        displayName = diagramId;
      }
    }

    results.push({
      id: `disk-${hashString(file.path)}`,
      name: displayName,
      fileName,
      path: file.path,
      previewPath: (diagramCategory && ["png", "svg", "webp"].includes(ext)) ? file.path : null,
      category,
      subType,
      diagramId,
      extension: file.ext,
      referenceCount: 0,
      referencedBy: [],
      isUnused: true,
      size: file.size || 0,
      createdAt: file.mtime || null,
    });

    if (diagramId) {
      knownDiagramIds.add(diagramId.toLowerCase());
    }
    knownPaths.add(norm);
    knownFileNames.add(diskFileName);
    knownNames.add(file.name.toLowerCase());
  }

  autoLinkAudioAndTranscripts(results);
  return results;
}
