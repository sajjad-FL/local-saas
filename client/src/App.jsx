import { useState, useEffect, createContext, useContext } from 'react';
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { api, userId } from './api.js';
import {
  HomeIcon,
  UsersIcon,
  SettingsIcon,
  LogOutIcon,
  RupeeIcon,
  ChevronDownIcon,
  Field,
  UserIcon,
  SunIcon,
  MoonIcon,
  BuildingIcon,
  BarChartIcon,
  LayoutDashboardIcon,
  SlidersHorizontalIcon,
  BIZ_TYPES,
} from './ui.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Members from './pages/Members.jsx';
import MemberDetail from './pages/MemberDetail.jsx';
import Reports from './pages/Reports.jsx';
import Setup from './pages/Setup.jsx';
import Settings from './pages/Settings.jsx';

const BizContext = createContext(null);
export const useBiz = () => useContext(BizContext);

const ThemeContext = createContext(null);
export const useTheme = () => useContext(ThemeContext);

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  if (!token) {
    return (
      <ThemeContext.Provider value={{ theme, toggleTheme }}>
        <Login onLogin={(t) => { localStorage.setItem('token', t); setToken(t); }} />
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <Shell onLogout={() => { localStorage.clear(); setToken(null); }} />
    </ThemeContext.Provider>
  );
}

