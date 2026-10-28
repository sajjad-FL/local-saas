import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, rupees } from '../api.js';
import { copyNumbers } from '../roomNumbers.js';
import { confirmAction } from '../confirm.jsx';
import { BuildingIcon, BedIcon, PlusIcon, XIcon, CheckIcon, TrashIcon, EditIcon, Field, ChevronIcon } from '../ui.jsx';

const natural = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
const ORD = ['Ground', '1st', '2nd', '3rd'];
const suggestFloor = (n) => `${ORD[n] || `${n}th`} floor`;
// the floor after the highest one already there ("Ground", "1st floor" → "2nd floor"), never a name in use
const floorLevel = (name) => {
  const t = name.trim().toLowerCase();
  if (/^ground/.test(t)) return 0;
  const m = t.match(/^(\d+)(st|nd|rd|th)?\b/) || t.match(/^(first|second|third|fourth|fifth)\b/);
  if (!m) return null;
  return Number(m[1]) || ['first', 'second', 'third', 'fourth', 'fifth'].indexOf(m[1]) + 1;
};
function nextFloorName(floors) {
  const used = new Set(floors.map((f) => f.name.trim().toLowerCase()));
  const levels = floors.map((f) => floorLevel(f.name)).filter((n) => n !== null);
  let n = levels.length ? Math.max(...levels) + 1 : floors.length;
  while (used.has(suggestFloor(n).toLowerCase())) n += 1;
  return suggestFloor(n);
}

// "101" → ["101"]; "101-110" or "A101-A110" → each room in the range (up to 50)
export function expandRooms(text) {
  const t = text.trim();
  const m = t.match(/^([A-Za-z]*-?)(\d+)\s*(?:-|to)\s*\1?(\d+)$/i);
  if (!m) return t ? [t] : [];
  const [, prefix, a, b] = m;
  const from = Number(a), to = Number(b);
  if (to < from || to - from >= 50) return null;
  return Array.from({ length: to - from + 1 }, (_, i) => `${prefix}${String(from + i).padStart(a.length, '0')}`);
}

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
// rooms, beds and free beds of a set of rooms
function counts(rooms) {
  const beds = rooms.reduce((s, r) => s + r.capacity, 0);
  const used = rooms.reduce((s, r) => s + Math.min(r.occupied, r.capacity), 0);
  return { rooms: rooms.length, beds, free: beds - used, pct: beds ? Math.round((used / beds) * 100) : 0 };
}
// each building gets its own accent so a long list is easy to tell apart
const ACCENTS = ['#8B5CF6', '#0EA5E9', '#F59E0B', '#EC4899', '#14B8A6', '#6366F1'];

// "2 floors · 8 rooms · 21 beds · 16 free" as small pills
function Stats({ floors, rooms }) {
  const c = counts(rooms);
  return (
    <span className="prop-stats">
      {floors !== undefined && <span className="prop-chip">{plural(floors, 'floor')}</span>}
      <span className="prop-chip">{plural(c.rooms, 'room')}</span>
      <span className="prop-chip">{plural(c.beds, 'bed')}</span>
      <span className={`prop-chip ${c.free ? 'free' : 'full'}`}>{c.free ? `${c.free} free` : 'Full'}</span>
    </span>
  );
}

// how full: a bar with the share of beds taken
function Fill({ rooms, big }) {
  const c = counts(rooms);
  if (!c.beds) return null;
  return (
    <span className={`prop-fill${big ? ' big' : ''}`} title={`${c.beds - c.free} of ${c.beds} beds taken`}>
      {big && <span className="prop-fill-text"><b>{c.pct}%</b> full</span>}
      <span className="prop-fill-bar"><i style={{ width: `${c.pct}%` }} /></span>
    </span>
  );
}

// "G", "1", "2"… from the floor name; first letter otherwise
const floorBadge = (name) => {
  const lvl = floorLevel(name);
  return lvl === 0 ? 'G' : lvl !== null ? String(lvl) : name.trim().charAt(0).toUpperCase();
};

