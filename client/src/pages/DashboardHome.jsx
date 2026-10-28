import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { api, rupees, waLink, remindMsg } from '../api.js';
import { words } from '../wording.js';
import { Avatar, WhatsAppIcon, CheckIcon, PlusIcon, CheckCircleIcon, ChevronIcon, BedIcon } from '../ui.jsx';
import { CollectPaymentModal, roomLabel } from './Members.jsx';
import BulkRemind, { owingMessage } from '../BulkRemind.jsx';

const DAY = 86400000;
const shortDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const daysSince = (d) => Math.max(0, Math.floor((Date.now() - new Date(d)) / DAY));
const daysUntil = (d) => Math.ceil((new Date(d) - Date.now()) / DAY);
const inDays = (n) => (n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const natural = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true });

// Home screen for every screen size. It answers, in order: how much is owed, how this
// month is going, who to collect from, and who renews soon. Charts live in Reports.
export default function DashboardHome({ biz, data, onAddMember }) {
  const qc = useQueryClient();
  const w = words(biz.type);
  const isHostel = biz.type === 'hostel';
  const [collect, setCollect] = useState(null);
  const [remindAll, setRemindAll] = useState(false);
  const { pending = [], pendingTotal = 0, activeMembers = 0, membersTable = [] } = data;

  // this month's money, from the same report the Reports page uses
  const now = new Date();
  const monthName = now.toLocaleDateString('en-IN', { month: 'long' });
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
  const { data: month } = useQuery({
    queryKey: ['report', biz._id, 'home', from],
    queryFn: () => api(`/businesses/${biz._id}/report?from=${from}&to=${to}&tz=${now.getTimezoneOffset()}`),
  });

  const { data: attendance } = useQuery({
    queryKey: ['attendance', biz._id, null, ''],
    queryFn: () => api(`/businesses/${biz._id}/attendance`),
    enabled: biz.attendanceEnabled !== false,
  });

  // hostels: beds and where each tenant stays (same queries as the Members page)
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
  const roomOf = (m) => rooms.find((r) => r._id === (m.roomId?._id || m.roomId));

  const owing = pending.slice(0, 6);
  const upcoming = membersTable
    .filter((m) => m.status === 'active' && m.balance <= 0 && m.nextRenewal && daysUntil(m.nextRenewal) >= 0)
    .sort((a, b) => new Date(a.nextRenewal) - new Date(b.nextRenewal));
  const renewingSoon = upcoming.filter((m) => daysUntil(m.nextRenewal) <= 14).slice(0, 6);

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

  const received = month?.received ?? 0;
  const spent = month?.expenses ?? 0;
  const profit = month?.profit ?? 0;
  // of everything billed and still open, how much is already in hand this month
  const collectedPct = received + pendingTotal > 0 ? Math.round((received / (received + pendingTotal)) * 100) : 100;

  const beds = rooms.reduce((s, r) => s + r.capacity, 0);
  const filled = rooms.reduce((s, r) => s + Math.min(r.occupied, r.capacity), 0);
  const freeRooms = rooms
    .filter((r) => r.occupied < r.capacity)
    .sort((a, b) => (b.capacity - b.occupied) - (a.capacity - a.occupied) || natural(a.roomNo, b.roomNo));

  const recent = data.recentPayments || [];
  const MODE = { cash: 'Cash', upi: 'UPI', card: 'Card', bank_transfer: 'Bank transfer', bank: 'Bank transfer' };

  return (
    <div className="today">
      {/* the month in four numbers; each opens the page with the detail */}
      <div className="dash-kpis">
        <Link to="/members?filter=owing" className={`dash-kpi ${pendingTotal > 0 ? 'red' : 'green'}`}>
          <span className="dash-kpi-label">To collect</span>
          <b>{rupees(pendingTotal)}</b>
          <span className="dash-kpi-sub">{pendingTotal > 0 ? `${plural(pending.length, w.member)} owe` : 'Everyone has paid'}</span>
        </Link>
        <Link to="/reports" className="dash-kpi blue">
          <span className="dash-kpi-label">Collected · {monthName}</span>
          <b>{rupees(received)}</b>
          <span className="dash-kpi-bar" aria-label={`${collectedPct}% collected`}><i style={{ width: `${collectedPct}%` }} /></span>
          <span className="dash-kpi-sub">{collectedPct}% of this month's fees</span>
        </Link>
        <Link to="/reports?view=expenses" className="dash-kpi amber">
          <span className="dash-kpi-label">Spent · {monthName}</span>
          <b>{rupees(spent)}</b>
          <span className="dash-kpi-sub">{spent ? 'rent, salaries, bills' : 'no expenses yet'}</span>
        </Link>
        <Link to="/reports" className={`dash-kpi ${profit < 0 ? 'red' : 'violet'}`}>
          <span className="dash-kpi-label">{profit < 0 ? 'Loss' : 'Profit'} · {monthName}</span>
          <b>{profit < 0 ? '−' : ''}{rupees(Math.abs(profit))}</b>
          <span className="dash-kpi-sub">received minus spent</span>
        </Link>
      </div>

      <div className="today-grid">
      <div className="today-main">
        {/* Who owes: collect or remind in one tap */}
        {owing.length > 0 ? (
          <section className="today-section">
            <div className="today-section-head">
              <h2>Needs payment <span className="dash-count">{pending.length}</span></h2>
              <span className="dash-head-actions">
                {pending.length > 1 && (
                  <button type="button" className="remind-all-btn" onClick={() => setRemindAll(true)}>
                    <WhatsAppIcon size={13} /> Remind all
                  </button>
                )}
                <Link to="/members?filter=owing">{pending.length > owing.length ? `See all ${pending.length}` : 'Open list'}</Link>
              </span>
            </div>
            {owing.map((m) => {
              const room = isHostel && roomOf(m);
              const late = m.dueSince ? daysSince(m.dueSince) : 0;
              return (
                <div key={m._id} className="today-row dash-row">
                  <Link to={`/members/${m._id}`} className="today-person">
                    <Avatar name={m.name} />
                    <div className="today-person-text">
                      <b>{m.name}</b>
                      {room ? (
                        <span className="muted dash-room"><BedIcon size={12} /> {roomLabel(room, groups)}</span>
                      ) : (
                        <span className="muted">{m.phone || 'No phone'}</span>
                      )}
                    </div>
                  </Link>
                  <div className="dash-due">
                    <b>{rupees(m.balance)}</b>
                    <span className={late > 0 ? 'red-text' : 'muted'}>{late > 0 ? `${plural(late, 'day')} late` : 'due today'}</span>
                  </div>
                  <div className="today-actions">
                    {m.phone && (
                      <a className="btn btn-secondary today-icon-btn" target="_blank" rel="noreferrer"
                        aria-label={`Send WhatsApp reminder to ${m.name}`} title="Send WhatsApp reminder"
                        href={waLink(m.phone, remindMsg(biz, m.name, m.balance))}>
                        <WhatsAppIcon size={17} />
                      </a>
                    )}
                    <button type="button" className="today-collect" onClick={() => setCollect(m)}>
                      <CheckIcon size={14} /> Collect
                    </button>
                  </div>
                </div>
              );
            })}
          </section>
        ) : (
          <div className="dash-clear" role="status">
            <CheckCircleIcon size={18} />
            <span><b>All fees are paid.</b> Nobody owes anything right now.</span>
          </div>
        )}

        {/* The latest money in */}
        <section className="today-section">
          <div className="today-section-head">
            <h2>Recent payments</h2>
            <Link to="/reports">Reports</Link>
          </div>
          {recent.length ? recent.map((p) => (
            <Link key={p._id} to={`/members/${p.memberId}`} className="today-row dash-row dash-pay">
              <Avatar name={p.name} />
              <div className="today-person-text">
                <b>{p.name}</b>
                <span className="muted">{shortDate(p.date)} · {MODE[p.mode] || 'Cash'}</span>
              </div>
              <b className="dash-pay-amount">+{rupees(p.amount)}</b>
            </Link>
          )) : (
            <p className="today-empty">No payments yet. They'll show up here as you collect them.</p>
          )}
        </section>
      </div>

      <div className="today-side">
        {/* 3. Hostels: how full the place is, and where the free beds are */}
        {isHostel && beds > 0 ? (
          <Link to="/rooms" className="today-section dash-beds">
            <div className="today-section-head">
              <h2>Beds</h2>
              <ChevronIcon size={14} />
            </div>
            <div className="dash-beds-count">
              <b>{filled}</b><span>of {plural(beds, 'bed')} filled</span>
            </div>
            <div className="dash-progress-bar"><i style={{ width: `${Math.round((filled / beds) * 100)}%` }} /></div>
            {freeRooms.length ? (
              <ul className="dash-free">
                {freeRooms.slice(0, 4).map((r) => (
                  <li key={r._id}>
                    <span>{roomLabel(r, groups)}</span>
                    <b>{plural(r.capacity - r.occupied, 'free bed')}</b>
                  </li>
                ))}
                {freeRooms.length > 4 && <li className="muted">+{plural(freeRooms.length - 4, 'more room')} with space</li>}
              </ul>
            ) : (
              <p className="today-empty">Every bed is taken.</p>
            )}
          </Link>
        ) : (
          <Link to="/members" className="today-section dash-beds">
            <div className="today-section-head">
              <h2>Active {w.member}s</h2>
              <ChevronIcon size={14} />
            </div>
            <div className="dash-beds-count"><b>{activeMembers}</b><span>right now</span></div>
          </Link>
        )}

        {/* 4. Renewals: a heads-up before they become dues */}
        <section className="today-section">
          <div className="today-section-head">
            <h2>Renewing soon</h2>
          </div>
          {renewingSoon.length ? renewingSoon.map((m) => (
            <div key={m._id} className="today-row dash-row">
              <Link to={`/members/${m._id}`} className="today-person">
                <Avatar name={m.name} />
                <div className="today-person-text">
                  <b>{m.name}</b>
                  <span className="muted">{rupees(m.planAmount)} on {shortDate(m.nextRenewal)} · {inDays(daysUntil(m.nextRenewal))}</span>
                </div>
              </Link>
              {m.phone && (
                <a className="btn btn-secondary today-icon-btn" target="_blank" rel="noreferrer"
                  aria-label={`Remind ${m.name} about renewal`} title="Send renewal reminder"
                  href={waLink(m.phone, `Hi ${m.name}, your ${biz.name} plan renews on ${shortDate(m.nextRenewal)} (${rupees(m.planAmount)}). Thank you!`)}>
                  <WhatsAppIcon size={17} />
                </a>
              )}
            </div>
          )) : (
            <p className="today-empty">
              Nobody renews in the next 2 weeks.
              {upcoming[0] && <> Next: <b>{upcoming[0].name}</b> on {shortDate(upcoming[0].nextRenewal)}.</>}
            </p>
          )}
        </section>

        {/* 5. Attendance today */}
        {biz.attendanceEnabled !== false && attendance && attendance.counts.total > 0 && (
          <Link to="/attendance" className="today-section today-att">
            <div className="today-section-head">
              <h2>Attendance today</h2>
              <ChevronIcon size={14} />
            </div>
            <div className="today-att-body">
              <b>{attendance.counts.present}</b>
              <span>of {attendance.counts.total} {biz.type === 'gym' ? 'checked in' : 'present'}</span>
            </div>
            {biz.type !== 'gym' && attendance.counts.present + attendance.counts.absent === 0 && (
              <span className="today-att-cta">Take attendance →</span>
            )}
          </Link>
        )}

      </div>
      </div>

      <AnimatePresence>
        {remindAll && (
          <BulkRemind title="who owe" onClose={() => setRemindAll(false)}
            people={pending.map((m) => ({ _id: m._id, name: m.name, phone: m.phone, note: `${rupees(m.balance)} due`, message: owingMessage(biz, m) }))} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {collect && (
          <CollectPaymentModal
            member={collect}
            balance={collect.balance}
            plan={null}
            onClose={() => setCollect(null)}
            onSuccess={() => {
              qc.invalidateQueries();
              setCollect(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
