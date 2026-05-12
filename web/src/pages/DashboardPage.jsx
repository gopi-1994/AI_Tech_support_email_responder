import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import './DashboardPage.css'

const REFRESH_INTERVAL = 30_000 // 30 s

// ── Small helpers ────────────────────────────────────────────────────────────

function StatCard({ label, value, color, icon, sub }) {
  return (
    <div className="dash-stat-card" style={{ '--card-accent': color }}>
      <div className="dash-stat-icon" style={{ background: color + '22', color }}>
        {icon}
      </div>
      <div className="dash-stat-body">
        <span className="dash-stat-value">{value}</span>
        <span className="dash-stat-label">{label}</span>
        {sub && <span className="dash-stat-sub">{sub}</span>}
      </div>
    </div>
  )
}

function BarChart({ data, colors }) {
  const max = Math.max(...Object.values(data), 1)
  return (
    <div className="dash-bar-chart">
      {Object.entries(data).map(([key, val]) => (
        <div key={key} className="dash-bar-row">
          <span className="dash-bar-label">{key.charAt(0).toUpperCase() + key.slice(1)}</span>
          <div className="dash-bar-track">
            <div
              className="dash-bar-fill"
              style={{ width: `${(val / max) * 100}%`, background: colors[key] || 'var(--accent)' }}
            />
          </div>
          <span className="dash-bar-val">{val}</span>
        </div>
      ))}
    </div>
  )
}

function DonutChart({ segments, size = 120 }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1
  let offset = 0
  const r = 40, cx = 60, cy = 60, circ = 2 * Math.PI * r

  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      {segments.map((seg, i) => {
        const pct   = seg.value / total
        const dash  = pct * circ
        const gap   = circ - dash
        const rot   = offset * circ * (360 / circ)
        const el = (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth="18"
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-offset * circ}
            style={{ transform: 'rotate(-90deg)', transformOrigin: '60px 60px' }}
          />
        )
        offset += pct
        return el
      })}
      <text x="60" y="56" textAnchor="middle" fill="var(--text-primary)" fontSize="18" fontWeight="700">{total}</text>
      <text x="60" y="72" textAnchor="middle" fill="var(--text-muted)" fontSize="9">Total</text>
    </svg>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [stats, setStats]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(null)
  const navigate = useNavigate()

  async function fetchStats() {
    try {
      const { data } = await api.get('/emails/stats')
      setStats(data)
      setLastRefresh(new Date())
    } catch (err) {
      console.error('Dashboard stats error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
    const id = setInterval(fetchStats, REFRESH_INTERVAL)
    return () => clearInterval(id)
  }, [])

  if (loading) {
    return (
      <div className="dash-loading">
        <div className="spinner" style={{ width: 32, height: 32 }} />
        <p>Loading dashboard…</p>
      </div>
    )
  }

  const s   = stats?.status   || {}
  const p   = stats?.priority || {}
  const sev = stats?.severity || {}
  const sec = stats?.security || {}

  const statusSegments = [
    { value: s.resolved   || 0, color: '#22c55e', label: 'Resolved' },
    { value: s.escalated  || 0, color: '#f59e0b', label: 'Escalated' },
    { value: s.blocked    || 0, color: '#ef4444', label: 'Blocked' },
    { value: s.processing || 0, color: '#7c3aed', label: 'Processing' },
    { value: s.received   || 0, color: '#3b82f6', label: 'Received' },
  ]

  return (
    <div className="dash-root">
      {/* Header */}
      <div className="dash-header">
        <div>
          <h1 className="dash-title">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
            </svg>
            Email Intelligence Dashboard
          </h1>
          <p className="dash-subtitle">
            AI agent powered by LangGraph + Microsoft Copilot Retrieval API
            {lastRefresh && <span className="dash-refresh-ts"> · Updated {lastRefresh.toLocaleTimeString()}</span>}
          </p>
        </div>
        <div className="dash-header-actions">
          <button id="dash-refresh-btn" className="btn btn-ghost" onClick={fetchStats}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            Refresh
          </button>
          <button id="dash-tickets-btn" className="btn btn-primary" onClick={() => navigate('/tickets')}>
            View Tickets
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="dash-kpi-row">
        <StatCard label="Total Emails" value={s.total || 0} color="#7c3aed"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>} />

        <StatCard label="Auto-Resolved" value={s.resolved || 0} color="#22c55e"
          sub={`${stats?.resolution_rate ?? 0}% resolution rate`}
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>} />

        <StatCard label="In Progress" value={(s.processing || 0) + (s.received || 0)} color="#3b82f6"
          sub={`${s.processing || 0} processing · ${s.received || 0} queued`}
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>} />

        <StatCard label="Escalated (L2)" value={s.escalated || 0} color="#f59e0b"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>} />

        <StatCard label="Blocked (Security)" value={s.blocked || 0} color="#ef4444"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>} />

        <StatCard label="Replies Sent" value={stats?.replies_sent || 0} color="#06b6d4"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>} />
      </div>

      {/* Charts Row */}
      <div className="dash-charts-row">

        {/* Status donut */}
        <div className="dash-card">
          <h3 className="dash-card-title">Status Breakdown</h3>
          <div className="dash-donut-wrap">
            <DonutChart segments={statusSegments} />
            <div className="dash-donut-legend">
              {statusSegments.map(seg => (
                <div key={seg.label} className="dash-legend-item">
                  <span className="dash-legend-dot" style={{ background: seg.color }} />
                  <span className="dash-legend-label">{seg.label}</span>
                  <span className="dash-legend-val">{seg.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Priority bar */}
        <div className="dash-card">
          <h3 className="dash-card-title">Priority Distribution</h3>
          <BarChart
            data={{ critical: p.critical||0, high: p.high||0, medium: p.medium||0, low: p.low||0 }}
            colors={{ critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#22c55e' }}
          />
        </div>

        {/* Severity bar */}
        <div className="dash-card">
          <h3 className="dash-card-title">Severity Distribution</h3>
          <BarChart
            data={{ high: sev.high||0, medium: sev.medium||0, low: sev.low||0 }}
            colors={{ high: '#ef4444', medium: '#f59e0b', low: '#22c55e' }}
          />
        </div>

        {/* Security events */}
        <div className="dash-card">
          <h3 className="dash-card-title">Security Events</h3>
          <BarChart
            data={{ spam: sec.spam||0, phishing: sec.phishing||0, 'prompt injection': sec.prompt_injection||0 }}
            colors={{ spam: '#f97316', phishing: '#ef4444', 'prompt injection': '#a855f7' }}
          />
          <div className="dash-security-total">
            <span>Total threats blocked</span>
            <span className="dash-security-num" style={{ color: '#ef4444' }}>
              {(sec.spam||0) + (sec.phishing||0) + (sec.prompt_injection||0)}
            </span>
          </div>
        </div>

      </div>

      {/* Footer nav */}
      <div className="dash-footer">
        <button className="btn btn-ghost" id="dash-back-btn" onClick={() => navigate('/')}>← Back to Chat</button>
      </div>
    </div>
  )
}
