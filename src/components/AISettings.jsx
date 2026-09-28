import React, { useEffect, useState } from 'react';
import { Save, Trash2, Zap, AlertCircle, Eye, EyeOff, Download, Database, Mic, Cpu, Network } from 'lucide-react';
import AppInput from './AppInput';
import AppSelect from './AppSelect';
import "../styles/AISettings.css";
import OverlayDialog from './OverlayDialog';
import KnowledgeGraphSettings from './KnowledgeGraphSettings';
import {
  getSTTPreferences,
  setSTTPreferences,
  checkLocalWhisperModelStatus,
  preDownloadLocalWhisperModel,
  deleteLocalWhisperModel,
} from '../services/sttService';
import {
  showSuccessToast,
  showErrorToast,
  showInfoToast,
} from '../utils/notificationUtils';
import {
  aiClearData,
  aiGetApiKey,
  aiGetPreferences,
  aiGetProviderModel,
  aiSetApiKey,
  aiSetPreferences,
  aiSetProviderModel,
  aiTestConnection,
  aiGetProviderList,
  aiGetHealth,
  aiGetModelStatus,
  onModelDownloadProgress,
  aiDownloadModel,
  aiDeleteModel,
  aiEnable,
  aiDisable
} from '../services/electronService';

const defaultPreferences = {
  enablePatternLearning: true,
  enableEmbeddings: true,
  enableRelationshipDiscovery: true
};

function normalizeProviderModels(models) {
  return (models || []).map((model) => {
    if (typeof model === 'string') {
      return { id: model, label: model, note: '' };
    }
    return {
      id: model?.id || '',
      label: model?.label || model?.id || '',
      note: model?.note || '',
    };
  }).filter((model) => model.id);
}

