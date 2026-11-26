import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import QRCode from 'qrcode';
import { api, userId, download, rupees } from '../api.js';
import { useBiz, useTheme } from '../contexts.js';
import { words } from '../wording.js';
import {
  Field, ShieldIcon, UserIcon, UsersIcon, PhoneIcon, DownloadIcon, CheckIcon, BuildingIcon,
  ConfirmDialog, BIZ_TYPES, AlertCircleIcon, XIcon, TrashIcon, LogOutIcon, ChevronIcon,
  CalendarCheckIcon, EditIcon, RupeeIcon, WhatsAppIcon, SunIcon, MoonIcon, PrinterIcon, CreditCardIcon, TagIcon,
} from '../ui.jsx';

const ago = (t) => {
  if (!t) return 'Never';
  const days = Math.floor((Date.now() - t) / 86400000);
  return days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`;
};
const readLS = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const writeLS = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };
const fmtPhone = (p) => (p && p.length === 10 ? `+91 ${p.slice(0, 5)} ${p.slice(5)}` : p ? `+91 ${p}` : '');

// Settings on one page: what's working at the top, then getting paid, this outlet and your data.
export default function Settings() {
  const biz = useBiz();
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: () => api('/me'), staleTime: 5 * 60000 });
  const isOwner = biz.ownerId === userId();
  const [dialog, setDialog] = useState(null); // 'profile' | 'password'
  const backupKey = `backup:${biz._id}`;
  const [lastBackup, setLastBackup] = useState(() => Number(readLS(backupKey)) || null);
  const remindersOn = biz.notifications?.renewalReminders ?? true;
  const attendanceOn = biz.attendanceEnabled !== false;

  const health = [
    {
      key: 'upi', icon: RupeeIcon, label: 'UPI payments',
      value: biz.upiId ? '✓ Set up' : 'Not set up', tone: biz.upiId ? 'green' : 'red', warn: !biz.upiId,
    },
    {
      key: 'wa', icon: WhatsAppIcon, label: 'Auto reminders',
      value: !remindersOn ? 'Off' : me?.waConnected ? '✓ Sending daily' : 'Not connected',
      tone: !remindersOn ? 'grey' : me?.waConnected ? 'green' : 'amber', warn: remindersOn && me && !me.waConnected,
    },
    {
      key: 'att', icon: CalendarCheckIcon, label: 'Attendance',
      value: attendanceOn ? (biz.type === 'gym' ? 'On · QR check-in' : 'On') : 'Off', tone: 'blue',
    },
    {
      key: 'backup', icon: DownloadIcon, label: 'Last backup', value: ago(lastBackup), tone: 'violet',
      note: lastBackup ? 'on this device' : null,
    },
  ];
  const signOut = () => { localStorage.removeItem('token'); localStorage.removeItem('bizId'); location.href = '/'; };

  return (
    <div className="st">
      <div className="page-header home-header db-head st-head">
        <div className="st-who">
          <span className="st-avatar" aria-hidden="true">{initials(me?.name)}</span>
          <div className="page-title-wrap">
            <p className="db-date">{[me?.name, fmtPhone(me?.phone), isOwner ? 'Owner' : 'Staff'].filter(Boolean).join(' · ')}</p>
            <h1 className="db-hello">Settings</h1>
          </div>
        </div>
        <div className="st-head-actions">
          <button type="button" className="btn-secondary" onClick={() => setDialog('profile')}><UserIcon size={15} /> <span className="st-long">Edit profile</span><span className="st-short">Edit</span></button>
          <button type="button" className="btn-secondary" onClick={() => setDialog('password')}><ShieldIcon size={15} /> Change password</button>
        </div>
      </div>

      <section className="st-health" aria-label="At a glance">
        {health.map((h) => (
          <div key={h.key} className={`st-health-card ${h.warn ? 'warn' : ''}`}>
            <span className={`db-today-icon ${h.tone}`}><h.icon size={17} /></span>
            <span className="st-health-text">
              <span className="db-label">{h.label}</span>
              <b className={h.tone}>{h.value}</b>
              {h.note && <span className="st-dim">{h.note}</span>}
            </span>
          </div>
        ))}
      </section>
      {/* phones: the same, as a strip of chips */}
      <div className="st-chips" aria-hidden="true">
        {health.map((h) => <span key={h.key} className={`st-chip ${h.tone}`}>{h.label}: {h.value}</span>)}
      </div>

      <div className="st-grid">
        <div className="st-col">
          <UpiCard isOwner={isOwner} />
          <RemindersCard isOwner={isOwner} waConnected={me?.waConnected} />
        </div>

        <div className="st-col">
          <OutletCard isOwner={isOwner} />
          <section className="st-card">
            <div className="st-card-head">
              <span className="st-card-icon blue"><DownloadIcon size={15} /></span>
              <span><b>Download your data</b><span className="st-dim">Opens in Excel or Google Sheets</span></span>
            </div>
            <div className="st-downloads">
              {[
                isOwner && ['backup.json', 'Everything', 'Full backup file', `${biz.name}-full-backup.json`, true],
                ['payments.csv', 'Payments', 'Every payment received', `${biz.name}-payments.csv`],
                ['dues.csv', 'Unpaid fees', 'Who owes what', `${biz.name}-unpaid-fees.csv`],
                ['expenses.csv', 'Expenses', 'Everything you spent', `${biz.name}-expenses.csv`],
              ].filter(Boolean).map(([file, label, hint, name, isBackup]) => (
                <button key={file} type="button" className="st-dl" onClick={() => {
                  download(`/businesses/${biz._id}/export/${file}`, name);
                  if (isBackup) { const t = Date.now(); writeLS(backupKey, String(t)); setLastBackup(t); }
                }}>
                  <b>{label}</b><span>{hint}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="st-card st-rows">
            <LookRow />
            <div className="st-row st-pw-row">
              <span className="st-row-text"><b>Password</b><span>At least 6 characters</span></span>
              <button type="button" className="btn-secondary st-small" onClick={() => setDialog('password')}>Change</button>
            </div>
            <div className="st-row">
              <span className="st-row-text"><b>Sign out</b><span>On this device only</span></span>
              <button type="button" className="btn-secondary st-small" onClick={signOut}><LogOutIcon size={14} /> Sign out</button>
            </div>
            {me?.role === 'admin' && (
              <Link to="/admin" className="st-row st-row-link">
                <span className="st-row-text"><b>Platform admin</b><span>All businesses and owners</span></span>
                <ChevronIcon size={15} />
              </Link>
            )}
          </section>

          {isOwner && (
            <details className="st-danger">
              <summary>Danger zone · clear data or delete this outlet</summary>
              <DangerZoneSettings />
            </details>
          )}
        </div>
      </div>

      <AnimatePresence>
        {dialog && (
          <div className="modal-overlay" onClick={() => setDialog(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 12 }} transition={{ duration: 0.18 }}
              className="modal-content st-modal" role="dialog" aria-modal="true" aria-label={dialog === 'profile' ? 'Edit profile' : 'Change password'}
              onClick={(e) => e.stopPropagation()}>
              <div className="form-header" style={{ marginBottom: 6 }}>
                <div className="form-title">{dialog === 'profile' ? <><UserIcon size={18} style={{ color: 'var(--primary)' }} /> Edit profile</> : <><ShieldIcon size={18} style={{ color: 'var(--primary)' }} /> Change password</>}</div>
                <button type="button" className="icon-btn" aria-label="Close" onClick={() => setDialog(null)}><XIcon size={14} /></button>
              </div>
              {dialog === 'profile' ? <ProfileSettings me={me} /> : <PasswordSettings />}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// The UPI card, drawn like what members see, with its QR and a printable poster
function UpiCard({ isOwner }) {
  const biz = useBiz();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [upiInput, setUpiInput] = useState(biz.upiId || '');
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [svg, setSvg] = useState('');
  const payUrl = biz.upiId ? `upi://pay?pa=${encodeURIComponent(biz.upiId)}&pn=${encodeURIComponent(biz.name || '')}&cu=INR` : '';
  useEffect(() => {
    if (!payUrl) { setSvg(''); return; }
    QRCode.toString(payUrl, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' }).then(setSvg).catch(() => setSvg(''));
  }, [payUrl]);

  const save = useMutation({
    mutationFn: (v) => api(`/businesses/${biz._id}`, { method: 'PATCH', body: { upiId: v } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['businesses'] }); setEditing(false); setConfirmOpen(false); },
  });
  const check = (v) => {
    const t = v.trim();
    if (!t) return 'Enter your UPI ID';
    if (!t.includes('@')) return 'A UPI ID has an @ in it, like yourname@okaxis';
    if (/\s/.test(t)) return 'No spaces in a UPI ID';
    if (t.length < 5) return 'That looks too short';
    return null;
  };
  const printPoster = () => {
    document.body.classList.add('printing-poster');
    const done = () => { document.body.classList.remove('printing-poster'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.print();
  };
  const showForm = editing || !biz.upiId;

  return (
    <section className="st-card">
      <div className="st-card-head">
        <span className="st-card-icon green"><RupeeIcon size={15} /></span>
        <span><b>How members pay you</b><span className="st-dim">Reminders and statements carry a 1-tap pay link. Money goes straight to you.</span></span>
      </div>

      {showForm ? (
        <form className="st-upi-form" onSubmit={(e) => { e.preventDefault(); const err = check(upiInput); setError(err || ''); if (!err) setConfirmOpen(true); }}>
          <Field label="Your UPI ID">
            <input value={upiInput} disabled={!isOwner} placeholder="e.g. yourgym@ybl" style={{ fontFamily: 'ui-monospace, monospace' }}
              onChange={(e) => { setUpiInput(e.target.value); setError(''); }} />
          </Field>
          {error ? <p className="error small" style={{ margin: 0 }}>{error}</p> : <p className="st-dim" style={{ margin: 0 }}>Find it in your UPI app (PhonePe, GPay, Paytm) under your profile.</p>}
          {isOwner ? (
            <div className="en-actions">
              <span style={{ flex: 1 }} />
              {biz.upiId && <button type="button" className="btn-secondary" onClick={() => { setEditing(false); setUpiInput(biz.upiId); setError(''); }}>Cancel</button>}
              <button type="submit" className="btn" disabled={save.isPending}><CheckIcon size={14} /> Save UPI ID</button>
            </div>
          ) : <p className="st-dim" style={{ margin: 0 }}>Only the owner can set the UPI ID.</p>}
        </form>
      ) : (
        <>
          <div className="st-upi">
            <span className="st-upi-text">
              <span className="st-upi-label">Pay {biz.name} by UPI</span>
              <b className="st-upi-id">{biz.upiId}</b>
              <span className="st-upi-ok"><i aria-hidden="true" /> Set up · try the ₹1 test once to be sure</span>
            </span>
            {svg && <span className="st-upi-qr" aria-label="QR code for your UPI ID" dangerouslySetInnerHTML={{ __html: svg }} />}
          </div>
          <div className="st-upi-actions">
            <a className="btn btn-secondary st-test" href={`${payUrl}&am=1`} target="_blank" rel="noreferrer">Send ₹1 test</a>
            {isOwner && <button type="button" className="btn-secondary" onClick={() => setEditing(true)}><EditIcon size={14} /> Change UPI ID</button>}
            <button type="button" className="btn-secondary" disabled={!svg} onClick={printPoster}><PrinterIcon size={14} /> Print QR poster</button>
          </div>
          {/* only shows when printing */}
          <div className="qr-poster" aria-hidden="true">
            <h1>{biz.name}</h1>
            <p className="qr-poster-sub">Scan to pay by UPI</p>
            <div className="qr-poster-code" dangerouslySetInnerHTML={{ __html: svg }} />
            <p>{biz.upiId} · Open any UPI app (PhonePe, GPay, Paytm), scan, and enter the amount.</p>
          </div>
        </>
      )}
      {save.error && <p className="error" role="alert">{save.error.message}</p>}

      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => save.mutate(upiInput.trim())}
        title="Use this UPI ID?"
        message={`Members' pay links will send money to ${upiInput.trim()}. Check it carefully — a typo sends money to the wrong place.`}
        confirmText="Yes, use it"
        busy={save.isPending}
      />
    </section>
  );
}

// Automatic WhatsApp reminders, with the message members actually get
function RemindersCard({ isOwner, waConnected }) {
  const biz = useBiz();
  const qc = useQueryClient();
  const w = words(biz.type);
  const [enabled, setEnabled] = useState(biz.notifications?.renewalReminders ?? true);
  const [everyDays, setEveryDays] = useState(biz.reminderEveryDays || 3);
  const save = useMutation({
    mutationFn: (body) => api(`/businesses/${biz._id}`, { method: 'PATCH', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['businesses'] }),
  });
  const sample = `Hi Rohit, your payment of ${rupees(1500)} for ${biz.name} is pending. Please pay at the earliest. Thank you!${biz.upiId ? ` Pay via UPI: upi://pay?pa=${biz.upiId}…` : ''}`;

  return (
    <section className="st-card st-rows">
      <div className="st-card-head">
        <span className="st-card-icon wa"><WhatsAppIcon size={15} /></span>
        <span><b>WhatsApp reminders</b><span className="st-dim">Every day at 10 AM, {w.member}s who owe get one, with your pay link</span></span>
      </div>
      <div className="st-row">
        <span className="st-row-text"><b>Send them automatically</b><span>{enabled ? 'On' : 'Off — you can still send them yourself from Collect'}</span></span>
        <button type="button" role="switch" aria-checked={enabled} aria-label="Send automatic reminders" disabled={!isOwner}
          className={`switch-toggle ${enabled ? 'active' : ''}`}
          onClick={() => { setEnabled(!enabled); save.mutate({ notifications: { renewalReminders: !enabled } }); }}>
          <span className="switch-thumb" />
        </button>
      </div>
      <div className="st-row">
        <span className="st-row-text"><b>Same {w.member} at most every</b><span>Fewer messages keep {w.member}s from muting you</span></span>
        <div className="st-seg" role="radiogroup" aria-label="Reminder spacing">
          {[3, 5, 7].map((d) => (
            <button key={d} type="button" role="radio" aria-checked={everyDays === d} className={everyDays === d ? 'on' : ''}
              disabled={!isOwner || !enabled} onClick={() => { setEveryDays(d); save.mutate({ reminderEveryDays: d }); }}>{d} days</button>
          ))}
        </div>
      </div>
      <div className="st-wa-preview" aria-label="Example reminder">
        <div className="st-wa-bubble">{sample}<span>10:00 AM</span></div>
      </div>
      {enabled && waConnected === false && (
        <div className="st-wa-note"><b>Not connected yet.</b> Automatic sending needs WhatsApp to be connected on the server. Until then, tap Remind on Collect — WhatsApp opens with this message ready.</div>
      )}
      {!isOwner && <p className="st-dim" style={{ margin: '0 18px 14px' }}>Only the owner can change these.</p>}
      {save.error && <p className="error" role="alert" style={{ margin: '0 18px 14px' }}>{save.error.message}</p>}
    </section>
  );
}

// This outlet: name, attendance, and where plans and staff live now
function OutletCard({ isOwner }) {
  const biz = useBiz();
  const qc = useQueryClient();
  const typeConfig = BIZ_TYPES[biz.type] || BIZ_TYPES.gym;
  const [attOn, setAttOn] = useState(biz.attendanceEnabled !== false);
  const [salesOn, setSalesOn] = useState(biz.salesEnabled !== false);
  const saveSales = useMutation({
    mutationFn: (on) => api(`/businesses/${biz._id}`, { method: 'PATCH', body: { salesEnabled: on } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['businesses'] }),
    onError: (_e, on) => setSalesOn(!on),
  });
  const saveAtt = useMutation({
    mutationFn: (on) => api(`/businesses/${biz._id}`, { method: 'PATCH', body: { attendanceEnabled: on } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['businesses'] }),
    onError: (_e, on) => setAttOn(!on),
  });
  const { data: plans } = useQuery({ queryKey: ['plans', biz._id], queryFn: () => api(`/businesses/${biz._id}/plans`) });
  const { data: staff } = useQuery({ queryKey: ['staff-all'], queryFn: () => api('/staff'), enabled: isOwner });
  const myStaff = (staff || []).filter((s) => s.allOutlets || s.businessIds.map(String).includes(biz._id));
  const initialsOf = (biz.name || '?').trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const isGym = biz.type === 'gym';

  return (
    <section className="st-card st-rows">
      <div className="st-card-head st-outlet-head">
        <span className="st-outlet-av" aria-hidden="true">{initialsOf}</span>
        <span className="grow"><b className="st-outlet-name">{isOwner ? <BusinessName biz={biz} /> : biz.name}</b><span className="st-dim">{typeConfig.label} · this outlet's settings</span></span>
      </div>
      <div className="st-row">
        <span className="st-card-icon blue"><CalendarCheckIcon size={14} /></span>
        <span className="st-row-text"><b>Attendance</b><span>{isGym ? 'Members scan a QR at the door.' : 'Staff mark who came each day.'} Never changes fees.</span></span>
        <button type="button" role="switch" aria-checked={attOn} aria-label="Use attendance" disabled={!isOwner || saveAtt.isPending}
          className={`switch-toggle ${attOn ? 'active' : ''}`} onClick={() => { setAttOn(!attOn); saveAtt.mutate(!attOn); }}>
          <span className="switch-thumb" />
        </button>
      </div>
      <div className="st-row">
        <span className="st-card-icon amber"><TagIcon size={14} /></span>
        <span className="st-row-text"><b>Sell products &amp; services</b><span>{salesOn ? 'Shows Sales in the menu and Sell on Collect and member pages.' : 'Hidden. Turn on to sell PT packs, supplements, diet plans and more.'}</span></span>
        <button type="button" role="switch" aria-checked={salesOn} aria-label="Sell products and services" disabled={!isOwner || saveSales.isPending}
          className={`switch-toggle ${salesOn ? 'active' : ''}`} onClick={() => { setSalesOn(!salesOn); saveSales.mutate(!salesOn); }}>
          <span className="switch-thumb" />
        </button>
      </div>
      {isOwner && (
        <Link to="/setup?tab=staff" className="st-row st-row-link">
          <span className="st-card-icon pink"><UsersIcon size={14} /></span>
          <span className="st-row-text"><b>Staff &amp; their access</b><span>{staff ? `${myStaff.length} ${myStaff.length === 1 ? 'person' : 'people'} can open this outlet` : 'Who can do what'}</span></span>
          <span className="st-go">Setup <ChevronIcon size={14} /></span>
        </Link>
      )}
      <Link to="/setup?tab=plans" className="st-row st-row-link">
        <span className="st-card-icon green"><CreditCardIcon size={14} /></span>
        <span className="st-row-text"><b>Plans &amp; {biz.type === 'hostel' ? 'rooms' : 'batches'}</b><span>{plans ? `${plans.length} ${plans.length === 1 ? 'plan' : 'plans'}` : 'Fees and cycles'}</span></span>
        <span className="st-go">Setup <ChevronIcon size={14} /></span>
      </Link>
      {!isOwner && <p className="st-dim" style={{ margin: '0 18px 14px' }}>Only the owner can change these.</p>}
      {(saveAtt.error || saveSales.error) && <p className="error" role="alert" style={{ margin: '0 18px 14px' }}>{(saveAtt.error || saveSales.error).message}</p>}
    </section>
  );
}

function LookRow() {
  const { theme, toggleTheme } = useTheme();
  return (
    <div className="st-row">
      <span className="st-row-text"><b>Look</b><span>On this device</span></span>
      <div className="st-seg" role="radiogroup" aria-label="Theme">
        <button type="button" role="radio" aria-checked={theme === 'light'} className={theme === 'light' ? 'on' : ''} onClick={() => theme !== 'light' && toggleTheme()}><SunIcon size={13} /> Light</button>
        <button type="button" role="radio" aria-checked={theme === 'dark'} className={theme === 'dark' ? 'on' : ''} onClick={() => theme !== 'dark' && toggleTheme()}><MoonIcon size={13} /> Dark</button>
      </div>
    </div>
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
            These can't be undone. Download the full backup first.
          </span>
        </div>
      </div>

      <div className="danger-action-row">
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>Clear all member data</div>
          <div className="small muted">Removes every member, payment, due and attendance record. Plans and staff stay.</div>
        </div>
        <button
          type="button"
          className="btn-danger"
          style={{ minHeight: 30, padding: '4px 12px', fontSize: 12 }}
          onClick={() => { setModalType('clear'); setConfirmInput(''); }}>
          Clear data…
        </button>
      </div>

      <div className="danger-action-row">
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>Delete this outlet</div>
          <div className="small muted">{biz.name} and everything in it. Your other outlets are not touched.</div>
        </div>
        <button
          type="button"
          className="btn-danger"
          style={{ minHeight: 30, padding: '4px 12px', fontSize: 12 }}
          onClick={() => { setModalType('delete'); setConfirmInput(''); }}>
          Delete outlet…
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
                    {modalType === 'clear' ? 'Clear all member data?' : `Delete ${biz.name}?`}
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
                    This <b>permanently deletes</b> <b>{biz.name}</b>: its plans, members, payments and attendance.
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
                  {clearData.isPending || deleteBiz.isPending ? 'Processing…' : modalType === 'clear' ? 'Erase all data' : 'Delete outlet'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
