import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { api, rupees, waLink } from '../api.js';
import {
  Avatar, ShieldIcon, SearchIcon, XIcon, PhoneIcon, WhatsAppIcon, CopyIcon, LogOutIcon,
  PauseIcon, PlayIcon, ChevronIcon, BIZ_TYPES,
} from '../ui.jsx';

const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const fmtTime = (d) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const typeLabel = (t) => BIZ_TYPES[t]?.label || t;
const ACTIONS = {
  suspend_business: 'Paused business',
  resume_business: 'Resumed business',
  note_business: 'Updated note on',
  suspend_owner: 'Paused all businesses of',
  resume_owner: 'Resumed all businesses of',
  reset_password: 'Reset password for',
};
const REASONS = ['Platform fee not paid', 'Requested by the owner', 'Account under review'];

// Platform admin: every business and owner on this Local SaaS, with pause/resume and support tools
export default function AdminPanel({ me, onLogout, hasBusiness }) {
  const [tab, setTab] = useState('overview');
  const [openBiz, setOpenBiz] = useState(null);

  return (
    <div className="admin">
      <header className="admin-top">
        <div className="admin-brand">
          <span className="admin-mark"><ShieldIcon size={18} /></span>
          <div>
            <b>Platform admin</b>
            <span className="muted small">{me.name || me.phone}</span>
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {hasBusiness && <Link to="/" className="btn btn-secondary">My business</Link>}
          <button type="button" className="btn-secondary" onClick={onLogout} aria-label="Sign out"><LogOutIcon size={15} /><span className="hide-sm"> Sign out</span></button>
        </div>
      </header>

      <main className="admin-main">
        <div className="money-tabs admin-tabs" role="tablist" aria-label="Admin sections">
          {[['overview', 'Overview'], ['businesses', 'Businesses'], ['owners', 'Owners'], ['log', 'Activity']].map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{label}</button>
          ))}
        </div>

        {tab === 'overview' && <Overview onOpen={setOpenBiz} />}
        {tab === 'businesses' && <Businesses onOpen={setOpenBiz} />}
        {tab === 'owners' && <Owners />}
        {tab === 'log' && <ActivityLog />}
      </main>

      <AnimatePresence>
        {openBiz && <BusinessDetail id={openBiz} onClose={() => setOpenBiz(null)} />}
      </AnimatePresence>
    </div>
  );
}

function Overview({ onOpen }) {
  const { data: s } = useQuery({ queryKey: ['admin', 'stats'], queryFn: () => api('/admin/stats') });
  const { data: paused = [] } = useQuery({ queryKey: ['admin', 'businesses', '', 'suspended', ''], queryFn: () => api('/admin/businesses?status=suspended') });
  if (!s) return <div className="card skeleton" style={{ minHeight: 200 }} aria-hidden="true" />;
  return (
    <>
      <div className="money-cards">
        <div className="money-card"><span className="money-label">Businesses</span><b>{s.businesses}</b><span className="muted small">{s.active} running · {s.suspended} paused</span></div>
        <div className="money-card"><span className="money-label">Owners</span><b>{s.owners}</b><span className="muted small">{s.users} accounts in total</span></div>
        <div className="money-card"><span className="money-label">Active members</span><b>{s.activeMembers.toLocaleString('en-IN')}</b><span className="muted small">across all businesses</span></div>
        <div className="money-card"><span className="money-label">Collected this month</span><b className="green-text">{rupees(s.receivedThisMonth)}</b><span className="muted small">{s.paymentsThisMonth} payments recorded</span></div>
      </div>
      <div className="analytics-card admin-types">
        <span className="muted small">New in the last 30 days: <b>{s.newBusinesses30d}</b></span>
        {Object.entries(s.byType).map(([t, n]) => <span key={t} className="badge gray">{typeLabel(t)}: {n}</span>)}
      </div>
      <div className="analytics-card">
        <h3 className="analytics-card-title">Paused businesses</h3>
        {!paused.length && <p className="muted small" style={{ margin: '6px 0 0' }}>None. Every business is running.</p>}
        {paused.map((b) => <BizRow key={b._id} b={b} onOpen={onOpen} />)}
      </div>
    </>
  );
}

