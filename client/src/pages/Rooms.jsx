import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, rupees } from '../api.js';
import { useBiz } from '../App.jsx';
import { confirmAction } from '../confirm.jsx';
import { Field, BedIcon, DoorIcon, EditIcon, PlusIcon, XIcon, AlertIcon, BuildingIcon, SearchIcon, ChevronIcon } from '../ui.jsx';
import { EditRoom } from './HostelProperty.jsx';
import { AddMemberModal, MemberProfileSheet } from './Members.jsx';

const natural = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const firstName = (name) => String(name || '').trim().split(/\s+/)[0];

// What a bed shows. Tenants fill a room's beds in the order they moved in.
function bedState(tenant) {
  if (!tenant) return 'free';
  if (tenant.balance > 0) return 'overdue';
  if (tenant.noticeGivenOn) return 'leaving';
  return 'taken';
}
const STATE_TEXT = { free: 'Available', taken: 'Occupied', overdue: 'Overdue', leaving: 'Leaving' };

// The hostel at a glance: every room as a card, every bed as a tile.
// A free bed opens "Add tenant" for that room; a taken bed opens the tenant.
// Big hostels: pick a building and floor, search a room or tenant, switch to the compact view,
// and fold floors away.
const VIEW_KEY = 'roomsView';
const readView = () => { try { return localStorage.getItem(VIEW_KEY); } catch { return null; } };
const saveView = (v) => { try { localStorage.setItem(VIEW_KEY, v); } catch { /* private mode */ } };

