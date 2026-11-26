import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { api, rupees, can, EDIT, ADD, DELETE, download } from '../api.js';
import { confirmAction } from '../confirm.jsx';
import { useBiz } from '../contexts.js';
import { words } from '../wording.js';
import HostelProperty from './HostelProperty.jsx';
import Outlets from './Outlets.jsx';
import Staff from './Staff.jsx';
import { Field, PlusIcon, XIcon, CreditCardIcon, BuildingIcon, CheckIcon, UsersIcon, SettingsIcon, EditIcon, AlertIcon, TagIcon, ActivityIcon, SparklesIcon, TrashIcon, SearchIcon, Avatar, DownloadIcon } from '../ui.jsx';
import FilterSheet, { FilterButton } from '../FilterSheet.jsx';

const CYCLES = [
  [7, '7 days (weekly)'], [15, '15 days (fortnightly)'], [30, '30 days (monthly)'], [60, '60 days (2 months)'],
  [90, '90 days (3 months)'], [180, '180 days (6 months)'], [365, '365 days (yearly)'],
];
const cycleWords = (d) => ({ 7: 'week', 15: '15 days', 30: 'month', 31: 'month', 60: '2 months', 90: '3 months', 91: '3 months', 180: '6 months', 182: '6 months', 365: 'year', 360: 'year' }[d] || `${d} days`);
// "6 month plan" billed every 30 days is almost always a typo that overcharges members
const impliedDays = (name) => {
  const n = String(name || '').toLowerCase();
  const m = n.match(/(\d+)\s*(mo|mon|month|months|moth|mth)\b/);
  if (m) return Number(m[1]) * 30;
  if (/\b(half[- ]?year|half[- ]?yearly)\b/.test(n)) return 180;
  if (/\b(quarter|quarterly)\b/.test(n)) return 90;
  if (/\b(year|yearly|annual|annually)\b/.test(n)) return 365;
  if (/\b(week|weekly)\b/.test(n)) return 7;
  return null;
};
const mismatch = (p) => { const d = impliedDays(p.name); return d && Math.abs(d - p.cycleDays) > 5 ? d : null; };
const natural = (x, y) => String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: 'base' });

const TABS = ['plans', 'outlets', 'staff'];
// what a business sells: memberships bill every cycle (Setup); the rest are charged once (the Sales page)
export const KINDS = {
  membership: { label: 'Memberships', hint: 'Billed every cycle', icon: CreditCardIcon, tone: 'green', add: 'Add plan' },
  pt: { label: 'Personal training', hint: 'Session packs, charged once', icon: ActivityIcon, tone: 'blue', add: 'Add PT pack', example: 'e.g. 12 sessions · ₹6,000', detail: 'e.g. 12 sessions, use within 45 days', gymOnly: true },
  service: { label: 'Services', hint: 'Diet plan, locker, laundry…', icon: SparklesIcon, tone: 'pink', add: 'Add service', example: 'e.g. Diet plan · ₹1,500', detail: 'e.g. one-time consultation' },
  product: { label: 'Products', hint: 'Supplements, merch, snacks', icon: TagIcon, tone: 'amber', add: 'Add product', example: 'e.g. Whey protein 1 kg · ₹2,800', detail: 'e.g. chocolate flavour' },
};

