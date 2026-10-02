import React, { useState, useEffect, useMemo } from "react";
import {
  Search, Folder, FileText, ChevronRight, ChevronDown,
  Hash, Layers, ExternalLink, Filter, Tag, X,
  Code, ChevronsUpDown, Minimize2
} from "lucide-react";
import { buildWorkspaceIndex, searchMultiLevelIndex } from "../services/workspaceIndexService";
import { listWorkspaceTaskDocuments, listDocuments } from "../services/electronService";
import { MarkdownPreview } from "./MarkdownPreview";
import SubpageHeader from "./layout/SubpageHeader";
import AppButton from "./AppButton";

function buildSectionMarkdown(header) {
  if (!header) return "";
  let md = "#".repeat(header.level) + " " + header.text + "\n\n";
  if (Array.isArray(header.blocks) && header.blocks.length > 0) {
    header.blocks.forEach((block) => {
      if (block.type === "code") {
        md += "```" + (block.language || "") + "\n" + block.content + "\n```\n\n";
      } else if (block.type === "task") {
        md += "- [" + (block.completed ? "x" : " ") + "] " + block.content + "\n";
      } else if (block.type === "text") {
        md += block.content + "\n\n";
      }
    });
  }
  return md;
}

function getBreadcrumbSegments(activeHeader, selectedDocId, indexData) {
  if (!indexData) return [];
  const docId = activeHeader ? activeHeader.docId : selectedDocId;
  if (!docId) return [];
  const doc = indexData.documentsMap[docId];
  const segments = [];

  if (doc) {
    const rawPath = doc.relativePath || doc.title || (doc.filePath ? doc.filePath.split(/[/\\]/).pop() : "Untitled");
    const parts = rawPath.split(/[/\\]/).filter(Boolean);
    parts.forEach((p) => segments.push(p));
  }

  if (activeHeader) {
    // Trace parent headers
    const headerChain = [];
    let curr = activeHeader;
    while (curr) {
      headerChain.unshift("#".repeat(curr.level) + " " + curr.text);
      curr = curr.parentId ? (doc?.flatHeaders?.find((h) => h.id === curr.parentId) || null) : null;
    }
    return [...segments, ...headerChain];
  }

  return segments;
}

