import { useState, useEffect } from 'react'
import api from '../../api'

// Map: form field name -> backend SystemConfig key
const FIELD_MAP = {
  tenant_id:      'copilot_tenant_id',
  client_id:      'copilot_client_id',
  client_secret:  'copilot_client_secret',
  sharepoint_url: 'sharepoint_site_url',
  sharepoint_folder: 'sharepoint_folder',
  description:    'copilot_description',
}

const FIELDS = [
  { name: 'tenant_id',      label: 'Tenant ID',                placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
  { name: 'client_id',      label: 'Application (Client) ID', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
  { name: 'client_secret',  label: 'Client Secret',            placeholder: '•••••••••••••', type: 'password' },
  { name: 'sharepoint_url', label: 'SharePoint Site URL',      placeholder: 'https://yourorg.sharepoint.com/sites/support' },
  { name: 'sharepoint_folder', label: 'SharePoint Folder Path', placeholder: 'Shared Documents/Support' },
  { name: 'description',    label: 'Knowledge Base Description', placeholder: 'e.g., "Contains IT hardware manuals and troubleshooting guides. No software documentation."', type: 'textarea' },
]

export default function CopilotSettings() {
  const [form, setForm] = useState({
    tenant_id: '', client_id: '', client_secret: '', sharepoint_url: '', sharepoint_folder: '', description: ''
  })
  const [loading, setLoading]   = useState(true)
  const [saving,  setSaving]    = useState(false)
  const [saved,   setSaved]     = useState(false)
  const [error,   setError]     = useState(null)
  const [authUrl, setAuthUrl]   = useState(null)
  const [authLoading, setAuthLoading] = useState(false)

  // ── Load existing values on mount ──────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const fetched = {}
        await Promise.all(
          Object.entries(FIELD_MAP).map(async ([formKey, backendKey]) => {
            const res = await api.get(`/settings/${backendKey}`)
            fetched[formKey] = res.data?.value ?? ''
          })
        )
        setForm(fetched)
      } catch (e) {
        setError('Failed to load settings.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  async function handleSave(e) {
    e.preventDefault()
    
    if (!form.sharepoint_folder || !form.sharepoint_folder.trim()) {
      setError('SharePoint Folder Path is strictly mandatory. Please specify a folder.')
      return
    }
    if (!form.description || !form.description.trim()) {
      setError('Knowledge Base Description is strictly mandatory to calculate AI confidence accurately.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const configs = Object.entries(form)
        .filter(([_, v]) => v && !v.includes('•'))
        .map(([formKey, value]) => ({ key: FIELD_MAP[formKey], value }))
      if (configs.length) await api.post('/settings/', { configs })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('Failed to save settings.')
    } finally {
      setSaving(false)
    }
  }

  // ── Copilot OAuth authorize ────────────────────────────────────────────────
  async function handleAuthorize() {
    setAuthLoading(true)
    setError(null)
    try {
      const res = await api.get('/settings/copilot/authorize')
      const url = res.data?.authorization_url
      if (url) {
        setAuthUrl(url)
        window.open(url, '_blank', 'width=600,height=700')
      }
    } catch (e) {
      setError(e?.response?.data?.detail || 'Authorization failed. Save credentials first.')
    } finally {
      setAuthLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 32, color: 'var(--text-muted)' }}>
        <span className="spinner" /> Loading configuration…
      </div>
    )
  }

  return (
    <div>
      <h2 className="settings-section-title">M365 Copilot Studio Configuration</h2>
      <p className="settings-section-desc">
        Connect the system to your Microsoft 365 Copilot Retrieval API and SharePoint knowledge base.
        These credentials are used to fetch verified organisational data for AI responses.
      </p>

      {/* Info banner */}
      <div style={{ padding: '12px 16px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 'var(--radius)', marginBottom: 24 }}>
        <p style={{ fontSize: 13, color: '#60a5fa', display: 'flex', gap: 8, alignItems: 'center', margin: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          Register an Azure App with <strong>&nbsp;SharePoint Sites.Read.All&nbsp;</strong> permissions and generate a client secret. Enter the details below.
        </p>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius)', marginBottom: 16, color: '#f87171', fontSize: 13 }}>
          {error}
        </div>
      )}

      <form className="settings-fields" onSubmit={handleSave}>
        {FIELDS.map(f => (
          <div className="form-group" key={f.name}>
            <label className="label" htmlFor={f.name}>{f.label}</label>
            {f.type === 'textarea' ? (
              <textarea
                id={f.name}
                name={f.name}
                className="input"
                placeholder={f.placeholder}
                value={form[f.name] || ''}
                onChange={handleChange}
                rows={3}
                style={{ resize: 'vertical' }}
              />
            ) : (
              <input
                id={f.name}
                name={f.name}
                className="input"
                type={f.type || 'text'}
                placeholder={f.placeholder}
                value={form[f.name] || ''}
                onChange={handleChange}
                autoComplete="off"
              />
            )}
          </div>
        ))}

        <div className="settings-save-row" style={{ flexWrap: 'wrap', gap: 12 }}>
          <button id="copilot-save-btn" className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? <><span className="spinner" /> Saving…</> : 'Save Configuration'}
          </button>

          {/* Authorize with Microsoft button */}
          <button
            id="copilot-authorize-btn"
            type="button"
            className="btn"
            style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)' }}
            onClick={handleAuthorize}
            disabled={authLoading}
          >
            {authLoading
              ? <><span className="spinner" /> Opening…</>
              : <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}>
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                  Authorize with Microsoft
                </>
            }
          </button>

          {saved && (
            <span className="settings-save-msg">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              Saved successfully!
            </span>
          )}
        </div>
      </form>

      {/* Show auth URL as fallback link */}
      {authUrl && (
        <div style={{ marginTop: 16, padding: '10px 14px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 'var(--radius)', fontSize: 12 }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: 6 }}>If the popup was blocked, open this link manually:</p>
          <a href={authUrl} target="_blank" rel="noreferrer" style={{ color: '#60a5fa', wordBreak: 'break-all' }}>{authUrl}</a>
        </div>
      )}
    </div>
  )
}
