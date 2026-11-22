import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { api, rupees, waLink, remindMsg } from '../api.js';
import { words } from '../wording.js';
import { Avatar, WhatsAppIcon, PlusIcon, PhoneIcon, ChevronIcon, CheckCircleIcon, CheckIcon, SparklesIcon, RupeeIcon, UserPlusIcon, AlertIcon } from '../ui.jsx';
import { CollectPaymentModal, roomLabel } from './Members.jsx';
import BulkRemind, { owingMessage, renewalMessage } from '../BulkRemind.jsx';

const DAY = 86400000;
const shortDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const startOfDay = (d = new Date()) => new Date(new Date(d).toDateString());
const daysSince = (d) => Math.max(0, Math.round((startOfDay() - startOfDay(d)) / DAY));
const daysUntil = (d) => Math.round((startOfDay(d) - startOfDay()) / DAY);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const natural = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true });
const isoDay = (d = new Date()) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const MODE = { cash: 'Cash', upi: 'UPI', card: 'Card', other: 'Bank or card', bank_transfer: 'Bank transfer', bank: 'Bank transfer' };

// "done for today" ticks live on this device and reset each day
function useDoneToday(bizId) {
  const key = `done:${bizId}:${isoDay()}`;
  const [done, setDone] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')); } catch { return new Set(); }
  });
  const toggle = (id) => setDone((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    try {
      localStorage.setItem(key, JSON.stringify([...next]));
      // forget earlier days' ticks
      Object.keys(localStorage).filter((k) => k.startsWith(`done:${bizId}:`) && k !== key).forEach((k) => localStorage.removeItem(k));
    } catch { /* storage may be blocked; ticks then last until reload */ }
    return next;
  });
  return [done, toggle];
}