function totals(rooms) {
  const beds = rooms.reduce((s, r) => s + r.capacity, 0);
  const used = rooms.reduce((s, r) => s + Math.min(r.occupied, r.capacity), 0);
  return `${plural(rooms.length, 'room')} · ${plural(beds, 'bed')} · ${beds - used} free`;
}

// Hostel Setup step: Building → Floor → Room (with beds), as one tree
export default function HostelProperty({ biz, step }) {
  const qc = useQueryClient();
  const gPath = `/businesses/${biz._id}/groups`;
  const rPath = `/businesses/${biz._id}/rooms`;
  const { data: groups } = useQuery({ queryKey: [gPath], queryFn: () => api(gPath) });
  const { data: rooms } = useQuery({ queryKey: [rPath], queryFn: () => api(rPath) });
  const [addingBuilding, setAddingBuilding] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null); // the room being edited
  const refresh = () => { qc.invalidateQueries({ queryKey: [gPath] }); qc.invalidateQueries({ queryKey: [rPath] }); qc.invalidateQueries({ queryKey: ['groups', biz._id] }); };
  const run = (fn) => async (...args) => {
    setError('');
    try { await fn(...args); refresh(); return true; } catch (e) { setError(e.message); refresh(); return false; }
  };

  const addBuilding = run(async () => { await api(gPath, { method: 'POST', body: { name } }); setName(''); setAddingBuilding(false); });
  const removeBuilding = async (g) => (await confirmAction({
    title: `Delete ${g.name}?`, message: 'The building is removed from your setup.', confirmText: 'Delete building', danger: true,
  })) && run(() => api(`${gPath}/${g._id}`, { method: 'DELETE' }))();
  // a new floor, optionally with another floor's rooms (same beds and rent, next numbers)
  const addFloor = run(async (g, floorName, copy) => {
    const updated = await api(`${gPath}/${g._id}/floors`, { method: 'POST', body: { name: floorName } });
    const floor = updated.floors.find((f) => f.name.toLowerCase() === floorName.trim().toLowerCase());
    if (!copy || !floor) return;
    for (const [i, r] of copy.rooms.entries()) {
      await api(rPath, { method: 'POST', body: { groupId: g._id, floorId: floor._id, roomNo: copy.numbers[i], capacity: r.capacity, bedRent: r.bedRent ?? null } });
    }
  });
  const removeFloor = async (g, f) => (await confirmAction({
    title: `Delete ${f.name} of ${g.name}?`, message: 'The floor is removed from your setup.', confirmText: 'Delete floor', danger: true,
  })) && run(() => api(`${gPath}/${g._id}/floors/${f._id}`, { method: 'DELETE' }))();
  const removeRoom = async (r) => (await confirmAction({
    title: `Delete room ${r.roomNo}?`,
    message: `Its ${r.capacity} bed${r.capacity === 1 ? '' : 's'} are removed from your setup. Past tenants keep their payment history.`,
    confirmText: 'Delete room', danger: true,
  })) && run(() => api(`${rPath}/${r._id}`, { method: 'DELETE' }))();
  const renameBuilding = run((g, newName) => api(`${gPath}/${g._id}`, { method: 'PATCH', body: { name: newName } }));
  const renameFloor = run((g, f, newName) => api(`${gPath}/${g._id}/floors/${f._id}`, { method: 'PATCH', body: { name: newName } }));
  // several rooms in one go ("101-110"): added one by one, stopping at the first problem
  const addRooms = run(async (g, f, numbers, capacity, bedRent) => {
    for (const roomNo of numbers) {
      await api(rPath, { method: 'POST', body: { groupId: g?._id, floorId: f?._id, roomNo, capacity, bedRent } });
    }
  });

  if (!groups || !rooms) return <div className="card skeleton" style={{ minHeight: 160, marginBottom: 18 }} aria-hidden="true" />;
  const sortedGroups = [...groups].sort((a, b) => natural(a.name, b.name));
  const loose = rooms.filter((r) => !r.groupId).sort((a, b) => natural(a.roomNo, b.roomNo));

  return (
    <div className="analytics-card prop" style={{ marginBottom: 18 }}>
      <div className="card-header-row">
        <div>
          <h3 className="analytics-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className={`setup-step ${rooms.length ? 'done' : ''}`}>{rooms.length ? <CheckIcon size={13} /> : step}</span>
            Buildings, floors & rooms
          </h3>
          <span className="analytics-card-subtitle">
            {rooms.length ? `${plural(groups.length, 'building')} · ${totals(rooms)}` : 'Add your building, then its floors, then the rooms on each floor with their beds.'}
          </span>
        </div>
        <div className="prop-head-actions">
          {rooms.length > 0 && <Link to="/rooms" className="btn-secondary prop-btn">See beds & tenants</Link>}
          <button type="button" className="btn-secondary prop-btn" onClick={() => setAddingBuilding(!addingBuilding)}>
            {addingBuilding ? <XIcon size={13} /> : <PlusIcon size={13} />} {addingBuilding ? 'Cancel' : 'Add building'}
          </button>
        </div>
      </div>

      {addingBuilding && (
        <form className="prop-inline" onSubmit={(e) => { e.preventDefault(); addBuilding(); }}>
          <input autoFocus required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="Building name, e.g. Main building or Block B" aria-label="Building name" />
          <button type="submit" disabled={!name.trim()}><CheckIcon size={14} /> Save</button>
        </form>
      )}
      {error && <p className="error" role="alert">{error}</p>}

      {!groups.length && !loose.length && !addingBuilding && (
        <div className="empty" style={{ padding: '24px 12px' }}>
          <b>No buildings yet</b>
          <span>Even with just one building, add it first. Then add its floors and rooms.</span>
          <button type="button" onClick={() => setAddingBuilding(true)} style={{ marginTop: 10 }}><PlusIcon size={13} /> Add building</button>
        </div>
      )}

      {sortedGroups.map((g, i) => (
        <Building key={g._id} g={g} accent={ACCENTS[i % ACCENTS.length]} rooms={rooms.filter((r) => String(r.groupId?._id || r.groupId) === g._id)}
          onAddFloor={addFloor} onRemoveFloor={removeFloor} onRemove={removeBuilding} onAddRooms={addRooms} onRemoveRoom={removeRoom}
          onRename={renameBuilding} onRenameFloor={renameFloor} onEditRoom={setEditing} />
      ))}

      {loose.length > 0 && (
        <div className="prop-building">
          <div className="prop-building-head"><b>Rooms not in a building</b><span className="muted small">{totals(loose)}</span></div>
          <RoomGrid rooms={loose} onRemove={removeRoom} onEdit={setEditing} />
        </div>
      )}

      {editing && (
        <EditRoom room={editing} groups={sortedGroups} path={`${rPath}/${editing._id}`}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />
      )}
    </div>
  );
}