function BizRow({ b, onOpen }) {
  return (
    <button type="button" className="admin-row" onClick={() => onOpen(b._id)}>
      <Avatar name={b.name} />
      <span className="admin-row-main">
        <b>{b.name}</b>
        <span className="muted small">{typeLabel(b.type)} · {b.owner ? `${b.owner.name || 'Owner'} · ${b.owner.phone}` : 'no owner'}</span>
        {b.status === 'suspended' && <span className="red-text small">Paused {fmt(b.suspendedAt)}: {b.suspendedReason}</span>}
      </span>
      <span className="admin-row-nums hide-sm">
        <span><b>{b.activeMembers}</b> members</span>
        <span><b>{rupees(b.receivedThisMonth)}</b> this month</span>
        <span className="muted small">last payment {fmt(b.lastPayment)}</span>
      </span>
      <span className={`badge ${b.status === 'suspended' ? 'red' : 'green'}`}>{b.status === 'suspended' ? 'Paused' : 'Running'}</span>
      <ChevronIcon size={16} />
    </button>
  );
}

function Businesses({ onOpen }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const { data: list } = useQuery({
    queryKey: ['admin', 'businesses', q, status, type],
    queryFn: () => api(`/admin/businesses?${new URLSearchParams({ q, status, type })}`),
    placeholderData: (prev) => prev,
  });
  return (
    <div className="analytics-card">
      <div className="admin-filters">
        <div className="search-input-wrap">
          <SearchIcon size={14} className="search-icon" />
          <input type="search" placeholder="Business, owner or phone" aria-label="Search businesses" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">All statuses</option><option value="active">Running</option><option value="suspended">Paused</option>
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Type">
          <option value="">All types</option>
          {Object.entries(BIZ_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>
      <p className="muted small" style={{ margin: '10px 0 2px' }}>{list ? `${list.length} business${list.length === 1 ? '' : 'es'}` : 'Loading…'}</p>
      {list?.map((b) => <BizRow key={b._id} b={b} onOpen={onOpen} />)}
    </div>
  );
}

function BusinessDetail({ id, onClose }) {
  const qc = useQueryClient();
  const [note, setNote] = useState(null);
  const [pausing, setPausing] = useState(false);
  const { data: b } = useQuery({ queryKey: ['admin', 'business', id], queryFn: () => api(`/admin/businesses/${id}`) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin'] });
  const resume = useMutation({ mutationFn: () => api(`/admin/businesses/${id}/resume`, { method: 'POST' }), onSuccess: refresh });
  const pause = useMutation({ mutationFn: (reason) => api(`/admin/businesses/${id}/suspend`, { method: 'POST', body: { reason } }), onSuccess: () => { setPausing(false); refresh(); } });
  const saveNote = useMutation({ mutationFn: () => api(`/admin/businesses/${id}/note`, { method: 'PUT', body: { note } }), onSuccess: () => { setNote(null); refresh(); } });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        className="modal-content admin-detail" onClick={(e) => e.stopPropagation()}>
        {!b ? <p className="muted">Loading…</p> : (
          <>
            <div className="form-header" style={{ marginBottom: 12 }}>
              <div style={{ minWidth: 0 }}>
                <h3 className="form-title" style={{ margin: 0 }}>{b.name}</h3>
                <span className="muted small">{typeLabel(b.type)} · on the platform since {fmt(b.createdAt)}</span>
              </div>
              <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><XIcon size={14} /></button>
            </div>

            {b.status === 'suspended' ? (
              <div className="admin-status paused">
                <div><b>Paused</b> since {fmt(b.suspendedAt)}</div>
                <div className="small">Owner sees: “{b.suspendedReason}”</div>
                <button type="button" className="btn" disabled={resume.isPending} onClick={() => resume.mutate()}><PlayIcon size={14} /> Resume service</button>
              </div>
            ) : (
              <div className="admin-status">
                <div><b>Running</b></div>
                <div className="small muted">Pausing blocks the owner and staff, member statement links, the gym QR and automatic reminders. Data is kept.</div>
                <button type="button" className="btn-secondary red-text" onClick={() => setPausing(true)}><PauseIcon size={14} /> Pause service</button>
              </div>
            )}

            <div className="admin-facts">
              <div><span>Active members</span><b>{b.activeMembers}</b><small>{b.totalMembers} ever</small></div>
              <div><span>This month</span><b>{rupees(b.receivedThisMonth)}</b><small>{rupees(b.receivedAllTime)} all time</small></div>
              <div><span>Last payment</span><b>{fmt(b.lastPayment)}</b><small>{b.paymentsAllTime} payment{b.paymentsAllTime === 1 ? '' : 's'}</small></div>
              <div><span>Staff</span><b>{b.staffCount}</b><small>{b.upiId ? 'UPI set up' : 'no UPI ID'}</small></div>
            </div>

            {b.owner && (
              <div className="admin-person">
                <Avatar name={b.owner.name || b.owner.phone} />
                <div className="grow"><b>{b.owner.name || 'Owner'}</b><span className="muted small">Owner · {b.owner.phone}</span></div>
                <a className="btn btn-secondary today-icon-btn att-call" href={`tel:${b.owner.phone}`} aria-label="Call owner"><PhoneIcon size={17} /></a>
                <a className="btn btn-secondary today-icon-btn" target="_blank" rel="noreferrer" href={waLink(b.owner.phone, `Hi ${b.owner.name || ''}, this is Local SaaS support about ${b.name}.`)} aria-label="WhatsApp owner"><WhatsAppIcon size={18} /></a>
              </div>
            )}
            {b.staff.map((s) => (
              <div key={s._id} className="admin-person"><Avatar name={s.name || s.phone} /><div className="grow"><b>{s.name || 'Staff'}</b><span className="muted small">Staff · {s.phone}</span></div></div>
            ))}

            <label className="admin-note">
              <span className="small muted">Private note (only admins see this)</span>
              <textarea rows={2} value={note ?? b.adminNote} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Pays yearly by bank transfer" />
            </label>
            {note !== null && note !== b.adminNote && (
              <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn-secondary" onClick={() => setNote(null)}>Cancel</button>
                <button type="button" className="btn" disabled={saveNote.isPending} onClick={() => saveNote.mutate()}>Save note</button>
              </div>
            )}

            {b.log.length > 0 && (
              <div className="admin-log-mini">
                <span className="small muted">History</span>
                {b.log.map((l) => <div key={l._id} className="small"><b>{ACTIONS[l.action] || l.action}</b>{l.detail ? ` · ${l.detail}` : ''} <span className="muted">· {l.admin} · {fmtTime(l.at)}</span></div>)}
              </div>
            )}
          </>
        )}
      </motion.div>

      <AnimatePresence>
        {pausing && <ReasonDialog title={`Pause ${b?.name}?`} onClose={() => setPausing(false)} onConfirm={(r) => pause.mutate(r)} busy={pause.isPending} error={pause.error?.message} />}
      </AnimatePresence>
    </div>
  );
}

function ReasonDialog({ title, note, onClose, onConfirm, busy, error }) {
  const [reason, setReason] = useState('');
  return (
    <div className="modal-overlay" style={{ zIndex: 130 }} onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <motion.form initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        className="modal-content" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); onConfirm(reason.trim()); }}>
        <h3 className="form-title" style={{ marginTop: 0 }}>{title}</h3>
        <p className="small muted">{note || 'The owner and staff will see this reason. Members can no longer open their statement links. Nothing is deleted.'}</p>
        <div className="chips-row" style={{ margin: '8px 0' }}>
          {REASONS.map((r) => <button key={r} type="button" className="chip" onClick={() => setReason(r)}>{r}</button>)}
        </div>
        <textarea rows={3} required minLength={3} maxLength={200} autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason shown to the owner" aria-label="Reason" />
        {error && <p className="error" role="alert">{error}</p>}
        <div className="expense-form-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-danger" disabled={busy || reason.trim().length < 3}>{busy ? 'Pausing…' : 'Pause service'}</button>
        </div>
      </motion.form>
    </div>
  );
}

