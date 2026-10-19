import { Payment, Member, Due, Subscription, Plan } from '../models/index.js';
import { memberBalances, remainingByDue as remainingByDueMap } from '../services/billingService.js';

export async function getDashboardData(req, res, next) {
  try {
    const businessId = req.business._id;
    const now = new Date();
    
    // Month boundaries
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthNamesFull = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const currentMonthName = monthNamesFull[now.getMonth()];
    const lastMonthName = monthNamesFull[lastMonthStart.getMonth()];

    // 1. Fetch business data
    const [
      [currentMonthCollected],
      [lastMonthCollected],
      bal,
      members,
      allPlans,
      unpaidDues,
      allPayments,
      allDues,
    ] = await Promise.all([
      Payment.aggregate([
        { $match: { businessId, date: { $gte: currentMonthStart } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Payment.aggregate([
        { $match: { businessId, date: { $gte: lastMonthStart, $lte: lastMonthEnd } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      memberBalances(businessId),
      Member.find({ businessId }).populate('roomId', 'roomNo groupId floorId').sort('-joinDate'),
      Plan.find({ businessId }),
      Due.find({ businessId, status: { $ne: 'paid' } }).sort('dueDate'),
      Payment.find({ businessId }),
      Due.find({ businessId }),
    ]);

    const memberIds = members.map((m) => m._id);

    // What is still owed on each due (payments cover the oldest dues first), so a
    // partly paid due counts only its unpaid part in the reports, matching balances
    const remainingByDue = remainingByDueMap(allDues, allPayments);
    const remaining = (due) => remainingByDue.get(String(due._id)) || 0;
    const activeMembersList = members.filter((m) => m.status === 'active');
    const activeMemberIdSet = new Set(activeMembersList.map((m) => String(m._id)));
    const activeMembersCount = activeMembersList.length;

    // 2. Fetch subscriptions ONLY for members belonging to THIS business
    const subscriptions = await Subscription.find({
      memberId: { $in: memberIds },
      status: { $ne: 'stopped' },
    }).populate('planId');

    // Members who joined in current month & latest active joined member
    const newThisMonth = members.filter((m) => m.joinDate >= currentMonthStart).length;
    const activeMembersSortedByJoin = [...activeMembersList].sort((a, b) => new Date(b.joinDate) - new Date(a.joinDate));
    const latestActiveMember = activeMembersSortedByJoin[0];
    const lastJoinedFormatted = latestActiveMember
      ? new Date(latestActiveMember.joinDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : null;

    const lastMonthActiveMembersCount = members.filter(
      (m) => m.joinDate < currentMonthStart && m.status === 'active'
    ).length;

    // Monthly revenue & delta (FIX 2: if currentMonth has 0 payments, show last completed month)
    const curRev = currentMonthCollected?.total || 0;
    const lastRev = lastMonthCollected?.total || 0;
    const revDiff = curRev - lastRev;
    const revDeltaText = lastRev === 0
      ? 'First month'
      : revDiff > 0
        ? `+₹${revDiff.toLocaleString('en-IN')} vs ${lastMonthName.slice(0, 3)}`
        : revDiff < 0
          ? `₹${Math.abs(revDiff).toLocaleString('en-IN')} less than ${lastMonthName.slice(0, 3)}`
          : 'No change';

    let displayRevLabel = `COLLECTED · ${currentMonthName.slice(0, 3).toUpperCase()} ${now.getFullYear()}`;
    let displayRevValue = curRev;
    let displayRevDelta = revDeltaText;
    let isLastCompleted = false;

    if (curRev === 0 && lastRev > 0) {
      displayRevLabel = `COLLECTED · ${lastMonthName.slice(0, 3).toUpperCase()} ${lastMonthStart.getFullYear()}`;
      displayRevValue = lastRev;
      displayRevDelta = 'First month · all collected';
      isLastCompleted = true;
    }

    // Pending members
    const oldestDue = new Map();
    for (const d of unpaidDues) {
      if (!oldestDue.has(String(d.memberId))) {
        oldestDue.set(String(d.memberId), d.dueDate);
      }
    }

    const pending = activeMembersList
      .filter((m) => (bal.get(String(m._id)) || 0) > 0)
      .map((m) => ({
        _id: m._id,
        name: m.name,
        phone: m.phone,
        balance: bal.get(String(m._id)),
        dueSince: oldestDue.get(String(m._id)),
        roomId: m.roomId, // hostels: where to find them
      }))
      .sort((a, b) => new Date(a.dueSince || 0) - new Date(b.dueSince || 0));

    const pendingTotal = pending.reduce((s, m) => s + m.balance, 0);
    const membersOwingCount = pending.length;

    // Projected next month calculation
    let projectedNextMonth = 0;
    let totalMonthlyFees = 0;
    const planBreakdownMap = new Map();

    for (const s of subscriptions) {
      if (activeMemberIdSet.has(String(s.memberId)) && s.status === 'active' && s.planId) {
        const pName = s.planId.name || 'Standard Plan';
        const pAmt = s.amount ?? s.planId.amount ?? 0;
        const days = s.planId.cycleDays || 30;
        const monthlyEq = Math.round((pAmt / days) * 30);
        totalMonthlyFees += monthlyEq;
        projectedNextMonth += monthlyEq;

        if (!planBreakdownMap.has(pName)) {
          planBreakdownMap.set(pName, { name: pName, count: 0, amount: pAmt, monthlyEq });
        }
        planBreakdownMap.get(pName).count += 1;
      }
    }
    if (projectedNextMonth === 0) projectedNextMonth = curRev;

    // Avg Member Fee (ARPU) rounded to nearest ₹10
    const avgFee = activeMembersCount > 0 ? Math.round((totalMonthlyFees / activeMembersCount) / 10) * 10 : 0;
    const lastAvgFee = lastMonthActiveMembersCount > 0 ? Math.round((lastRev / lastMonthActiveMembersCount) / 10) * 10 : 0;
    const avgDiff = lastAvgFee > 0 ? avgFee - lastAvgFee : 0;
    const avgDeltaText = lastAvgFee === 0 || avgDiff === 0
      ? 'Stable · no change'
      : avgDiff > 0
        ? `Up ₹${avgDiff.toLocaleString('en-IN')} from last month`
        : `Down ₹${Math.abs(avgDiff).toLocaleString('en-IN')} from last month`;

    const planFeeBreakdown = Array.from(planBreakdownMap.values());

    // Subscriptions indexed by member (latest active subscription)
    const subByMember = new Map();
    for (const s of subscriptions) {
      if (s.status === 'active' || !subByMember.has(String(s.memberId))) {
        subByMember.set(String(s.memberId), s);
      }
    }

    // Card 6 — Next Upcoming Renewal (FIX 5: <= 3d red, <= 14d amber, > 14d green)
    const activeRenewals = subscriptions
      .filter((s) => activeMemberIdSet.has(String(s.memberId)) && s.status === 'active' && s.periodEnd)
      .map((s) => {
        const mem = members.find((m) => String(m._id) === String(s.memberId));
        const pEnd = new Date(s.periodEnd);
        const diffTime = pEnd.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return {
          memberId: String(s.memberId),
          memberName: mem?.name || 'Member',
          phone: mem?.phone || '',
          periodEnd: s.periodEnd,
          pEndDate: pEnd,
          dateFormatted: pEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          diffDays,
        };
      })
      .filter((r) => r.diffDays >= 0)
      .sort((a, b) => a.pEndDate - b.pEndDate);

    const nearestRenewal = activeRenewals[0] || null;
    const sameDayOthers = nearestRenewal
      ? activeRenewals.filter((r) => r.pEndDate.toDateString() === nearestRenewal.pEndDate.toDateString()).length - 1
      : 0;

    const nextRenewal = nearestRenewal
      ? {
          value: nearestRenewal.dateFormatted,
          daysLeft: nearestRenewal.diffDays,
          memberId: nearestRenewal.memberId,
          memberName: nearestRenewal.memberName,
          dateFormatted: nearestRenewal.dateFormatted,
          deltaText: sameDayOthers > 0
            ? `${nearestRenewal.memberName} +${sameDayOthers} other${sameDayOthers > 1 ? 's' : ''} · ${nearestRenewal.diffDays}d left`
            : `${nearestRenewal.memberName} · ${nearestRenewal.diffDays}d left`,
          statusColor: nearestRenewal.diffDays <= 3 ? 'red' : nearestRenewal.diffDays <= 14 ? 'amber' : 'green',
        }
      : {
          value: '—',
          daysLeft: 999,
          memberId: null,
          memberName: '',
          dateFormatted: '—',
          deltaText: 'No renewals scheduled',
          statusColor: 'gray',
        };

    // Find true opening date from oldest member, payment, or due
    const allDates = [
      ...members.map((m) => new Date(m.joinDate)),
      ...allPayments.map((p) => new Date(p.date)),
      ...allDues.map((d) => new Date(d.dueDate)),
    ].filter((d) => !isNaN(d.getTime()));

    const openedDate = allDates.length ? new Date(Math.min(...allDates.map((d) => d.getTime()))) : now;
    const openedMonthName = monthNames[openedDate.getMonth()];
    const openedYear = openedDate.getFullYear();
    const openedMonthIdx = openedDate.getFullYear() * 12 + openedDate.getMonth();

    // Active months from openedDate to now
    const activeMonthsList = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const currentMonthIdx = d.getFullYear() * 12 + d.getMonth();
      if (currentMonthIdx >= openedMonthIdx) {
        activeMonthsList.push({
          key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
          label: `${monthNames[d.getMonth()]} '${String(d.getFullYear()).slice(-2)}`,
          month: monthNames[d.getMonth()],
          monthFull: monthNamesFull[d.getMonth()],
          year: d.getFullYear(),
          monthIndex: currentMonthIdx,
          startDate: new Date(d.getFullYear(), d.getMonth(), 1),
          endDate: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999),
        });
      }
    }

    // 12-Month Revenue Trend (FIX 4: only keep months with data, add projection for current month)
    const trendMonths = [];

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      
      const mPayments = allPayments
        .filter((p) => p.date >= mStart && p.date <= mEnd)
        .reduce((sum, p) => sum + p.amount, 0);

      const mDues = allDues
        .filter((due) => due.dueDate >= mStart && due.dueDate <= mEnd)
        .reduce((sum, due) => sum + remaining(due), 0);

      const hasActivity = mPayments > 0 || mDues > 0;
      const isCurrentMonth = i === 0;

      // Only include months that have actual activity or the current month
      if (hasActivity || isCurrentMonth) {
        trendMonths.push({
          month: monthNames[d.getMonth()],
          monthFull: monthNamesFull[d.getMonth()],
          year: d.getFullYear(),
          collected: mPayments,
          pending: mDues,
          hasActivity,
          isCurrentMonth,
          isProjected: isCurrentMonth && mPayments === 0,
          projectedAmount: projectedNextMonth,
        });
      }
    }

    // Plan Distribution (Donut Chart - strictly active members of this business)
    const planCounts = new Map();
    for (const p of allPlans) {
      planCounts.set(String(p._id), { name: p.name, amount: p.amount, count: 0 });
    }

    for (const member of activeMembersList) {
      const s = subByMember.get(String(member._id));
      if (s && s.planId && s.status === 'active') {
        const pId = String(s.planId._id || s.planId);
        const existing = planCounts.get(pId);
        if (existing) {
          existing.count += 1;
        } else if (s.planId.name) {
          planCounts.set(pId, { name: s.planId.name, amount: s.planId.amount, count: 1 });
        }
      }
    }

    const planDistribution = Array.from(planCounts.values()).filter((p) => p.count > 0);
    const totalPlanMonthly = planDistribution.reduce((s, p) => s + (p.amount * p.count), 0) || 1;
    planDistribution.forEach((p) => {
      p.monthlyRevenue = p.amount * p.count;
      p.pctRevenue = Math.round((p.monthlyRevenue / totalPlanMonthly) * 100);
    });

    // Total payments per member
    const memberPaidTotal = new Map();
    for (const p of allPayments) {
      const mid = String(p.memberId);
      memberPaidTotal.set(mid, (memberPaidTotal.get(mid) || 0) + p.amount);
    }

    // RULE 4: Member Payment Breakdown Table Data
    const memberPaymentBreakdown = members.map((m) => {
      const sub = subByMember.get(String(m._id));
      const mPaid = memberPaidTotal.get(String(m._id)) || 0;
      const mPaymentsList = allPayments.filter((p) => String(p.memberId) === String(m._id));
      const mDuesList = allDues.filter((d) => String(d.memberId) === String(m._id));
      // a backdated subscription bills months before the member was added to the app:
      // the member counts from whichever is earlier, so those months aren't hidden as "not joined"
      const mJoinDate = new Date(Math.min(new Date(m.joinDate), ...mDuesList.map((d) => new Date(d.dueDate))));
      const mJoinMonthIdx = mJoinDate.getFullYear() * 12 + mJoinDate.getMonth();

      let totalBilled = 0;
      const monthStatuses = activeMonthsList.map((mon) => {
        const isBeforeJoin = mon.monthIndex < mJoinMonthIdx;
        if (isBeforeJoin) {
          return {
            key: mon.key,
            month: mon.month,
            year: mon.year,
            status: 'not_joined',
            label: '—',
            amount: 0,
          };
        }

        // Payments in this month
        const paidInMonth = mPaymentsList
          .filter((p) => p.date >= mon.startDate && p.date <= mon.endDate)
          .reduce((sum, p) => sum + p.amount, 0);

        // Dues in this month
        const duesInMonth = mDuesList
          .filter((d) => d.dueDate >= mon.startDate && d.dueDate <= mon.endDate);
        const unpaidInMonth = duesInMonth.reduce((sum, d) => sum + remaining(d), 0);

        totalBilled += (paidInMonth + unpaidInMonth);

        if (paidInMonth > 0 && unpaidInMonth === 0) {
          return {
            key: mon.key,
            month: mon.month,
            year: mon.year,
            status: 'paid',
            label: `₹${paidInMonth.toLocaleString('en-IN')}`,
            amount: paidInMonth,
          };
        } else if (unpaidInMonth > 0) {
          const isPastDue = duesInMonth.some((d) => d.dueDate < now && remaining(d) > 0);
          return {
            key: mon.key,
            month: mon.month,
            year: mon.year,
            status: isPastDue ? 'overdue' : 'due',
            label: `₹${unpaidInMonth.toLocaleString('en-IN')}`,
            amount: unpaidInMonth,
          };
        } else if (paidInMonth > 0) {
          return {
            key: mon.key,
            month: mon.month,
            year: mon.year,
            status: 'paid',
            label: `₹${paidInMonth.toLocaleString('en-IN')}`,
            amount: paidInMonth,
          };
        } else {
          return {
            key: mon.key,
            month: mon.month,
            year: mon.year,
            status: 'none',
            label: '—',
            amount: 0,
          };
        }
      });

      const efficiency = totalBilled > 0 ? Math.min(100, Math.round((mPaid / totalBilled) * 100)) : 100;

      return {
        _id: m._id,
        name: m.name,
        phone: m.phone,
        planName: sub?.planId?.name || (m.roomId ? `Room ${m.roomId.roomNo}` : 'Standard Plan'),
        planAmount: sub?.amount ?? sub?.planId?.amount ?? 0,
        totalPaid: mPaid,
        totalBilled,
        efficiency,
        months: monthStatuses,
      };
    });

    // Enhanced Members Table Data
    const membersTable = members.map((m) => {
      const sub = subByMember.get(String(m._id));
      const mBalance = bal.get(String(m._id)) || 0;
      const mPaid = memberPaidTotal.get(String(m._id)) || 0;
      
      let statusBadge = 'active';
      if (m.status === 'left') {
        statusBadge = 'left';
      } else if (sub?.status === 'paused') {
        statusBadge = 'paused';
      } else if (mBalance > 0) {
        statusBadge = 'overdue';
      } else if (sub?.periodEnd && new Date(sub.periodEnd) <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)) {
        statusBadge = 'due_soon';
      } else {
        statusBadge = 'paid';
      }

      return {
        _id: m._id,
        name: m.name,
        phone: m.phone,
        joinDate: m.joinDate,
        planName: sub?.planId?.name || 'No Plan',
        planAmount: sub?.amount ?? sub?.planId?.amount ?? 0,
        nextRenewal: sub?.periodEnd || null,
        status: m.status,
        statusBadge,
        balance: mBalance,
        amountPaid: mPaid,
      };
    });

    res.json({
      metrics: {
        activeMembers: {
          value: activeMembersCount,
          newThisMonth,
          lastJoinedFormatted,
          deltaText: newThisMonth > 0
            ? `+${newThisMonth} registered`
            : lastJoinedFormatted
              ? `Last joined: ${lastJoinedFormatted}`
              : 'No new members',
        },
        monthlyRevenue: {
          value: displayRevValue,
          label: displayRevLabel,
          deltaText: displayRevDelta,
          diff: isLastCompleted ? 0 : revDiff,
          isLastCompleted,
          prevMonthName: lastMonthName.slice(0, 3),
          prevMonth: lastRev,
          sparkline: [trendMonths[trendMonths.length - 3]?.collected || 0, lastRev, curRev || lastRev],
        },
        membersOwing: {
          value: membersOwingCount,
          isZero: membersOwingCount === 0,
          deltaText: membersOwingCount === 0 ? '✓ All dues cleared' : `${membersOwingCount} member${membersOwingCount > 1 ? 's have' : ' has'} unpaid dues`,
        },
        totalOutstanding: {
          value: pendingTotal,
          isZero: pendingTotal === 0,
          projectedNextMonth,
          deltaText: pendingTotal === 0 ? `₹${projectedNextMonth.toLocaleString('en-IN')} projected next month` : `₹${pendingTotal.toLocaleString('en-IN')} yet to be collected`,
        },
        arpu: {
          value: avgFee,
          diff: avgDiff,
          deltaText: avgDeltaText,
          planFeeBreakdown,
        },
        nextRenewal,
      },
      revenueTrend: trendMonths,
      openedDate: openedDate.toISOString(),
      openedMonthName,
      openedYear,
      monthsOpen: activeMonthsList.length,
      activeMonthsList,
      memberPaymentBreakdown,
      planDistribution,
      membersTable,
      collectedThisMonth: curRev,
      pendingTotal,
      activeMembers: activeMembersCount,
      pending,
    });
  } catch (err) {
    next(err);
  }
}