// a name with a pencil next to it; the pencil turns it into a small form
function Renamable({ value, label, onSave, children }) {
  const [draft, setDraft] = useState(null);
  if (draft === null) {
    return (
      <>
        {children}
        <button type="button" className="prop-edit" aria-label={`Rename ${label}`} title="Rename" onClick={() => setDraft(value)}><EditIcon size={13} /></button>
      </>
    );
  }
  return (
    <form className="prop-rename" onSubmit={async (e) => { e.preventDefault(); if (draft.trim() && await onSave(draft.trim())) setDraft(null); }}>
      <input autoFocus value={draft} maxLength={60} onChange={(e) => setDraft(e.target.value)} aria-label={`New name for ${label}`} />
      <button type="submit" disabled={!draft.trim()} aria-label="Save name"><CheckIcon size={14} /></button>
      <button type="button" className="btn-secondary" aria-label="Cancel" onClick={() => setDraft(null)}><XIcon size={13} /></button>
    </form>
  );
}

// Change a room: number, beds, building, floor. The server refuses fewer beds than tenants.
export function EditRoom({ room, groups, path, onClose, onSaved }) {
  const [roomNo, setRoomNo] = useState(room.roomNo);
  const [capacity, setCapacity] = useState(room.capacity);
  const [bedRent, setBedRent] = useState(room.bedRent ?? '');
  const [groupId, setGroupId] = useState(room.groupId?._id || room.groupId || '');
  const [floorId, setFloorId] = useState(room.floorId || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const building = groups.find((g) => g._id === groupId);
  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await api(path, { method: 'PATCH', body: { roomNo, capacity: Number(capacity), bedRent: bedRent === '' ? null : Number(bedRent), groupId: groupId || null, floorId: floorId || null } });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal-content" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <div className="form-header" style={{ marginBottom: 16 }}>
          <h3 className="form-title" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <BedIcon size={17} style={{ color: 'var(--primary)' }} /> Edit room {room.roomNo}
          </h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><XIcon size={14} /></button>
        </div>
        <div className="expense-form">
          <Field label="Room number *">
            <input required autoFocus value={roomNo} onChange={(e) => setRoomNo(e.target.value)} />
          </Field>
          <Field label="Beds *">
            <select value={capacity} onChange={(e) => setCapacity(e.target.value)}>
              {Array.from({ length: 30 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n} disabled={n < room.occupied}>{plural(n, 'bed')}{n < room.occupied ? ' (too few for current tenants)' : ''}</option>
              ))}
            </select>
          </Field>
          {room.occupied > 0 && <p className="small muted" style={{ margin: '-8px 0 0' }}>{plural(room.occupied, 'tenant')} live{room.occupied === 1 ? 's' : ''} here now.</p>}
          <Field label="Rent per bed (₹, optional)">
            <input type="number" min="0" step="1" inputMode="numeric" placeholder="e.g. 6000" value={bedRent} onChange={(e) => setBedRent(e.target.value)} />
          </Field>
          <Field label="Building">
            <select value={groupId} onChange={(e) => { setGroupId(e.target.value); setFloorId(''); }}>
              <option value="">Not in a building</option>
              {groups.map((g) => <option key={g._id} value={g._id}>{g.name}</option>)}
            </select>
          </Field>
          {building && (
            <Field label="Floor">
              <select value={floorId} onChange={(e) => setFloorId(e.target.value)}>
                <option value="">Not on a floor</option>
                {building.floors.map((f) => <option key={f._id} value={f._id}>{f.name}</option>)}
              </select>
            </Field>
          )}
        </div>
        {error && <p className="error" role="alert" style={{ marginTop: 12 }}>{error}</p>}
        <div className="expense-form-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={busy || !roomNo.trim()}>{busy ? 'Saving…' : 'Save changes'}</button>
        </div>
      </form>
    </div>
  );
}