export const AISettingsContent = ({ _onClose }) => {
  const [providers, setProviders] = useState([]);
  const [apiKey, setApiKey] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('');
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [hfToken, setHfToken] = useState('');
  const [hfConfigured, setHfConfigured] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');
  const [plaintextKey, setPlaintextKey] = useState('');
  const [showPlaintext, setShowPlaintext] = useState(false);
  const [hfPlaintextToken, setHfPlaintextToken] = useState('');
  const [showHfPlaintext, setShowHfPlaintext] = useState(false);

  const [activeSubTab, setActiveSubTab] = useState("providers");
  const [modelStatus, setModelStatus] = useState({ downloaded: false, isDownloading: false, progress: 0 });
  const [sttSettings, setSttSettings] = useState({
    engine: "local-onnx",
    localModel: "onnx-community/whisper-tiny.en",
    language: "auto",
    defaultSourceMode: "meeting",
    autoTranscribe: true,
  });
  const [whisperModelStatus, setWhisperModelStatus] = useState({
    downloaded: false,
    isDownloading: false,
    progress: 0,
    statusText: '',
  });

  useEffect(() => {
    getSTTPreferences().then((res) => {
      if (res) setSttSettings(res);
    }).catch(() => {});
  }, []);

  // Check whether selected local Whisper model is downloaded/cached
  useEffect(() => {
    let active = true;
    const checkStatus = async () => {
      if (sttSettings.engine !== "local-onnx") return;
      try {
        const res = await checkLocalWhisperModelStatus(sttSettings.localModel);
        if (active) {
          setWhisperModelStatus(prev => ({
            ...prev,
            downloaded: Boolean(res.downloaded),
            cachedFilesCount: res.cachedFilesCount,
          }));
        }
      } catch (err) {
        console.warn('Error checking Whisper model status:', err);
      }
    };
    checkStatus();
    return () => { active = false; };
  }, [sttSettings.localModel, sttSettings.engine]);

  useEffect(() => {
    const loadModelStatus = async () => {
      try {
        const res = await aiGetModelStatus();
        if (res.success && res.data) {
          setModelStatus(res.data);
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadModelStatus();

    const unsubscribe = onModelDownloadProgress((payload) => {
      setModelStatus(prev => ({
        ...prev,
        isDownloading: true,
        progress: payload.progress,
        downloaded: payload.progress === 100
      }));
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (selectedProvider) {
      loadProviderKeyAndModel();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProvider]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setStatus('Loading configurations...');

      const listResponse = await aiGetProviderList();
      if (listResponse.success && listResponse.data) {
        setProviders(listResponse.data);
      }

      const prefsResponse = await aiGetPreferences();
      if (prefsResponse.success && prefsResponse.data) {
        setPreferences((prev) => ({ ...prev, ...prefsResponse.data }));
      }

      let activeProvider = prefsResponse.success && prefsResponse.data?.aiProvider;
      if (!activeProvider) {
        const healthRes = await aiGetHealth();
        if (healthRes?.success && healthRes?.data?.activeProvider && healthRes.data.activeProvider !== 'none') {
          activeProvider = healthRes.data.activeProvider;
        } else {
          activeProvider = 'gemini';
        }
      }

      setSelectedProvider(activeProvider);
      setStatus('');
    } catch (error) {
      setStatus(`Error loading settings: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadProviderKeyAndModel = async () => {
    if (!selectedProvider) return;
    try {
      const keyResponse = await aiGetApiKey(selectedProvider);
      if (keyResponse.success && keyResponse.data?.configured) {
        setApiKey(String(keyResponse.data?.maskedKey || ''));
        setPlaintextKey(String(keyResponse.data?.apiKey || ''));
      } else {
        setApiKey('');
        setPlaintextKey('');
      }

      const modelResponse = await aiGetProviderModel(selectedProvider);
      if (modelResponse.success && modelResponse.data?.model) {
        setSelectedModel(modelResponse.data.model);
      } else {
        const providerEntry = providers.find((p) => p.id === selectedProvider);
        setSelectedModel(providerEntry?.defaultModel || '');
      }
    } catch (err) {
      console.warn('[AI Settings] Failed to load provider details:', err.message);
    }
  };

  const handleSaveAPIKey = async () => {
    const keyToSave = showPlaintext ? plaintextKey : apiKey;
    if (!keyToSave || keyToSave.includes('...')) {
      window.dispatchEvent(new CustomEvent('app:toast', {
        detail: { message: 'Please enter a complete API key.', type: 'warning' }
      }));
      return;
    }

    try {
      setLoading(true);
      const response = await aiSetApiKey(selectedProvider, keyToSave);

      if (response.success) {
        window.dispatchEvent(new CustomEvent('app:toast', {
          detail: { message: `${selectedProvider} API key saved successfully.`, type: 'success' }
        }));
        setApiKey(keyToSave.substring(0, 5) + '...' + keyToSave.substring(keyToSave.length - 5));
        setPlaintextKey(keyToSave);
      } else {
        window.dispatchEvent(new CustomEvent('app:toast', {
          detail: { message: `Failed to save key: ${response.error}`, type: 'error' }
        }));
      }
    } catch (error) {
      window.dispatchEvent(new CustomEvent('app:toast', {
        detail: { message: `Error saving key: ${error.message}`, type: 'error' }
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveHfToken = async () => {
    const tokenToSave = showHfPlaintext ? hfPlaintextToken : hfToken;
    if (!tokenToSave || tokenToSave.includes('...')) {
      window.dispatchEvent(new CustomEvent('app:toast', {
        detail: { message: 'Please enter a complete HuggingFace token.', type: 'warning' }
      }));
      return;
    }

    try {
      setLoading(true);
      const response = await aiSetApiKey('huggingface', tokenToSave);
      if (response.success) {
        window.dispatchEvent(new CustomEvent('app:toast', {
          detail: { message: 'HuggingFace token saved successfully.', type: 'success' }
        }));
        setHfToken(tokenToSave.substring(0, 5) + '...' + tokenToSave.substring(tokenToSave.length - 5));
        setHfPlaintextToken(tokenToSave);
        setHfConfigured(true);
      } else {
        window.dispatchEvent(new CustomEvent('app:toast', {
          detail: { message: `Failed to save HuggingFace token: ${response.error}`, type: 'error' }
        }));
      }
    } catch (error) {
      window.dispatchEvent(new CustomEvent('app:toast', {
        detail: { message: `Error: ${error.message}`, type: 'error' }
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setLoading(true);
      setStatus('Testing connection...');
      setTestResult(null);

      const payloadKey = showPlaintext ? plaintextKey : apiKey;
      const res = await aiTestConnection({ provider: selectedProvider, apiKey: payloadKey });

      setTestResult(res);
      if (res.success) {
        setStatus(`Connection to ${selectedProvider} successful!`);
        window.dispatchEvent(new CustomEvent('app:toast', {
          detail: { message: `Connected to ${selectedProvider} successfully!`, type: 'success' }
        }));
      } else {
        setStatus(`Connection failed: ${res.error}`);
        window.dispatchEvent(new CustomEvent('app:toast', {
          detail: { message: `Connection failed: ${res.error}`, type: 'error' }
        }));
      }
    } catch (err) {
      setStatus(`Test failed: ${err.message}`);
      window.dispatchEvent(new CustomEvent('app:toast', {
        detail: { message: `Error: ${err.message}`, type: 'error' }
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleTestHfConnection = async () => {
    try {
      setLoading(true);
      setStatus('Testing HuggingFace connection...');
      const res = await aiTestConnection({ provider: 'huggingface' });
      if (res.success) {
        setStatus('HuggingFace connection successful!');
        window.dispatchEvent(new CustomEvent('app:toast', {
          detail: { message: 'HuggingFace embeddings connected successfully!', type: 'success' }
        }));
      } else {
        setStatus(`HuggingFace connection failed: ${res.error}`);
        window.dispatchEvent(new CustomEvent('app:toast', {
          detail: { message: `HuggingFace connection failed: ${res.error}`, type: 'error' }
        }));
      }
    } catch (err) {
      setStatus(`HuggingFace test failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClearData = async () => {
    if (!window.confirm('Are you sure you want to clear all learned patterns, cache, and interaction histories?')) {
      return;
    }
    try {
      setLoading(true);
      const res = await aiClearData();
      if (res.success) {
        window.dispatchEvent(new CustomEvent('app:toast', {
          detail: { message: 'AI local data cleared successfully.', type: 'success' }
        }));
      } else {
        window.dispatchEvent(new CustomEvent('app:toast', {
          detail: { message: `Failed to clear data: ${res.error}`, type: 'error' }
        }));
      }
    } catch (err) {
      window.dispatchEvent(new CustomEvent('app:toast', {
        detail: { message: `Error clearing data: ${err.message}`, type: 'error' }
      }));
    } finally {
      setLoading(false);
    }
  };

  const handlePreferenceChange = (key, val) => {
    setPreferences((prev) => ({ ...prev, [key]: val }));
  };

  const getCapabilityWarnings = () => {
    const warnings = [];
    if (!selectedProvider) return warnings;
    const selectedProv = providers.find((p) => p.id === selectedProvider);
    if (!selectedProv) return warnings;

    if (!selectedProv.capabilities.embeddings) {
      warnings.push({
        title: 'Semantic search unavailable',
        message: `${selectedProv.name} doesn't support embeddings. Use Gemini or configure HuggingFace separately.`
      });
    }
    if (!selectedProv.capabilities.semanticSearch) {
      warnings.push({
        title: 'Relationship discovery disabled',
        message: `${selectedProv.name} cannot discover semantic relationships. Workspace clustering unavailable.`
      });
    }
    return warnings;
  };

  const isAIEnabled = preferences.aiEnabled !== false;

  return (
    <div className="ai-settings-inner-wrap">
        {status ? (
          <div className={`ai-settings-status ${testResult?.success ? 'success' : testResult?.success === false ? 'error' : 'info'}`}>
            {status}
          </div>
        ) : null}

        {/* AI Master Switch */}
        <div className="ai-settings-master-switch-card" style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 16px",
          borderRadius: "8px",
          border: "1px solid var(--border-soft)",
          background: "var(--background-soft)",
          marginBottom: "16px"
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontWeight: "700", color: "var(--text-strong)", fontSize: "14px" }}>
              Enable AI Subsystem
            </span>
          </div>
          <label style={{ display: "inline-flex", alignItems: "center", cursor: "pointer", position: "relative", width: "40px", height: "20px" }}>
            <input
              type="checkbox"
              checked={isAIEnabled}
              onChange={async (e) => {
                const checked = e.target.checked;
                const nextPrefs = { ...preferences, aiEnabled: checked };
                setPreferences(nextPrefs);
                try {
                  if (checked) {
                    await aiEnable();
                  } else {
                    await aiDisable();
                  }
                  await aiSetPreferences(nextPrefs);
                  window.dispatchEvent(new CustomEvent('app:toast', {
                    detail: { message: `AI Subsystem ${checked ? 'enabled' : 'disabled'}.`, type: 'success' }
                  }));
                } catch (err) {
                  window.dispatchEvent(new CustomEvent('app:toast', {
                    detail: { message: `Failed to toggle AI: ${err.message}`, type: 'error' }
                  }));
                }
              }}
              style={{ opacity: 0, width: 0, height: 0 }}
            />
            <span style={{
              position: "absolute",
              top: 0, left: 0, right: 0, bottom: 0,
              background: isAIEnabled ? "var(--accent-solid)" : "var(--border-default)",
              borderRadius: "20px",
              transition: "background var(--motion-standard)",
              cursor: "pointer"
            }}>
              <span style={{
                position: "absolute",
                height: "16px",
                width: "16px",
                left: isAIEnabled ? "22px" : "2px",
                bottom: "2px",
                background: "var(--surface-bg, #fff)",
                borderRadius: "50%",
                transition: "left var(--motion-standard)",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.2)"
              }} />
            </span>
          </label>
        </div>

        <div style={{ opacity: isAIEnabled ? 1 : 0.5, pointerEvents: isAIEnabled ? "auto" : "none", transition: "opacity var(--motion-standard)" }}>
        <div className="ai-segmented-tabs-bar" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeSubTab === "providers"}
            className={`ai-segmented-tab-btn ${activeSubTab === "providers" ? "active" : ""}`}
            onClick={() => setActiveSubTab("providers")}
          >
            <Cpu size={14} />
            <span>Models</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeSubTab === "embeddings"}
            className={`ai-segmented-tab-btn ${activeSubTab === "embeddings" ? "active" : ""}`}
            onClick={() => setActiveSubTab("embeddings")}
          >
            <Database size={14} />
            <span>Embeddings</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeSubTab === "graph"}
            className={`ai-segmented-tab-btn ${activeSubTab === "graph" ? "active" : ""}`}
            onClick={() => setActiveSubTab("graph")}
          >
            <Network size={14} />
            <span>Graph</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeSubTab === "stt"}
            className={`ai-segmented-tab-btn ${activeSubTab === "stt" ? "active" : ""}`}
            onClick={() => setActiveSubTab("stt")}
          >
            <Mic size={14} />
            <span>Audio</span>
          </button>
        </div>

        <div className="ai-settings-content">
          {activeSubTab === "providers" && (
            <>
              <section className="ai-settings-section ai-settings-setup-card">
                <div className="ai-settings-setup-head" style={{ marginBottom: "6px" }}>
                  <h3>Providers Setup</h3>
                </div>

                <div className="preference-group compact" style={{ marginBottom: "12px" }}>
                  <label htmlFor="active-provider-select" style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-strong)" }}>Active Text Provider</label>
                  <AppSelect
                    id="active-provider-select"
                    value={selectedProvider || 'gemini'}
                    onChange={async (e) => {
                      const val = e.target.value;
                      setSelectedProvider(val);
                      const updatedPrefs = { ...preferences, aiProvider: val };
                      setPreferences(updatedPrefs);
                      try {
                        await aiSetPreferences(updatedPrefs);
                        window.dispatchEvent(new CustomEvent('app:toast', {
                          detail: { message: `Active provider set to ${val}.`, type: 'success' }
                        }));
                      } catch (err) {
                        console.error('Failed to set active provider:', err);
                      }
                    }}
                    disabled={loading}
                    style={{ width: "100%", marginTop: "4px" }}
                  >
                    {providers.filter(p => p.available).map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </AppSelect>
                </div>

                <div className="api-key-group compact" style={{ marginBottom: "8px" }}>
                  <label htmlFor="api-key" style={{ fontSize: "11px" }}>
                      {selectedProvider ? (selectedProvider.charAt(0).toUpperCase() + selectedProvider.slice(1)) : 'API'} Key
                    </label>
                    <div className="api-key-combined-row" style={{ marginTop: "2px" }}>
                      <div className="api-key-input-wrapper" style={{ position: "relative", flex: 1, minWidth: 0, display: "flex", alignItems: "center" }}>
                        <AppInput
                          id="api-key"
                          type={showPlaintext ? "text" : "password"}
                          className="api-key-input"
                          placeholder="Enter API Key"
                          value={showPlaintext ? plaintextKey : apiKey}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (showPlaintext) {
                              setPlaintextKey(val);
                            } else {
                              setApiKey(val);
                              setPlaintextKey(val);
                            }
                          }}
                          disabled={loading}
                          style={{ paddingRight: "26px", width: "100%" }}
                        />
                        <button
                          className="api-key-toggle-eye"
                          onClick={() => setShowPlaintext(!showPlaintext)}
                          type="button"
                          title={showPlaintext ? "Hide Key" : "Show Key"}
                          style={{
                            position: "absolute",
                            right: "6px",
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "var(--text-muted)",
                            padding: "4px",
                            outline: "none"
                          }}
                        >
                          {showPlaintext ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                      {(() => {
                        const providerEntry = providers.find((p) => p.id === selectedProvider);
                        const providerModels = normalizeProviderModels(providerEntry?.models);
                        if (!providerModels.length) return null;
                        return (
                          <AppSelect
                            id="provider-model"
                            className="provider-model-select"
                            value={selectedModel}
                            onChange={async (e) => {
                              const model = e.target.value;
                              setSelectedModel(model);
                              setPreferences(prev => ({
                                ...prev,
                                providerModels: {
                                  ...(prev.providerModels || {}),
                                  [selectedProvider]: model
                                }
                              }));
                              await aiSetProviderModel(selectedProvider, model);
                            }}
                            disabled={loading}
                          >
                            {providerModels.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.note ? `${m.label} — ${m.note}` : m.label}
                              </option>
                            ))}
                          </AppSelect>
                        );
                      })()}
                      <button
                        className="btn btn-primary"
                        onClick={handleSaveAPIKey}
                        disabled={loading || !(showPlaintext ? plaintextKey : apiKey)}
                        type="button"
                      >
                        <Save size={12} /> Save
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={handleTestConnection}
                        disabled={loading || !(showPlaintext ? plaintextKey : apiKey)}
                        type="button"
                      >
                        <Zap size={12} /> Test
                      </button>
                    </div>
                    
                    {/* Provider-specific details and helper links */}
                    <div style={{ marginTop: "8px", fontSize: "11px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
                      {selectedProvider === "groq" && (
                        <span>API Keys available at <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-solid)", textDecoration: "underline" }}>console.groq.com/keys</a></span>
                      )}
                      {selectedProvider === "gemini" && (
                        <span>API Keys available at <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-solid)", textDecoration: "underline" }}>aistudio.google.com/app/apikey</a></span>
                      )}
                      {selectedProvider === "openai" && (
                        <span>API Keys available at <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-solid)", textDecoration: "underline" }}>platform.openai.com/api-keys</a></span>
                      )}
                    </div>
                  </div>

                {getCapabilityWarnings().length > 0 && (
                  <div className="ai-settings-capability-warnings" style={{ marginTop: "4px", marginBottom: "8px", display: "flex", flexDirection: "column", gap: "2px" }}>
                    {getCapabilityWarnings().map((warning, idx) => (
                      <div key={idx} style={{ display: "flex", gap: "6px", background: "var(--status-warning-bg)", border: "1px solid var(--status-warning-border)", borderRadius: "4px", padding: "6px" }}>
                        <AlertCircle size={12} style={{ color: "var(--text-warning)" }} />
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontSize: "10px", fontWeight: "600", color: "var(--text-strong)" }}>{warning.title}</span>
                          <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>{warning.message}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Advanced Features & Storage */}
                <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid var(--border-soft)" }}>
                  <h4 style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)", margin: "0 0 8px 0" }}>
                    Advanced & Local Storage
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "12px" }}>
                    <label className="checkbox-label" style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "0.85rem" }}>
                      <input
                        type="checkbox"
                        checked={preferences.enablePatternLearning}
                        onChange={(e) => {
                          const val = e.target.checked;
                          handlePreferenceChange('enablePatternLearning', val);
                          aiSetPreferences({ ...preferences, enablePatternLearning: val });
                        }}
                        disabled={loading}
                      />
                      <span>Learn user writing patterns</span>
                    </label>
                    <label className="checkbox-label" style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "0.85rem" }}>
                      <input
                        type="checkbox"
                        checked={preferences.enableEmbeddings}
                        onChange={(e) => {
                          const val = e.target.checked;
                          handlePreferenceChange('enableEmbeddings', val);
                          aiSetPreferences({ ...preferences, enableEmbeddings: val });
                        }}
                        disabled={loading}
                      />
                      <span>Generate vector embeddings automatically</span>
                    </label>
                    <label className="checkbox-label" style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "0.85rem" }}>
                      <input
                        type="checkbox"
                        checked={preferences.enableRelationshipDiscovery}
                        onChange={(e) => {
                          const val = e.target.checked;
                          handlePreferenceChange('enableRelationshipDiscovery', val);
                          aiSetPreferences({ ...preferences, enableRelationshipDiscovery: val });
                        }}
                        disabled={loading}
                      />
                      <span>Discover semantic relationships between notes</span>
                    </label>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "var(--surface-muted)", borderRadius: "6px", border: "1px solid var(--border-soft)", fontSize: "11px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <span style={{ fontWeight: "600", color: "var(--text-strong)" }}>Local AI Memory & Cache</span>
                      <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>Data stored in <code>.notes-app/ai-memory.db</code></span>
                    </div>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={handleClearData}
                      disabled={loading}
                      type="button"
                      style={{ color: "var(--text-danger)", display: "flex", alignItems: "center", gap: "4px", padding: "4px 8px", fontSize: "11px" }}
                    >
                      <Trash2 size={12} /> Clear AI Data
                    </button>
                  </div>
                </div>
              </section>
            </>
          )}

          {activeSubTab === "embeddings" && (
            <section className="ai-settings-section ai-settings-setup-card">
              <div className="ai-settings-setup-head" style={{ marginBottom: "6px" }}>
                <h3>Embeddings Setup</h3>
              </div>

              <div className="preference-group compact" style={{ marginBottom: "8px" }}>
                <label htmlFor="embedding-provider-select" style={{ fontSize: "11px" }}>Active Embedding Provider</label>
                <div style={{ display: "flex", gap: "5px", alignItems: "center", marginTop: "2px" }}>
                  <AppSelect
                    id="embedding-provider-select"
                    value={preferences.embeddingProvider || 'internal'}
                    onChange={(e) => handlePreferenceChange('embeddingProvider', e.target.value)}
                    disabled={loading}
                    style={{ flex: 1 }}
                  >
                    <option value="internal">Local Model (BGE ONNX)</option>
                    <option value="huggingface">HuggingFace Inference API</option>
                  </AppSelect>
                  <button
                    className="btn btn-primary"
                    onClick={async () => {
                      try {
                        setLoading(true);
                        // Fetch current preference first to see if it changed
                        const curPrefsRes = await aiGetPreferences();
                        const curEmb = curPrefsRes.success && curPrefsRes.data ? curPrefsRes.data.embeddingProvider : 'internal';
                        const nextEmb = preferences.embeddingProvider;
                        
                        let confirmRebuild = false;
                        if (curEmb !== nextEmb) {
                          confirmRebuild = window.confirm(`Changing your embedding provider from "${curEmb === 'internal' ? 'Local BGE' : 'HuggingFace'}" to "${nextEmb === 'internal' ? 'Local BGE' : 'HuggingFace'}" requires invalidating and rebuilding your vector search cache. Do you want to wipe and rebuild the index now?`);
                        }

                        const response = await aiSetPreferences({
                          ...preferences,
                          embeddingProvider: nextEmb
                        });

                        if (response.success) {
                          if (confirmRebuild) {
                            const { aiClearEmbeddingsData, aiRebuildEmbeddings } = await import('../services/electronService');
                            await aiClearEmbeddingsData();
                            await aiRebuildEmbeddings();
                          }
                          window.dispatchEvent(new CustomEvent('app:toast', {
                            detail: { message: `Active embedding provider set to ${nextEmb === 'internal' ? 'Local Model' : 'HuggingFace'} and saved.`, type: 'success' }
                          }));
                        } else {
                          window.dispatchEvent(new CustomEvent('app:toast', {
                            detail: { message: `Failed to save embedding provider: ${response.error}`, type: 'error' }
                          }));
                        }
                      } catch (err) {
                        window.dispatchEvent(new CustomEvent('app:toast', {
                          detail: { message: `Error: ${err.message}`, type: 'error' }
                        }));
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading}
                    type="button"
                  >
                    <Save size={12} /> Save
                  </button>
                </div>
              </div>

              {preferences.embeddingProvider === 'huggingface' && (
                <div className="api-key-group compact" style={{ background: "var(--surface-muted)", padding: "6px 8px", borderRadius: "6px", border: "1px solid var(--border-soft)", marginTop: "6px" }}>
                  <p className="ai-settings-embeddings-info" style={{ margin: "0 0 6px 0", fontSize: "10px", color: "var(--text-secondary)" }}>
                    Uses HuggingFace Inference API free tier. Get a token at huggingface.co.
                  </p>
                  <label htmlFor="hf-token" style={{ fontSize: "10px" }}>HuggingFace Token (hf_…)</label>
                  <div className="api-key-input-group" style={{ display: "flex", gap: "5px", width: "100%", marginTop: "2px" }}>
                    <div className="api-key-input-wrapper" style={{ position: "relative", flex: 1, minWidth: 0, display: "flex", alignItems: "center" }}>
                      <AppInput
                        id="hf-token"
                        type={showHfPlaintext ? "text" : "password"}
                        className="api-key-input"
                        placeholder="hf_xxxxxxxxxxxxxxxxxx"
                        value={showHfPlaintext ? hfPlaintextToken : hfToken}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (showHfPlaintext) {
                            setHfPlaintextToken(val);
                          } else {
                            setHfToken(val);
                            setHfPlaintextToken(val);
                          }
                        }}
                        disabled={loading}
                        style={{ paddingRight: "26px", width: "100%" }}
                      />
                      <button
                        className="api-key-toggle-eye"
                        onClick={() => setShowHfPlaintext(!showHfPlaintext)}
                        type="button"
                        title={showHfPlaintext ? "Hide Token" : "Show Token"}
                        style={{
                          position: "absolute",
                          right: "6px",
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--text-muted)",
                          padding: "4px",
                          outline: "none"
                        }}
                      >
                        {showHfPlaintext ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    <button
                      className="btn btn-primary"
                      onClick={handleSaveHfToken}
                      disabled={loading || !(showHfPlaintext ? hfPlaintextToken : hfToken)}
                      type="button"
                    >
                      <Save size={12} /> Save
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={handleTestHfConnection}
                      disabled={loading || !hfConfigured}
                      type="button"
                    >
                      <Zap size={12} /> Test
                    </button>
                  </div>
                </div>
              )}

              {((preferences.embeddingProvider || 'internal') === 'internal' || !modelStatus.downloaded) && (
                <div style={{ padding: "8px 10px", background: "var(--surface-muted)", borderRadius: "6px", border: "1px solid var(--border-soft)", marginTop: "6px" }}>
                  <h4 style={{ fontSize: "11px", fontWeight: "600", margin: "0 0 4px 0" }}>Local Model Status (BGE ONNX)</h4>
                  {modelStatus.downloaded ? (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--status-success-text)", fontSize: "11px" }}>
                        <Database size={12} />
                        <span>bge-small-en-v1.5 model is downloaded and ready offline.</span>
                      </div>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={async () => {
                          if (!window.confirm('Delete local BGE embedding model weights from disk? You can redownload it at any time.')) return;
                          try {
                            setLoading(true);
                            await aiDeleteModel();
                            setModelStatus({ downloaded: false, isDownloading: false, progress: 0 });
                            window.dispatchEvent(new CustomEvent('app:toast', {
                              detail: { message: 'Local BGE embedding model weights deleted.', type: 'info' }
                            }));
                          } catch (err) {
                            console.error(err);
                          } finally {
                            setLoading(false);
                          }
                        }}
                        disabled={loading}
                        style={{ display: "flex", gap: "4px", alignItems: "center", padding: "4px 8px", fontSize: "10px", color: "var(--text-danger)" }}
                        title="Remove model weights from disk to free space or redownload"
                      >
                        <Trash2 size={12} />
                        <span>Delete Model</span>
                      </button>
                    </div>
                  ) : modelStatus.isDownloading ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px" }}>
                        <span>Downloading local weights...</span>
                        <span>{modelStatus.progress}%</span>
                      </div>
                      <div style={{ width: "100%", height: "4px", background: "var(--border-soft)", borderRadius: "2px", overflow: "hidden" }}>
                        <div style={{ width: `${modelStatus.progress}%`, height: "100%", background: "var(--accent-solid)" }}></div>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={async () => {
                        try {
                          const res = await aiDownloadModel();
                          if (res.success) {
                            setModelStatus(prev => ({ ...prev, isDownloading: true, progress: 0 }));
                          }
                        } catch (err) {
                          console.error(err);
                        }
                      }}
                      style={{ display: "flex", gap: "6px", alignItems: "center", padding: "6px 12px" }}
                    >
                      <Download size={12} />
                      <span>Download local model (130MB)</span>
                    </button>
                  )}
                </div>
              )}
            </section>
          )}

          {activeSubTab === "graph" && (
            <div style={{ gridColumn: "1 / -1" }}>
              <KnowledgeGraphSettings />
            </div>
          )}



          {activeSubTab === "stt" && (
            <>
              <section className="ai-settings-section ai-settings-setup-card" style={{ gridColumn: "1 / -1" }}>
                <div className="ai-settings-setup-head" style={{ marginBottom: "14px" }}>
                  <h3>Speech-to-Text & Transcription</h3>
                </div>

                <div className="preference-group" style={{ marginBottom: "14px" }}>
                  <label htmlFor="stt-engine-select" style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-strong)" }}>
                    Transcription Engine & Model
                  </label>
                  <AppSelect
                    id="stt-engine-select"
                    value={sttSettings.engine === "local-onnx" ? `local-onnx:${sttSettings.localModel}` : sttSettings.engine}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val.startsWith("local-onnx:")) {
                        const model = val.replace("local-onnx:", "");
                        setSttSettings(prev => ({ ...prev, engine: "local-onnx", localModel: model }));
                      } else {
                        setSttSettings(prev => ({ ...prev, engine: val }));
                      }
                    }}
                    style={{ marginTop: "4px" }}
                  >
                    <optgroup label="Local ONNX Whisper (Offline, In-Browser / WebAssembly)">
                      <option value="local-onnx:onnx-community/whisper-tiny.en">Local: whisper-tiny.en (~40MB, English, Fastest)</option>
                      <option value="local-onnx:onnx-community/whisper-base.en">Local: whisper-base.en (~140MB, English, Balanced)</option>
                      <option value="local-onnx:onnx-community/whisper-small">Local: whisper-small (~460MB, Multilingual, Accurate)</option>
                    </optgroup>
                    <optgroup label="Cloud Whisper">
                      <option value="groq">Groq Cloud Whisper (Ultra-Fast whisper-large-v3)</option>
                      <option value="openai">OpenAI Cloud Whisper (whisper-1)</option>
                    </optgroup>
                  </AppSelect>
                  <small style={{ display: "block", marginTop: "4px", color: "var(--text-muted)", fontSize: "11px" }}>
                    {sttSettings.engine === "local-onnx" && "Runs completely on-device without sending audio to the cloud."}
                    {sttSettings.engine === "groq" && "Uses your configured Groq API key from Connection & Providers for near-instant transcription."}
                    {sttSettings.engine === "openai" && "Uses your configured OpenAI API key from Connection & Providers."}
                  </small>
                </div>

                {sttSettings.engine === "local-onnx" && (
                  <div className="preference-group" style={{ marginBottom: "14px" }}>

                    <div style={{
                      padding: "10px 12px",
                      background: "var(--surface-muted)",
                      borderRadius: "6px",
                      border: "1px solid var(--border-soft)",
                      marginTop: "8px",
                      minHeight: "68px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center"
                    }}>
                      <h4 style={{ fontSize: "11px", fontWeight: "600", margin: "0 0 6px 0" }}>Local ONNX Model Cache Status</h4>
                      {whisperModelStatus.downloaded ? (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--status-success-text)", fontSize: "11px" }}>
                            <Database size={12} />
                            <span>{sttSettings.localModel.split("/")[1] || sttSettings.localModel} is downloaded and ready offline.</span>
                          </div>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={async () => {
                              if (!window.confirm(`Delete local weights for ${sttSettings.localModel} from browser cache? You can redownload anytime.`)) return;
                              try {
                                setLoading(true);
                                await deleteLocalWhisperModel(sttSettings.localModel);
                                setWhisperModelStatus({ downloaded: false, isDownloading: false, progress: 0, statusText: '' });
                                showInfoToast('Local Whisper model cache cleared.');
                              } catch (err) {
                                showErrorToast(`Failed to delete model: ${err.message}`);
                              } finally {
                                setLoading(false);
                              }
                            }}
                            disabled={loading || whisperModelStatus.isDownloading}
                            style={{ display: "flex", gap: "4px", alignItems: "center", padding: "4px 8px", fontSize: "10px", color: "var(--text-danger)", flexShrink: 0 }}
                            title="Remove model weights from browser cache storage to free disk space"
                            type="button"
                          >
                            <Trash2 size={12} />
                            <span>Delete Model</span>
                          </button>
                        </div>
                      ) : whisperModelStatus.isDownloading ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px" }}>
                            <span>{whisperModelStatus.statusText || 'Downloading ONNX model weights...'}</span>
                            <span>{whisperModelStatus.progress}%</span>
                          </div>
                          <div style={{ width: "100%", height: "4px", background: "var(--border-soft)", borderRadius: "2px", overflow: "hidden" }}>
                            <div style={{ width: `${whisperModelStatus.progress}%`, height: "100%", background: "var(--accent-solid)", transition: "width 0.2s ease" }}></div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                          <span style={{ fontSize: "11px", color: "var(--text-muted)", flex: "1 1 auto" }}>
                            Model not yet downloaded. Download now for offline use or it will download automatically on first transcription.
                          </span>
                          <button
                            className="btn btn-secondary btn-sm"
                            type="button"
                            onClick={async () => {
                              try {
                                setWhisperModelStatus(prev => ({ ...prev, isDownloading: true, progress: 0, statusText: 'Initializing download...' }));
                                await preDownloadLocalWhisperModel(sttSettings.localModel, (info) => {
                                  if (info?.status === "progress" && typeof info.progress === "number") {
                                    const percent = Math.min(100, Math.round(info.progress));
                                    const fileLabel = info.file ? ` (${info.file})` : '';
                                    setWhisperModelStatus(prev => ({
                                      ...prev,
                                      progress: percent,
                                      statusText: `Downloading${fileLabel}...`,
                                    }));
                                  } else if (info?.status === "done") {
                                    setWhisperModelStatus(prev => ({ ...prev, progress: 100, statusText: 'Finalizing model...' }));
                                  }
                                });

                                const res = await checkLocalWhisperModelStatus(sttSettings.localModel);
                                setWhisperModelStatus({
                                  downloaded: Boolean(res.downloaded) || true,
                                  isDownloading: false,
                                  progress: 100,
                                  statusText: '',
                                });
                                showSuccessToast(`${sttSettings.localModel.split("/")[1] || sttSettings.localModel} downloaded and ready offline.`);
                              } catch (err) {
                                console.error('Failed to download Whisper model:', err);
                                setWhisperModelStatus(prev => ({ ...prev, isDownloading: false, progress: 0, statusText: '' }));
                                showErrorToast(`Download failed: ${err.message}`);
                              }
                            }}
                            style={{ display: "flex", gap: "6px", alignItems: "center", padding: "6px 12px", whiteSpace: "nowrap", flexShrink: 0 }}
                          >
                            <Download size={12} />
                            <span>
                              Download Model ({sttSettings.localModel.includes('small') ? '~460MB' : sttSettings.localModel.includes('base') ? '~140MB' : '~40MB'})
                            </span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="preference-group" style={{ marginBottom: "14px" }}>
                  <label htmlFor="stt-language-select" style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-strong)" }}>
                    Primary Spoken Language
                  </label>
                    <AppSelect
                      id="stt-language-select"
                      value={sttSettings.language}
                      onChange={(e) => setSttSettings(prev => ({ ...prev, language: e.target.value }))}
                      style={{ marginTop: "4px" }}
                    >
                      <option value="auto">Auto-Detect</option>
                      <option value="en">English</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                      <option value="de">German</option>
                      <option value="it">Italian</option>
                      <option value="ja">Japanese</option>
                      <option value="zh">Chinese</option>
                    </AppSelect>
                  </div>

                <div className="preference-checkboxes" style={{ marginBottom: "16px" }}>
                  <label className="checkbox-label" style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "0.85rem" }}>
                    <input
                      type="checkbox"
                      checked={Boolean(sttSettings.autoTranscribe)}
                      onChange={(e) => setSttSettings(prev => ({ ...prev, autoTranscribe: e.target.checked }))}
                    />
                    <span>Automatically generate speech-to-text transcript when audio recording completes</span>
                  </label>
                </div>

                <div className="ai-settings-inline-actions" style={{ marginTop: "8px" }}>
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={async () => {
                      try {
                        setLoading(true);
                        await setSTTPreferences(sttSettings);
                        showSuccessToast('Speech-to-Text preferences saved successfully.');
                      } catch (err) {
                        showErrorToast(`Failed to save STT preferences: ${err.message}`);
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading}
                  >
                    <Save size={14} /> Save STT Settings
                  </button>
                </div>
              </section>
            </>
          )}
      </div>
      </div>
    </div>
  );
};

export default function AISettings({ open, onClose }) {
  return (
    <OverlayDialog open={open} onClose={onClose} title="AI Settings">
      <AISettingsContent _onClose={onClose} />
    </OverlayDialog>
  );
}
