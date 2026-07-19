import React, { useEffect, useState } from 'react';
import { Key, Save, Trash2, X, Zap, AlertCircle, Eye, EyeOff } from 'lucide-react';
import AppInput from './AppInput';
import AppIconButton from './AppIconButton';
import AppSelect from './AppSelect';
import "../styles/AISettings.css";
import OverlayDialog from './OverlayDialog';
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
} from '../services/electronService';



const defaultPreferences = {
  enablePatternLearning: true,
  enableEmbeddings: true,
  enableRelationshipDiscovery: true,
  maxTokensPerQuery: 2048,
  temperature: 0.7
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
  const [embeddingStaleness, setEmbeddingStaleness] = useState(null);
  const [plaintextKey, setPlaintextKey] = useState('');
  const [showPlaintext, setShowPlaintext] = useState(false);
  const [hfPlaintextToken, setHfPlaintextToken] = useState('');
  const [showHfPlaintext, setShowHfPlaintext] = useState(false);

  const [activeSubTab, setActiveSubTab] = useState("providers");

  useEffect(() => {
    loadSettings();
    loadEmbeddingStaleness();
  }, []);

  useEffect(() => {
    if (!selectedProvider || !providers.length) return;

    const loadProviderDetails = async () => {
      try {
        setLoading(true);
        const keyResponse = await aiGetApiKey(selectedProvider);
        if (keyResponse.success && keyResponse.data?.configured) {
          setApiKey(String(keyResponse.data?.maskedKey || 'configured'));
          setPlaintextKey(String(keyResponse.data?.apiKey || ''));
        } else {
          setApiKey('');
          setPlaintextKey('');
        }

        const modelResponse = await aiGetProviderModel(selectedProvider);
        const providerEntry = providers.find((p) => p.id === selectedProvider);
        const providerModels = normalizeProviderModels(providerEntry?.models);
        setSelectedModel(
          (modelResponse?.success && modelResponse?.data?.model) ||
          providerEntry?.defaultModel ||
          providerModels[0]?.id ||
          ''
        );
      } catch (error) {
        console.error('[AISettings] Failed to load provider details:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProviderDetails();
  }, [selectedProvider, providers]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setTestResult(null);

      // Fetch dynamic providers list
      const providerListRes = await aiGetProviderList();
      if (providerListRes.success && providerListRes.data) {
        setProviders(providerListRes.data);
      }

      // Load preferences first
      const prefsResponse = await aiGetPreferences();
      if (prefsResponse.success && prefsResponse.data) {
        setPreferences({ ...defaultPreferences, ...prefsResponse.data });
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
      setPreferences((prev) => ({ ...prev, aiProvider: activeProvider }));

      const hfResponse = await aiGetApiKey('huggingface');
      if (hfResponse.success && hfResponse.data?.configured) {
        setHfToken(String(hfResponse.data?.maskedKey || 'configured'));
        setHfPlaintextToken(String(hfResponse.data?.apiKey || ''));
        setHfConfigured(true);
      } else {
        setHfToken('');
        setHfPlaintextToken('');
        setHfConfigured(false);
      }

      setStatus('');
    } catch (error) {
      setStatus(`Error loading settings: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadEmbeddingStaleness = async () => {
    setEmbeddingStaleness(null);
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

  const handleSavePreferences = async () => {
    try {
      setLoading(true);
      const response = await aiSetPreferences(preferences);

      if (response.success) {
        window.dispatchEvent(new CustomEvent('app:toast', {
          detail: { message: 'Preferences saved.', type: 'success' }
        }));
      } else {
        window.dispatchEvent(new CustomEvent('app:toast', {
          detail: { message: `Failed to save preferences: ${response.error}`, type: 'error' }
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
        setHfConfigured(true);
        setHfToken(tokenToSave.substring(0, 5) + '...' + tokenToSave.substring(tokenToSave.length - 4));
        setHfPlaintextToken(tokenToSave);
        window.dispatchEvent(new CustomEvent('app:toast', {
          detail: { message: 'HuggingFace token saved successfully.', type: 'success' }
        }));
      } else {
        window.dispatchEvent(new CustomEvent('app:toast', {
          detail: { message: `Failed to save token: ${response.error}`, type: 'error' }
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

  const handleTestHfConnection = async () => {
    try {
      setLoading(true);
      const response = await aiTestConnection('huggingface', showHfPlaintext ? hfPlaintextToken : hfToken);
      if (response.success) {
        window.dispatchEvent(new CustomEvent('app:toast', {
          detail: { message: 'Embeddings connected successfully.', type: 'success' }
        }));
      } else {
        window.dispatchEvent(new CustomEvent('app:toast', {
          detail: { message: `Embeddings connection failed: ${response.error || 'Unknown error'}`, type: 'error' }
        }));
      }
    } catch (error) {
      window.dispatchEvent(new CustomEvent('app:toast', {
        detail: { message: `Embeddings connection error: ${error.message}`, type: 'error' }
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setLoading(true);
      const testKey = showPlaintext ? plaintextKey : apiKey;
      console.log(`[AISettings] Testing connection with key prefix: ${testKey ? testKey.slice(0, 7) : 'empty'}, length: ${testKey ? testKey.length : 0}`);
      const response = await aiTestConnection(selectedProvider, testKey);
      if (response.success) {
        window.dispatchEvent(new CustomEvent('app:toast', {
          detail: { message: `Connected successfully to ${selectedProvider}.`, type: 'success' }
        }));
      } else {
        window.dispatchEvent(new CustomEvent('app:toast', {
          detail: { message: `${selectedProvider} connection failed: ${response.error || 'Unknown error'}`, type: 'error' }
        }));
      }
    } catch (err) {
      window.dispatchEvent(new CustomEvent('app:toast', {
        detail: { message: `${selectedProvider} connection error: ${err.message}`, type: 'error' }
      }));
    } finally {
      setLoading(false);
    }
  };

  const handlePreferenceChange = (key, value) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
  };

  const handleClearData = async () => {
    try {
      setLoading(true);
      const response = await aiClearData();
      if (response.success) {
        setStatus('AI cached data cleared.');
        loadEmbeddingStaleness();
        setTimeout(() => setStatus(''), 3000);
      } else {
        setStatus(response.error || 'Failed to clear AI data.');
      }
    } catch (err) {
      setStatus(err?.message || 'Failed to clear AI data.');
    } finally {
      setLoading(false);
    }
  };

  const getCapabilityWarnings = () => {
    const selectedProv = providers.find((p) => p.id === selectedProvider);
    if (!selectedProv || !selectedProv.capabilities) return [];

    const warnings = [];
    if (!selectedProv.capabilities.embeddings && preferences.enableEmbeddings) {
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

  return (
    <div className="ai-settings-inner-wrap">
        {status ? (
          <div className={`ai-settings-status ${testResult?.success ? 'success' : testResult?.success === false ? 'error' : 'info'}`}>
            {status}
          </div>
        ) : null}

        <div className="ai-subtabs-nav" role="tablist" style={{ display: "flex", gap: "16px", marginBottom: "16px", borderBottom: "1px solid var(--border-soft)", paddingBottom: "8px" }}>
          <button
            type="button"
            role="tab"
            aria-selected={activeSubTab === "providers"}
            className={`ai-subtab-btn ${activeSubTab === "providers" ? "active" : ""}`}
            style={{
              background: "transparent",
              border: "none",
              borderBottom: activeSubTab === "providers" ? "2px solid var(--accent-solid)" : "2px solid transparent",
              color: activeSubTab === "providers" ? "var(--text-strong)" : "var(--text-muted)",
              padding: "4px 8px",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "0.85rem"
            }}
            onClick={() => setActiveSubTab("providers")}
          >
            Connection & Providers
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeSubTab === "tuning"}
            className={`ai-subtab-btn ${activeSubTab === "tuning" ? "active" : ""}`}
            style={{
              background: "transparent",
              border: "none",
              borderBottom: activeSubTab === "tuning" ? "2px solid var(--accent-solid)" : "2px solid transparent",
              color: activeSubTab === "tuning" ? "var(--text-strong)" : "var(--text-muted)",
              padding: "4px 8px",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "0.85rem"
            }}
            onClick={() => setActiveSubTab("tuning")}
          >
            Tuning & Behavior
          </button>
        </div>

        <div className="ai-settings-content">
          {activeSubTab === "providers" ? (
            <>
              <section className="ai-settings-section ai-settings-embeddings-card">
                <div className="ai-settings-setup-head">
                  <h3>Embeddings</h3>
                  <span className={`ai-settings-badge ${hfConfigured ? 'badge-ok' : 'badge-off'}`}>
                    {hfConfigured ? 'Active' : 'Not configured'}
                  </span>
                </div>
                <p className="ai-settings-embeddings-info">
                  Powers semantic search and the workspace graph — works with any text provider (Groq or Gemini).
                  Uses <strong>HuggingFace Inference API</strong> free tier. Get a token at <strong>huggingface.co</strong>.
                </p>
                <div className="api-key-group compact">
                  <label htmlFor="hf-token">HuggingFace Token (hf_…)</label>
                  <div className="api-key-input-group" style={{ display: "flex", gap: "5px", width: "100%" }}>
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
              </section>

              <section className="ai-settings-section ai-settings-setup-card">
                <div className="ai-settings-setup-head">
                  <h3>Text Provider</h3>
                  <span className="ai-settings-badge">On device</span>
                </div>
                <div className="preference-group compact" style={{ marginBottom: "16px" }}>
                  <label htmlFor="active-provider-select">Active Text Provider</label>
                  <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
                    <AppSelect
                      id="active-provider-select"
                      value={selectedProvider || 'gemini'}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedProvider(val);
                        setPreferences((prev) => ({ ...prev, aiProvider: val }));
                      }}
                      disabled={loading}
                      style={{ flex: 1 }}
                    >
                      {providers.filter(p => p.available).map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </AppSelect>
                    <button
                      className="btn btn-primary"
                      onClick={async () => {
                        try {
                          setLoading(true);
                          const updatedPrefs = { ...preferences, aiProvider: selectedProvider };
                          setPreferences(updatedPrefs);
                          const response = await aiSetPreferences(updatedPrefs);
                          if (response.success) {
                            window.dispatchEvent(new CustomEvent('app:toast', {
                              detail: { message: `Active provider set to ${selectedProvider} and saved.`, type: 'success' }
                            }));
                          } else {
                            window.dispatchEvent(new CustomEvent('app:toast', {
                              detail: { message: `Failed to save active provider: ${response.error}`, type: 'error' }
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
                      disabled={loading || !selectedProvider}
                      type="button"
                    >
                      <Save size={12} /> Save
                    </button>
                  </div>
                </div>
                <div className="api-key-group compact">
                  <label htmlFor="api-key">
                    {selectedProvider.charAt(0).toUpperCase() + selectedProvider.slice(1)} API Key
                  </label>
                  <div className="api-key-combined-row">
                    <div className="api-key-input-wrapper" style={{ position: "relative", flex: 1, minWidth: 0, display: "flex", alignItems: "center" }}>
                      <AppInput
                        id="api-key"
                        type={showPlaintext ? "text" : "password"}
                        className="api-key-input"
                        placeholder="Enter your API key"
                        value={showPlaintext ? plaintextKey : apiKey}
                        onChange={(event) => {
                          const val = event.target.value;
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
                      <Key size={12} /> Save
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
                </div>

                {getCapabilityWarnings().length > 0 && (
                  <div className="ai-settings-capability-warnings">
                    {getCapabilityWarnings().map((warning, idx) => (
                      <div key={idx} className="capability-warning">
                        <AlertCircle size={14} />
                        <div>
                          <strong>{warning.title}</strong>
                          <p>{warning.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {embeddingStaleness && (
                  <div className="ai-settings-embedding-staleness">
                    <span>Embeddings: {embeddingStaleness.message}</span>
                  </div>
                )}
              </section>
            </>
          ) : (
            <>
              <section className="ai-settings-section ai-settings-features-card" style={{ gridColumn: "1 / -1" }}>
                <h3>Features</h3>
                <div className="ai-settings-option-list">
                  <label className="preference-checkbox ai-settings-option-row">
                    <input
                      type="checkbox"
                      checked={preferences.enablePatternLearning}
                      onChange={(event) => handlePreferenceChange('enablePatternLearning', event.target.checked)}
                      disabled={loading}
                    />
                    <span>Learn user patterns</span>
                  </label>
                  <label className="preference-checkbox ai-settings-option-row">
                    <input
                      type="checkbox"
                      checked={preferences.enableEmbeddings}
                      onChange={(event) => handlePreferenceChange('enableEmbeddings', event.target.checked)}
                      disabled={loading}
                    />
                    <span>Generate embeddings</span>
                  </label>
                  <label className="preference-checkbox ai-settings-option-row">
                    <input
                      type="checkbox"
                      checked={preferences.enableRelationshipDiscovery}
                      onChange={(event) => handlePreferenceChange('enableRelationshipDiscovery', event.target.checked)}
                      disabled={loading}
                    />
                    <span>Discover relationships</span>
                  </label>
                </div>
              </section>

              <section className="ai-settings-section ai-settings-generation-card" style={{ gridColumn: "1 / -1" }}>
                <h3>Generation</h3>
                <div className="ai-settings-range-row">
                  <div className="ai-settings-range-label">
                    <span>Max tokens</span>
                    <strong>{preferences.maxTokensPerQuery}</strong>
                  </div>
                  <AppInput
                    type="range"
                    min="512"
                    max="8192"
                    step="256"
                    value={preferences.maxTokensPerQuery}
                    onChange={(event) => handlePreferenceChange('maxTokensPerQuery', parseInt(event.target.value, 10))}
                    disabled={loading}
                    className="slider"
                  />
                </div>
                <div className="ai-settings-range-row">
                  <div className="ai-settings-range-label">
                    <span>Temperature</span>
                    <strong>{preferences.temperature.toFixed(2)}</strong>
                  </div>
                  <AppInput
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={preferences.temperature}
                    onChange={(event) => handlePreferenceChange('temperature', parseFloat(event.target.value))}
                    disabled={loading}
                    className="slider"
                  />
                </div>
                <div className="ai-settings-inline-actions compact">
                  <button
                    className="btn btn-primary"
                    onClick={handleSavePreferences}
                    disabled={loading}
                    type="button"
                  >
                    <Save size={12} /> Save
                  </button>
                </div>
              </section>

              <section className="ai-settings-section ai-settings-storage-card" style={{ gridColumn: "1 / -1" }}>
                <div className="ai-settings-storage-meta">
                  <div className="ai-settings-meta-pill">Local only</div>
                  <div className="ai-settings-meta-pill">SQLite memory</div>
                  <div className="ai-settings-meta-pill">Private persona</div>
                </div>
                <div className="data-management compact">
                  <div className="ai-settings-storage-copy">
                    <strong>Data paths</strong>
                    <span><code>.notes-app/app.sqlite</code></span>
                    <span><code>%APPDATA%/Notely/ai-config.json</code></span>
                  </div>
                  <button
                    className="btn btn-danger"
                    onClick={handleClearData}
                    disabled={loading}
                    type="button"
                  >
                    <Trash2 size={12} /> Clear AI data
                  </button>
                </div>
              </section>
            </>
          )}
        </div>
    </div>
  );
};

export const AISettings = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  return (
    <OverlayDialog
      open={isOpen}
      onClose={onClose}
      ariaLabel="AI settings"
      cardClassName="ai-settings-dialog-card"
    >
      <div className="overlay-dialog-header ai-settings-dialog-header">
        <div className="ai-settings-title-group">
          <h2>AI Settings</h2>
          <p>Connect providers, tune behavior, and manage local AI data.</p>
        </div>
        <AppIconButton onClick={onClose} aria-label="Close AI settings">
          <X size={16} />
        </AppIconButton>
      </div>

      <AISettingsContent onClose={onClose} />

      <div className="ai-settings-footer">
        <button className="btn btn-secondary" onClick={onClose} type="button">
          <X size={12} /> Close
        </button>
      </div>
    </OverlayDialog>
  );
};

export default AISettings;
