import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { api, rupees, waLink, can, DELETE } from '../api.js';
import { useBiz } from '../App.jsx';
import { words } from '../wording.js';
import { confirmAction } from '../confirm.jsx';
import { Avatar, Field, PlusIcon, SearchIcon, XIcon, PhoneIcon, WhatsAppIcon, EditIcon, UserPlusIcon, CalendarIcon, TrashIcon } from '../ui.jsx';
import { AddMemberModal, Menu } from './Members.jsx';

const DAY = 86400000;
const startOfDay = (d = new Date()) => new Date(new Date(d).toDateString());
const dayDiff = (d) => Math.round((startOfDay(d) - startOfDay()) / DAY); // + future, − past
const shortDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const isoDay = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const inDays = (n) => isoDay(Date.now() + n * DAY);
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

const STATUS = {
  new: { label: 'New', dot: '#2563EB', bg: '#EEF4FF', ink: '#1D4ED8' },
  follow_up: { label: 'Following up', dot: '#D97706', bg: '#FFF6E5', ink: '#92400E' },
  joined: { label: 'Joined', dot: '#16A34A', bg: '#ECFDF3', ink: '#066B3F' },
  lost: { label: 'Not interested', dot: '#64748B', bg: '#F1F3F7', ink: '#475569' },
};
const SOURCES = { walk_in: 'Walk-in', call: 'Phone call', whatsapp: 'WhatsApp', instagram: 'Instagram', referral: 'Referred by someone', other: 'Other' };
const open = (e) => e.status === 'new' || e.status === 'follow_up';

