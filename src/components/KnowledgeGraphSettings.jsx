import React, { useEffect, useState } from 'react';
import { Download, Trash2, Sliders } from 'lucide-react';
import AppSelect from './AppSelect';
import AppButton from './AppButton';
import {
  aiGetGraphModelStatus,
  aiDownloadGraphModel,
  aiDeleteGraphModel,
  onGraphModelDownloadProgress,
  aiGetPreferences,
  aiSetPreferences
} from '../services/electronService';

export default function KnowledgeGraphSettings() {
  const [loading, setLoading] = useState(false);
  const [preferences, setPreferences] = useState({
    graphProvider: 'gliner2-relex',
    graphConfidence: 0.60,
    enableRelationshipDiscovery: true
  });
  const [modelStatus, setModelStatus] = useState({ downloaded: false, isDownloading: false, progress: 0 });

  useEffect(() => {
    const loadStatusAndPrefs = async () => {
      try {
        const [statusRes, prefsRes] = await Promise.allSettled([
          aiGetGraphModelStatus(),
          aiGetPreferences()
        ]);

        if (statusRes.status === 'fulfilled' && statusRes.value?.success && statusRes.value.data) {
          setModelStatus(statusRes.value.data);
        }
        if (prefsRes.status === 'fulfilled' && prefsRes.value?.success && prefsRes.value.data) {
          setPreferences(prev => ({ ...prev, ...prefsRes.value.data }));
        }
      } catch (err) {
        console.error('Failed to load graph model status / preferences', err);
      }
    };

    loadStatusAndPrefs();

    const unsubscribe = onGraphModelDownloadProgress((payload) => {
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

  const handleDownloadModel = async () => {
    try {
      setLoading(true);
      const res = await aiDownloadGraphModel();
      if (res.success) {
        setModelStatus(prev => ({ ...prev, isDownloading: true, progress: 0 }));
      }
    } catch (err) {
      console.error(err);
      window.dispatchEvent(new CustomEvent('app:toast', {
        detail: { message: `Failed to start download: ${err.message}`, type: 'error' }
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteModel = async () => {
    if (!window.confirm('Delete local GLiNER2-Relex ONNX model weights from disk? You can redownload anytime.')) return;
    try {
      setLoading(true);
      await aiDeleteGraphModel();
      setModelStatus({ downloaded: false, isDownloading: false, progress: 0 });
      window.dispatchEvent(new CustomEvent('app:toast', {
        detail: { message: 'Local GLiNER2-Relex ONNX model weights deleted.', type: 'info' }
      }));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleProviderChange = async (e) => {
    const newProvider = e.target.value;
    const updated = { ...preferences, graphProvider: newProvider };
    setPreferences(updated);
    try {
      await aiSetPreferences(updated);
      window.dispatchEvent(new CustomEvent('app:toast', {
        detail: { message: `Graph extraction engine set to ${newProvider === 'text-provider' ? 'Cloud AI Provider' : 'GLiNER2-Relex ONNX Model'}.`, type: 'success' }
      }));
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleAutoDiscovery = async () => {
    const nextVal = !preferences.enableRelationshipDiscovery;
    const updated = { ...preferences, enableRelationshipDiscovery: nextVal };
    setPreferences(updated);
    try {
      await aiSetPreferences(updated);
    } catch (err) {
      console.error(err);
    }
  };

  const handleConfidenceChange = async (e) => {
    const nextVal = parseFloat(e.target.value);
    const updated = { ...preferences, graphConfidence: nextVal };
    setPreferences(updated);
    try {
      await aiSetPreferences(updated);
    } catch (err) {
      console.error(err);
    }
  };

  const activeProvider = (preferences.graphProvider === 'text-provider') ? 'text-provider' : 'gliner2-relex';

  return (
    <>
      {/* Offline Model Weights */}
      <div className="settings-toggle-row">
        <div className="settings-toggle-copy">
          <strong>Offline GLiNER2-Relex Extraction Model</strong>
          <span>
            {modelStatus.downloaded
              ? 'Local ONNX zero-shot entity and relationship extraction model is ready.'
              : modelStatus.isDownloading
                ? `Downloading model weights... ${modelStatus.progress}% complete`
                : 'Download zero-shot relation extraction weights to parse note graphs locally without cloud APIs.'}
          </span>
        </div>
        <div>
          {modelStatus.downloaded ? (
            <AppButton onClick={handleDeleteModel} disabled={loading} danger>
              <Trash2 size={14} style={{ marginRight: '4px' }} />
              Remove Model
            </AppButton>
          ) : modelStatus.isDownloading ? (
            <div style={{ minWidth: '120px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                <span>Downloading</span>
                <span>{modelStatus.progress}%</span>
              </div>
              <div style={{ width: '100%', height: '4px', background: 'var(--surface-border)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${modelStatus.progress}%`, height: '100%', background: 'var(--accent-solid)' }} />
              </div>
            </div>
          ) : (
            <AppButton variant="primary" onClick={handleDownloadModel} disabled={loading}>
              <Download size={14} style={{ marginRight: '4px' }} />
              Download Model
            </AppButton>
          )}
        </div>
      </div>

      {/* Auto-Discovery Toggle */}
      <div className="settings-toggle-row">
        <div className="settings-toggle-copy">
          <strong>Automatic Relationship Discovery</strong>
          <span>Automatically discover note entities, links, and cross-references in the background.</span>
        </div>
        <input
          type="checkbox"
          checked={preferences.enableRelationshipDiscovery !== false}
          onChange={handleToggleAutoDiscovery}
          className="settings-toggle-checkbox"
        />
      </div>

      {/* Extraction Engine */}
      <div className="settings-field-group">
        <label className="settings-field-label">Active Extraction Engine</label>
        <AppSelect
          value={activeProvider}
          onChange={handleProviderChange}
          disabled={loading}
        >
          <option value="gliner2-relex">GLiNER2-Relex ONNX Model (Zero-Shot - Recommended)</option>
          <option value="text-provider">Cloud AI Provider</option>
        </AppSelect>
      </div>

      {/* Confidence Threshold */}
      <div className="settings-field-group">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label className="settings-field-label">Extraction Confidence Threshold</label>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-strong)' }}>
            {Math.round((preferences.graphConfidence || 0.60) * 100)}%
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '2px' }}>
          <Sliders size={14} style={{ color: 'var(--text-muted)' }} />
          <input
            type="range"
            min="0.30"
            max="0.95"
            step="0.05"
            value={preferences.graphConfidence || 0.60}
            onChange={handleConfidenceChange}
            className="slider zoom-slider"
          />
        </div>
      </div>
    </>
  );
}
