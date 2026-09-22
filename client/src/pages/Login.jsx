import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api.js';
import { useTheme } from '../App.jsx';
import { DumbbellIcon, SunIcon, MoonIcon, UserIcon, PhoneIcon, ShieldIcon } from '../ui.jsx';

export default function Login({ onLogin }) {
  const { theme, toggleTheme } = useTheme();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [form, setForm] = useState({ name: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { token } = await api(`/auth/${mode}`, { method: 'POST', body: form });
      onLogin(token);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      {/* Top right theme toggle */}
      <div className="auth-theme-toggle">
        <button
          type="button"
          className="theme-toggle-btn"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label="Toggle theme">
          {theme === 'dark' ? <SunIcon size={16} /> : <MoonIcon size={16} />}
        </button>
      </div>

      {/* Main Authentication Card */}
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="auth-card">
        
        {/* Brand Header */}
        <div className="auth-brand">
          <div className="auth-logo-wrap">
            <DumbbellIcon size={24} />
          </div>
          <h1 className="auth-title">Local SaaS</h1>
          <p className="auth-subtitle">
            Billing, dues tracking & WhatsApp collections for gym, hostel, tuition & mess.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            className={`auth-tab-btn ${mode === 'login' ? 'active' : ''}`}
            onClick={() => { setError(''); setMode('login'); }}>
            Login
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            className={`auth-tab-btn ${mode === 'register' ? 'active' : ''}`}
            onClick={() => { setError(''); setMode('register'); }}>
            Create Account
          </button>
        </div>

        {/* Auth Form */}
        <form className="auth-form" onSubmit={submit}>
          <AnimatePresence mode="wait">
            {mode === 'register' && (
              <motion.div
                key="register-name"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}>
                <div className="field" style={{ marginBottom: 12 }}>
                  <label className="input-label">
                    <UserIcon size={14} /> Full Name
                  </label>
                  <input
                    autoComplete="name"
                    placeholder="e.g. Rahul Sharma"
                    required
                    value={form.name}
                    onChange={set('name')}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="field">
            <label className="input-label">
              <PhoneIcon size={14} /> Mobile Phone Number
            </label>
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="10-digit mobile number"
              required
              value={form.phone}
              onChange={set('phone')}
            />
          </div>

          <div className="field">
            <label className="input-label">
              <ShieldIcon size={14} /> Password
            </label>
            <input
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder="••••••••"
              required
              value={form.password}
              onChange={set('password')}
            />
          </div>

          {error && <p className="small red-text" role="alert" style={{ marginTop: 2 }}>{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="btn"
            style={{ width: '100%', minHeight: 38, fontSize: 13, fontWeight: 600, marginTop: 6, background: 'var(--green)' }}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign In to Workspace' : 'Create Free Account'}
          </button>
        </form>

        <div className="auth-footer-note">
          <span>🔒 End-to-end encrypted · Multi-device access</span>
        </div>
      </motion.div>
    </div>
  );
}