// People who asked about joining. The owner follows up until they join (then they
// become a member, details carried over) or says they're not interested.
export default function Enquiries() {
  const biz = useBiz();
  const qc = useQueryClient();
  const W = words(biz.type);
  const [q, setQ] = useState('');
  const [view, setView] = useState('open');
  const [planFilter, setPlanFilter] = useState('all');
  const [period, setPeriod] = useState('all');
  const [editing, setEditing] = useState(null); // {} for a new one, or the enquiry
  const [joining, setJoining] = useState(null); // the enquiry becoming a member
  // ?add=1 (from the home screen's + Enquiry) opens the form once
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    if (params.get('add')) {
      setEditing({});
      setParams((p) => { p.delete('add'); return p; }, { replace: true });
    }
  }, [params, setParams]);

  const { data: enquiries, error: loadError, refetch, isFetching } = useQuery({
    queryKey: ['enquiries', biz._id],
    queryFn: () => api(`/businesses/${biz._id}/enquiries`),
    retry: 1,
  });
  const { data: plans = [] } = useQuery({ queryKey: ['plans', biz._id], queryFn: () => api(`/businesses/${biz._id}/plans`) });
  const { data: groups = [] } = useQuery({ queryKey: ['groups', biz._id], queryFn: () => api(`/businesses/${biz._id}/groups`) });
  const { data: rooms = [] } = useQuery({ queryKey: ['rooms', biz._id], queryFn: () => api(`/businesses/${biz._id}/rooms`), enabled: biz.type === 'hostel' });

  const patch = useMutation({
    mutationFn: ({ id, body }) => api(`/businesses/${biz._id}/enquiries/${id}`, { method: 'PATCH', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['enquiries', biz._id] }),
  });
  const remove = useMutation({
    mutationFn: (id) => api(`/businesses/${biz._id}/enquiries/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['enquiries', biz._id] }),
  });

  const all = enquiries || [];
  const now = new Date();
  const thisMonth = (d) => { const x = new Date(d); return x.getMonth() === now.getMonth() && x.getFullYear() === now.getFullYear(); };
  const VIEWS = {
    open: { label: 'Open', dot: '#5B3DF5', fn: open },
    today: { label: 'Follow up today', dot: '#D97706', fn: (e) => open(e) && e.followUpOn && dayDiff(e.followUpOn) === 0 },
    overdue: { label: 'Follow-up missed', dot: '#DC2626', fn: (e) => open(e) && e.followUpOn && dayDiff(e.followUpOn) < 0 },
    new: { label: 'New', dot: STATUS.new.dot, fn: (e) => e.status === 'new' },
    follow_up: { label: 'Following up', dot: STATUS.follow_up.dot, fn: (e) => e.status === 'follow_up' },
    joined: { label: 'Joined', dot: STATUS.joined.dot, fn: (e) => e.status === 'joined' },
    lost: { label: 'Not interested', dot: STATUS.lost.dot, fn: (e) => e.status === 'lost' },
    all: { label: 'All enquiries', dot: '#94A3B8', fn: () => true },
  };
  const PERIODS = {
    all: ['Any time', () => true],
    month: ['This month', (e) => thisMonth(e.createdAt)],
    last: ['Last month', (e) => { const x = new Date(e.createdAt); const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1); return x.getMonth() === lm.getMonth() && x.getFullYear() === lm.getFullYear(); }],
    '3m': ['Last 3 months', (e) => (now - new Date(e.createdAt)) / DAY <= 92],
  };

  const passes = (e, skip) => {
    const query = q.trim().toLowerCase();
    if (query && !(e.name || '').toLowerCase().includes(query) && !(e.phone || '').includes(query)) return false;
    if (skip !== 'view' && !VIEWS[view].fn(e)) return false;
    if (skip !== 'plan' && planFilter !== 'all' && (planFilter === 'none' ? e.planId : String(e.planId?._id) !== planFilter)) return false;
    if (skip !== 'period' && !PERIODS[period][1](e)) return false;
    return true;
  };
  // follow-ups due first (missed, then today, then later), then newest
  const rank = (e) => (open(e) && e.followUpOn ? dayDiff(e.followUpOn) : 9999);
  const list = useMemo(
    () => all.filter((e) => passes(e)).sort((a, b) => rank(a) - rank(b) || new Date(b.createdAt) - new Date(a.createdAt)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all, q, view, planFilter, period],
  );

  const count = (fn) => all.filter(fn).length;
  const monthIn = all.filter((e) => thisMonth(e.createdAt));
  const monthJoined = monthIn.filter((e) => e.status === 'joined').length;
  const cards = [
    { id: 'today', label: 'Follow up today', big: count(VIEWS.today.fn), small: 'calls to make', color: 'amber' },
    { id: 'overdue', label: 'Follow-up missed', big: count(VIEWS.overdue.fn), small: 'date has passed', color: 'red' },
    { id: 'open', label: 'Open enquiries', big: count(open), small: 'not decided yet', color: 'blue' },
    { id: 'joined', label: `Joined · ${now.toLocaleDateString('en-IN', { month: 'long' })}`, big: monthJoined, small: monthIn.length ? `${Math.round((monthJoined / monthIn.length) * 100)}% of ${monthIn.length} enquiries` : 'no enquiries yet', color: 'green' },
  ];

  const viewOptions = [
    ...['open', 'today', 'overdue'].map((k) => ({ value: k, label: VIEWS[k].label, dot: VIEWS[k].dot, count: all.filter((e) => passes(e, 'view') && VIEWS[k].fn(e)).length })),
    { head: 'Status' },
    ...['new', 'follow_up', 'joined', 'lost'].map((k) => ({ value: k, label: VIEWS[k].label, dot: VIEWS[k].dot, count: all.filter((e) => passes(e, 'view') && VIEWS[k].fn(e)).length })),
    { head: 'Everything' },
    { value: 'all', label: VIEWS.all.label, dot: VIEWS.all.dot, count: all.filter((e) => passes(e, 'view')).length },
  ];
  const planOptions = [
    { value: 'all', label: 'Any plan' },
    ...plans.map((p) => ({ value: p._id, label: `${p.name} · ${rupees(p.amount)}`, count: all.filter((e) => passes(e, 'plan') && String(e.planId?._id) === p._id).length })),
    { value: 'none', label: 'Not sure yet', count: all.filter((e) => passes(e, 'plan') && !e.planId).length },
  ];
  const planLabel = planFilter === 'all' ? 'Any' : planFilter === 'none' ? 'Not sure' : plans.find((p) => p._id === planFilter)?.name;
  const chips = [
    view !== 'open' && { key: 'view', label: VIEWS[view].label, dot: VIEWS[view].dot, clear: () => setView('open') },
    planFilter !== 'all' && { key: 'plan', label: `Plan: ${planLabel}`, clear: () => setPlanFilter('all') },
    period !== 'all' && { key: 'period', label: PERIODS[period][0], clear: () => setPeriod('all') },
  ].filter(Boolean);

  const followText = (e) => {
    if (!open(e)) return { text: '—', tone: '' }; // the Status pill already says Joined / Not interested
    if (!e.followUpOn) return { text: 'No date set', tone: '' };
    const d = dayDiff(e.followUpOn);
    if (d < 0) return { text: `Missed by ${plural(-d, 'day')}`, tone: 'red', sub: shortDate(e.followUpOn) };
    if (d === 0) return { text: 'Today', tone: 'amber', sub: shortDate(e.followUpOn) };
    if (d === 1) return { text: 'Tomorrow', tone: '', sub: shortDate(e.followUpOn) };
    return { text: `in ${d} days`, tone: '', sub: shortDate(e.followUpOn) };
  };
  const hello = (e) => `Hi ${e.name}, thanks for asking about ${biz.name}.${e.planId ? ` The ${e.planId.name} plan is ${rupees(e.planId.amount)}.` : ''} Would you like to come in for a visit?`;

  const askDelete = async (e) => {
    if (await confirmAction({ title: `Delete ${e.name}'s enquiry?`, message: 'It is removed for good. Use "Not interested" instead to keep a record.', confirmText: 'Delete', danger: true })) remove.mutate(e._id);
  };

  if (!enquiries && loadError) {
    // an older server has no /enquiries route and answers 404 "Not Found"
    const missing = loadError.status === 404 || /not found|404/i.test(loadError.message || '');
    return (
      <section className="mx-list en-empty" role="alert">
        <span className="en-empty-icon"><UserPlusIcon size={26} /></span>
        <h2>{missing ? 'Enquiries isn’t available on the server yet' : 'Couldn’t load enquiries'}</h2>
        <p>{missing
          ? 'This page needs the latest server update. Once the server is updated, your enquiries will show up here.'
          : `Something went wrong: ${loadError.message}. Check your connection and try again.`}</p>
        <button type="button" className="btn-secondary" disabled={isFetching} onClick={() => refetch()}>{isFetching ? 'Trying…' : 'Try again'}</button>
      </section>
    );
  }

  if (!enquiries) {
    return <div aria-hidden="true"><div className="card skeleton" style={{ minHeight: 120, marginBottom: 16 }} /><div className="card skeleton" style={{ minHeight: 320 }} /></div>;
  }

  return (
    <>
      <div className="page-header home-header mx-head">
        <div className="page-title-wrap">
          <h1 className="page-title">Enquiries</h1>
          <p className="home-date">People who asked about joining · {count(open)} open {count(open) === 1 ? 'enquiry' : 'enquiries'}</p>
        </div>
        <div className="mx-head-actions">
          <button type="button" className="btn mx-add" onClick={() => setEditing({})}>
            <PlusIcon size={16} /> Add enquiry
          </button>
        </div>
      </div>

      {all.length > 0 && (
        <div className="mx-kpis" role="tablist" aria-label="Show enquiries">
          {cards.map((c) => (
            <button key={c.id} type="button" role="tab" aria-selected={view === c.id}
              className={`dash-kpi mx-kpi ${c.color} ${view === c.id ? 'on' : ''}`} onClick={() => setView(c.id)}>
              <span className="dash-kpi-label">{c.label}</span>
              <b>{c.big}</b>
              <span className="dash-kpi-sub">{c.small}</span>
            </button>
          ))}
        </div>
      )}

      {all.length === 0 ? (
        <section className="mx-list en-empty">
          <span className="en-empty-icon"><UserPlusIcon size={26} /></span>
          <h2>No enquiries yet</h2>
          <p>When someone asks about joining, add them here with a date to call back. You'll see who to call each day, and turn them into a {W.member} in one tap when they join.</p>
          <button type="button" className="btn" onClick={() => setEditing({})}><PlusIcon size={15} /> Add first enquiry</button>
        </section>
      ) : (
        <section className="mx-list" aria-label="Enquiry list">
          <div className="mx-toolbar">
            <div className="mx-toolbar-top">
              <label className="mx-search">
                <SearchIcon size={15} />
                <span className="sr-only">Search enquiries</span>
                <input type="search" placeholder="Search by name or phone" value={q} onChange={(e) => setQ(e.target.value)} />
                {q && <button type="button" className="mx-icon-btn" onClick={() => setQ('')} aria-label="Clear search"><XIcon size={14} /></button>}
              </label>
              <Menu className="mx-menu-status" label="Show enquiries" valueLabel={VIEWS[view].label} dot={VIEWS[view].dot}
                active={view !== 'open'} options={viewOptions} value={view} onPick={setView} wide />
              {plans.length > 0 && (
                <Menu label="Interested in" prefix="Plan:" valueLabel={planLabel} active={planFilter !== 'all'}
                  options={planOptions} value={planFilter} onPick={setPlanFilter} />
              )}
              <Menu label="Enquired" prefix="Enquired:" valueLabel={PERIODS[period][0]} active={period !== 'all'}
                options={Object.entries(PERIODS).map(([value, [label]]) => ({ value, label }))} value={period} onPick={setPeriod} align="right" />
            </div>
            {chips.length > 0 && (
              <div className="mx-chips" aria-label="Active filters">
                <span className="mx-chips-count">{list.length} of {all.length} ·</span>
                {chips.map((c) => (
                  <button key={c.key} type="button" className="mx-chip" onClick={c.clear} aria-label={`Remove filter: ${c.label}`}>
                    {c.dot && <i className="mx-dot-c" style={{ background: c.dot }} aria-hidden="true" />}{c.label} <XIcon size={12} />
                  </button>
                ))}
                <button type="button" className="mx-link mx-chips-clear" onClick={() => { setView('open'); setPlanFilter('all'); setPeriod('all'); }}>Clear all</button>
              </div>
            )}
          </div>

          {list.length === 0 ? (
            <div className="mx-empty"><p>{q ? `Nobody matches “${q}”.` : view === 'today' ? 'No follow-ups due today.' : view === 'overdue' ? 'No missed follow-ups. Nice.' : 'No enquiries here.'}</p></div>
          ) : (
            <>
              <div className="mx-table-wrap">
                <table className="mx-table">
                  <thead>
                    <tr>
                      <th scope="col" style={{ paddingLeft: 16 }}><span className="mx-th">Name</span></th>
                      <th scope="col"><span className="mx-th">Interested in</span></th>
                      <th scope="col"><span className="mx-th">Came from</span></th>
                      <th scope="col"><span className="mx-th">Follow up</span></th>
                      <th scope="col"><span className="mx-th">Status</span></th>
                      <th scope="col" style={{ textAlign: 'right' }}><span className="mx-th">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((e) => {
                      const f = followText(e);
                      const st = STATUS[e.status];
                      return (
                        <tr key={e._id} onClick={(ev) => { if (!ev.target.closest('a, button')) setEditing(e); }}>
                          <td style={{ paddingLeft: 16 }}>
                            <span className="mx-person">
                              <Avatar name={e.name} />
                              <span>
                                <span className="mx-name">{e.name}</span>
                                <span className="mx-meta">{e.phone || 'No phone'} · asked {shortDate(e.createdAt)}</span>
                              </span>
                            </span>
                          </td>
                          <td>
                            <span className="mx-strong">{e.planId?.name || 'Not sure yet'}</span>
                            {e.note && <span className="mx-meta en-note" title={e.note}>{e.note}</span>}
                          </td>
                          <td><span className="mx-meta" style={{ fontSize: 13.5, color: 'var(--text-2)' }}>{SOURCES[e.source] || '—'}</span></td>
                          <td>
                            <span className={`mx-strong ${f.tone}`}>{f.text}</span>
                            {f.sub && <span className="mx-meta">{f.sub}</span>}
                          </td>
                          <td><span className="en-pill" style={{ background: st.bg, color: st.ink }}><i style={{ background: st.dot }} />{st.label}</span></td>
                          <td>
                            <span className="mx-actions">
                              {e.phone && open(e) && (
                                <a className="mx-wa" href={waLink(e.phone, hello(e))} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${e.name}`} title="WhatsApp">
                                  <WhatsAppIcon size={15} />
                                </a>
                              )}
                              {e.phone && open(e) && (
                                <a className="mx-open" href={`tel:${e.phone}`} aria-label={`Call ${e.name}`} title="Call"><PhoneIcon size={15} /></a>
                              )}
                              {open(e) && <button type="button" className="mx-paid" onClick={() => setJoining(e)}>Joined</button>}
                              {e.status === 'joined' && e.memberId && <Link className="mx-ghost" to={`/members/${e.memberId}`}>Open {W.member}</Link>}
                              <button type="button" className="mx-open" onClick={() => setEditing(e)} aria-label={`Edit ${e.name}`} title="Edit"><EditIcon size={14} /></button>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <ul className="mx-cards">
                {list.map((e) => {
                  const f = followText(e);
                  const st = STATUS[e.status];
                  return (
                    <li key={e._id} className="mx-card">
                      <button type="button" className="mx-card-top en-card-top" onClick={() => setEditing(e)}>
                        <Avatar name={e.name} />
                        <span className="mx-card-who">
                          <span className="mx-name">{e.name}</span>
                          <span className="mx-meta">{e.planId?.name || 'Not sure yet'} · {SOURCES[e.source]}</span>
                        </span>
                        <span className="en-pill" style={{ background: st.bg, color: st.ink }}><i style={{ background: st.dot }} />{st.label}</span>
                      </button>
                      {open(e) && (
                        <div className="mx-tags">
                          <span className={`mx-tag ${f.tone}`}><CalendarIcon size={12} /> Follow up: {f.text.toLowerCase()}{f.sub && f.text !== 'Today' && f.text !== 'Tomorrow' ? ` (${f.sub})` : ''}</span>
                        </div>
                      )}
                      {open(e) && (
                        <div className="mx-card-actions three">
                          {e.phone ? <a href={`tel:${e.phone}`} className="mx-call" aria-label={`Call ${e.name}`}><PhoneIcon size={17} /></a> : <span />}
                          {e.phone ? <a className="mx-wa-btn" href={waLink(e.phone, hello(e))} target="_blank" rel="noreferrer">WhatsApp</a> : <span />}
                          <button type="button" className="mx-paid" onClick={() => setJoining(e)}>Joined</button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          <div className="mx-foot"><span>Showing {list.length} of {all.length}</span></div>
        </section>
      )}

      <AnimatePresence>
        {editing && (
          <EnquiryModal
            biz={biz}
            plans={plans}
            enquiry={editing._id ? editing : null}
            canDelete={can(biz, DELETE)}
            onDelete={() => { const e = editing; setEditing(null); askDelete(e); }}
            onJoined={() => { const e = editing; setEditing(null); setJoining(e); }}
            onClose={() => setEditing(null)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {joining && (
          <AddMemberModal
            biz={biz} plans={plans} groups={groups} rooms={rooms}
            initial={{ name: joining.name, phone: joining.phone, planId: joining.planId?._id }}
            onClose={() => setJoining(null)}
            onAdded={(member) => patch.mutate({ id: joining._id, body: { status: 'joined', memberId: member._id } })}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// Add or edit one enquiry
function EnquiryModal({ biz, plans, enquiry, canDelete, onDelete, onJoined, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(() => ({
    name: enquiry?.name || '',
    phone: enquiry?.phone || '',
    planId: enquiry?.planId?._id || '',
    source: enquiry?.source || 'walk_in',
    followUpOn: enquiry ? (enquiry.followUpOn ? isoDay(enquiry.followUpOn) : '') : inDays(1),
    note: enquiry?.note || '',
    status: enquiry?.status || 'new',
  }));
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, followUpOn: form.followUpOn || null };
      return enquiry
        ? api(`/businesses/${biz._id}/enquiries/${enquiry._id}`, { method: 'PATCH', body })
        : api(`/businesses/${biz._id}/enquiries`, { method: 'POST', body });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['enquiries', biz._id] }); onClose(); },
  });
  const quick = [['Tomorrow', 1], ['In 3 days', 3], ['Next week', 7]];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.18 }}
        className="modal-content en-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="en-title"
        onClick={(e) => e.stopPropagation()}>
        <div className="form-header" style={{ marginBottom: 16 }}>
          <div className="form-title"><UserPlusIcon size={18} style={{ color: 'var(--primary)' }} /><span id="en-title">{enquiry ? 'Edit enquiry' : 'New enquiry'}</span></div>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><XIcon size={14} /></button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="en-form">
          <div className="form-grid two-col">
            <Field label="Name *">
              <input required autoFocus value={form.name} onChange={set('name')} placeholder="Who asked" />
            </Field>
            <Field label="Phone">
              <input type="tel" inputMode="numeric" value={form.phone} onChange={set('phone')} placeholder="10-digit mobile" />
            </Field>
          </div>

          <Field label="Interested in">
            <select value={form.planId} onChange={set('planId')}>
              <option value="">Not sure yet</option>
              {plans.map((p) => <option key={p._id} value={p._id}>{p.name} · {rupees(p.amount)}</option>)}
            </select>
          </Field>

          <fieldset className="en-fieldset">
            <legend>How did they find you?</legend>
            <div className="en-pills">
              {Object.entries(SOURCES).map(([v, l]) => (
                <button key={v} type="button" aria-pressed={form.source === v} className={`en-choice ${form.source === v ? 'on' : ''}`} onClick={() => setForm({ ...form, source: v })}>{l}</button>
              ))}
            </div>
          </fieldset>

          <fieldset className="en-fieldset">
            <legend>Call back on</legend>
            <div className="en-pills">
              {quick.map(([l, n]) => (
                <button key={l} type="button" aria-pressed={form.followUpOn === inDays(n)} className={`en-choice ${form.followUpOn === inDays(n) ? 'on' : ''}`} onClick={() => setForm({ ...form, followUpOn: inDays(n) })}>{l}</button>
              ))}
              <label className="en-date">
                <span className="sr-only">Pick a date</span>
                <input type="date" value={form.followUpOn} onChange={set('followUpOn')} />
              </label>
              {form.followUpOn && <button type="button" className="mx-link" style={{ fontSize: 13 }} onClick={() => setForm({ ...form, followUpOn: '' })}>No date</button>}
            </div>
          </fieldset>

          {enquiry && (
            <fieldset className="en-fieldset">
              <legend>Status</legend>
              <div className="en-pills">
                {['new', 'follow_up', 'lost'].map((v) => (
                  <button key={v} type="button" aria-pressed={form.status === v} className={`en-choice ${form.status === v ? 'on' : ''}`} onClick={() => setForm({ ...form, status: v })}>
                    <i className="mx-dot-c" style={{ background: STATUS[v].dot }} aria-hidden="true" /> {STATUS[v].label}
                  </button>
                ))}
                {enquiry.status === 'joined' && <span className="en-choice on"><i className="mx-dot-c" style={{ background: STATUS.joined.dot }} /> Joined</span>}
              </div>
            </fieldset>
          )}

          <Field label="Note">
            <textarea rows={2} value={form.note} onChange={set('note')} placeholder="e.g. wants morning batch, will come with a friend" maxLength={500} />
          </Field>

          {save.error && <p className="error" role="alert">{save.error.message}</p>}

          <div className="en-actions">
            {enquiry && canDelete && (
              <button type="button" className="icon-btn en-delete" onClick={onDelete} aria-label="Delete enquiry" title="Delete"><TrashIcon size={15} /></button>
            )}
            <span style={{ flex: 1 }} />
            {enquiry && open(enquiry) && <button type="button" className="btn-secondary" onClick={onJoined}><UserPlusIcon size={15} /> They joined</button>}
            <button type="submit" className="btn" disabled={save.isPending || !form.name.trim()}>{save.isPending ? 'Saving…' : enquiry ? 'Save' : 'Add enquiry'}</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
