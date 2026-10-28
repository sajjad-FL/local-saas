import { useState } from 'react';
import { motion } from 'framer-motion';
import { api, rupees } from './api.js';
import { Field, XIcon, CheckIcon, DoorIcon, BedIcon } from './ui.jsx';

const natural = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const today = () => new Date().toISOString().slice(0, 10);

// Pick a room with a free bed, choose the rent from now on, and move.
// rooms/groups: the business's rooms (with occupied counts) and buildings (with floors).
export default function MoveRoom({ member, currentRent, rooms, groups, onClose, onMoved }) {
  const currentRoomId = String(member.roomId?._id || member.roomId || '');
  const current = rooms.find((r) => r._id === currentRoomId);
  const buildingOf = (r) => String(r.groupId?._id || r.groupId || '');
  const sortedGroups = [...groups].sort((a, b) => natural(a.name, b.name));
  const [buildingId, setBuildingId] = useState(() => (current && buildingOf(current)) || sortedGroups[0]?._id || '');
  const [roomId, setRoomId] = useState('');
  const [rent, setRent] = useState(currentRent != null ? String(currentRent) : '');
  const [on, setOn] = useState(today());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const target = rooms.find((r) => r._id === roomId);
  const building = sortedGroups.find((g) => g._id === buildingId);
  // floors in the building's order, then rooms not on a floor; rooms outside any building last
  const sections = [];
  if (building) {
    const inB = rooms.filter((r) => buildingOf(r) === building._id);
    for (const f of building.floors || []) sections.push({ key: f._id, title: f.name, rooms: inB.filter((r) => r.floorId === f._id) });
    const noFloor = inB.filter((r) => !(building.floors || []).some((f) => f._id === r.floorId));
    if (noFloor.length) sections.push({ key: 'nofloor', title: 'Not on a floor', rooms: noFloor });
  } else {
    sections.push({ key: 'loose', title: 'Rooms', rooms: rooms.filter((r) => !buildingOf(r)) });
  }
  for (const s of sections) s.rooms.sort((a, b) => natural(a.roomNo, b.roomNo));

  const pickRoom = (r) => {
    setRoomId(r._id);
    setError('');
  };
  const rentNumber = rent === '' ? null : Number(rent);
  const rentChanged = rentNumber !== null && rentNumber !== currentRent;

  const move = async () => {
    setBusy(true);
    setError('');
    try {
      await api(`/members/${member._id}/move`, { method: 'POST', body: { roomId, on, rent: rentChanged ? rentNumber : null } });
      onMoved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 130 }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.18 }}
        className="modal-content move-room"
        role="dialog"
        aria-label={`Move ${member.name} to another room`}
        onClick={(e) => e.stopPropagation()}>
        <div className="form-header" style={{ marginBottom: 12 }}>
          <h3 className="form-title" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <DoorIcon size={17} style={{ color: 'var(--primary)' }} /> Move {member.name}
          </h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><XIcon size={14} /></button>
        </div>

        <div className="move-path">
          <div>
            <span className="move-path-label">Now in</span>
            <b>{current ? `Room ${current.roomNo}` : 'No room'}</b>
          </div>
          <span className="move-path-arrow" aria-hidden="true">→</span>
          <div className={target ? 'picked' : ''}>
            <span className="move-path-label">Moving to</span>
            <b>{target ? `Room ${target.roomNo}` : 'Pick a room below'}</b>
          </div>
        </div>

        {sortedGroups.length > 1 && (
          <div className="move-buildings" role="tablist" aria-label="Building">
            {sortedGroups.map((g) => (
              <button key={g._id} type="button" role="tab" aria-selected={buildingId === g._id}
                className={buildingId === g._id ? 'active' : ''} onClick={() => { setBuildingId(g._id); setRoomId(''); }}>
                {g.name}
              </button>
            ))}
          </div>
        )}

        <div className="move-rooms">
          {sections.map((s) => (
            <div key={s.key} className="move-floor">
              <span className="move-floor-title">{s.title}</span>
              {s.rooms.length ? (
                <div className="move-room-grid">
                  {s.rooms.map((r) => {
                    const free = Math.max(0, r.capacity - r.occupied);
                    const here = r._id === currentRoomId;
                    return (
                      <button key={r._id} type="button" disabled={here || !free}
                        className={`move-room-tile${roomId === r._id ? ' selected' : ''}${here ? ' here' : ''}${free ? '' : ' full'}`}
                        aria-pressed={roomId === r._id} onClick={() => pickRoom(r)}
                        aria-label={`Room ${r.roomNo}: ${here ? 'their room now' : free ? `${plural(free, 'free bed')}` : 'full'}`}>
                        <b>{r.roomNo}</b>
                        <span className="move-beds" aria-hidden="true">
                          {Array.from({ length: r.capacity }, (_, i) => <i key={i} className={i < r.occupied ? 'taken' : ''} />)}
                        </span>
                        <span className="move-room-note">
                          {here ? 'Now here' : free ? `${free} free` : 'Full'}
                          {r.bedRent != null && !here && free ? ` · ${rupees(r.bedRent)}` : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : <span className="muted small">No rooms on this floor.</span>}
            </div>
          ))}
        </div>

        {target && (
          <div className="move-details">
            <Field label="Rent from now on (₹)">
              <input type="number" min="1" step="1" inputMode="numeric" value={rent} onChange={(e) => setRent(e.target.value)} />
            </Field>
            <Field label="Moving on">
              <input type="date" value={on} max={today()} onChange={(e) => setOn(e.target.value)} />
            </Field>
            <p className="move-hint small">
              {target.bedRent != null && target.bedRent !== rentNumber && (
                <>Room {target.roomNo}'s rent per bed is {rupees(target.bedRent)}.{' '}
                  <button type="button" className="fee-box-reset" onClick={() => setRent(String(target.bedRent))}>Use {rupees(target.bedRent)}</button>{' '}</>
              )}
              {rentChanged ? 'The new rent applies from their next bill. Bills already raised stay as they are.' : 'Their rent stays the same.'}
            </p>
          </div>
        )}

        {error && <p className="error" role="alert" style={{ marginTop: 10 }}>{error}</p>}
        <div className="expense-form-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" disabled={!target || busy || (rent !== '' && (!Number.isInteger(rentNumber) || rentNumber < 1))} onClick={move}>
            <CheckIcon size={14} /> {busy ? 'Moving…' : target ? `Move to Room ${target.roomNo}` : 'Move'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// "Room 01 → Room 04 on 12 Oct · rent ₹10,000 → ₹8,000", newest first
export function RoomHistory({ moves }) {
  if (!moves?.length) return null;
  return (
    <ul className="room-history">
      {[...moves].reverse().map((m, i) => (
        <li key={i}>
          <BedIcon size={13} />
          <span>
            <b>{shortLabel(m.fromLabel) || 'No room'} → {shortLabel(m.toLabel)}</b>
            <span className="muted"> on {new Date(m.on).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            {m.rentBefore != null && m.rentAfter != null && m.rentBefore !== m.rentAfter && (
              <span className="muted"> · rent {rupees(m.rentBefore)} → {rupees(m.rentAfter)}</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
// keep the building, drop the floor: "MF Manjil · Room 04"
const shortLabel = (label) => {
  if (!label) return '';
  const parts = label.split(' · ');
  return parts.length > 2 ? `${parts[0]} · ${parts[parts.length - 1]}` : label;
};
