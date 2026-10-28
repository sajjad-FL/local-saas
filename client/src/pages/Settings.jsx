import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { api, userId, download } from '../api.js';
import { useBiz } from '../App.jsx';
import {
  Avatar, Field, ShieldIcon, UserIcon, UsersIcon, PhoneIcon,
  PlusIcon, DownloadIcon, CheckCircleIcon, SettingsIcon,
  CheckIcon, BuildingIcon, FileSpreadsheetIcon, SparklesIcon,
  ConfirmDialog, BIZ_TYPES, BellIcon, AlertCircleIcon, CopyIcon,
  XIcon, TrashIcon, LogOutIcon, SlidersHorizontalIcon, ChevronIcon, CalendarCheckIcon, EditIcon,
} from '../ui.jsx';

// Settings in four tabs, one topic each, in a single readable column
const TABS = [
  { key: 'profile', label: 'Profile', icon: UserIcon, intro: 'Your name, phone number and password.' },
  { key: 'payments', label: 'Payments', icon: ShieldIcon, intro: 'How members pay you, and how they are reminded.' },
  { key: 'team', label: 'Team', icon: UsersIcon, intro: 'People who can help you run the business.', ownerOnly: true },
  { key: 'business', label: 'Business', icon: BuildingIcon, intro: 'Your business details and the features you use.' },
  { key: 'data', label: 'Backup', icon: DownloadIcon, intro: 'Download your data for accounting or safekeeping.' },
];

export default function Settings() {
  const biz = useBiz();
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: () => api('/me'), staleTime: 5 * 60000 });
  const isOwner = biz.ownerId === userId();
  const typeConfig = BIZ_TYPES[biz.type] || BIZ_TYPES.gym;
  const [searchParams, setSearchParams] = useSearchParams();
  const tabs = TABS.filter((t) => !t.ownerOnly || isOwner);
  const tab = tabs.find((t) => t.key === searchParams.get('tab')) || tabs[0];
  const openTab = (key) => setSearchParams((p) => { p.set('tab', key); return p; }, { replace: true });

  return (
    <>
      <div className="page-header" style={{ marginBottom: 14 }}>
        <div className="page-title-wrap">
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">{tab.intro}</p>
        </div>
      </div>

      {/* shortcuts */}
      <div className="settings-shortcuts">
        <Link to="/setup" className="settings-shortcut">
          <SlidersHorizontalIcon size={16} />
          <span><b>Plans, batches & rooms</b><small>Fees, cycles, groups, rooms</small></span>
          <ChevronIcon size={14} />
        </Link>
        {me?.role === 'admin' && (
          <Link to="/admin" className="settings-shortcut admin">
            <ShieldIcon size={16} />
            <span><b>Platform admin</b><small>All businesses and owners</small></span>
            <ChevronIcon size={14} />
          </Link>
        )}
      </div>

      <div className="settings-tabs" role="tablist" aria-label="Settings">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.key} type="button" role="tab" aria-selected={tab.key === t.key}
              className={tab.key === t.key ? 'active' : ''} onClick={() => openTab(t.key)}>
              <Icon size={15} /> {t.label}
            </button>
          );
        })}
      </div>

      <div className="settings-body">
        {tab.key === 'profile' && <ProfileSettings me={me} />}

        {tab.key === 'payments' && (
          <>
            {isOwner ? <UpiGatewaySettings /> : (
              <p className="settings-note">Only the owner can change the UPI ID.</p>
            )}
            <NotificationPreferencesSettings />
          </>
        )}

        {tab.key === 'team' && isOwner && <StaffAccountsSettings />}

        {tab.key === 'business' && (
          <>
            <div className="analytics-card">
              <div className="card-header-row" style={{ marginBottom: 12 }}>
                <div>
                  <h3 className="analytics-card-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <BuildingIcon size={17} style={{ color: 'var(--primary)' }} />
                    Business profile
                  </h3>
                  <span className="analytics-card-subtitle">The business this account manages</span>
                </div>
              </div>
              <div className="profile-meta-grid settings-profile">
                <div className="meta-item">
                  <div className="meta-label">Name</div>
                  <div className="meta-value">{isOwner ? <BusinessName biz={biz} /> : biz.name}</div>
                </div>
                <div className="meta-item">
                  <div className="meta-label">Type</div>
                  <div className="meta-value">{typeConfig.label}</div>
                </div>
                <div className="meta-item">
                  <div className="meta-label">Your role</div>
                  <div className="meta-value"><span className="badge primary">{isOwner ? 'Owner' : 'Staff member'}</span></div>
                </div>
                <div className="meta-item">
                  <div className="meta-label">Workspace ID</div>
                  <div className="meta-value" style={{ fontFamily: 'monospace', fontSize: 11 }}>{biz._id}</div>
                </div>
              </div>
            </div>
            <AttendanceSettings />
            {isOwner && <DangerZoneSettings />}
          </>
        )}

        {tab.key === 'data' && (
          <div className="analytics-card">
            <div className="card-header-row" style={{ marginBottom: 12 }}>
              <div>
                <h3 className="analytics-card-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <DownloadIcon size={17} style={{ color: 'var(--primary)' }} />
                  Data backup & export
                </h3>
                <span className="analytics-card-subtitle">Spreadsheets open in Excel or Google Sheets</span>
              </div>
            </div>
            <div className="settings-downloads">
              <button type="button" className="btn-secondary"
                onClick={() => download(`/businesses/${biz._id}/export/payments.csv`, `${biz.name}-payments-backup.csv`)}>
                <DownloadIcon size={15} />
                <span><b>Payments</b><small>Every payment received (CSV)</small></span>
              </button>
              <button type="button" className="btn-secondary"
                onClick={() => download(`/businesses/${biz._id}/export/balances.csv`, `${biz.name}-balances-backup.csv`)}>
                <FileSpreadsheetIcon size={15} />
                <span><b>Balances</b><small>What each member owes now (CSV)</small></span>
              </button>
              {isOwner && (
                <button type="button" className="btn-secondary"
                  onClick={() => download(`/businesses/${biz._id}/export/backup.json`, `${biz.name}-full-backup.json`)}>
                  <DownloadIcon size={15} />
                  <span><b>Full backup</b><small>Everything, to restore later (JSON)</small></span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* On phones the top bar has no sign-out button, so it lives here */}
      <button
        type="button"
        className="btn btn-secondary mobile-only"
        style={{ width: '100%', marginTop: 16, justifyContent: 'center' }}
        onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('bizId'); location.href = '/'; }}>
        <LogOutIcon size={15} /> Sign out
      </button>
    </>
  );
}

const initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';

// Profile: the signed-in person's own name, phone (how they sign in) and password
function ProfileSettings({ me }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(null); // null until "me" arrives
  const [currentPassword, setCurrentPassword] = useState('');
  const [saved, setSaved] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const values = form ?? { name: me?.name || '', phone: me?.phone || '' };
  const phoneChanged = me && values.phone !== me.phone;
  const changed = me && (values.name.trim() !== (me.name || '') || phoneChanged);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setError(''); setSaved('');
    try {
      const body = { name: values.name };
      if (phoneChanged) Object.assign(body, { phone: values.phone, currentPassword });
      const updated = await api('/me', { method: 'PATCH', body });
      qc.setQueryData(['me'], (old) => ({ ...old, ...updated }));
      setForm(null); setCurrentPassword('');
      setSaved(phoneChanged ? 'Saved. Sign in with your new number from now on.' : 'Saved.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="analytics-card">
        <div className="profile-hero">
          <span className="profile-hero-avatar" aria-hidden="true">{initials(values.name)}</span>
          <div>
            <b>{me?.name || 'Your profile'}</b>
            <span className="muted small">+91 {me?.phone}{me?.role === 'admin' ? ' · platform admin' : ''}</span>
          </div>
        </div>
        <form className="expense-form" onSubmit={save}>
          <div className="profile-fields">
            <Field label="Your name" icon={UserIcon}>
              <input value={values.name} maxLength={60} required autoComplete="name"
                onChange={(e) => { setForm({ ...values, name: e.target.value }); setSaved(''); }} />
            </Field>
            <Field label="Mobile number (you sign in with this)" icon={PhoneIcon}>
              <input type="tel" inputMode="numeric" value={values.phone} autoComplete="tel"
                onChange={(e) => { setForm({ ...values, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }); setSaved(''); }} />
            </Field>
          </div>
          {phoneChanged && (
            <Field label="Current password (needed to change your number)" icon={ShieldIcon}>
              <input type="password" value={currentPassword} autoComplete="current-password" required
                onChange={(e) => setCurrentPassword(e.target.value)} />
            </Field>
          )}
          {error && <p className="error" role="alert" style={{ margin: 0 }}>{error}</p>}
          {saved && <p className="green-text small" role="status" style={{ margin: 0 }}><CheckIcon size={13} /> {saved}</p>}
          <div className="profile-actions">
            {changed && <button type="button" className="btn-secondary" onClick={() => { setForm(null); setCurrentPassword(''); setError(''); }}>Cancel</button>}
            <button type="submit" disabled={!changed || busy || !values.name.trim() || values.phone.length !== 10 || (phoneChanged && !currentPassword)}>
              <CheckIcon size={14} /> {busy ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
      <PasswordSettings />
    </>
  );
}

function PasswordSettings() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const mismatch = again && next !== again;
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(''); setDone(false);
    try {
      await api('/me/password', { method: 'POST', body: { currentPassword: current, newPassword: next } });
      setCurrent(''); setNext(''); setAgain(''); setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="analytics-card">
      <div className="card-header-row" style={{ marginBottom: 12 }}>
        <div>
          <h3 className="analytics-card-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <ShieldIcon size={17} style={{ color: 'var(--primary)' }} />
            Change password
          </h3>
          <span className="analytics-card-subtitle">At least 6 characters. You stay signed in on this device.</span>
        </div>
      </div>
      <form className="expense-form" onSubmit={submit}>
        <Field label="Current password">
          <input type="password" value={current} autoComplete="current-password" required onChange={(e) => setCurrent(e.target.value)} />
        </Field>
        <div className="profile-fields">
          <Field label="New password">
            <input type="password" value={next} autoComplete="new-password" minLength={6} required onChange={(e) => { setNext(e.target.value); setDone(false); }} />
          </Field>
          <Field label="New password again">
            <input type="password" value={again} autoComplete="new-password" required onChange={(e) => setAgain(e.target.value)} />
          </Field>
        </div>
        {mismatch && <p className="error small" style={{ margin: 0 }}>The two new passwords don't match.</p>}
        {error && <p className="error" role="alert" style={{ margin: 0 }}>{error}</p>}
        {done && <p className="green-text small" role="status" style={{ margin: 0 }}><CheckIcon size={13} /> Password changed.</p>}
        <div className="profile-actions">
          <button type="submit" disabled={busy || !current || next.length < 6 || next !== again}>
            <CheckIcon size={14} /> {busy ? 'Saving…' : 'Change password'}
          </button>
        </div>
      </form>
    </div>
  );
}

// the business's name, editable in place by the owner
function BusinessName({ biz }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');
  if (draft === null) {
    return (
      <span className="inline-edit">
        {biz.name}
        <button type="button" className="prop-edit" aria-label="Rename business" title="Rename" onClick={() => setDraft(biz.name)}><EditIcon size={13} /></button>
      </span>
    );
  }
  const save = async (e) => {
    e.preventDefault();
    try {
      await api(`/businesses/${biz._id}`, { method: 'PATCH', body: { name: draft.trim() } });
      await qc.invalidateQueries({ queryKey: ['businesses'] });
      setDraft(null);
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <form className="prop-rename" onSubmit={save}>
      <input autoFocus value={draft} maxLength={60} onChange={(e) => setDraft(e.target.value)} aria-label="Business name" />
      <button type="submit" disabled={!draft.trim()} aria-label="Save name"><CheckIcon size={14} /></button>
      <button type="button" className="btn-secondary" aria-label="Cancel" onClick={() => setDraft(null)}><XIcon size={13} /></button>
      {error && <span className="error small">{error}</span>}
    </form>
  );
}

// 1. UPI Payment Gateway Settings Component
function UpiGatewaySettings() {
  const biz = useBiz();
  const qc = useQueryClient();
  const [upiInput, setUpiInput] = useState(biz.upiId || '');
  const [isEditing, setIsEditing] = useState(!biz.upiId);
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const save = useMutation({
    mutationFn: (newUpi) => api(`/businesses/${biz._id}`, { method: 'PATCH', body: { upiId: newUpi } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['businesses'] });
      setIsEditing(false);
      setConfirmOpen(false);
    },
  });

  const validateUpi = (v) => {
    const trimmed = v.trim();
    if (!trimmed) return 'UPI ID is required';
    if (!trimmed.includes('@')) return 'UPI ID must contain "@" (e.g. yourname@okaxis)';
    if (/\s/.test(trimmed)) return 'UPI ID cannot contain spaces';
    if (trimmed.length < 5) return 'UPI ID must be at least 5 characters';
    return null;
  };

  const handlePreSave = (e) => {
    e.preventDefault();
    const err = validateUpi(upiInput);
    if (err) {
      setError(err);
      return;
    }
    setError('');
    setConfirmOpen(true);
  };

  const testUpiUrl = `upi://pay?pa=${encodeURIComponent(biz.upiId || '')}&pn=${encodeURIComponent(biz.name || '')}&am=1&cu=INR`;

  return (
    <div className="analytics-card">
      <div className="card-header-row" style={{ marginBottom: 12 }}>
        <div>
          <h3 className="analytics-card-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <ShieldIcon size={17} style={{ color: 'var(--primary)' }} />
            Your UPI ID for Payments
          </h3>
          <span className="analytics-card-subtitle">
            Reminders and statements include a 1-tap pay link to this UPI ID. Money goes straight to you.
          </span>
        </div>
      </div>

      {biz.upiId && !isEditing ? (
        <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: '12px 14px' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
              <span className="badge green" style={{ fontSize: 11 }}>
                <CheckIcon size={12} /> Active UPI
              </span>
              <span style={{ fontWeight: 600, fontSize: 13.5, fontFamily: 'monospace' }}>
                {biz.upiId}
              </span>
            </div>

            <div className="row" style={{ gap: 8 }}>
              <a
                href={testUpiUrl}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary"
                style={{ minHeight: 26, padding: '2px 8px', fontSize: 11 }}>
                Send ₹1 test
              </a>
              <button
                type="button"
                className="btn-secondary"
                style={{ minHeight: 26, padding: '2px 8px', fontSize: 11 }}
                onClick={() => setIsEditing(true)}>
                Change
              </button>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handlePreSave}>
          <div className="field">
            <label className="input-label">
              <ShieldIcon size={14} /> Business UPI VPA Address
            </label>
            <div className="form-input-action-row">
              <input
                placeholder="e.g. fitness@ybl"
                value={upiInput}
                onChange={(e) => {
                  setUpiInput(e.target.value);
                  if (error) setError('');
                }}
                style={{ fontFamily: 'monospace' }}
              />
              <button disabled={save.isPending}>
                <CheckIcon size={15} /> Save UPI ID
              </button>
            </div>
            {error ? (
              <span className="small red-text" style={{ marginTop: 2 }}>{error}</span>
            ) : (
              <span className="small muted">e.g. payments@okaxis or yourgym@ybl (must contain @, no spaces, min 5 chars)</span>
            )}
          </div>
        </form>
      )}

      {/* Confirmation Dialog for UPI Save */}
      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => save.mutate(upiInput.trim())}
        title="Confirm Payment UPI Address"
        message={`Save "${upiInput.trim()}" as your official payment UPI address? Member WhatsApp payment links will route payments directly to this account.`}
        confirmText="Yes, Save UPI ID"
        busy={save.isPending}
      />
    </div>
  );
}