// Plans, outlets and staff in one place: one sidebar item, three tabs.
export default function Setup() {
  const biz = useBiz();
  const w = words(biz.type);
  const isOwner = !biz.access || biz.access.owner;
  const [params, setParams] = useSearchParams();
  const tabs = isOwner ? TABS : TABS.filter((t) => t !== 'staff');
  const tab = tabs.includes(params.get('tab')) ? params.get('tab') : 'plans';
  const openTab = (t) => setParams((p) => { p.set('tab', t); return p; }, { replace: true });
  const [addKey, setAddKey] = useState({ plans: 0, outlets: 0, staff: 0 }); // bump to open that tab's add form

  const { data: plans } = useQuery({ queryKey: ['plans', biz._id], queryFn: () => api(`/businesses/${biz._id}/plans`) });
  const { data: groups } = useQuery({ queryKey: ['groups', biz._id], queryFn: () => api(`/businesses/${biz._id}/groups`) });
  const { data: outlets } = useQuery({ queryKey: ['outlets'], queryFn: () => api('/businesses/summary') });
  const { data: staff } = useQuery({ queryKey: ['staff-all'], queryFn: () => api('/staff'), enabled: isOwner });

  const n = { plans: plans?.length, groups: groups?.length, outlets: outlets?.length, staff: staff?.length };
  const notJoined = (staff || []).filter((s) => !s.joined).length;
  const subtitle = [
    n.plans != null && `${n.plans} ${n.plans === 1 ? 'plan' : 'plans'}`,
    n.groups ? `${n.groups} ${w.group.toLowerCase()}${n.groups === 1 ? '' : (w.group.endsWith('ch') ? 'es' : 's')}` : null,
    n.outlets != null && `${n.outlets} ${n.outlets === 1 ? 'outlet' : 'outlets'}`,
    isOwner && n.staff != null && `${n.staff} staff`,
  ].filter(Boolean).join(' · ');

  const addLabel = { plans: `Add ${w.plan.toLowerCase().replace('membership ', '')}`, outlets: 'Add outlet', staff: 'Add staff' }[tab];
  const canAdd = tab === 'plans' ? can(biz, EDIT) : tab === 'staff' ? isOwner : true;

  const tiles = [
    { id: 'plans', icon: CreditCardIcon, tone: 'green', label: 'Plans', value: n.plans ?? '…', note: n.groups ? `${n.groups} ${(n.groups === 1 ? w.group : w.groups.split(' ')[0]).toLowerCase()}` : biz.type === 'hostel' ? 'add your buildings first' : `${w.groups.split(' ')[0]} optional` },
    { id: 'outlets', icon: BuildingIcon, tone: 'violet', label: 'Outlets', value: n.outlets ?? '…', note: `${biz.name} open now` },
    isOwner && { id: 'staff', icon: UsersIcon, tone: 'blue', label: 'Staff', value: n.staff ?? '…', note: notJoined ? `${notJoined} not signed up yet` : 'who can do what' },
  ].filter(Boolean);

  return (
    <div className="su">
      <div className="page-header home-header db-head">
        <div className="page-title-wrap">
          <p className="db-date">{subtitle || 'Plans, outlets and staff'}</p>
          <h1 className="db-hello">Setup</h1>
        </div>
        <div className="su-head-actions">
          {canAdd && (
            <button type="button" className="btn su-add" onClick={() => setAddKey((k) => ({ ...k, [tab]: k[tab] + 1 }))}>
              <PlusIcon size={16} /> {addLabel}
            </button>
          )}
        </div>
      </div>

      <section className="db-today su-tiles" aria-label="Areas">
        {tiles.map((t) => (
          <button key={t.id} type="button" className={`db-today-card mx2-card-btn ${tab === t.id ? 'on' : ''}`} aria-pressed={tab === t.id} onClick={() => openTab(t.id)}>
            <span className={`db-today-icon ${t.tone}`}><t.icon size={17} /></span>
            <span className="db-today-text"><span className="db-label">{t.label}</span><b>{t.value}</b><span className="su-note">{t.note}</span></span>
          </button>
        ))}
        <Link to="/settings?tab=business" className="db-today-card mx2-card-btn su-settings">
          <span className="db-today-icon"><SettingsIcon size={17} /></span>
          <span className="db-today-text"><span className="db-label">Business settings</span><b>→</b><span className="su-note">UPI, reminders, attendance</span></span>
        </Link>
      </section>

      <div className="db-tabs su-tabs" role="tablist" aria-label="Setup">
        {tabs.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={`db-tab ${tab === t ? 'on' : ''}`} onClick={() => openTab(t)}>
            {t === 'plans' ? <><span className="su-tab-long">{biz.type === 'hostel' ? 'Rooms & plans' : `Plans & ${w.groups.split(' ')[0].toLowerCase()}`}</span><span className="su-tab-short">{biz.type === 'hostel' ? 'Rooms' : 'Plans'}</span></> : t === 'outlets' ? 'Outlets' : 'Staff'}
            {n[t] > 0 && <span className="db-tab-count">{n[t]}</span>}
          </button>
        ))}
      </div>

      {tab === 'plans' && (
        <>
          <PlansTab biz={biz} plans={plans} groups={groups} addKey={addKey.plans} />
          {biz.salesEnabled !== false && <Link to="/sales?view=items" className="su-to-sales">
            <span className="db-today-icon amber"><TagIcon size={16} /></span>
            <span><b>Products, PT packs and services</b><span>Things charged once now live on the Sales page</span></span>
            <span className="st-go">Sales ›</span>
          </Link>}
        </>
      )}
      {tab === 'outlets' && <Outlets embedded addKey={addKey.outlets} />}
      {tab === 'staff' && isOwner && <Staff embedded addKey={addKey.staff} />}
    </div>
  );
}

