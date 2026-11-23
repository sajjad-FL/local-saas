import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../api.js';
import { useTheme } from '../App.jsx';
import { SunIcon, MoonIcon, UserIcon, PhoneIcon, ShieldIcon, BuildingIcon, CheckIcon, EyeIcon, EyeOffIcon } from '../ui.jsx';
import { Logo, HeroArt, TYPES, TYPE_ART } from '../brand.jsx';

const POINTS_LOGIN = ['Easy setup', 'Save time', 'Stay organized', 'Grow your business'];
const POINTS_SIGNUP = ['Manage rooms, members and payments', 'Track daily attendance', 'Get reminders and reports', 'Works for every business type'];

// Sign in (mode "login") or create an account and its business in one go (mode "signup")
export default function Login({ mode = 'login', onLogin }) {
  const { theme, toggleTheme } = useTheme();
  const signup = mode === 'signup';
  const [params] = useSearchParams();
  const startType = TYPES.some((t) => t.key === params.get('type')) ? params.get('type') : 'hostel';
  const [form, setForm] = useState({ name: '', phone: '', password: '', business: '', type: startType });
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const phone = form.phone.replace(/\D/g, '').slice(-10);
      const { token } = await api(`/auth/${signup ? 'register' : 'login'}`, {
        method: 'POST',
        body: signup ? { name: form.name.trim(), phone, password: form.password } : { phone, password: form.password },
      });
      if (signup) {
        // the business comes with the account; if this step fails they can still create it after signing in
        localStorage.setItem('token', token);
        try {
          const biz = await api('/businesses', { method: 'POST', body: { name: form.business.trim(), type: form.type } });
          if (biz?._id) localStorage.setItem('bizId', biz._id);
        } catch { /* the app asks for the business next */ }
      }
      onLogin(token);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth2">
      <header className="auth2-top">
        <Link to="/" aria-label="LocalSaaS home"><Logo /></Link>
        <div className="auth2-top-right">
          <span className="auth2-switch">
            {signup ? 'Already have an account?' : 'New to LocalSaaS?'}{' '}
            <Link to={signup ? '/login' : '/signup'}>{signup ? 'Log in' : 'Sign up'}</Link>
          </span>
          <button type="button" className="theme-toggle-btn" onClick={toggleTheme} aria-label="Toggle theme"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
            {theme === 'dark' ? <SunIcon size={16} /> : <MoonIcon size={16} />}
          </button>
        </div>
      </header>

      <div className="auth2-body">
        {/* left: the pitch */}
        <aside className="auth2-pitch">
          <HeroArt className="auth2-art" />
          <span className="brand-chip">{signup ? 'Start in minutes' : 'All-in-one management'}</span>
          <h1 className="auth2-headline">
            {signup ? <>Create your <em>account</em></> : <>A calmer way to run your <em>business.</em></>}
          </h1>
          <p className="auth2-lead">
            {signup
              ? 'Set up your business and start managing everything in one place.'
              : 'Manage rooms, members, payments and daily operations for PGs, hostels, tuition centres, gyms and mess — all in one simple platform.'}
          </p>
          <ul className={signup ? 'auth2-checks' : 'auth2-points'}>
            {(signup ? POINTS_SIGNUP : POINTS_LOGIN).map((p) => (
              <li key={p}><span aria-hidden="true"><CheckIcon size={14} /></span>{p}</li>
            ))}
          </ul>
        </aside>

        {/* right: the form */}
        <motion.form
          className="auth2-card"
          onSubmit={submit}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
          <h2 className="auth2-title">{signup ? 'Create your account' : 'Welcome back'}</h2>
          <p className="auth2-sub">{signup ? 'Tell us a few details to get started.' : 'Sign in to manage your business'}</p>

          {signup && (
            <fieldset className="auth2-types">
              <legend>Business type</legend>
              <div className="type-tiles">
                {TYPES.map((t) => {
                  const Art = TYPE_ART[t.key];
                  const on = form.type === t.key;
                  return (
                    <label key={t.key} className={`type-tile${on ? ' on' : ''}`}>
                      <input type="radio" name="type" value={t.key} checked={on} onChange={set('type')} />
                      <span className="type-tile-check" aria-hidden="true">{on && <CheckIcon size={12} />}</span>
                      <Art />
                      <b>{t.title}</b>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}

          {signup && (
            <label className="auth2-field">
              <span>Full name</span>
              <span className="auth2-input"><UserIcon size={17} />
                <input autoComplete="name" placeholder="Enter your full name" required value={form.name} onChange={set('name')} />
              </span>
            </label>
          )}

          <label className="auth2-field">
            <span>Mobile number</span>
            <span className="auth2-input">
              {signup ? <span className="auth2-cc">+91</span> : <PhoneIcon size={17} />}
              <input type="tel" inputMode="numeric" autoComplete="tel" placeholder="10-digit mobile number" required
                pattern="[0-9 +\-]{10,14}" title="10-digit mobile number" value={form.phone} onChange={set('phone')} />
            </span>
          </label>

          {signup && (
            <label className="auth2-field">
              <span>Business name</span>
              <span className="auth2-input"><BuildingIcon size={17} />
                <input placeholder="e.g. Green Nest PG" required maxLength={60} value={form.business} onChange={set('business')} />
              </span>
            </label>
          )}

          <label className="auth2-field">
            <span>Password</span>
            <span className="auth2-input"><ShieldIcon size={17} />
              <input type={show ? 'text' : 'password'} autoComplete={signup ? 'new-password' : 'current-password'}
                placeholder={signup ? 'Create a password' : 'Enter your password'} required minLength={signup ? 6 : undefined}
                value={form.password} onChange={set('password')} />
              <button type="button" className="auth2-eye" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>
                {show ? <EyeOffIcon size={17} /> : <EyeIcon size={17} />}
              </button>
            </span>
          </label>

          {error && <p className="auth2-error" role="alert">{error}</p>}

          <button type="submit" className="auth2-submit" disabled={busy}>
            {busy ? 'Please wait…' : signup ? 'Sign up' : 'Log in'}
          </button>

          <p className="auth2-alt">
            {signup ? 'Already have an account?' : 'New to LocalSaaS?'}{' '}
            <Link to={signup ? '/login' : '/signup'}>{signup ? 'Log in' : 'Sign up'}</Link>
          </p>
        </motion.form>
      </div>
    </div>
  );
}