// 2. Staff Accounts Settings Component
function StaffAccountsSettings() {
  const biz = useBiz();
  const qc = useQueryClient();
  const [phone, setPhone] = useState('');
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState(null);

  const { data: staff } = useQuery({
    queryKey: ['staff', biz._id],
    queryFn: () => api(`/businesses/${biz._id}/staff`),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['staff', biz._id] });

  const add = useMutation({
    mutationFn: () => api(`/businesses/${biz._id}/staff`, { method: 'POST', body: { phone: phone.replace(/\D/g, '') } }),
    onSuccess: () => { setPhone(''); invalidate(); },
  });

  const remove = useMutation({
    mutationFn: (uid) => api(`/businesses/${biz._id}/staff/${uid}`, { method: 'DELETE' }),
    onSuccess: () => { setRevokeTarget(null); invalidate(); },
  });

  const handleCopyInvite = () => {
    const inviteLink = `${window.location.origin}/login?inviteBiz=${encodeURIComponent(biz.name)}`;
    navigator.clipboard.writeText(inviteLink);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
  };

  return (
    <div className="analytics-card">
      <div className="card-header-row" style={{ marginBottom: 12 }}>
        <div>
          <h3 className="analytics-card-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <UserIcon size={17} style={{ color: 'var(--primary)' }} />
            Staff Accounts & Access Controls
          </h3>
          <span className="analytics-card-subtitle">
            Authorized staff can manage members and record dues, but cannot modify UPI ID or remove other staff.
          </span>
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }} style={{ marginBottom: 12 }}>
        <div className="field">
          <label className="input-label">
            <PhoneIcon size={14} /> Staff Mobile Number
          </label>
          <div className="form-input-action-row">
            <input
              type="tel"
              inputMode="numeric"
              placeholder="10-digit registered phone"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            />
            <button disabled={add.isPending || phone.length !== 10}>
              <PlusIcon size={15} /> {add.isPending ? 'Authorizing…' : 'Authorize Staff'}
            </button>
          </div>

          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 4, flexWrap: 'wrap', gap: 6 }}>
            <span className="small muted">
              Staff must have a {biz.name} account. Share the invite link to get them started.
            </span>
            <button
              type="button"
              className="btn-secondary"
              style={{ minHeight: 24, padding: '2px 8px', fontSize: 11 }}
              onClick={handleCopyInvite}>
              <CopyIcon size={12} /> {copiedInvite ? '✓ Copied invite link' : 'Copy invite link'}
            </button>
          </div>
        </div>
      </form>
      {add.error && <p className="small red-text" role="alert" style={{ marginBottom: 8 }}>{add.error.message}</p>}

      {(staff || []).map((s) => (
        <div className="card row" key={s._id} style={{ alignItems: 'center', margin: '6px 0', padding: '10px 12px', border: '1px solid var(--border)' }}>
          <Avatar name={s.name} />
          <div className="grow" style={{ minWidth: 0, marginLeft: 8 }}>
            <b style={{ fontSize: 13.5 }}>{s.name}</b>
            <div className="muted small">📞 +91 {s.phone}</div>
          </div>
          <button
            type="button"
            className="btn-secondary red-text"
            style={{ minHeight: 26, padding: '2px 8px', fontSize: 11 }}
            onClick={() => setRevokeTarget(s)}>
            Revoke Access
          </button>
        </div>
      ))}

      {staff && staff.length === 0 && (
        <p className="muted small" style={{ margin: '4px 2px' }}>No additional staff accounts authorized yet.</p>
      )}

      <ConfirmDialog
        isOpen={!!revokeTarget}
        onClose={() => setRevokeTarget(null)}
        onConfirm={() => revokeTarget && remove.mutate(revokeTarget._id)}
        title={`Revoke staff access for ${revokeTarget?.name}?`}
        message="This staff member will no longer be able to log in to view members or record payments for this business."
        confirmText="Revoke Access"
        danger
        busy={remove.isPending}
      />
    </div>
  );
}

