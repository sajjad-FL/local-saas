import { useEffect, useState, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { AnimatePresence } from 'framer-motion';
import { api, userId, waLink } from '../api.js';
import { useBiz } from '../App.jsx';
import { Avatar, ChevronIcon, CheckIcon, XIcon, SearchIcon, PrinterIcon, ConfirmDialog, CalendarCheckIcon, DownloadIcon, PhoneIcon, WhatsAppIcon } from '../ui.jsx';

const AttendanceImport = lazy(() => import('./AttendanceImport.jsx')); // brings in the Excel reader only when used

const addDays = (day, n) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const dayLabel = (day, today) => {
  if (day === today) return 'Today';
  if (day === addDays(today, -1)) return 'Yesterday';
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
};
const timeOf = (at) => new Date(at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

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
  const isGym = biz.type === 'gym';
  const [day, setDay] = useState(null); // null = today (the server decides "today" in the business's timezone)
  const [groupId, setGroupId] = useState('');
  const [q, setQ] = useState('');
  const [view, setView] = useState('today'); // 'today' | 'away'
  const [importing, setImporting] = useState(false);

  const { data: groups = [] } = useQuery({
    queryKey: ['groups', biz._id],
    queryFn: () => api(`/businesses/${biz._id}/groups`),
  });
  const key = ['attendance', biz._id, day, groupId];
  const { data } = useQuery({
    queryKey: key,
    queryFn: () => api(`/businesses/${biz._id}/attendance?${new URLSearchParams({ ...(day && { day }), ...(groupId && { groupId }) })}`),
    placeholderData: (prev) => prev,
    refetchInterval: isGym ? 30000 : false, // gym: new QR check-ins appear without refreshing
  });

  const mark = useMutation({
    mutationFn: ({ memberId, status }) => api(`/businesses/${biz._id}/attendance`, { method: 'PUT', body: { day: data.day, memberId, status } }),
    // update the list at once; the server response confirms it
    onMutate: async ({ memberId, status }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData(key);
      qc.setQueryData(key, (old) => old && {
        ...old,
        members: old.members.map((m) => (m._id === memberId ? { ...m, status, method: status && 'staff', at: status && new Date().toISOString() } : m)),
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(key, ctx.prev),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['attendance', biz._id] });
      qc.invalidateQueries({ queryKey: ['member-attendance'] });
    },
  });
  const allPresent = useMutation({
    mutationFn: () => api(`/businesses/${biz._id}/attendance/all-present`, { method: 'POST', body: { day: data.day, groupId: groupId || undefined } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attendance', biz._id] }),
  });

  if (!data) return <div className="card skeleton" style={{ minHeight: 320 }} aria-hidden="true" />;

  const today = data.today;
  const current = data.day;
  const members = data.members;
  // counts recomputed from the list so optimistic changes show at once
  const present = members.filter((m) => m.status === 'present').length;
  const absent = members.filter((m) => m.status === 'absent').length;
  const unmarked = members.length - present - absent;
  const found = q.trim() ? members.filter((m) => `${m.name} ${m.phone || ''}`.toLowerCase().includes(q.trim().toLowerCase())) : members;

  return (
    <>
      <div className="page-header">
        <div className="page-title-wrap">
          <h1 className="page-title">Attendance</h1>
          <p className="page-subtitle">
            {isGym ? 'Members check in by scanning your QR code, or import from your fingerprint/face machine.' : 'Mark who came today. Attendance is only recorded; fees are not affected.'}
          </p>
        </div>
        <button type="button" className="btn-secondary att-import-btn" onClick={() => setImporting(true)}>
          <DownloadIcon size={15} /> Import from machine
        </button>
      </div>

      <div className="money-tabs att-view" role="tablist" aria-label="Attendance view">
        <button type="button" role="tab" aria-selected={view === 'today'} className={view === 'today' ? 'active' : ''} onClick={() => setView('today')}>By day</button>
        <button type="button" role="tab" aria-selected={view === 'away'} className={view === 'away' ? 'active' : ''} onClick={() => setView('away')}>Not coming</button>
      </div>

      <AnimatePresence>
        {importing && (
          <Suspense fallback={null}>
            <AttendanceImport biz={biz} onClose={() => setImporting(false)} />
          </Suspense>
        )}
      </AnimatePresence>

      {view === 'away' ? <NotComing biz={biz} /> : (
      <>

      {/* Day and group */}
      <div className="analytics-card att-controls">
        <div className="money-stepper">
          <button type="button" className="btn-secondary" aria-label="Previous day" onClick={() => setDay(addDays(current, -1))}>
            <ChevronIcon size={16} style={{ transform: 'rotate(180deg)' }} />
          </button>
          <div className="money-stepper-label">
            <b>{dayLabel(current, today)}</b>
            <span className="muted small">{new Date(`${current}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}</span>
          </div>
          <button type="button" className="btn-secondary" aria-label="Next day" disabled={current >= today}
            onClick={() => setDay(addDays(current, 1) >= today ? null : addDays(current, 1))}>
            <ChevronIcon size={16} />
          </button>
        </div>
        {groups.length > 0 && (
          <div className="att-groups" role="tablist" aria-label="Group">
            {[{ _id: '', name: 'Everyone' }, ...groups].map((g) => (
              <button key={g._id} type="button" role="tab" aria-selected={groupId === g._id}
                className={groupId === g._id ? 'active' : ''} onClick={() => setGroupId(g._id)}>
                {g.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* The count */}
      <div className="analytics-card att-summary">
        <div>
          <b className="att-count">{present} <span>of {members.length} {isGym ? 'checked in' : 'present'}</span></b>
          {!isGym && <span className="muted small">{absent} absent · {unmarked} not marked</span>}
        </div>
        <div className="money-bar att-bar"><i className="in" style={{ width: `${members.length ? (present / members.length) * 100 : 0}%` }} /></div>
        {!isGym && unmarked > 0 && (
          <button type="button" className="btn" disabled={allPresent.isPending} onClick={() => allPresent.mutate()}>
            <CheckIcon size={15} /> Mark {unmarked === members.length ? 'all' : `remaining ${unmarked}`} present
          </button>
        )}
      </div>

      {isGym && <CheckinQR biz={biz} />}

      {/* The list */}
      <div className="analytics-card">
        {members.length > 6 && (
          <div className="search-input-wrap att-search">
            <SearchIcon size={14} className="search-icon" />
            <input type="search" placeholder="Search members" aria-label="Search members" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        )}
        {!members.length && <p className="muted" style={{ margin: 4 }}>No active members{groupId ? ' in this group' : ''}.</p>}

        {isGym ? (
          <>
            {found.filter((m) => m.status === 'present').sort((a, b) => new Date(b.at) - new Date(a.at)).map((m) => (
              <div key={m._id} className="att-row">
                <Avatar name={m.name} />
                <div className="att-name">
                  <b>{m.name}</b>
                  <span className="green-text">
                    ✓ {timeOf(m.at)} · {m.method === 'qr' ? 'QR' : m.method === 'biometric' ? 'machine' : 'by staff'}
                    {m.due > 0 && <span className="att-due"> · ₹{m.due.toLocaleString('en-IN')} due</span>}
                  </span>
                </div>
                <button type="button" className="btn-link small" onClick={() => mark.mutate({ memberId: m._id, status: null })}>Undo</button>
              </div>
            ))}
            {found.some((m) => m.status !== 'present') && <h3 className="att-subhead">Not checked in {current === today ? 'yet' : ''}</h3>}
            {found.filter((m) => m.status !== 'present').map((m) => (
              <div key={m._id} className="att-row">
                <Avatar name={m.name} />
                <div className="att-name">
                  <b>{m.name}</b>
                  {m.paused && <span className="muted">Paused</span>}
                </div>
                <button type="button" className="btn-secondary att-checkin" onClick={() => mark.mutate({ memberId: m._id, status: 'present' })}>
                  Check in
                </button>
              </div>
            ))}
          </>
        ) : (
          found.map((m) => (
            <div key={m._id} className={`att-row ${m.status || ''}`}>
              <Avatar name={m.name} />
              <div className="att-name">
                <b>{m.name}</b>
                {m.paused && <span className="muted">Paused</span>}
              </div>
              <div className="att-toggle" role="group" aria-label={`${m.name} attendance`}>
                <button type="button" aria-pressed={m.status === 'present'} aria-label={`${m.name} present`} title="Present"
                  className={m.status === 'present' ? 'on present' : ''}
                  onClick={() => mark.mutate({ memberId: m._id, status: m.status === 'present' ? null : 'present' })}>
                  <CheckIcon size={15} /> <span>Present</span>
                </button>
                <button type="button" aria-pressed={m.status === 'absent'} aria-label={`${m.name} absent`} title="Absent"
                  className={m.status === 'absent' ? 'on absent' : ''}
                  onClick={() => mark.mutate({ memberId: m._id, status: m.status === 'absent' ? null : 'absent' })}>
                  <XIcon size={15} /> <span>Absent</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      {mark.error && <p className="error" role="alert">{mark.error.message}</p>}
      </>
      )}
    </>
  );
}

// The call list: who hasn't come in a while, with call and WhatsApp in one tap
function NotComing({ biz }) {
  const [days, setDays] = useState(7);
  const { data } = useQuery({
    queryKey: ['not-coming', biz._id, days],
    queryFn: () => api(`/businesses/${biz._id}/attendance/not-coming?days=${days}`),
    placeholderData: (prev) => prev,
  });
  const fmt = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const firstName = (n) => n.split(' ')[0];

  return (
    <>
      <div className="analytics-card att-summary">
        <div>
          <b className="att-count">{data?.members.length ?? '–'} <span>member{data?.members.length === 1 ? '' : 's'} not seen in {days}+ days</span></b>
          <span className="muted small">Call or message them before they quit. Paused members aren't listed.</span>
        </div>
        <div className="att-groups" role="tablist" aria-label="Away for at least">
          {[7, 14, 30].map((d) => (
            <button key={d} type="button" role="tab" aria-selected={days === d} className={days === d ? 'active' : ''} onClick={() => setDays(d)}>
              {d}+ days
            </button>
          ))}
        </div>
      </div>
      <div className="analytics-card">
        {data && !data.members.length && <p className="muted" style={{ margin: 4 }}>Everyone has come in the last {days} days.</p>}
        {data?.members.map((m) => (
          <div key={m._id} className="att-row">
            <Avatar name={m.name} />
            <div className="att-name">
              <b>{m.name}</b>
              <span className="red-text">
                {m.lastPresent ? `Last came ${fmt(m.lastPresent)} · ${m.daysAway} days ago` : `Not seen since joining · ${m.daysAway} days`}
              </span>
            </div>
            {m.phone && (
              <>
                <a className="btn btn-secondary today-icon-btn att-call" href={`tel:${m.phone}`} aria-label={`Call ${m.name}`} title="Call">
                  <PhoneIcon size={17} />
                </a>
                <a className="btn btn-secondary today-icon-btn" target="_blank" rel="noreferrer" aria-label={`WhatsApp ${m.name}`} title="WhatsApp"
                  href={waLink(m.phone, `Hi ${firstName(m.name)}, we haven't seen you at ${biz.name} ${m.lastPresent ? `since ${fmt(m.lastPresent)}` : 'yet'}. Hope all is well. See you soon!`)}>
                  <WhatsAppIcon size={18} />
                </a>
              </>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

// Gym owner: the QR members scan at the entrance, a printable poster, and a reset
function CheckinQR({ biz }) {
  const qc = useQueryClient();
  const isOwner = biz.ownerId === userId();
  const [svg, setSvg] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [open, setOpen] = useState(false); // printed once, so it stays folded and the check-ins come first
  const { data } = useQuery({
    queryKey: ['checkin-link', biz._id],
    queryFn: () => api(`/businesses/${biz._id}/checkin-link`, { method: 'POST' }),
    enabled: isOwner,
    staleTime: Infinity,
  });
  const reset = useMutation({
    mutationFn: () => api(`/businesses/${biz._id}/checkin-link`, { method: 'POST', body: { rotate: true } }),
    onSuccess: (d) => qc.setQueryData(['checkin-link', biz._id], d),
  });
  const url = data?.token && `${location.origin}/c/${data.token}`;

  useEffect(() => {
    if (!url) return;
    QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }).then(setSvg);
  }, [url]);

  // print only the poster: the body class hides everything else while printing
  const printPoster = () => {
    document.body.classList.add('printing-poster');
    const done = () => { document.body.classList.remove('printing-poster'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.print();
  };

  if (!isOwner) return null;
  if (!open) {
    return (
      <button type="button" className="analytics-card att-qr-folded" onClick={() => setOpen(true)} aria-expanded="false">
        <span className="att-qr-mini" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />
        <span className="att-qr-folded-text">
          <b>Check-in QR</b>
          <span className="muted small">Show, print the poster or reset it</span>
        </span>
        <ChevronIcon size={16} style={{ transform: 'rotate(90deg)' }} />
      </button>
    );
  }
  return (
    <div className="analytics-card att-qr">
      <div className="att-qr-code" aria-label="Check-in QR code" dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="att-qr-text">
        <h3 className="analytics-card-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <CalendarCheckIcon size={17} style={{ color: 'var(--primary)' }} /> Check-in QR
        </h3>
        <p className="muted small" style={{ margin: '4px 0 12px' }}>
          Print it and stick it at the entrance. Members scan it with their phone camera and enter their mobile number. No app needed.
        </p>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn" disabled={!svg} onClick={printPoster}><PrinterIcon size={15} /> Print poster</button>
          <button type="button" className="btn-secondary" onClick={() => setConfirmReset(true)}>Reset QR</button>
          <button type="button" className="btn-link small" onClick={() => setOpen(false)}>Hide</button>
        </div>
      </div>

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
    </div>
  );
}
