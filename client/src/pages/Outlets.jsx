import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { api, rupees } from '../api.js';
import { useBiz } from '../contexts.js';
import { confirmAction } from '../confirm.jsx';
import { Field, PlusIcon, XIcon, BuildingIcon, UsersIcon, RupeeIcon, CheckCircleIcon, EditIcon, TrashIcon } from '../ui.jsx';

const KINDS = [
  { key: 'gym', label: 'Gym' },
  { key: 'hostel', label: 'Hostel / PG' },
  { key: 'mess', label: 'Mess' },
  { key: 'tuition', label: 'Tuition' },
];
const kindLabel = (t) => ({ gym: 'Gym', hostel: 'Hostel', mess: 'Mess', tuition: 'Tuition' }[t] || 'Business');
const TONES = ['violet', 'blue', 'pink', 'green', 'orange'];
const initials = (name) => (name || '?').trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
const roleOf = (o) => (o.isOwner ? (o.staffCount ? `${o.staffCount} staff` : 'Owner') : 'You are staff');

// switching outlet reloads the app so every page reads the new business
const openOutlet = (id, path = '/') => { localStorage.setItem('bizId', id); window.location.assign(path); };

// Every branch the user can open, with its numbers, and a way to add, rename or remove one.
// embedded: shown as a tab of Setup, which draws the title and the Add button (addKey opens the form)
export default function Outlets({ embedded = false, addKey = 0 }) {
  const biz = useBiz();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState(null);
  useEffect(() => { if (addKey) setAdding(true); }, [addKey]);
  const { data: outlets, error, refetch } = useQuery({ queryKey: ['outlets'], queryFn: () => api('/businesses/summary'), retry: 1 });
  const month = new Date().toLocaleDateString('en-IN', { month: 'short' });

  const remove = useMutation({
    mutationFn: (o) => api(`/businesses/${o._id}`, { method: 'DELETE' }),
    onSuccess: (_, o) => {
      if (o._id === biz._id) {
        const next = outlets.find((x) => x._id !== o._id);
        openOutlet(next?._id || '', '/outlets');
        return;
      }
      qc.invalidateQueries({ queryKey: ['outlets'] });
      qc.invalidateQueries({ queryKey: ['businesses'] });
    },
  });
  const askDelete = async (o) => {
    const ok = await confirmAction({
      title: `Delete ${o.name}?`,
      message: `All of its ${o.active ? `${o.active} active members, ` : ''}payments, dues and plans are removed for good. Your other outlets are not touched.`,
      confirmText: 'Delete outlet',
      danger: true,
    });
    if (ok) remove.mutate(o);
  };

  if (error) {
    return (
      <section className="mx-list en-empty">
        <span className="en-empty-icon"><BuildingIcon size={26} /></span>
        <h2>{error.status === 404 ? "Outlets isn't available on the server yet" : "Couldn't load your outlets"}</h2>
        <p>{error.status === 404 ? 'The server needs the latest update. Your data is safe.' : error.message}</p>
        <button type="button" className="btn" onClick={() => refetch()}>Try again</button>
      </section>
    );
  }
  if (!outlets) {
    return <div aria-hidden="true"><div className="card skeleton" style={{ minHeight: 90, marginBottom: 16 }} /><div className="card skeleton" style={{ minHeight: 260 }} /></div>;
  }

  const sum = (k) => outlets.reduce((n, o) => n + (o[k] || 0), 0);
  const owe = sum('toCollect');
  const totals = [
    { id: 'n', label: 'Outlets', value: outlets.length, icon: BuildingIcon, tone: 'violet' },
    { id: 'a', label: 'Active members', value: sum('active'), icon: UsersIcon, tone: 'blue' },
    { id: 'o', label: 'To collect · all outlets', value: owe ? rupees(owe) : 'All paid', icon: RupeeIcon, tone: owe ? 'red' : 'green', ink: owe ? 'red' : 'green' },
    { id: 'c', label: `Collected · ${month}`, value: rupees(sum('collectedThisMonth')), icon: CheckCircleIcon, tone: 'green', ink: 'green' },
  ];
  const canDeleteAny = outlets.length > 1;

  return (
    <div className={`ol ${embedded ? 'embedded' : ''}`}>
      {!embedded && <div className="page-header home-header db-head">
        <div className="page-title-wrap">
          <p className="db-date">
            <span className="ol-sub-long">Your branches · switch, add or manage</span>
            <span className="ol-sub-short">{outlets.length} {outlets.length === 1 ? 'branch' : 'branches'}{owe ? ` · ${rupees(owe)} to collect` : ''}</span>
          </p>
          <h1 className="db-hello">Outlets</h1>
        </div>
        <button type="button" className="btn ol-add-btn" onClick={() => setAdding(true)}>
          <PlusIcon size={16} /> <span className="ol-add-long">Add outlet</span><span className="ol-add-short">Add</span>
        </button>
      </div>}

      <section className="db-today ol-totals" aria-label="All outlets together">
        {totals.map((t) => (
          <div key={t.id} className={`db-today-card ol-total ol-total-${t.id}`}>
            <span className={`db-today-icon ${t.tone}`}><t.icon size={17} /></span>
            <span className="db-today-text">
              <span className="db-label">{t.label}</span>
              <b className={t.ink || ''}>{t.value}</b>
            </span>
          </div>
        ))}
      </section>

      <section className="ol-grid" aria-label="Outlets">
        {outlets.map((o, i) => {
          const current = o._id === biz._id;
          return (
            <article key={o._id} className={`ol-card ${current ? 'current' : ''}`}>
              <div className="ol-card-top">
                <span className={`ol-av ${TONES[i % TONES.length]}`} aria-hidden="true">{initials(o.name)}</span>
                <span className="ol-who">
                  <span className="ol-name-row">
                    <b className="ol-name">{o.name}</b>
                    {current && <span className="ol-now">Open now</span>}
                    {o.status === 'suspended' && <span className="ol-paused">Paused</span>}
                  </span>
                  <span className="ol-kind">{kindLabel(o.type)} · {roleOf(o)}</span>
                </span>
                {o.isOwner && (
                  <MoreMenu
                    name={o.name}
                    items={[
                      { label: 'Rename', icon: EditIcon, onClick: () => setRenaming(o) },
                      canDeleteAny && { label: 'Delete outlet', icon: TrashIcon, danger: true, onClick: () => askDelete(o) },
                    ].filter(Boolean)}
                  />
                )}
              </div>
              <dl className="ol-stats">
                <div><dt>Active</dt><dd>{o.active}</dd></div>
                <div><dt>To collect</dt><dd className={o.toCollect ? 'red' : 'green'}>{o.toCollect ? rupees(o.toCollect) : 'All paid'}</dd></div>
                <div><dt>Collected · {month}</dt><dd className="green">{rupees(o.collectedThisMonth)}</dd></div>
              </dl>
              <div className="ol-actions">
                {current
                  ? <button type="button" className="btn-secondary ol-open" onClick={() => navigate('/')}>Go to Collect</button>
                  : <button type="button" className="btn ol-open" onClick={() => openOutlet(o._id)}>Open this outlet</button>}
                {o.isOwner && <button type="button" className="btn-secondary ol-rename" onClick={() => setRenaming(o)}>Rename</button>}
              </div>
            </article>
          );
        })}
        <button type="button" className="ol-new" onClick={() => setAdding(true)}>
          <span className="ol-new-icon" aria-hidden="true"><PlusIcon size={20} /></span>
          <b>Add another outlet</b>
          <span>A new branch with its own members and money</span>
        </button>
      </section>
      {remove.error && <p className="error" role="alert" style={{ marginTop: 12 }}>{remove.error.message}</p>}

      <AnimatePresence>
        {adding && <AddOutletModal current={biz} canCopy={!!outlets.find((o) => o._id === biz._id)?.isOwner} onClose={() => setAdding(false)} />}
        {renaming && <RenameModal outlet={renaming} onClose={() => setRenaming(null)} />}
      </AnimatePresence>
    </div>
  );
}

