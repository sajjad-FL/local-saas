import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { api, download, rupees, can, ADD } from "../api.js";
import { words } from "../wording.js";
import { useBiz } from "../contexts.js";
import {
  Rise, CountUp, Avatar, DownloadIcon, RupeeIcon, UsersIcon,
  TrendingUpIcon, CheckCircleIcon, AlertIcon, FileSpreadsheetIcon,
  PieChartIcon, BarChartIcon, CheckIcon, SearchIcon, XIcon, SendIcon,
  ArrowRightIcon, ChevronDownIcon, PlusIcon,
} from "../ui.jsx";
import { formatINR, formatRupees, getMonthlyDelta, getPlanPillClass } from "../data/gymData.js";
import { CollectPaymentModal, ReminderModal, PickMember } from "./Members.jsx";
import MoneyReport from "./MoneyReport.jsx";
import FilterSheet, { FilterButton } from "../FilterSheet.jsx";

export default function Reports() {
  const biz = useBiz();
  const [addingExpense, setAddingExpense] = useState(false);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  // Who paid on phones: quick chips, plus plan and sort in the filter sheet
  const [whoShow, setWhoShow] = useState("all"); // 'all' | 'owe' | 'paid'
  const [whoPlan, setWhoPlan] = useState("all");
  const [whoSort, setWhoSort] = useState("owed"); // 'owed' | 'paid' | 'name'
  const [whoFilters, setWhoFilters] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false); // phones: the ⋯ menu in the header
  const navigate = useNavigate();
  const openMember = (id) => navigate(`/members/${id}`);
  const [collectModal, setCollectModal] = useState(null);
  const [reminderModal, setReminderModal] = useState(null);
  const [picking, setPicking] = useState(false); // "Record payment": choose who paid
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = ['breakdown', 'expenses', 'members'].includes(searchParams.get('view')) ? searchParams.get('view') : 'breakdown';
  const setTab = (v) => setSearchParams((p) => { p.set('view', v); return p; }, { replace: true });
  const showGrid = tab === 'members'; // the month-by-member grid shows on its own tab

  const { data } = useQuery({
    queryKey: ["dashboard", biz._id],
    queryFn: () => api(`/businesses/${biz._id}/dashboard`),
  });

  const { data: plans } = useQuery({
    queryKey: ["plans", biz._id],
    queryFn: () => api(`/businesses/${biz._id}/plans`),
  });

  if (!data) {
    return (
      <div aria-hidden="true">
        <div className="stats-kpi-grid kpi-3" style={{ marginBottom: 16 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="card skeleton" style={{ minHeight: 114 }} />
          ))}
        </div>
        <div className="card skeleton" style={{ minHeight: 280, marginBottom: 16 }} />
        <div className="card skeleton" style={{ minHeight: 280 }} />
      </div>
    );
  }

  const {
    metrics,
    planDistribution = [],
    openedMonthName,
    openedYear,
    openedDate,
    monthsOpen: monthsOpenBackend,
    activeMonthsList = [],
    memberPaymentBreakdown = [],
  } = data;




  const qLower = search.trim().toLowerCase();
  // what each member still owes = their unpaid months (the server sends months, not a balance)
  const withBalance = memberPaymentBreakdown.map((m) => ({
    ...m,
    balance: m.balance ?? (m.months || []).filter((x) => x.status === "due" || x.status === "overdue").reduce((s, x) => s + (x.amount || 0), 0),
  }));
  const monthName = Object.fromEntries(activeMonthsList.map((x) => [x.key, x.label]));
  const searched = withBalance.filter((m) => {
    if (!qLower) return true;
    return m.name.toLowerCase().includes(qLower) || (m.phone || "").includes(qLower);
  });
  const WHO_SHOW = { all: () => true, owe: (m) => m.balance > 0, paid: (m) => !(m.balance > 0) };
  const filteredBreakdown = searched
    .filter(WHO_SHOW[whoShow])
    .filter((m) => whoPlan === "all" || m.planName === whoPlan)
    .sort(whoSort === "owed" ? (a, b) => (b.balance || 0) - (a.balance || 0) || (b.totalPaid || 0) - (a.totalPaid || 0)
      : whoSort === "paid" ? (a, b) => (b.totalPaid || 0) - (a.totalPaid || 0)
      : (a, b) => a.name.localeCompare(b.name));
  const whoPlans = [...new Set(withBalance.map((m) => m.planName).filter(Boolean))];
  const whoFiltersOn = (whoPlan !== "all" ? 1 : 0) + (whoSort !== "owed" ? 1 : 0);
  const shortMonth = (key) => String(monthName[key] || "").split(" ")[0];
  const DL = [
    ['payments.csv', 'All payments', `${biz.name}-payments.csv`],
    ['dues.csv', 'Unpaid fees', `${biz.name}-unpaid-fees.csv`],
    ['expenses.csv', 'Expenses', `${biz.name}-expenses.csv`],
  ];

  return (
    <>
      {/* Profit & loss for any period; the header shows that period's numbers, like Collect */}
      <MoneyReport
        biz={biz}
        adding={addingExpense}
        setAdding={setAddingExpense}
        tab={tab}
        setTab={setTab}
        whoCount={memberPaymentBreakdown.length}
        header={(r, range) => (
          <>
          {/* phones: one line, title + ⋯ + Payment (desktop keeps the tiles below) */}
          <div className="mr-phone-head">
            <h1>Money</h1>
            <div className="mr-more">
              <button type="button" className="mr-more-btn" aria-label="More" aria-haspopup="menu" aria-expanded={moreOpen} onClick={() => setMoreOpen(!moreOpen)}>⋯</button>
              {moreOpen && (
                <>
                  <div className="mr-more-scrim" onClick={() => setMoreOpen(false)} aria-hidden="true" />
                  <div className="mr-more-menu" role="menu">
                    {can(biz, ADD) && (
                      <button type="button" role="menuitem" onClick={() => { setMoreOpen(false); setAddingExpense(true); }}>
                        <span className="mr-more-icon exp"><RupeeIcon size={14} /></span>Add expense
                      </button>
                    )}
                    {DL.map(([file, label, name]) => (
                      <button key={file} type="button" role="menuitem" onClick={() => { setMoreOpen(false); download(`/businesses/${biz._id}/export/${file}`, name); }}>
                        <span className="mr-more-icon"><DownloadIcon size={14} /></span>Download {label.toLowerCase()}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            {can(biz, ADD) && (
              <button type="button" className="btn mr-phone-pay" onClick={() => setPicking(true)}><PlusIcon size={14} /> Payment</button>
            )}
          </div>
          <div className="page-header home-header db-head mr-desk-head">
            <div className="page-title-wrap">
              <p className="db-date">
                {range.valid ? `${range.label}${range.isCurrent ? ' so far' : ''} · ${rupees(r.received)} in${r.pending ? ` · ${rupees(r.pending)} still to collect` : ''}` : 'Money in, money out, and who still owes'}
              </p>
              <h1 className="db-hello">Money</h1>
            </div>
            <nav className="db-quick" aria-label="Quick actions">
              {can(biz, ADD) && (
                <button type="button" className="db-quick-btn pri q-expense" onClick={() => setAddingExpense(true)}>
                  <span className="db-quick-icon"><RupeeIcon size={15} /></span>
                  <span className="db-quick-long">Add expense</span><span className="db-quick-short">Expense</span>
                </button>
              )}
              {can(biz, ADD) && (
                <button type="button" className="db-quick-btn q-pay" onClick={() => setPicking(true)}>
                  <span className="db-quick-icon"><PlusIcon size={15} /></span>
                  <span className="db-quick-long">Record payment</span><span className="db-quick-short">Payment</span>
                </button>
              )}
              <DownloadMenu biz={biz} />
            </nav>
          </div>
          </>
        )}
      />

      <AnimatePresence>
        {picking && (
          <PickMember
            members={(data.membersTable || []).filter((m) => m.status === 'active')}
            word={words(biz.type).member}
            onClose={() => setPicking(false)}
            onPick={(m) => { setPicking(false); setCollectModal({ member: m, balance: m.balance > 0 ? m.balance : m.planAmount }); }}
          />
        )}
      </AnimatePresence>

      {/* Section 2: Member Payment Breakdown */}
      {showGrid && (
      <div className="analytics-card mr-box mr-who" id="member-breakdown">
        <div className="card-header-row">
          <div>
            <h3 className="analytics-card-title">Who paid each month</h3>
            <span className="analytics-card-subtitle">
              Every member, month by month since {openedMonthName} {openedYear}
            </span>
          </div>
        </div>

        {showGrid && (
        <>
        <div className="card-header-row who-search-row" style={{ marginBottom: 8 }}>
          <div className="search-input-wrap" style={{ width: 220, maxWidth: '100%' }}>
            <input
              type="search"
              placeholder="Search name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ height: 32, fontSize: 11.5 }}
            />
          </div>
          {/* phones: filter right after the search */}
          <span className="who-filter-btn"><FilterButton on={whoFiltersOn} onClick={() => setWhoFilters(true)} /></span>
        </div>
        <div className="who-chips" role="group" aria-label="Show">
          {[['all', 'All'], ['owe', 'Owe'], ['paid', 'Paid up']].map(([k, label]) => (
            <button key={k} type="button" aria-pressed={whoShow === k} className={whoShow === k ? 'on' : ''} onClick={() => setWhoShow(k)}>
              {label} <span>{searched.filter(WHO_SHOW[k]).length}</span>
            </button>
          ))}
        </div>
        <AnimatePresence>
          {whoFilters && (
            <FilterSheet
              count={filteredBreakdown.length}
              noun={[words(biz.type).member, `${words(biz.type).member}s`]}
              onClose={() => setWhoFilters(false)}
              onClear={() => { setWhoPlan("all"); setWhoSort("owed"); }}
              groups={[
                whoPlans.length > 1 && { label: 'Plan', value: whoPlan, onPick: setWhoPlan, options: [{ value: 'all', label: 'All plans' }, ...whoPlans.map((p) => ({ value: p, label: p, count: withBalance.filter((m) => m.planName === p).length }))] },
                { label: 'Sort', value: whoSort, onPick: setWhoSort, def: 'owed', options: [{ value: 'owed', label: 'Most owed first' }, { value: 'paid', label: 'Most paid first' }, { value: 'name', label: 'Name A–Z' }] },
              ].filter(Boolean)}
            />
          )}
        </AnimatePresence>

        <div className="analytics-table-wrap">
          <table className="analytics-table sticky-first-col">
            <thead>
              <tr>
                <th>MEMBER</th>
                <th>PLAN</th>
                {activeMonthsList.map((mon) => (
                  <th key={mon.key} style={{ textAlign: "center" }}>
                    {mon.label}
                  </th>
                ))}
                <th style={{ textAlign: "right" }}>TOTAL PAID</th>
                <th>EFFICIENCY</th>
                <th style={{ textAlign: "right" }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredBreakdown.map((m, idx) => {
                const isPaid = (m.balance || 0) <= 0;
                return (
                  <motion.tr
                    key={m._id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2, delay: idx * 0.03 }}>
                    <td>
                      <div
                        className="table-member-cell"
                        style={{ cursor: "pointer" }}
                        onClick={() => openMember(m._id)}>
                        <span className="hide-sm"><Avatar name={m.name} /></span>
                        <div>
                          <div className="table-member-name">{m.name}</div>
                          <div className="table-member-phone hide-sm">{m.phone || "No phone"}</div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className={`table-plan-pill ${getPlanPillClass(m.planName)}`}>
                        {m.planName || <span style={{ color: "#94a3b8" }}>—</span>}
                      </span>
                    </td>

                    {(m.months || []).map((mon) => (
                      <td key={mon.key} style={{ textAlign: "center" }}>
                        {mon.status === "paid" && (
                          <span className="status-pill-cell paid" title={`Paid ${mon.label}`}>
                            ✓ {mon.label}
                          </span>
                        )}
                        {mon.status === "due" && (
                          <span className="status-pill-cell due" title={`Due ${mon.label}`}>
                            Due {mon.label}
                          </span>
                        )}
                        {mon.status === "overdue" && (
                          <span className="status-pill-cell overdue" title={`Overdue ${mon.label}`}>
                            Overdue {mon.label}
                          </span>
                        )}
                        {(mon.status === "none" || mon.status === "not_joined" || !mon.status) && (
                          <span className="status-pill-cell none" style={{ color: "#94a3b8" }}>
                            —
                          </span>
                        )}
                      </td>
                    ))}

                    <td style={{ textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                      {m.totalPaid != null ? formatINR(m.totalPaid) : <span style={{ color: "#94a3b8" }}>—</span>}
                    </td>

                    <td>
                      <div className="row" style={{ gap: 8, alignItems: "center" }}>
                        <div style={{ width: 64, height: 6, borderRadius: 3, background: "var(--bg-subtle)", overflow: "hidden", flex: "none" }}>
                          <div
                            style={{
                              width: `${m.efficiency ?? 100}%`,
                              height: "100%",
                              background: (m.efficiency ?? 100) === 100 ? "#10B981" : (m.efficiency ?? 100) >= 50 ? "#F59E0B" : "#EF4444",
                            }}
                          />
                        </div>
                        <span className="small muted" style={{ fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>
                          {m.efficiency ?? 100}%
                        </span>
                      </div>
                    </td>

                    <td style={{ textAlign: "right" }}>
                      {isPaid ? (
                        <button
                          type="button"
                          className="btn-link"
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--primary)",
                            cursor: "pointer",
                            fontSize: 12,
                            fontWeight: 500,
                            padding: 0,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                          onClick={() => openMember(m._id)}>
                          <span>View profile</span>
                          <ArrowRightIcon size={12} />
                        </button>
                      ) : (
                        <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{
                              fontSize: 11,
                              padding: "3px 8px",
                              minHeight: 26,
                              borderColor: "var(--amber-border)",
                              color: "var(--amber)",
                            }}
                            onClick={() =>
                              setReminderModal({
                                member: m,
                                balance: m.balance,
                                nextRenewalDate: m.nextRenewal ? new Date(m.nextRenewal) : null,
                              })
                            }>
                            <SendIcon size={11} /> Send reminder
                          </button>

                          <button
                            type="button"
                            className="btn"
                            style={{
                              background: "var(--green)",
                              color: "#FFFFFF",
                              fontSize: 11,
                              padding: "3px 8px",
                              minHeight: 26,
                            }}
                            onClick={() => setCollectModal({ member: m, balance: m.balance })}>
                            <CheckIcon size={11} /> Collect {formatINR(m.balance || 0)}
                          </button>
                        </div>
                      )}
                    </td>
                  </motion.tr>
                );
              })}

              {!filteredBreakdown.length && (
                <tr>
                  <td colSpan={4 + activeMonthsList.length} style={{ textAlign: "center", padding: "24px 12px", color: "var(--text-3)" }}>
                    No members match search query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* phones: one line per member: name + month tags, what they owe or paid, one button */}
        <ul className="who-rows">
          {filteredBreakdown.map((m) => {
            const owes = (m.balance || 0) > 0;
            return (
              <li key={m._id} className="who-row">
                <button type="button" className="who-row-main" onClick={() => openMember(m._id)}>
                  <b>{m.name}</b>
                  <span className="who-row-tags">
                    {(m.months || []).filter((mon) => mon.status !== 'not_joined').map((mon) => {
                      const st = mon.status === 'paid' || mon.status === 'due' || mon.status === 'overdue' ? mon.status : 'none';
                      const word = { paid: 'paid', overdue: 'late', due: 'due', none: 'nothing' }[st];
                      return (
                        <span key={mon.key} className={`who-tag ${st}`} title={`${monthName[mon.key] || ''}: ${word}${st === 'none' ? '' : ` ${mon.label}`}`}>
                          {st === 'paid' ? '✓ ' : ''}{shortMonth(mon.key)}
                        </span>
                      );
                    })}
                    {m.planName && <span className="who-row-plan">{m.planName}</span>}
                  </span>
                </button>
                <span className="who-row-amt">
                  <b className={owes ? 'red' : 'green'}>{formatINR(owes ? m.balance : m.totalPaid || 0)}</b>
                  <span>{owes ? 'owes' : 'paid'}</span>
                </span>
                {owes && can(biz, ADD)
                  ? <button type="button" className="btn who-row-btn" onClick={() => setCollectModal({ member: m, balance: m.balance })}>Collect</button>
                  : <button type="button" className="btn-secondary who-row-btn" onClick={() => openMember(m._id)}>Open</button>}
              </li>
            );
          })}
          {!filteredBreakdown.length && <li className="who-empty">{search ? `No members match “${search}”.` : 'Nobody here.'}</li>}
          <li className="who-key" aria-hidden="true"><span><i className="paid" />Paid</span><span><i className="overdue" />Late</span><span><i className="due" />Due</span></li>
        </ul>
        </>
        )}
      </div>
      )}

      {/* Collect Payment Modal */}
      {collectModal && (
        <CollectPaymentModal
          member={collectModal.member}
          balance={collectModal.balance}
          plan={plans?.find((p) => p.name === collectModal.member?.planName)}
          onClose={() => setCollectModal(null)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["dashboard", biz._id] });
            qc.invalidateQueries({ queryKey: ["members", biz._id] });
            qc.invalidateQueries({ queryKey: ["report", biz._id] });
            setCollectModal(null);
          }}
        />
      )}

      {/* Reminder Modal */}
      {reminderModal && (
        <ReminderModal
          member={reminderModal.member}
          balance={reminderModal.balance}
          bizName={biz.name}
          nextRenewalDate={reminderModal.nextRenewalDate}
          onClose={() => setReminderModal(null)}
        />
      )}
    </>
  );
}

// One place for every spreadsheet download (each asks to confirm and says what's inside)
function DownloadMenu({ biz }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (e.type === 'keydown' ? e.key === 'Escape' : !ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);
  const items = [
    ['payments.csv', 'All payments', 'Every payment received', `${biz.name}-payments.csv`],
    ['dues.csv', 'Unpaid fees', 'Who owes what, oldest first', `${biz.name}-unpaid-fees.csv`],
    ['expenses.csv', 'Expenses', 'Everything you spent', `${biz.name}-expenses.csv`],
  ];
  return (
    <div className="dl-menu" ref={ref}>
      <button type="button" className="db-quick-btn q-download" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="db-quick-icon"><DownloadIcon size={15} /></span>
        <span className="db-quick-long">Download <ChevronDownIcon size={14} /></span><span className="db-quick-short">Download</span>
      </button>
      {open && (
        <div className="dl-menu-list" role="menu">
          {items.map(([file, label, hint, name]) => (
            <button key={file} type="button" role="menuitem"
              onClick={() => { setOpen(false); download(`/businesses/${biz._id}/export/${file}`, name); }}>
              <b>{label}</b><span>{hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