function PlansTab({ biz, plans, groups, addKey }) {
  const w = words(biz.type);
  const qc = useQueryClient();
  const [editing, setEditing] = useState(null); // {} new plan, or the plan
  const [addingGroup, setAddingGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const canEdit = can(biz, EDIT);
  useEffect(() => { if (addKey) setEditing({}); }, [addKey]);
  const { data: members = [] } = useQuery({ queryKey: ['members', biz._id], queryFn: () => api(`/businesses/${biz._id}/members`) });
  const active = members.filter((m) => m.status === 'active');
  const onPlan = (p) => active.filter((m) => m.planName === p.name).length;
  const inGroup = (g) => active.filter((m) => (m.groupId?._id || m.groupId) === g._id).length;

  const addGroup = useMutation({
    mutationFn: () => api(`/businesses/${biz._id}/groups`, { method: 'POST', body: { name: groupName.trim() } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['groups', biz._id] }); setGroupName(''); setAddingGroup(false); },
  });

  const sorted = [...(plans || [])].sort((x, y) => x.amount - y.amount || natural(x.name, y.name));

  return (
    <>
      {biz.type === 'hostel' && <HostelProperty biz={biz} step={1} />}

      {!plans ? <div className="card skeleton" style={{ minHeight: 160 }} aria-hidden="true" /> : (
        <section className="su-plans" aria-label={w.plans}>
          {sorted.map((p) => {
            const implied = mismatch(p);
            return (
              <article key={p._id} className={`su-plan ${implied ? 'warn' : ''}`}>
                <div className="su-plan-top">
                  <span className="su-plan-name"><b>{p.name}</b><span>every {cycleWords(p.cycleDays)}</span></span>
                  {canEdit && <button type="button" className="ol-more-btn su-edit" aria-label={`Edit ${p.name}`} onClick={() => setEditing(p)}><EditIcon size={14} /></button>}
                </div>
                <b className="su-price">{rupees(p.amount)}<span> / {cycleWords(p.cycleDays)}</span></b>
                <div className="su-plan-foot">
                  <span>{onPlan(p)} {w.member}{onPlan(p) === 1 ? '' : 's'} on it</span>
                  {implied && (
                    <button type="button" className="su-warn" onClick={() => canEdit && setEditing(p)} disabled={!canEdit}>
                      <AlertIcon size={12} /> Name says {cycleWords(implied)}, bills every {cycleWords(p.cycleDays)}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
          {canEdit && (
            <button type="button" className="ol-new su-new" onClick={() => setEditing({})}>
              <span className="ol-new-icon" aria-hidden="true"><PlusIcon size={20} /></span>
              <b>Add {w.plan.toLowerCase()}</b>
              <span>e.g. {w.planExample}</span>
            </button>
          )}
          {!sorted.length && !canEdit && <p className="mr-empty">No {w.plans.toLowerCase()} yet. Ask the owner to add them.</p>}
        </section>
      )}

      {biz.type !== 'hostel' && (
        <section className="mr-box su-groups">
          <div className="mr-box-head">
            <h3>{w.groups} <span className="mr-dim">· optional</span></h3>
            {canEdit && !addingGroup && <button type="button" className="mr-link" onClick={() => setAddingGroup(true)}><PlusIcon size={13} /> Add {w.group.toLowerCase()}</button>}
          </div>
          {addingGroup && (
            <form className="su-group-form" onSubmit={(e) => { e.preventDefault(); if (groupName.trim()) addGroup.mutate(); }}>
              <input autoFocus required value={groupName} maxLength={60} onChange={(e) => setGroupName(e.target.value)} placeholder={w.groupPlaceholder} aria-label={`${w.group} name`} />
              <button type="submit" className="btn" disabled={addGroup.isPending || !groupName.trim()}><CheckIcon size={14} /> Save</button>
              <button type="button" className="btn-secondary" onClick={() => { setAddingGroup(false); setGroupName(''); }}>Cancel</button>
            </form>
          )}
          {addGroup.error && <p className="error" role="alert">{addGroup.error.message}</p>}
          {groups?.length ? (
            <div className="su-chips">
              {[...groups].sort((x, y) => natural(x.name, y.name)).map((g) => (
                <span key={g._id} className="su-chip">{g.name} <span className="mr-dim">· {inGroup(g)}</span></span>
              ))}
            </div>
          ) : !addingGroup && <p className="mr-empty">{w.groupsHint}</p>}
        </section>
      )}

      <AnimatePresence>
        {editing && <PlanModal biz={biz} plan={editing._id ? editing : null} members={editing._id ? onPlan(editing) : 0} onClose={() => setEditing(null)} />}
      </AnimatePresence>
    </>
  );
}

// PT packs, services or products: charged once when sold
export function CatalogueTab({ biz, kind, items, addKey, onSell }) {
  const K = KINDS[kind];
  const qc = useQueryClient();
  const [editing, setEditing] = useState(null);
  const canEdit = can(biz, EDIT);
  const canSell = can(biz, ADD);
  useEffect(() => { if (addKey) setEditing({}); }, [addKey]);
  const remove = useMutation({
    mutationFn: (i) => api(`/businesses/${biz._id}/catalogue/${i._id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['catalogue', biz._id] }),
  });
  const list = (items || []).filter((i) => i.kind === kind);
  if (!items) return <div className="card skeleton" style={{ minHeight: 160 }} aria-hidden="true" />;
  return (
    <>
      <section className="su-plans" aria-label={K.label}>
        {list.map((i) => (
          <article key={i._id} className="su-plan">
            <div className="su-plan-top">
              <span className="su-plan-name"><b>{i.name}</b><span>{[i.detail, kind === 'product' && (i.trackStock ? `${i.stock} in stock` : !i.detail && 'no stock tracking')].filter(Boolean).join(' · ') || 'charged once'}</span></span>
              {canEdit && <button type="button" className="ol-more-btn su-edit" aria-label={`Edit ${i.name}`} onClick={() => setEditing(i)}><EditIcon size={14} /></button>}
            </div>
            <b className="su-price">{rupees(i.price)}<span> {kind === 'product' ? 'each' : 'once'}</span></b>
            <div className="su-plan-foot">
              <span>{i.soldThisMonth ? `Sold ${i.soldThisMonth} this month` : 'Not sold this month'}</span>
              {i.trackStock && i.stock <= 2 && <span className="su-warn" style={{ cursor: 'default' }}>{i.stock === 0 ? 'Out of stock' : `Only ${i.stock} left`}</span>}
              {canSell && !(i.trackStock && i.stock === 0) && <button type="button" className="mr-link" onClick={() => onSell(i._id)}>Sell ›</button>}
            </div>
          </article>
        ))}
        {canEdit && (
          <button type="button" className="ol-new su-new" onClick={() => setEditing({})}>
            <span className="ol-new-icon" aria-hidden="true"><PlusIcon size={20} /></span>
            <b>{K.add}</b>
            <span>{K.example}</span>
          </button>
        )}
        {!list.length && !canEdit && <p className="mr-empty">Nothing here yet. Ask the owner to add {K.label.toLowerCase()}.</p>}
      </section>
      <AnimatePresence>
        {editing && (
          <ItemModal biz={biz} kind={kind} item={editing._id ? editing : null} onClose={() => setEditing(null)}
            onDelete={can(biz, DELETE) && editing._id ? async () => {
              const i = editing;
              if (await confirmAction({ title: `Remove ${i.name}?`, message: 'It leaves the catalogue. Past sales keep their name and price.', confirmText: 'Remove', danger: true })) { setEditing(null); remove.mutate(i); }
            } : null} />
        )}
      </AnimatePresence>
    </>
  );
}

function ItemModal({ biz, kind, item, onClose, onDelete }) {
  const K = KINDS[kind];
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: item?.name || '', price: item ? String(item.price) : '', cost: item?.cost != null ? String(item.cost) : '', detail: item?.detail || '', trackStock: item?.trackStock || false, stock: item ? String(item.stock ?? 0) : '' });
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  const save = useMutation({
    mutationFn: () => {
      const body = { kind, name: form.name.trim(), price: Number(form.price), cost: form.cost === '' ? null : Number(form.cost), detail: form.detail, trackStock: kind === 'product' && form.trackStock, stock: kind === 'product' && form.trackStock ? Number(form.stock || 0) : 0 };
      return item ? api(`/businesses/${biz._id}/catalogue/${item._id}`, { method: 'PATCH', body }) : api(`/businesses/${biz._id}/catalogue`, { method: 'POST', body });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['catalogue', biz._id] }); onClose(); },
  });
  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 12 }} transition={{ duration: 0.18 }}
        className="modal-content ol-modal" role="dialog" aria-modal="true" aria-labelledby="su-item-title" onClick={(e) => e.stopPropagation()}>
        <div className="form-header" style={{ marginBottom: 16 }}>
          <div className="form-title"><K.icon size={18} style={{ color: 'var(--primary)' }} /><span id="su-item-title">{item ? `Edit ${item.name}` : K.add}</span></div>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><XIcon size={14} /></button>
        </div>
        <form className="en-form" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <div className="form-grid two-col">
            <Field label="Name *"><input required autoFocus maxLength={60} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={K.example.replace('e.g. ', '').split(' · ')[0]} /></Field>
            <Field label={kind === 'product' ? 'Price each (₹) *' : 'Price (₹) *'}><input type="number" inputMode="decimal" min="1" required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></Field>
          </div>
          <Field label={kind === 'product' ? 'Cost price each (₹, optional)' : 'Cost to you (₹, optional)'}><input type="number" inputMode="decimal" min="0" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} placeholder="What you pay for it, to see profit" /></Field>
          {form.cost !== '' && Number(form.price) > 0 && <p className="sf-hint" style={{ margin: '-6px 0 0' }}>Profit {Number(form.price) - Number(form.cost) < 0 ? '−' : ''}{rupees(Math.abs(Number(form.price) - Number(form.cost)))} {kind === 'product' ? 'each' : 'per sale'} ({Math.round(((Number(form.price) - Number(form.cost)) / Number(form.price)) * 100)}% margin)</p>}
          <Field label="Details (optional)"><input maxLength={80} value={form.detail} onChange={(e) => setForm({ ...form, detail: e.target.value })} placeholder={K.detail} /></Field>
          {kind === 'product' && (
            <>
              <label className="ol-copy">
                <input type="checkbox" checked={form.trackStock} onChange={(e) => setForm({ ...form, trackStock: e.target.checked })} />
                <span><b>Keep count of stock</b><span>Each sale takes one off, and you'll see when it's running low</span></span>
              </label>
              {form.trackStock && <Field label="In stock now"><input type="number" inputMode="numeric" min="0" step="1" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} /></Field>}
            </>
          )}
          <p className="sf-hint" style={{ margin: 0 }}>{kind === 'pt' ? 'Charged once when sold. Session counting is not tracked yet.' : 'Charged once when sold, on the member\'s account.'}</p>
          {save.error && <p className="error" role="alert">{save.error.message}</p>}
          <div className="en-actions">
            {onDelete && <button type="button" className="icon-btn en-delete" onClick={onDelete} aria-label="Remove from catalogue" title="Remove"><TrashIcon size={15} /></button>}
            <span style={{ flex: 1 }} />
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn" disabled={save.isPending || !form.name.trim() || !(Number(form.price) > 0)}>{save.isPending ? 'Saving…' : item ? 'Save' : 'Add'}</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// What was sold: totals for a period, best sellers, and every sale (with undo for mistakes)
const SALE_PERIODS = [
  ['month', 'This month', () => { const n = new Date(); return [new Date(n.getFullYear(), n.getMonth(), 1), n]; }],
  ['last', 'Last month', () => { const n = new Date(); return [new Date(n.getFullYear(), n.getMonth() - 1, 1), new Date(n.getFullYear(), n.getMonth(), 0, 23, 59, 59, 999)]; }],
  ['year', 'This year', () => { const n = new Date(); return [new Date(n.getFullYear(), 0, 1), n]; }],
  ['all', 'All time', () => [null, new Date()]],
];
const KIND_SHORT = { pt: 'PT pack', service: 'Service', product: 'Product' };
const MODE_NAME = { cash: 'Cash', upi: 'UPI', other: 'Card / bank' };
const whenText = (at) => {
  const d = new Date(at); const now = new Date();
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return `Today ${time}`;
  if (d.toDateString() === new Date(now - 86400000).toDateString()) return `Yesterday ${time}`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', ...(d.getFullYear() !== now.getFullYear() && { year: 'numeric' }) });
};
const linesText = (items) => items.map((l) => (l.qty > 1 ? `${l.name} ×${l.qty}` : l.name)).join(', ');

export function SalesView({ biz }) {
  const qc = useQueryClient();
  const [period, setPeriod] = useState('month');
  const [q, setQ] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [part, setPart] = useState('history'); // 'history' | 'items'
  // phones: quick chips, plus type and how-paid in the filter sheet
  const [show, setShow] = useState('all'); // 'all' | 'unpaid' | 'items'
  const [kindF, setKindF] = useState('all');
  const [modeF, setModeF] = useState('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [from, to] = SALE_PERIODS.find((p) => p[0] === period)[2]();
  const qs = `${from ? `from=${from.toISOString()}&` : ''}to=${to.toISOString()}`;
  const { data, error } = useQuery({
    queryKey: ['sales', biz._id, period],
    queryFn: () => api(`/businesses/${biz._id}/sales?${qs}`),
    placeholderData: (prev) => prev,
  });
  const undo = useMutation({
    mutationFn: (x) => api(`/members/${x.memberId}/sales/${x._id}`, { method: 'DELETE' }),
    onSuccess: () => ['sales', 'catalogue', 'members', 'dashboard', 'report', 'member'].forEach((k) => qc.invalidateQueries({ queryKey: [k] })),
  });
  const askUndo = async (x) => {
    if (await confirmAction({
      title: `Undo this ${rupees(x.total)} sale?`,
      message: `${linesText(x.items)} to ${x.memberName}. The charge${x.paid ? ' and its payment are' : ' is'} removed and any stock goes back.`,
      confirmText: 'Undo sale', danger: true,
    })) undo.mutate(x);
  };

  if (error) return <p className="error" role="alert">{error.status === 404 ? 'Sales need the latest server update.' : error.message}</p>;
  if (!data) return <div className="card skeleton" style={{ minHeight: 220 }} aria-hidden="true" />;

  const t = data.totals;
  const pct = (a, b) => (b ? Math.round(((a - b) / b) * 100) : null);
  const change = t.prevRevenue != null ? pct(t.revenue, t.prevRevenue) : null;
  const cards = [
    { icon: TagIcon, tone: 'amber', label: 'Items sold', value: t.qty, note: `in ${t.count} sale${t.count === 1 ? '' : 's'}` },
    { icon: CreditCardIcon, tone: 'green', ink: 'green', label: 'Revenue', value: rupees(t.revenue), note: change == null ? (t.prevRevenue === 0 && t.revenue ? 'none the period before' : '—') : `${change >= 0 ? '▲' : '▼'} ${Math.abs(change)}% vs before` },
    { icon: ActivityIcon, tone: 'grey', label: 'Cost', value: t.cost == null ? '—' : rupees(t.cost), note: t.cost == null ? 'add cost prices to see it' : t.profitOn < t.revenue ? 'items with a cost price' : 'from your cost prices' },
    { icon: SparklesIcon, tone: 'violet', ink: 'violet', label: 'Profit', value: t.profit == null ? '—' : rupees(t.profit), note: t.profit == null ? 'needs cost prices' : `${Math.round((t.profit / t.profitOn) * 100)}% margin` },
    { icon: AlertIcon, tone: 'red', ink: t.unpaid ? 'red' : '', label: 'Not paid yet', value: rupees(t.unpaid), note: t.unpaid ? 'sold onto dues' : 'all sales paid' },
  ];
  const query = q.trim().toLowerCase();
  const sales = data.sales.filter((x) => !query || x.memberName.toLowerCase().includes(query) || linesText(x.items).toLowerCase().includes(query));
  const shown = showAll ? sales : sales.slice(0, 12);
  const canUndo = can(biz, DELETE);
  // phones
  const owing = (x) => !x.paid && x.stillOwed > 0;
  const phBase = sales.filter((x) => (kindF === 'all' || x.items.some((l) => l.kind === kindF)) && (modeF === 'all' || (modeF === 'dues' ? !x.paid : x.mode === modeF)));
  const phList = show === 'unpaid' ? phBase.filter(owing) : phBase;
  const phShown = showAll ? phList : phList.slice(0, 12);
  const phItems = data.byItem.filter((i) => kindF === 'all' || i.kind === kindF);
  const kindsSold = [...new Set(data.byItem.map((i) => i.kind))];
  const filtersOn = (kindF !== 'all') + (modeF !== 'all');
  const saleTag = (x) => x.paid
    ? { tone: 'paid', text: `Paid · ${MODE_NAME[x.mode] || 'Paid'}` }
    : x.stillOwed ? { tone: 'due', text: x.stillOwed < x.total ? `${rupees(x.stillOwed)} owed` : 'On dues' } : { tone: 'paid', text: 'Paid later' };

  return (
    <div className="sv">
      <div className="sv-periods" role="radiogroup" aria-label="Period">
        {SALE_PERIODS.map(([id, label]) => (
          <button key={id} type="button" role="radio" aria-checked={period === id} className={`en-choice ${period === id ? 'on' : ''}`} onClick={() => { setPeriod(id); setShowAll(false); }}>{label}</button>
        ))}
      </div>

      {/* phones: the four numbers in one slim strip */}
      <section className="mr-cards ph-strip sv-strip" aria-label="Totals">
        {[
          { label: 'Revenue', value: rupees(t.revenue), ink: 'green' },
          { label: 'Cost', value: t.cost == null ? '—' : rupees(t.cost), ink: '' },
          { label: 'Profit', value: t.profit == null ? '—' : rupees(t.profit), ink: 'violet' },
          { label: 'Not paid', value: rupees(t.unpaid), ink: t.unpaid ? 'red' : '' },
        ].map((c) => (
          <div key={c.label} className="mr-card">
            <span className="mr-card-main"><span className="mr-card-text"><span className="db-label">{c.label}</span><b className={c.ink}>{c.value}</b></span></span>
          </div>
        ))}
      </section>

      <section className="sv-totals" aria-label="Totals">
        {cards.map((c) => (
          <div key={c.label} className="db-today-card sv-total">
            <span className={`db-today-icon ${c.tone}`}><c.icon size={16} /></span>
            <span className="db-today-text"><span className="db-label">{c.label}</span><b className={c.ink || ''}>{c.value}</b><span className="su-note">{c.note}</span></span>
          </div>
        ))}
      </section>

      {!data.sales.length ? (
        <section className="mx-list en-empty">
          <span className="en-empty-icon"><TagIcon size={26} /></span>
          <h2>No sales {period === 'all' ? 'yet' : 'in this period'}</h2>
          <p>Sell from Collect, a member's page or the Items view. Every sale shows up here with what it earned.</p>
        </section>
      ) : (
        <>
        {/* phones: search + filter, chips, one line per sale — same as Money's Who paid */}
        <div className="ph-card sv-ph">
          <div className="who-search-row">
            <label className="mxp-search">
              <SearchIcon size={15} />
              <span className="sr-only">Search sales</span>
              <input type="search" placeholder="Member or item" value={q} onChange={(e) => setQ(e.target.value)} />
              {q && <button type="button" onClick={() => setQ('')} aria-label="Clear search"><XIcon size={14} /></button>}
            </label>
            <span className="who-filter-btn"><FilterButton on={filtersOn} onClick={() => setFiltersOpen(true)} /></span>
          </div>
          <div className="who-chips" role="group" aria-label="Show">
            {[['all', 'All', phBase.length], ['unpaid', 'Not paid', phBase.filter(owing).length], ['items', 'By item', phItems.length]].map(([id, label, n]) => (
              <button key={id} type="button" aria-pressed={show === id} className={show === id ? 'on' : ''} onClick={() => { setShow(id); setShowAll(false); }}>
                {label} <span>{n}</span>
              </button>
            ))}
          </div>

          {show === 'items' ? (
            <ul className="who-rows">
              {phItems.map((i) => (
                <li key={String(i.itemId)} className="who-row">
                  <span className="who-row-main">
                    <b>{i.name}</b>
                    <span className="who-row-tags">
                      <span className="who-tag none">{KIND_SHORT[i.kind]}</span>
                      {i.stock != null && <span className={`who-tag ${i.stock === 0 ? 'overdue' : i.stock <= 2 ? 'due' : 'paid'}`}>{i.stock === 0 ? 'Out of stock' : `${i.stock} left`}</span>}
                      <span className="who-row-plan">{i.qty} sold{i.removed ? ' · removed' : ''}</span>
                    </span>
                  </span>
                  <span className="who-row-amt">
                    <b>{rupees(i.revenue)}</b>
                    <span>{i.profit == null ? 'no cost price' : `${i.profit < 0 ? '−' : ''}${rupees(Math.abs(i.profit))} profit`}</span>
                  </span>
                </li>
              ))}
              {!phItems.length && <li className="who-empty"><b>Nothing sold of this type</b></li>}
            </ul>
          ) : (
            <ul className="who-rows">
              {phShown.map((x) => {
                const tag = saleTag(x);
                return (
                  <li key={x._id} className="who-row">
                    <Link to={`/members/${x.memberId}`} className="who-row-main">
                      <b>{x.memberName}</b>
                      <span className="who-row-tags">
                        <span className={`who-tag ${tag.tone}`}>{tag.text}</span>
                        <span className="who-row-plan">{linesText(x.items)}</span>
                      </span>
                    </Link>
                    <span className="who-row-amt">
                      <b className={owing(x) ? 'amber' : ''}>{rupees(x.total)}</b>
                      <span>{whenText(x.at)}</span>
                    </span>
                    {canUndo && <button type="button" className="sv-undo" aria-label={`Undo sale to ${x.memberName}`} title="Undo sale" onClick={() => askUndo(x)}><XIcon size={14} /></button>}
                  </li>
                );
              })}
              {!phList.length && (
                <li className="who-empty">
                  <b>{q ? `Nothing matches “${q}”` : show === 'unpaid' ? 'Every sale is paid' : 'No sales match'}</b>
                  <span>{q ? 'Try a member or item name.' : show === 'unpaid' ? 'Sales put on dues show up here.' : 'Try clearing the filters.'}</span>
                </li>
              )}
            </ul>
          )}

          <div className="sv-ph-foot">
            {show !== 'items' && <span>{phShown.length} of {phList.length}</span>}
            {show !== 'items' && phList.length > phShown.length && <button type="button" className="mr-link" onClick={() => setShowAll(true)}>Show all</button>}
            <button type="button" className="mr-link" onClick={() => download(`/businesses/${biz._id}/export/sales.csv?${qs}`, `${biz.name}-sales.csv`)}><DownloadIcon size={13} /> CSV</button>
          </div>
          {undo.error && <p className="error" role="alert">{undo.error.message}</p>}
        </div>
        <AnimatePresence>
          {filtersOpen && (
            <FilterSheet
              count={show === 'items' ? phItems.length : phList.length}
              noun={show === 'items' ? ['item', 'items'] : ['sale', 'sales']}
              onClose={() => setFiltersOpen(false)}
              onClear={() => { setKindF('all'); setModeF('all'); }}
              groups={[
                kindsSold.length > 1 && { label: 'Type', value: kindF, onPick: setKindF, options: [{ value: 'all', label: 'Everything' }, ...kindsSold.map((k) => ({ value: k, label: KINDS[k]?.label || k, count: sales.filter((x) => x.items.some((l) => l.kind === k)).length }))] },
                { label: 'Paid by', value: modeF, onPick: setModeF, options: [{ value: 'all', label: 'Any' }, { value: 'cash', label: 'Cash' }, { value: 'upi', label: 'UPI' }, { value: 'other', label: 'Card / bank' }, { value: 'dues', label: 'Put on dues' }] },
              ].filter(Boolean)}
            />
          )}
        </AnimatePresence>

        <section className="mr-box sv-box">
          {/* one box, two tabs: every sale, or totals per item */}
          <div className="sv-box-head">
            <div className="db-tabs sv-parts" role="tablist" aria-label="Show">
              <button type="button" role="tab" aria-selected={part === 'history'} className={`db-tab ${part === 'history' ? 'on' : ''}`} onClick={() => setPart('history')}>
                Sales history<span className="db-tab-count">{data.sales.length}</span>
              </button>
              <button type="button" role="tab" aria-selected={part === 'items'} className={`db-tab ${part === 'items' ? 'on' : ''}`} onClick={() => setPart('items')}>
                By item<span className="db-tab-count">{data.byItem.length}</span>
              </button>
            </div>
            {part === 'history' ? (
              <label className="mx-search sv-search">
                <SearchIcon size={14} />
                <span className="sr-only">Search sales</span>
                <input type="search" placeholder="Member or item" value={q} onChange={(e) => setQ(e.target.value)} />
              </label>
            ) : <span className="mr-dim sv-hint">best sellers first</span>}
          </div>
          {part === 'items' && (
          <div className="sv-items">
            <table className="mr-table sv-table">
              <thead><tr><th>Item</th><th>Sold</th><th>Revenue</th><th>Profit</th><th>Stock</th></tr></thead>
              <tbody>
                {data.byItem.map((i) => (
                  <tr key={String(i.itemId)}>
                    <td><b>{i.name}</b><span className="sv-kind">{KIND_SHORT[i.kind]}{i.removed ? ' · removed' : ''}</span></td>
                    <td>{i.qty}</td>
                    <td className="strong">{rupees(i.revenue)}</td>
                    <td className={i.profit == null ? 'dim' : i.profit < 0 ? 'red' : 'green'}>{i.profit == null ? '—' : `${i.profit < 0 ? '−' : ''}${rupees(Math.abs(i.profit))}`}</td>
                    <td className={i.stock == null ? 'dim' : i.stock === 0 ? 'red' : i.stock <= 2 ? 'amber' : ''}>{i.stock == null ? '—' : i.stock === 0 ? 'Out' : `${i.stock} left`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* phones: a short list */}
            <ul className="sv-items-list">
              {data.byItem.map((i) => (
                <li key={String(i.itemId)}><span><b>{i.name}</b> <span className="mr-dim">· {i.qty} sold{i.stock != null ? ` · ${i.stock === 0 ? 'out' : `${i.stock} left`}` : ''}</span></span><b>{rupees(i.revenue)}</b></li>
              ))}
            </ul>
          </div>
          )}

          {part === 'history' && (
          <div className="sv-history">
            <ul className="sv-sales">
              {shown.map((x) => (
                <li key={x._id} className="sv-sale">
                  <Link to={`/members/${x.memberId}`} className="sv-sale-who">
                    <Avatar name={x.memberName} />
                    <span><b>{x.memberName}</b><span>{linesText(x.items)}</span></span>
                  </Link>
                  <span className="sv-sale-amt"><b>{rupees(x.total)}</b><span>{whenText(x.at)}{x.soldBy ? ` · by ${x.soldBy}` : ''}</span></span>
                  <span className={`sv-status ${x.paid ? 'paid' : x.stillOwed ? 'due' : 'paid'}`}>
                    {x.paid ? `Paid · ${MODE_NAME[x.mode] || 'Paid'}` : x.stillOwed ? (x.stillOwed < x.total ? `${rupees(x.stillOwed)} owed` : 'On dues') : 'Paid later'}
                  </span>
                  {canUndo && <button type="button" className="mr-del" aria-label={`Undo sale to ${x.memberName}`} title="Undo sale" onClick={() => askUndo(x)}><XIcon size={14} /></button>}
                </li>
              ))}
              {!sales.length && <li className="at-empty">Nothing matches “{q}”.</li>}
            </ul>
            <div className="sv-foot">
              <span>Showing {shown.length} of {sales.length}</span>
              {sales.length > shown.length && <button type="button" className="mr-link" onClick={() => setShowAll(true)}>Show all</button>}
              <button type="button" className="mr-link" onClick={() => download(`/businesses/${biz._id}/export/sales.csv?${qs}`, `${biz.name}-sales.csv`)}>Download CSV</button>
            </div>
            {undo.error && <p className="error" role="alert" style={{ margin: '0 16px 12px' }}>{undo.error.message}</p>}
          </div>
          )}
        </section>
        </>
      )}
    </div>
  );
}

function PlanModal({ biz, plan, members, onClose }) {
  const w = words(biz.type);
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: plan?.name || '', amount: plan ? String(plan.amount) : '', cycleDays: plan?.cycleDays || 30 });
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  const save = useMutation({
    mutationFn: () => {
      const body = { name: form.name.trim(), amount: Number(form.amount), cycleDays: Number(form.cycleDays) };
      return plan
        ? api(`/businesses/${biz._id}/plans/${plan._id}`, { method: 'PATCH', body })
        : api(`/businesses/${biz._id}/plans`, { method: 'POST', body });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['plans', biz._id] }); qc.invalidateQueries({ queryKey: ['members', biz._id] }); onClose(); },
  });
  const implied = mismatch({ name: form.name, cycleDays: Number(form.cycleDays) });
  const options = CYCLES.some(([d]) => d === Number(form.cycleDays)) ? CYCLES : [...CYCLES, [Number(form.cycleDays), `${form.cycleDays} days`]];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 12 }} transition={{ duration: 0.18 }}
        className="modal-content ol-modal" role="dialog" aria-modal="true" aria-labelledby="su-plan-title" onClick={(e) => e.stopPropagation()}>
        <div className="form-header" style={{ marginBottom: 16 }}>
          <div className="form-title"><CreditCardIcon size={18} style={{ color: 'var(--primary)' }} /><span id="su-plan-title">{plan ? `Edit ${plan.name}` : `New ${w.plan.toLowerCase()}`}</span></div>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><XIcon size={14} /></button>
        </div>
        <form className="en-form" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <Field label="Plan name *">
            <input required autoFocus maxLength={60} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={w.planPlaceholder} />
          </Field>
          <div className="form-grid two-col">
            <Field label="Amount (₹) *">
              <input type="number" inputMode="decimal" min="1" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="1500" />
            </Field>
            <Field label="Bills every">
              <select value={form.cycleDays} onChange={(e) => setForm({ ...form, cycleDays: Number(e.target.value) })}>
                {options.map(([d, l]) => <option key={d} value={d}>{l}</option>)}
              </select>
            </Field>
          </div>
          {implied && <p className="su-warn-line"><AlertIcon size={13} /> The name says {cycleWords(implied)} but it bills every {cycleWords(Number(form.cycleDays))}. Members would pay {rupees(Number(form.amount) || 0)} every {cycleWords(Number(form.cycleDays))}.</p>}
          {plan && members > 0 && <p className="sf-hint" style={{ margin: 0 }}>{members} {w.member}{members === 1 ? '' : 's'} on this plan. Bills already made stay as they are; their next bills use the new price and cycle.</p>}
          {save.error && <p className="error" role="alert">{save.error.message}</p>}
          <div className="en-actions">
            <span style={{ flex: 1 }} />
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn" disabled={save.isPending || !form.name.trim() || !(Number(form.amount) > 0)}>{save.isPending ? 'Saving…' : plan ? 'Save' : 'Add plan'}</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