// small ⋯ menu for rename / delete
function MoreMenu({ name, items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    ref.current?.querySelector('[role="menuitem"]')?.focus();
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return (
    <div className="ol-more" ref={ref}>
      <button type="button" className="ol-more-btn" aria-label={`More actions for ${name}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
      </button>
      {open && (
        <div className="ol-more-list" role="menu">
          {items.map((it) => (
            <button key={it.label} type="button" role="menuitem" className={it.danger ? 'danger' : ''} onClick={() => { setOpen(false); it.onClick(); }}>
              <it.icon size={14} /> {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Dialog({ title, onClose, children, id }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.18 }}
        className="modal-content ol-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        onClick={(e) => e.stopPropagation()}>
        <div className="form-header" style={{ marginBottom: 16 }}>
          <div className="form-title"><BuildingIcon size={18} style={{ color: 'var(--primary)' }} /><span id={id}>{title}</span></div>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><XIcon size={14} /></button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

function AddOutletModal({ current, canCopy, onClose }) {
  const [form, setForm] = useState({ name: '', type: current.type, copy: canCopy });
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  const save = useMutation({
    mutationFn: () => api('/businesses', { method: 'POST', body: { name: form.name.trim(), type: form.type, copyFrom: form.copy ? current._id : undefined } }),
    onSuccess: (b) => openOutlet(b._id),
  });
  return (
    <Dialog title="Add an outlet" id="ol-add-title" onClose={onClose}>
      <form className="en-form" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <Field label="Outlet name *">
          <input required autoFocus maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={`e.g. ${current.name} – Second branch`} />
        </Field>
        {/* a new outlet is the same kind of business as this one: no type to pick */}
        <p className="ol-type-note">
          <span>Type</span> <b>{KINDS.find((k) => k.key === current.type)?.label || kindLabel(current.type)}</b> · same as {current.name}
        </p>
        {canCopy && (
          <label className="ol-copy">
            <input type="checkbox" checked={form.copy} onChange={(e) => setForm({ ...form, copy: e.target.checked })} />
            <span>
              <b>Copy plans and batches from {current.name}</b>
              <span>Members and money are not copied</span>
            </span>
          </label>
        )}
        {save.error && <p className="error" role="alert">{save.error.message}</p>}
        <div className="en-actions">
          <span style={{ flex: 1 }} />
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn" disabled={save.isPending || !form.name.trim()}>{save.isPending ? 'Adding…' : 'Add and open it'}</button>
        </div>
      </form>
    </Dialog>
  );
}

function RenameModal({ outlet, onClose }) {
  const qc = useQueryClient();
  const [name, setName] = useState(outlet.name);
  const save = useMutation({
    mutationFn: () => api(`/businesses/${outlet._id}`, { method: 'PATCH', body: { name: name.trim() } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['outlets'] });
      qc.invalidateQueries({ queryKey: ['businesses'] });
      onClose();
    },
  });
  return (
    <Dialog title="Rename outlet" id="ol-rename-title" onClose={onClose}>
      <form className="en-form" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <Field label="Outlet name *">
          <input required autoFocus maxLength={80} value={name} onChange={(e) => setName(e.target.value)} onFocus={(e) => e.target.select()} />
        </Field>
        {save.error && <p className="error" role="alert">{save.error.message}</p>}
        <div className="en-actions">
          <span style={{ flex: 1 }} />
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn" disabled={save.isPending || !name.trim() || name.trim() === outlet.name}>{save.isPending ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Dialog>
  );
}
