import React, { useState, useEffect } from "react";
import { Server, AlertCircle, CheckCircle, Square } from "lucide-react";
import { mcpGetStatus, onMcpStatusChanged } from "../services/electronService";

export function MCPStatusBar({ onClick }) {
  const [status, setStatus] = useState({
    enabled: true,
    running: false,
    port: 3700,
    error: null,
    errorCode: null,
    activeSessions: 0
  });

  const updateStatus = async () => {
    try {
      const st = await mcpGetStatus();
      if (st) {
        setStatus(st);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    updateStatus();
    const unsub = onMcpStatusChanged((updatedStatus) => {
      if (updatedStatus) {
        setStatus(updatedStatus);
      }
    });
    const interval = setInterval(updateStatus, 6000);
    return () => {
      unsub?.();
      clearInterval(interval);
    };
  }, []);

  const isPortConflict = status.errorCode === "EADDRINUSE" || (status.error && status.error.includes("in use"));
  const isRunning = Boolean(status.running);

  let Icon = Server;
  let label = "MCP: Off";
  let statusClass = "ai-status-bar--disabled";
  let tooltip = "MCP Server is stopped. Click to open MCP Settings.";

  if (isPortConflict) {
    Icon = AlertCircle;
    label = `MCP: Port ${status.port} Conflict`;
    statusClass = "ai-status-bar--error";
    tooltip = `Port ${status.port} in use! Click to change port in MCP Settings.`;
  } else if (status.error) {
    Icon = AlertCircle;
    label = "MCP: Error";
    statusClass = "ai-status-bar--error";
    tooltip = `MCP Error: ${status.error}. Click to view settings.`;
  } else if (isRunning) {
    Icon = CheckCircle;
    label = status.activeSessions > 0
      ? `MCP: ${status.port} (${status.activeSessions} client${status.activeSessions > 1 ? "s" : ""})`
      : `MCP: ${status.port}`;
    statusClass = "ai-status-bar--ready";
    tooltip = `MCP Server running on port ${status.port}. Click to configure.`;
  }

  return (
    <button
      type="button"
      className={`terminal-meta-pill ai-status-bar ${statusClass}`}
      onClick={onClick}
      data-tooltip={tooltip}
      aria-label={label}
      style={{
        cursor: "pointer",
        ...(isPortConflict ? { borderColor: "var(--status-danger-border, #ef4444)", color: "var(--status-danger-text, #ef4444)" } : {})
      }}
    >
      <Icon size={12} className={isRunning && status.activeSessions > 0 ? "animate-pulse" : ""} />
      <span>{label}</span>
    </button>
  );
}

export default MCPStatusBar;
