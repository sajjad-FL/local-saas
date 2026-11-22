import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { api, waLink, ACCESS_LEVELS } from '../api.js';
import { useBiz } from '../App.jsx';
import { confirmAction } from '../confirm.jsx';
import { Field, PlusIcon, XIcon, UsersIcon, CheckIcon, WhatsAppIcon, ShieldIcon } from '../ui.jsx';

const initials = (name) => (name || '?').trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
const TONES = ['blue', 'pink', 'orange', 'green', 'violet'];
const fmtPhone = (p) => (p && p.length === 10 ? `+91 ${p.slice(0, 5)} ${p.slice(5)}` : p || '');
const added = (d) => {
  const day = new Date(d).toDateString();
  if (day === new Date().toDateString()) return 'Today';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};
const inviteText = (name, outlets) =>
  `Hi${name ? ` ${name.split(' ')[0]}` : ''}, I've added you as staff for ${outlets} on LocalSaaS. Sign up with this number to start: ${window.location.origin}/signup`;

// Everyone the owner has given access to, which outlets they can open and what they can do there.
// embedded: shown as a tab of Setup, which draws the title and the Add button (addKey opens the form)
export default function Staff({ embedded = false, addKey = 0 }) {
  const biz = useBiz();
  const [editing, setEditing] = useState(null); // {} for a new person, or the staff row
  useEffect(() => { if (addKey) setEditing({}); }, [addKey]);
  const { data: staff, error, refetch } = useQuery({ queryKey: ['staff-all'], queryFn: () => api('/staff'), retry: 1 });
  const { data: outlets } = useQuery({ queryKey: ['outlets'], queryFn: () => api('/businesses/summary') });
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: () => api('/me'), staleTime: 5 * 60000 });
  const mine = useMemo(() => (outlets || []).filter((o) => o.isOwner), [outlets]);
  const nameOf = (id) => mine.find((o) => o._id === String(id))?.name || 'Removed outlet';
  const outletText = (s) => (s.allOutlets ? 'All outlets' : s.businessIds.map(nameOf).join(', '));

  if (biz.access && !biz.access.owner) {
    return (
      <section className="mx-list en-empty">
        <span className="en-empty-icon"><ShieldIcon size={26} /></span>
        <h2>Only the owner manages staff</h2>
        <p>You have {ACCESS_LEVELS[biz.access.level].name} access here. Ask the owner if you need more.</p>
      </section>
    );
  }
  if (error) {
    return (
      <section className="mx-list en-empty">
        <span className="en-empty-icon"><UsersIcon size={26} /></span>
        <h2>{error.status === 404 ? "Staff isn't available on the server yet" : "Couldn't load your staff"}</h2>
        <p>{error.status === 404 ? 'The server needs the latest update. Your data is safe.' : error.message}</p>
        <button type="button" className="btn" onClick={() => refetch()}>Try again</button>
      </section>
    );
  }
  if (!staff || !outlets) {
    return <div aria-hidden="true"><div className="card skeleton" style={{ minHeight: 90, marginBottom: 16 }} /><div className="card skeleton" style={{ minHeight: 260 }} /></div>;
  }

  return (
    <div className={`sf ${embedded ? 'embedded' : ''}`}>
      {!embedded && <div className="page-header home-header db-head">
        <div className="page-title-wrap">
          <p className="db-date">
            <span className="sf-sub-long">Who can open your outlets, and what they can do</span>
            <span className="sf-sub-short">{staff.length} {staff.length === 1 ? 'person' : 'people'} · {mine.length} {mine.length === 1 ? 'outlet' : 'outlets'}</span>
          </p>
          <h1 className="db-hello">Staff</h1>
        </div>
        <button type="button" className="btn sf-add-btn" onClick={() => setEditing({})}>
          <PlusIcon size={16} /> <span className="sf-add-long">Add staff</span><span className="sf-add-short">Add</span>
        </button>
      </div>}

      <section className="sf-levels" aria-label="Access levels">
        {ACCESS_LEVELS.map((l, i) => (
          <div key={l.name} className="sf-level">
            <span className="sf-level-top">
              <span className={`sf-pill ${l.tone}`}>{l.name}</span>
              <b>{staff.filter((s) => s.level === i).length}</b>
            </span>
            <span className="sf-level-text">{l.short}</span>
          </div>
        ))}
      </section>

      <section className="mx-list sf-list" aria-label="Staff list">
        <div className="mx-table-wrap">
          <table className="mx-table sf-table">
            <thead>
              <tr><th>Person</th><th>Outlets</th><th>Can do</th><th>Added</th><th className="right">Actions</th></tr>
            </thead>
            <tbody>
              <tr className="sf-owner">
                <td>
                  <span className="sf-who">
                    <span className="sf-av violet">{initials(me?.name)}</span>
                    <span><span className="sf-name-row"><b>{me?.name || 'You'}</b><span className="sf-tag">You · Owner</span></span><span className="sf-phone">{fmtPhone(me?.phone)}</span></span>
                  </span>
                </td>
                <td>All outlets</td>
                <td><span className="sf-pill violet">Owner</span></td>
                <td className="muted">—</td>
                <td className="right muted">Everything</td>
              </tr>
              {staff.map((s, i) => (
                <tr key={s._id}>
                  <td>
                    <span className="sf-who">
                      <span className={`sf-av ${TONES[i % TONES.length]}`}>{initials(s.name || s.phone)}</span>
                      <span>
                        <span className="sf-name-row"><b>{s.name || fmtPhone(s.phone)}</b>{!s.joined && <span className="sf-tag amber">Not signed up yet</span>}</span>
                        <span className="sf-phone">{fmtPhone(s.phone)}</span>
                      </span>
                    </span>
                  </td>
                  <td className="sf-outlets">{outletText(s)}</td>
                  <td><span className={`sf-pill ${ACCESS_LEVELS[s.level].tone}`}>{ACCESS_LEVELS[s.level].name}</span></td>
                  <td className="muted">{added(s.createdAt)}</td>
                  <td className="right">
                    <StaffActions s={s} outletText={outletText(s)} onEdit={() => setEditing(s)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="sf-cards">
          {staff.map((s, i) => (
            <article key={s._id} className="sf-card">
              <div className="sf-card-top">
                <span className={`sf-av ${TONES[i % TONES.length]}`}>{initials(s.name || s.phone)}</span>
                <span className="sf-card-who"><b>{s.name || fmtPhone(s.phone)}</b><span className="sf-phone">{fmtPhone(s.phone)}</span></span>
                <span className={`sf-pill ${ACCESS_LEVELS[s.level].tone}`}>{ACCESS_LEVELS[s.level].name}</span>
              </div>
              <dl className="mx2-fields">
                <div><dt>Outlets</dt><dd>{outletText(s)}</dd></div>
                <div className="right"><dt>Added</dt><dd>{added(s.createdAt)}</dd></div>
              </dl>
              {!s.joined && (
                <p className="sf-pending">Not signed up yet · <a href={waLink('91' + s.phone, inviteText(s.name, outletText(s)))} target="_blank" rel="noreferrer">Send invite again</a></p>
              )}
              <StaffActions s={s} outletText={outletText(s)} onEdit={() => setEditing(s)} card />
            </article>
          ))}
          {staff.length === 0 && <p className="sf-none">No staff yet. Add someone to let them record payments for you.</p>}
        </div>
        {staff.length === 0 && <p className="sf-none sf-none-web">No staff yet. Add someone to let them record payments or look up members for you.</p>}
      </section>
      <p className="sf-foot">Only you can change the UPI ID, add or remove staff, and delete an outlet — whatever access you give.</p>

      <AnimatePresence>
        {editing && <StaffModal row={editing.phone ? editing : null} outlets={mine} current={biz} onClose={() => setEditing(null)} />}
      </AnimatePresence>
    </div>
  );
}

function StaffActions({ s, outletText, onEdit, card }) {
  const qc = useQueryClient();
  const remove = useMutation({
    mutationFn: () => api(`/staff/${s._id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff-all'] }); qc.invalidateQueries({ queryKey: ['outlets'] }); },
  });
  const ask = async () => {
    if (await confirmAction({
      title: `Remove ${s.name || fmtPhone(s.phone)}?`,
      message: `They can no longer open ${outletText}. Payments they recorded stay.`,
      confirmText: 'Remove', danger: true,
    })) remove.mutate();
  };
  return (
    <span className={card ? 'sf-card-actions' : 'sf-actions'}>
      <button type="button" className="btn-secondary sf-edit" onClick={onEdit}>Change access</button>
      <button type="button" className="btn-secondary sf-remove" onClick={ask} disabled={remove.isPending}>Remove</button>
      {remove.error && <span className="error" role="alert">{remove.error.message}</span>}
    </span>
  );
}

function StaffModal({ row, outlets, current, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(() => ({
    phone: row?.phone || '',
    name: row?.name || '',
    allOutlets: row ? row.allOutlets : false,
    businessIds: row ? row.businessIds.map(String) : [current._id],
    level: row ? row.level : 1,
  }));
  const [sentInvite, setSentInvite] = useState(null);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const chosen = form.allOutlets ? ['all your outlets'] : outlets.filter((o) => form.businessIds.includes(o._id)).map((o) => o.name);
  const who = (form.name || '').trim().split(/\s+/)[0] || 'They';
  const toggle = (id) => setForm((f) => ({
    ...f, allOutlets: false,
    businessIds: f.businessIds.includes(id) ? f.businessIds.filter((x) => x !== id) : [...f.businessIds, id],
  }));
  const digits = form.phone.replace(/\D/g, '').slice(-10);
  const ready = (row || digits.length === 10) && chosen.length > 0;

  const save = useMutation({
    mutationFn: () => {
      const body = { name: form.name, level: form.level, allOutlets: form.allOutlets, businessIds: form.allOutlets ? [] : form.businessIds };
      return row ? api(`/staff/${row._id}`, { method: 'PATCH', body }) : api('/staff', { method: 'POST', body: { ...body, phone: digits } });
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['staff-all'] });
      qc.invalidateQueries({ queryKey: ['outlets'] });
      if (!row && !saved.joined) setSentInvite(saved); else onClose();
    },
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.18 }}
        className="modal-content sf-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sf-title"
        onClick={(e) => e.stopPropagation()}>
        <div className="form-header" style={{ marginBottom: 16 }}>
          <div className="form-title"><UsersIcon size={18} style={{ color: 'var(--primary)' }} /><span id="sf-title">{row ? `Change access · ${row.name || fmtPhone(row.phone)}` : 'Add staff'}</span></div>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><XIcon size={14} /></button>
        </div>

        {sentInvite ? (
          <div className="sf-invite">
            <span className="en-empty-icon"><CheckIcon size={24} /></span>
            <h3>{sentInvite.name || fmtPhone(sentInvite.phone)} is added</h3>
            <p>They don't have an account yet. Send them the invite on WhatsApp — once they sign up with {fmtPhone(sentInvite.phone)}, they'll see {chosen.join(', ')}.</p>
            <div className="en-actions">
              <span style={{ flex: 1 }} />
              <button type="button" className="btn-secondary" onClick={onClose}>Later</button>
              <a className="btn sf-wa" href={waLink('91' + sentInvite.phone, inviteText(sentInvite.name, chosen.join(', ')))} target="_blank" rel="noreferrer" onClick={onClose}>
                <WhatsAppIcon size={15} /> Send invite
              </a>
            </div>
          </div>
        ) : (
          <form className="en-form" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            <div className="form-grid two-col">
              <Field label="Mobile number *">
                <span className="sf-phone-input">
                  <span>+91</span>
                  <input type="tel" inputMode="numeric" required={!row} disabled={!!row} autoFocus={!row} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="10-digit mobile" />
                </span>
              </Field>
              <Field label="Name">
                <input value={form.name} maxLength={60} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Their name" />
              </Field>
            </div>
            {!row && <p className="sf-hint">They sign in with this number. No account yet? You can send them an invite on WhatsApp next.</p>}

            <fieldset className="en-fieldset">
              <legend>Which outlets?</legend>
              <div className="en-pills">
                <button type="button" aria-pressed={form.allOutlets} className={`en-choice ${form.allOutlets ? 'on' : ''}`} onClick={() => setForm({ ...form, allOutlets: !form.allOutlets })}>
                  {form.allOutlets && <CheckIcon size={13} />} All outlets, now and later
                </button>
                {outlets.map((o) => {
                  const on = !form.allOutlets && form.businessIds.includes(o._id);
                  return (
                    <button key={o._id} type="button" aria-pressed={on} className={`en-choice ${on ? 'on' : ''}`} onClick={() => toggle(o._id)}>
                      {on && <CheckIcon size={13} />} {o.name}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="en-fieldset">
              <legend>What can they do?</legend>
              <div className="sf-pick" role="radiogroup">
                {ACCESS_LEVELS.map((l, i) => (
                  <button key={l.name} type="button" role="radio" aria-checked={form.level === i} className={`sf-pick-row ${form.level === i ? 'on' : ''}`} onClick={() => setForm({ ...form, level: i })}>
                    <span className="sf-radio" aria-hidden="true"><i /></span>
                    <span><b>{l.name}</b><span>{l.long}</span></span>
                  </button>
                ))}
              </div>
            </fieldset>

            <p className="sf-summary" aria-live="polite">
              {chosen.length ? `${who} can ${ACCESS_LEVELS[form.level].verb} in ${chosen.join(', ')}.` : 'Pick at least one outlet.'}
            </p>
            {save.error && <p className="error" role="alert">{save.error.message}</p>}
            <div className="en-actions">
              <span style={{ flex: 1 }} />
              <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn" disabled={save.isPending || !ready}>{save.isPending ? 'Saving…' : row ? 'Save' : 'Add staff'}</button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}
