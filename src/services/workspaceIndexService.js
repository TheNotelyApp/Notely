/**
 * Workspace Multi-Level Index Service
 * Hierarchy: Workspace -> Folders -> Documents -> Headers (H1-H6) -> Section Blocks (code/text/tasks)
 */

export function parseDocumentMultiLevelIndex(doc) {
  const docId = doc?.id || doc?.filePath || "doc_" + Math.random().toString(36).substr(2, 9);
  const filePath = doc?.filePath || doc?.path || "";
  const title = doc?.title || doc?.name || (filePath ? filePath.split("/").pop() : "Untitled");
  const content = String(doc?.content || doc?.searchText || "");

  const lines = content.split("\n");
  const flatHeaders = [];
  const rootHeaders = [];
  const headerStack = [];

  let currentCodeLang = "";
  let codeBlockBuffer = [];
  let codeBlockStartLine = 0;
  let inCodeBlock = false;
  let wordCount = 0;
  let taskCount = 0;
  let completedTaskCount = 0;
  let codeBlockCount = 0;

  const tagsSet = new Set();
  if (Array.isArray(doc?.tags)) {
    doc.tags.forEach((t) => tagsSet.add(String(t).toLowerCase()));
  }

  // Extract inline tags #tag
  const inlineTagRegex = /(?:^|\s)#([a-zA-Z0-9_\-/]+)/g;
  let match;
  while ((match = inlineTagRegex.exec(content)) !== null) {
    if (match[1] && !/^\d+$/.test(match[1])) {
      tagsSet.add(match[1].toLowerCase());
    }
  }

  lines.forEach((lineText, idx) => {
    const lineNumber = idx + 1;
    const trimmed = lineText.trim();

    // Word count calculation
    if (trimmed) {
      wordCount += trimmed.split(/\s+/).length;
    }

    // Code block toggle
    if (trimmed.startsWith("```")) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        currentCodeLang = trimmed.slice(3).trim();
        codeBlockStartLine = lineNumber;
        codeBlockBuffer = [];
        codeBlockCount++;
      } else {
        inCodeBlock = false;
        const codeText = codeBlockBuffer.join("\n");
        const lastHeader = headerStack[headerStack.length - 1];
        if (lastHeader) {
          lastHeader.blocks.push({
            type: "code",
            language: currentCodeLang || "plaintext",
            content: codeText,
            line: codeBlockStartLine,
          });
        }
        codeBlockBuffer = [];
      }
      return;
    }

    if (inCodeBlock) {
      codeBlockBuffer.push(lineText);
      return;
    }

    // Check task items
    if (/^[-*+]\s+\[[ xX]\]/.test(trimmed)) {
      taskCount++;
      const isDone = /^[-*+]\s+\[[xX]\]/.test(trimmed);
      if (isDone) completedTaskCount++;
      const taskText = trimmed.replace(/^[-*+]\s+\[[ xX]\]\s*/, "");
      const lastHeader = headerStack[headerStack.length - 1];
      if (lastHeader) {
        lastHeader.blocks.push({
          type: "task",
          completed: isDone,
          content: taskText,
          line: lineNumber,
        });
      }
      return;
    }

    // Header matching: # Header
    const headerMatch = /^#{1,6}\s+(.+)$/.exec(trimmed);
    if (headerMatch) {
      const hashes = trimmed.match(/^#+/)[0];
      const level = hashes.length;
      const text = headerMatch[1].replace(/#+\s*$/, "").trim();
      const headerId = `${docId}_h_${lineNumber}_${flatHeaders.length}`;

      const headerNode = {
        id: headerId,
        docId,
        docTitle: title,
        filePath,
        level,
        text,
        line: lineNumber,
        parentId: null,
        children: [],
        blocks: [],
      };

      // Stack navigation to maintain parent-child hierarchy
      while (headerStack.length > 0 && headerStack[headerStack.length - 1].level >= level) {
        headerStack.pop();
      }

      if (headerStack.length > 0) {
        const parent = headerStack[headerStack.length - 1];
        headerNode.parentId = parent.id;
        parent.children.push(headerNode);
      } else {
        rootHeaders.push(headerNode);
      }

      headerStack.push(headerNode);
      flatHeaders.push(headerNode);
      return;
    }

    // Text content under active header
    if (trimmed && headerStack.length > 0) {
      const activeHeader = headerStack[headerStack.length - 1];
      const lastBlock = activeHeader.blocks[activeHeader.blocks.length - 1];
      if (lastBlock && lastBlock.type === "text" && lastBlock.content.length < 300) {
        lastBlock.content += " " + trimmed;
      } else {
        activeHeader.blocks.push({
          type: "text",
          content: trimmed,
          line: lineNumber,
        });
      }
    }
  });

  return {
    docId,
    filePath,
    title,
    tags: Array.from(tagsSet),
    wordCount,
    taskCount,
    completedTaskCount,
    codeBlockCount,
    headers: rootHeaders,
    flatHeaders,
  };
}