// Attendance on/off. Off hides it everywhere and stops the gym's QR check-in; records are kept.
function AttendanceSettings() {
  const biz = useBiz();
  const qc = useQueryClient();
  const isOwner = biz.ownerId === userId();
  const [enabled, setEnabled] = useState(biz.attendanceEnabled !== false);
  const save = useMutation({
    mutationFn: (on) => api(`/businesses/${biz._id}`, { method: 'PATCH', body: { attendanceEnabled: on } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['businesses'] }),
    onError: (_e, on) => setEnabled(!on),
  });
  const toggle = () => {
    setEnabled(!enabled);
    save.mutate(!enabled);
  };
  const isGym = biz.type === 'gym';

  return (
    <div className="analytics-card">
      <div className="card-header-row" style={{ marginBottom: 12 }}>
        <div>
          <h3 className="analytics-card-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <CalendarCheckIcon size={17} style={{ color: 'var(--primary)' }} />
            Attendance
          </h3>
          <span className="analytics-card-subtitle">
            {isGym ? 'Members check in by scanning a QR code at the entrance.' : 'Staff mark who came each day.'} It never changes fees.
          </span>
        </div>
      </div>
      <div className="switch-wrap">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>Use attendance</div>
          <div className="small muted" style={{ marginTop: 1 }}>
            {enabled
              ? 'On: shows the Attendance tab, today\'s count on the home screen and each member\'s history.'
              : biz.type === 'hostel'
                ? 'Off by default for hostels. Turn it on if you take a daily or night roll-call.'
                : `Off: hidden everywhere${isGym ? ' and the QR poster stops working' : ''}. Past records are kept.`}
          </div>
        </div>
        <button
          type="button"
          role="switch"
          className={`switch-toggle ${enabled ? 'active' : ''}`}
          aria-checked={enabled}
          aria-label="Use attendance"
          disabled={!isOwner || save.isPending}
          onClick={toggle}>
          <span className="switch-thumb" />
        </button>
      </div>
      {!isOwner && <p className="small muted" style={{ margin: '8px 0 0' }}>Only the owner can change this.</p>}
      {save.error && <p className="error" role="alert">{save.error.message}</p>}
    </div>
  );
}

