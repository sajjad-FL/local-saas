import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { api, rupees, can, ADD, EDIT, userId } from '../api.js';
import { useBiz } from '../App.jsx';
import { PlusIcon, TagIcon } from '../ui.jsx';
import SellModal from '../SellModal.jsx';
import { KINDS, CatalogueTab, SalesView } from './Setup.jsx';

// Everything charged once: what was sold (with totals and history), and the products,
// PT packs and services you sell. Memberships stay in Setup.
export default function Sales() {
  const biz = useBiz();
  if (biz.salesEnabled === false) {
    return (
      <section className="mx-list en-empty">
        <span className="en-empty-icon"><TagIcon size={26} /></span>
        <h2>Selling is turned off</h2>
        <p>{biz.ownerId === userId() ? 'Turn on "Sell products & services" in Settings to sell PT packs, services and products.' : 'Ask the owner to turn it on in Settings.'} Past sales are kept.</p>
        <Link to="/settings" className="btn">Open Settings</Link>
      </section>
    );
  }
  return <SalesOn biz={biz} />;
}

function SalesOn({ biz }) {
  const [params, setParams] = useSearchParams();
  const kinds = ['product', 'pt', 'service'].filter((k) => !KINDS[k].gymOnly || biz.type === 'gym');
  const view = ['sales', ...kinds].includes(params.get('view')) ? params.get('view') : params.get('view') === 'items' ? kinds[0] : 'sales';
  const setView = (v) => { setAddKey(0); setParams((p) => { p.set('view', v); return p; }, { replace: true }); };
  const [addKey, setAddKey] = useState(0);
  const [selling, setSelling] = useState(null); // {} or { start: itemId }

  const { data: catalogue } = useQuery({ queryKey: ['catalogue', biz._id], queryFn: () => api(`/businesses/${biz._id}/catalogue`) });
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const { data: month } = useQuery({
    queryKey: ['sales', biz._id, 'month'],
    queryFn: () => api(`/businesses/${biz._id}/sales?from=${monthStart.toISOString()}&to=${new Date().toISOString()}`),
  });
  const count = (k) => (catalogue || []).filter((i) => i.kind === k).length;
  const subtitle = month
    ? `${new Date().toLocaleDateString('en-IN', { month: 'long' })} · ${rupees(month.totals.revenue)} sold${month.totals.unpaid ? ` · ${rupees(month.totals.unpaid)} not paid yet` : ''}`
    : 'Products, PT packs and services';
  const tabs = [
    { id: 'sales', label: 'Sales', count: month?.totals.count },
    ...kinds.map((k) => ({ id: k, label: KINDS[k].label, count: catalogue ? count(k) : undefined })),
  ];

  return (
    <div className="sl">
      <div className="page-header home-header db-head">
        <div className="page-title-wrap">
          <p className="db-date">{subtitle}</p>
          <h1 className="db-hello">Sales</h1>
        </div>
        <nav className="db-quick" aria-label="Quick actions">
          {can(biz, ADD) && (
            <button type="button" className="db-quick-btn pri q-sell" disabled={!catalogue?.length} onClick={() => setSelling({})}>
              <span className="db-quick-icon"><TagIcon size={15} /></span>
              <span className="db-quick-long">Sell something</span><span className="db-quick-short">Sell</span>
            </button>
          )}
          {can(biz, EDIT) && (
            <button type="button" className="db-quick-btn q-add-item" onClick={() => { if (view === 'sales') setView(kinds[0]); setAddKey((k) => k + 1); }}>
              <span className="db-quick-icon"><PlusIcon size={15} /></span>
              <span className="db-quick-long">{view === 'sales' ? KINDS[kinds[0]].add : KINDS[view].add}</span><span className="db-quick-short">Add item</span>
            </button>
          )}
        </nav>
      </div>

      <div className="db-tabs su-tabs sl-tabs" role="tablist" aria-label="Sales">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={view === t.id} className={`db-tab ${view === t.id ? 'on' : ''}`} onClick={() => setView(t.id)}>
            {t.label}{t.count > 0 && <span className="db-tab-count">{t.count}</span>}
          </button>
        ))}
      </div>

      {view === 'sales'
        ? <SalesView biz={biz} />
        : <CatalogueTab biz={biz} kind={view} items={catalogue} addKey={addKey} onSell={(id) => setSelling({ start: id })} />}

      <AnimatePresence>
        {selling && <SellModal biz={biz} start={selling.start} onClose={() => setSelling(null)} />}
      </AnimatePresence>
    </div>
  );
}
