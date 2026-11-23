import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { api, can, ADD } from '../api.js';
import { useBiz } from '../contexts.js';
import { words } from '../wording.js';
import { PlusIcon, RupeeIcon, UserPlusIcon, TagIcon } from '../ui.jsx';
import SellModal from '../SellModal.jsx';
import DashboardHome from './DashboardHome.jsx';
import { AddExpense } from './MoneyReport.jsx';
import { CollectPaymentModal, PickMember } from './Members.jsx';

export default function Dashboard() {
  const biz = useBiz();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const w = words(biz.type);
  const [addingExpense, setAddingExpense] = useState(false);
  const [selling, setSelling] = useState(false);
  const [picking, setPicking] = useState(false); // "Record payment": choose who paid
  const [paying, setPaying] = useState(null); // then the payment form for them

  const { data } = useQuery({
    queryKey: ['dashboard', biz._id],
    queryFn: () => api(`/businesses/${biz._id}/dashboard`),
  });

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  // same query as the sidebar's profile badge
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: () => api('/me'), staleTime: 5 * 60000 });
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = (me?.name || '').trim().split(/\s+/)[0];

  const { data: catalogue } = useQuery({ queryKey: ['catalogue', biz._id], queryFn: () => api(`/businesses/${biz._id}/catalogue`) });
  // the things done most, one tap each (big tiles on phones)
  const actions = [
    { key: 'pay', label: 'Record payment', short: 'Payment', icon: RupeeIcon, primary: true, onClick: () => setPicking(true) },
    biz.salesEnabled !== false && catalogue?.length > 0 && { key: 'sell', label: 'Sell', short: 'Sell', icon: TagIcon, onClick: () => setSelling(true) },
    { key: 'member', label: `Add ${w.member}`, short: w.member[0].toUpperCase() + w.member.slice(1), icon: PlusIcon, onClick: () => navigate('/members?add=1') },
    { key: 'enquiry', label: 'Add enquiry', short: 'Enquiry', icon: UserPlusIcon, onClick: () => navigate('/enquiries?add=1') },
    { key: 'expense', label: 'Add expense', short: 'Expense', icon: RupeeIcon, onClick: () => setAddingExpense(true) },
  ].filter(Boolean).filter(() => can(biz, ADD)); // see-only staff get no add buttons

  return (
    <>
      <div className="page-header home-header db-head">
        <div className="page-title-wrap">
          <p className="db-date">{today}</p>
          <h1 className="db-hello">{greeting}{firstName ? `, ${firstName}` : ''}</h1>
        </div>
        <nav className={`db-quick ${actions.length === 5 ? 'five' : ''}`} aria-label="Quick actions">
          {actions.map((a) => (
            <button key={a.key} type="button" className={`db-quick-btn ${a.primary ? 'pri' : ''} q-${a.key}`} onClick={a.onClick}>
              <span className="db-quick-icon"><a.icon size={15} /></span>
              <span className="db-quick-long">{a.label}</span>
              <span className="db-quick-short">{a.short}</span>
            </button>
          ))}
        </nav>
      </div>

      <AnimatePresence>
        {selling && <SellModal key="sell" biz={biz} onClose={() => setSelling(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {addingExpense && (
          <AddExpense
            biz={biz}
            onClose={() => setAddingExpense(false)}
            onSaved={() => {
              setAddingExpense(false);
              // this month's Spent / Profit on the home screen, and the Reports page
              qc.invalidateQueries({ queryKey: ['report', biz._id] });
              qc.invalidateQueries({ queryKey: ['expenses', biz._id] });
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {picking && (
          <PickMember
            members={(data?.membersTable || []).filter((m) => m.status === 'active')}
            word={w.member}
            onClose={() => setPicking(false)}
            onPick={(m) => { setPicking(false); setPaying(m); }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {paying && (
          <CollectPaymentModal
            member={paying}
            balance={paying.balance > 0 ? paying.balance : paying.planAmount}
            plan={null}
            onClose={() => setPaying(null)}
            onSuccess={() => { qc.invalidateQueries(); setPaying(null); }}
          />
        )}
      </AnimatePresence>

      {data ? (
        <DashboardHome biz={biz} data={data} onAddMember={() => navigate('/members?add=1')} />
      ) : (
        <div className="today today-grid" aria-hidden="true">
          <div className="today-main">
            <div className="card skeleton" style={{ minHeight: 130 }} />
            <div className="card skeleton" style={{ minHeight: 90 }} />
            <div className="card skeleton" style={{ minHeight: 220 }} />
          </div>
          <div className="today-side">
            <div className="card skeleton" style={{ minHeight: 220 }} />
          </div>
        </div>
      )}
    </>
  );
}