// 3. Automatic reminders. Only settings the server actually acts on live here.
function NotificationPreferencesSettings() {
  const biz = useBiz();
  const qc = useQueryClient();
  const isOwner = biz.ownerId === userId();
  const [enabled, setEnabled] = useState(biz.notifications?.renewalReminders ?? true);
  const [everyDays, setEveryDays] = useState(biz.reminderEveryDays || 3);

  const save = useMutation({
    mutationFn: (body) => api(`/businesses/${biz._id}`, { method: 'PATCH', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['businesses'] }),
  });

  const toggle = () => {
    setEnabled(!enabled);
    save.mutate({ notifications: { renewalReminders: !enabled } });
  };

  return (
    <div className="analytics-card">
      <div className="card-header-row" style={{ marginBottom: 12 }}>
        <div>
          <h3 className="analytics-card-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <BellIcon size={17} style={{ color: 'var(--primary)' }} />
            Automatic Reminders
          </h3>
          <span className="analytics-card-subtitle">
            Daily at 10 AM, members who owe money get a WhatsApp reminder with your UPI link and their statement
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="switch-wrap">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>Send automatic WhatsApp reminders</div>
            <div className="small muted" style={{ marginTop: 1 }}>Needs the WhatsApp Cloud API keys on the server (WA_TOKEN, WA_PHONE_ID)</div>
          </div>
          <button
            type="button"
            role="switch"
            className={`switch-toggle ${enabled ? 'active' : ''}`}
            aria-checked={enabled}
            aria-label="Send automatic WhatsApp reminders"
            disabled={!isOwner}
            onClick={toggle}>
            <span className="switch-thumb" />
          </button>
        </div>

        <div className="switch-wrap">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>Remind the same member at most every</div>
            <div className="small muted" style={{ marginTop: 1 }}>Fewer messages keep members from muting you</div>
          </div>
          <select
            value={everyDays}
            disabled={!isOwner || !enabled}
            aria-label="Reminder spacing"
            style={{ width: 'auto' }}
            onChange={(e) => {
              setEveryDays(Number(e.target.value));
              save.mutate({ reminderEveryDays: Number(e.target.value) });
            }}>
            <option value={3}>3 days</option>
            <option value={5}>5 days</option>
            <option value={7}>7 days</option>
          </select>
        </div>
        {save.error && <p className="error" role="alert">{save.error.message}</p>}
      </div>
    </div>
  );
}