function Building({ g, accent, rooms, onAddFloor, onRemoveFloor, onRemove, onAddRooms, onRemoveRoom, onRename, onRenameFloor, onEditRoom }) {
  const [floorName, setFloorName] = useState(null); // null = form closed
  const [copyFrom, setCopyFrom] = useState(''); // a floor whose rooms the new floor copies
  const [open, setOpen] = useState(true);
  const noFloor = rooms.filter((r) => !r.floorId || !g.floors.some((f) => f._id === r.floorId));
  const roomsOn = (f) => rooms.filter((r) => r.floorId === f._id).sort((a, b) => natural(a.roomNo, b.roomNo));
  const floorsWithRooms = g.floors.filter((f) => roomsOn(f).length);
  const source = g.floors.find((f) => f._id === copyFrom);
  const sourceRooms = source ? roomsOn(source) : [];
  const numbers = source ? copyNumbers(sourceRooms, rooms, g.floors.indexOf(source), g.floors.length) : null;
  const copy = numbers && { rooms: sourceRooms, numbers };
  const sameName = floorName && g.floors.find((f) => f.name.trim().toLowerCase() === floorName.trim().toLowerCase());
  const openFloorForm = () => {
    setFloorName(nextFloorName(g.floors));
    setCopyFrom(floorsWithRooms[floorsWithRooms.length - 1]?._id || ''); // usually the same as the floor below
  };
  return (
    <div className={`prop-building${open ? '' : ' folded'}`} style={{ '--accent': accent }}>
      <div className="prop-building-head">
        <button type="button" className="prop-fold" aria-expanded={open} aria-label={`${open ? 'Fold' : 'Open'} ${g.name}`} onClick={() => setOpen(!open)}>
          <ChevronIcon size={14} />
        </button>
        <span className="prop-building-icon" aria-hidden="true"><BuildingIcon size={18} /></span>
        <span className="prop-building-title">
          <span className="prop-name-row"><Renamable value={g.name} label={g.name} onSave={(n) => onRename(g, n)}><b>{g.name}</b></Renamable></span>
          <Stats floors={g.floors.length} rooms={rooms} />
        </span>
        <Fill rooms={rooms} big />
        {!rooms.length && !g.floors.length && (
          <button type="button" className="icon-btn prop-del" aria-label={`Delete ${g.name}`} title="Delete building" onClick={() => onRemove(g)}><TrashIcon size={13} /></button>
        )}
      </div>

      {open && <>
      {g.floors.map((f) => (
        <Floor key={f._id} g={g} f={f} rooms={roomsOn(f)}
          onRemove={() => onRemoveFloor(g, f)} onAddRooms={onAddRooms} onRemoveRoom={onRemoveRoom}
          onRename={(n) => onRenameFloor(g, f, n)} onEditRoom={onEditRoom} />
      ))}
      {noFloor.length > 0 && (
        <div className="prop-floor">
          <div className="prop-floor-head"><span className="prop-floor-badge" aria-hidden="true">?</span><b>Not on a floor yet</b><Stats rooms={noFloor} /></div>
          <RoomGrid rooms={noFloor} onRemove={onRemoveRoom} onEdit={onEditRoom} />
        </div>
      )}

      {floorName === null ? (
        <button type="button" className="btn-link prop-add-floor" onClick={openFloorForm}>
          <PlusIcon size={13} /> Add floor
        </button>
      ) : (
        <form className="prop-floor-form" onSubmit={async (e) => {
          e.preventDefault();
          if (await onAddFloor(g, floorName, copy || null)) { setFloorName(null); setCopyFrom(''); }
        }}>
          <label>
            <span className="small muted">Floor name</span>
            <input autoFocus required maxLength={40} value={floorName} onChange={(e) => setFloorName(e.target.value)} aria-label="Floor name" placeholder="e.g. Ground floor, 1st floor, Terrace" />
            {sameName && <span className="error small">{g.name} already has {sameName.name}.</span>}
          </label>
          {floorsWithRooms.length > 0 && (
            <label>
              <span className="small muted">Rooms on it</span>
              <select value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)} aria-label="Rooms on the new floor">
                <option value="">Start empty</option>
                {floorsWithRooms.map((f) => <option key={f._id} value={f._id}>Same as {f.name} ({plural(roomsOn(f).length, 'room')})</option>)}
              </select>
            </label>
          )}
          {source && (
            <p className={copy ? 'prop-copy-preview' : 'prop-copy-preview error'}>
              {copy
                ? <>Adds rooms <b>{copy.numbers.join(', ')}</b> with the same beds{sourceRooms.some((r) => r.bedRent != null) ? ' and rent' : ''} as {source.name}.</>
                : <>The rooms of {source.name} can&apos;t be numbered automatically. Start empty and add them by hand.</>}
            </p>
          )}
          <div className="prop-floor-form-actions">
            <button type="button" className="btn-secondary" onClick={() => setFloorName(null)}>Cancel</button>
            <button type="submit" disabled={!floorName.trim() || !!sameName || (source && !copy)}>
              <CheckIcon size={14} /> {copy ? `Add floor with ${plural(copy.rooms.length, 'room')}` : 'Add floor'}
            </button>
          </div>
        </form>
      )}
      </>}
    </div>
  );
}

