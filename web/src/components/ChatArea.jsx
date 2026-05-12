import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import api from '../api'
import './ChatArea.css'

const username = localStorage.getItem('username')

export default function ChatArea({ session, onSessionCreated }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [thinking, setThinking] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (session) loadMessages(session.id)
    else setMessages([])
  }, [session])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking])

  async function loadMessages(id) {
    setLoading(true)
    try {
      const { data } = await api.get(`/chat/sessions/${id}/messages`)
      setMessages(data)
    } catch (_) {}
    finally { setLoading(false) }
  }

  async function handleSend(e) {
    e?.preventDefault()
    const text = input.trim()
    if (!text || thinking) return
    setInput('')

    let activeSession = session

    // Create new session if needed
    if (!activeSession) {
      const { data } = await api.post('/chat/sessions', { title: text.slice(0, 60) })
      activeSession = data
      onSessionCreated(data)
    }

    // Optimistically show user message
    const tempMsg = { id: Date.now(), role: 'user', content: text, timestamp: new Date().toISOString() }
    setMessages(prev => [...prev, tempMsg])
    setThinking(true)

    try {
      const { data: aiMsg } = await api.post(`/chat/sessions/${activeSession.id}/messages`, { content: text })
      setMessages(prev => [...prev, aiMsg])
    } catch (err) {
      setMessages(prev => [...prev, {
        id: Date.now(), role: 'assistant',
        content: '⚠️ Error getting response. Please try again.',
        timestamp: new Date().toISOString()
      }])
    } finally {
      setThinking(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const isEmpty = !session && messages.length === 0

  return (
    <div className="chat-area">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-info">
          <div className="chat-header-dot" />
          <span className="chat-header-title">
            {session ? session.title : 'SecureAI Technical Support'}
          </span>
        </div>
        <div className="chat-header-meta">
          <span className="badge badge-success">Online</span>
        </div>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {isEmpty && (
          <div className="chat-welcome fade-in">
            <div className="chat-welcome-icon">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V7L12 2z" fill="url(#w-grad)"/>
                <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <defs><linearGradient id="w-grad" x1="3" y1="2" x2="21" y2="23" gradientUnits="userSpaceOnUse"><stop stopColor="#7c3aed"/><stop offset="1" stopColor="#4f46e5"/></linearGradient></defs>
              </svg>
            </div>
            <h2>Hello, {username}!</h2>
            <p>I'm your Secure AI technical support assistant. Ask me anything about technical issues, and I'll help you find solutions from our knowledge base.</p>
            <div className="chat-suggestions">
              {['How do I reset a user password?', 'Troubleshoot VPN connection issues', 'Email not syncing on Outlook', 'How to configure MFA?'].map(s => (
                <button key={s} className="suggestion-chip" onClick={() => { setInput(s); inputRef.current?.focus() }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div className="chat-loading"><div className="spinner" /> Loading messages…</div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`message fade-in ${msg.role}`}>
            <div className="message-avatar">
              {msg.role === 'user'
                ? username?.[0]?.toUpperCase() || 'U'
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V7L12 2z" fill="#7c3aed"/><path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              }
            </div>
            <div className="message-body">
              <div className="message-sender">
                {msg.role === 'user' ? username : 'SecureAI'}
                <span className="message-time">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="message-content">
                {msg.role === 'assistant'
                  ? <ReactMarkdown>{msg.content}</ReactMarkdown>
                  : <p>{msg.content}</p>
                }
              </div>
            </div>
          </div>
        ))}

        {thinking && (
          <div className="message assistant fade-in">
            <div className="message-avatar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V7L12 2z" fill="#7c3aed"/><path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div className="message-body">
              <div className="message-sender">SecureAI</div>
              <div className="message-content typing">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input Box */}
      <div className="chat-input-area">
        <form className="chat-input-form" onSubmit={handleSend}>
          <div className="chat-input-box">
            <textarea
              id="chat-input"
              ref={inputRef}
              className="chat-textarea"
              placeholder="Ask about a technical issue…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
            />
            <button id="chat-send-btn" className="chat-send-btn" type="submit" disabled={!input.trim() || thinking}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
          <p className="chat-input-hint">Press Enter to send · Shift+Enter for new line</p>
        </form>
      </div>
    </div>
  )
}