// Home screen: today at a glance, the month, who to follow up (with a done tick),
// suggestions, the week's attendance, growth and the latest payments.
export default function DashboardHome({ biz, data, onAddMember }) {
  const qc = useQueryClient();
  const w = words(biz.type);
  const isHostel = biz.type === 'hostel';
  const attendanceOn = biz.attendanceEnabled !== false;
  const [collect, setCollect] = useState(null);
  const [bulk, setBulk] = useState(null); // { title, people }
  const [tab, setTab] = useState('late');
  const [done, toggleDone] = useDoneToday(biz._id);
  const { pending = [], pendingTotal = 0, activeMembers = 0, membersTable = [] } = data;
  const home = data.home || {};

  // this month's money, from the same report the Reports page uses
  const now = new Date();
  const monthName = now.toLocaleDateString('en-IN', { month: 'long' });
  const lastMonthName = new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleDateString('en-IN', { month: 'long' });
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
  const { data: month } = useQuery({
    queryKey: ['report', biz._id, 'home', from],
    queryFn: () => api(`/businesses/${biz._id}/report?from=${from}&to=${to}&tz=${now.getTimezoneOffset()}`),
  });
  const { data: attendance } = useQuery({
    queryKey: ['attendance', biz._id, null, ''],
    queryFn: () => api(`/businesses/${biz._id}/attendance`),
    enabled: attendanceOn,
  });
  const { data: notComing } = useQuery({
    queryKey: ['not-coming', biz._id, 7],
    queryFn: () => api(`/businesses/${biz._id}/attendance/not-coming?days=7`),
    enabled: attendanceOn,
  });
  // enquiries are optional here: if the server doesn't have them yet, the tab just stays empty
  const { data: enquiries = [] } = useQuery({
    queryKey: ['enquiries', biz._id],
    queryFn: () => api(`/businesses/${biz._id}/enquiries`),
    retry: false,
  });
  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms', biz._id],
    queryFn: () => api(`/businesses/${biz._id}/rooms`),
    enabled: isHostel,
  });
  const { data: groups = [] } = useQuery({
    queryKey: ['groups', biz._id],
    queryFn: () => api(`/businesses/${biz._id}/groups`),
    enabled: isHostel,
  });

  if (!membersTable.length) {
    return (
      <div className="today">
        <section className="today-hero clear">
          <div className="today-hero-label">Welcome to {biz.name}</div>
          <div className="today-hero-text">Add your first {w.member} to start tracking fees.</div>
          <button type="button" className="today-hero-btn" onClick={onAddMember}>
            <PlusIcon size={16} /> Add {w.member}
          </button>
        </section>
      </div>
    );
  }

  // ---- the month ----
  const received = month?.received ?? 0;
  const spent = month?.expenses ?? 0;
  const profit = month?.profit ?? 0;
  const billed = received + pendingTotal;
  const collectedPct = billed > 0 ? Math.round((received / billed) * 100) : 100;
  const lastMonth = home.lastMonthCollected || 0;
  const vsLast = lastMonth > 0 ? Math.round(((received - lastMonth) / lastMonth) * 100) : null;
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const pace = dayOfMonth >= 3 && received > 0 ? Math.min(billed, Math.round((received / dayOfMonth) * daysInMonth / 100) * 100) : null;
  const trend = (data.revenueTrend || []).slice(-6);
  const trendMax = Math.max(1, ...trend.map((t) => t.collected));

  // ---- today ----
  const dueToday = pending.filter((m) => m.dueSince && daysSince(m.dueSince) === 0);
  const openEnq = enquiries.filter((e) => e.status === 'new' || e.status === 'follow_up');
  const newEnqToday = enquiries.filter((e) => daysSince(e.createdAt) === 0);
  const callEnq = openEnq
    .filter((e) => !e.followUpOn || daysUntil(e.followUpOn) <= 0)
    .sort((a, b) => (a.followUpOn ? daysUntil(a.followUpOn) : 1) - (b.followUpOn ? daysUntil(b.followUpOn) : 1));
  const present = attendance?.counts?.present ?? 0;
  const total = attendance?.counts?.total ?? 0;
  const todayCards = [
    { key: 'paid', icon: RupeeIcon, tone: 'green', label: 'Collected today', value: rupees(home.today?.collected || 0), note: home.today?.payments ? plural(home.today.payments, 'payment') : 'none yet', to: '/reports' },
    attendanceOn && total > 0 && { key: 'in', icon: CheckIcon, tone: 'violet', label: biz.type === 'gym' ? 'Came in today' : 'Present today', value: `${present}`, note: `of ${total}`, to: '/attendance' },
    { key: 'enq', icon: UserPlusIcon, tone: 'blue', label: 'New enquiries', value: String(newEnqToday.length), note: callEnq.length ? `${callEnq.length} to call` : 'today', to: '/enquiries' },
    { key: 'due', icon: AlertIcon, tone: 'orange', label: 'Fees due today', value: rupees(dueToday.reduce((s, m) => s + m.balance, 0)), note: plural(dueToday.length, w.member), to: '/members?filter=owing' },
  ].filter(Boolean);

  // ---- follow up today ----
  const roomOf = (m) => rooms.find((r) => r._id === (m.roomId?._id || m.roomId));
  const late = [...pending].sort((a, b) => daysSince(b.dueSince || now) - daysSince(a.dueSince || now) || b.balance - a.balance);
  const expiring = membersTable
    .filter((m) => m.status === 'active' && m.statusBadge !== 'paused' && m.balance <= 0 && m.nextRenewal)
    .map((m) => ({ ...m, inDays: daysUntil(m.nextRenewal) }))
    .filter((m) => m.inDays >= 0 && m.inDays <= 7)
    .sort((a, b) => a.inDays - b.inDays);
  const away = notComing?.members || [];
  const TABS = [
    { id: 'late', label: 'Expired', dot: '#DC2626', list: late, hint: 'Plan ended and the fee is still unpaid' },
    { id: 'soon', label: 'Expiring', more: ' this week', dot: '#D97706', list: expiring, hint: 'Remind them before the plan ends' },
    attendanceOn && { id: 'away', label: 'Not coming', dot: '#7C3AED', list: away, hint: 'Away 7+ days: a quick call keeps them coming' },
    { id: 'enq', label: 'Enquiries', dot: '#2563EB', list: callEnq, hint: 'People who asked about joining, due a call back' },
  ].filter(Boolean);
  const current = TABS.find((t) => t.id === tab) || TABS[0];
  const shown = current.list.slice(0, 6);
  const doneKey = (t, m) => `${t}:${m._id}`;
  const allKeys = TABS.flatMap((t) => t.list.slice(0, 6).map((m) => doneKey(t.id, m)));
  const doneCount = allKeys.filter((k) => done.has(k)).length;

  const missYou = (m) => `Hi ${m.name}, we haven't seen you at ${biz.name} for a few days. Hope all is well. See you soon!`;
  const enqHello = (e) => `Hi ${e.name}, this is ${biz.name}. You'd asked about joining, are you still interested? Happy to answer any questions.`;
  const remindLate = () => setBulk({ title: 'who owe', people: late.map((m) => ({ _id: m._id, name: m.name, phone: m.phone, note: `${rupees(m.balance)} due`, message: owingMessage(biz, m) })) });
  const remindSoon = () => setBulk({ title: 'renewing soon', people: expiring.map((m) => ({ _id: m._id, name: m.name, phone: m.phone, note: `renews ${shortDate(m.nextRenewal)}`, message: renewalMessage(biz, m) })) });

  const rowFor = (m) => {
    if (current.id === 'late') {
      const d = m.dueSince ? daysSince(m.dueSince) : 0;
      const room = isHostel && roomOf(m);
      return {
        sub: `${d > 0 ? `Expired ${plural(d, 'day')} ago` : 'Due today'}${room ? ` · ${roomLabel(room, groups)}` : ''}`,
        tone: 'red', amount: rupees(m.balance),
        wa: m.phone && waLink(m.phone, remindMsg(biz, m.name, m.balance)),
        cta: <button type="button" className="db-cta pri" onClick={() => setCollect(m)}>Collect</button>,
        href: `/members/${m._id}`,
      };
    }
    if (current.id === 'soon') {
      const when = m.inDays === 0 ? 'Expires today' : m.inDays === 1 ? 'Expires tomorrow' : `Expires in ${m.inDays} days`;
      const msg = renewalMessage(biz, m);
      return {
        sub: `${when} · ${shortDate(m.nextRenewal)}`, tone: 'amber', amount: m.planAmount ? rupees(m.planAmount) : '',
        wa: m.phone && waLink(m.phone, msg),
        cta: m.phone ? <a className="db-cta" href={waLink(m.phone, msg)} target="_blank" rel="noreferrer">Remind</a> : <Link className="db-cta" to={`/members/${m._id}`}>Open</Link>,
        href: `/members/${m._id}`,
      };
    }
    if (current.id === 'away') {
      return {
        sub: m.lastPresent ? `Not come for ${plural(m.daysAway, 'day')}` : `Never came · joined ${plural(m.daysAway, 'day')} ago`,
        tone: 'violet', amount: '',
        wa: m.phone && waLink(m.phone, missYou(m)),
        cta: m.phone ? <a className="db-cta" href={`tel:${m.phone}`}><PhoneIcon size={14} /> Call</a> : <Link className="db-cta" to={`/members/${m._id}`}>Open</Link>,
        href: `/members/${m._id}`,
      };
    }
    const d = m.followUpOn ? daysUntil(m.followUpOn) : null;
    return {
      sub: d === null ? `Asked ${shortDate(m.createdAt)}${m.planId ? ` · ${m.planId.name}` : ''}` : d === 0 ? `Call back today${m.planId ? ` · ${m.planId.name}` : ''}` : `Call back missed ${plural(-d, 'day')} ago`,
      tone: d !== null && d < 0 ? 'red' : 'blue', amount: '',
      wa: m.phone && waLink(m.phone, enqHello(m)),
      cta: m.phone ? <a className="db-cta" href={`tel:${m.phone}`}><PhoneIcon size={14} /> Call</a> : <Link className="db-cta" to="/enquiries">Open</Link>,
      href: '/enquiries',
    };
  };

  // ---- suggestions: simple rules on data the app already has ----
  const longLate = late.find((m) => m.dueSince && daysSince(m.dueSince) >= 30);
  const away30 = away.filter((m) => m.daysAway >= 30);
  const missedEnq = openEnq.filter((e) => e.followUpOn && daysUntil(e.followUpOn) < 0);
  const tips = [
    expiring.length > 0 && {
      key: 'soon', text: `${plural(expiring.length, 'plan')} ${expiring.length === 1 ? 'expires' : 'expire'} this week (${rupees(expiring.reduce((s, m) => s + (m.planAmount || 0), 0))}). Remind them before they lapse.`,
      cta: expiring.some((m) => m.phone) ? <button type="button" className="db-tip-btn" onClick={remindSoon}>Remind {expiring.length}</button> : null,
    },
    longLate && {
      key: 'late', text: `${longLate.name} owes ${rupees(longLate.balance)} for ${plural(daysSince(longLate.dueSince), 'day')}. A call works better than a message.`,
      cta: longLate.phone ? <a className="db-tip-btn" href={`tel:${longLate.phone}`}>Call</a> : <Link className="db-tip-btn" to={`/members/${longLate._id}`}>Open</Link>,
    },
    away30.length > 0 && {
      key: 'away', text: `${plural(away30.length, w.member)} ${away30.length === 1 ? "hasn't" : "haven't"} come in for 30+ days. They may be about to quit.`,
      cta: <button type="button" className="db-tip-btn" onClick={() => setTab('away')}>See who</button>,
    },
    missedEnq.length > 0 && {
      key: 'enq', text: `${missedEnq.length} ${missedEnq.length === 1 ? 'enquiry' : 'enquiries'} missed ${missedEnq.length === 1 ? 'its' : 'their'} call-back date.`,
      cta: <button type="button" className="db-tip-btn" onClick={() => setTab('enq')}>Show</button>,
    },
    late.length > 1 && !longLate && {
      key: 'all', text: `${plural(late.length, w.member)} owe ${rupees(pendingTotal)}. One message reminds them all.`,
      cta: <button type="button" className="db-tip-btn" onClick={remindLate}>Remind all</button>,
    },
  ].filter(Boolean).slice(0, 3);

  // ---- week & growth ----
  const week = home.week || null;
  const weekMax = Math.max(1, ...(week || []).map((d) => d.present));
  const weekAvg = week ? Math.round(week.reduce((s, d) => s + d.present, 0) / week.length) : 0;
  const dayLabel = (iso, i) => (i === 6 ? 'Today' : new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short' }).slice(0, 2));
  const beds = rooms.reduce((s, r) => s + r.capacity, 0);
  const filled = rooms.reduce((s, r) => s + Math.min(r.occupied, r.capacity), 0);
  const freeRooms = rooms.filter((r) => r.occupied < r.capacity)
    .sort((a, b) => (b.capacity - b.occupied) - (a.capacity - a.occupied) || natural(a.roomNo, b.roomNo));
  const recent = (data.recentPayments || []).slice(0, 4);
  const ring = 2 * Math.PI * 15.5;

  return (
    <div className="db">
      {/* today at a glance */}
      <section className="db-today" aria-label="Today">
        {todayCards.map((c) => (
          <Link key={c.key} to={c.to} className="db-today-card">
            <span className={`db-today-icon ${c.tone}`}><c.icon size={17} /></span>
            <span className="db-today-text">
              <span className="db-label">{c.label}</span>
              <b>{c.value}</b>
            </span>
            <span className="db-today-note">{c.note}</span>
          </Link>
        ))}
      </section>

      {/* the month: progress, comparison, 6-month trend */}
      <section className="db-money v2" aria-label={`${monthName} so far`}>
        <div className="db-money-main">
          <div className="db-month-text">
            <span className="db-label-row">
              <span className="db-label">Collected in {monthName}</span>
              {vsLast !== null && (
                <span className={`db-delta ${vsLast >= 0 ? 'up' : 'down'}`}>{vsLast >= 0 ? '▲' : '▼'} {Math.abs(vsLast)}% vs {lastMonthName}</span>
              )}
            </span>
            <span className="db-money-big">
              <b>{rupees(received)}</b>
              <span>of {rupees(billed)} · {collectedPct}%</span>
            </span>
            <span className="db-bar" role="img" aria-label={`${collectedPct}% of this month's fees collected`}><i style={{ width: `${collectedPct}%` }} /></span>
            {pace !== null && collectedPct < 100 && (
              <span className="db-sub db-pace">
                {pace >= billed ? 'At this pace you\'ll collect everything by month end.' : <>At this pace you'll reach <b>{rupees(pace)}</b> by {daysInMonth} {now.toLocaleDateString('en-IN', { month: 'short' })}.</>}
              </span>
            )}
          </div>
          {trend.length > 1 && (
            <Link to="/reports" className="db-trend" role="img" aria-label={`Collected per month: ${trend.map((t) => `${t.month} ${rupees(t.collected)}`).join(', ')}`}>
              {trend.map((t, i) => (
                <span key={`${t.month}${t.year}`} className={`db-trend-col ${i === trend.length - 1 ? 'now' : ''}`}>
                  <i style={{ height: `${Math.max(4, Math.round((t.collected / trendMax) * 76))}px` }} />
                  <span>{t.month}</span>
                </span>
              ))}
            </Link>
          )}
        </div>
        <div className="db-money-side">
          <Link to="/members?filter=owing" className={`db-money-cell ${pendingTotal > 0 ? 'owe' : ''}`}>
            <span className="db-label">To collect</span>
            <b className={pendingTotal > 0 ? 'red' : 'green'}>{pendingTotal > 0 ? rupees(pendingTotal) : 'All paid'}</b>
            <span className="db-sub">{pendingTotal > 0 ? `${plural(pending.length, w.member)} →` : 'nobody owes'}</span>
          </Link>
          <Link to="/reports?view=expenses" className="db-money-cell">
            <span className="db-label">Spent</span>
            <b>{rupees(spent)}</b>
            <span className="db-sub">{spent ? 'this month' : 'no expenses yet'}</span>
          </Link>
          <Link to="/reports" className="db-money-cell">
            <span className="db-label">{profit < 0 ? 'Loss' : 'Profit'}</span>
            <b className={profit < 0 ? 'red' : 'green'}>{profit < 0 ? '−' : ''}{rupees(Math.abs(profit))}</b>
            <span className="db-sub">collected − spent</span>
          </Link>
        </div>
      </section>

      <div className="db-grid">
        {/* follow up today, with a done tick */}
        <section className="db-card db-todo" aria-labelledby="db-todo-title">
          <div className="db-todo-head">
            <div>
              <h2 id="db-todo-title">Follow up today</h2>
              <p>{current.hint}</p>
            </div>
            {allKeys.length > 0 && (
              <div className="db-progress">
                <span>{doneCount} of {allKeys.length} done</span>
                <span className="db-progress-bar" role="img" aria-label={`${doneCount} of ${allKeys.length} done`}><i style={{ width: `${Math.round((doneCount / allKeys.length) * 100)}%` }} /></span>
              </div>
            )}
          </div>
          <div className="db-tabs" role="tablist" aria-label="Who to follow up">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" id={`db-tab-${t.id}`} aria-selected={current.id === t.id} aria-controls="db-todo-list"
                className={`db-tab ${current.id === t.id ? 'on' : ''}`} onClick={() => setTab(t.id)}>
                <i className="db-dot" style={{ background: t.dot }} aria-hidden="true" />
                {t.label}{t.more && <span className="db-tab-more">{t.more}</span>}
                <span className="db-tab-count">{t.list.length}</span>
              </button>
            ))}
          </div>
          <div id="db-todo-list" role="tabpanel" aria-labelledby={`db-tab-${current.id}`}>
            {shown.length ? (
              <ul className="db-rows">
                {shown.map((m) => {
                  const r = rowFor(m);
                  const k = doneKey(current.id, m);
                  const isDone = done.has(k);
                  return (
                    <li key={m._id} className={`db-row ${isDone ? 'done' : ''}`}>
                      <button type="button" className="db-tick" aria-pressed={isDone} aria-label={`${isDone ? 'Undo' : 'Mark'} ${m.name} done for today`} onClick={() => toggleDone(k)}>
                        {isDone && <CheckIcon size={13} />}
                      </button>
                      <Link to={r.href} className="db-who">
                        <Avatar name={m.name} />
                        <span className="db-who-text">
                          <b>{m.name}</b>
                          <span className={r.tone}>{r.sub}</span>
                        </span>
                      </Link>
                      {r.amount && <b className={`db-amt ${current.id === 'late' ? 'red' : ''}`}>{r.amount}</b>}
                      <span className="db-acts">
                        {r.wa && (
                          <a className="db-wa" href={r.wa} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${m.name}`} title="WhatsApp">
                            <WhatsAppIcon size={16} />
                          </a>
                        )}
                        {r.cta}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="db-empty">
                <CheckCircleIcon size={18} />
                {{ late: 'Nobody owes anything right now.', soon: 'No plans expire this week.', away: `Every ${w.member} came in this week.`, enq: 'No enquiries to call back today.' }[current.id]}
              </p>
            )}
          </div>
          <div className="db-todo-foot">
            <Link className="db-foot-link" to={{ late: '/members?filter=owing', soon: '/members?filter=soon', away: '/members?filter=away', enq: '/enquiries' }[current.id]}>
              {current.list.length > shown.length ? `See all ${current.list.length} →` : 'See all →'}
            </Link>
            {((current.id === 'late' && late.length > 1) || (current.id === 'soon' && expiring.length > 1)) && (
              <button type="button" className="db-wa-all" onClick={current.id === 'late' ? remindLate : remindSoon}>
                <WhatsAppIcon size={14} /> Remind all {current.list.length}
              </button>
            )}
          </div>
        </section>

        <div className="db-side">
          {tips.length > 0 && (
            <section className="db-tips" aria-labelledby="db-tips-title">
              <h2 id="db-tips-title"><span className="db-tips-badge"><SparklesIcon size={13} /></span>Suggestions</h2>
              <ul>
                {tips.map((t) => (
                  <li key={t.key}><span>{t.text}</span>{t.cta}</li>
                ))}
              </ul>
            </section>
          )}

          {attendanceOn && total > 0 && (
            <section className="db-card db-pad" aria-labelledby="db-att-title">
              <div className="db-label-row">
                <h2 id="db-att-title" className="db-h">{biz.type === 'gym' ? 'Came in' : 'Attendance'}</h2>
                <Link to="/attendance" className="db-link">Mark today →</Link>
              </div>
              {week ? (
                <>
                  <div className="db-att-num"><b>{present}</b><span>of {total} today{weekAvg ? ` · avg ${weekAvg} a day` : ''}</span></div>
                  <div className="db-week" role="img" aria-label={`Last 7 days: ${week.map((d) => d.present).join(', ')}`}>
                    {week.map((d, i) => (
                      <span key={d.day} className={`db-week-col ${i === 6 ? 'now' : ''}`}>
                        <i style={{ height: `${Math.max(3, Math.round((d.present / weekMax) * 52))}px` }} />
                        <span>{dayLabel(d.day, i)}</span>
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <div className="db-att">
                  <svg width="56" height="56" viewBox="0 0 36 36" role="img" aria-label={`${present} of ${total} today`}>
                    <circle cx="18" cy="18" r="15.5" fill="none" className="db-ring-bg" strokeWidth="4" />
                    <circle cx="18" cy="18" r="15.5" fill="none" className="db-ring" strokeWidth="4" strokeLinecap="round"
                      strokeDasharray={`${(present / total) * ring} ${ring}`} transform="rotate(-90 18 18)" />
                  </svg>
                  <div className="db-att-num"><b>{present}</b><span>of {total} today</span></div>
                </div>
              )}
            </section>
          )}

          {isHostel && beds > 0 && (
            <Link to="/rooms" className="db-card db-pad db-beds">
              <span className="db-label-row"><span className="db-h">Beds filled</span><ChevronIcon size={14} /></span>
              <div className="db-att-num"><b>{filled}</b><span>of {plural(beds, 'bed')}</span></div>
              <span className="db-bar"><i style={{ width: `${Math.round((filled / beds) * 100)}%`, background: 'var(--primary)' }} /></span>
              {freeRooms.length > 0 && (
                <span className="db-sub">Free: {freeRooms.slice(0, 3).map((r) => roomLabel(r, groups)).join(', ')}{freeRooms.length > 3 ? ` +${freeRooms.length - 3}` : ''}</span>
              )}
            </Link>
          )}

          <section className="db-card db-growth" aria-label={`${w.member}s this month`}>
            <Link to="/members?filter=new"><span>Joined</span><b className="green">+{home.joinedThisMonth ?? 0}</b></Link>
            <Link to="/members?filter=left"><span>Left</span><b className={home.leftThisMonth ? 'red' : ''}>{home.leftThisMonth ? `−${home.leftThisMonth}` : '0'}</b></Link>
            <Link to="/members"><span>Active now</span><b>{activeMembers}</b></Link>
          </section>

          <section className="db-card db-pad db-pays" aria-labelledby="db-pay-title">
            <div className="db-label-row">
              <h2 id="db-pay-title" className="db-h">Recent payments</h2>
              <Link to="/reports" className="db-link">Money →</Link>
            </div>
            {recent.length ? (
              <ul>
                {recent.map((p) => (
                  <li key={p._id}>
                    <Link to={`/members/${p.memberId}`}>
                      <span className="db-who-text">
                        <b>{p.name}</b>
                        <span>{daysSince(p.date) === 0 ? 'Today' : daysSince(p.date) === 1 ? 'Yesterday' : shortDate(p.date)} · {MODE[p.mode] || 'Cash'}</span>
                      </span>
                      <b className="green">+{rupees(p.amount)}</b>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="db-sub" style={{ margin: '10px 0' }}>No payments yet. They show up here as you collect them.</p>
            )}
          </section>
        </div>
      </div>

      <AnimatePresence>
        {bulk && <BulkRemind title={bulk.title} people={bulk.people} onClose={() => setBulk(null)} />}
      </AnimatePresence>
      <AnimatePresence>
        {collect && (
          <CollectPaymentModal
            member={collect}
            balance={collect.balance}
            plan={null}
            onClose={() => setCollect(null)}
            onSuccess={() => { qc.invalidateQueries(); setCollect(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
