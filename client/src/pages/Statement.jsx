import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { rupees } from '../api.js';
import { PrinterIcon, RupeeIcon } from '../ui.jsx';

const API_BASE = import.meta.env.VITE_API_URL || '';
const fmt = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const short = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

// Public, read-only statement a member opens from a WhatsApp link: no app, no login, no fee.
export default function Statement() {
  const { token } = useParams();
  const { data, error, isLoading } = useQuery({
    queryKey: ['statement', token],
    retry: false,
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/public/statement/${token}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'could not load statement');
      return body;
    },
  });

  if (isLoading) return <p className="center">Loading statement…</p>;
  if (error) {
    return (
      <main className="statement">
        <div className="analytics-card statement-empty">
          <h1>Statement unavailable</h1>
          <p className="muted">{error.message}. Ask the owner to send you a new link.</p>
        </div>
      </main>
    );
  }

  const { business, member, ledger, balance, generatedAt } = data;
  const upi = business.upiId && balance > 0 &&
    `upi://pay?pa=${business.upiId}&pn=${encodeURIComponent(business.name)}&am=${balance}&cu=INR`;
  const dep = member.deposit;

  return (
    <main className="statement">
      <header className="statement-head">
        <div>
          <div className="muted small">{business.name}</div>
          <h1>{member.name}</h1>
          <div className="muted small">Member since {fmt(member.joinDate)}{member.status === 'left' && ' · Left'}</div>
        </div>
        <button type="button" className="btn-secondary no-print" onClick={() => window.print()}>
          <PrinterIcon size={14} /> Print / Save PDF
        </button>
      </header>

      <section className={`analytics-card statement-balance ${balance > 0 ? 'owe' : 'clear'}`}>
        <div className="muted small">{balance > 0 ? 'Amount due' : balance < 0 ? 'Paid in advance' : 'Balance'}</div>
        <div className="statement-amount">{balance > 0 ? rupees(balance) : balance < 0 ? rupees(-balance) : 'All paid up'}</div>
        {upi && (
          <a className="btn statement-pay no-print" href={upi}>
            <RupeeIcon size={15} /> Pay {rupees(balance)} via UPI
          </a>
        )}
        {upi && <div className="muted small no-print">Opens your UPI app. Paid directly to {business.name}, no extra fee.</div>}
      </section>

      {(dep?.amount || member.noticeGivenOn) && (
        <section className="analytics-card statement-facts">
          {dep?.amount > 0 && (
            <div>
              <div className="muted small">Security deposit</div>
              <b>{rupees(dep.amount)}</b>
              <div className="small">
                {dep.refundedOn ? `Refunded ${rupees(dep.refundedAmount ?? dep.amount)} on ${fmt(dep.refundedOn)}` : 'Held by owner'}
              </div>
            </div>
          )}
          {member.noticeGivenOn && (
            <div>
              <div className="muted small">Notice given</div>
              <b>{fmt(member.noticeGivenOn)}</b>
            </div>
          )}
        </section>
      )}

      <section className="analytics-card">
        <table className="statement-table">
          <thead>
            <tr><th>Date</th><th>Entry</th><th className="num">Amount</th><th className="num">Balance</th></tr>
          </thead>
          <tbody>
            {[...ledger].reverse().map((r) => (
              <tr key={r.id}>
                <td>{fmt(r.date)}</td>
                <td>{r.kind === 'due' ? `Fee · ${short(r.date)} – ${short(r.periodEnd)}` : `Paid${r.mode ? ` · ${r.mode.toUpperCase()}` : ''}`}</td>
                <td className={`num ${r.kind === 'payment' ? 'green-text' : ''}`}>{r.kind === 'payment' ? '−' : '+'}{rupees(r.amount)}</td>
                <td className="num">{rupees(r.balance)}</td>
              </tr>
            ))}
            {!ledger.length && <tr><td colSpan={4} className="muted">No entries yet.</td></tr>}
          </tbody>
        </table>
      </section>

      <p className="muted small statement-foot">
        Read-only statement shared by {business.name}. Updated {fmt(generatedAt)}. Something wrong? Reply to the owner on WhatsApp.
      </p>
    </main>
  );
}
