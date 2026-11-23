import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckIcon, FilterIcon } from './ui.jsx';

// Phones: every filter in one sheet from the bottom, as tappable chips.
// Choices apply at once; the button at the bottom says how many match.
// groups: [{ label, value, onPick, options: [{ value, label, count? }], def = 'all' }]
export default function FilterSheet({ groups, count, noun = ['item', 'items'], onClear, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  const anySet = groups.some((g) => g.value !== (g.def ?? 'all'));
  return (
    <div className="modal-overlay fs-overlay" onClick={onClose}>
      <motion.div
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ duration: 0.2 }}
        className="fs-sheet" role="dialog" aria-modal="true" aria-labelledby="fs-title" onClick={(e) => e.stopPropagation()}>
        <span className="fs-grip" aria-hidden="true" />
        <div className="fs-head">
          <h2 id="fs-title">Filters</h2>
          {anySet && <button type="button" className="mx-link" onClick={onClear}>Clear all</button>}
        </div>
        {groups.map((g) => (
          <fieldset key={g.label} className="fs-group">
            <legend>{g.label}</legend>
            <div className="fs-chips">
              {g.options.map((o) => (
                <button key={o.value} type="button" aria-pressed={g.value === o.value} className={`en-choice ${g.value === o.value ? 'on' : ''}`} onClick={() => g.onPick(o.value)}>
                  {g.value === o.value && <CheckIcon size={13} />} {o.label}{o.count != null && o.value !== (g.def ?? 'all') ? <span className="fs-count">{o.count}</span> : null}
                </button>
              ))}
            </div>
          </fieldset>
        ))}
        <button type="button" className="btn fs-done" onClick={onClose}>Show {count} {count === 1 ? noun[0] : noun[1]}</button>
      </motion.div>
    </div>
  );
}

// The button that opens it, shown next to search on phones only
export function FilterButton({ on, onClick }) {
  return (
    <button type="button" className={`en2-filter-btn ${on ? 'set' : ''}`} onClick={onClick} aria-label={`Filters${on ? `, ${on} on` : ''}`}>
      <FilterIcon size={17} />
      {on > 0 && <span className="en2-filter-count">{on}</span>}
    </button>
  );
}
