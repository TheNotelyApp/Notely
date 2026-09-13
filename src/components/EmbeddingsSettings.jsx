import React, { useEffect, useState } from 'react';
import { Download, Trash2, RefreshCw, Database } from 'lucide-react';
import AppSelect from './AppSelect';
import AppButton from './AppButton';
import {
  aiGetModelStatus,
  aiDownloadModel,
  aiDeleteModel,
  onModelDownloadProgress,
  aiGetEmbeddingsStatus,
  aiRebuildEmbeddings,
  aiClearEmbeddingsData,
  aiGetPreferences,
  aiSetPreferences
} from '../services/electronService';

export function EmbeddingsSettings() {
  const [loading, setLoading] = useState(false);
  const [modelStatus, setModelStatus] = useState({ downloaded: false, isDownloading: false, progress: 0 });
  const [embeddingsStatus, setEmbeddingsStatus] = useState({
    totalChunks: 0,
    indexedNotes: 0,
    dbSize: '0 KB',
    isWorking: false
  });
  const [preferences, setPreferences] = useState({
    embeddingProvider: 'internal',
    enableEmbeddings: true
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [modelRes, embRes, prefsRes] = await Promise.allSettled([
        aiGetModelStatus(),
        aiGetEmbeddingsStatus(),
        aiGetPreferences()
      ]);

      if (modelRes.status === 'fulfilled' && modelRes.value?.success && modelRes.value.data) {
        setModelStatus(modelRes.value.data);
      }
      if (embRes.status === 'fulfilled' && embRes.value?.success && embRes.value.data) {
        setEmbeddingsStatus(embRes.value.data);
      }
      if (prefsRes.status === 'fulfilled' && prefsRes.value?.success && prefsRes.value.data) {
        setPreferences(prev => ({ ...prev, ...prefsRes.value.data }));
      }
    } catch (err) {
      console.error('Failed to load embeddings settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

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

  const handleDownloadModel = async () => {
    try {
      setLoading(true);
      const res = await aiDownloadModel();
      if (res.success) {
        setModelStatus(prev => ({ ...prev, isDownloading: true, progress: 0 }));
      }
    } catch (err) {
      console.error(err);
      window.dispatchEvent(new CustomEvent('app:toast', {
        detail: { message: `Failed to download model: ${err.message}`, type: 'error' }
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteModel = async () => {
    if (!window.confirm('Delete local BGE embedding model weights from disk? You can redownload anytime.')) return;
    try {
      setLoading(true);
      await aiDeleteModel();
      setModelStatus({ downloaded: false, isDownloading: false, progress: 0 });
      window.dispatchEvent(new CustomEvent('app:toast', {
        detail: { message: 'Local embedding model weights deleted.', type: 'info' }
      }));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRebuildIndex = async () => {
    try {
      setLoading(true);
      await aiRebuildEmbeddings();
      window.dispatchEvent(new CustomEvent('app:toast', {
        detail: { message: 'Embeddings index rebuild initiated in background.', type: 'info' }
      }));
      await loadData();
    } catch (err) {
      window.dispatchEvent(new CustomEvent('app:toast', {
        detail: { message: `Rebuild failed: ${err.message}`, type: 'error' }
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleClearData = async () => {
    if (!window.confirm('Clear all local vector database embeddings? Note markdown files will remain intact.')) return;
    try {
      setLoading(true);
      await aiClearEmbeddingsData();
      window.dispatchEvent(new CustomEvent('app:toast', {
        detail: { message: 'Vector database wiped successfully.', type: 'success' }
      }));
      await loadData();
    } catch (err) {
      window.dispatchEvent(new CustomEvent('app:toast', {
        detail: { message: `Failed to wipe vectors: ${err.message}`, type: 'error' }
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleProviderChange = async (e) => {
    const nextProvider = e.target.value;
    const updated = { ...preferences, embeddingProvider: nextProvider };
    setPreferences(updated);
    try {
      await aiSetPreferences(updated);
      window.dispatchEvent(new CustomEvent('app:toast', {
        detail: { message: `Embedding provider set to ${nextProvider === 'internal' ? 'Local Model (BGE ONNX)' : 'HuggingFace'}.`, type: 'success' }
      }));
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleAutoEmbed = async () => {
    const nextVal = !preferences.enableEmbeddings;
    const updated = { ...preferences, enableEmbeddings: nextVal };
    setPreferences(updated);
    try {
      await aiSetPreferences(updated);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
      {/* Offline Model Weights */}
      <div className="settings-toggle-row">
        <div className="settings-toggle-copy">
          <strong>Offline Vector Weights (bge-small-en-v1.5)</strong>
          <span>
            {modelStatus.downloaded
              ? 'Local ONNX weights (130 MB) are ready for fast offline semantic retrieval.'
              : modelStatus.isDownloading
                ? `Downloading weights... ${modelStatus.progress}% complete`
                : 'Download model weights once to enable local similarity search without cloud APIs.'}
          </span>
        </div>
        <div>
          {modelStatus.downloaded ? (
            <AppButton onClick={handleDeleteModel} disabled={loading} danger>
              <Trash2 size={14} style={{ marginRight: '4px' }} />
              Remove Weights
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
              Download (130 MB)
            </AppButton>
          )}
        </div>
      </div>

      {/* Auto-Vectorization Toggle */}
      <div className="settings-toggle-row">
        <div className="settings-toggle-copy">
          <strong>Automatic Vector Generation</strong>
          <span>Generate chunks and vector embeddings in the background whenever notes are saved.</span>
        </div>
        <input
          type="checkbox"
          checked={preferences.enableEmbeddings !== false}
          onChange={handleToggleAutoEmbed}
          className="settings-toggle-checkbox"
        />
      </div>

      {/* Embedding Provider */}
      <div className="settings-field-group">
        <label className="settings-field-label">Active Vector Provider</label>
        <AppSelect
          value={preferences.embeddingProvider || 'internal'}
          onChange={handleProviderChange}
          disabled={loading}
        >
          <option value="internal">Local Model Engine (BGE ONNX - Offline)</option>
          <option value="huggingface">HuggingFace Inference API</option>
        </AppSelect>
      </div>

      {/* Vector Index Statistics */}
      <div className="settings-field-group" style={{ maxWidth: '100%' }}>
        <label className="settings-field-label">Vector Index Statistics</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginTop: '4px' }}>
          <div style={{ padding: '12px 14px', background: 'var(--surface-subtle)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', fontWeight: 600 }}>Total Chunks</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-strong)', marginTop: '4px' }}>{embeddingsStatus.totalChunks || 0}</div>
          </div>
          <div style={{ padding: '12px 14px', background: 'var(--surface-subtle)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', fontWeight: 600 }}>Indexed Notes</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-strong)', marginTop: '4px' }}>{embeddingsStatus.indexedNotes || 0}</div>
          </div>
          <div style={{ padding: '12px 14px', background: 'var(--surface-subtle)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', fontWeight: 600 }}>Database Size</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-strong)', marginTop: '4px' }}>{embeddingsStatus.dbSize || '0 KB'}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
          <AppButton onClick={handleRebuildIndex} disabled={loading || !modelStatus.downloaded}>
            <RefreshCw size={14} style={{ marginRight: '4px' }} />
            Rebuild Vector Index
          </AppButton>
          <AppButton onClick={handleClearData} disabled={loading} danger>
            <Database size={14} style={{ marginRight: '4px' }} />
            Clear Vector Cache
          </AppButton>
        </div>
      </div>
    </>
  );
}

export default EmbeddingsSettings;