function Shell({ onLogout }) {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { data: businesses, refetch } = useQuery({ queryKey: ['businesses'], queryFn: () => api('/businesses') });

  const biz = businesses?.find((b) => b._id === localStorage.getItem('bizId')) || businesses?.[0];
  const currentBizId = biz?._id;

  useEffect(() => {
    if (biz?._id && localStorage.getItem('bizId') !== biz._id) {
      localStorage.setItem('bizId', biz._id);
    }
  }, [biz?._id]);

  const { data: membersList } = useQuery({
    queryKey: ['members', currentBizId],
    queryFn: () => api(`/businesses/${currentBizId}/members`),
    enabled: !!currentBizId,
  });

  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);

  if (!businesses) return <p className="center">Loading workspace…</p>;
  if (!businesses.length) return <CreateBusiness onCreated={refetch} />;
  const activeCount = (membersList || []).filter((m) => m.status === 'active').length;

  const typeConfig = BIZ_TYPES[biz.type] || BIZ_TYPES.gym;
  const TypeIcon = typeConfig.icon;

  const getPageTitle = (path) => {
    if (path === '/') return 'Dashboard';
    if (path.startsWith('/members/')) return 'Member Profile';
    if (path.startsWith('/members')) return 'Members Directory';
    if (path.startsWith('/reports')) return 'Reports & Analytics';
    if (path.startsWith('/setup')) return 'Setup & Plans';
    if (path.startsWith('/settings')) return 'Settings';
    return 'Dashboard';
  };

  return (
    <BizContext.Provider value={biz}>
      <div className="app-layout">
        {/* Desktop Dark Sidebar (#0F172A) */}
        <aside className="app-sidebar">
          {/* Logo Brand Header */}
          <div className="sidebar-header">
            <div className="business-card-switch">
              <span className="business-icon-badge" style={{ background: `linear-gradient(135deg, ${typeConfig.gradient[0]}, ${typeConfig.gradient[1]})` }}>
                <TypeIcon size={20} />
              </span>
              <div className="business-meta">
                <div className="business-title">{biz.name}</div>
                <div className="business-type-tag">
                  <span>{typeConfig.badge}</span>
                  {businesses.length > 1 && <ChevronDownIcon size={12} />}
                </div>
              </div>
              {businesses.length > 1 && (
                <select
                  className="business-select-native"
                  aria-label="Switch business"
                  value={biz._id}
                  onChange={(e) => {
                    localStorage.setItem('bizId', e.target.value);
                    window.location.assign('/');
                  }}>
                  {businesses.map((b) => (
                    <option key={b._id} value={b._id}>{b.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Group 1: MAIN MENU */}
          <div className="sidebar-nav-label">MAIN MENU</div>
          <nav className="sidebar-nav">
            <NavLink to="/" end className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
              <LayoutDashboardIcon size={18} />
              <span>Dashboard</span>
            </NavLink>
            <NavLink to="/members" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
              <UsersIcon size={18} />
              <span style={{ flex: 1 }}>Members</span>
              {activeCount > 0 && <span className="sidebar-count-badge">{activeCount}</span>}
            </NavLink>
            <NavLink to="/reports" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
              <BarChartIcon size={18} />
              <span>Reports</span>
            </NavLink>
          </nav>

          {/* Group 2: CONFIG */}
          <div className="sidebar-nav-label" style={{ marginTop: 18 }}>CONFIG</div>
          <nav className="sidebar-nav">
            <NavLink to="/setup" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
              <SlidersHorizontalIcon size={18} />
              <span>Setup & Plans</span>
            </NavLink>
            <NavLink to="/settings" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
              <SettingsIcon size={18} />
              <span>Settings</span>
            </NavLink>
          </nav>

          {/* Bottom Footer: Account / Theme / Logout */}
          <div className="sidebar-footer">
            <div className="user-badge">
              <div className="user-avatar">
                <UserIcon size={17} />
              </div>
              <div className="user-meta" style={{ minWidth: 0 }}>
                <div className="user-name">Account</div>
                <div className="user-sub">Active Session</div>
              </div>
            </div>
            <div className="row" style={{ gap: 6 }}>
              <button
                type="button"
                className="logout-btn"
                onClick={toggleTheme}
                title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                aria-label="Toggle theme">
                {theme === 'dark' ? <SunIcon size={16} /> : <MoonIcon size={16} />}
              </button>
              <button className="logout-btn" onClick={onLogout} title="Sign Out" aria-label="Sign Out">
                <LogOutIcon size={16} />
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="main-wrapper">
          <header className="topbar">
            <div className="brand" style={{ position: 'relative', minWidth: 0, flex: '1 1 auto' }}>
              <span className="brand-mark" style={{ background: `linear-gradient(135deg, ${typeConfig.gradient[0]}, ${typeConfig.gradient[1]})` }}>
                <TypeIcon size={18} />
              </span>
              <div className="brand-info" style={{ minWidth: 0 }}>
                <span className="brand-name">{biz.name}</span>
                <span className="brand-sep">/</span>
                <span className="brand-badge">{getPageTitle(location.pathname)}</span>
              </div>
            </div>

            <div className="topbar-actions">
              <button
                type="button"
                className="theme-toggle-btn"
                onClick={toggleTheme}
                title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                aria-label="Toggle theme">
                {theme === 'dark' ? <SunIcon size={16} /> : <MoonIcon size={16} />}
              </button>

              <button
                type="button"
                className="icon-btn logout-btn-mobile"
                onClick={onLogout}
                title="Sign Out"
                aria-label="Sign Out">
                <LogOutIcon size={16} />
              </button>
            </div>
          </header>

          <main>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/members" element={<Members />} />
              <Route path="/members/:id" element={<MemberDetail />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/setup" element={<Setup />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>

        {/* Mobile Safe-Area Bottom Bar */}
        <nav className="tabs" aria-label="Mobile Navigation">
          <NavLink to="/" end className={({ isActive }) => `tab-link${isActive ? ' active' : ''}`}>
            {({ isActive }) => (
              <>
                <LayoutDashboardIcon size={20} />
                <span>Dashboard</span>
                {isActive && <motion.div layoutId="tab-pill" className="tab-pill" />}
              </>
            )}
          </NavLink>
          <NavLink to="/members" className={({ isActive }) => `tab-link${isActive ? ' active' : ''}`}>
            {({ isActive }) => (
              <>
                <UsersIcon size={20} />
                <span>Members</span>
                {isActive && <motion.div layoutId="tab-pill" className="tab-pill" />}
              </>
            )}
          </NavLink>
          <NavLink to="/reports" className={({ isActive }) => `tab-link${isActive ? ' active' : ''}`}>
            {({ isActive }) => (
              <>
                <BarChartIcon size={20} />
                <span>Reports</span>
                {isActive && <motion.div layoutId="tab-pill" className="tab-pill" />}
              </>
            )}
          </NavLink>
          <NavLink to="/setup" className={({ isActive }) => `tab-link${isActive ? ' active' : ''}`}>
            {({ isActive }) => (
              <>
                <SlidersHorizontalIcon size={20} />
                <span>Setup</span>
                {isActive && <motion.div layoutId="tab-pill" className="tab-pill" />}
              </>
            )}
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => `tab-link${isActive ? ' active' : ''}`}>
            {({ isActive }) => (
              <>
                <SettingsIcon size={20} />
                <span>Settings</span>
                {isActive && <motion.div layoutId="tab-pill" className="tab-pill" />}
              </>
            )}
          </NavLink>
        </nav>
      </div>
    </BizContext.Provider>
  );
}

function CreateBusiness({ onCreated }) {
  const [form, setForm] = useState({ name: '', type: 'gym', upiId: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const b = await api('/businesses', { method: 'POST', body: form });
      localStorage.setItem('bizId', b._id);
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 460 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 2 }}>Create Your Business Workspace</h1>
        <p className="muted small" style={{ marginBottom: 14 }}>Select your business category to configure your workspace.</p>

        {error && <p className="small red-text" style={{ marginBottom: 8 }}>{error}</p>}

        <form onSubmit={submit}>
          <Field label="Business / Workspace Name *" icon={BuildingIcon}>
            <input
              placeholder="e.g. Vivek Gym"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>

          <label className="input-label" style={{ marginTop: 12, display: 'block' }}>Business Category</label>
          <div className="type-grid" style={{ marginTop: 6, marginBottom: 12 }}>
            {Object.entries(BIZ_TYPES).map(([k, meta]) => {
              const Icon = meta.icon;
              const sel = form.type === k;
              return (
                <button
                  type="button"
                  key={k}
                  className={`type-card${sel ? ' selected' : ''}`}
                  onClick={() => setForm({ ...form, type: k })}>
                  <div className="type-icon" style={{ background: meta.soft, color: meta.accent }}>
                    <Icon size={20} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 12.5 }}>{meta.label}</div>
                    <div className="muted small" style={{ fontSize: 10.5 }}>{meta.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>

          <Field label="UPI VPA ID (Optional)" icon={RupeeIcon} hint="For WhatsApp payment links">
            <input
              placeholder="e.g. payments@ybl"
              value={form.upiId}
              onChange={(e) => setForm({ ...form, upiId: e.target.value })}
            />
          </Field>

          <div style={{ marginTop: 16 }}>
            <button
              disabled={busy}
              className="btn"
              style={{ width: '100%', minHeight: 38, justifyContent: 'center', background: 'var(--green)' }}>
              {busy ? 'Creating Workspace…' : 'Create & Get Started'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