// 4. Danger Zone Settings Component
function DangerZoneSettings() {
  const biz = useBiz();
  const qc = useQueryClient();
  const [modalType, setModalType] = useState(null); // 'clear' | 'delete'
  const [confirmInput, setConfirmInput] = useState('');

  const clearData = useMutation({
    mutationFn: () => api(`/businesses/${biz._id}/clear-data`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries();
      setModalType(null);
      setConfirmInput('');
      window.location.href = '/';
    },
  });

  const deleteBiz = useMutation({
    mutationFn: () => api(`/businesses/${biz._id}`, { method: 'DELETE' }),
    onSuccess: () => {
      localStorage.removeItem('bizId');
      window.location.href = '/';
    },
  });

  return (
    <div className="danger-zone-card">
      <div className="card-header-row" style={{ marginBottom: 10 }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 7 }}>
            <AlertCircleIcon size={17} /> Danger Zone
          </h3>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
            Irreversible actions for {biz.name}. Please exercise extreme caution.
          </span>
        </div>
      </div>

      <div className="danger-action-row">
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>Clear all member data</div>
          <div className="small muted">Permanently purge all members, payment transactions, dues, and subscription logs.</div>
        </div>
        <button
          type="button"
          className="btn-danger"
          style={{ minHeight: 30, padding: '4px 12px', fontSize: 12 }}
          onClick={() => { setModalType('clear'); setConfirmInput(''); }}>
          Clear All Data
        </button>
      </div>

      <div className="danger-action-row">
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>Delete workspace</div>
          <div className="small muted">Permanently delete this entire business workspace and all related configurations.</div>
        </div>
        <button
          type="button"
          className="btn-danger"
          style={{ minHeight: 30, padding: '4px 12px', fontSize: 12 }}
          onClick={() => { setModalType('delete'); setConfirmInput(''); }}>
          Delete Workspace
        </button>
      </div>

      {/* Confirmation Modal for Clear or Delete */}
      <AnimatePresence>
        {modalType && (
          <div className="modal-overlay" onClick={() => setModalType(null)} style={{ zIndex: 120 }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="modal-content"
              style={{ maxWidth: 440, border: '1px solid var(--red-border)' }}
              onClick={(e) => e.stopPropagation()}>
              <div className="form-header" style={{ marginBottom: 14 }}>
                <h3 className="form-title" style={{ color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertCircleIcon size={18} />
                  <span>
                    {modalType === 'clear' ? 'Clear All Member Data?' : `Delete "${biz.name}" Workspace?`}
                  </span>
                </h3>
                <button type="button" className="icon-btn" onClick={() => setModalType(null)}>
                  <XIcon size={14} />
                </button>
              </div>

              <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.45, marginBottom: 14 }}>
                {modalType === 'clear' ? (
                  <>
                    This will <b>permanently erase</b> all members, payments, and billing records for <b>{biz.name}</b>. This action cannot be undone.
                  </>
                ) : (
                  <>
                    This will <b>permanently destroy</b> the entire <b>{biz.name}</b> workspace, plans, and all member data.
                  </>
                )}
              </p>

              <div style={{ marginBottom: 16 }}>
                <label className="input-label" style={{ fontWeight: 600 }}>
                  Type <span style={{ color: 'var(--red)', fontFamily: 'monospace', fontWeight: 700 }}>DELETE</span> to confirm:
                </label>
                <input
                  placeholder="DELETE"
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  style={{ borderColor: confirmInput === 'DELETE' ? 'var(--red)' : 'var(--border)' }}
                />
              </div>

              <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn-secondary" onClick={() => setModalType(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={confirmInput !== 'DELETE' || clearData.isPending || deleteBiz.isPending}
                  className="btn-danger"
                  style={{ minHeight: 34, padding: '6px 14px', fontSize: 12.5 }}
                  onClick={() => {
                    if (modalType === 'clear') clearData.mutate();
                    else deleteBiz.mutate();
                  }}>
                  <TrashIcon size={14} />
                  {clearData.isPending || deleteBiz.isPending ? 'Processing…' : modalType === 'clear' ? 'Erase All Data' : 'Delete Workspace'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
