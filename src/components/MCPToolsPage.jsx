import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Wrench,
  Search,
  Server,
  Play,
  Code,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Settings,
  Sparkles,
  FileJson,
  Terminal,
  Activity,
  Layers,
  Zap,
  Filter,
  FileText,
  Folder,
  Cpu,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock
} from "lucide-react";
import { listTools, executeTool } from "../services/electron/aiService";
import { mcpGetStatus, onMcpStatusChanged } from "../services/electronService";
import "../styles/KnowledgeGraph.css";
import "../styles/AISettings.css";
import "../styles/MCPSettings.css";

function generateSampleArgs(tool) {
  const props = tool?.inputSchema?.properties;
  if (!props || Object.keys(props).length === 0) {
    return "{}";
  }
  const sample = {};
  for (const [key, prop] of Object.entries(props)) {
    const type = prop.type || "string";
    if (type === "number" || type === "integer") {
      sample[key] = 1;
    } else if (type === "boolean") {
      sample[key] = true;
    } else if (type === "array") {
      sample[key] = [];
    } else if (type === "object") {
      sample[key] = {};
    } else {
      if (key.toLowerCase().includes("path") || key.toLowerCase().includes("file")) {
        sample[key] = "Untitled.md";
      } else if (key.toLowerCase().includes("query")) {
        sample[key] = "project goals";
      } else {
        sample[key] = prop.description ? prop.description.slice(0, 35) : "sample";
      }
    }
  }
  return JSON.stringify(sample, null, 2);
}

function getToolCategory(name = "") {
  const n = name.toLowerCase();
  if (n.includes("note") || n.includes("doc") || n.includes("content") || n.includes("read") || n.includes("write") || n.includes("create")) {
    return "Notes & Docs";
  }
  if (n.includes("search") || n.includes("graph") || n.includes("embed") || n.includes("query") || n.includes("find") || n.includes("rag")) {
    return "Search & Graph";
  }
  if (n.includes("workspace") || n.includes("folder") || n.includes("file") || n.includes("list") || n.includes("dir")) {
    return "Workspace & Files";
  }
  return "System & AI";
}

function getCategoryIcon(cat) {
  switch (cat) {
    case "Notes & Docs": return <FileText size={14} />;
    case "Search & Graph": return <Search size={14} />;
    case "Workspace & Files": return <Folder size={14} />;
    case "System & AI": return <Cpu size={14} />;
    default: return <Layers size={14} />;
  }
}

