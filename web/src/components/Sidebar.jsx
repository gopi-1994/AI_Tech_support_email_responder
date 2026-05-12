import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import api from '../api'
import './Sidebar.css'

export default function Sidebar({ currentSession, onSelectSession, onNewChat, onOpenSettings, refreshKey, onSessionDeleted }) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const role     = localStorage.getItem('role')
  const username = localStorage.getItem('username')

  useEffect(() => { fetchSessions() }, [refreshKey])

  async function fetchSessions() {
    try {
      const { data } = await api.get('/chat/sessions')
      setSessions(data)
    } catch (_) {}
    finally { setLoading(false) }
  }

  async function deleteSession(e, id) {
    e.stopPropagation()
    await api.delete(`/chat/sessions/${id}`)
    setSessions(s => s.filter(x => x.id !== id))
    onSessionDeleted(id)
  }

  function handleLogout() {
    localStorage.clear()
    window.location.href = '/login'
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
    if (d.toDateString() === today.toDateString()) return 'Today'
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  function groupSessions(sessions) {
    const groups = {}
    sessions.forEach(s => {
      const label = formatDate(s.updated_at)
      if (!groups[label]) groups[label] = []
      groups[label].push(s)
    })
    return groups
  }

  const grouped = groupSessions(sessions)

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V7L12 2z" fill="url(#sb-grad)"/>
              <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <defs><linearGradient id="sb-grad" x1="3" y1="2" x2="21" y2="23" gradientUnits="userSpaceOnUse"><stop stopColor="#7c3aed"/><stop offset="1" stopColor="#4f46e5"/></linearGradient></defs>
            </svg>
          </div>
          <span className="sidebar-brand-name">SecureAI</span>
        </div>
        <button id="new-chat-btn" className="btn-icon" onClick={() => { navigate('/'); onNewChat() }} title="New chat">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>

      {/* ── Main Navigation ── */}
      <nav className="sidebar-nav">
        <NavLink id="nav-dashboard" to="/dashboard" className={({ isActive }) => `sidebar-nav-item${isActive ? ' active' : ''}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
          Dashboard
        </NavLink>

        <NavLink id="nav-chat" to="/" end className={({ isActive }) => `sidebar-nav-item${isActive ? ' active' : ''}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          Chat
        </NavLink>

        {role === 'admin' && (
          <NavLink id="nav-tickets" to="/tickets" className={({ isActive }) => `sidebar-nav-item${isActive ? ' active' : ''}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
            </svg>
            Email Tickets
          </NavLink>
        )}
      </nav>

      <div className="sidebar-divider" />

      {/* Search */}
      <div className="sidebar-search">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <span>Search chats…</span>
      </div>

      {/* Chat session list */}
      <div className="sidebar-sessions">
        {loading ? (
          <div className="sidebar-empty"><div className="spinner" /></div>
        ) : sessions.length === 0 ? (
          <div className="sidebar-empty">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <p>No recent chats</p>
            <p>Start a new conversation</p>
          </div>
        ) : Object.entries(grouped).map(([label, items]) => (
          <div key={label} className="session-group">
            <div className="session-group-label">{label}</div>
            {items.map(s => (
              <div
                key={s.id}
                id={`session-${s.id}`}
                className={`session-item ${currentSession?.id === s.id ? 'active' : ''}`}
                onClick={() => { navigate('/'); onSelectSession(s) }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="session-icon"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                <span className="session-title">{s.title}</span>
                <button
                  className="btn-icon session-delete"
                  onClick={e => deleteSession(e, s.id)}
                  title="Delete"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{username?.[0]?.toUpperCase() || 'U'}</div>
          <div className="sidebar-userinfo">
            <span className="sidebar-username">{username}</span>
            <span className={`badge badge-${role === 'admin' ? 'admin' : 'support'}`}>{role}</span>
          </div>
          <button id="logout-btn" className="btn-icon" onClick={handleLogout} title="Logout">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>

        {/* Settings quick-links */}
        <div className="sidebar-settings-nav">
          <button id="settings-model-btn" className="settings-nav-item" onClick={() => onOpenSettings('model')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
            Settings
          </button>
        </div>
      </div>
    </aside>
  )
}
