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
  Globe,
  Radio
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
import "../styles/MCPSettings.css";

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
  const [allowWriteInput, setAllowWriteInput] = useState(true);

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
        setAllowWriteInput(cfg.allowWriteTools !== undefined ? Boolean(cfg.allowWriteTools) : true);
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
        bearerToken: tokenInput,
        allowWriteTools: allowWriteInput
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
  const isPortConflict = status?.errorCode === "EADDRINUSE" || (status?.error && status.error.includes("in use"));

  return (
    <div className="mcp-settings-container">
      {/* Top Hero / Status Card */}
      <div className={`mcp-hero-card ${isPortConflict ? "is-conflict" : isRunning ? "is-running" : ""}`}>
        <div className="mcp-hero-header">
          <div className="mcp-hero-info">
            <div className="mcp-hero-icon">
              <Server size={20} />
            </div>
            <div className="mcp-hero-title-group">
              <div className="mcp-hero-title-row">
                <h3 className="mcp-hero-title">Notely MCP Server</h3>
                <span className={`mcp-status-badge ${isPortConflict ? "is-conflict" : isRunning ? "is-running" : ""}`}>
                  <span className="mcp-status-badge-dot" />
                  {loading ? "Loading..." : isPortConflict ? "Port Conflict" : isRunning ? "Running" : "Stopped"}
                </span>
                <span className={`mcp-status-badge ${allowWriteInput ? "is-running" : ""}`} style={{ background: allowWriteInput ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: allowWriteInput ? 'var(--status-success-text)' : 'var(--status-danger-text)', border: '1px solid currentColor' }}>
                  {allowWriteInput ? "Read-Write Mode" : "Read-Only Mode"}
                </span>
              </div>
              <p className="mcp-hero-subtitle">
                {isPortConflict
                  ? `Port ${status?.port || portInput} is in use by another app. Choose a different port below.`
                  : isRunning
                  ? `Listening on ${sseUrl} • 50 Tools Available`
                  : "Server is currently stopped."}
              </p>
            </div>
          </div>

          <div className="mcp-hero-actions">
            {isRunning ? (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleRestart}
                  title="Restart MCP Server"
                >
                  <RotateCw size={14} /> Restart
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleStop}
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
                title="Start Server"
              >
                <Play size={14} /> Start Server
              </button>
            )}
          </div>
        </div>

        {/* Port Conflict Banner */}
        {isPortConflict && (
          <div className="mcp-alert-banner is-conflict">
            <AlertCircle size={14} />
            <span>
              Port {status?.port || portInput} is blocked. Change the port below and click <strong>Save &amp; Apply</strong>.
            </span>
          </div>
        )}

        {/* SSE Endpoint Bar */}
        {isRunning && (
          <div className="mcp-sse-bar">
            <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
              <Radio size={14} style={{ color: "var(--accent-solid)", flexShrink: 0 }} />
              <code className="mcp-sse-url">{sseUrl}</code>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={copySseUrl}
              style={{ fontSize: "11px", padding: "4px 8px" }}
            >
              {copiedUrl ? <Check size={12} /> : <Copy size={12} />}
              {copiedUrl ? "Copied" : "Copy URL"}
            </button>
          </div>
        )}
      </div>

      {/* Configuration Form */}
      <form onSubmit={handleSave} className="mcp-form-card">
        <h4 className="mcp-card-heading">
          <Shield size={16} /> Server Configuration
        </h4>

        {/* Enable Toggle */}
        <div className="mcp-form-row">
          <div>
            <label className="mcp-field-label">Enable MCP Server</label>
            <span className="mcp-field-help">
              Start the Model Context Protocol server on application launch {config?.isTokenProtected ? "(Protected)" : ""}
            </span>
          </div>
          <label className="mcp-toggle-label">
            <input
              type="checkbox"
              className="mcp-toggle-input"
              checked={enabledInput}
              onChange={(e) => setEnabledInput(e.target.checked)}
            />
            <span className="mcp-toggle-slider" />
          </label>
        </div>

        {/* Allow Write Tools Toggle */}
        <div className="mcp-form-row" style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--border-soft)" }}>
          <div>
            <label className="mcp-field-label">Allow Write &amp; Modification Tools</label>
            <span className="mcp-field-help">
              Enable external AI clients to create, edit, delete notes, custom personas, diagrams, and assets. When disabled, write operations are blocked.
            </span>
          </div>
          <label className="mcp-toggle-label">
            <input
              type="checkbox"
              className="mcp-toggle-input"
              checked={allowWriteInput}
              onChange={(e) => setAllowWriteInput(e.target.checked)}
            />
            <span className="mcp-toggle-slider" />
          </label>
        </div>

        {/* Port & Host row */}
        <div className="mcp-form-grid">
          <div className="mcp-field-group">
            <label htmlFor="mcp-port-input" className="mcp-field-label">
              Server Port
            </label>
            <input
              id="mcp-port-input"
              type="number"
              min="1024"
              max="65535"
              value={portInput}
              onChange={(e) => setPortInput(e.target.value)}
              className="mcp-input"
              placeholder="3700"
            />
            <span className="mcp-field-help">Default: 3700</span>
          </div>

          <div className="mcp-field-group">
            <label htmlFor="mcp-host-input" className="mcp-field-label">
              Host Binding
            </label>
            <select
              id="mcp-host-input"
              value={hostInput}
              onChange={(e) => setHostInput(e.target.value)}
              className="mcp-select"
            >
              <option value="127.0.0.1">127.0.0.1 (Local loopback only)</option>
              <option value="0.0.0.0">0.0.0.0 (Allow local network access)</option>
            </select>
            <span className="mcp-field-help">Recommend 127.0.0.1 for security</span>
          </div>
        </div>

        {/* Bearer Token */}
        <div className="mcp-field-group">
          <div className="mcp-field-label">
            <label htmlFor="mcp-token-input">Bearer Authentication Token (Optional)</label>
            <button
              type="button"
              className="btn-link"
              onClick={generateRandomToken}
              style={{ fontSize: "11px", color: "var(--accent-solid)", background: "none", border: "none", cursor: "pointer" }}
            >
              Generate Token
            </button>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              id="mcp-token-input"
              type={showToken ? "text" : "password"}
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              className="mcp-input"
              style={{ flex: 1 }}
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
          <span className="mcp-field-help">
            When set, clients must send <code>Authorization: Bearer &lt;token&gt;</code> header.
          </span>
        </div>

        {/* Save button */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
            style={{ padding: "6px 16px" }}
          >
            {saving ? "Saving..." : "Save & Apply"}
          </button>
        </div>
      </form>

      {/* Integration Guide / Claude Desktop Config */}
      <div className="mcp-form-card">
        <h4 className="mcp-card-heading">
          <Globe size={16} /> Claude Desktop &amp; External Client Config
        </h4>
        <p className="mcp-field-help" style={{ margin: 0 }}>
          Add this JSON configuration to your <code>claude_desktop_config.json</code> to connect external AI tools to Notely:
        </p>

        <div className="mcp-code-container">
          <pre className="mcp-code-block">{claudeSnippet}</pre>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={copySnippet}
            style={{
              position: "absolute",
              top: "8px",
              right: "8px",
              fontSize: "11px",
              padding: "4px 8px"
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
