import { useState, useEffect, createContext, useContext, lazy, Suspense } from 'react';
import { Routes, Route, NavLink, Link, Navigate, useLocation } from 'react-router-dom';
import { useQuery, useIsFetching, useIsMutating } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { api, userId } from './api.js';
import DownloadConfirm from './DownloadConfirm.jsx';
import { ConfirmHost } from './confirm.jsx';
import { words } from './wording.js';
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
  CalendarCheckIcon,
  UserPlusIcon,
  DoorIcon,
  ShieldIcon,
  TagIcon,
  BIZ_TYPES,
  CheckIcon,
  Loader,
} from './ui.jsx';
import Login from './pages/Login.jsx';
import { Logo, TYPES, TYPE_ART } from './brand.jsx';
const Landing = lazy(() => import('./pages/Landing.jsx'));
// pages load on demand so a member opening a statement link doesn't download the whole dashboard
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Members = lazy(() => import('./pages/Members.jsx'));
const MemberDetail = lazy(() => import('./pages/MemberDetail.jsx'));
const Reports = lazy(() => import('./pages/Reports.jsx'));
const Setup = lazy(() => import('./pages/Setup.jsx'));
const Sales = lazy(() => import('./pages/Sales.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));
const Statement = lazy(() => import('./pages/Statement.jsx'));
const Attendance = lazy(() => import('./pages/Attendance.jsx'));
const Enquiries = lazy(() => import('./pages/Enquiries.jsx'));
const Rooms = lazy(() => import('./pages/Rooms.jsx'));
const CheckIn = lazy(() => import('./pages/CheckIn.jsx'));
const AdminPanel = lazy(() => import('./pages/Admin.jsx'));

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

  // member statement links and the gym check-in page are public: no login, whatever the session
  const { pathname } = useLocation();
  if (pathname.startsWith('/s/') || pathname.startsWith('/c/')) {
    return (
      <Suspense fallback={<Loader page />}>
        <Routes>
          <Route path="/s/:token" element={<Statement />} />
          <Route path="/c/:token" element={<CheckIn />} />
        </Routes>
      </Suspense>
    );
  }

  // signed out: the landing page, then log in or sign up
  if (!token) {
    const onLogin = (t) => { localStorage.setItem('token', t); setToken(t); };
    return (
      <ThemeContext.Provider value={{ theme, toggleTheme }}>
        <Suspense fallback={<Loader page />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login mode="login" onLogin={onLogin} />} />
            <Route path="/signup" element={<Login key="signup" mode="signup" onLogin={onLogin} />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <Shell onLogout={() => { localStorage.clear(); setToken(null); }} />
      <ConfirmHost />
    </ThemeContext.Provider>
  );
}

function Shell({ onLogout }) {
  const location = useLocation();
  // phones: the sidebar opens as a slide-in menu
  const [navOpen, setNavOpen] = useState(false);
  useEffect(() => { setNavOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!navOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setNavOpen(false); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [navOpen]);
  const { theme, toggleTheme } = useTheme();
  const { data: businesses, refetch } = useQuery({ queryKey: ['businesses'], queryFn: () => api('/businesses') });
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: () => api('/me'), staleTime: 5 * 60000 });

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
    enabled: !!currentBizId && biz?.status !== 'suspended',
  });

  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);

  // platform admin area: its own screen; only admins get in
  if (location.pathname.startsWith('/admin')) {
    if (!me) return <Loader page />;
    if (me.role !== 'admin') return <Navigate to="/" replace />;
    return (
      <Suspense fallback={<Loader page />}>
        <AdminPanel me={me} onLogout={onLogout} hasBusiness={!!businesses?.length} />
      </Suspense>
    );
  }

  if (!businesses) return <Loader page label="Opening your workspace" />;
  if (!businesses.length) return me?.role === 'admin' ? <Navigate to="/admin" replace /> : <CreateBusiness onCreated={refetch} />;
  const activeCount = (membersList || []).filter((m) => m.status === 'active').length;

  const typeConfig = BIZ_TYPES[biz.type] || BIZ_TYPES.gym;
  const attendanceOn = biz.attendanceEnabled !== false;
  const isHostel = biz.type === 'hostel';
  const TypeIcon = typeConfig.icon;
  // sidebar business card: initials, then "Gym · 24 members"
  const bizInitials = (biz.name || '?').trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const bizKind = { gym: 'Gym', hostel: 'Hostel', mess: 'Mess', tuition: 'Tuition' }[biz.type] || 'Business';
  const memberWord = words(biz.type).member === 'member' ? 'Members' : words(biz.type).member[0].toUpperCase() + words(biz.type).member.slice(1) + 's';

  const getPageTitle = (path) => {
    if (path === '/') return 'Dashboard';
    if (path.startsWith('/members/')) return 'Member Profile';
    if (path.startsWith('/members')) return 'Members Directory';
    if (path.startsWith('/reports')) return 'Money';
    if (path.startsWith('/setup')) return 'Setup';
    if (path.startsWith('/sales')) return 'Sales';
    if (path.startsWith('/settings')) return 'Settings';
    if (path.startsWith('/attendance')) return 'Attendance';
    if (path.startsWith('/enquiries')) return 'Enquiries';
    if (path.startsWith('/rooms')) return 'Rooms';
    return 'Dashboard';
  };

  return (
    <BizContext.Provider value={biz}>
      <DownloadConfirm />
      <TopProgress />
      <div className="app-layout">
        {/* Desktop Dark Sidebar (#0F172A) */}
        {navOpen && <div className="nav-scrim" aria-hidden="true" onClick={() => setNavOpen(false)} />}
        <aside id="app-menu" className={`app-sidebar${navOpen ? ' open' : ''}`} aria-label="Menu">
          {/* Logo Brand Header */}
          <div className="sidebar-logo">
            <Logo size={26} />
            <button type="button" className="logout-btn sidebar-close" style={{ marginLeft: 'auto' }} aria-label="Close menu" onClick={() => setNavOpen(false)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>
          <div className="sidebar-header">
            <div className="business-card-switch">
              <span className="business-icon-badge" aria-hidden="true">{bizInitials}</span>
              <div className="business-meta">
                <div className="business-title">{biz.name}</div>
                <div className="business-type-tag">{bizKind} · {activeCount} {words(biz.type).member}{activeCount === 1 ? '' : 's'}</div>
              </div>
              {businesses.length > 1 && (
                <svg className="business-switch-chevrons" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m7 15 5 5 5-5M7 9l5-5 5 5" /></svg>
              )}
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

          <nav className="sidebar-nav" aria-label="Main">
            <NavLink to="/" end className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
              <HomeIcon size={18} />
              <span>Collect</span>
            </NavLink>
            <NavLink to="/members" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
              <UsersIcon size={18} />
              <span>{memberWord}</span>
            </NavLink>
            {isHostel && (
              <NavLink to="/rooms" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
                <DoorIcon size={18} />
                <span>Rooms</span>
              </NavLink>
            )}
            {attendanceOn && (
              <NavLink to="/attendance" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
                <CalendarCheckIcon size={18} />
                <span>Attendance</span>
              </NavLink>
            )}
            <NavLink to="/enquiries" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
              <UserPlusIcon size={18} />
              <span>Enquiries</span>
            </NavLink>
            <NavLink to="/reports" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
              <BarChartIcon size={18} />
              <span>Money</span>
            </NavLink>
            <NavLink to="/setup" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
              <SlidersHorizontalIcon size={18} />
              <span>Setup</span>
              {businesses.length > 1 && <span className="sidebar-count" title={`${businesses.length} outlets`}>{businesses.length}</span>}
            </NavLink>
            {biz.salesEnabled !== false && (
              <NavLink to="/sales" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
                <TagIcon size={18} />
                <span>Sales</span>
              </NavLink>
            )}
            <NavLink to="/settings" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
              <SettingsIcon size={18} />
              <span>Settings</span>
            </NavLink>
            {me?.role === 'admin' && (
              <NavLink to="/admin" className="sidebar-link">
                <ShieldIcon size={18} />
                <span>Platform admin</span>
              </NavLink>
            )}
          </nav>

          {/* Bottom Footer: Account / Theme / Logout */}
          <div className="sidebar-footer">
            <Link to="/settings?tab=profile" className="user-badge" title="Your profile">
              <div className="user-avatar">
                <UserIcon size={17} />
              </div>
              <div className="user-meta" style={{ minWidth: 0 }}>
                <div className="user-name">{me?.name || 'Your profile'}</div>
                <div className="user-sub">{me?.phone ? `+91 ${me.phone}` : 'Account'}</div>
              </div>
            </Link>
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
            <button type="button" className="menu-btn" aria-label="Open menu" aria-controls="app-menu" aria-expanded={navOpen} onClick={() => setNavOpen(true)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <Link to="/setup?tab=outlets" className="brand brand-link" title="Your outlets" style={{ position: 'relative', minWidth: 0, flex: '1 1 auto' }}>
              <span className="brand-mark">
                <TypeIcon size={18} />
              </span>
              <div className="brand-info" style={{ minWidth: 0 }}>
                <span className="brand-name">{biz.name}</span>
                <span className="brand-sep">/</span>
                <span className="brand-badge">{getPageTitle(location.pathname)}</span>
              </div>
              <ChevronDownIcon size={14} className="brand-chev" aria-hidden="true" />
            </Link>

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
            {biz.status === 'suspended' ? <PausedBusiness biz={biz} me={me} others={businesses.length > 1} /> : (
            <Suspense fallback={<div className="card skeleton" style={{ minHeight: 220 }} aria-hidden="true" />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/members" element={<Members />} />
              <Route path="/members/:id" element={<MemberDetail />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/setup" element={<Setup />} />
              <Route path="/sales" element={<Sales />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/attendance" element={<Attendance />} />
              <Route path="/enquiries" element={<Enquiries />} />
              <Route path="/outlets" element={<Navigate to="/setup?tab=outlets" replace />} />
              <Route path="/staff" element={<Navigate to="/setup?tab=staff" replace />} />
              <Route path="/rooms" element={isHostel ? <Rooms /> : <Navigate to="/" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </Suspense>
            )}
          </main>
        </div>

        {/* Mobile Safe-Area Bottom Bar */}
      </div>
    </BizContext.Provider>
  );
}

// A business the platform admin has paused: why, since when, and who to contact. Data is kept.
function PausedBusiness({ biz, me, others }) {
  const since = biz.suspendedAt && new Date(biz.suspendedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const support = me?.supportPhone;
  return (
    <div className="analytics-card paused-biz" role="alert">
      <span className="paused-biz-icon"><PauseCircle /></span>
      <h1>Service paused</h1>
      <p className="paused-biz-name">{biz.name}{since ? ` · since ${since}` : ''}</p>
      {biz.suspendedReason && <p className="paused-biz-reason">“{biz.suspendedReason}”</p>}
      <p className="muted">Your members, payments and history are safe. Everything comes back as soon as the service is resumed.</p>
      {support && (
        <div className="row" style={{ gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a className="btn" target="_blank" rel="noreferrer"
            href={`https://wa.me/${support.replace(/\D/g, '').replace(/^(\d{10})$/, '91$1')}?text=${encodeURIComponent(`Hi, my business ${biz.name} is paused. Please help me resume it.`)}`}>
            Contact support on WhatsApp
          </a>
          <a className="btn btn-secondary" href={`tel:${support}`}>Call {support}</a>
        </div>
      )}
      {others && <p className="muted small">Your other businesses still work: switch from the menu.</p>}
    </div>
  );
}

const PauseCircle = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" /><line x1="10" y1="15" x2="10" y2="9" /><line x1="14" y1="15" x2="14" y2="9" />
  </svg>
);

// A thin purple bar along the top while anything loads or saves in the background.
// Shown only after a short wait, so quick requests don't make it flicker.
function TopProgress() {
  const busy = useIsFetching() + useIsMutating() > 0;
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!busy) { setShow(false); return undefined; }
    const t = setTimeout(() => setShow(true), 250);
    return () => clearTimeout(t);
  }, [busy]);
  return <div className={`top-progress${show ? ' on' : ''}`} role="progressbar" aria-hidden={!show} aria-label="Loading" />;
}

function CreateBusiness({ onCreated }) {
  const [form, setForm] = useState({ name: '', type: 'hostel', upiId: '' });
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
    <div className="auth2">
      <header className="auth2-top"><Logo /></header>
      <div className="auth2-body single">
        <form className="auth2-card" onSubmit={submit}>
          <h2 className="auth2-title">Set up your business</h2>
          <p className="auth2-sub">Choose what you run. You can add more businesses later.</p>

          <fieldset className="auth2-types">
            <legend>Business type</legend>
            <div className="type-tiles">
              {TYPES.map((t) => {
                const Art = TYPE_ART[t.key];
                const on = form.type === t.key;
                return (
                  <label key={t.key} className={`type-tile${on ? ' on' : ''}`}>
                    <input type="radio" name="type" value={t.key} checked={on} onChange={() => setForm({ ...form, type: t.key })} />
                    <span className="type-tile-check" aria-hidden="true">{on && <CheckIcon size={12} />}</span>
                    <Art />
                    <b>{t.title}</b>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <label className="auth2-field">
            <span>Business name</span>
            <span className="auth2-input"><BuildingIcon size={17} />
              <input placeholder="e.g. Green Nest PG" required maxLength={60} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </span>
          </label>
          <label className="auth2-field">
            <span>UPI ID <small>(optional, for WhatsApp payment links)</small></span>
            <span className="auth2-input"><RupeeIcon size={17} />
              <input placeholder="e.g. payments@ybl" value={form.upiId} onChange={(e) => setForm({ ...form, upiId: e.target.value })} />
            </span>
          </label>

          {error && <p className="auth2-error" role="alert">{error}</p>}
          <button type="submit" className="auth2-submit" disabled={busy}>{busy ? 'Creating…' : 'Create & get started'}</button>
        </form>
      </div>
    </div>
  );
}
