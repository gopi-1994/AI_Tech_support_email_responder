import { useState } from 'react'
import ModelSettings from './settings/ModelSettings'
import CopilotSettings from './settings/CopilotSettings'
import EmailSettings from './settings/EmailSettings'
import UserManagement from './settings/UserManagement'
import LicensePage from './settings/LicensePage'
import AppearanceSettings from './settings/AppearanceSettings'
import './SettingsModal.css'

const TABS = [
  { id: 'model',   label: 'Model',           icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>, adminOnly: false },
  { id: 'appearance', label: 'Appearance',   icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>, adminOnly: false },
  { id: 'copilot', label: 'M365 Copilot',    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>, adminOnly: false },
  { id: 'email',   label: 'Email / IMAP',    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>, adminOnly: true },
  { id: 'users',   label: 'User Management', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>, adminOnly: true },
  { id: 'license', label: 'License',          icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>, adminOnly: false },
]

export default function SettingsModal({ initialTab, onClose }) {
  const role = localStorage.getItem('role')   // read inside component – always fresh
  const [tab, setTab] = useState(initialTab || 'model')
  const visibleTabs = TABS.filter(t => !t.adminOnly || role === 'admin')

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className="settings-backdrop" onClick={handleBackdrop}>
      <div className="settings-modal fade-in">
        {/* Sidebar nav */}
        <aside className="settings-sidebar">
          <div className="settings-sidebar-header">
            <h2>Settings</h2>
            <button id="settings-close-btn" className="btn-icon" onClick={onClose}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <nav className="settings-nav">
            {visibleTabs.map(t => (
              <button
                key={t.id}
                id={`settings-tab-${t.id}`}
                className={`settings-nav-btn ${tab === t.id ? 'active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </nav>
          <div className="settings-sidebar-footer">
            <p>SecureAI Agent v1.0</p>
            <p>MCA Final Year Project</p>
          </div>
        </aside>

        {/* Content */}
        <main className="settings-content">
          {tab === 'model'   && <ModelSettings />}
          {tab === 'appearance' && <AppearanceSettings />}
          {tab === 'copilot' && <CopilotSettings />}
          {tab === 'email'   && <EmailSettings />}
          {tab === 'users'   && <UserManagement />}
          {tab === 'license' && <LicensePage />}
        </main>
      </div>
    </div>
  )
}
