import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useBiz } from '../App.jsx';
import { words } from '../wording.js';
import { PlusIcon, RupeeIcon } from '../ui.jsx';
import DashboardHome from './DashboardHome.jsx';
import { AddExpense } from './MoneyReport.jsx';

export default function Dashboard() {
  const biz = useBiz();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [addingExpense, setAddingExpense] = useState(false);

  const { data } = useQuery({
    queryKey: ['dashboard', biz._id],
    queryFn: () => api(`/businesses/${biz._id}/dashboard`),
  });

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <>
      <div className="page-header home-header">
        <div className="page-title-wrap">
          <h1 className="page-title">Today</h1>
          <p className="home-date">{today}</p>
        </div>
        <div className="home-actions">
          <button type="button" className="btn-secondary" onClick={() => setAddingExpense(true)}>
            <RupeeIcon size={15} /> Add expense
          </button>
          {/* the Members page has the full form (plan, group, room) */}
          <button type="button" className="btn" onClick={() => navigate('/members?add=1')}>
            <PlusIcon size={15} /> Add {words(biz.type).member}
          </button>
        </div>
      </div>

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
