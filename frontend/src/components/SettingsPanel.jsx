import { useState, useEffect, useMemo } from 'react';
import { api } from '../api';
import './SettingsPanel.css';

// Typical token usage per council query, based on the 3-stage pipeline:
// Stage 1: model receives user query (~300 tokens), produces response (~600 tokens)
// Stage 2: model receives query + all stage 1 responses (~3200 in), produces ranking (~800 out)
// Chairman Stage 3: receives everything (~7000 in), produces synthesis (~1200 out)
const COUNCIL_EST_INPUT = 3500;
const COUNCIL_EST_OUTPUT = 1400;
const CHAIRMAN_EST_INPUT = 7000;
const CHAIRMAN_EST_OUTPUT = 1200;

function estimateCostPerQuery(model, role) {
  const promptPrice = parseFloat(model.pricing?.prompt || '0');
  const completionPrice = parseFloat(model.pricing?.completion || '0');
  const estInput = role === 'chairman' ? CHAIRMAN_EST_INPUT : COUNCIL_EST_INPUT;
  const estOutput = role === 'chairman' ? CHAIRMAN_EST_OUTPUT : COUNCIL_EST_OUTPUT;
  return estInput * promptPrice + estOutput * completionPrice;
}

function formatCost(cost) {
  if (cost === 0) return 'Free';
  if (cost < 0.0001) return '<$0.01';
  if (cost < 0.01) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}

function formatContext(length) {
  if (!length) return null;
  if (length >= 1_000_000) return `${(length / 1_000_000).toFixed(1)}M`;
  if (length >= 1000) return `${Math.round(length / 1000)}K`;
  return `${length}`;
}