function Floor({ g, f, rooms, onRemove, onAddRooms, onRemoveRoom, onRename, onEditRoom }) {
  const [open, setOpen] = useState(false);
  const [numbers, setNumbers] = useState('');
  const [beds, setBeds] = useState(2);
  const [rent, setRent] = useState('');
  const list = expandRooms(numbers);
  return (
    <div className="prop-floor">
      <div className="prop-floor-head">
        <span className="prop-floor-badge" aria-hidden="true">{floorBadge(f.name)}</span>
        <Renamable value={f.name} label={f.name} onSave={onRename}><b>{f.name}</b></Renamable>
        {rooms.length ? <Stats rooms={rooms} /> : <span className="prop-chip">no rooms yet</span>}
        <Fill rooms={rooms} />
        <span className="prop-floor-actions">
          <button type="button" className="btn-secondary prop-btn" onClick={() => setOpen(!open)}>
            {open ? <XIcon size={12} /> : <PlusIcon size={12} />} {open ? 'Cancel' : 'Add room'}
          </button>
          {!rooms.length && (
            <button type="button" className="icon-btn prop-del" aria-label={`Delete ${f.name}`} title="Delete floor" onClick={onRemove}><TrashIcon size={13} /></button>
          )}
        </span>
      </div>
      {open && (
        <form className="prop-inline prop-room-form" onSubmit={async (e) => {
          e.preventDefault();
          if (list?.length && await onAddRooms(g, f, list, Number(beds), rent === '' ? null : Number(rent))) { setNumbers(''); setRent(''); setOpen(false); }
        }}>
          <label>
            <span className="small muted">Room number, or a range like 101-110</span>
            <input autoFocus required value={numbers} onChange={(e) => setNumbers(e.target.value)} placeholder="e.g. 101" aria-label="Room number" />
          </label>
          <label>
            <span className="small muted">Beds in each room</span>
            <select value={beds} onChange={(e) => setBeds(e.target.value)} aria-label="Beds">
              {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => <option key={n} value={n}>{plural(n, 'bed')}</option>)}
            </select>
          </label>
          <label>
            <span className="small muted">Rent per bed (₹, optional)</span>
            <input type="number" min="0" step="1" inputMode="numeric" value={rent} onChange={(e) => setRent(e.target.value)} placeholder="e.g. 6000" aria-label="Rent per bed" />
          </label>
          <button type="submit" disabled={!list?.length}>
            <CheckIcon size={14} /> {list === null ? 'Range too big (max 50)' : list.length > 1 ? `Add ${list.length} rooms` : 'Add room'}
          </button>
        </form>
      )}
      {rooms.length > 0 && <RoomGrid rooms={rooms} onRemove={onRemoveRoom} onEdit={onEditRoom} />}
    </div>
  );
}

