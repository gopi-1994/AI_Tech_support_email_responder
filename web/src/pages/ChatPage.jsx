import { useOutletContext } from 'react-router-dom'
import ChatArea from '../components/ChatArea'

export default function ChatPage() {
  const { currentSession, setCurrentSession, setRefreshSessions } = useOutletContext()

  function handleSessionCreated(session) {
    setCurrentSession(session)
    setRefreshSessions(n => n + 1)
  }

  return (
    <ChatArea
      session={currentSession}
      onSessionCreated={handleSessionCreated}
    />
  )
}
