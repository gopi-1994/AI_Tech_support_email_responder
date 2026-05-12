import { useState, useEffect } from 'react'
import api from '../../api'

const MODELS = ['gpt-5.2', 'gpt-5.3', 'gpt-5.4', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo']

export default function ModelSettings() {
  const [model, setModel] = useState('gpt-5.2')
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [threshold, setThreshold] = useState('0.75')

  useEffect(() => {
    api.get('/settings/openai_model').then(r => r.data.value && setModel(r.data.value)).catch(() => {})
    api.get('/settings/confidence_threshold').then(r => r.data.value && setThreshold(r.data.value)).catch(() => {})
  }, [])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const configs = [
      { key: 'openai_model', value: model },
      { key: 'confidence_threshold', value: threshold },
    ]
    if (apiKey && !apiKey.includes('•')) configs.push({ key: 'openai_api_key', value: apiKey })
    await api.post('/settings/', { configs })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div>
      <h2 className="settings-section-title">Model Configuration</h2>
      <p className="settings-section-desc">
        Configure the AI model used for generating technical support responses. The model and API key are stored securely on the server.
      </p>
      <form className="settings-fields" onSubmit={handleSave}>
        <div className="form-group">
          <label className="label" htmlFor="model-select">Default OpenAI Model</label>
          <select id="model-select" className="input" value={model} onChange={e => setModel(e.target.value)}>
            {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>This model will be used for all AI responses unless overridden.</span>
        </div>

        <div className="form-group">
          <label className="label" htmlFor="api-key-input">OpenAI API Key</label>
          <div style={{ position: 'relative' }}>
            <input
              id="api-key-input"
              className="input"
              type={showKey ? 'text' : 'password'}
              placeholder="sk-•••••••••••••••••••••"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              style={{ paddingRight: 44 }}
            />
            <button
              type="button"
              className="btn-icon"
              onClick={() => setShowKey(v => !v)}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}
            >
              {showKey
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              }
            </button>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Stored securely. Leave blank to keep the existing key.</span>
        </div>

        <div className="form-group">
          <label className="label" htmlFor="threshold-input">Confidence Threshold</label>
          <input
            id="threshold-input"
            className="input"
            type="number" min="0" max="1" step="0.05"
            value={threshold}
            onChange={e => setThreshold(e.target.value)}
          />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Responses below this confidence score will be escalated to L2 support. (0.0 – 1.0)</span>
        </div>

        <div className="settings-save-row">
          <button id="model-save-btn" className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? <><span className="spinner" /> Saving…</> : 'Save Changes'}
          </button>
          {saved && <span className="settings-save-msg">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            Saved successfully!
          </span>}
        </div>
      </form>
    </div>
  )
}
