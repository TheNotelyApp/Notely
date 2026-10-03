import React, { useEffect, useState, useRef } from "react";
import {
  Sparkles,
  Activity,
  AlertTriangle,
  CheckCircle,
  Pause,
  Cpu,
  Layers,
  Network,
  Mic,
  Server,
  Cloud,
  ShieldAlert,
  ChevronRight,
  X,
  ExternalLink
} from "lucide-react";
import {
  aiGetHealth,
  aiGetPreferences,
  aiGetModelStatus,
  aiGetGraphModelStatus,
  aiGetProviderList,
  mcpGetStatus,
  mcpGetSessions,
  onMcpStatusChanged
} from "../services/electronService";
import {
  getSTTPreferences,
  checkLocalWhisperModelStatus
} from "../services/sttService";
import "../styles/AIStatusBar.css";

export function AIStatusBar({ onClick, onOpenMcpSettings }) {
  const [status, setStatus] = useState("disabled"); // disabled, idle, indexing, error, low_ram
  const [providerLabel, setProviderLabel] = useState("Local");
  const [isOpen, setIsOpen] = useState(false);
  const hoverTimerRef = useRef(null);
  const [modelsData, setModelsData] = useState({
    embModel: "all-MiniLM-L6-v2",
    embDownloaded: false,
    embIsLoaded: false,
    graphModel: "GLiNER2 NER",
    graphDownloaded: false,
    graphIsLoaded: false,
    sttEngine: "local-onnx",
    sttModel: "whisper-tiny.en",
    sttDownloaded: false,
    cloudProvider: null,
    cloudModel: null,
    mcpRunning: true,
    mcpPort: 3700,
    mcpError: null,
    mcpSessionsCount: 0,
    mcpToolsCount: 22,
    systemMemory: { freeMemMb: 0, totalMemMb: 0, isLowMemory: false },
    database: { totalChunks: 0, indexedNotes: 0, totalEntities: 0, totalRelations: 0 },
    mcp: { totalSessions: 0, totalToolCalls: 0 }
  });

  const updateStatus = async () => {
    try {
      const prefsRes = await aiGetPreferences();
      const prefs = prefsRes?.preferences || prefsRes;
      const aiEnabled = prefs?.aiEnabled !== false;

      if (!aiEnabled) {
        setStatus("disabled");
        setProviderLabel("Disabled");
        return;
      }

      const [healthRes, embRes, graphRes, sttPrefs, provListRes, mcpStatusRes, mcpSessionsRes] = await Promise.allSettled([
        aiGetHealth(),
        aiGetModelStatus(),
        aiGetGraphModelStatus(),
        getSTTPreferences(),
        aiGetProviderList(),
        mcpGetStatus(),
        mcpGetSessions()
      ]);

      const healthData = healthRes.status === "fulfilled" && healthRes.value?.success ? healthRes.value.data : null;
      const embData = embRes.status === "fulfilled" && embRes.value?.success ? embRes.value.data : null;
      const graphData = graphRes.status === "fulfilled" && graphRes.value?.success ? graphRes.value.data : null;
      const sttData = sttPrefs.status === "fulfilled" ? sttPrefs.value : { engine: "local-onnx", localModel: "onnx-community/whisper-tiny.en" };
      const provList = provListRes.status === "fulfilled" && provListRes.value?.success ? provListRes.value.data : [];
      const mcpStatus = mcpStatusRes.status === "fulfilled" && mcpStatusRes.value?.success ? mcpStatusRes.value.data : null;
      const mcpSessions = mcpSessionsRes.status === "fulfilled" && mcpSessionsRes.value?.success ? mcpSessionsRes.value.data : [];

      let isSttDownloaded = false;
      if (sttData.engine === "local-onnx") {
        try {
          const sttStatus = await checkLocalWhisperModelStatus(sttData.localModel);
          isSttDownloaded = Boolean(sttStatus?.downloaded);
        } catch {
          // ignore
        }
      }

      let activeCloud = null;
      if (Array.isArray(provList)) {
        const configured = provList.find(p => p.hasApiKey || p.configured || p.active);
        if (configured) {
          activeCloud = {
            provider: configured.name || configured.id,
            model: configured.selectedModel || configured.defaultModel || "Active"
          };
        }
      }

      const rawProv = healthData?.activeProvider || "";
      const displayProv = activeCloud
        ? activeCloud.provider.charAt(0).toUpperCase() + activeCloud.provider.slice(1)
        : (rawProv && rawProv !== "Unknown" ? rawProv : "Local");
      setProviderLabel(displayProv);

      const isLowMem = Boolean(healthData?.systemMemory?.isLowMemory);

      if (healthData) {
        setModelsData({
          embModel: prefs?.embeddingModel || "all-MiniLM-L6-v2",
          embDownloaded: Boolean(embData?.downloaded),
          embIsLoaded: Boolean(embData?.isLoaded),
          graphModel: "GLiNER2 NER",
          graphDownloaded: Boolean(graphData?.downloaded),
          graphIsLoaded: Boolean(graphData?.isLoaded),
          sttEngine: sttData.engine || "local-onnx",
          sttModel: sttData.engine === "local-onnx" ? (sttData.localModel?.split("/").pop() || "whisper-tiny.en") : sttData.engine,
          sttDownloaded: isSttDownloaded,
          cloudProvider: activeCloud?.provider || null,
          cloudModel: activeCloud?.model || null,
          mcpRunning: mcpStatus?.running !== false,
          mcpPort: mcpStatus?.port || 3700,
          mcpError: mcpStatus?.error || null,
          mcpSessionsCount: Array.isArray(mcpSessions) ? mcpSessions.length : (mcpStatus?.activeSessions || 0),
          mcpToolsCount: mcpStatus?.toolCount || 22,
          systemMemory: healthData.systemMemory || { freeMemMb: 0, totalMemMb: 0, isLowMemory: false },
          database: healthData.database || { totalChunks: 0, indexedNotes: 0, totalEntities: 0, totalRelations: 0 },
          mcp: healthData.mcp || { totalSessions: 0, totalToolCalls: 0 }
        });

        if (healthData.isIndexing) {
          setStatus("indexing");
        } else if (healthData.isPaused) {
          setStatus("paused");
        } else if (isLowMem) {
          setStatus("low_ram");
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
    const unsubMcp = onMcpStatusChanged?.(() => updateStatus());
    const interval = setInterval(updateStatus, 5000);
    return () => {
      unsubMcp?.();
      clearInterval(interval);
    };
  }, []);

  const handleMouseEnter = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    updateStatus();
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    hoverTimerRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 250);
  };

  const handleClose = (e) => {
    e?.stopPropagation?.();
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setIsOpen(false);
  };

  let Icon = Sparkles;
  let label = "AI: Not Ready";
  let statusClass = "ai-status-bar--disabled";

  if (status === "idle") {
    Icon = CheckCircle;
    label = `AI: Ready (${providerLabel})`;
    statusClass = "ai-status-bar--ready";
  } else if (status === "low_ram") {
    Icon = ShieldAlert;
    label = `AI: Standby (Low RAM)`;
    statusClass = "ai-status-bar--low-ram";
  } else if (status === "indexing") {
    Icon = Activity;
    label = "AI: Indexing...";
    statusClass = "ai-status-bar--indexing";
  } else if (status === "paused") {
    Icon = Pause;
    label = "AI: Paused";
    statusClass = "ai-status-bar--paused";
  } else if (status === "error") {
    Icon = AlertTriangle;
    label = "AI Error";
    statusClass = "ai-status-bar--error";
  }

  const isLowMem = modelsData.systemMemory?.isLowMemory;
  const isMcpError = Boolean(modelsData.mcpError);

  return (
    <div
      className="ai-status-bar-wrapper"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {isOpen && (
        <div
          className="vscode-status-flyout"
          role="dialog"
          aria-label="AI & Subsystem Status"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="vscode-flyout-header">
            <span className="vscode-flyout-title">AI & Subsystems</span>
            <div className="vscode-flyout-header-right">
              <span className={`vscode-flyout-status-tag ${statusClass}`}>
                {status === "low_ram" ? "Low RAM" : status === "idle" ? "Ready" : status}
              </span>
              <button
                type="button"
                className="vscode-flyout-close"
                onClick={handleClose}
                aria-label="Close"
              >
                <X size={12} />
              </button>
            </div>
          </div>

          {/* List items */}
          <div className="vscode-flyout-list">
            {/* 1. Embeddings */}
            <div className="vscode-flyout-item">
              <div className="vscode-flyout-item-icon">
                <Layers size={14} />
              </div>
              <div className="vscode-flyout-item-main">
                <div className="vscode-flyout-item-line1">
                  <span className="vscode-flyout-name">Embeddings</span>
                  <span className="vscode-flyout-pill">
                    {modelsData.embIsLoaded
                      ? "In RAM"
                      : modelsData.embDownloaded
                        ? "Idle (Cached)"
                        : "Standby"}
                  </span>
                </div>
                <div className="vscode-flyout-item-line2">
                  <code>{modelsData.embModel}</code> · {modelsData.database.totalChunks} chunks ({modelsData.database.indexedNotes} notes)
                </div>
              </div>
            </div>

            {/* 2. Knowledge Graph */}
            <div className="vscode-flyout-item">
              <div className="vscode-flyout-item-icon">
                <Network size={14} />
              </div>
              <div className="vscode-flyout-item-main">
                <div className="vscode-flyout-item-line1">
                  <span className="vscode-flyout-name">Knowledge Graph</span>
                  <span className={`vscode-flyout-pill ${isLowMem ? "warn" : ""}`}>
                    {isLowMem
                      ? "Rule Engine"
                      : modelsData.graphIsLoaded
                        ? "In RAM"
                        : modelsData.graphDownloaded
                          ? "Idle (Cached)"
                          : "Standby"}
                  </span>
                </div>
                <div className="vscode-flyout-item-line2">
                  <code>{modelsData.graphModel}</code> · {modelsData.database.totalEntities} entities, {modelsData.database.totalRelations} links
                </div>
              </div>
            </div>

            {/* 3. Audio / Whisper */}
            <div className="vscode-flyout-item">
              <div className="vscode-flyout-item-icon">
                <Mic size={14} />
              </div>
              <div className="vscode-flyout-item-main">
                <div className="vscode-flyout-item-line1">
                  <span className="vscode-flyout-name">Voice & Audio</span>
                  <span className="vscode-flyout-pill">
                    {modelsData.sttEngine === "local-onnx"
                      ? (modelsData.sttDownloaded ? "Idle (Cached)" : "On-Demand")
                      : `${modelsData.sttEngine.toUpperCase()} Cloud`}
                  </span>
                </div>
                <div className="vscode-flyout-item-line2">
                  <code>{modelsData.sttModel}</code> · {modelsData.sttEngine === "local-onnx" ? "Whisper ONNX" : "Cloud Transcription"}
                </div>
              </div>
            </div>

            {/* 4. Local MCP Server */}
            <div
              className="vscode-flyout-item clickable"
              onClick={() => {
                handleClose();
                if (typeof onOpenMcpSettings === "function") onOpenMcpSettings();
                else if (typeof onClick === "function") onClick();
              }}
              role="button"
              tabIndex={0}
            >
              <div className="vscode-flyout-item-icon">
                <Server size={14} />
              </div>
              <div className="vscode-flyout-item-main">
                <div className="vscode-flyout-item-line1">
                  <span className="vscode-flyout-name">Local MCP Server</span>
                  <span className={`vscode-flyout-pill ${isMcpError ? "error" : ""}`}>
                    :{modelsData.mcpPort}
                  </span>
                </div>
                <div className="vscode-flyout-item-line2">
                  {modelsData.mcpRunning ? "Running" : "Stopped"} · {modelsData.mcpToolsCount} tools, {modelsData.mcpSessionsCount} client{modelsData.mcpSessionsCount !== 1 ? "s" : ""}
                  <ExternalLink size={12} className="vscode-flyout-jump" />
                </div>
              </div>
            </div>

            {/* 5. Cloud LLM (if configured) */}
            {modelsData.cloudProvider && (
              <div className="vscode-flyout-item">
                <div className="vscode-flyout-item-icon">
                  <Cloud size={14} />
                </div>
                <div className="vscode-flyout-item-main">
                  <div className="vscode-flyout-item-line1">
                    <span className="vscode-flyout-name">Cloud LLM</span>
                    <span className="vscode-flyout-pill">Connected</span>
                  </div>
                  <div className="vscode-flyout-item-line2">
                    <code>{modelsData.cloudProvider}</code> · {modelsData.cloudModel}
                  </div>
                </div>
              </div>
            )}

            {/* 6. System RAM */}
            <div className="vscode-flyout-item">
              <div className="vscode-flyout-item-icon">
                <Cpu size={14} />
              </div>
              <div className="vscode-flyout-item-main">
                <div className="vscode-flyout-item-line1">
                  <span className="vscode-flyout-name">System Memory</span>
                  <span className={`vscode-flyout-pill ${isLowMem ? "warn" : ""}`}>
                    {isLowMem ? "Low RAM" : "Optimal"}
                  </span>
                </div>
                <div className="vscode-flyout-item-line2">
                  {modelsData.systemMemory.freeMemMb} MB free / {modelsData.systemMemory.totalMemMb} MB total
                </div>
              </div>
            </div>
          </div>

          {/* Footer link */}
          <button
            type="button"
            className="vscode-flyout-footer"
            onClick={(e) => {
              handleClose(e);
              onClick?.();
            }}
          >
            <span>Open AI Settings & Diagnostics</span>
            <ChevronRight size={12} />
          </button>
        </div>
      )}

      <button
        type="button"
        className={`terminal-meta-pill ai-status-bar ${statusClass}`}
        onClick={onClick}
        aria-label={label}
      >
        <Icon size={12} className={status === "indexing" ? "animate-pulse" : ""} />
        <span>{label}</span>
      </button>
    </div>
  );
}

export default AIStatusBar;
