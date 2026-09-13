import React, { useState, useMemo } from "react";
import {
  Search, Folder, FileText, ChevronRight, ChevronDown,
  Hash, Layers, ExternalLink, Filter, Tag, X,
  Code, ChevronsUpDown, Minimize2
} from "lucide-react";
import { buildWorkspaceIndex, searchMultiLevelIndex } from "../services/workspaceIndexService";
import { MarkdownPreview } from "./MarkdownPreview";

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

function getBreadcrumbSegments(activeHeader, indexData) {
  if (!activeHeader || !indexData) return [];
  const doc = indexData.documentsMap[activeHeader.docId];
  const segments = [];

  if (doc) {
    const rawPath = doc.filePath || doc.title || "Untitled";
    const parts = rawPath.split("/").filter(Boolean);
    parts.forEach((p) => segments.push(p));
  }

  // Trace parent headers
  const headerChain = [];
  let curr = activeHeader;
  while (curr) {
    headerChain.unshift("#".repeat(curr.level) + " " + curr.text);
    curr = curr.parentId ? (doc?.flatHeaders?.find((h) => h.id === curr.parentId) || null) : null;
  }

  return [...segments, ...headerChain];
}

export function WorkspaceIndexPage({
  documents = [],
  onBack,
  onSelectHeader,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState(null);
  const [maxDepth, setMaxDepth] = useState(6);
  const [selectedHeaderId, setSelectedHeaderId] = useState(null);

  // Tree nodes start collapsed by default
  const [expandedFolders, setExpandedFolders] = useState({});
  const [expandedDocs, setExpandedDocs] = useState({});
  const [expandedHeaders, setExpandedHeaders] = useState({});

  // Build full multi-level workspace index
  const indexData = useMemo(() => {
    return buildWorkspaceIndex(documents);
  }, [documents]);

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

  // Assembled Markdown & Breadcrumb Trail for Section Inspector
  const activeSectionMarkdown = useMemo(() => {
    if (!activeHeader) return "";
    return buildSectionMarkdown(activeHeader);
  }, [activeHeader]);

  const breadcrumbSegments = useMemo(() => {
    return getBreadcrumbSegments(activeHeader, indexData);
  }, [activeHeader, indexData]);

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
            onClick={() => setSelectedHeaderId(header.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "2px 5px",
              borderRadius: "var(--radius-md, 3px)",
              cursor: "pointer",
              fontSize: "11px",
              background: isSelected ? "var(--surface-accent, rgba(59, 130, 246, 0.15))" : "transparent",
              color: isSelected ? "var(--accent-strong, #3b82f6)" : "var(--app-text, #f8fafc)",
              fontWeight: header.level <= 2 ? "600" : "400",
              borderLeft: isSelected ? "2px solid var(--accent-strong, #3b82f6)" : "2px solid transparent",
              transition: "background 0.15s ease",
            }}
          >
            {hasChildren ? (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  toggleHeaderNode(header.id);
                }}
                style={{ display: "inline-flex", cursor: "pointer", opacity: 0.7 }}
              >
                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </span>
            ) : (
              <Hash size={12} style={{ opacity: 0.4, flexShrink: 0 }} />
            )}
            <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {header.text}
            </span>
            <span style={{ fontSize: "10px", opacity: 0.4, fontVariantNumeric: "tabular-nums" }}>L{header.line}</span>
            {header.blocks.length > 0 && (
              <span
                style={{
                  fontSize: "9px",
                  padding: "1px 4px",
                  borderRadius: "8px",
                  background: "var(--surface-accent, rgba(255,255,255,0.08))",
                  opacity: 0.6,
                }}
              >
                {header.blocks.length}
              </span>
            )}
          </div>
          {hasChildren && isExpanded && (
            <div style={{ borderLeft: "1px dashed var(--border-soft, rgba(255,255,255,0.1))", marginLeft: "6px" }}>
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
      return (
        <div key={doc.docId} style={{ marginBottom: "2px" }}>
          <div
            onClick={() => hasHeaders && toggleDoc(doc.docId)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "3px 5px",
              borderRadius: "var(--radius-md, 3px)",
              cursor: "pointer",
              fontSize: "11px",
              fontWeight: "600",
              background: "var(--surface-card, rgba(255,255,255,0.03))",
              border: "1px solid var(--border-soft, rgba(255,255,255,0.06))",
            }}
          >
            {hasHeaders ? (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  toggleDoc(doc.docId);
                }}
                style={{ display: "inline-flex", cursor: "pointer", opacity: 0.7 }}
              >
                {isDocExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </span>
            ) : null}
            <FileText size={12} style={{ color: "var(--accent-strong, #3b82f6)", flexShrink: 0 }} />
            <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {doc.title}
            </span>
            <span style={{ fontSize: "10px", opacity: 0.5 }}>{doc.flatHeaders.length} headers</span>
          </div>
          {hasHeaders && isDocExpanded && (
            <div style={{ marginTop: "2px", paddingLeft: "6px" }}>
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
      <div key={node.path || key} style={{ marginBottom: "3px" }}>
        {node.name !== "Root" && (
          <div
            onClick={() => hasChildren && toggleFolder(node.path)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "3px 4px",
              cursor: "pointer",
              fontSize: "11px",
              fontWeight: "700",
              opacity: 0.9,
            }}
          >
            {hasChildren ? (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFolder(node.path);
                }}
                style={{ display: "inline-flex", cursor: "pointer", opacity: 0.7 }}
              >
                {isFolderExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </span>
            ) : null}
            <Folder size={12} style={{ color: "#f59e0b", flexShrink: 0 }} />
            <span>{node.name}</span>
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
        background: "var(--app-bg, #0f172a)",
        color: "var(--app-text, #f8fafc)",
        fontFamily: "var(--font-sans, system-ui, sans-serif)",
      }}
    >
      {/* Top Breadcrumb Bar matching Knowledge Graph / Subpage system */}
      <div className="detail-topbar" style={{ padding: "6px 14px", borderBottom: "1px solid var(--border-soft)", background: "var(--surface-bg)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <nav className="detail-breadcrumb" aria-label="Workspace Index location">
          <span className="detail-breadcrumb-part">
            <button className="detail-breadcrumb-link" type="button" onClick={onBack}>
              Workspace
            </button>
            <span className="detail-breadcrumb-separator" aria-hidden="true">/</span>
          </span>
          <span className="detail-breadcrumb-part">
            <span
              className={breadcrumbSegments.length > 0 ? "detail-breadcrumb-link" : "detail-breadcrumb-current"}
              onClick={() => setSelectedHeaderId(null)}
              style={{ cursor: breadcrumbSegments.length > 0 ? "pointer" : "default" }}
            >
              Index
            </span>
          </span>
          {breadcrumbSegments.map((seg, i) => (
            <span key={i} className="detail-breadcrumb-part">
              <span className="detail-breadcrumb-separator" aria-hidden="true">/</span>
              <span className={i === breadcrumbSegments.length - 1 ? "detail-breadcrumb-current" : "detail-breadcrumb-link"}>
                {seg}
              </span>
            </span>
          ))}
        </nav>

        {/* Compact Header Stats */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "11px", opacity: 0.8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <FileText size={12} style={{ opacity: 0.6 }} />
            <span><strong>{indexData.stats.totalDocuments}</strong> Notes</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <Hash size={12} style={{ color: "var(--accent-strong, #3b82f6)" }} />
            <span><strong>{indexData.stats.totalHeaders}</strong> Headers</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <Code size={12} style={{ opacity: 0.6 }} />
            <span><strong>{indexData.stats.totalCodeBlocks}</strong> Code Blocks</span>
          </div>
        </div>
      </div>

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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
            <div style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", opacity: 0.6, letterSpacing: "0.05em" }}>
              {searchResults ? `Matches (${searchResults.length})` : "Multi-Level Hierarchy"}
            </div>
            {!searchResults && (
              <div style={{ display: "flex", gap: "3px" }}>
                <button
                  type="button"
                  onClick={handleExpandAll}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "2px",
                    fontSize: "10px",
                    padding: "1px 5px",
                    borderRadius: "3px",
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
                    gap: "2px",
                    fontSize: "10px",
                    padding: "1px 5px",
                    borderRadius: "3px",
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
                  onClick={() => setSelectedHeaderId(res.header.id)}
                  style={{
                    padding: "5px 7px",
                    borderRadius: "3px",
                    cursor: "pointer",
                    marginBottom: "3px",
                    background: res.header.id === selectedHeaderId ? "var(--surface-accent, rgba(59, 130, 246, 0.15))" : "var(--surface-card, rgba(255,255,255,0.03))",
                    borderLeft: res.header.id === selectedHeaderId ? "2px solid var(--accent-strong, #3b82f6)" : "2px solid transparent",
                  }}
                >
                  <div style={{ fontSize: "10px", opacity: 0.6 }}>{res.docTitle} • Line {res.header.line}</div>
                  <div style={{ fontSize: "11px", fontWeight: "600", color: "var(--accent-strong, #3b82f6)" }}>
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
          {activeHeader ? (
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
                    {activeHeader.filePath || activeHeader.docTitle} • Line {activeHeader.line}
                  </div>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "700" }}>
                    {"#".repeat(activeHeader.level)} {activeHeader.text}
                  </h3>
                </div>

                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    type="button"
                    onClick={() => onSelectHeader && onSelectHeader(activeHeader.docId, activeHeader.line)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "3px",
                      padding: "4px 9px",
                      borderRadius: "var(--radius-md, 3px)",
                      background: "var(--accent-strong, #3b82f6)",
                      color: "#fff",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "11px",
                      fontWeight: "600",
                    }}
                  >
                    <ExternalLink size={12} /> Open in Editor (Line {activeHeader.line})
                  </button>

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
                  content={activeSectionMarkdown}
                  basePath={activeHeader.filePath}
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
              <div style={{ fontSize: "11px" }}>Select any header node from the outline tree to inspect its section with the Markdown Preview Engine</div>
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
