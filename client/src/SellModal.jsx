import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { api, rupees } from './api.js';
import { words } from './wording.js';
import { XIcon, TagIcon, CheckIcon, PlusIcon } from './ui.jsx';
import { PickMember } from './pages/Members.jsx';

export const KIND_LABEL = { pt: 'PT packs', service: 'Services', product: 'Products' };
const MODES = [['cash', 'Cash'], ['upi', 'UPI'], ['other', 'Card / bank']];

// Sell catalogue items to a member. Without a member it asks who first.
// start: an item id to put in the basket straight away
export default function SellModal({ biz, member: givenMember = null, start = null, onClose, onSold }) {
  const qc = useQueryClient();
  const W = words(biz.type);
  const [member, setMember] = useState(givenMember);
  const { data: items } = useQuery({ queryKey: ['catalogue', biz._id], queryFn: () => api(`/businesses/${biz._id}/catalogue`) });
  const { data: members = [] } = useQuery({ queryKey: ['members', biz._id], queryFn: () => api(`/businesses/${biz._id}/members`), enabled: !givenMember });
  const [qty, setQty] = useState(() => (start ? { [start]: 1 } : {}));
  const [kind, setKind] = useState(null);
  const [paidNow, setPaidNow] = useState(true);
  const [mode, setMode] = useState('cash');
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const list = items || [];
  const kinds = ['product', 'pt', 'service'].filter((k) => list.some((i) => i.kind === k));
  const curKind = kind || (start && list.find((i) => i._id === start)?.kind) || kinds[0];
  const picked = list.filter((i) => qty[i._id] > 0);
  const total = picked.reduce((n, i) => n + i.price * qty[i._id], 0);
  const change = (i, d) => setQty((q) => {
    const max = i.trackStock ? i.stock : 100;
    return { ...q, [i._id]: Math.max(0, Math.min(max, (q[i._id] || 0) + d)) };
  });

  const sell = useMutation({
    mutationFn: () => api(`/members/${member._id}/sell`, {
      method: 'POST',
      body: { items: picked.map((i) => ({ itemId: i._id, qty: qty[i._id] })), paidNow, mode: paidNow ? mode : undefined },
    }),
    onSuccess: () => {
      // balances, Collect, Money, stock and this member's ledger all change
      ['members', 'dashboard', 'report', 'catalogue', 'member', 'attendance'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      onSold?.();
      onClose();
    },
  });

  if (!member) {
    return (
      <AnimatePresence>
        <PickMember
          title="Sell to who?"
          members={members.filter((m) => m.status === 'active')}
          word={W.member}
          onClose={onClose}
          onPick={setMember}
        />
      </AnimatePresence>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 12 }} transition={{ duration: 0.18 }}
        className="modal-content sell-modal" role="dialog" aria-modal="true" aria-labelledby="sell-title" onClick={(e) => e.stopPropagation()}>
        <div className="form-header" style={{ marginBottom: 12 }}>
          <div className="form-title"><TagIcon size={18} style={{ color: 'var(--primary)' }} /><span id="sell-title">Sell to {member.name}</span></div>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><XIcon size={14} /></button>
        </div>

        {items && !list.length ? (
          <div className="sell-empty">
            <p>Nothing to sell yet. Add your PT packs, services and products first.</p>
            <Link to="/sales?view=product" className="btn" onClick={onClose}><PlusIcon size={15} /> Add to the catalogue</Link>
          </div>
        ) : (
          <>
            {!givenMember && (
              <button type="button" className="sell-who" onClick={() => setMember(null)}>
                <span><b>{member.name}</b><span>{member.phone || 'No phone'}{member.balance > 0 ? ` · already owes ${rupees(member.balance)}` : ''}</span></span>
                <span className="sell-change">Change</span>
              </button>
            )}
            {kinds.length > 1 && (
              <div className="en-pills sell-kinds" role="radiogroup" aria-label="Kind">
                {kinds.map((k) => (
                  <button key={k} type="button" role="radio" aria-checked={curKind === k} className={`en-choice ${curKind === k ? 'on' : ''}`} onClick={() => setKind(k)}>
                    {KIND_LABEL[k]}{list.filter((i) => i.kind === k && qty[i._id]).length ? ` · ${list.filter((i) => i.kind === k && qty[i._id]).length}` : ''}
                  </button>
                ))}
              </div>
            )}
            <ul className="sell-items">
              {list.filter((i) => i.kind === curKind).map((i) => {
                const n = qty[i._id] || 0;
                const out = i.trackStock && i.stock === 0;
                return (
                  <li key={i._id} className={`sell-item ${n ? 'on' : ''}`}>
                    <button type="button" className="sell-item-main" disabled={out} onClick={() => change(i, 1)}>
                      <b>{i.name}</b>
                      <span>{rupees(i.price)}{i.detail ? ` · ${i.detail}` : ''}{i.trackStock ? ` · ${out ? 'out of stock' : `${i.stock} left`}` : ''}</span>
                    </button>
                    {n > 0 ? (
                      <span className="sell-qty">
                        <button type="button" aria-label={`One less ${i.name}`} onClick={() => change(i, -1)}>−</button>
                        <b aria-live="polite">{n}</b>
                        <button type="button" aria-label={`One more ${i.name}`} disabled={i.trackStock && n >= i.stock} onClick={() => change(i, 1)}>+</button>
                      </span>
                    ) : (
                      <button type="button" className="btn-secondary sell-add" disabled={out} onClick={() => change(i, 1)}>Add</button>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="sell-total"><span>{picked.length ? picked.map((i) => (qty[i._id] > 1 ? `${i.name} ×${qty[i._id]}` : i.name)).join(', ') : 'Tap items to add them'}</span><b>{rupees(total)}</b></div>

            <div className="sell-pay" role="radiogroup" aria-label="How is it paid">
              <button type="button" role="radio" aria-checked={paidNow} className={paidNow ? 'on' : ''} onClick={() => setPaidNow(true)}><b>Paid now</b><span>Records the payment too</span></button>
              <button type="button" role="radio" aria-checked={!paidNow} className={!paidNow ? 'on' : ''} onClick={() => setPaidNow(false)}><b>Add to their dues</b><span>They pay later with their fees</span></button>
            </div>
            {paidNow && (
              <div className="en-pills" role="radiogroup" aria-label="Paid by">
                {MODES.map(([v, l]) => (
                  <button key={v} type="button" role="radio" aria-checked={mode === v} className={`en-choice ${mode === v ? 'on' : ''}`} onClick={() => setMode(v)}>{mode === v && <CheckIcon size={13} />} {l}</button>
                ))}
              </div>
            )}
            {sell.error && <p className="error" role="alert" style={{ margin: 0 }}>{sell.error.message}</p>}
            <button type="button" className="btn sell-go" disabled={!total || sell.isPending} onClick={() => sell.mutate()}>
              {sell.isPending ? 'Saving…' : !total ? 'Pick something to sell' : paidNow ? `Sell · ${rupees(total)} received` : `Add ${rupees(total)} to ${member.name.split(' ')[0]}'s dues`}
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}