function formatDate(timestamp) {
  if (!timestamp) return null;
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function SortArrow({ column, sortCol, sortDir }) {
  if (sortCol !== column) return <span className="sort-arrow inactive">{'\u2195'}</span>;
  return <span className="sort-arrow active">{sortDir === 'asc' ? '\u2191' : '\u2193'}</span>;
}

export default function SettingsPanel({ onClose }) {
  const [availableModels, setAvailableModels] = useState([]);
  const [councilModels, setCouncilModels] = useState([]);
  const [chairmanModel, setChairmanModel] = useState('');
  const [search, setSearch] = useState('');
  const [councilSort, setCouncilSort] = useState({ col: 'name', dir: 'asc' });
  const [chairmanSort, setChairmanSort] = useState({ col: 'name', dir: 'asc' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [presets, setPresets] = useState([]);
  const [presetName, setPresetName] = useState('');
  const [showPresetInput, setShowPresetInput] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);

    Promise.all([api.getSettings(), api.getAvailableModels(), api.getPresets()])
      .then(([settings, modelsData, presetsData]) => {
        setCouncilModels(settings.councilModels || []);
        setChairmanModel(settings.chairmanModel || '');
        setAvailableModels(modelsData.data || []);
        setPresets(presetsData);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSavePreset = async () => {
    if (!presetName.trim() || councilModels.length < 2 || !chairmanModel) return;
    try {
      const preset = await api.createPreset({ name: presetName.trim(), councilModels, chairmanModel });
      setPresets((prev) => [...prev, preset]);
      setPresetName('');
      setShowPresetInput(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeletePreset = async (id) => {
    try {
      await api.deletePreset(id);
      setPresets((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLoadPreset = (preset) => {
    setCouncilModels(preset.councilModels);
    setChairmanModel(preset.chairmanModel);
  };

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return availableModels.filter(
      (m) =>
        m.id.toLowerCase().includes(term) ||
        (m.name && m.name.toLowerCase().includes(term))
    );
  }, [availableModels, search]);

  const sortModels = (models, { col, dir }, role) => {
    const sorted = [...models].sort((a, b) => {
      let cmp = 0;
      switch (col) {
        case 'name':
          cmp = (a.name || a.id).localeCompare(b.name || b.id);
          break;
        case 'cost':
          cmp = estimateCostPerQuery(a, role) - estimateCostPerQuery(b, role);
          break;
        case 'context':
          cmp = (a.context_length || 0) - (b.context_length || 0);
          break;
        case 'date':
          cmp = (a.created || 0) - (b.created || 0);
          break;
      }
      return dir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  };

  const councilList = useMemo(() => {
    const sorted = sortModels(filtered, councilSort, 'council');
    const selected = sorted.filter((m) => councilModels.includes(m.id));
    const rest = sorted.filter((m) => !councilModels.includes(m.id));
    return [...selected, ...rest];
  }, [filtered, councilModels, councilSort]);

  const chairmanList = useMemo(() => {
    const sorted = sortModels(filtered, chairmanSort, 'chairman');
    const selected = sorted.filter((m) => m.id === chairmanModel);
    const rest = sorted.filter((m) => m.id !== chairmanModel);
    return [...selected, ...rest];
  }, [filtered, chairmanModel, chairmanSort]);

  const toggleSort = (setter, col) => {
    setter((prev) => ({
      col,
      dir: prev.col === col && prev.dir === 'asc' ? 'desc' : 'asc',
    }));
  };

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
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const renderModelRow = (model, type) => {
    const isCouncil = type === 'council';
    const isSelected = isCouncil ? councilModels.includes(model.id) : chairmanModel === model.id;
    const cost = estimateCostPerQuery(model, isCouncil ? 'council' : 'chairman');

    return (
      <label
        key={`${type}-${model.id}`}
        className={`model-row${isSelected ? ' selected' : ''}`}
      >
        <div className="model-row-select">
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
        </div>
        <div className="model-row-name">
          <span className="model-primary-name">{model.name || model.id}</span>
          <span className="model-id">{model.id}</span>
        </div>
        <div className="model-row-cost">
          {formatCost(cost)}
        </div>
        <div className="model-row-context">
          {formatContext(model.context_length) && (
            <span>{formatContext(model.context_length)}</span>
          )}
        </div>
        <div className="model-row-date">
          {formatDate(model.created)}
        </div>
      </label>
    );
  };

  const renderColumnHeaders = (sort, setter) => (
    <div className="model-list-header">
      <div className="mlh-select"></div>
      <div className="mlh-name sortable" onClick={() => toggleSort(setter, 'name')}>
        Model <SortArrow column="name" sortCol={sort.col} sortDir={sort.dir} />
      </div>
      <div className="mlh-cost sortable" onClick={() => toggleSort(setter, 'cost')}>
        Est. $/query <SortArrow column="cost" sortCol={sort.col} sortDir={sort.dir} />
      </div>
      <div className="mlh-context sortable" onClick={() => toggleSort(setter, 'context')}>
        Context <SortArrow column="context" sortCol={sort.col} sortDir={sort.dir} />
      </div>
      <div className="mlh-date sortable" onClick={() => toggleSort(setter, 'date')}>
        Added <SortArrow column="date" sortCol={sort.col} sortDir={sort.dir} />
      </div>
    </div>
  );

  return (
    <div className="settings-page">
      <div className="settings-header">
        <div className="settings-header-left">
          <button className="back-btn" onClick={onClose} title="Back to chat">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 4l-6 6 6 6" />
            </svg>
          </button>
          <h2>Council Settings</h2>
        </div>
        <button className="save-btn" onClick={handleSave} disabled={!canSave || saving}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {loading ? (
        <div className="settings-loading">Loading models...</div>
      ) : (
        <>
          {error && <div className="settings-error">{error}</div>}

          <div className="settings-controls">
            <input
              className="settings-search"
              type="text"
              placeholder="Search models..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="settings-summary">
              {councilModels.length} council &middot; {chairmanModel ? 1 : 0} chairman
            </div>
          </div>

          <div className="settings-sections">
            <div className="settings-section">
              <h3>Saved Presets</h3>
              {presets.length === 0 && !showPresetInput && (
                <div className="presets-empty">No saved presets yet.</div>
              )}
              {presets.length > 0 && (
                <div className="presets-list">
                  {presets.map((p) => (
                    <div key={p.id} className="preset-item">
                      <span className="preset-name">{p.name}</span>
                      <span className="preset-detail">
                        {p.councilModels.length} council &middot; {p.chairmanModel.split('/').pop()}
                      </span>
                      <div className="preset-actions">
                        <button className="preset-btn load" onClick={() => handleLoadPreset(p)}>Load</button>
                        <button className="preset-btn delete" onClick={() => handleDeletePreset(p.id)}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {showPresetInput ? (
                <div className="preset-save-row">
                  <input
                    className="preset-name-input"
                    type="text"
                    placeholder="Preset name..."
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
                    autoFocus
                  />
                  <button className="preset-btn save" onClick={handleSavePreset} disabled={!presetName.trim() || !canSave}>Save</button>
                  <button className="preset-btn cancel" onClick={() => { setShowPresetInput(false); setPresetName(''); }}>Cancel</button>
                </div>
              ) : (
                <button className="preset-save-trigger" onClick={() => setShowPresetInput(true)} disabled={!canSave}>
                  Save Current Selection as Preset
                </button>
              )}
            </div>

            <div className="settings-section">
              <h3>Chairman / Orchestrator</h3>
              {renderColumnHeaders(chairmanSort, setChairmanSort)}
              <div className="model-list">
                {chairmanList.length === 0 ? (
                  <div className="no-models-match">No models match your search</div>
                ) : (
                  chairmanList.map((m) => renderModelRow(m, 'chairman'))
                )}
              </div>
            </div>

            <div className="settings-section">
              <h3>Council Members <span className="section-count">({councilModels.length} selected, min 2)</span></h3>
              {renderColumnHeaders(councilSort, setCouncilSort)}
              <div className="model-list">
                {councilList.length === 0 ? (
                  <div className="no-models-match">No models match your search</div>
                ) : (
                  councilList.map((m) => renderModelRow(m, 'council'))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
