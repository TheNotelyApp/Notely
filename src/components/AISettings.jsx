import React, { useState, useEffect } from 'react';
import './AISettings.css';

/**
 * AISettings - Dedicated settings panel for AI agent configuration
 * Access via menu: Top Menu > AI Settings
 */
const AISettings = ({ isOpen, onClose }) => {
  const [apiKey, setApiKey] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('gemini');
  const [preferences, setPreferences] = useState({
    enablePatternLearning: true,
    enableEmbeddings: true,
    enableRelationshipDiscovery: true,
    maxTokensPerQuery: 2048,
    temperature: 0.7
  });
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const providers = [
    { id: 'gemini', name: 'Google Gemini', description: 'Fast, multimodal AI' },
    { id: 'openai', name: 'OpenAI', description: 'GPT-4, GPT-3.5' },
    { id: 'local', name: 'Local LLM', description: 'Ollama, LM Studio' }
  ];

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      
      // Load API key
      const keyResponse = await window.electron.ipcRenderer.invoke('ai:config:get-api-key', {
        provider: selectedProvider
      });
      
      if (keyResponse.success && keyResponse.data?.apiKey) {
        // Mask the key for display
        const key = keyResponse.data.apiKey;
        setApiKey(key.substring(0, 5) + '...' + key.substring(key.length - 5));
      }

      // Load preferences
      const prefsResponse = await window.electron.ipcRenderer.invoke('ai:config:get-preferences', {});
      if (prefsResponse.success && prefsResponse.data) {
        setPreferences(prefsResponse.data);
      }

      setStatus('Settings loaded');
    } catch (error) {
      setStatus(`Error loading settings: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAPIKey = async () => {
    if (!apiKey || apiKey.includes('...')) {
      setStatus('Please enter a complete API key');
      return;
    }

    try {
      setLoading(true);
      
      const response = await window.electron.ipcRenderer.invoke('ai:config:set-api-key', {
        provider: selectedProvider,
        apiKey
      });

      if (response.success) {
        setStatus(`✓ ${selectedProvider} API key saved securely`);
        // Mask the key after saving
        setApiKey(apiKey.substring(0, 5) + '...' + apiKey.substring(apiKey.length - 5));
      } else {
        setStatus(`✗ Failed to save: ${response.error}`);
      }
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePreferences = async () => {
    try {
      setLoading(true);

      const response = await window.electron.ipcRenderer.invoke('ai:config:set-preferences', {
        preferences
      });

      if (response.success) {
        setStatus('✓ Preferences saved');
      } else {
        setStatus(`✗ Failed to save preferences: ${response.error}`);
      }
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setLoading(true);
      setTestResult(null);

      const response = await window.electron.ipcRenderer.invoke('ai:config:test-connection', {
        provider: selectedProvider
      });

      if (response.success) {
        setTestResult({
          success: true,
          message: `✓ Successfully connected to ${selectedProvider}`
        });
        setStatus('Connection test passed');
      } else {
        setTestResult({
          success: false,
          message: `✗ Connection failed: ${response.error}`
        });
        setStatus('Connection test failed');
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: `Error: ${error.message}`
      });
      setStatus('Connection test error');
    } finally {
      setLoading(false);
    }
  };

  const handlePreferenceChange = (key, value) => {
    setPreferences(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleClearData = async () => {
    if (!window.confirm('Clear all AI cache and pattern data? This cannot be undone.')) {
      return;
    }

    try {
      setLoading(true);

      const response = await window.electron.ipcRenderer.invoke('ai:config:clear-data', {});

      if (response.success) {
        setStatus('✓ AI data cleared');
      } else {
        setStatus(`✗ Failed to clear data: ${response.error}`);
      }
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="ai-settings-overlay" onClick={onClose}>
      <div className="ai-settings-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="ai-settings-header">
          <h2>⚙️ AI Agent Settings</h2>
          <button className="ai-settings-close" onClick={onClose}>×</button>
        </div>

        {/* Status Message */}
        {status && (
          <div className={`ai-settings-status ${testResult?.success ? 'success' : testResult?.success === false ? 'error' : 'info'}`}>
            {status}
          </div>
        )}

        <div className="ai-settings-content">
          {/* Provider Selection */}
          <section className="ai-settings-section">
            <h3>LLM Provider</h3>
            <div className="provider-grid">
              {providers.map(provider => (
                <button
                  key={provider.id}
                  className={`provider-card ${selectedProvider === provider.id ? 'selected' : ''}`}
                  onClick={() => setSelectedProvider(provider.id)}
                  disabled={loading}
                >
                  <div className="provider-name">{provider.name}</div>
                  <div className="provider-description">{provider.description}</div>
                </button>
              ))}
            </div>
          </section>

          {/* API Key Configuration */}
          <section className="ai-settings-section">
            <h3>API Key Configuration</h3>
            <div className="api-key-group">
              <label htmlFor="api-key">
                {selectedProvider.charAt(0).toUpperCase() + selectedProvider.slice(1)} API Key
              </label>
              <div className="api-key-input-group">
                <input
                  id="api-key"
                  type="password"
                  className="api-key-input"
                  placeholder="Enter your API key..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  disabled={loading}
                />
                <button
                  className="btn btn-primary"
                  onClick={handleSaveAPIKey}
                  disabled={loading || !apiKey}
                >
                  Save Key
                </button>
              </div>
              <p className="help-text">
                🔒 Keys are encrypted and stored securely on your device.
              </p>
            </div>

            {/* Test Connection */}
            <button
              className="btn btn-secondary"
              onClick={handleTestConnection}
              disabled={loading || !apiKey}
            >
              Test Connection
            </button>

            {testResult && (
              <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
                {testResult.message}
              </div>
            )}
          </section>

          {/* Preferences */}
          <section className="ai-settings-section">
            <h3>AI Preferences</h3>

            <div className="preference-group">
              <label className="preference-checkbox">
                <input
                  type="checkbox"
                  checked={preferences.enablePatternLearning}
                  onChange={(e) => handlePreferenceChange('enablePatternLearning', e.target.checked)}
                  disabled={loading}
                />
                <span>Learn User Patterns</span>
              </label>
              <p className="help-text">Detect your editing style and preferences</p>
            </div>

            <div className="preference-group">
              <label className="preference-checkbox">
                <input
                  type="checkbox"
                  checked={preferences.enableEmbeddings}
                  onChange={(e) => handlePreferenceChange('enableEmbeddings', e.target.checked)}
                  disabled={loading}
                />
                <span>Generate Document Embeddings</span>
              </label>
              <p className="help-text">Enable semantic search and similarity matching</p>
            </div>

            <div className="preference-group">
              <label className="preference-checkbox">
                <input
                  type="checkbox"
                  checked={preferences.enableRelationshipDiscovery}
                  onChange={(e) => handlePreferenceChange('enableRelationshipDiscovery', e.target.checked)}
                  disabled={loading}
                />
                <span>Discover Document Relationships</span>
              </label>
              <p className="help-text">Find connections between your notes</p>
            </div>

            {/* Sliders */}
            <div className="preference-group">
              <label>Max Tokens Per Query: {preferences.maxTokensPerQuery}</label>
              <input
                type="range"
                min="512"
                max="8192"
                step="256"
                value={preferences.maxTokensPerQuery}
                onChange={(e) => handlePreferenceChange('maxTokensPerQuery', parseInt(e.target.value))}
                disabled={loading}
                className="slider"
              />
              <p className="help-text">Higher values allow longer responses</p>
            </div>

            <div className="preference-group">
              <label>Temperature (Creativity): {preferences.temperature.toFixed(2)}</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={preferences.temperature}
                onChange={(e) => handlePreferenceChange('temperature', parseFloat(e.target.value))}
                disabled={loading}
                className="slider"
              />
              <p className="help-text">0 = deterministic, 1 = creative</p>
            </div>

            <button
              className="btn btn-primary"
              onClick={handleSavePreferences}
              disabled={loading}
            >
              Save Preferences
            </button>
          </section>

          {/* Data Management */}
          <section className="ai-settings-section">
            <h3>Data Management</h3>
            <div className="data-management">
              <p>Clear all cached data, patterns, and embeddings.</p>
              <button
                className="btn btn-danger"
                onClick={handleClearData}
                disabled={loading}
              >
                Clear All AI Data
              </button>
            </div>
          </section>

          {/* Info */}
          <section className="ai-settings-section info-section">
            <h3>ℹ️ Information</h3>
            <ul>
              <li><strong>Storage:</strong> All data stored locally on your device</li>
              <li><strong>Privacy:</strong> No data sent to cloud (except LLM API calls)</li>
              <li><strong>Database:</strong> <code>.notes-app/app.sqlite</code></li>
              <li><strong>Config:</strong> <code>%APPDATA%/Notely/ai-config.json</code></li>
            </ul>
          </section>
        </div>

        {/* Footer */}
        <div className="ai-settings-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AISettings;
