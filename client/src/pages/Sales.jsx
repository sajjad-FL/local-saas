import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { api, rupees, can, ADD, EDIT, userId } from '../api.js';
import { useBiz } from '../contexts.js';
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
  const [moreOpen, setMoreOpen] = useState(false); // phones: the ⋯ menu

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

  const addItem = (k) => { setMoreOpen(false); setView(k); setAddKey((n) => n + 1); };

  return (
    <div className="sl">
      {/* phones: title, ⋯, one main button — same as Money and Members */}
      <header className="mr-phone-head sl-phone-head">
        <h1>Sales</h1>
        {can(biz, EDIT) && (
          <div className="mr-more">
            <button type="button" className="mr-more-btn" aria-label="More" aria-haspopup="menu" aria-expanded={moreOpen} onClick={() => setMoreOpen((o) => !o)}>⋯</button>
            {moreOpen && (
              <>
                <div className="mr-more-scrim" onClick={() => setMoreOpen(false)} aria-hidden="true" />
                <div className="mr-more-menu" role="menu">
                  {kinds.map((k) => {
                    const KIcon = KINDS[k].icon;
                    return <button key={k} type="button" role="menuitem" onClick={() => addItem(k)}><span className="mr-more-icon"><KIcon size={14} /></span>{KINDS[k].add}</button>;
                  })}
                </div>
              </>
            )}
          </div>
        )}
        {can(biz, ADD) && <button type="button" className="btn mr-phone-pay" disabled={!catalogue?.length} onClick={() => setSelling({})}><PlusIcon size={14} /> Sell</button>}
      </header>

      <div className="page-header home-header db-head mr-desk-head">
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
            <span className="lbl-long">{t.label}</span><span className="lbl-short">{{ pt: 'PT packs' }[t.id] || t.label}</span>
            {t.count > 0 && <span className="db-tab-count">{t.count}</span>}
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