export function buildWorkspaceIndex(documents = []) {
  const documentsMap = {};
  const folderTree = { name: "Root", path: "", type: "folder", children: {} };
  const tagMap = {};
  let totalWordCount = 0;
  let totalHeaderCount = 0;
  let totalCodeBlockCount = 0;
  let totalTaskCount = 0;
  let totalCompletedTaskCount = 0;

  documents.forEach((doc) => {
    const indexedDoc = parseDocumentMultiLevelIndex(doc);
    documentsMap[indexedDoc.docId] = indexedDoc;

    totalWordCount += indexedDoc.wordCount;
    totalHeaderCount += indexedDoc.flatHeaders.length;
    totalCodeBlockCount += indexedDoc.codeBlockCount;
    totalTaskCount += indexedDoc.taskCount;
    totalCompletedTaskCount += indexedDoc.completedTaskCount;

    // Build Tag Map
    indexedDoc.tags.forEach((tag) => {
      if (!tagMap[tag]) tagMap[tag] = [];
      tagMap[tag].push(indexedDoc.docId);
    });

    // Build Folder Tree
    const parts = (indexedDoc.filePath || indexedDoc.title).split("/").filter(Boolean);
    let curr = folderTree;
    for (let i = 0; i < parts.length - 1; i++) {
      const folderName = parts[i];
      if (!curr.children[folderName]) {
        curr.children[folderName] = {
          name: folderName,
          path: parts.slice(0, i + 1).join("/"),
          type: "folder",
          children: {},
        };
      }
      curr = curr.children[folderName];
    }
    const fileName = parts.length > 0 ? parts[parts.length - 1] : indexedDoc.title;
    curr.children[fileName] = {
      name: fileName,
      path: indexedDoc.filePath,
      type: "file",
      docId: indexedDoc.docId,
      indexedDoc,
    };
  });

  return {
    documentsMap,
    folderTree,
    tagMap,
    stats: {
      totalDocuments: documents.length,
      totalHeaders: totalHeaderCount,
      totalWordCount,
      totalCodeBlocks: totalCodeBlockCount,
      totalTasks: totalTaskCount,
      totalCompletedTasks: totalCompletedTaskCount,
      totalTags: Object.keys(tagMap).length,
    },
  };
}

export function searchMultiLevelIndex(workspaceIndex, query = "", options = {}) {
  const { maxDepth = 6, filterTag = null } = options;
  const needle = query.trim().toLowerCase();
  if (!workspaceIndex || !workspaceIndex.documentsMap) return [];

  const results = [];

  Object.values(workspaceIndex.documentsMap).forEach((docIndex) => {
    if (filterTag && !docIndex.tags.includes(filterTag.toLowerCase())) {
      return;
    }

    const docTitleMatches = docIndex.title.toLowerCase().includes(needle);
    const docPathMatches = docIndex.filePath.toLowerCase().includes(needle);

    docIndex.flatHeaders.forEach((header) => {
      if (header.level > maxDepth) return;

      const headerTextMatches = header.text.toLowerCase().includes(needle);
      const matchingBlocks = header.blocks.filter((b) => {
        if (!needle) return true;
        return b.content.toLowerCase().includes(needle);
      });

      if (!needle || docTitleMatches || docPathMatches || headerTextMatches || matchingBlocks.length > 0) {
        results.push({
          docId: docIndex.docId,
          docTitle: docIndex.title,
          filePath: docIndex.filePath,
          header,
          matchedBlocks: matchingBlocks,
          matchType: headerTextMatches
            ? "header"
            : docTitleMatches
            ? "document"
            : matchingBlocks.length > 0
            ? "content"
            : "file",
        });
      }
    });
  });

  return results;
}
