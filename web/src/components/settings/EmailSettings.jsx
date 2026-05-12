import { useState, useEffect } from 'react'
import api from '../../api'

const IMAP_PRESETS = [
  { label: 'Gmail',           host: 'imap.gmail.com',        smtp: 'smtp.gmail.com',          port: '587' },
  { label: 'Outlook / M365', host: 'outlook.office365.com', smtp: 'smtp.office365.com',      port: '587' },
  { label: 'Yahoo',          host: 'imap.mail.yahoo.com',   smtp: 'smtp.mail.yahoo.com',     port: '587' },
  { label: 'Custom',         host: '',                       smtp: '',                         port: '587' },
]

const SectionTitle = ({ children }) => (
  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase',
              letterSpacing: '0.08em', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
    {children}
  </p>
)

const Divider = ({ label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '28px 0 20px' }}>
    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</span>
    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
  </div>
)

export default function EmailSettings() {
  const [form, setForm] = useState({
    imap_host: '', imap_user: '', imap_password: '', imap_folder: 'INBOX',
    smtp_host: '', smtp_port: '587', smtp_user: '', smtp_password: '', smtp_from: '',
    escalation_emails: '',
  })
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [testing, setTesting]   = useState(false)
  const [testMsg, setTestMsg]   = useState(null)
  const [preset, setPreset]     = useState('')

  useEffect(() => {
    async function load() {
      try {
        const keys = ['imap_host','imap_user','imap_password','imap_folder','smtp_host','smtp_port','smtp_user','smtp_password','smtp_from', 'escalation_emails']
        const results = await Promise.all(keys.map(k => api.get(`/settings/${k}`)))
        const vals = {}
        keys.forEach((k, i) => { vals[k] = results[i].data.value || '' })
        setForm(f => ({ ...f, ...vals }))
      } catch (_) {}
    }
    load()
  }, [])

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
    setTestMsg(null)
  }

  function handlePreset(e) {
    const p = IMAP_PRESETS.find(x => x.label === e.target.value)
    setPreset(e.target.value)
    if (p) setForm(f => ({ ...f, imap_host: p.host, smtp_host: p.smtp, smtp_port: p.port }))
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true); setSaved(false)
    const configs = Object.entries(form)
      .filter(([_, v]) => v && !v.includes('•'))
      .map(([key, value]) => ({ key, value }))
    if (configs.length) await api.post('/settings/', { configs })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function handleTest() {
    setTesting(true); setTestMsg(null)
    try {
      const res = await api.post('/settings/test-imap')
      setTestMsg({ ok: true, text: res.data.detail || 'IMAP connection successful!' })
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Connection failed.'
      setTestMsg({ ok: false, text: msg })
    } finally { setTesting(false) }
  }

  const imapFields = [
    { name: 'imap_host',     label: 'IMAP Host',              placeholder: 'imap.gmail.com',         type: 'text',     hint: 'Port 993 (SSL) used by default.' },
    { name: 'imap_user',     label: 'Email Address',           placeholder: 'support@yourcompany.com',type: 'email',    hint: 'Inbox the agent monitors for new tickets.' },
    { name: 'imap_password', label: 'Password / App Password', placeholder: '••••••••••••',           type: 'password', hint: 'Use an App Password if 2FA is enabled.' },
    { name: 'imap_folder',   label: 'IMAP Folder',             placeholder: 'INBOX',                  type: 'text',     hint: 'Folder to check for emails (default is INBOX).' },
  ]

  const smtpFields = [
    { name: 'smtp_host',     label: 'SMTP Host',              placeholder: 'smtp.gmail.com',         type: 'text',     hint: 'Outbound mail server hostname.' },
    { name: 'smtp_port',     label: 'SMTP Port',              placeholder: '587',                     type: 'number',   hint: '587 (STARTTLS) or 465 (SSL).' },
    { name: 'smtp_user',     label: 'SMTP Username',          placeholder: 'support@yourcompany.com', type: 'email',    hint: 'Login for the outbound mail account.' },
    { name: 'smtp_password', label: 'SMTP Password',          placeholder: '••••••••••••',            type: 'password', hint: 'Use an App Password if 2FA is enabled.' },
    { name: 'smtp_from',     label: 'From Address (optional)',placeholder: 'support@yourcompany.com', type: 'email',    hint: 'Defaults to SMTP Username if blank.' },
  ]

  const TestResult = () => testMsg && (
    <div style={{
      padding: '10px 14px', borderRadius: 'var(--radius)', fontSize: 13,
      display: 'flex', alignItems: 'center', gap: 8,
      background: testMsg.ok ? 'rgba(34,197,94,0.09)' : 'rgba(239,68,68,0.09)',
      border: `1px solid ${testMsg.ok ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
      color: testMsg.ok ? '#4ade80' : '#f87171',
    }}>
      {testMsg.ok
        ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}
      {testMsg.text}
    </div>
  )

  return (
    <div>
      <h2 className="settings-section-title">Email Configuration</h2>
      <p className="settings-section-desc">
        Configure the inbound mailbox the agent monitors (IMAP) and the outbound account used to
        send AI-generated replies back to the ticket sender (SMTP).
      </p>

      {/* Warning banner */}
      <div style={{ padding: '12px 16px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.22)', borderRadius: 'var(--radius)', marginBottom: 24 }}>
        <p style={{ fontSize: 13, color: '#fbbf24', display: 'flex', gap: 8, alignItems: 'flex-start', lineHeight: 1.55 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginTop: 1, flexShrink: 0 }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span>
            <strong>Gmail / Outlook:</strong> Use an <strong>App Password</strong> for both IMAP and SMTP.
            Enable 2-Step Verification first, then generate App Passwords from your account security settings.
          </span>
        </p>
      </div>

      {/* Quick-select preset */}
      <div className="form-group" style={{ marginBottom: 20 }}>
        <label className="label">Quick Select Provider</label>
        <select id="imap-preset-select" className="input" value={preset} onChange={handlePreset} style={{ cursor: 'pointer' }}>
          <option value="">— choose a preset —</option>
          {IMAP_PRESETS.map(p => <option key={p.label} value={p.label}>{p.label}</option>)}
        </select>
      </div>

      <form className="settings-fields" onSubmit={handleSave}>

        {/* ── IMAP Section ── */}
        <SectionTitle>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          Inbound — IMAP (receive tickets)
        </SectionTitle>

        {imapFields.map(f => (
          <div className="form-group" key={f.name}>
            <label className="label" htmlFor={f.name}>{f.label}</label>
            <input id={f.name} name={f.name} className="input" type={f.type}
              placeholder={f.placeholder} value={form[f.name]} onChange={handleChange} autoComplete="off" />
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{f.hint}</p>
          </div>
        ))}

        <TestResult />

        <div style={{ display: 'flex', gap: 10 }}>
          <button id="email-test-btn" className="btn" type="button" disabled={testing} onClick={handleTest}
            style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid var(--border)', padding: '8px 14px', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            {testing ? <><span className="spinner" /> Testing…</> : <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.63 3.37 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.76a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              Test IMAP Connection
            </>}
          </button>
        </div>

        <Divider label="Outbound — SMTP (send replies)" />

        {/* ── SMTP Section ── */}
        <SectionTitle>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          Outbound — SMTP (send AI replies)
        </SectionTitle>

        {smtpFields.map(f => (
          <div className="form-group" key={f.name}>
            <label className="label" htmlFor={f.name}>{f.label}</label>
            <input id={f.name} name={f.name} className="input" type={f.type}
              placeholder={f.placeholder} value={form[f.name]} onChange={handleChange} autoComplete="off" />
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{f.hint}</p>
          </div>
        ))}

        <Divider label="Forwarding — Escalation (Team)" />

        <SectionTitle>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3v2M21 7l-4-4M3 12h18M3 12l4-4M3 12l4 4"/></svg>
          Escalation Settings
        </SectionTitle>

        <div className="form-group">
          <label className="label" htmlFor="escalation_emails">Escalation Forwarding Emails</label>
          <input id="escalation_emails" name="escalation_emails" className="input" type="text"
            placeholder="tier2@company.com, admin@company.com" value={form.escalation_emails} onChange={handleChange} autoComplete="off" />
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Comma-separated list of emails. Tickets that the AI is not confident in (or flags for security) will be forwarded here.
          </p>
        </div>

        {/* Save row */}
        <div className="settings-save-row" style={{ gap: 10 }}>
          <button id="email-save-btn" className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? <><span className="spinner" /> Saving…</> : 'Save All Settings'}
          </button>
          {saved && (
            <span className="settings-save-msg">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              Saved successfully!
            </span>
          )}
        </div>
      </form>

      {/* Reference table */}
      <div style={{ marginTop: 32, padding: 16, background: 'var(--bg-hover)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Common Hosts</p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, color: 'var(--text-secondary)' }}>
          <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th style={{ textAlign:'left', padding:'4px 8px', fontWeight:600 }}>Provider</th>
            <th style={{ textAlign:'left', padding:'4px 8px', fontWeight:600 }}>IMAP Host</th>
            <th style={{ textAlign:'left', padding:'4px 8px', fontWeight:600 }}>SMTP Host</th>
            <th style={{ textAlign:'left', padding:'4px 8px', fontWeight:600 }}>Port</th>
          </tr></thead>
          <tbody>
            {[
              ['Gmail',          'imap.gmail.com',       'smtp.gmail.com',       '587'],
              ['Outlook / M365', 'outlook.office365.com','smtp.office365.com',   '587'],
              ['Yahoo',          'imap.mail.yahoo.com',  'smtp.mail.yahoo.com',  '587'],
            ].map(([p, ih, sh, port]) => (
              <tr key={p} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding:'6px 8px' }}>{p}</td>
                <td style={{ padding:'6px 8px', fontFamily:'monospace', color:'var(--text-primary)', fontSize:12 }}>{ih}</td>
                <td style={{ padding:'6px 8px', fontFamily:'monospace', color:'var(--text-primary)', fontSize:12 }}>{sh}</td>
                <td style={{ padding:'6px 8px' }}>{port}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