function RoomGrid({ rooms, onRemove, onEdit }) {
  return (
    <div className="prop-rooms">
      {[...rooms].sort((a, b) => natural(a.roomNo, b.roomNo)).map((r) => {
        const free = Math.max(0, r.capacity - r.occupied);
        return (
          <div key={r._id} className={`prop-room ${free ? '' : 'full'}`} title={r.bedRent != null ? `${rupees(r.bedRent)} per bed` : undefined}>
            <div className="prop-room-top">
              <b>{r.roomNo}</b>
              <span className="prop-room-actions">
                <button type="button" className="prop-room-del" aria-label={`Edit room ${r.roomNo}`} title="Edit room" onClick={() => onEdit(r)}><EditIcon size={11} /></button>
                {!r.occupied && (
                  <button type="button" className="prop-room-del" aria-label={`Delete room ${r.roomNo}`} title="Delete room" onClick={() => onRemove(r)}><XIcon size={11} /></button>
                )}
              </span>
            </div>
            <div className="prop-beds" aria-label={`${r.occupied} of ${r.capacity} beds taken`}>
              {Array.from({ length: r.capacity }).map((_, i) => <i key={i} className={i < r.occupied ? 'taken' : ''} />)}
            </div>
            <span className="prop-room-foot">
              <span className={free ? 'green-text' : 'prop-room-full'}>{free ? `${free} free` : 'Full'}</span>
              {r.bedRent != null && <b>{rupees(r.bedRent)}</b>}
            </span>
            <span className="prop-room-bar" aria-hidden="true"><i style={{ width: `${Math.round((Math.min(r.occupied, r.capacity) / r.capacity) * 100)}%` }} /></span>
          </div>
        );
      })}
    </div>
  );
}
