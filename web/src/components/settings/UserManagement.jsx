import { useState, useEffect } from 'react'
import api from '../../api'

export default function UserManagement() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'support' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { fetchUsers() }, [])

  async function fetchUsers() {
    setLoading(true)
    try { const { data } = await api.get('/users/'); setUsers(data) }
    catch (_) {}
    finally { setLoading(false) }
  }

  async function handleCreate(e) {
    e.preventDefault(); setError('')
    setSaving(true)
    try {
      await api.post('/users/', form)
      setShowForm(false); setForm({ username: '', email: '', password: '', role: 'support' })
      fetchUsers()
    } catch (err) { setError(err.response?.data?.detail || 'Error creating user') }
    finally { setSaving(false) }
  }

  async function toggleActive(user) {
    await api.patch(`/users/${user.id}`, { is_active: !user.is_active })
    fetchUsers()
  }

  async function deleteUser(id) {
    if (!confirm('Delete this user?')) return
    await api.delete(`/users/${id}`)
    fetchUsers()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h2 className="settings-section-title" style={{ marginBottom: 4 }}>User Management</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Manage user accounts and role-based access.</p>
        </div>
        <button id="add-user-btn" className="btn btn-primary" onClick={() => setShowForm(v => !v)}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add User
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 20, marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600 }}>New User</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="label">Username</label>
              <input className="input" value={form.username} onChange={e => setForm(f => ({...f, username: e.target.value}))} required placeholder="username" />
            </div>
            <div className="form-group">
              <label className="label">Email</label>
              <input className="input" type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} required placeholder="user@example.com" />
            </div>
            <div className="form-group">
              <label className="label">Password</label>
              <input className="input" type="password" value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} required placeholder="••••••••" />
            </div>
            <div className="form-group">
              <label className="label">Role</label>
              <select className="input" value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value}))}>
                <option value="support">Support</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          {error && <p style={{ color: 'var(--error)', fontSize: 13 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button id="create-user-submit" className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? <><span className="spinner" /> Creating…</> : 'Create User'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><div className="spinner" /></div> : (
        <div className="users-table">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['User', 'Email', 'Role', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>{u.username[0].toUpperCase()}</div>
                      <span style={{ fontWeight: 500 }}>{u.username}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 12px', color: 'var(--text-secondary)' }}>{u.email}</td>
                  <td style={{ padding: '12px 12px' }}><span className={`badge badge-${u.role}`}>{u.role}</span></td>
                  <td style={{ padding: '12px 12px' }}><span className={`badge badge-${u.is_active ? 'success' : 'error'}`}>{u.is_active ? 'Active' : 'Disabled'}</span></td>
                  <td style={{ padding: '12px 12px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => toggleActive(u)}>
                        {u.is_active ? 'Disable' : 'Enable'}
                      </button>
                      <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => deleteUser(u.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