export function WorkspaceIndexPage({
  documents = [],
  workspacePath = "",
  onBack,
  onSelectHeader,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState(null);
  const [maxDepth, setMaxDepth] = useState(6);
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [selectedHeaderId, setSelectedHeaderId] = useState(null);
  const [allWorkspaceDocs, setAllWorkspaceDocs] = useState([]);

  // Fetch full workspace notes across all subfolders recursively
  useEffect(() => {
    let cancelled = false;
    async function loadAllNotes() {
      try {
        let docs = [];
        if (typeof listWorkspaceTaskDocuments === "function") {
          docs = await listWorkspaceTaskDocuments();
        }
        if (!docs || docs.length === 0) {
          if (typeof listDocuments === "function") {
            const visited = new Set();
            const seenFiles = new Set();
            const queue = ["ROOT"];
            const collected = [];

            while (queue.length > 0) {
              const nextFolder = queue.shift();
              const folderArg = nextFolder === "ROOT" ? (workspacePath || undefined) : nextFolder;
              const entries = await listDocuments(
                typeof folderArg === "string" ? { folderPath: folderArg } : folderArg
              );

              for (const entry of entries || []) {
                const key = String(entry?.filePath || "").toLowerCase();
                if (!key) continue;
                if (entry?.entryType === "folder" || entry?.isFolder || entry?.isDirectory) {
                  if (visited.has(key)) continue;
                  visited.add(key);
                  queue.push(entry.filePath);
                  collected.push(entry);
                  continue;
                }
                if (seenFiles.has(key)) continue;
                seenFiles.add(key);
                collected.push(entry);
              }
            }
            docs = collected;
          }
        }

        if (!cancelled && Array.isArray(docs) && docs.length > 0) {
          setAllWorkspaceDocs(docs);
        }
      } catch (err) {
        console.error("Failed to load workspace documents for index:", err);
      }
    }

    loadAllNotes();
    return () => {
      cancelled = true;
    };
  }, [workspacePath]);

  // Combine fetched recursive workspace documents with in-memory documents
  const activeDocuments = useMemo(() => {
    if (allWorkspaceDocs.length > 0) {
      const map = new Map();
      allWorkspaceDocs.forEach((d) => {
        const key = String(d.filePath || d.id || "").toLowerCase();
        if (key) map.set(key, d);
      });
      (documents || []).forEach((d) => {
        const key = String(d.filePath || d.id || "").toLowerCase();
        if (key) {
          if (map.has(key)) {
            map.set(key, { ...map.get(key), ...d });
          } else {
            map.set(key, d);
          }
        }
      });
      return Array.from(map.values());
    }
    return documents;
  }, [allWorkspaceDocs, documents]);

  // Tree nodes start collapsed by default
  const [expandedFolders, setExpandedFolders] = useState({});
  const [expandedDocs, setExpandedDocs] = useState({});
  const [expandedHeaders, setExpandedHeaders] = useState({});

  // Build full multi-level workspace index
  const indexData = useMemo(() => {
    return buildWorkspaceIndex(activeDocuments, { workspacePath });
  }, [activeDocuments, workspacePath]);

  // Execute multi-level search
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() && !selectedTag) return null;
    return searchMultiLevelIndex(indexData, searchQuery, {
      maxDepth,
      filterTag: selectedTag,
    });
  }, [indexData, searchQuery, selectedTag, maxDepth]);

  // Flattened header lookup map for selection
  const flatHeaderMap = useMemo(() => {
    const map = {};
    Object.values(indexData.documentsMap).forEach((docIndex) => {
      docIndex.flatHeaders.forEach((h) => {
        map[h.id] = h;
      });
    });
    return map;
  }, [indexData]);

  const activeHeader = selectedHeaderId ? flatHeaderMap[selectedHeaderId] : null;

  const activeDoc = useMemo(() => {
    if (activeHeader) return indexData.documentsMap[activeHeader.docId] || null;
    if (selectedDocId) return indexData.documentsMap[selectedDocId] || null;
    return null;
  }, [activeHeader, selectedDocId, indexData]);

  // Assembled Markdown for Section / Note Inspector
  const activeContent = useMemo(() => {
    if (activeHeader) return buildSectionMarkdown(activeHeader);
    if (activeDoc) return activeDoc.content || "";
    return "";
  }, [activeHeader, activeDoc]);

  const breadcrumbSegments = useMemo(() => {
    return getBreadcrumbSegments(activeHeader, selectedDocId, indexData);
  }, [activeHeader, selectedDocId, indexData]);

  const toggleFolder = (path) => {
    setExpandedFolders((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const toggleDoc = (docId) => {
    setExpandedDocs((prev) => ({ ...prev, [docId]: !prev[docId] }));
  };

  const toggleHeaderNode = (headerId) => {
    setExpandedHeaders((prev) => ({ ...prev, [headerId]: !prev[headerId] }));
  };

  const handleExpandAll = () => {
    const folders = {};
    const docs = {};
    const headers = {};

    const traverseFolder = (node) => {
      if (node.type === "file") {
        const doc = node.indexedDoc;
        docs[doc.docId] = true;
        doc.flatHeaders.forEach((h) => {
          headers[h.id] = true;
        });
      } else {
        if (node.path) folders[node.path] = true;
        Object.values(node.children || {}).forEach(traverseFolder);
      }
    };

    traverseFolder(indexData.folderTree);
    setExpandedFolders(folders);
    setExpandedDocs(docs);
    setExpandedHeaders(headers);
  };

  const handleCollapseAll = () => {
    setExpandedFolders({});
    setExpandedDocs({});
    setExpandedHeaders({});
  };

  // Render Multi-Level Header Tree (Only show chevron if header has children!)
  const renderHeaderTree = (headerList, indentLevel = 0) => {
    return headerList.map((header) => {
      if (header.level > maxDepth) return null;
      const isSelected = header.id === selectedHeaderId;
      const hasChildren = Array.isArray(header.children) && header.children.length > 0;
      const isExpanded = Boolean(searchQuery.trim() || selectedTag || expandedHeaders[header.id]);

      return (
        <div key={header.id} style={{ marginLeft: `${indentLevel * 10}px` }}>
          <div
            onClick={() => {
              setSelectedHeaderId(header.id);
              setSelectedDocId(header.docId);
            }}
            className="workspace-index-tree-item"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "2px 5px",
              borderRadius: "var(--radius-md, 3px)",
              cursor: "pointer",
              fontSize: "11px",
              background: isSelected ? "var(--surface-accent, rgba(59, 130, 246, 0.15))" : "transparent",
              color: isSelected ? "var(--accent-solid)" : "var(--text-color)",
              fontWeight: header.level <= 2 ? "600" : "400",
              borderLeft: isSelected ? "2px solid var(--accent-solid)" : "2px solid transparent",
              transition: "background 0.15s ease",
            }}
          >
            <span
              onClick={hasChildren ? (e) => {
                e.stopPropagation();
                toggleHeaderNode(header.id);
              } : undefined}
              style={{
                width: "14px",
                height: "14px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                cursor: hasChildren ? "pointer" : "default",
                opacity: hasChildren ? 0.7 : 0,
              }}
            >
              {hasChildren ? (isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />) : null}
            </span>
            <span
              style={{
                width: "14px",
                height: "14px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Hash size={12} style={{ opacity: 0.5, color: isSelected ? "var(--accent-solid)" : "currentColor" }} />
            </span>
            <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {header.text}
            </span>
            <span style={{ fontSize: "10px", opacity: 0.4, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>L{header.line}</span>
            {header.blocks.length > 0 && (
              <span
                style={{
                  fontSize: "9px",
                  padding: "1px 4px",
                  borderRadius: "8px",
                  background: "var(--surface-muted)",
                  opacity: 0.6,
                  flexShrink: 0,
                }}
              >
                {header.blocks.length}
              </span>
            )}
          </div>
          {hasChildren && isExpanded && (
            <div style={{ borderLeft: "1px dashed var(--border-soft)", marginLeft: "7px", paddingLeft: "2px" }}>
              {renderHeaderTree(header.children, indentLevel + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  // Render Multi-Level Folder/File Tree (Only show chevron if items have subitems!)
  const renderFolderNode = (node, key = "") => {
    if (node.type === "file") {
      const doc = node.indexedDoc;
      const hasHeaders = Array.isArray(doc.headers) && doc.headers.length > 0;
      const isDocExpanded = Boolean(searchQuery.trim() || selectedTag || expandedDocs[doc.docId]);
      const isFileSelected = doc.docId === selectedDocId && !selectedHeaderId;

      return (
        <div key={doc.docId} style={{ marginBottom: "1px" }}>
          <div
            onClick={() => {
              setSelectedDocId(doc.docId);
              setSelectedHeaderId(null);
              if (hasHeaders) {
                toggleDoc(doc.docId);
              }
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "3px 6px",
              borderRadius: "var(--radius-md, 4px)",
              cursor: "pointer",
              fontSize: "11px",
              fontWeight: isFileSelected ? "600" : "500",
              background: isFileSelected ? "var(--surface-accent, rgba(59, 130, 246, 0.15))" : "transparent",
              color: isFileSelected ? "var(--accent-solid)" : "var(--text-color)",
              borderLeft: isFileSelected ? "2px solid var(--accent-solid)" : "2px solid transparent",
              transition: "background 0.15s ease",
            }}
            className="workspace-index-tree-item"
          >
            <span
              onClick={hasHeaders ? (e) => {
                e.stopPropagation();
                toggleDoc(doc.docId);
              } : undefined}
              style={{
                width: "14px",
                height: "14px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                cursor: hasHeaders ? "pointer" : "default",
                opacity: hasHeaders ? 0.7 : 0,
              }}
            >
              {hasHeaders ? (isDocExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />) : null}
            </span>
            <span
              style={{
                width: "14px",
                height: "14px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <FileText size={12} style={{ color: "var(--accent-solid)" }} />
            </span>
            <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {doc.title}
            </span>
            <span style={{ fontSize: "10px", opacity: 0.45, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{doc.flatHeaders.length} headers</span>
          </div>
          {hasHeaders && isDocExpanded && (
            <div style={{ marginTop: "1px", paddingLeft: "6px" }}>
              {renderHeaderTree(doc.headers)}
            </div>
          )}
        </div>
      );
    }

    const childEntries = Object.values(node.children || {});
    const hasChildren = childEntries.length > 0;
    const isFolderExpanded = Boolean(searchQuery.trim() || selectedTag || expandedFolders[node.path]);

    return (
      <div key={node.path || key} style={{ marginBottom: "1px" }}>
        {node.name !== "Root" && (
          <div
            onClick={() => hasChildren && toggleFolder(node.path)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "3px 6px",
              borderRadius: "var(--radius-md, 4px)",
              cursor: "pointer",
              fontSize: "11px",
              fontWeight: "600",
              color: "var(--text-strong)",
              transition: "background 0.15s ease",
            }}
            className="workspace-index-tree-item"
          >
            <span
              onClick={hasChildren ? (e) => {
                e.stopPropagation();
                toggleFolder(node.path);
              } : undefined}
              style={{
                width: "14px",
                height: "14px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                cursor: hasChildren ? "pointer" : "default",
                opacity: hasChildren ? 0.7 : 0,
              }}
            >
              {hasChildren ? (isFolderExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />) : null}
            </span>
            <span
              style={{
                width: "14px",
                height: "14px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Folder size={12} style={{ color: "#f59e0b" }} />
            </span>
            <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {node.name}
            </span>
          </div>
        )}
        {(node.name === "Root" || (hasChildren && isFolderExpanded)) && (
          <div style={{ paddingLeft: node.name === "Root" ? "0" : "8px" }}>
            {childEntries.map((child, idx) => renderFolderNode(child, `${node.path}_${idx}`))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        background: "var(--surface-bg)",
        color: "var(--text-color)",
        fontFamily: "var(--font-sans, system-ui, sans-serif)",
      }}
    >
      <SubpageHeader
        breadcrumbs={breadcrumbSegments.length > 0 ? breadcrumbSegments : ["Workspace Index"]}
        breadcrumbParent="Workspace"
        onBack={onBack}
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "11px", opacity: 0.8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <FileText size={12} style={{ opacity: 0.6 }} />
              <span><strong>{indexData.stats.totalDocuments}</strong> Notes</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <Hash size={12} style={{ color: "var(--accent-solid)" }} />
              <span><strong>{indexData.stats.totalHeaders}</strong> Headers</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <Code size={12} style={{ opacity: 0.6 }} />
              <span><strong>{indexData.stats.totalCodeBlocks}</strong> Code Blocks</span>
            </div>
          </div>
        }
      />

      {/* Compact Top Search & Filter Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          padding: "6px 14px",
          background: "var(--surface-card, rgba(255,255,255,0.02))",
          borderBottom: "1px solid var(--border-soft, rgba(255,255,255,0.08))",
        }}
      >
        {/* Search Input */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            flex: 1,
            maxWidth: "480px",
            padding: "4px 8px",
            background: "var(--surface-elevated, rgba(15, 23, 42, 0.7))",
            borderRadius: "var(--radius-md, 5px)",
            border: "1px solid var(--border-soft, rgba(255,255,255,0.15))",
          }}
        >
          <Search size={12} style={{ opacity: 0.5, flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search headers, sections, code blocks, or tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: "transparent",
              border: "none",
              outline: "none",
              color: "inherit",
              fontSize: "12px",
              width: "100%",
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", opacity: 0.6, display: "flex", padding: 0 }}
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Filter Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px" }}>
            <Filter size={12} style={{ opacity: 0.7 }} />
            <select
              value={maxDepth}
              onChange={(e) => setMaxDepth(Number(e.target.value))}
              style={{
                background: "var(--surface-elevated, rgba(15, 23, 42, 0.7))",
                color: "inherit",
                border: "1px solid var(--border-soft, rgba(255,255,255,0.15))",
                borderRadius: "4px",
                padding: "3px 6px",
                fontSize: "11px",
                outline: "none",
              }}
            >
              <option value={1}>Show H1 Only</option>
              <option value={2}>Up to H2</option>
              <option value={3}>Up to H3</option>
              <option value={6}>All Levels (H1 - H6)</option>
            </select>
          </div>

          {selectedTag && (
            <span
              onClick={() => setSelectedTag(null)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "3px",
                fontSize: "10px",
                padding: "2px 6px",
                borderRadius: "10px",
                background: "var(--accent-strong, #3b82f6)",
                color: "#fff",
                cursor: "pointer",
                fontWeight: "600",
              }}
            >
              #{selectedTag} <X size={12} />
            </span>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left Column: Outline Tree */}
        <div
          style={{
            width: "280px",
            borderRight: "1px solid var(--border-soft, rgba(255,255,255,0.1))",
            padding: "10px",
            overflowY: "auto",
            background: "var(--surface-subtle, rgba(15, 23, 42, 0.4))",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "8px" }}>
            <div style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", opacity: 0.6, letterSpacing: "0.05em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {searchResults ? `Matches (${searchResults.length})` : "Hierarchy"}
            </div>
            {!searchResults && (
              <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={handleExpandAll}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "3px",
                    fontSize: "10px",
                    padding: "2px 6px",
                    borderRadius: "var(--radius-sm, 3px)",
                    border: "1px solid var(--border-soft, rgba(255,255,255,0.15))",
                    background: "var(--surface-card, rgba(255,255,255,0.04))",
                    color: "inherit",
                    cursor: "pointer",
                  }}
                >
                  <ChevronsUpDown size={12} /> Expand
                </button>
                <button
                  type="button"
                  onClick={handleCollapseAll}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "3px",
                    fontSize: "10px",
                    padding: "2px 6px",
                    borderRadius: "var(--radius-sm, 3px)",
                    border: "1px solid var(--border-soft, rgba(255,255,255,0.15))",
                    background: "var(--surface-card, rgba(255,255,255,0.04))",
                    color: "inherit",
                    cursor: "pointer",
                  }}
                >
                  <Minimize2 size={12} /> Collapse
                </button>
              </div>
            )}
          </div>

          {searchResults ? (
            searchResults.length === 0 ? (
              <div style={{ fontSize: "11px", opacity: 0.6, padding: "10px 4px" }}>No matching headers found.</div>
            ) : (
              searchResults.map((res) => (
                <div
                  key={res.header.id}
                  onClick={() => {
                    setSelectedHeaderId(res.header.id);
                    setSelectedDocId(res.docId);
                  }}
                  style={{
                    padding: "4px 6px",
                    borderRadius: "var(--radius-md, 4px)",
                    cursor: "pointer",
                    marginBottom: "2px",
                    background: res.header.id === selectedHeaderId ? "var(--surface-accent)" : "transparent",
                    borderLeft: res.header.id === selectedHeaderId ? "2px solid var(--accent-solid)" : "2px solid transparent",
                    transition: "background 0.15s ease",
                  }}
                  className="workspace-index-tree-item"
                >
                  <div style={{ fontSize: "10px", opacity: 0.6 }}>{res.relativePath || res.docTitle} • Line {res.header.line}</div>
                  <div style={{ fontSize: "11px", fontWeight: "600", color: res.header.id === selectedHeaderId ? "var(--accent-solid)" : "var(--text-color)" }}>
                    {"#".repeat(res.header.level)} {res.header.text}
                  </div>
                  {res.matchedBlocks.length > 0 && (
                    <div style={{ fontSize: "10px", opacity: 0.7, marginTop: "2px", fontStyle: "italic" }}>
                      &quot;{res.matchedBlocks[0].content.slice(0, 70)}...&quot;
                    </div>
                  )}
                </div>
              ))
            )
          ) : (
            renderFolderNode(indexData.folderTree)
          )}
        </div>

        {/* Center Column: Preview Engine Inspector */}
        <div style={{ flex: 1, padding: "14px 20px", overflowY: "auto", display: "flex", flexDirection: "column" }}>
          {activeHeader || activeDoc ? (
            <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
              {/* Header Action Bar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingBottom: "10px",
                  borderBottom: "1px solid var(--border-soft, rgba(255,255,255,0.1))",
                  marginBottom: "14px",
                }}
              >
                <div>
                  <div style={{ fontSize: "10px", opacity: 0.6, marginBottom: "2px" }}>
                    {activeHeader
                      ? `${activeHeader.relativePath || activeHeader.docTitle} • Line ${activeHeader.line}`
                      : `${activeDoc.relativePath || activeDoc.title} • ${activeDoc.wordCount || 0} words • ${activeDoc.flatHeaders?.length || 0} headers`}
                  </div>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "700" }}>
                    {activeHeader ? `${"#".repeat(activeHeader.level)} ${activeHeader.text}` : activeDoc.title}
                  </h3>
                </div>

                <div style={{ display: "flex", gap: "6px" }}>
                  <AppButton
                    type="button"
                    variant="primary"
                    size="small"
                    onClick={() => {
                      if (onSelectHeader) {
                        const targetPath = activeHeader?.filePath || activeDoc?.filePath || activeDoc?.docId;
                        const targetLine = activeHeader ? activeHeader.line : 1;
                        onSelectHeader(targetPath, targetLine);
                      }
                    }}
                  >
                    <ExternalLink size={12} /> {activeHeader ? `Open in Editor (Line ${activeHeader.line})` : "Open in Editor"}
                  </AppButton>
                </div>
              </div>

              {/* Rendered Section Content using Notely Preview Engine */}
              <div
                style={{
                  flex: 1,
                  padding: "14px",
                  borderRadius: "var(--radius-md, 5px)",
                  background: "var(--surface-card, rgba(255,255,255,0.02))",
                  border: "1px solid var(--border-soft, rgba(255,255,255,0.08))",
                  overflowY: "auto",
                }}
              >
                <MarkdownPreview
                  content={activeContent}
                  basePath={activeHeader?.filePath || activeDoc?.filePath}
                  readOnly
                />
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                opacity: 0.5,
                textAlign: "center",
              }}
            >
              <Layers size={18} style={{ marginBottom: "8px", opacity: 0.7 }} />
              <div style={{ fontSize: "13px", fontWeight: "600", marginBottom: "2px" }}>Multi-Level Workspace Index</div>
              <div style={{ fontSize: "11px" }}>Select any note or header from the hierarchy outline to inspect its content with the Markdown Preview Engine</div>
            </div>
          )}
        </div>

        {/* Right Column: Micro-Compact Tag Index Cloud */}
        <div
          style={{
            width: "220px",
            borderLeft: "1px solid var(--border-soft, rgba(255,255,255,0.1))",
            padding: "10px",
            background: "var(--surface-subtle, rgba(15, 23, 42, 0.4))",
            overflowY: "auto",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", fontWeight: "700", textTransform: "uppercase", opacity: 0.6, marginBottom: "8px", letterSpacing: "0.05em" }}>
            <Tag size={12} /> Tag Index ({indexData.stats.totalTags})
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "3px" }}>
            {Object.keys(indexData.tagMap).length === 0 ? (
              <div style={{ fontSize: "10px", opacity: 0.5 }}>No tags indexed.</div>
            ) : (
              Object.entries(indexData.tagMap).map(([tag, docs]) => (
                <span
                  key={tag}
                  onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                  style={{
                    fontSize: "10px",
                    padding: "2px 6px",
                    borderRadius: "8px",
                    background: selectedTag === tag ? "var(--accent-strong, #3b82f6)" : "var(--surface-card, rgba(255,255,255,0.06))",
                    color: selectedTag === tag ? "#fff" : "inherit",
                    cursor: "pointer",
                    border: "1px solid var(--border-soft, rgba(255,255,255,0.1))",
                    transition: "all 0.15s ease",
                  }}
                >
                  #{tag} ({docs.length})
                </span>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