export function MCPToolsPage({ onBack, onNotify, onOpenSettings }) {
  const [tools, setTools] = useState([]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterQuery, setFilterQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [expandedTool, setExpandedTool] = useState(null);
  const [testArgs, setTestArgs] = useState({});
  const [testResult, setTestResult] = useState(null);
  const [runningTest, setRunningTest] = useState(false);
  const [copiedName, setCopiedName] = useState(null);
  const [copiedManifest, setCopiedManifest] = useState(false);
  const [copiedOutput, setCopiedOutput] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [res, st] = await Promise.all([
        listTools().catch(() => null),
        mcpGetStatus().catch(() => null)
      ]);
      const toolArray = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : [];
      setTools(toolArray);
      setStatus(st);
    } catch (err) {
      console.error("[MCPToolsPage] Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const unsub = onMcpStatusChanged((updatedStatus) => {
      setStatus(updatedStatus);
    });
    return () => unsub?.();
  }, [loadData]);

  const categories = useMemo(() => {
    const set = new Set(["All"]);
    tools.forEach((t) => set.add(getToolCategory(t.name)));
    return Array.from(set);
  }, [tools]);

  const filteredTools = useMemo(() => {
    return tools.filter((t) => {
      const q = filterQuery.toLowerCase().trim();
      const matchesCategory = selectedCategory === "All" || getToolCategory(t.name) === selectedCategory;
      if (!matchesCategory) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q))
      );
    });
  }, [tools, filterQuery, selectedCategory]);

  const handleRunTool = async (tool) => {
    try {
      setRunningTest(true);
      setTestResult(null);

      let parsedArgs = {};
      const rawText = testArgs[tool.name];
      if (rawText && rawText.trim()) {
        try {
          parsedArgs = JSON.parse(rawText);
        } catch (err) {
          onNotify?.(`Invalid JSON parameters: ${err.message}`, "error");
          setRunningTest(false);
          return;
        }
      }

      const start = Date.now();
      const res = await executeTool(tool.name, parsedArgs);
      const durationMs = Date.now() - start;

      setTestResult({
        toolName: tool.name,
        durationMs,
        response: res
      });

      if (res?.success) {
        onNotify?.(`Executed ${tool.name} in ${durationMs}ms`, "success");
      } else {
        onNotify?.(res?.error?.message || "Tool execution returned an error", "warning");
      }
    } catch (err) {
      setTestResult({
        toolName: tool.name,
        durationMs: 0,
        response: { success: false, error: { message: err.message } }
      });
      onNotify?.(`Tool execution failed: ${err.message}`, "error");
    } finally {
      setRunningTest(false);
    }
  };

  const copyToolName = (name) => {
    navigator.clipboard.writeText(name);
    setCopiedName(name);
    setTimeout(() => setCopiedName(null), 1500);
  };

  const copyManifest = () => {
    try {
      const manifestStr = JSON.stringify(tools, null, 2);
      navigator.clipboard.writeText(manifestStr);
      setCopiedManifest(true);
      onNotify?.(`Copied MCP tools manifest (${tools.length} capabilities) to clipboard.`, "success");
      setTimeout(() => setCopiedManifest(false), 2000);
    } catch (err) {
      onNotify?.(`Failed to copy manifest: ${err.message}`, "error");
    }
  };

  const copyResultOutput = (data) => {
    try {
      navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopiedOutput(true);
      setTimeout(() => setCopiedOutput(false), 1500);
    } catch { /* ignore */ }
  };

  const handlePrefillSample = (tool) => {
    const sampleStr = generateSampleArgs(tool);
    setTestArgs({ ...testArgs, [tool.name]: sampleStr });
  };

  const isRunning = Boolean(status?.running);
  const isPortConflict = status?.errorCode === "EADDRINUSE";

  return (
    <div className="mcp-tools-page-wrapper">
      {/* Top Header Breadcrumb */}
      <div className="detail-topbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <nav className="detail-breadcrumb" aria-label="Location">
          <span className="detail-breadcrumb-part">
            <button className="detail-breadcrumb-link" type="button" onClick={onBack}>
              Notes
            </button>
            <span className="detail-breadcrumb-separator" aria-hidden="true">
              /
            </span>
          </span>
          <span className="detail-breadcrumb-current">MCP Tools &amp; Capabilities</span>
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={loadData}
            title="Reload tools and status"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", height: "26px", padding: "0 10px" }}
          >
            <RefreshCw size={14} className={loading ? "spin" : ""} /> Refresh
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={copyManifest}
            title="Copy full JSON manifest of all registered MCP tools"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", height: "26px", padding: "0 10px" }}
          >
            {copiedManifest ? <Check size={14} color="#10b981" /> : <FileJson size={14} />}
            {copiedManifest ? "Manifest Copied" : "Export Manifest"}
          </button>

          {onOpenSettings && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onOpenSettings}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", height: "26px", padding: "0 10px" }}
            >
              <Settings size={14} /> MCP Settings
            </button>
          )}
        </div>
      </div>

      <div className="mcp-tools-scroll-content">
        {/* Status Hero Banner */}
        <div className={`mcp-hero-banner ${isPortConflict ? "is-conflict" : isRunning ? "is-running" : ""}`}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: isPortConflict
                  ? "rgba(239, 68, 68, 0.2)"
                  : isRunning
                  ? "rgba(16, 185, 129, 0.2)"
                  : "var(--surface-muted)",
                color: isPortConflict ? "#ef4444" : isRunning ? "#10b981" : "var(--text-muted)"
              }}
            >
              <Server size={20} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <strong style={{ fontSize: "15px", fontWeight: 700 }}>Notely MCP Server</strong>
                {isRunning && <span className="mcp-pulse-dot" title="Server Active" />}
                <span
                  className={`mcp-status-badge ${isPortConflict ? "is-conflict" : isRunning ? "is-running" : ""}`}
                >
                  {isPortConflict ? "Port Conflict" : isRunning ? `Running · Port ${status?.port || 3700}` : "Stopped"}
                </span>
              </div>
              <span style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px", display: "block" }}>
                {isRunning
                  ? `Exposing ${tools.length} capabilities to external AI clients over SSE at http://${status?.host || "127.0.0.1"}:${status?.port || 3700}/sse`
                  : "Server offline. Enable from MCP Settings to connect Claude Desktop, IDE agents, or external tools."}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                Capabilities
              </div>
              <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--text-strong)" }}>{tools.length}</div>
            </div>

            <div style={{ height: "28px", width: "1px", background: "var(--border-soft, rgba(255,255,255,0.1))" }} />

            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                Active Sessions
              </div>
              <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--text-strong)" }}>{status?.activeSessions || 0}</div>
            </div>

            <div style={{ height: "28px", width: "1px", background: "var(--border-soft, rgba(255,255,255,0.1))" }} />

            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                Invocations
              </div>
              <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--accent-solid, #3b82f6)" }}>{status?.totalToolCalls || 0}</div>
            </div>
          </div>
        </div>

        {/* Two Column Layout (Left Sidebar) */}
        <div className="mcp-tools-layout">
          {/* Left Sidebar Area */}
          <div className="mcp-tools-sidebar">
            {/* Suite Breakdown Card */}
            <div className="mcp-sidebar-card">
              <h4 className="mcp-sidebar-card-title">
                <Layers size={16} color="var(--accent-solid)" /> Capability Suites
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {categories.map((cat) => {
                  const count = cat === "All" ? tools.length : tools.filter((t) => getToolCategory(t.name) === cat).length;
                  const isSel = selectedCategory === cat;
                  return (
                    <div
                      key={cat}
                      className={`mcp-suite-item ${isSel ? "is-selected" : ""}`}
                      onClick={() => setSelectedCategory(cat)}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {getCategoryIcon(cat)}
                        <span>{cat}</span>
                      </div>
                      <span className="mcp-category-count">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Integration Setup Card */}
            <div className="mcp-sidebar-card">
              <h4 className="mcp-sidebar-card-title">
                <Zap size={16} color="#eab308" /> Claude Desktop Client Config
              </h4>
              <p style={{ margin: 0, fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.4 }}>
                Add this snippet to your <code>claude_desktop_config.json</code> to connect Claude Desktop directly to Notely.
              </p>
              <div style={{ position: "relative" }}>
                <pre
                  style={{
                    background: "var(--surface-bg)",
                    border: "1px solid var(--border-soft)",
                    borderRadius: "6px",
                    padding: "10px 12px",
                    fontSize: "11px",
                    fontFamily: "monospace",
                    color: "var(--app-text)",
                    margin: 0,
                    overflowX: "auto"
                  }}
                >
{`{
  "mcpServers": {
    "notely": {
      "url": "http://${status?.host || "127.0.0.1"}:${status?.port || 3700}/sse"
    }
  }
}`}
                </pre>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    const snippet = JSON.stringify({
                      mcpServers: {
                        notely: {
                          url: `http://${status?.host || "127.0.0.1"}:${status?.port || 3700}/sse`
                        }
                      }
                    }, null, 2);
                    navigator.clipboard.writeText(snippet);
                    onNotify?.("Copied Claude Desktop configuration to clipboard!", "success");
                  }}
                  style={{ marginTop: "8px", width: "100%", fontSize: "12px", height: "28px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                >
                  <Copy size={13} /> Copy Config Snippet
                </button>
              </div>
            </div>

            {/* Quick Status / Security Notice */}
            <div className="mcp-sidebar-card">
              <h4 className="mcp-sidebar-card-title">
                <Activity size={16} color="#10b981" /> Server Details
              </h4>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Transport</span>
                  <strong style={{ color: "var(--text-strong)" }}>HTTP SSE</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Host</span>
                  <strong style={{ color: "var(--text-strong)" }}>{status?.host || "127.0.0.1"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Port</span>
                  <strong style={{ color: "var(--text-strong)" }}>{status?.port || 3700}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Total Tools</span>
                  <strong style={{ color: "var(--accent-solid)" }}>{tools.length}</strong>
                </div>
              </div>
              {onOpenSettings && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onOpenSettings}
                  style={{ width: "100%", fontSize: "12px", height: "28px", marginTop: "4px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                >
                  <Settings size={13} /> Configure Permissions
                </button>
              )}
            </div>
          </div>

          {/* Main Content Area */}
          <div className="mcp-tools-main">
            {/* Search Bar Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", gap: "12px" }}>
              <div className="mcp-search-wrap">
                <Search size={14} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                <input
                  type="text"
                  placeholder="Search tools by name, suite, or description…"
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  className="mcp-search-input"
                />
              </div>
            </div>

            {/* Tool Cards */}
            {loading ? (
              <div style={{ textAlign: "center", padding: "60px", color: "var(--text-muted)" }}>Loading registered tools catalog…</div>
            ) : filteredTools.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px", color: "var(--text-muted)", background: "var(--surface-elevated)", borderRadius: "8px" }}>
                No capabilities match your query.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {filteredTools.map((tool) => {
                  const isExpanded = expandedTool === tool.name;
                  const category = getToolCategory(tool.name);
                  const hasProps = tool.inputSchema?.properties && Object.keys(tool.inputSchema.properties).length > 0;
                  const propKeys = hasProps ? Object.keys(tool.inputSchema.properties) : [];
                  const requiredKeys = Array.isArray(tool.inputSchema?.required) ? tool.inputSchema.required : [];

                  return (
                    <div
                      key={tool.name}
                      className={`mcp-tool-card-modern ${isExpanded ? "is-open" : ""}`}
                    >
                      {/* Tool Summary Bar */}
                      <div
                        className="mcp-tool-header-row"
                        onClick={() => setExpandedTool(isExpanded ? null : tool.name)}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "14px", flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              width: "36px",
                              height: "36px",
                              borderRadius: "8px",
                              background: "var(--surface-subtle, rgba(255,255,255,0.04))",
                              border: "1px solid var(--border-soft, rgba(255,255,255,0.06))",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "var(--accent-solid, #3b82f6)",
                              flexShrink: 0
                            }}
                          >
                            <Wrench size={18} />
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                              <code style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-strong)" }}>{tool.name}</code>
                              <button
                                type="button"
                                className="btn-link"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToolName(tool.name);
                                }}
                                title="Copy tool identifier"
                                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "2px" }}
                              >
                                {copiedName === tool.name ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                              </button>
                              <span className="mcp-tool-badge-cat">
                                {category}
                              </span>
                            </div>
                            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--text-muted)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                              {tool.description}
                            </p>
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                          <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 500 }}>
                            {propKeys.length} param{propKeys.length !== 1 ? "s" : ""}
                          </span>
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </div>
                      </div>

                      {/* Expanded Detail Pane */}
                      {isExpanded && (
                        <div style={{ borderTop: "1px solid var(--border-soft, rgba(255,255,255,0.08))", padding: "20px", background: "var(--surface-bg)" }}>
                          {/* Parameters Schema Header */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                            <h4 style={{ margin: 0, fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)" }}>
                              Parameters Schema
                            </h4>
                          </div>

                          {propKeys.length === 0 ? (
                            <p style={{ margin: "0 0 16px", fontSize: "12px", color: "var(--text-muted)" }}>No input parameters required for this tool.</p>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "18px" }}>
                              {propKeys.map((k) => {
                                const prop = tool.inputSchema.properties[k];
                                const isReq = requiredKeys.includes(k);
                                const pType = prop.type || "string";
                                return (
                                  <div
                                    key={k}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "10px",
                                      padding: "8px 12px",
                                      background: "var(--surface-elevated, var(--bg-card))",
                                      border: "1px solid var(--border-soft, rgba(255,255,255,0.06))",
                                      borderRadius: "8px",
                                      fontSize: "12px"
                                    }}
                                  >
                                    <code style={{ fontWeight: 700, color: "var(--accent-solid, #3b82f6)", minWidth: "110px" }}>{k}</code>
                                    <span className={`mcp-param-tag type-${pType}`}>{pType}</span>
                                    {isReq ? (
                                      <span style={{ color: "#ef4444", fontSize: "10px", fontWeight: 700, letterSpacing: "0.04em" }}>REQUIRED</span>
                                    ) : (
                                      <span style={{ color: "var(--text-muted)", fontSize: "10px" }}>OPTIONAL</span>
                                    )}
                                    <span style={{ flex: 1, color: "var(--text-muted)", fontSize: "12px" }}>{prop.description || "—"}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Interactive Console Block */}
                          <div className="mcp-console-block">
                            <div className="mcp-console-header">
                              <span style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 600, color: "#e2e8f0" }}>
                                <Terminal size={14} color="#3b82f6" /> Interactive Tool Runner
                              </span>
                              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                {hasProps && (
                                  <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => handlePrefillSample(tool)}
                                    style={{ fontSize: "11px", padding: "3px 8px", height: "24px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                                  >
                                    <Sparkles size={12} color="#fbbf24" /> Auto-Fill JSON
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="btn btn-primary"
                                  disabled={runningTest}
                                  onClick={() => handleRunTool(tool)}
                                  style={{ fontSize: "11px", padding: "3px 12px", height: "24px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                                >
                                  <Play size={12} /> {runningTest ? "Executing..." : "Run Execution"}
                                </button>
                              </div>
                            </div>

                            <textarea
                              className="mcp-console-textarea"
                              placeholder='// JSON arguments payload (e.g. {"query": "Search query"})\n{}'
                              value={testArgs[tool.name] || ""}
                              onChange={(e) => setTestArgs({ ...testArgs, [tool.name]: e.target.value })}
                            />

                            {/* Test Execution Result Console */}
                            {testResult && testResult.toolName === tool.name && (
                              <div className="mcp-console-result">
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    {testResult.response?.success ? (
                                      <span style={{ color: "#10b981", display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", fontWeight: 700 }}>
                                        <CheckCircle2 size={14} /> SUCCESS
                                      </span>
                                    ) : (
                                      <span style={{ color: "#ef4444", display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", fontWeight: 700 }}>
                                        <XCircle size={14} /> FAILED
                                      </span>
                                    )}
                                    <span style={{ color: "#94a3b8", fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                      <Clock size={12} /> {testResult.durationMs}ms
                                    </span>
                                  </div>

                                  <button
                                    type="button"
                                    className="btn-link"
                                    onClick={() => copyResultOutput(testResult.response)}
                                    style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                                  >
                                    {copiedOutput ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                                    {copiedOutput ? "Copied" : "Copy Output"}
                                  </button>
                                </div>

                                <pre
                                  style={{
                                    background: "#090d16",
                                    color: "#38bdf8",
                                    padding: "10px 12px",
                                    borderRadius: "6px",
                                    fontSize: "11.5px",
                                    maxHeight: "220px",
                                    overflowY: "auto",
                                    margin: 0,
                                    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                                    border: "1px solid #1e293b"
                                  }}
                                >
                                  {JSON.stringify(testResult.response, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MCPToolsPage;
