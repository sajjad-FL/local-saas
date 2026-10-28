import { useState } from 'react';
import { motion } from 'framer-motion';
import { rupees } from './api.js';
import { words } from './wording.js';
import { Avatar, WhatsAppIcon, XIcon, CheckIcon, SendIcon } from './ui.jsx';

// WhatsApp can't be sent in bulk without the Business API, and browsers block opening many
// chats at once. So "Remind all" walks through the list: one tap opens the next person's
// ready-made message, and the queue moves on.

const waUrl = (phone, text) => {
  let to = String(phone || '').replace(/\D/g, '');
  if (to.length === 10) to = `91${to}`; // Indian numbers saved without the country code
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
};
const shortDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

// the two messages the app sends: money owed, and a heads-up before renewal
export const owingMessage = (biz, m) =>
  `Hi ${m.name}, ${rupees(m.balance)} is pending at ${biz.name}. Please pay at the earliest. Thank you!` +
  (biz.upiId ? ` Pay via UPI: upi://pay?pa=${biz.upiId}&pn=${encodeURIComponent(biz.name)}&am=${m.balance}&cu=INR` : '');
export const renewalMessage = (biz, m) =>
  `Hi ${m.name}, your ${words(biz.type).plan.toLowerCase()} at ${biz.name} renews on ${shortDate(m.nextRenewal)}` +
  `${m.planAmount ? ` (${rupees(m.planAmount)})` : ''}. Please pay by then. Thank you!`;

const STATUS_TEXT = { sent: 'Sent', skipped: 'Skipped', nophone: 'No phone' };

// people: [{ _id, name, phone, message }]
export default function BulkRemind({ title, people, onClose }) {
  // everyone without a phone number is set aside from the start
  const [status, setStatus] = useState(() => Object.fromEntries(people.filter((p) => !p.phone).map((p) => [p._id, 'nophone'])));
  const [messages, setMessages] = useState(() => Object.fromEntries(people.map((p) => [p._id, p.message])));
  const nextFrom = (st, from = 0) => {
    const order = [...people.slice(from), ...people.slice(0, from)];
    return order.find((p) => !st[p._id]) || null;
  };
  const [currentId, setCurrentId] = useState(() => nextFrom(status)?._id ?? null);
  const current = people.find((p) => p._id === currentId) || null;

  const reachable = people.filter((p) => p.phone).length;
  const sent = Object.values(status).filter((s) => s === 'sent').length;
  const skipped = Object.values(status).filter((s) => s === 'skipped').length;
  const done = !current;

  const mark = (state) => {
    const next = { ...status, [current._id]: state };
    setStatus(next);
    const i = people.findIndex((p) => p._id === current._id);
    setCurrentId(nextFrom(next, i + 1)?._id ?? null);
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 130 }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.18 }}
        className="modal-content bulk-remind"
        role="dialog"
        aria-label={`Remind all: ${title}`}
        onClick={(e) => e.stopPropagation()}>
        <div className="form-header" style={{ marginBottom: 12 }}>
          <h3 className="form-title" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <SendIcon size={17} style={{ color: 'var(--primary)' }} /> Remind all · {title}
          </h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><XIcon size={14} /></button>
        </div>

        <div className="bulk-progress">
          <span><b>{sent}</b> of {reachable} sent{skipped ? ` · ${skipped} skipped` : ''}</span>
          <span className="bulk-progress-bar"><i style={{ width: `${reachable ? Math.round(((sent + skipped) / reachable) * 100) : 100}%` }} /></span>
        </div>

        {done ? (
          <div className="bulk-done">
            <span className="bulk-done-icon"><CheckIcon size={22} /></span>
            <b>All done</b>
            <span className="muted">
              {plural(sent, 'reminder')} sent{skipped ? `, ${skipped} skipped` : ''}
              {people.length > reachable ? `, ${people.length - reachable} without a phone number` : ''}.
            </span>
            <button type="button" onClick={onClose}>Close</button>
          </div>
        ) : (
          <div className="bulk-current">
            <div className="bulk-person">
              <Avatar name={current.name} />
              <div>
                <b>{current.name}</b>
                <span className="muted small">{current.phone}{current.note ? ` · ${current.note}` : ''}</span>
              </div>
              <span className="bulk-step">{people.indexOf(current) + 1} / {people.length}</span>
            </div>
            <textarea
              aria-label={`Message to ${current.name}`}
              rows={4}
              value={messages[current._id]}
              onChange={(e) => setMessages({ ...messages, [current._id]: e.target.value })}
            />
            <div className="bulk-actions">
              <button type="button" className="btn-secondary" onClick={() => mark('skipped')}>Skip</button>
              <a
                className="btn bulk-send"
                href={waUrl(current.phone, messages[current._id])}
                target="_blank"
                rel="noreferrer"
                onClick={() => mark('sent')}>
                <WhatsAppIcon size={16} /> Send on WhatsApp
              </a>
            </div>
            <p className="small muted bulk-hint">WhatsApp opens with the message ready. Press send there, come back, and the next person is waiting.</p>
          </div>
        )}

        <ul className="bulk-list">
          {people.map((p) => {
            const st = status[p._id];
            return (
              <li key={p._id} className={`${st || ''}${p._id === currentId ? ' current' : ''}`}>
                <button type="button" disabled={!p.phone} onClick={() => setCurrentId(p._id)}>
                  <span className="bulk-dot" aria-hidden="true">{st === 'sent' ? <CheckIcon size={11} /> : ''}</span>
                  <span className="bulk-name">{p.name}</span>
                  <span className="bulk-state">{p._id === currentId ? 'Now' : STATUS_TEXT[st] || 'Waiting'}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </motion.div>
    </div>
  );
}

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
