import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function TicketsPage() {
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const navigate = useNavigate();

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [confidenceFilter, setConfidenceFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    api.get('/emails/tickets')
      .then(res => setTickets(res.data))
      .catch(err => console.error(err));
  }, []);

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      // Search
      const query = searchQuery.toLowerCase();
      const matchesSearch = !query || 
        (t.sender_email && t.sender_email.toLowerCase().includes(query)) ||
        (t.subject && t.subject.toLowerCase().includes(query));

      // Status
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;

      // Confidence
      let matchesConfidence = true;
      if (confidenceFilter !== 'all') {
        const conf = t.confidence_score || 0;
        if (confidenceFilter === 'high') matchesConfidence = conf >= 0.8;
        else if (confidenceFilter === 'medium') matchesConfidence = conf >= 0.5 && conf < 0.8;
        else if (confidenceFilter === 'low') matchesConfidence = conf < 0.5;
      }

      // Date
      let matchesDate = true;
      if (dateFilter !== 'all' && t.received_at) {
        const ticketDate = new Date(t.received_at);
        const now = new Date();
        const daysDiff = (now - ticketDate) / (1000 * 60 * 60 * 24);
        if (dateFilter === 'today') matchesDate = daysDiff <= 1;
        else if (dateFilter === '7days') matchesDate = daysDiff <= 7;
        else if (dateFilter === '30days') matchesDate = daysDiff <= 30;
      }

      return matchesSearch && matchesStatus && matchesConfidence && matchesDate;
    });
  }, [tickets, searchQuery, statusFilter, confidenceFilter, dateFilter]);

  const paginatedTickets = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredTickets.slice(start, start + itemsPerPage);
  }, [filteredTickets, currentPage]);

  const totalPages = Math.ceil(filteredTickets.length / itemsPerPage) || 1;

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, confidenceFilter, dateFilter]);

  const controlStyle = {
    padding: '0.6rem 1rem',
    borderRadius: '6px',
    border: '1px solid var(--border, #333)',
    background: 'var(--bg-secondary, #1f2937)',
    color: 'var(--text-primary, #fff)',
    fontSize: '0.9rem',
    outline: 'none',
    cursor: 'pointer'
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0, color: 'var(--text-primary, #fff)' }}>Email Tickets</h1>
        <button onClick={() => navigate('/dashboard')} style={{ padding: '0.6rem 1.2rem', background: 'var(--primary, #3498db)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, transition: 'opacity 0.2s' }} onMouseOver={e=>e.target.style.opacity=0.8} onMouseOut={e=>e.target.style.opacity=1}>
          &larr; Back to Dashboard
        </button>
      </div>

      <div style={{ 
        display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem', 
        background: 'var(--bg-panel, rgba(0,0,0,0.2))', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border, #333)' 
      }}>
        <div style={{ flex: '1 1 250px' }}>
          <input 
            type="text" 
            placeholder="Search by sender or subject..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ ...controlStyle, width: '100%', boxSizing: 'border-box', cursor: 'text' }}
          />
        </div>
        
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={controlStyle}>
          <option value="all">All Statuses</option>
          <option value="resolved">Resolved</option>
          <option value="escalated">Escalated</option>
          <option value="blocked">Blocked</option>
        </select>

        <select value={confidenceFilter} onChange={e => setConfidenceFilter(e.target.value)} style={controlStyle}>
          <option value="all">All Confidence</option>
          <option value="high">High (&ge; 80%)</option>
          <option value="medium">Medium (50% - 79%)</option>
          <option value="low">Low (&lt; 50%)</option>
        </select>

        <select value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={controlStyle}>
          <option value="all">All Time</option>
          <option value="today">Today</option>
          <option value="7days">Last 7 Days</option>
          <option value="30days">Last 30 Days</option>
        </select>
      </div>

      <div style={{ background: 'var(--bg-panel, var(--bg-card))', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-hover)', textAlign: 'left' }}>
              <th style={{ padding: '1.2rem 1rem', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>Status</th>
              <th style={{ padding: '1.2rem 1rem', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>Sender</th>
              <th style={{ padding: '1.2rem 1rem', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>Subject</th>
              <th style={{ padding: '1.2rem 1rem', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>Confidence</th>
              <th style={{ padding: '1.2rem 1rem', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>Received</th>
            </tr>
          </thead>
          <tbody>
            {paginatedTickets.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No tickets match your filters.
                </td>
              </tr>
            ) : paginatedTickets.map(t => (
              <tr key={t.id} onClick={() => setSelectedTicket(t)} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = 'var(--bg-hover)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '1rem' }}>
                   <span style={{ 
                      padding: '0.3rem 0.6rem', 
                      borderRadius: '6px', 
                      fontSize: '0.8rem',
                      background: t.status === 'resolved' ? 'rgba(46, 204, 113, 0.15)' : 
                                  t.status === 'escalated' ? 'rgba(241, 196, 15, 0.15)' :
                                  t.status === 'blocked' ? 'rgba(231, 76, 60, 0.15)' : 'rgba(189, 195, 199, 0.15)',
                      color: t.status === 'resolved' ? '#2ecc71' : 
                             t.status === 'escalated' ? '#f1c40f' :
                             t.status === 'blocked' ? '#e74c3c' : '#bdc3c7',
                      fontWeight: 'bold',
                      border: `1px solid ${
                                  t.status === 'resolved' ? 'rgba(46, 204, 113, 0.3)' : 
                                  t.status === 'escalated' ? 'rgba(241, 196, 15, 0.3)' :
                                  t.status === 'blocked' ? 'rgba(231, 76, 60, 0.3)' : 'rgba(189, 195, 199, 0.3)'
                      }`
                   }}>
                     {t.status.toUpperCase()}
                   </span>
                </td>
                <td style={{ padding: '1rem', fontSize: '0.95rem', color: 'var(--text-primary)' }}>{t.sender_email}</td>
                <td style={{ padding: '1rem', color: 'var(--text-primary)', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.subject}</td>
                <td style={{ padding: '1rem', color: 'var(--text-primary)', fontWeight: 600 }}>{t.confidence_score != null ? (t.confidence_score * 100).toFixed(1) + '%' : '-'}</td>
                <td style={{ padding: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{new Date(t.received_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {filteredTickets.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', background: 'var(--bg-hover)' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredTickets.length)} of {filteredTickets.length} tickets
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={{ ...controlStyle, opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
              >
                Previous
              </button>
              <div style={{ display: 'flex', alignItems: 'center', padding: '0 0.5rem', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                Page {currentPage} of {totalPages}
              </div>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                style={{ ...controlStyle, opacity: currentPage === totalPages ? 0.5 : 1, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Ticket Details Modal */}
      {selectedTicket && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '2rem', backdropFilter: 'blur(4px)'
        }} onClick={() => setSelectedTicket(null)}>
          <div style={{
            background: 'var(--bg-card)', padding: '2rem', borderRadius: '12px',
            width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto',
            boxShadow: 'var(--shadow-lg)', 
            border: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column', gap: '1.5rem',
            position: 'relative'
          }} onClick={e => e.stopPropagation()}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>{selectedTicket.subject}</h2>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  <strong>From:</strong> {selectedTicket.sender_email} &nbsp;|&nbsp; 
                  <strong> Received:</strong> {new Date(selectedTicket.received_at).toLocaleString()}
                </div>
              </div>
              <button onClick={() => setSelectedTicket(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0.5rem' }}>&times;</button>
            </div>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <span style={{ padding: '0.4rem 0.8rem', background: 'rgba(52, 152, 219, 0.1)', color: '#3498db', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 600 }}>
                Status: {selectedTicket.status.toUpperCase()}
              </span>
              <span style={{ padding: '0.4rem 0.8rem', background: 'rgba(155, 89, 182, 0.1)', color: '#9b59b6', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 600 }}>
                Priority: {selectedTicket.priority?.toUpperCase() || 'N/A'}
              </span>
              <span style={{ padding: '0.4rem 0.8rem', background: 'rgba(230, 126, 34, 0.1)', color: '#e67e22', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 600 }}>
                Severity: {selectedTicket.severity?.toUpperCase() || 'N/A'}
              </span>
              <span style={{ padding: '0.4rem 0.8rem', background: 'rgba(46, 204, 113, 0.1)', color: '#2ecc71', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 600 }}>
                Confidence: {selectedTicket.confidence_score != null ? (selectedTicket.confidence_score * 100).toFixed(1) + '%' : 'N/A'}
              </span>
              <span style={{ padding: '0.4rem 0.8rem', background: selectedTicket.reply_sent ? 'rgba(46, 204, 113, 0.1)' : 'rgba(231, 76, 60, 0.1)', color: selectedTicket.reply_sent ? '#2ecc71' : '#e74c3c', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 600 }}>
                Reply Sent: {selectedTicket.reply_sent ? 'YES' : 'NO'}
              </span>
            </div>

            <div>
              <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Original User Email</h3>
              <div style={{ background: 'var(--bg-input)', padding: '1rem', borderRadius: '6px', fontSize: '0.95rem', lineHeight: 1.5, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', border: '1px solid var(--border)' }}>
                {selectedTicket.body || 'No content.'}
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Generated Reply</h3>
              <div style={{ background: 'rgba(46, 204, 113, 0.1)', padding: '1rem', borderRadius: '6px', fontSize: '0.95rem', lineHeight: 1.5, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', border: '1px solid rgba(46, 204, 113, 0.3)' }}>
                {selectedTicket.generated_response || 'No response generated (ticket may have been escalated or blocked).'}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
