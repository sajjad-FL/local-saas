import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { api, download } from "../api.js";
import { useBiz } from "../App.jsx";
import {
  Rise, CountUp, Avatar, DownloadIcon, RupeeIcon, UsersIcon,
  TrendingUpIcon, CheckCircleIcon, AlertIcon, FileSpreadsheetIcon,
  PieChartIcon, BarChartIcon, CheckIcon, SearchIcon, XIcon, SendIcon,
  ArrowRightIcon,
} from "../ui.jsx";
import { formatINR, formatRupees, getMonthlyDelta, getPlanPillClass } from "../data/gymData.js";
import { MemberProfileSheet, CollectPaymentModal, ReminderModal } from "./Members.jsx";

export default function Reports() {
  const biz = useBiz();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const [collectModal, setCollectModal] = useState(null);
  const [reminderModal, setReminderModal] = useState(null);

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
    revenueTrend = [],
    planDistribution = [],
    openedMonthName,
    openedYear,
    openedDate,
    monthsOpen: monthsOpenBackend,
    activeMonthsList = [],
    memberPaymentBreakdown = [],
  } = data;

  const filteredMonths = (revenueTrend || []).filter(
    (r) => r.isAfterOpening || r.collected > 0 || r.pending > 0
  );

  const monthsOpen = monthsOpenBackend || filteredMonths.length || 1;
  const totalCollections = filteredMonths.reduce((s, t) => s + (t.collected || 0), 0);
  const totalPending = filteredMonths.reduce((s, t) => s + (t.pending || 0), 0);
  const totalOverall = totalCollections + totalPending;
  const overallEfficiency = totalOverall > 0 ? Math.round((totalCollections / totalOverall) * 100) : 100;

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
          <h1 className="page-title">
            Financial & Member Reports
          </h1>
          <p className="page-subtitle">
            Comprehensive audit reports, monthly revenue breakdowns, and collection efficiency metrics.
          </p>
        </div>

        <div className="row" style={{ gap: 8 }}>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            className="btn"
            onClick={() => download(`/businesses/${biz._id}/export/payments.csv`, `${biz.name}-all-payments.csv`)}>
            <DownloadIcon size={14} /> Export All Payments
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            className="btn-secondary"
            onClick={() => download(`/businesses/${biz._id}/export/dues.csv`, `${biz.name}-unpaid-dues.csv`)}>
            <FileSpreadsheetIcon size={14} /> Export Dues
          </motion.button>
        </div>
      </div>

      {/* Top 3 KPI Cards */}
      <div className="stats-kpi-grid kpi-3" style={{ marginBottom: 16 }}>
        {/* KPI 1: TOTAL COLLECTED · ALL TIME */}
        <Rise i={0}>
          <div className="kpi-card">
            <div className="kpi-card-top">
              <span className="kpi-label">TOTAL COLLECTED · ALL TIME</span>
              <span className="kpi-icon-wrap" style={{ background: "#D1FAE5", color: "#065F46" }}>
                <RupeeIcon size={16} />
              </span>
            </div>
            <div className="kpi-value-row">
              <div className="kpi-value">
                <CountUp value={totalCollections} duration={0.8} prefix="₹" />
              </div>
            </div>
            <div className="kpi-delta-row">
              <span className="kpi-delta-caption muted">
                {openedMonthName} {openedYear} · present · {monthsOpen} month{monthsOpen > 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </Rise>

        {/* KPI 2: TOTAL PENDING ARREARS */}
        <Rise i={1}>
          <div
            className="kpi-card"
            style={{
              borderColor: totalPending === 0 ? "#6EE7B7" : "#FCA5A5",
            }}>
            <div className="kpi-card-top">
              <span className="kpi-label">TOTAL PENDING ARREARS</span>
              <span
                className="kpi-icon-wrap"
                style={{
                  background: totalPending === 0 ? "#D1FAE5" : "#FEE2E2",
                  color: totalPending === 0 ? "#065F46" : "#991B1B",
                }}>
                {totalPending === 0 ? <CheckCircleIcon size={16} /> : <AlertIcon size={16} />}
              </span>
            </div>
            <div className="kpi-value-row">
              <div className="kpi-value">
                <CountUp value={totalPending} duration={0.8} prefix="₹" />
              </div>
            </div>
            <div className="kpi-delta-row">
              <span className={`kpi-delta-badge ${totalPending === 0 ? "success" : "danger"}`}>
                {overallEfficiency}% overall collection rate
              </span>
            </div>
          </div>
        </Rise>

        {/* KPI 3: MONTHLY REVENUE */}
        <Rise i={2}>
          <div className="kpi-card">
            <div className="kpi-card-top">
              <span className="kpi-label">MONTHLY REVENUE</span>
              <span className="kpi-icon-wrap" style={{ background: "#EDE9FE", color: "#6D28D9" }}>
                <TrendingUpIcon size={16} />
              </span>
            </div>
            <div className="kpi-value-row">
              <div className="kpi-value">
                <CountUp value={metrics.monthlyRevenue.value} duration={0.8} prefix="₹" />
              </div>
            </div>
            <div className="kpi-delta-row">
              <span className="kpi-delta-caption muted">
                from {metrics.activeMembers.value} active member{metrics.activeMembers.value > 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </Rise>
      </div>

      {/* Section 1: Monthly Audit Statement */}
      <div className="analytics-card" style={{ marginBottom: 16 }} id="audit-statement">
        <div className="card-header-row">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h3 className="analytics-card-title">Monthly Audit Statement</h3>
              <span className="gym-opened-badge">
                <span style={{ color: "#10b981" }}>●</span> Since {openedMonthName} {openedYear}
              </span>
            </div>
            <span className="analytics-card-subtitle">
              Month-by-month financial ledger collections and outstanding arrears ({openedMonthName} {openedYear} onwards)
            </span>
          </div>
        </div>

        <div className="analytics-table-wrap">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>BILLING PERIOD</th>
                <th style={{ textAlign: "right" }}>COLLECTED (₹)</th>
                <th style={{ textAlign: "right" }}>PENDING DUES (₹)</th>
                <th style={{ textAlign: "right" }}>TOTAL BILLED (₹)</th>
                <th>MONTHLY DELTA</th>
                <th>COLLECTION RATE</th>
              </tr>
            </thead>
            <tbody>
              {filteredMonths.map((m, idx) => {
                const collectedVal = m.collected ?? 0;
                const pendingVal = m.pending ?? 0;
                const total = collectedVal + pendingVal;
                const pct = total > 0 ? Math.round((collectedVal / total) * 100) : 100;
                const prevMonth = filteredMonths[idx - 1];
                const deltaObj = getMonthlyDelta(collectedVal, prevMonth ? prevMonth.collected : null);

                return (
                  <motion.tr
                    key={`${m.month}-${m.year}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: idx * 0.03 }}>
                    <td>
                      <span style={{ fontWeight: 600, color: "var(--text)" }}>
                        {m.monthFull || m.month} {m.year}
                      </span>
                    </td>

                    <td style={{ textAlign: "right", fontWeight: 600, color: "var(--green)", fontVariantNumeric: "tabular-nums" }}>
                      +{formatINR(collectedVal)}
                    </td>

                    <td style={{ textAlign: "right", fontWeight: 600, color: pendingVal > 0 ? "var(--amber)" : "var(--text-3)", fontVariantNumeric: "tabular-nums" }}>
                      {pendingVal > 0 ? formatINR(pendingVal) : <span style={{ color: "#94a3b8" }}>—</span>}
                    </td>

                    <td style={{ textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                      {total > 0 ? formatINR(total) : <span style={{ color: "#94a3b8" }}>—</span>}
                    </td>

                    <td>
                      <span className={`kpi-delta-badge ${deltaObj.type}`}>
                        {deltaObj.text}
                      </span>
                    </td>

                    <td>
                      <div className="row" style={{ gap: 8, alignItems: "center" }}>
                        <div style={{ width: 80, height: 6, borderRadius: 3, background: "var(--bg-subtle)", overflow: "hidden", flex: "none" }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: pct >= 80 ? "#10B981" : pct >= 50 ? "#F59E0B" : "#EF4444" }} />
                        </div>
                        <span className="small muted" style={{ fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>
                          {pct}%
                        </span>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}

              {!filteredMonths.length && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "24px 12px", color: "var(--text-3)" }}>
                    No audit ledger entries recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: Member Payment Breakdown */}
      <div className="analytics-card" id="member-breakdown">
        <div className="card-header-row">
          <div>
            <h3 className="analytics-card-title">Member Payment Breakdown</h3>
            <span className="analytics-card-subtitle">
              Who paid and who didn't, month-by-month since {openedMonthName} {openedYear}
            </span>
          </div>

          <div className="search-input-wrap" style={{ width: 200 }}>
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
                        <Avatar name={m.name} />
                        <div>
                          <div className="table-member-name">{m.name}</div>
                          <div className="table-member-phone">{m.phone || "No phone"}</div>
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
