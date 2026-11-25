import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { api, rupees, waLink, can, ADD } from '../api.js';
import { owingMessage, renewalMessage } from '../BulkRemind.jsx';
import { FilterButton } from '../FilterSheet.jsx';
import { Avatar, PlusIcon, SearchIcon, XIcon, WhatsAppIcon, CheckIcon, DownloadIcon, RupeeIcon, BedIcon } from '../ui.jsx';

// Phones: the simpler list from the design (Tenants v3). One button up top, the month's
// money in one card, four tabs that say what's in them, rows that lead with the room,
// grouped by what to do first, and one bar at the bottom to remind everyone.
// Desktop keeps the table in Members.jsx; this only shows under 768px.
const MODES = [['upi', 'UPI'], ['cash', 'Cash'], ['bank_transfer', 'Bank']];
const MODE_NAME = { upi: 'UPI', cash: 'Cash', bank_transfer: 'Bank', card: 'Card', other: 'Other' };

export default function MembersPhone({
  biz, W, title, members, rooms, groups, q, setQ, inTab, passes, daysLate, daysUntil, statusOf, lastPaidText,
  roomOf, groupOf, filtersOn, onFilters, onAdd, onPay, onExport, onFillBed, setBulk,
}) {
  const qc = useQueryClient();
  const [tab, setTab] = useState('owe');
  const [chip, setChip] = useState('all'); // a floor (hostel with one building), a building, or a batch
  const [menuOpen, setMenuOpen] = useState(false);
  const [picking, setPicking] = useState(false); // select mode
  const [picked, setPicked] = useState(() => new Set());
  const [sheet, setSheet] = useState(null); // { m, amt, mode }
  const [toast, setToast] = useState(null);
  const canAdd = can(biz, ADD);
  const isHostel = biz.type === 'hostel';

  // the month: collected so far (the dashboard already knows) and what's still owed
  const { data: dash } = useQuery({ queryKey: ['dashboard', biz._id], queryFn: () => api(`/businesses/${biz._id}/dashboard`), staleTime: 60000 });
  const owedNow = members.filter(inTab.owing).reduce((s, m) => s + m.balance, 0);
  const collected = dash?.collectedThisMonth ?? null;
  const expected = collected == null ? null : collected + owedNow;
  const pct = expected ? Math.round((collected / expected) * 100) : 0;
  const monthName = new Date().toLocaleDateString('en-IN', { month: 'long' });

  // quick chips: floors when there is one building, buildings when there are several, else batches
  const roomById = new Map((rooms || []).map((r) => [r._id, r]));
  const oneBuilding = isHostel && groups.length === 1 ? groups[0] : null;
  const chips = oneBuilding && (oneBuilding.floors || []).length > 1
    ? oneBuilding.floors.map((f) => ({ id: `f:${f._id}`, label: f.name, test: (m) => roomOf(m)?.floorId === f._id }))
    : groups.length > 1 || (!isHostel && groups.length > 0)
      ? groups.map((g) => ({ id: `g:${g._id}`, label: g.name, test: (m) => groupOf(m) === g._id }))
      : [];
  const chipTest = chips.find((c) => c.id === chip)?.test || (() => true);

  // the four tabs
  const isSoon = (m) => inTab.soon(m);
  const TABS = [
    { id: 'owe', label: 'Owe', fn: inTab.owing, ink: 'red' },
    { id: 'soon', label: 'Due soon', fn: isSoon, ink: 'amber' },
    { id: 'paid', label: 'Paid', fn: (m) => inTab.clear(m) && !isSoon(m), ink: 'green' },
    { id: 'all', label: 'All', fn: inTab.all, ink: '' },
  ];
  // search, plan and the other sheet filters still apply; the tab and chip are this screen's own
  const base = members.filter((m) => passes(m, 'status') && chipTest(m));
  const cur = TABS.find((t) => t.id === tab);
  const list = base.filter(cur.fn).sort((a, b) => daysLate(b) - daysLate(a) || (b.balance || 0) - (a.balance || 0));

  // free beds (hostels, All tab): one line per room with space
  const freeBeds = isHostel && tab === 'all' && !picking
    ? (rooms || [])
      .filter((r) => (r.occupied || 0) < r.capacity)
      .filter((r) => {
        const f = chips.find((c) => c.id === chip);
        if (!f) return true;
        if (chip.startsWith('f:')) return r.floorId === chip.slice(2);
        return String(r.groupId?._id || r.groupId) === chip.slice(2);
      })
      .sort((a, b) => String(a.roomNo).localeCompare(String(b.roomNo), undefined, { numeric: true }))
    : [];
  const floorName = (r) => {
    const g = groups.find((x) => x._id === String(r.groupId?._id || r.groupId));
    return g?.floors?.find((f) => f._id === r.floorId)?.name;
  };

  // the bottom bar: remind this tab's people, or the ones picked
  const chosen = members.filter((m) => picked.has(m._id));
  const owing = list.filter(inTab.owing);
  const soonList = list.filter(isSoon);
  const toPerson = (m) => ({
    _id: m._id, name: m.name, phone: m.phone,
    note: m.balance > 0 ? `${rupees(m.balance)} due` : m.nextRenewal ? `due ${new Date(m.nextRenewal).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : '',
    message: m.balance > 0 ? owingMessage(biz, m) : renewalMessage(biz, m),
  });
  let bar = null;
  if (picking) {
    if (chosen.length) bar = { title: `${chosen.length} picked`, sub: 'Each gets a WhatsApp reminder', cta: `Remind ${chosen.length}`, go: () => setBulk({ id: Date.now(), title: 'you picked', people: chosen.map(toPerson) }) };
  } else if (tab === 'soon') {
    if (soonList.length) bar = { title: `${soonList.length} due this week`, sub: 'A friendly heads-up before the date', cta: 'Remind all', go: () => setBulk({ id: Date.now(), title: 'due this week', people: soonList.map(toPerson) }) };
  } else if (tab !== 'paid' && owing.length) {
    bar = { title: `${owing.length} owe ${rupees(owing.reduce((s, m) => s + m.balance, 0))}`, sub: 'One by one on WhatsApp', cta: 'Remind all', go: () => setBulk({ id: Date.now(), title: 'who owe', people: owing.map(toPerson) }) };
  }

  const togglePick = (id) => setPicked((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const stopPicking = () => { setPicking(false); setPicked(new Set()); };
  // long-press a row to start picking
  const pressTimer = useRef(null);
  const press = (m) => ({
    onPointerDown: () => { pressTimer.current = setTimeout(() => { setPicking(true); setPicked(new Set([m._id])); pressTimer.current = 'fired'; }, 500); },
    onPointerUp: () => { if (pressTimer.current !== 'fired') clearTimeout(pressTimer.current); },
    onPointerLeave: () => { if (pressTimer.current !== 'fired') clearTimeout(pressTimer.current); },
  });
  const rowClick = (e, m) => {
    if (pressTimer.current === 'fired') { pressTimer.current = null; e.preventDefault(); return; }
    if (picking) { e.preventDefault(); togglePick(m._id); }
  };

  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(null), 8000); return () => clearTimeout(t); }, [toast]);

  const label = (m) => {
    const room = roomOf(m);
    if (isHostel && room) {
      const fl = floorName(room);
      return [fl, m.planName].filter(Boolean).join(' · ');
    }
    return [m.planName, m.groupId?.name].filter(Boolean).join(' · ') || m.phone || '';
  };
  const rightSide = (m) => {
    const st = statusOf(m);
    if (m.balance > 0) {
      const late = daysLate(m);
      return { amount: rupees(m.balance), amtTone: 'red', chip: late > 0 ? `${late} day${late === 1 ? '' : 's'} late` : 'due today', chipTone: late >= 7 ? 'red' : 'amber' };
    }
    if (isSoon(m)) {
      const d = daysUntil(m.nextRenewal);
      return { amount: rupees(m.planAmount || 0), amtTone: '', chip: d <= 0 ? 'due today' : d === 1 ? 'due tomorrow' : `due in ${d} days`, chipTone: 'amber' };
    }
    if (st.key === 'paused') return { amount: 'Paused', amtTone: 'grey', chip: 'no fees', chipTone: 'grey' };
    const d = m.nextRenewal ? daysUntil(m.nextRenewal) : null;
    return { amount: m.balance < 0 ? `+${rupees(-m.balance)}` : 'Paid', amtTone: 'green', chip: d != null && d > 0 ? `next in ${d} days` : 'paid up', chipTone: 'green' };
  };
  
  return (
    <div className="mxp">
      {/* same pattern as Money on phones: title, ⋯, one main button */}
      <header className="mr-phone-head">
        <h1>{title}</h1>
        <div className="mr-more">
          <button type="button" className="mr-more-btn" aria-label="More" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>⋯</button>
          {menuOpen && (
            <>
              <div className="mr-more-scrim" onClick={() => setMenuOpen(false)} aria-hidden="true" />
              <div className="mr-more-menu" role="menu">
                {canAdd && <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onPay(); }}><span className="mr-more-icon exp"><RupeeIcon size={14} /></span>Record a payment</button>}
                <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); setPicking(true); setPicked(new Set()); }}><span className="mr-more-icon"><CheckIcon size={14} /></span>Pick several {W.member}s</button>
                {isHostel && <Link role="menuitem" to="/rooms" onClick={() => setMenuOpen(false)}><span className="mr-more-icon"><BedIcon size={14} /></span>Rooms and beds</Link>}
                <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onExport(); }}><span className="mr-more-icon"><DownloadIcon size={14} /></span>Download the list</button>
              </div>
            </>
          )}
        </div>
        {canAdd && <button type="button" className="btn mr-phone-pay" onClick={onAdd}><PlusIcon size={14} /> {W.member[0].toUpperCase() + W.member.slice(1)}</button>}
      </header>

      {/* the four numbers in one slim strip */}
      <section className="mr-cards ph-strip" aria-label={`${monthName} at a glance`}>
        {[
          { key: 'in', label: 'Collected', value: collected == null ? '…' : rupees(collected), ink: 'green' },
          { key: 'owe', label: 'To collect', value: rupees(owedNow), ink: owedNow ? 'red' : '' },
          { key: 'n', label: `${W.member[0].toUpperCase() + W.member.slice(1)}s`, value: String(members.filter(inTab.all).length), ink: '' },
          isHostel && rooms?.length > 0
            ? { key: 'beds', label: 'Beds filled', value: `${rooms.reduce((s, r) => s + Math.min(r.occupied || 0, r.capacity), 0)}/${rooms.reduce((s, r) => s + r.capacity, 0)}`, ink: '' }
            : { key: 'soon', label: 'Due soon', value: String(base.filter(isSoon).length), ink: base.some(isSoon) ? 'amber' : '' },
        ].map((c) => (
          <div key={c.key} className="mr-card">
            <span className="mr-card-main"><span className="mr-card-text"><span className="db-label">{c.label}</span><b className={c.ink}>{c.value}</b></span></span>
          </div>
        ))}
      </section>

      <div className="ph-card">
        <div className="who-search-row">
          <label className="mxp-search">
            <SearchIcon size={15} />
            <span className="sr-only">Search {W.member}s</span>
            <input type="search" placeholder={isHostel ? 'Name, phone or room' : 'Name, phone or plan'} value={q} onChange={(e) => setQ(e.target.value)} />
            {q && <button type="button" onClick={() => setQ('')} aria-label="Clear search"><XIcon size={14} /></button>}
          </label>
          <span className="who-filter-btn"><FilterButton on={filtersOn} onClick={onFilters} /></span>
        </div>
        <div className="who-chips" role="group" aria-label={`Show ${W.member}s`}>
          {TABS.map((t) => (
            <button key={t.id} type="button" aria-pressed={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => { setTab(t.id); setPicked(new Set()); }}>
              {t.label} <span>{base.filter(t.fn).length}</span>
            </button>
          ))}
        </div>
        {chips.length > 0 && (
          <div className="who-chips ph-sub-chips">
            {[{ id: 'all', label: oneBuilding ? 'All floors' : `All ${W.groups.toLowerCase()}` }, ...chips].map((c) => (
              <button key={c.id} type="button" className={chip === c.id ? 'on' : ''} onClick={() => { setChip(c.id); setPicked(new Set()); }}>{c.label}</button>
            ))}
          </div>
        )}

        {picking && (
          <div className="mxp-picking">
            <span>Tap {W.member}s to pick them · {picked.size} picked</span>
            <button type="button" onClick={stopPicking}>Done</button>
          </div>
        )}

        {/* one line per person: name + tags, what they owe or paid, one button */}
        <ul className="who-rows">
          {list.map((m) => {
            const room = roomOf(m);
            const r = rightSide(m);
            const owes = m.balance > 0;
            const soon = isSoon(m);
            const on = picked.has(m._id);
            const late = daysLate(m);
            const tag = owes ? (late >= 7 ? 'overdue' : 'due') : soon ? 'due' : statusOf(m).key === 'paused' ? 'none' : 'paid';
            return (
              <li key={m._id} className={`who-row ${on ? 'on' : ''}`}>
                {picking && <span className={`mxp-box ${on ? 'on' : ''}`} aria-hidden="true">{on && <CheckIcon size={12} />}</span>}
                <Link to={`/members/${m._id}`} className="who-row-main" onClick={(e) => rowClick(e, m)} {...press(m)}>
                  <b className={m._justPaid ? 'fresh' : ''}>{m.name}</b>
                  <span className="who-row-tags">
                    {isHostel && room && <span className="who-tag none">Room {room.roomNo}</span>}
                    <span className={`who-tag ${tag}`}>{tag === 'paid' ? `✓ ${r.chip}` : r.chip}</span>
                    {label(m) && <span className="who-row-plan">{label(m)}</span>}
                  </span>
                  {picking && <span className="sr-only">{on ? 'picked' : 'not picked'}</span>}
                </Link>
                <span className="who-row-amt">
                  <b className={r.amtTone}>{r.amount}</b>
                  <span>{owes ? 'owes' : soon ? 'due' : r.amtTone === 'green' ? 'paid' : ''}</span>
                </span>
                {!picking && (owes && canAdd && m.status === 'active'
                  ? <button type="button" className="btn who-row-btn" onClick={() => setSheet({ m, amt: m.balance, mode: 'upi' })}>Collect</button>
                  : soon && m.phone && m.status === 'active'
                    ? <a className="btn-secondary who-row-btn" href={waLink(m.phone, renewalMessage(biz, m))} target="_blank" rel="noreferrer">Remind</a>
                    : <Link className="btn-secondary who-row-btn" to={`/members/${m._id}`}>Open</Link>)}
              </li>
            );
          })}
          {!list.length && (
            <li className="who-empty">
              <b>{q ? `Nobody matches “${q}”` : { owe: 'Nobody owes money', soon: 'Nothing due this week', paid: 'Nobody has paid yet', all: `No ${W.member}s here` }[tab]}</b>
              <span>{q ? 'Try a name, phone number or room.' : { owe: 'Everyone here is paid up.', soon: `You'll see ${W.member}s here a week before their fee is due.`, paid: 'Payments you record show up here.', all: `Add a ${W.member} to get started.` }[tab]}</span>
            </li>
          )}
          {list.length > 0 && <li className="who-key" aria-hidden="true"><span><i className="paid" />Paid</span><span><i className="overdue" />Week+ late</span><span><i className="due" />Due</span></li>}
        </ul>
      </div>

      {freeBeds.length > 0 && (
        <div className="ph-card">
          <p className="ph-card-title">Free beds · {freeBeds.reduce((s, r) => s + r.capacity - (r.occupied || 0), 0)}</p>
          <ul className="who-rows">
            {freeBeds.map((r) => {
              const free = r.capacity - (r.occupied || 0);
              return (
                <li key={r._id} className="who-row">
                  <span className="who-row-main">
                    <b>Room {r.roomNo}</b>
                    <span className="who-row-tags">
                      <span className="who-tag paid">{free} bed{free === 1 ? '' : 's'} free</span>
                      <span className="who-row-plan">{[floorName(r), r.capacity === 1 ? 'Single' : `${r.capacity} sharing`].filter(Boolean).join(' · ')}</span>
                    </span>
                  </span>
                  {r.bedRent > 0 && <span className="who-row-amt"><b>{rupees(r.bedRent)}</b><span>a month</span></span>}
                  {canAdd && <button type="button" className="btn-secondary who-row-btn" onClick={() => onFillBed(r._id)}>Fill bed</button>}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <p className="mxp-tip">Tap a {W.member} to open · long-press to pick several</p>

      {bar && (
        <div className="mxp-bottom" role="status">
          <span><b>{bar.title}</b><span>{bar.sub}</span></span>
          <button type="button" onClick={bar.go}><WhatsAppIcon size={15} /> {bar.cta}</button>
        </div>
      )}

      <AnimatePresence>
        {sheet && (
          <CollectSheet
            key="collect"
            biz={biz}
            sheet={sheet}
            setSheet={setSheet}
            room={roomOf(sheet.m)}
            late={daysLate(sheet.m)}
            onDone={(paid) => {
              setSheet(null);
              setToast(paid);
              ['members', 'dashboard', 'report', 'member'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div className="mxp-toast" role="status" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            <span className="mxp-toast-tick"><CheckIcon size={14} /></span>
            <span className="mxp-toast-text">
              <b>{rupees(toast.amt)} from {toast.m.name}</b>
              <span>{toast.left > 0 ? `${rupees(toast.left)} still due` : 'Paid in full'} · {MODE_NAME[toast.mode]}</span>
            </span>
            {toast.m.phone && (
              <a className="mxp-toast-go" target="_blank" rel="noreferrer" onClick={() => setToast(null)}
                href={waLink(toast.m.phone, `Hi ${toast.m.name}, we received ${rupees(toast.amt)} (${MODE_NAME[toast.mode]}) for ${biz.name}. ${toast.left > 0 ? `${rupees(toast.left)} is still due.` : 'You are all paid up.'} Thank you!`)}>
                <WhatsAppIcon size={14} /> Receipt
              </a>
            )}
            <button type="button" className="mxp-toast-x" aria-label="Close" onClick={() => setToast(null)}><XIcon size={13} /></button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Collect: a bottom sheet, three taps (how much, how they paid, save)
function CollectSheet({ biz, sheet, setSheet, room, late, onDone }) {
  const { m, amt, mode } = sheet;
  const [custom, setCustom] = useState('');
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setSheet(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [setSheet]);
  const amount = custom !== '' ? Number(custom) : amt;
  const pay = useMutation({
    mutationFn: () => api(`/members/${m._id}/payments`, { method: 'POST', body: { amount, mode, date: new Date().toISOString() } }),
    onSuccess: () => onDone({ m, amt: amount, mode, left: Math.max(0, m.balance - amount) }),
  });
  const half = Math.round(m.balance / 2);
  const presets = [[m.balance, 'Full amount'], half > 0 && half !== m.balance && [half, 'Half now']].filter(Boolean);
  const ok = amount > 0;

  return (
    <div className="mxp-sheet-wrap" onClick={() => setSheet(null)}>
      <motion.div
        className="mxp-sheet" role="dialog" aria-modal="true" aria-label={`Collect from ${m.name}`}
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 320 }}
        onClick={(e) => e.stopPropagation()}>
        <div className="mxp-grip" aria-hidden="true" />
        <div className="mxp-sheet-head">
          {room ? <span className="mxp-room red"><span>Room</span><b>{room.roomNo}</b></span> : <Avatar name={m.name} />}
          <span className="mxp-who">
            <b>Collect from {m.name.split(' ')[0]}</b>
            <span className="red">Owes {rupees(m.balance)}{late > 0 ? ` · ${late} day${late === 1 ? '' : 's'} late` : ''}</span>
          </span>
          <button type="button" className="mxp-sheet-x" aria-label="Close" onClick={() => setSheet(null)}><XIcon size={14} /></button>
        </div>

        <p className="mxp-label">How much</p>
        <div className="mxp-amounts">
          {presets.map(([v, l]) => (
            <button key={l} type="button" className={custom === '' && amt === v ? 'on' : ''} onClick={() => { setCustom(''); setSheet({ ...sheet, amt: v }); }}>
              <b>{rupees(v)}</b><span>{l}</span>
            </button>
          ))}
        </div>
        <label className="mxp-custom">
          <span>Other amount</span>
          <input type="number" inputMode="numeric" min="1" placeholder="₹" value={custom} onChange={(e) => setCustom(e.target.value)} />
        </label>

        <p className="mxp-label">Paid by</p>
        <div className="mxp-modes" role="radiogroup" aria-label="Paid by">
          {MODES.map(([v, l]) => (
            <button key={v} type="button" role="radio" aria-checked={mode === v} className={mode === v ? 'on' : ''} onClick={() => setSheet({ ...sheet, mode: v })}>{l}</button>
          ))}
        </div>

        {pay.error && <p className="error" role="alert" style={{ margin: '10px 0 0' }}>{pay.error.message}</p>}
        <button type="button" className="mxp-save" disabled={!ok || pay.isPending} onClick={() => pay.mutate()}>
          {pay.isPending ? 'Saving…' : ok ? `Save ${rupees(amount)} · ${MODE_NAME[mode]}` : 'Enter an amount'}
        </button>
        <p className="mxp-after">{ok && amount < m.balance ? `${rupees(m.balance - amount)} will still be due` : ok && amount > m.balance ? `${rupees(amount - m.balance)} goes in advance` : 'Clears what they owe'}</p>
      </motion.div>
    </div>
  );
}
