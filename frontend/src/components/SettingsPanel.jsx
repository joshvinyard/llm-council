import { useState, useEffect, useMemo } from 'react';
import { api } from '../api';
import './SettingsPanel.css';

export default function SettingsPanel({ isOpen, onClose, onSave }) {
  const [availableModels, setAvailableModels] = useState([]);
  const [councilModels, setCouncilModels] = useState([]);
  const [chairmanModel, setChairmanModel] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);

    Promise.all([api.getSettings(), api.getAvailableModels()])
      .then(([settings, modelsData]) => {
        setCouncilModels(settings.councilModels || []);
        setChairmanModel(settings.chairmanModel || '');
        setAvailableModels(modelsData.data || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [isOpen]);

  const filteredModels = useMemo(() => {
    const term = search.toLowerCase();
    return availableModels.filter(
      (m) =>
        m.id.toLowerCase().includes(term) ||
        (m.name && m.name.toLowerCase().includes(term))
    );
  }, [availableModels, search]);

  const sortedForCouncil = useMemo(() => {
    const selected = filteredModels.filter((m) => councilModels.includes(m.id));
    const rest = filteredModels.filter((m) => !councilModels.includes(m.id));
    return [...selected, ...rest];
  }, [filteredModels, councilModels]);

  const sortedForChairman = useMemo(() => {
    const selected = filteredModels.filter((m) => m.id === chairmanModel);
    const rest = filteredModels.filter((m) => m.id !== chairmanModel);
    return [...selected, ...rest];
  }, [filteredModels, chairmanModel]);

  const toggleCouncilModel = (modelId) => {
    setCouncilModels((prev) =>
      prev.includes(modelId) ? prev.filter((id) => id !== modelId) : [...prev, modelId]
    );
  };

  const canSave = councilModels.length >= 2 && chairmanModel;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.saveSettings({ councilModels, chairmanModel });
      onSave?.();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const formatPrice = (price) => {
    if (!price) return null;
    const num = parseFloat(price);
    if (num === 0) return 'Free';
    return `$${num.toFixed(2)}/M`;
  };

  const formatContext = (length) => {
    if (!length) return null;
    if (length >= 1000000) return `${(length / 1000000).toFixed(1)}M ctx`;
    if (length >= 1000) return `${Math.round(length / 1000)}K ctx`;
    return `${length} ctx`;
  };

  const renderModelItem = (model, type) => {
    const isCouncil = type === 'council';
    const isSelected = isCouncil ? councilModels.includes(model.id) : chairmanModel === model.id;

    return (
      <label
        key={`${type}-${model.id}`}
        className={`model-item${isSelected ? ' selected' : ''}`}
      >
        {isCouncil ? (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleCouncilModel(model.id)}
          />
        ) : (
          <input
            type="radio"
            name="chairman"
            checked={isSelected}
            onChange={() => setChairmanModel(model.id)}
          />
        )}
        <div className="model-info">
          <div className="model-name">{model.name || model.id}</div>
          <div className="model-details">
            <span>{model.id}</span>
            {model.context_length && <span>{formatContext(model.context_length)}</span>}
            {model.pricing?.prompt && <span>{formatPrice(model.pricing.prompt)} in</span>}
          </div>
        </div>
      </label>
    );
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Council Settings</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="settings-body">
          {loading ? (
            <div className="settings-loading">Loading models...</div>
          ) : (
            <>
              {error && <div className="settings-error">{error}</div>}

              <input
                className="settings-search"
                type="text"
                placeholder="Search models..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <div className="settings-section">
                <h3>Chairman / Orchestrator (1 model)</h3>
                <div className="model-list">
                  {sortedForChairman.length === 0 ? (
                    <div className="no-models-match">No models match your search</div>
                  ) : (
                    sortedForChairman.map((m) => renderModelItem(m, 'chairman'))
                  )}
                </div>
              </div>

              <div className="settings-section">
                <h3>Council Members (min 2 models) &mdash; {councilModels.length} selected</h3>
                <div className="model-list">
                  {sortedForCouncil.length === 0 ? (
                    <div className="no-models-match">No models match your search</div>
                  ) : (
                    sortedForCouncil.map((m) => renderModelItem(m, 'council'))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="settings-footer">
          <button className="cancel-btn" onClick={onClose}>Cancel</button>
          <button className="save-btn" onClick={handleSave} disabled={!canSave || saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
