import { useState } from 'react';

export default function AppearanceSettings() {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    if (newTheme === 'light') {
      document.documentElement.classList.add('theme-light');
    } else {
      document.documentElement.classList.remove('theme-light');
    }
  };

  return (
    <div>
      <h2 className="settings-section-title">Appearance</h2>
      <p className="settings-section-desc">
        Customize the look and feel of your SecureAI dashboard. These settings are saved to your local browser.
      </p>

      <div className="form-group" style={{ marginBottom: '2rem' }}>
        <label className="label">Dashboard Theme</label>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          
          {/* Dark Mode Card */}
          <div 
            onClick={() => handleThemeChange('dark')}
            style={{ 
              flex: 1, 
              border: `2px solid ${theme === 'dark' ? 'var(--accent)' : 'var(--border)'}`, 
              borderRadius: '8px', 
              padding: '1.5rem 1rem', 
              cursor: 'pointer',
              background: '#111113',
              textAlign: 'center',
              position: 'relative',
              transition: 'all 0.2s',
              boxShadow: theme === 'dark' ? 'var(--shadow-accent)' : 'none'
            }}>
            <div style={{ width: '40px', height: '40px', background: '#1a1a1d', border: '1px solid #2a2a2f', borderRadius: '50%', margin: '0 auto 10px auto' }}></div>
            <strong style={{ color: '#f0f0f5', display: 'block' }}>Dark Mode</strong>
            <span style={{ fontSize: '0.8rem', color: '#9999aa' }}>Default premium</span>
            {theme === 'dark' && (
              <div style={{ position: 'absolute', top: 10, right: 10, color: 'var(--accent)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
              </div>
            )}
          </div>

          {/* Light Mode Card */}
          <div 
            onClick={() => handleThemeChange('light')}
            style={{ 
              flex: 1, 
              border: `2px solid ${theme === 'light' ? 'var(--accent)' : 'var(--border)'}`, 
              borderRadius: '8px', 
              padding: '1.5rem 1rem', 
              cursor: 'pointer',
              background: '#f8f9fa',
              textAlign: 'center',
              position: 'relative',
              transition: 'all 0.2s',
              boxShadow: theme === 'light' ? 'var(--shadow-accent)' : 'none'
            }}>
            <div style={{ width: '40px', height: '40px', background: '#ffffff', border: '1px solid #dee2e6', borderRadius: '50%', margin: '0 auto 10px auto' }}></div>
            <strong style={{ color: '#111827', display: 'block' }}>Light Mode</strong>
            <span style={{ fontSize: '0.8rem', color: '#4b5563' }}>Clean and bright</span>
            {theme === 'light' && (
              <div style={{ position: 'absolute', top: 10, right: 10, color: 'var(--accent)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
