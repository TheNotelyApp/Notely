import React, { useState, useEffect, useCallback } from "react";
import {
  Server,
  Play,
  Square,
  RotateCw,
  Copy,
  Check,
  AlertCircle,
  Shield,
  Key,
  Globe,
  Radio,
  ExternalLink,
  Users
} from "lucide-react";
import {
  mcpGetStatus,
  mcpGetConfig,
  mcpSetConfig,
  mcpStart,
  mcpStop,
  mcpRestart,
  onMcpStatusChanged
} from "../services/electronService";
import "../styles/AISettings.css";

export function MCPSettingsContent({ notify }) {
  const [config, setConfig] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [showToken, setShowToken] = useState(false);

  const [portInput, setPortInput] = useState("3700");
  const [hostInput, setHostInput] = useState("127.0.0.1");
  const [tokenInput, setTokenInput] = useState("");
  const [enabledInput, setEnabledInput] = useState(true);

  const fetchState = useCallback(async () => {
    try {
      setLoading(true);
      const [cfg, st] = await Promise.all([mcpGetConfig(), mcpGetStatus()]);
      if (cfg) {
        setConfig(cfg);
        setPortInput(String(cfg.port || 3700));
        setHostInput(cfg.host || "127.0.0.1");
        setTokenInput(cfg.bearerToken || "");
        setEnabledInput(Boolean(cfg.enabled));
      }
      if (st) {
        setStatus(st);
      }
    } catch (err) {
      console.error("[MCPSettings] Load error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchState();
    const unsub = onMcpStatusChanged((updatedStatus) => {
      setStatus(updatedStatus);
    });
    return () => unsub?.();
  }, [fetchState]);

  const handleSave = async (e) => {
    e?.preventDefault();
    const portNum = parseInt(portInput, 10);
    if (isNaN(portNum) || portNum < 1024 || portNum > 65535) {
      notify?.("Port must be a valid integer between 1024 and 65535.", "error");
      return;
    }

    try {
      setSaving(true);
      const res = await mcpSetConfig({
        enabled: enabledInput,
        port: portNum,
        host: hostInput,
        bearerToken: tokenInput
      });

      if (res?.config) {
        setConfig(res.config);
      }
      if (res?.status) {
        setStatus(res.status);
      }

      if (res?.status?.error) {
        notify?.(`MCP Configuration saved, but server error: ${res.status.error}`, "warning");
      } else {
        notify?.("MCP Server configuration saved.", "success");
      }
    } catch (err) {
      notify?.(`Failed to save configuration: ${err.message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleStart = async () => {
    try {
      const st = await mcpStart();
      setStatus(st);
      if (st?.error) {
        notify?.(st.error, "error");
      } else {
        notify?.("MCP Server started.", "success");
      }
    } catch (err) {
      notify?.(err.message, "error");
    }
  };

  const handleStop = async () => {
    try {
      const st = await mcpStop();
      setStatus(st);
      notify?.("MCP Server stopped.", "info");
    } catch (err) {
      notify?.(err.message, "error");
    }
  };

  const handleRestart = async () => {
    try {
      const st = await mcpRestart();
      setStatus(st);
      if (st?.error) {
        notify?.(st.error, "warning");
      } else {
        notify?.("MCP Server restarted.", "success");
      }
    } catch (err) {
      notify?.(err.message, "error");
    }
  };

  const sseUrl = `http://${status?.host || hostInput || "127.0.0.1"}:${status?.port || portInput || "3700"}/sse`;

  const copySseUrl = () => {
    navigator.clipboard.writeText(sseUrl);
    setCopiedUrl(true);
    notify?.("MCP SSE URL copied to clipboard.", "success");
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const claudeSnippet = JSON.stringify(
    {
      mcpServers: {
        notely: {
          url: sseUrl,
          ...(tokenInput.trim() ? { headers: { Authorization: `Bearer ${tokenInput.trim()}` } } : {})
        }
      }
    },
    null,
    2
  );

  const copySnippet = () => {
    navigator.clipboard.writeText(claudeSnippet);
    setCopiedSnippet(true);
    notify?.("Claude Desktop config snippet copied.", "success");
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  const generateRandomToken = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let token = "ntly_";
    for (let i = 0; i < 24; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setTokenInput(token);
  };

  const isRunning = Boolean(status?.running);
  const isError = Boolean(status?.error);
  const isPortConflict = status?.errorCode === "EADDRINUSE" || (status?.error && status.error.includes("in use"));

  return (
    <div className="ai-settings-container" style={{ padding: "0" }}>
      {/* Top Hero / Status Card */}
      <div
        className="settings-section"
        style={{
          border: isPortConflict
            ? "1px solid var(--status-danger-border, #ef4444)"
            : isRunning
            ? "1px solid var(--status-success-border, #10b981)"
            : "1px solid var(--border-subtle)",
          borderRadius: "8px",
          padding: "16px",
          background: isPortConflict
            ? "rgba(239, 68, 68, 0.06)"
            : isRunning
            ? "rgba(16, 185, 129, 0.05)"
            : "var(--bg-card)",
          marginBottom: "16px"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: isPortConflict ? "#ef4444" : isRunning ? "#10b981" : "var(--bg-muted)",
                color: "#fff"
              }}
            >
              <Server size={18} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 600 }}>Notely MCP Server</h3>
                <span
                  className={`status-badge ${isPortConflict ? "status-badge-error" : isRunning ? "status-badge-active" : "status-badge-idle"}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "2px 8px",
                    borderRadius: "12px",
                    fontSize: "11px",
                    fontWeight: 600,
                    background: isPortConflict ? "rgba(239, 68, 68, 0.15)" : isRunning ? "rgba(16, 185, 129, 0.15)" : "var(--bg-muted)",
                    color: isPortConflict ? "#ef4444" : isRunning ? "#10b981" : "var(--text-muted)"
                  }}
                >
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: isPortConflict ? "#ef4444" : isRunning ? "#10b981" : "var(--text-muted)"
                    }}
                  />
                  {isPortConflict ? "Port Conflict" : isRunning ? "Running" : "Stopped"}
                </span>
              </div>
              <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--text-muted)" }}>
                {isPortConflict
                  ? `Port ${status?.port || portInput} is in use by another app. Choose a different port below.`
                  : isRunning
                  ? `Listening on ${sseUrl}`
                  : "Server is currently stopped."}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {isRunning ? (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleRestart}
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px" }}
                  title="Restart MCP Server"
                >
                  <RotateCw size={14} /> Restart
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleStop}
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--status-danger-text, #ef4444)" }}
                  title="Stop Server"
                >
                  <Square size={14} /> Stop
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleStart}
                disabled={isPortConflict}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px" }}
                title="Start Server"
              >
                <Play size={14} /> Start Server
              </button>
            )}
          </div>
        </div>

        {/* Port Conflict Banner */}
        {isPortConflict && (
          <div
            style={{
              marginTop: "12px",
              padding: "8px 12px",
              borderRadius: "6px",
              background: "rgba(239, 68, 68, 0.12)",
              color: "#ef4444",
              fontSize: "12px",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            <AlertCircle size={14} />
            <span>
              Port {status?.port || portInput} is blocked. Change the port below (e.g. 3701 or 3750) and click <strong>Save &amp; Apply</strong>.
            </span>
          </div>
        )}

        {/* SSE Endpoint Bar */}
        {isRunning && (
          <div
            style={{
              marginTop: "12px",
              padding: "8px 12px",
              borderRadius: "6px",
              background: "var(--bg-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "8px"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
              <Radio size={14} style={{ color: "var(--accent-default)", flexShrink: 0 }} />
              <code style={{ fontSize: "12px", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                {sseUrl}
              </code>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={copySseUrl}
              style={{ fontSize: "11px", padding: "4px 8px", display: "inline-flex", alignItems: "center", gap: "4px" }}
            >
              {copiedUrl ? <Check size={12} /> : <Copy size={12} />}
              {copiedUrl ? "Copied" : "Copy URL"}
            </button>
          </div>
        )}
      </div>

      {/* Configuration Form */}
      <form onSubmit={handleSave} className="settings-section" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <h4 style={{ margin: "0 0 4px", fontSize: "13px", fontWeight: 600 }}>Configuration</h4>

        {/* Enable Toggle */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <label style={{ fontSize: "13px", fontWeight: 500, display: "block" }}>Enable MCP Server</label>
            <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
              Start the Model Context Protocol server on application launch
            </span>
          </div>
          <label className="toggle-switch" style={{ cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={enabledInput}
              onChange={(e) => setEnabledInput(e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        {/* Port & Host row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div>
            <label htmlFor="mcp-port-input" style={{ fontSize: "12px", fontWeight: 500, display: "block", marginBottom: "4px" }}>
              Server Port
            </label>
            <input
              id="mcp-port-input"
              type="number"
              min="1024"
              max="65535"
              value={portInput}
              onChange={(e) => setPortInput(e.target.value)}
              className="text-input"
              style={{ width: "100%", fontSize: "12px" }}
              placeholder="3700"
            />
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Default: 3700</span>
          </div>

          <div>
            <label htmlFor="mcp-host-input" style={{ fontSize: "12px", fontWeight: 500, display: "block", marginBottom: "4px" }}>
              Host Binding
            </label>
            <select
              id="mcp-host-input"
              value={hostInput}
              onChange={(e) => setHostInput(e.target.value)}
              className="select-input"
              style={{ width: "100%", fontSize: "12px", height: "34px" }}
            >
              <option value="127.0.0.1">127.0.0.1 (Local loopback only)</option>
              <option value="0.0.0.0">0.0.0.0 (Allow local network access)</option>
            </select>
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Recommend 127.0.0.1 for security</span>
          </div>
        </div>

        {/* Bearer Token */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
            <label htmlFor="mcp-token-input" style={{ fontSize: "12px", fontWeight: 500 }}>
              Bearer Authentication Token (Optional)
            </label>
            <button
              type="button"
              className="btn-link"
              onClick={generateRandomToken}
              style={{ fontSize: "11px", color: "var(--accent-default)", background: "none", border: "none", cursor: "pointer" }}
            >
              Generate Secret Token
            </button>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              id="mcp-token-input"
              type={showToken ? "text" : "password"}
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              className="text-input"
              style={{ flex: 1, fontSize: "12px" }}
              placeholder="Leave blank for no authentication"
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowToken(!showToken)}
              style={{ fontSize: "11px", padding: "0 10px" }}
            >
              {showToken ? "Hide" : "Show"}
            </button>
          </div>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            When set, clients must send <code>Authorization: Bearer &lt;token&gt;</code> with every request.
          </span>
        </div>

        {/* Save button */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
            style={{ fontSize: "12px", padding: "6px 14px" }}
          >
            {saving ? "Saving..." : "Save & Apply"}
          </button>
        </div>
      </form>

      {/* Integration Guide / Claude Desktop Config */}
      <div className="settings-section" style={{ marginTop: "16px" }}>
        <h4 style={{ margin: "0 0 6px", fontSize: "13px", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
          <Globe size={14} /> Claude Desktop &amp; External Client Config
        </h4>
        <p style={{ margin: "0 0 10px", fontSize: "12px", color: "var(--text-muted)" }}>
          Add this to your <code>claude_desktop_config.json</code> or your external MCP client settings to connect to Notely:
        </p>

        <div style={{ position: "relative" }}>
          <pre
            style={{
              background: "var(--bg-subtle)",
              padding: "12px",
              borderRadius: "6px",
              fontSize: "11.5px",
              overflowX: "auto",
              fontFamily: "monospace",
              margin: 0
            }}
          >
            {claudeSnippet}
          </pre>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={copySnippet}
            style={{
              position: "absolute",
              top: "8px",
              right: "8px",
              fontSize: "11px",
              padding: "4px 8px",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px"
            }}
          >
            {copiedSnippet ? <Check size={12} /> : <Copy size={12} />}
            {copiedSnippet ? "Copied" : "Copy JSON"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default MCPSettingsContent;
