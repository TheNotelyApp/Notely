import React, { useState, useEffect, useCallback } from "react";
import {
  Wrench,
  Search,
  Server,
  Play,
  CheckCircle,
  AlertCircle,
  Code,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Settings,
  Radio,
  Clock,
  Sparkles
} from "lucide-react";
import { listTools, executeTool } from "../services/electron/aiService";
import { mcpGetStatus } from "../services/electronService";
import "../styles/KnowledgeGraph.css";
import "../styles/AISettings.css";

export function MCPToolsPage({ onBack, onNotify, onOpenSettings }) {
  const [tools, setTools] = useState([]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterQuery, setFilterQuery] = useState("");
  const [expandedTool, setExpandedTool] = useState(null);
  const [testArgs, setTestArgs] = useState({});
  const [testResult, setTestResult] = useState(null);
  const [runningTest, setRunningTest] = useState(false);
  const [copiedName, setCopiedName] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [toolList, st] = await Promise.all([
        listTools().catch(() => []),
        mcpGetStatus().catch(() => null)
      ]);
      setTools(Array.isArray(toolList) ? toolList : []);
      setStatus(st);
    } catch (err) {
      console.error("[MCPToolsPage] Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredTools = tools.filter((t) => {
    const q = filterQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      t.name.toLowerCase().includes(q) ||
      (t.description && t.description.toLowerCase().includes(q))
    );
  });

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

  const isRunning = Boolean(status?.running);
  const isPortConflict = status?.errorCode === "EADDRINUSE";

  return (
    <div className="knowledge-graph-page ahp-root" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
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

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", maxWidth: "1200px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        {/* Status Banner */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 16px",
            borderRadius: "8px",
            background: isPortConflict
              ? "rgba(239, 68, 68, 0.1)"
              : isRunning
              ? "rgba(16, 185, 129, 0.08)"
              : "var(--bg-card)",
            border: isPortConflict
              ? "1px solid var(--status-danger-border, #ef4444)"
              : isRunning
              ? "1px solid var(--status-success-border, #10b981)"
              : "1px solid var(--border-subtle)",
            marginBottom: "20px",
            flexWrap: "wrap",
            gap: "12px"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Server size={18} style={{ color: isPortConflict ? "#ef4444" : isRunning ? "#10b981" : "var(--text-muted)" }} />
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <strong style={{ fontSize: "13px" }}>Notely MCP Server</strong>
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: "10px",
                    fontSize: "11px",
                    fontWeight: 600,
                    background: isPortConflict ? "rgba(239, 68, 68, 0.2)" : isRunning ? "rgba(16, 185, 129, 0.2)" : "var(--bg-muted)",
                    color: isPortConflict ? "#ef4444" : isRunning ? "#10b981" : "var(--text-muted)"
                  }}
                >
                  {isPortConflict ? "Port Conflict" : isRunning ? `Running (Port ${status?.port || 3700})` : "Stopped"}
                </span>
              </div>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                {isRunning
                  ? `Exposing ${tools.length} capabilities to external AI clients over SSE at http://${status?.host || "127.0.0.1"}:${status?.port || 3700}/sse`
                  : "Start the server from MCP Settings to allow external AI connections."}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              Active Sessions: <strong>{status?.activeSessions || 0}</strong>
            </span>
          </div>
        </div>

        {/* Search & Tool Count Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", gap: "16px" }}>
          <div>
            <h2 style={{ fontSize: "16px", margin: 0, fontWeight: 600 }}>Registered Tools</h2>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--text-muted)" }}>
              External AI agents can discover and invoke these tools via MCP protocol.
            </p>
          </div>

          <div style={{ position: "relative", width: "260px" }}>
            <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input
              type="text"
              placeholder="Filter tools by name or description…"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="text-input"
              style={{ width: "100%", paddingLeft: "32px", fontSize: "12px", height: "32px", boxSizing: "border-box" }}
            />
          </div>
        </div>

        {/* Tool Cards */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>Loading tools catalog…</div>
        ) : filteredTools.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)", background: "var(--bg-card)", borderRadius: "8px" }}>
            No tools match your query.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {filteredTools.map((tool) => {
              const isExpanded = expandedTool === tool.name;
              const hasProps = tool.inputSchema?.properties && Object.keys(tool.inputSchema.properties).length > 0;
              const propKeys = hasProps ? Object.keys(tool.inputSchema.properties) : [];
              const requiredKeys = Array.isArray(tool.inputSchema?.required) ? tool.inputSchema.required : [];

              return (
                <div
                  key={tool.name}
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "8px",
                    overflow: "hidden"
                  }}
                >
                  {/* Tool summary bar */}
                  <div
                    style={{
                      padding: "12px 16px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      cursor: "pointer",
                      userSelect: "none"
                    }}
                    onClick={() => setExpandedTool(isExpanded ? null : tool.name)}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          width: "30px",
                          height: "30px",
                          borderRadius: "6px",
                          background: "var(--bg-subtle)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--accent-default)"
                        }}
                      >
                        <Wrench size={16} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <code style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-strong)" }}>{tool.name}</code>
                          <button
                            type="button"
                            className="btn-link"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToolName(tool.name);
                            }}
                            title="Copy tool name"
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "2px" }}
                          >
                            {copiedName === tool.name ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                          </button>
                        </div>
                        <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--text-muted)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                          {tool.description}
                        </p>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                        {propKeys.length} param{propKeys.length !== 1 ? "s" : ""}
                      </span>
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>

                  {/* Expanded detail pane */}
                  {isExpanded && (
                    <div style={{ borderTop: "1px solid var(--border-subtle)", padding: "16px", background: "var(--bg-subtle)" }}>
                      {/* Parameters Table */}
                      <h4 style={{ margin: "0 0 8px", fontSize: "12px", fontWeight: 600 }}>Parameters Schema</h4>
                      {propKeys.length === 0 ? (
                        <p style={{ margin: "0 0 16px", fontSize: "12px", color: "var(--text-muted)" }}>No parameters required.</p>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "16px" }}>
                          {propKeys.map((k) => {
                            const prop = tool.inputSchema.properties[k];
                            const isReq = requiredKeys.includes(k);
                            return (
                              <div
                                key={k}
                                style={{
                                  display: "flex",
                                  alignItems: "flex-start",
                                  gap: "8px",
                                  padding: "6px 10px",
                                  background: "var(--bg-card)",
                                  borderRadius: "6px",
                                  fontSize: "12px"
                                }}
                              >
                                <code style={{ fontWeight: 600, color: "var(--accent-default)" }}>{k}</code>
                                <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>({prop.type || "any"})</span>
                                {isReq && (
                                  <span style={{ color: "var(--status-danger-text, #ef4444)", fontSize: "10px", fontWeight: 600 }}>REQUIRED</span>
                                )}
                                <span style={{ flex: 1, color: "var(--text-muted)" }}>{prop.description || "—"}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Interactive Test Runner */}
                      <div style={{ background: "var(--bg-card)", borderRadius: "6px", padding: "12px", border: "1px solid var(--border-subtle)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                          <span style={{ fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
                            <Code size={14} /> Test Execution
                          </span>
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={runningTest}
                            onClick={() => handleRunTool(tool)}
                            style={{ fontSize: "11px", padding: "4px 10px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                          >
                            <Play size={12} /> {runningTest ? "Running..." : "Execute Tool"}
                          </button>
                        </div>

                        <textarea
                          placeholder='JSON arguments e.g. {"query": "test"} or leave empty'
                          value={testArgs[tool.name] || ""}
                          onChange={(e) => setTestArgs({ ...testArgs, [tool.name]: e.target.value })}
                          style={{
                            width: "100%",
                            height: "60px",
                            fontFamily: "monospace",
                            fontSize: "11.5px",
                            padding: "8px",
                            boxSizing: "border-box",
                            borderRadius: "4px",
                            border: "1px solid var(--border-subtle)",
                            background: "var(--bg-subtle)",
                            color: "var(--text-strong)"
                          }}
                        />

                        {/* Test Execution Result */}
                        {testResult && testResult.toolName === tool.name && (
                          <div style={{ marginTop: "10px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", fontSize: "11px" }}>
                              <span style={{ fontWeight: 600, color: testResult.response?.success ? "#10b981" : "#ef4444" }}>
                                {testResult.response?.success ? "SUCCESS" : "FAILED"}
                              </span>
                              <span style={{ color: "var(--text-muted)" }}>({testResult.durationMs}ms)</span>
                            </div>
                            <pre
                              style={{
                                background: "var(--bg-subtle)",
                                padding: "8px",
                                borderRadius: "4px",
                                fontSize: "11px",
                                maxHeight: "180px",
                                overflowY: "auto",
                                margin: 0,
                                fontFamily: "monospace"
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
  );
}

export default MCPToolsPage;
