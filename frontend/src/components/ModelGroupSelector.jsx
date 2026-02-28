import { useState, useEffect } from 'react';
import { api } from '../api';
import { generateSuggestedPresets } from '../presetUtils';
import './ModelGroupSelector.css';

export default function ModelGroupSelector({ value, onChange }) {
  const [suggestedPresets, setSuggestedPresets] = useState([]);
  const [customPresets, setCustomPresets] = useState([]);

  useEffect(() => {
    Promise.all([api.getAvailableModels(), api.getPresets()])
      .then(([modelsData, presets]) => {
        setSuggestedPresets(generateSuggestedPresets(modelsData.data || []));
        setCustomPresets(presets);
      })
      .catch((err) => console.error('Failed to load presets:', err));
  }, []);

  const handleChange = (e) => {
    const selectedId = e.target.value;
    if (!selectedId) {
      onChange(null);
      return;
    }
    const all = [...suggestedPresets, ...customPresets];
    const preset = all.find((p) => p.id === selectedId) || null;
    onChange(preset);
  };

  return (
    <div className="model-group-selector">
      <label className="model-group-label">Model Group</label>
      <select
        className="model-group-select"
        value={value?.id || ''}
        onChange={handleChange}
      >
        <optgroup label="Current">
          <option value="">Default (Settings)</option>
        </optgroup>
        {suggestedPresets.length > 0 && (
          <optgroup label="Suggested">
            {suggestedPresets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </optgroup>
        )}
        {customPresets.length > 0 && (
          <optgroup label="Custom">
            {customPresets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>
    </div>
  );
}
