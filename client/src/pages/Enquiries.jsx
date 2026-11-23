import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { api, rupees, waLink, can, DELETE } from '../api.js';
import { useBiz } from '../App.jsx';
import { words } from '../wording.js';
import { confirmAction } from '../confirm.jsx';
import { Avatar, Field, PlusIcon, SearchIcon, XIcon, PhoneIcon, WhatsAppIcon, EditIcon, UserPlusIcon, CalendarIcon, TrashIcon, AlertIcon, UsersIcon, CheckIcon } from '../ui.jsx';
import BulkRemind from '../BulkRemind.jsx';
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
const fmtPhone = (p) => (p && p.length === 10 ? `${p.slice(0, 5)} ${p.slice(5)}` : p);
const TABS = ['today', 'overdue', 'open', 'joined', 'lost'];

// People who asked about joining. The owner follows up until they join (then they
// become a member, details carried over) or says they're not interested.
export default function Enquiries() {
  const biz = useBiz();
  const qc = useQueryClient();
  const W = words(biz.type);
  const [q, setQ] = useState('');
  const [view, setView] = useState(null); // null: start on whatever needs doing first
  const [sourceFilter, setSourceFilter] = useState('all');
  const [bulk, setBulk] = useState(null); // "Message today's" one-by-one sender
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
    open: { label: 'Open', tab: 'All open', dot: '#2563EB', fn: open, empty: 'No open enquiries. Add one when someone asks about joining.' },
    today: { label: 'Call today', tab: 'Call today', empty: 'Nobody to call back today.', dot: '#D97706', fn: (e) => open(e) && e.followUpOn && dayDiff(e.followUpOn) === 0 },
    overdue: { label: 'Missed', tab: 'Missed', empty: 'No missed call-backs. Nice.', dot: '#DC2626', fn: (e) => open(e) && e.followUpOn && dayDiff(e.followUpOn) < 0 },
    new: { label: 'New', dot: STATUS.new.dot, fn: (e) => e.status === 'new' },
    follow_up: { label: 'Following up', dot: STATUS.follow_up.dot, fn: (e) => e.status === 'follow_up' },
    joined: { label: 'Joined', empty: 'Nobody has joined from an enquiry yet.', dot: STATUS.joined.dot, fn: (e) => e.status === 'joined' },
    lost: { label: 'Not interested', empty: 'Nobody marked not interested.', dot: STATUS.lost.dot, fn: (e) => e.status === 'lost' },
    all: { label: 'All enquiries', dot: '#94A3B8', fn: () => true },
  };
  const PERIODS = {
    all: ['Any time', () => true],
    month: ['This month', (e) => thisMonth(e.createdAt)],
    last: ['Last month', (e) => { const x = new Date(e.createdAt); const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1); return x.getMonth() === lm.getMonth() && x.getFullYear() === lm.getFullYear(); }],
    '3m': ['Last 3 months', (e) => (now - new Date(e.createdAt)) / DAY <= 92],
  };

  const curView = view || (all.some(VIEWS.today.fn) ? 'today' : all.some(VIEWS.overdue.fn) ? 'overdue' : 'open');
  const passes = (e, skip) => {
    const query = q.trim().toLowerCase();
    if (query && !(e.name || '').toLowerCase().includes(query) && !(e.phone || '').includes(query)) return false;
    if (skip !== 'view' && !VIEWS[curView].fn(e)) return false;
    if (skip !== 'source' && sourceFilter !== 'all' && e.source !== sourceFilter) return false;
    if (skip !== 'plan' && planFilter !== 'all' && (planFilter === 'none' ? e.planId : String(e.planId?._id) !== planFilter)) return false;
    if (skip !== 'period' && !PERIODS[period][1](e)) return false;
    return true;
  };
  // follow-ups due first (missed, then today, then later), then newest
  const rank = (e) => (open(e) && e.followUpOn ? dayDiff(e.followUpOn) : 9999);
  const list = useMemo(
    () => all.filter((e) => passes(e)).sort((a, b) => rank(a) - rank(b) || new Date(b.createdAt) - new Date(a.createdAt)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all, q, curView, planFilter, period, sourceFilter],
  );

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

  const count = (fn) => all.filter(fn).length;
  const monthName = now.toLocaleDateString('en-IN', { month: 'long' });
  const monthIn = all.filter((e) => thisMonth(e.createdAt));
  const monthJoined = monthIn.filter((e) => e.status === 'joined').length;
  const monthFollowed = monthIn.filter((e) => e.status !== 'new').length; // called back at least once (or decided)
  // the source that brought the most joiners this month, else the most enquiries
  const bestSource = (() => {
    const tally = (arr) => arr.reduce((m, e) => ({ ...m, [e.source]: (m[e.source] || 0) + 1 }), {});
    const pick = (t) => Object.entries(t).sort((x, y) => y[1] - x[1])[0]?.[0];
    return pick(tally(monthIn.filter((e) => e.status === 'joined'))) || (monthIn.length > 2 ? pick(tally(monthIn)) : null);
  })();
  const nToday = count(VIEWS.today.fn), nMissed = count(VIEWS.overdue.fn), nOpen = count(open);
  const cards = [
    { id: 'today', icon: PhoneIcon, tone: 'amber', label: 'Call today', value: nToday, note: 'call-backs due' },
    { id: 'overdue', icon: AlertIcon, tone: 'red', ink: nMissed ? 'red' : '', label: 'Missed', value: nMissed, note: 'call-back date passed' },
    { id: 'open', icon: UsersIcon, tone: 'blue', label: 'Open', value: nOpen, note: 'not decided yet' },
    { id: 'joined', icon: CheckIcon, tone: 'green', ink: 'green', label: `Joined · ${monthName.slice(0, 3)}`, value: monthJoined, note: monthIn.length ? `${Math.round((monthJoined / monthIn.length) * 100)}% of ${monthIn.length}` : 'none asked yet' },
  ];
  const subtitle = [
    nToday && `${nToday} to call today`,
    nMissed && `${nMissed} missed`,
    `${nOpen} open`,
    monthJoined && `${monthJoined} joined this month`,
  ].filter(Boolean).join(' · ');
  const todayList = all.filter((e) => VIEWS.today.fn(e) || VIEWS.overdue.fn(e)).sort((x, y) => rank(x) - rank(y));
  const todayWithPhone = todayList.filter((e) => e.phone);
  const messageToday = () => setBulk({
    id: Date.now(), title: 'to call back',
    people: todayList.map((e) => ({ _id: e._id, name: e.name, phone: e.phone, note: followText(e).text, message: hello(e) })),
  });
  const sourceOptions = [
    { value: 'all', label: 'Anywhere' },
    ...Object.entries(SOURCES).map(([value, label]) => ({ value, label, count: all.filter((e) => passes(e, 'source') && e.source === value).length })),
  ];

  const planOptions = [
    { value: 'all', label: 'Any plan' },
    ...plans.map((p) => ({ value: p._id, label: `${p.name} · ${rupees(p.amount)}`, count: all.filter((e) => passes(e, 'plan') && String(e.planId?._id) === p._id).length })),
    { value: 'none', label: 'Not sure yet', count: all.filter((e) => passes(e, 'plan') && !e.planId).length },
  ];
  const planLabel = planFilter === 'all' ? 'Any' : planFilter === 'none' ? 'Not sure' : plans.find((p) => p._id === planFilter)?.name;
  const chips = [
    sourceFilter !== 'all' && { key: 'source', label: `From: ${SOURCES[sourceFilter]}`, clear: () => setSourceFilter('all') },
    planFilter !== 'all' && { key: 'plan', label: `Plan: ${planLabel}`, clear: () => setPlanFilter('all') },
    period !== 'all' && { key: 'period', label: PERIODS[period][0], clear: () => setPeriod('all') },
  ].filter(Boolean);

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
    <div className="en2">
      <div className="page-header home-header db-head">
        <div className="page-title-wrap">
          <p className="db-date">{subtitle}</p>
          <h1 className="db-hello">Enquiries</h1>
        </div>
        <nav className="db-quick" aria-label="Quick actions">
          <button type="button" className="db-quick-btn pri q-add" onClick={() => setEditing({})}>
            <span className="db-quick-icon"><PlusIcon size={15} /></span>
            <span className="db-quick-long">Add enquiry</span><span className="db-quick-short">Add</span>
          </button>
          <button type="button" className="db-quick-btn q-msg" disabled={!todayWithPhone.length} onClick={messageToday}>
            <span className="db-quick-icon wa"><WhatsAppIcon size={15} /></span>
            <span className="db-quick-long">{todayWithPhone.length ? `Message ${todayWithPhone.length} to call back` : 'Nobody to call back'}</span>
            <span className="db-quick-short">Message</span>
          </button>
        </nav>
      </div>

      {all.length > 0 && (
        <>
          <section className="db-today mx2-cards en2-cards" aria-label="At a glance">
            {cards.map((c) => (
              <button key={c.id} type="button" className={`db-today-card mx2-card-btn ${curView === c.id ? 'on' : ''}`} aria-pressed={curView === c.id} onClick={() => setView(c.id)}>
                <span className={`db-today-icon ${c.tone}`}><c.icon size={17} /></span>
                <span className="db-today-text">
                  <span className="db-label">{c.label}</span>
                  <b className={c.ink || ''}>{c.value}</b>
                </span>
                <span className="db-today-note">{c.note}</span>
              </button>
            ))}
          </section>

          {monthIn.length > 0 && (
            <section className="en2-funnel" aria-label={`${monthName}: enquiries to members`}>
              <b className="en2-funnel-month">{monthName}</b>
              <div className="en2-funnel-bar">
                <span className="asked" style={{ flexGrow: Math.max(1, monthIn.length - monthFollowed) }}>{monthIn.length} asked</span>
                {monthFollowed - monthJoined > 0 && <span className="followed" style={{ flexGrow: monthFollowed - monthJoined }}>{monthFollowed} followed up</span>}
                {monthJoined > 0 && <span className="joined" style={{ flexGrow: monthJoined }}>{monthJoined} joined</span>}
              </div>
              <span className="en2-funnel-sum"><b>{Math.round((monthJoined / monthIn.length) * 100)}%</b> joined{bestSource ? ` · best source: ${SOURCES[bestSource]}` : ''}</span>
            </section>
          )}
        </>
      )}

      {all.length === 0 ? (
        <section className="mx-list en-empty">
          <span className="en-empty-icon"><UserPlusIcon size={26} /></span>
          <h2>No enquiries yet</h2>
          <p>When someone asks about joining, add them here with a date to call back. You'll see who to call each day, and turn them into a {W.member} in one tap when they join.</p>
          <button type="button" className="btn" onClick={() => setEditing({})}><PlusIcon size={15} /> Add first enquiry</button>
        </section>
      ) : (
        <section className="mx-list mx2 en2-list" aria-label="Enquiry list">
          <div className="db-tabs mx2-tabs" role="tablist" aria-label="Show enquiries">
            {TABS.map((id) => (
              <button key={id} type="button" role="tab" aria-selected={curView === id} className={`db-tab ${curView === id ? 'on' : ''}`} onClick={() => setView(id)}>
                <i className="db-dot" style={{ background: VIEWS[id].dot }} aria-hidden="true" />
                {VIEWS[id].tab || VIEWS[id].label}
                <span className="db-tab-count">{all.filter((e) => passes(e, 'view') && VIEWS[id].fn(e)).length}</span>
              </button>
            ))}
          </div>
          <div className="mx-toolbar">
            <div className="mx-toolbar-top">
              <label className="mx-search">
                <SearchIcon size={15} />
                <span className="sr-only">Search enquiries</span>
                <input type="search" placeholder="Search by name or phone" value={q} onChange={(e) => setQ(e.target.value)} />
                {q && <button type="button" className="mx-icon-btn" onClick={() => setQ('')} aria-label="Clear search"><XIcon size={14} /></button>}
              </label>
              {plans.length > 0 && (
                <Menu label="Interested in" prefix="Plan:" valueLabel={planLabel} active={planFilter !== 'all'}
                  options={planOptions} value={planFilter} onPick={setPlanFilter} />
              )}
              <Menu label="Came from" prefix="Came from:" valueLabel={sourceFilter === 'all' ? 'Any' : SOURCES[sourceFilter]} active={sourceFilter !== 'all'}
                options={sourceOptions} value={sourceFilter} onPick={setSourceFilter} />
              <Menu label="Asked" prefix="Asked:" valueLabel={PERIODS[period][0]} active={period !== 'all'}
                options={Object.entries(PERIODS).map(([value, [label]]) => ({ value, label }))} value={period} onPick={setPeriod} align="right" />
            </div>
            {chips.length > 0 && (
              <div className="mx-chips" aria-label="Active filters">
                <span className="mx-chips-count">{list.length} of {all.length} ·</span>
                {chips.map((c) => (
                  <button key={c.key} type="button" className="mx-chip" onClick={c.clear} aria-label={`Remove filter: ${c.label}`}>{c.label} <XIcon size={12} /></button>
                ))}
                <button type="button" className="mx-link mx-chips-clear" onClick={() => { setPlanFilter('all'); setPeriod('all'); setSourceFilter('all'); }}>Clear all</button>
              </div>
            )}
          </div>

          {list.length === 0 ? (
            <div className="mx-empty"><p>{q ? `Nobody matches “${q}”.` : VIEWS[curView].empty || 'No enquiries here.'}</p></div>
          ) : (
            <>
              <div className="mx-table-wrap">
                <table className="mx-table en2-table">
                  <thead>
                    <tr>
                      <th scope="col" style={{ paddingLeft: 16 }}><span className="mx-th">Person</span></th>
                      <th scope="col"><span className="mx-th">Wants</span></th>
                      <th scope="col"><span className="mx-th">Came from</span></th>
                      <th scope="col"><span className="mx-th">Call back</span></th>
                      <th scope="col"><span className="mx-th">Note</span></th>
                      <th scope="col" style={{ textAlign: 'right', paddingRight: 16 }}><span className="mx-th">Actions</span></th>
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
                                <span className="en2-name-row"><span className="mx-name">{e.name}</span><span className="en-pill" style={{ background: st.bg, color: st.ink }}>{st.label}</span></span>
                                <span className="mx-meta">{e.phone ? fmtPhone(e.phone) : 'No phone'} · asked {shortDate(e.createdAt)}</span>
                              </span>
                            </span>
                          </td>
                          <td><span className="mx-strong">{e.planId?.name || 'Not sure yet'}</span></td>
                          <td><span className="en2-source">{SOURCES[e.source] || '—'}</span></td>
                          <td>
                            <span className={`mx-strong ${f.tone}`}>{f.text}</span>
                            {f.sub && <span className="mx-meta">{f.sub}</span>}
                          </td>
                          <td><span className="en2-note" title={e.note || ''}>{e.note || '—'}</span></td>
                          <td style={{ paddingRight: 16 }}>
                            <span className="mx-actions">
                              {e.phone && open(e) && (
                                <a className="mx-wa" href={waLink(e.phone, hello(e))} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${e.name}`} title="WhatsApp"><WhatsAppIcon size={15} /></a>
                              )}
                              {e.phone && open(e) && (
                                <a className="mx-open" href={`tel:${e.phone}`} aria-label={`Call ${e.name}`} title="Call"><PhoneIcon size={15} /></a>
                              )}
                              {open(e) && <button type="button" className="mx-paid" onClick={() => setJoining(e)}>They joined</button>}
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

              <ul className="mx-cards mx2-cardlist en2-cards-list">
                {list.map((e) => {
                  const f = followText(e);
                  const st = STATUS[e.status];
                  return (
                    <li key={e._id} className="mx-card en2-card">
                      <button type="button" className="en2-card-top" onClick={() => setEditing(e)}>
                        <Avatar name={e.name} />
                        <span className="en2-card-who"><span className="mx-name">{e.name}</span><span className="mx-meta">{SOURCES[e.source] || '—'} · asked {shortDate(e.createdAt)}</span></span>
                        {open(e)
                          ? <span className="en2-card-fu"><b className={f.tone}>{f.text}</b><span>call back</span></span>
                          : <span className="en-pill" style={{ background: st.bg, color: st.ink }}>{st.label}</span>}
                      </button>
                      <p className="en2-card-note">{e.planId?.name || 'Not sure yet'}{e.note ? ` · ${e.note}` : ''}</p>
                      {open(e) ? (
                        <div className="mx2-card-actions">
                          {e.phone && <a className="mx2-wa" href={waLink(e.phone, hello(e))} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${e.name}`}><WhatsAppIcon size={17} /></a>}
                          {e.phone && <a className="mx2-open" href={`tel:${e.phone}`} aria-label={`Call ${e.name}`}><PhoneIcon size={16} /></a>}
                          <button type="button" className="mx-paid" onClick={() => setJoining(e)}>They joined</button>
                          <button type="button" className="mx2-open" onClick={() => setEditing(e)} aria-label={`Edit ${e.name}`}><EditIcon size={15} /></button>
                        </div>
                      ) : e.status === 'joined' && e.memberId ? (
                        <div className="mx2-card-actions"><Link className="mx2-open wide" to={`/members/${e.memberId}`}>Open {W.member}</Link></div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          <div className="mx-foot"><span>Showing {list.length} of {all.length}</span></div>
        </section>
      )}

      {bulk && <BulkRemind key={bulk.id} title={bulk.title} people={bulk.people} onClose={() => setBulk(null)} />}

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
    </div>
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
