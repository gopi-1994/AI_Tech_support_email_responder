export default function LicensePage() {
  return (
    <div>
      <h2 className="settings-section-title">License Information</h2>
      <p className="settings-section-desc">
        Product licensing details and usage information for SecureAI Agent.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* License card */}
        <div style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(79,70,229,0.08))', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 14, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>SecureAI Agent</h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Academic Research License · MCA Final Year Project</p>
            </div>
            <span className="badge badge-success" style={{ padding: '5px 14px', fontSize: 12 }}>Active</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            {[
              { label: 'License Type', value: 'Academic' },
              { label: 'Issue Date', value: '2026-01-01' },
              { label: 'Expiry Date', value: '2026-12-31' },
            ].map(item => (
              <div key={item.label} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: '12px 16px' }}>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</p>
                <p style={{ fontSize: 14, fontWeight: 600 }}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Features */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Included Features</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              'AI-powered Email Processing',
              'Microsoft Copilot RAG Integration',
              'SharePoint Knowledge Retrieval',
              'Spam & Phishing Detection',
              'Prompt Injection Protection',
              'L2 Escalation Workflow',
              'Admin Dashboard',
              'User Role Management',
              'Chat Session History',
              'Audit & Security Logs',
            ].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                {f}
              </div>
            ))}
          </div>
        </div>

        {/* Built for */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Project Information</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
            <div style={{ display: 'flex', gap: 12 }}><span style={{ color: 'var(--text-muted)', minWidth: 140 }}>Project Title</span><span>Secure AI Agent for Automated Technical Support Email Processing</span></div>
            <div style={{ display: 'flex', gap: 12 }}><span style={{ color: 'var(--text-muted)', minWidth: 140 }}>Technology</span><span>Microsoft Copilot Retrieval API · FastAPI · React</span></div>
            <div style={{ display: 'flex', gap: 12 }}><span style={{ color: 'var(--text-muted)', minWidth: 140 }}>Academic Year</span><span>2025 – 2026</span></div>
            <div style={{ display: 'flex', gap: 12 }}><span style={{ color: 'var(--text-muted)', minWidth: 140 }}>Version</span><span>1.0.0</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}
