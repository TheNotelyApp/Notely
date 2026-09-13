import React, { useEffect, useState } from "react";
import { Server, CheckCircle } from "lucide-react";
import { mcpGetStatus } from "../services/electronService";

export function AIStatusBar({ onClick }) {
  const [mcpStatus, setMcpStatus] = useState({ running: false, port: 3721 });

  const updateStatus = async () => {
    try {
      const res = await mcpGetStatus();
      if (res) {
        setMcpStatus(res);
      }
    } catch {
      setMcpStatus({ running: false, port: 3721 });
    }
  };

  useEffect(() => {
    updateStatus();
    const interval = setInterval(updateStatus, 4000);
    return () => clearInterval(interval);
  }, []);

  const isLive = mcpStatus.running;
  const Icon = isLive ? CheckCircle : Server;
  const label = isLive ? `MCP: Live (:${mcpStatus.port || 3721})` : "MCP: Stopped";
  const statusClass = isLive ? "ai-status-bar--ready" : "ai-status-bar--disabled";

  return (
    <button
      type="button"
      className={`terminal-meta-pill ai-status-bar ${statusClass}`}
      onClick={onClick}
      data-tooltip="Click to open MCP Server settings & AI configuration"
      aria-label={label}
    >
      <Icon size={12} />
      <span>{label}</span>
    </button>
  );
}

export default AIStatusBar;
