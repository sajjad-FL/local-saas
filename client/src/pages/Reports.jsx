import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { api, download } from "../api.js";
import { useBiz } from "../App.jsx";
import {
  Rise, CountUp, Avatar, DownloadIcon, RupeeIcon, UsersIcon,
  TrendingUpIcon, CheckCircleIcon, AlertIcon, FileSpreadsheetIcon,
  PieChartIcon, BarChartIcon, CheckIcon, SearchIcon, XIcon, SendIcon,
  ArrowRightIcon, ChevronDownIcon,
} from "../ui.jsx";
import { formatINR, formatRupees, getMonthlyDelta, getPlanPillClass } from "../data/gymData.js";
import { MemberProfileSheet, CollectPaymentModal, ReminderModal } from "./Members.jsx";
import MoneyReport from "./MoneyReport.jsx";

export default function Reports() {
  const biz = useBiz();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const [collectModal, setCollectModal] = useState(null);
  const [reminderModal, setReminderModal] = useState(null);
  const [showGrid, setShowGrid] = useState(false); // the month-by-member grid is big: opened on demand

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
  const filteredBreakdown = memberPaymentBreakdown.filter((m) => {
    if (!qLower) return true;
    return m.name.toLowerCase().includes(qLower) || (m.phone || "").includes(qLower);
  });

  return (
    <>
      {/* Top Header */}
      <div className="page-header">
        <div className="page-title-wrap">
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Money in, money out, and who still owes, for any period.</p>
        </div>
        <DownloadMenu biz={biz} />
      </div>

      {/* Profit & loss for any period, with expenses */}
      <MoneyReport biz={biz} />

      {/* Section 2: Member Payment Breakdown */}
      <div className="analytics-card" id="member-breakdown">
        <div className="card-header-row" style={showGrid ? undefined : { marginBottom: 0 }}>
          <div>
            <h3 className="analytics-card-title">Who paid each month</h3>
            <span className="analytics-card-subtitle">
              Every member, month by month since {openedMonthName} {openedYear}
            </span>
          </div>
          <button type="button" className="btn-secondary" aria-expanded={showGrid} onClick={() => setShowGrid(!showGrid)}>
            {showGrid ? 'Hide' : 'Show'} <ChevronDownIcon size={14} style={{ transform: showGrid ? 'rotate(180deg)' : 'none' }} />
          </button>
        </div>

        {showGrid && (
        <>
        <div className="card-header-row" style={{ marginBottom: 8 }}>
          <div className="search-input-wrap" style={{ width: 220, maxWidth: '100%' }}>
            <input
              type="search"
              placeholder="Search member…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ height: 32, fontSize: 11.5 }}
            />
          </div>
        </div>

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
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: idx * 0.03 }}>
                    <td>
                      <div
                        className="table-member-cell"
                        style={{ cursor: "pointer" }}
                        onClick={() => setSelectedMemberId(m._id)}>
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
                          onClick={() => setSelectedMemberId(m._id)}>
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
        </>
        )}
      </div>

      {/* Slide-over Profile Sheet */}
      <AnimatePresence>
        {selectedMemberId && (
          <MemberProfileSheet
            biz={biz}
            memberId={selectedMemberId}
            plans={plans || []}
            onClose={() => setSelectedMemberId(null)}
          />
        )}
      </AnimatePresence>

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
      <button type="button" className="btn-secondary" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        <DownloadIcon size={15} /> Download <ChevronDownIcon size={14} />
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
