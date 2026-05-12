/**
 * AppLayout — shared shell that wraps all authenticated pages.
 * Renders the Sidebar + Settings modal alongside the page content.
 */
import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import SettingsModal from './SettingsModal'
import '../pages/ChatPage.css'   // re-use the flex layout styles

export default function AppLayout() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab,  setSettingsTab]  = useState('model')
  const [refreshSessions, setRefreshSessions] = useState(0)
  const [currentSession,  setCurrentSession]  = useState(null)

  function openSettings(tab = 'model') {
    setSettingsTab(tab)
    setSettingsOpen(true)
  }

  return (
    <div className="chat-layout">
      <Sidebar
        currentSession={currentSession}
        onSelectSession={setCurrentSession}
        onNewChat={() => setCurrentSession(null)}
        onOpenSettings={openSettings}
        refreshKey={refreshSessions}
        onSessionDeleted={id => {
          if (currentSession?.id === id) setCurrentSession(null)
          setRefreshSessions(n => n + 1)
        }}
      />

      {/* Page content injected here */}
      <main className="chat-main" style={{ overflow: 'auto' }}>
        <Outlet context={{ currentSession, setCurrentSession, setRefreshSessions, openSettings }} />
      </main>

      {settingsOpen && (
        <SettingsModal initialTab={settingsTab} onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  )
}
