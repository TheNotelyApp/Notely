import React, { useEffect, useState } from "react";
import { Sparkles, Activity, AlertTriangle, CheckCircle, Pause } from "lucide-react";
import { aiGetHealth, aiGetPreferences } from "../services/electronService";

export function AIStatusBar({ onClick }) {
  const [status, setStatus] = useState("disabled"); // disabled, idle, indexing, error
  const [provider, setProvider] = useState("");

  const updateStatus = async () => {
    try {
      const prefs = await aiGetPreferences();
      const aiEnabled = prefs?.aiEnabled !== false;

      if (!aiEnabled) {
        setStatus("disabled");
        setProvider("");
        return;
      }

      const health = await aiGetHealth();
      if (health?.success && health.data) {
        setProvider(health.data.activeProvider || "Unknown");
        if (health.data.isIndexing) {
          setStatus("indexing");
        } else if (health.data.isPaused) {
          setStatus("paused");
        } else {
          setStatus("idle");
        }
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  useEffect(() => {
    updateStatus();
    const interval = setInterval(updateStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  let Icon = Sparkles;
  let label = "AI Disabled";
  let className = "terminal-meta-pill";
  let color = "var(--text-muted)";

  if (status === "idle") {
    Icon = CheckCircle;
    label = `AI: Ready (${provider})`;
    color = "var(--accent-solid)";
  } else if (status === "indexing") {
    Icon = Activity;
    label = "AI: Indexing...";
    color = "var(--accent-warning)";
  } else if (status === "paused") {
    Icon = Pause;
    label = "AI: Paused";
    color = "var(--text-muted)";
  } else if (status === "error") {
    Icon = AlertTriangle;
    label = "AI Error";
    color = "var(--accent-danger)";
  }

  return (
    <span
      className={className}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        cursor: "pointer",
        color,
        fontWeight: 600,
        transition: "color var(--motion-standard)",
      }}
      data-tooltip="Click to open AI Settings & Diagnostics"
    >
      <Icon size={12} className={status === "indexing" ? "animate-pulse" : ""} />
      <span>{label}</span>
    </span>
  );
}

export default AIStatusBar;