function Owners() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [pausing, setPausing] = useState(null);
  const [resetFor, setResetFor] = useState(null);
  const [temp, setTemp] = useState(null); // { owner, password }
  const [copied, setCopied] = useState(false);
  const { data: list } = useQuery({ queryKey: ['admin', 'owners', q], queryFn: () => api(`/admin/owners?q=${encodeURIComponent(q)}`), placeholderData: (p) => p });
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin'] });
  const pause = useMutation({ mutationFn: ({ id, reason }) => api(`/admin/owners/${id}/suspend`, { method: 'POST', body: { reason } }), onSuccess: () => { setPausing(null); refresh(); } });
  const resume = useMutation({ mutationFn: (id) => api(`/admin/owners/${id}/resume`, { method: 'POST' }), onSuccess: refresh });
  const reset = useMutation({
    mutationFn: (o) => api(`/admin/owners/${o._id}/reset-password`, { method: 'POST' }),
    onSuccess: (d, o) => { setResetFor(null); setCopied(false); setTemp({ owner: o, password: d.tempPassword }); refresh(); },
  });

  return (
    <div className="analytics-card">
      <div className="admin-filters">
        <div className="search-input-wrap">
          <SearchIcon size={14} className="search-icon" />
          <input type="search" placeholder="Name, phone or business" aria-label="Search owners" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <p className="muted small" style={{ margin: '10px 0 2px' }}>{list ? `${list.length} account${list.length === 1 ? '' : 's'}` : 'Loading…'}</p>
      {list?.map((o) => (
        <div key={o._id} className="admin-row static">
          <Avatar name={o.name || o.phone} />
          <span className="admin-row-main">
            <b>{o.name || 'No name'} {o.role === 'admin' && <span className="badge blue">Admin</span>}</b>
            <span className="muted small">{o.phone} · joined {fmt(o.joinedAt)}</span>
            <span className="small">{o.businesses ? `${o.businesses} business${o.businesses === 1 ? '' : 'es'}: ${o.businessNames.join(', ')}` : <span className="muted">No business of their own (staff or not set up)</span>}</span>
            {o.suspended > 0 && <span className="red-text small">{o.suspended} paused</span>}
          </span>
          {o.role !== 'admin' && (
            <span className="admin-row-actions">
              {o.suspended > 0
                ? <button type="button" className="btn-secondary" disabled={resume.isPending} onClick={() => resume.mutate(o._id)}><PlayIcon size={14} /> Resume all</button>
                : o.businesses > 0 && <button type="button" className="btn-secondary red-text" onClick={() => setPausing(o)}><PauseIcon size={14} /> Pause all</button>}
              <button type="button" className="btn-secondary" onClick={() => setResetFor(o)}>Reset password</button>
            </span>
          )}
        </div>
      ))}

      <AnimatePresence>
        {pausing && (
          <ReasonDialog title={`Pause all of ${pausing.name || pausing.phone}'s businesses?`}
            note={`${pausing.businessNames.join(', ')} will be paused. The owner and staff will see this reason; nothing is deleted.`}
            onClose={() => setPausing(null)} onConfirm={(reason) => pause.mutate({ id: pausing._id, reason })} busy={pause.isPending} error={pause.error?.message} />
        )}
        {resetFor && (
          <div className="modal-overlay" onClick={() => setResetFor(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} className="modal-content" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
              <h3 className="form-title" style={{ marginTop: 0 }}>Reset {resetFor.name || resetFor.phone}'s password?</h3>
              <p className="small muted">Their current password stops working. You'll see a temporary password once, to send them.</p>
              {reset.error && <p className="error" role="alert">{reset.error.message}</p>}
              <div className="expense-form-actions">
                <button type="button" className="btn-secondary" onClick={() => setResetFor(null)}>Cancel</button>
                <button type="button" className="btn" disabled={reset.isPending} onClick={() => reset.mutate(resetFor)}>Reset password</button>
              </div>
            </motion.div>
          </div>
        )}
        {temp && (
          <div className="modal-overlay" onClick={() => setTemp(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} className="modal-content" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
              <h3 className="form-title" style={{ marginTop: 0 }}>Temporary password</h3>
              <p className="small muted">For {temp.owner.name || temp.owner.phone} ({temp.owner.phone}). It's shown only now: send it to them.</p>
              <div className="admin-temp"><code>{temp.password}</code>
                <button type="button" className="btn-secondary" onClick={() => { navigator.clipboard?.writeText(temp.password); setCopied(true); }}><CopyIcon size={14} /> {copied ? 'Copied' : 'Copy'}</button>
              </div>
              <div className="expense-form-actions">
                <a className="btn btn-secondary" target="_blank" rel="noreferrer"
                  href={waLink(temp.owner.phone, `Hi ${temp.owner.name || ''}, your Local SaaS password was reset. Log in with ${temp.owner.phone} and this temporary password: ${temp.password}`)}>
                  <WhatsAppIcon size={15} /> Send on WhatsApp
                </a>
                <button type="button" className="btn" onClick={() => setTemp(null)}>Done</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ActivityLog() {
  const { data: list } = useQuery({ queryKey: ['admin', 'log'], queryFn: () => api('/admin/log') });
  return (
    <div className="analytics-card">
      <h3 className="analytics-card-title">Admin activity</h3>
      {list && !list.length && <p className="muted small">Nothing yet.</p>}
      {list?.map((l) => (
        <div key={l._id} className="admin-log-row">
          <span className="muted small admin-log-time">{fmtTime(l.at)}</span>
          <span>
            <b>{ACTIONS[l.action] || l.action}</b> {l.business || l.owner}
            {l.detail && <span className="muted"> · {l.detail}</span>}
            <span className="muted small"> · by {l.admin}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
