import { useEffect, useState, lazy, Suspense } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { AnimatePresence } from 'framer-motion';
import { api, userId, waLink, rupees, can, ADD } from '../api.js';
import { useBiz } from '../contexts.js';
import { words } from '../wording.js';
import { Avatar, ChevronIcon, CheckIcon, XIcon, SearchIcon, PrinterIcon, ConfirmDialog, CalendarCheckIcon, DownloadIcon, PhoneIcon, WhatsAppIcon, AlertIcon, TrendingUpIcon, ClockIcon, LayersIcon, ChevronDownIcon } from '../ui.jsx';
import { PickMember } from './Members.jsx';

const AttendanceImport = lazy(() => import('./AttendanceImport.jsx')); // brings in the Excel reader only when used

const addDays = (day, n) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000);
const fmtDay = (day, opts) => new Date(`${day}T00:00:00Z`).toLocaleDateString('en-IN', { timeZone: 'UTC', ...opts });
const dayLabel = (day, today) => (day === today ? 'Today' : day === addDays(today, -1) ? 'Yesterday' : fmtDay(day, { weekday: 'short', day: 'numeric' }));
const timeOf = (at) => new Date(at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
const HOW = { qr: 'scanned QR', biometric: 'fingerprint machine', staff: 'marked by staff' };

// Tuition, mess, hostel: staff mark a daily list. Gym: members check in by QR; staff can
// check someone in by hand. Attendance is only recorded; it never changes fees.
export default function Attendance() {
  const biz = useBiz();
  if (biz.attendanceEnabled === false) {
    return (
      <div className="analytics-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
        <CalendarCheckIcon size={28} style={{ color: 'var(--text-3)' }} />
        <h2 style={{ fontSize: 18, margin: '10px 0 6px', color: 'var(--text)' }}>Attendance is turned off</h2>
        <p className="muted" style={{ margin: '0 0 16px' }}>
          {biz.ownerId === userId() ? 'Turn it on in Settings to start marking attendance.' : 'Ask the owner to turn it on in Settings.'}
        </p>
        <Link to="/settings" className="btn">Open Settings</Link>
      </div>
    );
  }
  return <AttendanceOn biz={biz} />;
}

function AttendanceOn({ biz }) {
  const qc = useQueryClient();
  const W = words(biz.type);
  const isGym = biz.type === 'gym';
  const isOwner = biz.ownerId === userId();
  const canMark = can(biz, ADD);
  const [day, setDay] = useState(null); // null = today (the server decides "today" in the business's timezone)
  const isTuition = biz.type === 'tuition'; // a teacher takes the roll one batch at a time
  const [params, setParams] = useSearchParams();
  const groupId = params.get('batch') || ''; // in the URL, so Back returns to the batch list
  const [q, setQ] = useState('');
  const [tab, setTab] = useState(isTuition ? 'all' : 'notin'); // 'all' (tuition roll call) | 'notin' | 'in' | 'absent' | 'away'
  const setGroupId = (id) => { setParams(id ? { batch: id } : {}, { replace: !isTuition }); setQ(''); setTab(isTuition ? 'all' : 'notin'); };
  const [awayDays, setAwayDays] = useState(7);
  const [importing, setImporting] = useState(false);
  const [picking, setPicking] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const { data: groups = [] } = useQuery({ queryKey: ['groups', biz._id], queryFn: () => api(`/businesses/${biz._id}/groups`) });
  const key = ['attendance', biz._id, day, groupId];
  const { data } = useQuery({
    queryKey: key,
    queryFn: () => api(`/businesses/${biz._id}/attendance?${new URLSearchParams({ ...(day && { day }), ...(groupId && { groupId }) })}`),
    placeholderData: (prev) => prev,
    refetchInterval: isGym ? 30000 : false, // gym: new QR check-ins appear without refreshing
  });
  const { data: away } = useQuery({
    queryKey: ['not-coming', biz._id, awayDays],
    queryFn: () => api(`/businesses/${biz._id}/attendance/not-coming?days=${awayDays}`),
    placeholderData: (prev) => prev,
  });

  const mark = useMutation({
    mutationFn: ({ memberId, status }) => api(`/businesses/${biz._id}/attendance`, { method: 'PUT', body: { day: data.day, memberId, status } }),
    // update the list at once; the server response confirms it
    onMutate: async ({ memberId, status }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData(key);
      qc.setQueryData(key, (old) => old && {
        ...old,
        members: old.members.map((m) => (m._id === memberId ? { ...m, status, method: status && 'staff', markedBy: status && 'you', at: status && new Date().toISOString() } : m)),
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(key, ctx.prev),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['attendance', biz._id] });
      qc.invalidateQueries({ queryKey: ['member-attendance'] });
      qc.invalidateQueries({ queryKey: ['not-coming', biz._id] });
    },
  });
  // every batch's numbers for the day, for the batch list and "next batch"
  const { data: everyone } = useQuery({
    queryKey: ['attendance', biz._id, day, ''],
    queryFn: () => api(`/businesses/${biz._id}/attendance?${new URLSearchParams({ ...(day && { day }) })}`),
    enabled: isTuition,
    placeholderData: (prev) => prev,
  });
  const allPresent = useMutation({
    mutationFn: (status = 'present') => api(`/businesses/${biz._id}/attendance/all-present`, { method: 'POST', body: { day: data.day, groupId: groupId || undefined, status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attendance', biz._id] }),
  });

  if (!data) return <div className="card skeleton" style={{ minHeight: 320 }} aria-hidden="true" />;
  if (isTuition && !groupId) {
    return (
      <>
        <BatchList W={W} groups={groups} data={everyone || data} canMark={canMark} onDay={setDay} onPick={setGroupId} onImport={() => setImporting(true)} />
        <AnimatePresence>
          {importing && (
            <Suspense fallback={null}>
              <AttendanceImport biz={biz} onClose={() => setImporting(false)} />
            </Suspense>
          )}
        </AnimatePresence>
      </>
    );
  }

  const today = data.today;
  const current = data.day;
  const members = data.members;
  const present = members.filter((m) => m.status === 'present');
  const absent = members.filter((m) => m.status === 'absent');
  const notIn = members.filter((m) => (isGym ? m.status !== 'present' : !m.status));
  const owingNotIn = notIn.filter((m) => m.due > 0).length;
  const week = data.week || [];
  const avg = week.length ? Math.round(week.reduce((n, d) => n + d.present, 0) / week.length) : 0;
  const busiest = week.reduce((b, d) => (d.present > (b?.present || 0) ? d : b), null);
  const peak = Math.max(1, ...week.map((d) => d.present));
  const pct = members.length ? Math.round((present.length / members.length) * 100) : 0;
  const isToday = current === today;
  const query = q.trim().toLowerCase();
  const match = (m) => !query || `${m.name} ${m.phone || ''}`.toLowerCase().includes(query);
  const methods = ['qr', 'biometric', 'staff'].map((k) => [k, present.filter((m) => m.method === k).length]).filter(([, n]) => n);

  const lastText = (m) => {
    if (m.paused) return { text: 'Paused', tone: '' };
    if (!m.lastPresent) {
      const d = daysBetween(m.joinDay || current, current);
      return { text: d > 0 ? `Not seen since joining · ${d} day${d === 1 ? '' : 's'}` : 'Joined today', tone: d >= 7 ? 'red' : '' };
    }
    const d = daysBetween(m.lastPresent, current);
    return { text: d === 1 ? 'Last came yesterday' : d >= 7 ? `${d} days away` : `Last came ${d} days ago`, tone: d >= 7 ? 'red' : '' };
  };
  const sub = (m) => [m.groupName, m.planName].filter(Boolean).join(' · ');

  const tabs = [
    isTuition && { id: 'all', label: 'Everyone', dot: 'var(--primary)', count: members.length },
    { id: 'notin', label: isGym ? (isToday ? 'Not in yet' : 'Didn\'t come') : 'Not marked', dot: '#D97706', count: notIn.length },
    { id: 'in', label: isGym ? 'Checked in' : 'Present', dot: '#16A34A', count: present.length },
    !isGym && { id: 'absent', label: 'Absent', dot: '#94A3B8', count: absent.length },
    { id: 'away', label: `Not coming ${awayDays}+ days`, dot: '#DC2626', count: away?.members.length ?? '–' },
  ].filter(Boolean);
  const cards = [
    { id: 'in', icon: CheckIcon, tone: 'green', ink: 'green', short: 'In', label: isGym ? 'Checked in' : 'Present', value: `${present.length} / ${members.length}`, note: `${pct}% of ${W.member}s` },
    { id: 'notin', icon: ClockIcon, tone: 'amber', short: 'Not in', label: isGym ? 'Not in yet' : 'Not marked', value: notIn.length, note: owingNotIn ? `${owingNotIn} of them owe` : 'no dues among them' },
    { id: 'away', icon: AlertIcon, tone: 'red', short: 'Away', ink: away?.members.length ? 'red' : '', label: 'Not coming', value: away?.members.length ?? '–', note: `${awayDays}+ days away` },
    { id: null, icon: TrendingUpIcon, tone: 'blue', label: 'Average day', short: 'Avg/day', value: avg, note: busiest?.present ? `busiest ${fmtDay(busiest.day, { weekday: 'short' })}` : 'this week' },
  ];

  const rows = tab === 'all' ? members : tab === 'notin' ? notIn : tab === 'in' ? [...present].sort((a, b) => new Date(b.at) - new Date(a.at)) : tab === 'absent' ? absent : [];
  const subtitle = `${isToday ? fmtDay(current, { weekday: 'long', day: 'numeric', month: 'long' }) : fmtDay(current, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · ${present.length} of ${members.length} ${isGym ? 'in' : 'present'}${isToday ? ' so far' : ''}`;

  const batch = groups.find((g) => g._id === groupId);
  const marked = present.length + absent.length;
  const done = isTuition && members.length > 0 && !notIn.length;
  // the next batch still to be taken this day, so the teacher can go straight on
  const nextBatch = isTuition && everyone && groups.find((g) => {
    if (g._id === groupId) return false;
    const inG = everyone.members.filter((m) => String(m.groupId) === g._id && !m.paused);
    return inG.some((m) => !m.status);
  });
  const parentMsg = (m) => `Hi, ${m.name.split(' ')[0]} was absent from ${batch?.name || 'class'} at ${biz.name} on ${fmtDay(current, { day: 'numeric', month: 'short' })}. Please let us know if all is well.`;
  const weekStrip = (
    <section className="at-week" aria-label="This week">
      <button type="button" className="at-week-step" aria-label="Earlier week" onClick={() => setDay(addDays(current, -7))}><ChevronIcon size={16} style={{ transform: 'rotate(180deg)' }} /></button>
      {week.map((d) => (
        <button key={d.day} type="button" className={`at-day ${d.day === current ? 'on' : ''}`} aria-pressed={d.day === current}
          aria-label={`${fmtDay(d.day, { weekday: 'long', day: 'numeric', month: 'long' })}: ${d.present} came`}
          onClick={() => setDay(d.day === today ? null : d.day)}>
          <span className="at-day-label">{dayLabel(d.day, today)}</span>
          <span className="at-day-bar"><i style={{ height: `${Math.max(4, (d.present / peak) * 100)}%` }} /></span>
          <b>{d.present}</b>
        </button>
      ))}
      <button type="button" className="at-week-step" aria-label="Later week" disabled={current >= today}
        onClick={() => { const n = addDays(current, 7); setDay(n >= today ? null : n); }}><ChevronIcon size={16} /></button>
    </section>
  );

  // Tuition: the roll call for one batch
  if (isTuition) {
    const Member = W.member[0].toUpperCase() + W.member.slice(1);
    return (
      <div className="at at-roll">
        <div className="at-roll-head">
          <button type="button" className="at-back" onClick={() => setGroupId('')}>
            <ChevronIcon size={15} style={{ transform: 'rotate(180deg)' }} /> All {W.groups.toLowerCase()}
          </button>
          <p className="db-date">{fmtDay(current, { weekday: 'long', day: 'numeric', month: 'long', ...(!isToday && { year: 'numeric' }) })}</p>
          <h1 className="db-hello">{batch?.name || W.group}</h1>
        </div>

        {weekStrip}

        <section className="mx-list mx2 at-list" aria-label={`${Member}s`}>
          <div className="at-progress">
            <span className="at-progress-text">
              <b>{marked} of {members.length} marked</b>
              <span><i className="g">{present.length} present</i> · <i className="r">{absent.length} absent</i>{notIn.length ? ` · ${notIn.length} left` : ''}</span>
            </span>
            <span className="at-progress-bar" aria-hidden="true">
              <i className="g" style={{ width: `${members.length ? (present.length / members.length) * 100 : 0}%` }} />
              <i className="r" style={{ width: `${members.length ? (absent.length / members.length) * 100 : 0}%` }} />
            </span>
            {canMark && notIn.length > 0 && (
              <span className="at-progress-btns">
                <button type="button" className="btn at-all" disabled={allPresent.isPending} onClick={() => allPresent.mutate('present')}>
                  <CheckIcon size={14} /> {marked ? `Rest present (${notIn.length})` : `All present (${notIn.length})`}
                </button>
                {marked > 0 && (
                  <button type="button" className="btn-secondary at-all" disabled={allPresent.isPending} onClick={() => allPresent.mutate('absent')}>
                    <XIcon size={14} /> Rest absent
                  </button>
                )}
              </span>
            )}
          </div>

          {done && (
            <div className="at-done" role="status">
              <span><CheckIcon size={15} /> Done · {present.length} present, {absent.length} absent</span>
              {nextBatch
                ? <button type="button" className="btn" onClick={() => setGroupId(nextBatch._id)}>Next: {nextBatch.name} <ChevronIcon size={14} /></button>
                : <button type="button" className="btn-secondary" onClick={() => setGroupId('')}>All {W.groups.toLowerCase()}</button>}
            </div>
          )}

          <div className="db-tabs mx2-tabs" role="tablist" aria-label="Show">
            {tabs.filter((t) => t.id !== 'away').map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`db-tab ${tab === t.id ? 'on' : ''}`} onClick={() => setTab(t.id)}>
                <i className="db-dot" style={{ background: t.dot }} aria-hidden="true" />{t.label}<span className="db-tab-count">{t.count}</span>
              </button>
            ))}
          </div>
          {members.length > 8 && (
            <div className="at-tools">
              <label className="mx-search">
                <SearchIcon size={15} />
                <span className="sr-only">Search {W.member}s</span>
                <input type="search" placeholder={`Search a ${W.member}`} value={q} onChange={(e) => setQ(e.target.value)} />
                {q && <button type="button" className="mx-icon-btn" onClick={() => setQ('')} aria-label="Clear search"><XIcon size={14} /></button>}
              </label>
            </div>
          )}

          <ul className="at-rows">
            {!members.length && <li className="at-empty">No {W.member}s in this {W.group.toLowerCase()} yet. Add them from the {Member}s page.</li>}
            {members.length > 0 && !rows.filter(match).length && (
              <li className="at-empty">{query ? `Nobody matches “${q}”.` : tab === 'notin' ? 'Everyone is marked.' : tab === 'in' ? 'Nobody yet.' : 'Nobody absent.'}</li>
            )}
            {rows.filter(match).map((m, i) => {
              const last = lastText(m);
              return (
                <li key={m._id} className={`at-row at-roll-row ${m.status || ''}`}>
                  <span className="at-roll-no" aria-hidden="true">{i + 1}</span>
                  <span className="at-who">
                    <span className="at-name-row"><b>{m.name}</b>{m.due > 0 && <span className="at-owes">owes {rupees(m.due)}</span>}</span>
                    <span className={!m.status && last.tone === 'red' ? 'red' : ''}>
                      {m.status
                        ? `${m.status === 'present' ? 'Present' : 'Absent'} · ${timeOf(m.at)}${m.markedBy && m.markedBy !== 'you' ? ` · by ${m.markedBy}` : ''}`
                        : last.text}
                    </span>
                  </span>
                  {m.status === 'absent' && m.phone && (
                    <a className="at-parent" target="_blank" rel="noreferrer" href={waLink(m.phone, parentMsg(m))} aria-label={`Tell ${m.name}'s parent on WhatsApp`}>
                      <WhatsAppIcon size={15} /><span>Tell parent</span>
                    </a>
                  )}
                  {canMark && (
                    <span className="att-toggle at-pa" role="group" aria-label={`${m.name} attendance`}>
                      <button type="button" aria-pressed={m.status === 'present'} aria-label={`${m.name} present`} className={m.status === 'present' ? 'on present' : ''}
                        onClick={() => mark.mutate({ memberId: m._id, status: m.status === 'present' ? null : 'present' })}>P</button>
                      <button type="button" aria-pressed={m.status === 'absent'} aria-label={`${m.name} absent`} className={m.status === 'absent' ? 'on absent' : ''}
                        onClick={() => mark.mutate({ memberId: m._id, status: m.status === 'absent' ? null : 'absent' })}>A</button>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          {(mark.error || allPresent.error) && <p className="error" role="alert" style={{ margin: '8px 16px' }}>{(mark.error || allPresent.error).message}</p>}
        </section>
      </div>
    );
  }

  return (
    <div className="at">
      <div className="page-header home-header db-head">
        <div className="page-title-wrap">
          <p className="db-date">{subtitle}</p>
          <h1 className="db-hello">Attendance</h1>
        </div>
        <nav className="db-quick" aria-label="Quick actions">
          {canMark && (
            <button type="button" className="db-quick-btn pri q-checkin" onClick={() => setPicking(true)} disabled={!notIn.length}>
              <span className="db-quick-icon"><CheckIcon size={15} /></span>
              <span className="db-quick-long">{isGym ? 'Check someone in' : 'Mark someone present'}</span><span className="db-quick-short">{isGym ? 'Check in' : 'Present'}</span>
            </button>
          )}
          {isGym && isOwner && (
            <button type="button" className="db-quick-btn q-qr" onClick={() => setShowQr(true)}>
              <span className="db-quick-icon"><CalendarCheckIcon size={15} /></span>
              <span className="db-quick-long">Show QR at the door</span><span className="db-quick-short">Show QR</span>
            </button>
          )}
          {canMark && (
            <button type="button" className="db-quick-btn q-import" onClick={() => setImporting(true)}>
              <span className="db-quick-icon"><DownloadIcon size={15} /></span>
              <span className="db-quick-long">Import from machine</span><span className="db-quick-short">Import</span>
            </button>
          )}
        </nav>
      </div>

      {/* the week at a glance; tap a day to open it */}
      <section className="at-week" aria-label="This week">
        <button type="button" className="at-week-step" aria-label="Earlier week" onClick={() => setDay(addDays(current, -7))}><ChevronIcon size={16} style={{ transform: 'rotate(180deg)' }} /></button>
        {week.map((d) => (
          <button key={d.day} type="button" className={`at-day ${d.day === current ? 'on' : ''}`} aria-pressed={d.day === current}
            aria-label={`${fmtDay(d.day, { weekday: 'long', day: 'numeric', month: 'long' })}: ${d.present} came`}
            onClick={() => setDay(d.day === today ? null : d.day)}>
            <span className="at-day-label">{dayLabel(d.day, today)}</span>
            <span className="at-day-bar"><i style={{ height: `${Math.max(4, (d.present / peak) * 100)}%` }} /></span>
            <b>{d.present}</b>
          </button>
        ))}
        <button type="button" className="at-week-step" aria-label="Later week" disabled={current >= today}
          onClick={() => { const n = addDays(current, 7); setDay(n >= today ? null : n); }}><ChevronIcon size={16} /></button>
      </section>

      <section className="db-today mx2-cards at-cards" aria-label="At a glance">
        {cards.map((c) => (
          <button key={c.label} type="button" className={`db-today-card mx2-card-btn ${c.id && tab === c.id ? 'on' : ''}`} aria-pressed={!!c.id && tab === c.id}
            onClick={() => c.id && setTab(c.id)} disabled={!c.id}>
            <span className={`db-today-icon ${c.tone}`}><c.icon size={17} /></span>
            <span className="db-today-text"><span className="db-label"><span className="lbl-long">{c.label}</span><span className="lbl-short">{c.short || c.label}</span></span><b className={c.ink || ''}>{c.value}</b></span>
            <span className="db-today-note">{c.note}</span>
          </button>
        ))}
      </section>

      <div className={`at-grid ${isGym && isOwner ? 'with-side' : ''}`}>
        <section className="mx-list mx2 at-list" aria-label="Members">
          <div className="db-tabs mx2-tabs" role="tablist" aria-label="Show">
            {tabs.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`db-tab ${tab === t.id ? 'on' : ''}`} onClick={() => setTab(t.id)}>
                <i className="db-dot" style={{ background: t.dot }} aria-hidden="true" />{t.label}<span className="db-tab-count">{t.count}</span>
              </button>
            ))}
          </div>
          <div className="at-tools">
            {tab !== 'away' ? (
              <>
                <label className="mx-search">
                  <SearchIcon size={15} />
                  <span className="sr-only">Search members</span>
                  <input type="search" placeholder={`Search a ${W.member}`} value={q} onChange={(e) => setQ(e.target.value)} />
                  {q && <button type="button" className="mx-icon-btn" onClick={() => setQ('')} aria-label="Clear search"><XIcon size={14} /></button>}
                </label>
                {groups.length > 0 && (
                  <div className="st-seg at-groups-seg" role="radiogroup" aria-label="Batch">
                    {[{ _id: '', name: 'Everyone' }, ...groups].map((g) => (
                      <button key={g._id} type="button" role="radio" aria-checked={groupId === g._id} className={groupId === g._id ? 'on' : ''} onClick={() => setGroupId(g._id)}>{g.name}</button>
                    ))}
                  </div>
                )}
                {canMark && tab === 'notin' && notIn.length > 0 && (
                  <button type="button" className="btn-secondary at-all" disabled={allPresent.isPending} onClick={() => allPresent.mutate()}>
                    <CheckIcon size={14} /> Mark all {notIn.length} present
                  </button>
                )}
              </>
            ) : (
              <>
                <span className="at-away-hint">Call or message them before they quit. Paused {W.member}s aren't listed.</span>
                <div className="st-seg" role="radiogroup" aria-label="Away for at least">
                  {[7, 14, 30].map((d) => (
                    <button key={d} type="button" role="radio" aria-checked={awayDays === d} className={awayDays === d ? 'on' : ''} onClick={() => setAwayDays(d)}>{d}+ days</button>
                  ))}
                </div>
              </>
            )}
          </div>

          {tab === 'away' ? (
            <ul className="at-rows">
              {away && !away.members.length && <li className="at-empty">Everyone has come in the last {awayDays} days.</li>}
              {away?.members.map((m) => (
                <li key={m._id} className="at-row">
                  <Avatar name={m.name} />
                  <span className="at-who"><b>{m.name}</b><span className="red">{m.lastPresent ? `Last came ${fmtDay(m.lastPresent, { day: 'numeric', month: 'short' })} · ${m.daysAway} days ago` : `Not seen since joining · ${m.daysAway} days`}</span></span>
                  {m.phone && (
                    <span className="at-actions">
                      <a className="mx2-open" href={`tel:${m.phone}`} aria-label={`Call ${m.name}`}><PhoneIcon size={15} /></a>
                      <a className="at-wa" target="_blank" rel="noreferrer" href={waLink(m.phone, `Hi ${m.name.split(' ')[0]}, we haven't seen you at ${biz.name} ${m.lastPresent ? `since ${fmtDay(m.lastPresent, { day: 'numeric', month: 'short' })}` : 'yet'}. Hope all is well. See you soon!`)}>
                        <WhatsAppIcon size={15} /> WhatsApp
                      </a>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <ul className="at-rows">
              {!members.length && <li className="at-empty">No active {W.member}s{groupId ? ' in this batch' : ''}.</li>}
              {members.length > 0 && !rows.filter(match).length && (
                <li className="at-empty">{query ? `Nobody matches “${q}”.` : tab === 'notin' ? (isGym ? 'Everyone is in. 🎉' : 'Everyone is marked.') : tab === 'in' ? 'Nobody yet.' : 'Nobody absent.'}</li>
              )}
              {rows.filter(match).map((m) => {
                const last = lastText(m);
                const info = sub(m);
                return (
                  <li key={m._id} className="at-row">
                    <Avatar name={m.name} />
                    <span className="at-who">
                      <span className="at-name-row"><b>{m.name}</b>{m.due > 0 && <span className="at-owes">owes {rupees(m.due)}</span>}</span>
                      <span>
                        {m.status === 'present'
                          ? `${timeOf(m.at)} · ${m.method === 'staff' && m.markedBy ? `marked by ${m.markedBy}` : HOW[m.method] || 'marked'}`
                          : info || 'No plan'}
                      </span>
                    </span>
                    {m.status !== 'present' && <span className={`at-last ${last.tone}`}>{last.text}</span>}
                    {canMark && (isGym ? (
                      m.status === 'present'
                        ? <button type="button" className="btn-secondary at-btn" onClick={() => mark.mutate({ memberId: m._id, status: null })}>Undo</button>
                        : <button type="button" className="btn at-btn" onClick={() => mark.mutate({ memberId: m._id, status: 'present' })}>Check in</button>
                    ) : (
                      <span className="att-toggle" role="group" aria-label={`${m.name} attendance`}>
                        <button type="button" aria-pressed={m.status === 'present'} aria-label={`${m.name} present`} className={m.status === 'present' ? 'on present' : ''}
                          onClick={() => mark.mutate({ memberId: m._id, status: m.status === 'present' ? null : 'present' })}><CheckIcon size={15} /> <span>Present</span></button>
                        <button type="button" aria-pressed={m.status === 'absent'} aria-label={`${m.name} absent`} className={m.status === 'absent' ? 'on absent' : ''}
                          onClick={() => mark.mutate({ memberId: m._id, status: m.status === 'absent' ? null : 'absent' })}><XIcon size={15} /> <span>Absent</span></button>
                      </span>
                    ))}
                  </li>
                );
              })}
            </ul>
          )}
          {(mark.error || allPresent.error) && <p className="error" role="alert" style={{ margin: '8px 16px' }}>{(mark.error || allPresent.error).message}</p>}
        </section>

        {isGym && isOwner && (
          <aside className="at-side">
            <CheckinQR biz={biz} onShow={() => setShowQr(true)} />
            {present.length > 0 && (
              <section className="st-card at-how">
                <b>How they checked in {isToday ? 'today' : fmtDay(current, { day: 'numeric', month: 'short' })}</b>
                {methods.map(([k, n]) => (
                  <div key={k} className="mr-split-row">
                    <span className="mr-split-top"><span>{{ qr: 'Scanned QR', biometric: 'Fingerprint machine', staff: 'Marked by staff' }[k]}</span><b>{n}</b></span>
                    <span className="mr-track"><i className={`at-m-${k}`} style={{ width: `${(n / present.length) * 100}%` }} /></span>
                  </div>
                ))}
              </section>
            )}
          </aside>
        )}
      </div>

      <AnimatePresence>
        {importing && (
          <Suspense fallback={null}>
            <AttendanceImport biz={biz} onClose={() => setImporting(false)} />
          </Suspense>
        )}
        {picking && (
          <PickMember
            members={notIn.filter((m) => !m.paused).map((m) => ({ ...m, status: 'active', balance: m.due }))}
            word={W.member}
            onClose={() => setPicking(false)}
            onPick={(m) => { setPicking(false); mark.mutate({ memberId: m._id, status: 'present' }); }}
          />
        )}
      </AnimatePresence>
      {showQr && <DoorQR biz={biz} onClose={() => setShowQr(false)} />}
    </div>
  );
}

// Tuition: the day starts here. One card per batch with how far its roll call has got;
// tap one to take attendance for just that batch.
function BatchList({ W, groups, data, canMark, onDay, onPick, onImport }) {
  const { today, day: current } = data;
  const Member = W.member[0].toUpperCase() + W.member.slice(1);
  const live = data.members.filter((m) => !m.paused);
  const batches = groups.map((g) => {
    const inG = live.filter((m) => String(m.groupId) === g._id);
    const p = inG.filter((m) => m.status === 'present').length;
    const a = inG.filter((m) => m.status === 'absent').length;
    return { ...g, total: inG.length, present: p, absent: a, left: inG.length - p - a };
  });
  const noBatch = live.filter((m) => !groups.some((g) => g._id === String(m.groupId || '')));
  const withKids = batches.filter((b) => b.total);
  const doneCount = withKids.filter((b) => !b.left).length;
  const first = withKids.find((b) => b.left);
  const older = current < addDays(today, -2);

  return (
    <div className="at at-batches">
      <div className="page-header home-header db-head">
        <div className="page-title-wrap">
          <p className="db-date">{fmtDay(current, { weekday: 'long', day: 'numeric', month: 'long' })}{withKids.length ? ` · ${doneCount} of ${withKids.length} ${W.groups.toLowerCase()} done` : ''}</p>
          <h1 className="db-hello">Attendance</h1>
        </div>
        <nav className="db-quick" aria-label="Quick actions">
          {canMark && first && (
            <button type="button" className="db-quick-btn pri" onClick={() => onPick(first._id)}>
              <span className="db-quick-icon"><CheckIcon size={15} /></span>
              <span className="db-quick-long">Take {first.name}</span><span className="db-quick-short">Start</span>
            </button>
          )}
          {canMark && (
            <button type="button" className="db-quick-btn q-import" onClick={onImport}>
              <span className="db-quick-icon"><DownloadIcon size={15} /></span>
              <span className="db-quick-long">Import from machine</span><span className="db-quick-short">Import</span>
            </button>
          )}
        </nav>
      </div>

      <div className="at-daypick" role="radiogroup" aria-label="Day">
        {[0, -1, -2].map((n) => {
          const d = addDays(today, n);
          return (
            <button key={d} type="button" role="radio" aria-checked={current === d} className={current === d ? 'on' : ''} onClick={() => onDay(n === 0 ? null : d)}>
              {dayLabel(d, today)}
            </button>
          );
        })}
        <label className={`at-daypick-other ${older ? 'on' : ''}`}>
          <CalendarCheckIcon size={14} />
          <span>{older ? fmtDay(current, { day: 'numeric', month: 'short' }) : 'Other day'}</span>
          <ChevronDownIcon size={13} />
          <input type="date" max={today} value={current} aria-label="Pick a day" onChange={(e) => e.target.value && onDay(e.target.value === today ? null : e.target.value)} />
        </label>
      </div>

      {!groups.length ? (
        <section className="analytics-card at-nobatch">
          <LayersIcon size={26} />
          <h2>Create your first {W.group.toLowerCase()}</h2>
          <p className="muted">Attendance is taken {W.group.toLowerCase()} by {W.group.toLowerCase()}. Make one like “Class 10 · 5 PM”, put {W.member}s in it, then take the roll here.</p>
          <Link to="/setup" className="btn">Create a {W.group.toLowerCase()}</Link>
        </section>
      ) : (
        <ul className="at-batch-grid">
          {batches.map((b) => {
            const state = !b.total ? 'nokids' : !b.left ? 'done' : b.present + b.absent ? 'part' : 'todo';
            return (
              <li key={b._id}>
                <button type="button" className={`at-batch ${state}`} onClick={() => onPick(b._id)}>
                  <span className="at-batch-top">
                    <b>{b.name}</b>
                    <span className={`at-batch-tag ${state}`}>
                      {state === 'done' ? <><CheckIcon size={12} /> Done</> : state === 'part' ? `${b.left} left` : state === 'todo' ? 'Not taken' : `No ${W.member}s`}
                    </span>
                  </span>
                  <span className="at-batch-sub">
                    {b.total
                      ? <>{b.total} {W.member}{b.total === 1 ? '' : 's'}{b.present + b.absent > 0 && <> · <i className="g">{b.present} present</i>{b.absent > 0 && <> · <i className="r">{b.absent} absent</i></>}</>}</>
                      : `Add ${W.member}s to this ${W.group.toLowerCase()} first`}
                  </span>
                  <span className="at-progress-bar" aria-hidden="true">
                    <i className="g" style={{ width: `${b.total ? (b.present / b.total) * 100 : 0}%` }} />
                    <i className="r" style={{ width: `${b.total ? (b.absent / b.total) * 100 : 0}%` }} />
                  </span>
                  <span className="at-batch-go">{state === 'done' ? 'View or change' : state === 'part' ? 'Continue' : state === 'todo' ? 'Take attendance' : 'Open'} <ChevronIcon size={14} /></span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {noBatch.length > 0 && groups.length > 0 && (
        <p className="at-nobatch-note">
          <AlertIcon size={14} />
          <span>{noBatch.length} {W.member}{noBatch.length === 1 ? ' has' : 's have'} no {W.group.toLowerCase()} and {noBatch.length === 1 ? 'is' : 'are'} not listed here. Open them on the <Link to="/members">{Member}s</Link> page and pick a {W.group.toLowerCase()}.</span>
        </p>
      )}
    </div>
  );
}

// the check-in link and its QR, shared by the side card and the full-screen view
function useCheckinQr(biz, enabled = true) {
  const [svg, setSvg] = useState('');
  const { data } = useQuery({
    queryKey: ['checkin-link', biz._id],
    queryFn: () => api(`/businesses/${biz._id}/checkin-link`, { method: 'POST' }),
    enabled,
    staleTime: Infinity,
  });
  const url = data?.token && `${location.origin}/c/${data.token}`;
  useEffect(() => {
    if (!url) return;
    QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }).then(setSvg);
  }, [url]);
  return svg;
}

// Gym owner: the QR members scan at the entrance, a printable poster, and a reset
function CheckinQR({ biz, onShow }) {
  const qc = useQueryClient();
  const svg = useCheckinQr(biz);
  const [confirmReset, setConfirmReset] = useState(false);
  const reset = useMutation({
    mutationFn: () => api(`/businesses/${biz._id}/checkin-link`, { method: 'POST', body: { rotate: true } }),
    onSuccess: (d) => qc.setQueryData(['checkin-link', biz._id], d),
  });
  // print only the poster: the body class hides everything else while printing
  const printPoster = () => {
    document.body.classList.add('printing-poster');
    const done = () => { document.body.classList.remove('printing-poster'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.print();
  };

  return (
    <section className="st-card at-qr-card">
      <b>Check-in QR</b>
      <button type="button" className="at-qr-big" onClick={onShow} aria-label="Show the QR full screen" dangerouslySetInnerHTML={{ __html: svg }} />
      <span className="st-dim">Members scan this at the door and enter their mobile number. No app needed.</span>
      <span className="at-qr-actions">
        <button type="button" className="btn-secondary" disabled={!svg} onClick={printPoster}><PrinterIcon size={14} /> Print poster</button>
        <button type="button" className="btn-secondary" onClick={() => setConfirmReset(true)}>Reset</button>
      </span>
      {/* what gets printed */}
      <div className="qr-poster" aria-hidden="true">
        <h1>{biz.name}</h1>
        <p className="qr-poster-sub">Scan to check in</p>
        <div className="qr-poster-code" dangerouslySetInnerHTML={{ __html: svg }} />
        <p>Open your phone camera, point it at the code, then enter your mobile number.</p>
      </div>
      <ConfirmDialog
        isOpen={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={() => { reset.mutate(); setConfirmReset(false); }}
        title="Reset the check-in QR?"
        message="Posters you already printed will stop working. Use this if the code was shared outside the gym, then print a new poster."
        confirmText="Reset QR"
        danger
        busy={reset.isPending}
      />
    </section>
  );
}

// Full screen, for a tablet or laptop at the entrance
function DoorQR({ biz, onClose }) {
  const svg = useCheckinQr(biz);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="at-door" role="dialog" aria-modal="true" aria-label="Check-in QR">
      <button type="button" className="at-door-x" onClick={onClose} aria-label="Close"><XIcon size={18} /></button>
      <h2>{biz.name}</h2>
      <p>Scan to check in</p>
      <div className="at-door-code" dangerouslySetInnerHTML={{ __html: svg }} />
      <span>Open your phone camera, point it at the code, then enter your mobile number.</span>
    </div>
  );
}

