import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { api, rupees, can, EDIT, ADD, DELETE } from '../api.js';
import { confirmAction } from '../confirm.jsx';
import SellModal from '../SellModal.jsx';
import { useBiz } from '../App.jsx';
import { words } from '../wording.js';
import HostelProperty from './HostelProperty.jsx';
import Outlets from './Outlets.jsx';
import Staff from './Staff.jsx';
import { Field, PlusIcon, XIcon, CreditCardIcon, BuildingIcon, CheckIcon, UsersIcon, SettingsIcon, EditIcon, AlertIcon, TagIcon, ActivityIcon, SparklesIcon, TrashIcon } from '../ui.jsx';

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
// what a business sells: memberships bill every cycle; the rest are charged once
const KINDS = {
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
  const kinds = Object.keys(KINDS).filter((k) => !KINDS[k].gymOnly || biz.type === 'gym');
  const kind = kinds.includes(params.get('kind')) ? params.get('kind') : 'membership';
  const setKind = (k) => { setAddKey((x) => ({ ...x, plans: 0 })); setParams((p) => { p.set('tab', 'plans'); p.set('kind', k); return p; }, { replace: true }); };
  const [selling, setSelling] = useState(null); // {} or { start: itemId }

  const { data: plans } = useQuery({ queryKey: [`/businesses/${biz._id}/plans`], queryFn: () => api(`/businesses/${biz._id}/plans`) });
  const { data: groups } = useQuery({ queryKey: [`/businesses/${biz._id}/groups`], queryFn: () => api(`/businesses/${biz._id}/groups`) });
  const { data: outlets } = useQuery({ queryKey: ['outlets'], queryFn: () => api('/businesses/summary') });
  const { data: staff } = useQuery({ queryKey: ['staff-all'], queryFn: () => api('/staff'), enabled: isOwner });
  const { data: catalogue } = useQuery({ queryKey: ['catalogue', biz._id], queryFn: () => api(`/businesses/${biz._id}/catalogue`) });

  const n = { plans: plans?.length, groups: groups?.length, outlets: outlets?.length, staff: staff?.length };
  const notJoined = (staff || []).filter((s) => !s.joined).length;
  const subtitle = [
    n.plans != null && `${n.plans} ${n.plans === 1 ? 'plan' : 'plans'}`,
    catalogue?.length ? `${catalogue.length} for sale` : null,
    n.groups ? `${n.groups} ${w.group.toLowerCase()}${n.groups === 1 ? '' : (w.group.endsWith('ch') ? 'es' : 's')}` : null,
    n.outlets != null && `${n.outlets} ${n.outlets === 1 ? 'outlet' : 'outlets'}`,
    isOwner && n.staff != null && `${n.staff} staff`,
  ].filter(Boolean).join(' · ');

  const addLabel = { plans: kind === 'membership' ? `Add ${w.plan.toLowerCase().replace('membership ', '')}` : KINDS[kind].add, outlets: 'Add outlet', staff: 'Add staff' }[tab];
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
          {tab === 'plans' && can(biz, ADD) && catalogue?.length > 0 && (
            <button type="button" className="btn-secondary su-sell" onClick={() => setSelling({})}><TagIcon size={15} /> <span className="su-sell-long">Sell something</span><span className="su-sell-short">Sell</span></button>
          )}
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
            {t === 'plans' ? <><span className="su-tab-long">{biz.type === 'hostel' ? 'Rooms & plans' : 'Plans & catalogue'}</span><span className="su-tab-short">{biz.type === 'hostel' ? 'Rooms' : 'Plans'}</span></> : t === 'outlets' ? 'Outlets' : 'Staff'}
            {(t === 'plans' ? (n.plans || 0) + (catalogue?.length || 0) : n[t]) > 0 && <span className="db-tab-count">{t === 'plans' ? (n.plans || 0) + (catalogue?.length || 0) : n[t]}</span>}
          </button>
        ))}
      </div>

      {tab === 'plans' && (
        <>
          <div className="su-kinds" role="radiogroup" aria-label="What you sell">
            {kinds.map((k) => {
              const K = KINDS[k];
              const count = k === 'membership' ? n.plans : (catalogue || []).filter((i) => i.kind === k).length;
              return (
                <button key={k} type="button" role="radio" aria-checked={kind === k} className={`su-kind ${kind === k ? 'on' : ''}`} onClick={() => setKind(k)}>
                  <span className={`db-today-icon ${K.tone}`}><K.icon size={16} /></span>
                  <span className="su-kind-text"><b>{K.label} <span className="mr-dim">· {count ?? '…'}</span></b><span>{K.hint}</span></span>
                </button>
              );
            })}
          </div>
          {kind === 'membership'
            ? <PlansTab biz={biz} plans={plans} groups={groups} addKey={addKey.plans} />
            : <CatalogueTab biz={biz} kind={kind} items={catalogue} addKey={addKey.plans} onSell={(id) => setSelling({ start: id })} />}
        </>
      )}
      {tab === 'outlets' && <Outlets embedded addKey={addKey.outlets} />}
      {tab === 'staff' && isOwner && <Staff embedded addKey={addKey.staff} />}
      <AnimatePresence>
        {selling && <SellModal biz={biz} start={selling.start} onClose={() => setSelling(null)} />}
      </AnimatePresence>
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: [`/businesses/${biz._id}/groups`] }); setGroupName(''); setAddingGroup(false); },
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
function CatalogueTab({ biz, kind, items, addKey, onSell }) {
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
  const [form, setForm] = useState({ name: item?.name || '', price: item ? String(item.price) : '', detail: item?.detail || '', trackStock: item?.trackStock || false, stock: item ? String(item.stock ?? 0) : '' });
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  const save = useMutation({
    mutationFn: () => {
      const body = { kind, name: form.name.trim(), price: Number(form.price), detail: form.detail, trackStock: kind === 'product' && form.trackStock, stock: kind === 'product' && form.trackStock ? Number(form.stock || 0) : 0 };
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: [`/businesses/${biz._id}/plans`] }); qc.invalidateQueries({ queryKey: ['members', biz._id] }); onClose(); },
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