export default function Rooms() {
  const biz = useBiz();
  const qc = useQueryClient();
  const [tenantId, setTenantId] = useState(null); // tenant panel for a taken bed
  const [newIn, setNewIn] = useState(undefined); // add-tenant popup: a room id, null = any room
  const [show, setShow] = useState('all'); // 'all' | 'free' | 'taken' | 'overdue'
  const [buildingId, setBuildingId] = useState('all');
  const [floorId, setFloorId] = useState('all');
  const [q, setQ] = useState('');
  const [view, setView] = useState(readView); // 'cards' | 'compact' (null: decide by size)
  const [folded, setFolded] = useState(() => new Set());
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(null); // { group, floor }
  const [bedError, setBedError] = useState('');

  const { data: rooms } = useQuery({ queryKey: ['rooms', biz._id], queryFn: () => api(`/businesses/${biz._id}/rooms`) });
  const { data: groups = [] } = useQuery({ queryKey: ['groups', biz._id], queryFn: () => api(`/businesses/${biz._id}/groups`) });
  const { data: members = [] } = useQuery({ queryKey: ['members', biz._id], queryFn: () => api(`/businesses/${biz._id}/members`) });
  const { data: plans = [] } = useQuery({ queryKey: ['plans', biz._id], queryFn: () => api(`/businesses/${biz._id}/plans`) });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['rooms', biz._id] });
    qc.invalidateQueries({ queryKey: ['members', biz._id] });
  };

  if (!rooms) return <div className="card skeleton" style={{ minHeight: 320 }} aria-hidden="true" />;

  // tenants by room, oldest move-in first
  const tenantsIn = new Map();
  for (const m of members) {
    const id = m.roomId?._id || m.roomId;
    if (m.status !== 'active' || !id) continue;
    if (!tenantsIn.has(id)) tenantsIn.set(id, []);
    tenantsIn.get(id).push(m);
  }
  for (const list of tenantsIn.values()) list.sort((a, b) => new Date(a.joinDate) - new Date(b.joinDate));

  // one entry per bed (and one per extra tenant, should a room ever be over full)
  const bedsOf = (r) => {
    const tenants = tenantsIn.get(r._id) || [];
    return Array.from({ length: Math.max(r.capacity, tenants.length) }, (_, i) => ({ n: i + 1, tenant: tenants[i], state: bedState(tenants[i]) }));
  };

  const sortedGroups = [...groups].sort((a, b) => natural(a.name, b.name));
  const buildingOf = (r) => String(r.groupId?._id || r.groupId || '');
  // one building: no picker, its floors are the tabs
  const activeBuilding = sortedGroups.length === 1 ? sortedGroups[0] : sortedGroups.find((g) => g._id === buildingId);
  const floorTabs = activeBuilding?.floors || [];

  const all = rooms.map((r) => ({ ...r, beds: bedsOf(r) }));
  // the counts follow the building / floor in view, so "Available 3" means here
  const inPlace = all.filter((r) =>
    (!activeBuilding || sortedGroups.length === 1 || buildingOf(r) === activeBuilding._id) &&
    (floorId === 'all' || r.floorId === floorId));
  const placeBeds = inPlace.flatMap((r) => r.beds);
  const count = (s) => placeBeds.filter((b) => b.state === s).length;
  const totals = { all: placeBeds.length, free: count('free'), taken: placeBeds.length - count('free'), overdue: count('overdue') };

  const query = q.trim().toLowerCase().replace(/^room\s*/, '');
  const matches = (r) =>
    (show === 'all' || r.beds.some((b) => (show === 'taken' ? b.state !== 'free' : b.state === show))) &&
    (!query || String(r.roomNo).toLowerCase().includes(query) || r.beds.some((b) => b.tenant?.name.toLowerCase().includes(query)));

  // building → floor → rooms, in the order the owner set them up
  const sections = [];
  for (const g of sortedGroups) {
    if (activeBuilding && sortedGroups.length > 1 && g._id !== activeBuilding._id) continue;
    const inBuilding = inPlace.filter((r) => buildingOf(r) === g._id);
    for (const f of g.floors || []) {
      if (floorId !== 'all' && f._id !== floorId) continue;
      sections.push({ key: f._id, group: g, floor: f, title: f.name, building: g.name, rooms: inBuilding.filter((r) => r.floorId === f._id) });
    }
    const noFloor = inBuilding.filter((r) => !r.floorId || !(g.floors || []).some((f) => f._id === r.floorId));
    if (floorId === 'all' && (noFloor.length || !(g.floors || []).length)) sections.push({ key: g._id, group: g, title: 'No floor', building: g.name, rooms: noFloor });
  }
  const loose = inPlace.filter((r) => !r.groupId);
  if ((!activeBuilding || sortedGroups.length === 1) && floorId === 'all' && loose.length) sections.push({ key: 'loose', title: 'Not in a building', building: 'Other rooms', rooms: loose });
  for (const s of sections) {
    s.total = s.rooms;
    s.rooms = s.rooms.filter(matches).sort((a, b) => natural(a.roomNo, b.roomNo));
  }
  const filtering = show !== 'all' || !!query;
  const visible = filtering ? sections.filter((s) => s.rooms.length) : sections;
  const showBuildingName = sortedGroups.length > 1 && !activeBuilding;

  // big places open in the compact view until the owner picks one
  const mode = view || (rooms.length > 12 ? 'compact' : 'cards');
  const chooseView = (v) => { setView(v); saveView(v); };
  const toggleFold = (key) => setFolded((prev) => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; });
  const allFolded = visible.length > 0 && visible.every((s) => folded.has(s.key));
  // stay on the board: a taken bed opens the tenant's panel, a free bed the add form for that room
  const openBed = (r, b) => (b.tenant ? setTenantId(b.tenant._id) : setNewIn(r._id));
  // beds are a count per room: removing a free bed lowers it by one, adding raises it
  const setBeds = async (r, capacity) => {
    setBedError('');
    try {
      await api(`/businesses/${biz._id}/rooms/${r._id}`, { method: 'PATCH', body: { capacity } });
      refresh();
    } catch (err) {
      setBedError(err.message);
    }
  };
  const removeBed = async (r) => {
    if (r.capacity <= 1) return setBedError(`Room ${r.roomNo} has only one bed. Delete the room in Setup instead.`);
    const ok = await confirmAction({
      title: `Remove a bed from room ${r.roomNo}?`,
      message: `Room ${r.roomNo} goes from ${plural(r.capacity, 'bed')} to ${plural(r.capacity - 1, 'bed')}. Tenants stay where they are.`,
      confirmText: 'Remove bed',
      danger: true,
    });
    if (ok) await setBeds(r, r.capacity - 1);
  };
  const addBed = (r) => (r.capacity >= 30 ? setBedError('A room can have at most 30 beds.') : setBeds(r, r.capacity + 1));

  if (!rooms.length) {
    return (
      <div className="rooms-page">
        <RoomsHeader />
        <div className="analytics-card rooms-empty">
          <DoorIcon size={28} />
          <h3>No rooms yet</h3>
          <p>Add your buildings, floors and rooms in Setup. They'll show up here with every bed.</p>
          <Link to="/setup" className="btn">Set up rooms</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rooms-page">
      <RoomsHeader onAdd={() => setNewIn(null)} />

      {/* where: building and floor; what: search; how: cards or compact */}
      <div className="rooms-toolbar">
        {sortedGroups.length > 1 && (
          <div className="filter-select-item rooms-building" title="Building">
            <BuildingIcon size={13} className="filter-select-icon" />
            <select className="filter-select-input" aria-label="Building" value={activeBuilding?._id || 'all'}
              onChange={(e) => { setBuildingId(e.target.value); setFloorId('all'); }}>
              <option value="all">All buildings</option>
              {sortedGroups.map((g) => <option key={g._id} value={g._id}>{g.name}</option>)}
            </select>
          </div>
        )}
        <div className="rooms-search">
          <SearchIcon size={14} />
          <input type="search" placeholder="Room or tenant" aria-label="Find a room or tenant" value={q} onChange={(e) => setQ(e.target.value)} />
          {q && <button type="button" aria-label="Clear search" onClick={() => setQ('')}><XIcon size={12} /></button>}
        </div>
        <div className="rooms-view" role="group" aria-label="View">
          <button type="button" className={mode === 'cards' ? 'active' : ''} aria-pressed={mode === 'cards'} onClick={() => chooseView('cards')}>Cards</button>
          <button type="button" className={mode === 'compact' ? 'active' : ''} aria-pressed={mode === 'compact'} onClick={() => chooseView('compact')}>Compact</button>
        </div>
      </div>

      {floorTabs.length > 1 && (
        <div className="rooms-buildings" role="tablist" aria-label="Floor">
          {[{ _id: 'all', name: 'All floors' }, ...floorTabs].map((f) => {
            const fBeds = f._id === 'all' ? null : all.filter((r) => r.floorId === f._id).flatMap((r) => r.beds);
            const free = fBeds?.filter((b) => b.state === 'free').length;
            return (
              <button key={f._id} type="button" role="tab" aria-selected={floorId === f._id}
                className={floorId === f._id ? 'active' : ''} onClick={() => setFloorId(f._id)}>
                {f.name}{fBeds && <small>{free} free</small>}
              </button>
            );
          })}
        </div>
      )}

      {/* counts double as filters */}
      <div className="rooms-filters" role="group" aria-label="Show beds">
        {[
          ['all', 'All beds', totals.all],
          ['free', 'Available', totals.free],
          ['taken', 'Occupied', totals.taken],
          ['overdue', 'Overdue', totals.overdue],
        ].map(([key, label, n]) => (
          <button key={key} type="button" className={`rooms-chip ${key}${show === key ? ' active' : ''}`} aria-pressed={show === key}
            onClick={() => setShow(show === key ? 'all' : key)}>
            <i aria-hidden="true" />
            <span>{label}</span>
            <b>{n}</b>
          </button>
        ))}
      </div>

      {bedError && <p className="error" role="alert">{bedError}</p>}

      {visible.length > 0 && (
        <div className="rooms-summary">
          <span>
            {plural(visible.reduce((n, s) => n + s.rooms.length, 0), 'room')}
            {filtering ? ' match' : ` on ${plural(visible.length, 'floor')}`}
          </span>
          {visible.length > 1 && !filtering && (
            <button type="button" onClick={() => setFolded(allFolded ? new Set() : new Set(visible.map((s) => s.key)))}>
              {allFolded ? 'Open all floors' : 'Fold all floors'}
            </button>
          )}
        </div>
      )}

      {visible.length === 0 && (
        <p className="today-empty" style={{ textAlign: 'center', padding: 24 }}>
          {query ? `No room or tenant matches “${q.trim()}”.` : { free: 'Every bed is taken here.', taken: 'Nobody lives here yet.', overdue: 'Nobody is overdue. 🎉' }[show]}
        </p>
      )}

      {/* all buildings: one block per building, its floors inside */}
      {byBuilding(visible).map(({ key, name, sections: floors }) => {
        const bBeds = floors.flatMap((s) => s.total.flatMap((r) => r.beds));
        const bFree = bBeds.filter((b) => b.state === 'free').length;
        const bDue = bBeds.filter((b) => b.state === 'overdue').length;
        return (
          <div key={key} className="rooms-block">
            {showBuildingName && name && (
              <div className="rooms-building-head">
                <BuildingIcon size={16} />
                <h2>{name}</h2>
                <span className="prop-stats rooms-head-stats">
                  <span className="prop-chip">{plural(floors.reduce((n, s) => n + s.total.length, 0), 'room')}</span>
                  <span className="prop-chip">{plural(bBeds.length, 'bed')}</span>
                  <span className={`prop-chip ${bFree ? 'free' : 'full'}`}>{bFree ? `${bFree} free` : 'Full'}</span>
                  {bDue > 0 && <span className="prop-chip due">{bDue} overdue</span>}
                </span>
              </div>
            )}
            {floors.map((s) => {
              const sBeds = s.total.flatMap((r) => r.beds);
              const sFree = sBeds.filter((b) => b.state === 'free').length;
              const sDue = sBeds.filter((b) => b.state === 'overdue').length;
              const fill = sBeds.length ? Math.round(((sBeds.length - sFree) / sBeds.length) * 100) : 0;
              const isFolded = folded.has(s.key) && !filtering; // a filter or search opens what it found
              const canAdd = !filtering && s.group;
              return (
                <section key={s.key} className={`rooms-section${isFolded ? ' folded' : ''}`}>
                  <div className="rooms-floor-head">
                    <button type="button" className="rooms-floor-toggle" aria-expanded={!isFolded} onClick={() => toggleFold(s.key)}>
                      <ChevronIcon size={14} className="rooms-fold-icon" />
                      <h3>{s.title}</h3>
                      {s.total.length > 0 ? (
                        <>
                          <span className="prop-stats">
                            <span className="prop-chip">{plural(s.total.length, 'room')}</span>
                            <span className="prop-chip">{plural(sBeds.length, 'bed')}</span>
                            <span className={`prop-chip ${sFree ? 'free' : 'full'}`}>{sFree ? `${sFree} free` : 'Full'}</span>
                            {sDue > 0 && <span className="prop-chip due">{sDue} overdue</span>}
                          </span>
                          <span className="rooms-section-bar" title={`${fill}% full`}><i style={{ width: `${fill}%` }} /></span>
                        </>
                      ) : <span className="prop-chip">no rooms yet</span>}
                    </button>
                    {canAdd && (
                      <button type="button" className="rooms-floor-add" onClick={() => setAdding({ group: s.group, floor: s.floor })}
                        aria-label={`Add room ${s.floor ? `on ${s.floor.name}` : `in ${s.group.name}`}`}>
                        <PlusIcon size={14} /> <span>Add room</span>
                      </button>
                    )}
                  </div>
                  {!isFolded && (s.rooms.length ? (
                    <div className={mode === 'compact' ? 'rooms-grid compact' : 'rooms-grid'}>
                      {s.rooms.map((r) => (mode === 'compact'
                        ? <RoomMini key={r._id} room={r} onEdit={() => setEditing(r)} onOpen={(b) => openBed(r, b)} />
                        : <RoomCard key={r._id} room={r} onEdit={() => setEditing(r)} onOpen={(b) => openBed(r, b)}
                            onRemoveBed={() => removeBed(r)} onAddBed={() => addBed(r)} />
                      ))}
                    </div>
                  ) : canAdd && (
                    <button type="button" className="rooms-floor-empty" onClick={() => setAdding({ group: s.group, floor: s.floor })}>
                      <PlusIcon size={14} /> Add the first room {s.floor ? `on ${s.floor.name}` : `in ${s.group.name}`}
                    </button>
                  ))}
                </section>
              );
            })}
          </div>
        );
      })}

      <div className="rooms-legend" aria-hidden="true">
        {['free', 'taken', 'leaving', 'overdue'].map((k) => <span key={k} className={k}><i />{STATE_TEXT[k]}</span>)}
      </div>

      {editing && (
        <EditRoom room={editing} groups={groups} path={`/businesses/${biz._id}/rooms/${editing._id}`}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />
      )}
      <AnimatePresence>
        {newIn !== undefined && (
          <AddMemberModal biz={biz} plans={plans} groups={groups} rooms={rooms} roomId={newIn}
            onClose={() => setNewIn(undefined)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {tenantId && (
          <MemberProfileSheet biz={biz} memberId={tenantId} plans={plans} rooms={rooms} groups={groups}
            onClose={() => setTenantId(null)} />
        )}
      </AnimatePresence>
      {adding && (
        <AddRoom biz={biz} {...adding} existing={rooms}
          onClose={() => setAdding(null)} onSaved={() => { setAdding(null); refresh(); }} />
      )}
    </div>
  );
}

// consecutive floor sections → one block per building (sections are already in building order)
function byBuilding(sections) {
  const blocks = [];
  for (const s of sections) {
    const key = s.group?._id || 'loose';
    const last = blocks[blocks.length - 1];
    if (last?.key === key) last.sections.push(s);
    else blocks.push({ key, name: s.building || (s.group ? s.group.name : 'Other rooms'), sections: [s] });
  }
  return blocks;
}

// Compact view: a small tile per room with one square per bed, many rooms per row
function RoomMini({ room, onEdit, onOpen }) {
  const free = room.beds.filter((b) => b.state === 'free').length;
  const due = room.beds.some((b) => b.state === 'overdue');
  return (
    <article className={`room-mini${due ? ' due' : ''}${free ? '' : ' full'}`}>
      <header>
        <b>{room.roomNo}</b>
        <button type="button" className="prop-edit" aria-label={`Edit room ${room.roomNo}`} title="Edit room" onClick={onEdit}>
          <EditIcon size={12} />
        </button>
      </header>
      <div className="room-mini-beds">
        {room.beds.map((b) => (
          <button key={b.n} type="button" className={`bed-dot ${b.state}`} onClick={() => onOpen(b)}
            title={b.tenant ? `Bed ${b.n}: ${b.tenant.name} · ${STATE_TEXT[b.state]}${b.state === 'overdue' ? ` · ${rupees(b.tenant.balance)} due` : ''}` : `Bed ${b.n}: available${room.bedRent != null ? ` · ${rupees(room.bedRent)}` : ''}`}
            aria-label={b.tenant ? `Bed ${b.n}: ${b.tenant.name}, ${STATE_TEXT[b.state]}` : `Bed ${b.n}: available. Add a tenant`}>
            {b.tenant ? firstName(b.tenant.name).slice(0, 1).toUpperCase() : ''}
          </button>
        ))}
      </div>
      <span className="room-mini-foot">
        <span className={free ? 'green-text' : 'room-mini-full'}>{free ? `${free} free` : 'Full'}</span>
        {room.bedRent != null && <b>{rupees(room.bedRent)}</b>}
      </span>
      <span className="room-mini-bar" aria-hidden="true">
        <i style={{ width: `${Math.round(((room.beds.length - free) / Math.max(room.beds.length, 1)) * 100)}%` }} />
      </span>
    </article>
  );
}

function RoomsHeader({ onAdd }) {
  return (
    <div className="page-header home-header">
      <div className="page-title-wrap">
        <h1 className="page-title">Rooms</h1>
        <p className="home-date">Tap a free bed to add a tenant there</p>
      </div>
      {onAdd && (
        <div className="home-actions">
          <button type="button" className="btn" onClick={onAdd}><PlusIcon size={15} /> Add tenant</button>
        </div>
      )}
    </div>
  );
}

function RoomCard({ room, onEdit, onOpen, onRemoveBed, onAddBed }) {
  const free = room.beds.filter((b) => b.state === 'free').length;
  return (
    <article className="room-card">
      <header>
        <span className="room-card-icon"><DoorIcon size={18} /></span>
        <div className="room-card-title">
          <div>
            <b>Room {room.roomNo}</b>
            <button type="button" className="prop-edit" aria-label={`Edit room ${room.roomNo}`} title="Edit room" onClick={onEdit}>
              <EditIcon size={13} />
            </button>
          </div>
          <span>{plural(room.capacity, 'bed')} · {free ? `${free} available` : 'full'}</span>
        </div>
        <button type="button" className="room-add-bed" onClick={onAddBed} aria-label={`Add a bed to room ${room.roomNo}`} title="Add a bed">
          <PlusIcon size={13} /> Bed
        </button>
      </header>
      <div className="room-beds">
        {room.beds.map((b) => (
          <div key={b.n} className="bed-wrap">
          <button type="button" className={`bed-tile ${b.state}`} onClick={() => onOpen(b)}
            aria-label={b.tenant ? `Bed ${b.n}: ${b.tenant.name}, ${STATE_TEXT[b.state]}` : `Bed ${b.n}: available. Add a tenant`}>
            {b.state === 'overdue' && <span className="bed-flag" aria-hidden="true"><AlertIcon size={12} /></span>}
            <BedIcon size={22} />
            <b>{b.tenant ? firstName(b.tenant.name) : `Bed ${b.n}`}</b>
            <span className="bed-state">{b.tenant ? `Bed ${b.n} · ${STATE_TEXT[b.state]}` : 'Available'}</span>
            <span className="bed-amount">
              {b.state === 'overdue' ? `${rupees(b.tenant.balance)} due`
                : b.tenant ? (b.tenant.planAmount ? rupees(b.tenant.planAmount) : '—')
                : room.bedRent != null ? rupees(room.bedRent) : 'Add tenant'}
            </span>
          </button>
          {/* only an empty bed can go; the last one stays (delete the room instead) */}
          {b.state === 'free' && room.capacity > 1 && b.n > room.beds.filter((x) => x.tenant).length && (
            <button type="button" className="bed-remove" onClick={onRemoveBed}
              aria-label={`Remove bed ${b.n} from room ${room.roomNo}`} title="Remove this bed">
              <XIcon size={11} />
            </button>
          )}
          </div>
        ))}
      </div>
    </article>
  );
}

// A new room straight from the board: number, beds and (optional) rent per bed
function AddRoom({ biz, group, floor, existing, onClose, onSaved }) {
  const taken = new Set(existing.filter((r) => String(r.groupId?._id || r.groupId) === group._id).map((r) => r.roomNo));
  const [roomNo, setRoomNo] = useState('');
  const [capacity, setCapacity] = useState(2);
  const [bedRent, setBedRent] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await api(`/businesses/${biz._id}/rooms`, {
        method: 'POST',
        body: { groupId: group._id, floorId: floor?._id, roomNo: roomNo.trim(), capacity: Number(capacity), bedRent: bedRent === '' ? null : Number(bedRent) },
      });
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  const clash = taken.has(roomNo.trim());
  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal-content" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <div className="form-header" style={{ marginBottom: 16 }}>
          <h3 className="form-title" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <DoorIcon size={17} style={{ color: 'var(--primary)' }} /> Add room
          </h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><XIcon size={14} /></button>
        </div>
        <p className="small muted" style={{ margin: '-6px 0 16px' }}>{group.name}{floor ? ` · ${floor.name}` : ''}</p>
        <div className="expense-form">
          <Field label="Room number *">
            <input required autoFocus value={roomNo} placeholder="e.g. 05" onChange={(e) => setRoomNo(e.target.value)} />
          </Field>
          {clash && <p className="error" style={{ margin: '-8px 0 0' }}>Room {roomNo.trim()} already exists in {group.name}.</p>}
          <Field label="Beds *">
            <select value={capacity} onChange={(e) => setCapacity(e.target.value)}>
              {Array.from({ length: 30 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{plural(n, 'bed')}</option>)}
            </select>
          </Field>
          <Field label="Rent per bed (₹, optional)">
            <input type="number" min="0" step="1" inputMode="numeric" placeholder="e.g. 6000" value={bedRent} onChange={(e) => setBedRent(e.target.value)} />
          </Field>
        </div>
        {error && <p className="error" role="alert" style={{ marginTop: 12 }}>{error}</p>}
        <div className="expense-form-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={busy || !roomNo.trim() || clash}>{busy ? 'Adding…' : 'Add room'}</button>
        </div>
      </form>
    </div>
  );
}
