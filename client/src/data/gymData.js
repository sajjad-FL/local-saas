/**
 * gymData.js - Single Source of Truth for Gym Data Models, Calculators & Helpers
 * Used across Dashboard, Members, and Reports pages.
 */

export const formatINR = (n) => {
  if (n == null || isNaN(n)) return "₹0";
  return `₹${Number(n).toLocaleString("en-IN")}`;
};

export const formatRupees = formatINR;

/**
 * FIX 5 (Reports/Ledger): Monthly Delta full logic:
 * index === 0   -> "First month"
 * curr > prev   -> "+₹{diff}" (green)
 * curr < prev   -> "-₹{diff}" (red)
 * curr === prev -> "No change" (gray)
 */
export const getMonthlyDelta = (curr, prev) => {
  if (prev == null || prev === 0) {
    return { text: "First month", type: "neutral", diff: 0 };
  }
  const diff = Number(curr || 0) - Number(prev || 0);
  if (diff > 0) {
    return { text: `+${formatINR(diff)}`, type: "success", diff };
  }
  if (diff < 0) {
    return { text: `-${formatINR(Math.abs(diff))}`, type: "danger", diff };
  }
  return { text: "No change", type: "neutral", diff: 0 };
};

/**
 * FIX 5 (Dashboard): Next Renewal thresholds
 * > 14 days -> green border + green text
 * <= 14 days -> amber border + amber text
 * <= 3 days  -> red border + red text + pulse
 */
export const getRenewalThreshold = (daysLeft) => {
  if (daysLeft === null || daysLeft === undefined || isNaN(daysLeft) || daysLeft > 365) {
    return {
      color: "gray",
      borderColor: "var(--border)",
      bgSoft: "var(--bg-subtle)",
      textColor: "var(--text-3)",
      pulse: false,
      label: "—",
    };
  }
  if (daysLeft <= 3) {
    return {
      color: "red",
      borderColor: "#EF4444",
      bgSoft: "#FEE2E2",
      textColor: "#991B1B",
      pulse: true,
      label: daysLeft <= 0 ? "Today" : daysLeft === 1 ? "Tomorrow" : `${daysLeft} days left`,
    };
  }
  if (daysLeft <= 14) {
    return {
      color: "amber",
      borderColor: "#F59E0B",
      bgSoft: "#FEF3C7",
      textColor: "#92400E",
      pulse: false,
      label: `${daysLeft} days left`,
    };
  }
  return {
    color: "green",
    borderColor: "#10B981",
    bgSoft: "#D1FAE5",
    textColor: "#065F46",
    pulse: false,
    label: `${daysLeft} days left`,
  };
};

export const getPlanColor = (name, idx = 0) => {
  const n = (name || "").toLowerCase();
  if (n.includes("month") && !n.includes("3") && !n.includes("6") && !n.includes("12")) return "#3B82F6";
  if (n.includes("3 month") || n.includes("quarter")) return "#10B981";
  if (n.includes("6 month") || n.includes("half")) return "#F59E0B";
  if (n.includes("annual") || n.includes("year") || n.includes("12 month")) return "#8B5CF6";
  const palette = ["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EC4899", "#06B6D4"];
  return palette[idx % palette.length];
};

export const getPlanPillClass = (name) => {
  const n = (name || "").toLowerCase();
  if (n.includes("month") && !n.includes("3") && !n.includes("6") && !n.includes("12")) return "blue";
  if (n.includes("3 month") || n.includes("quarter")) return "green";
  if (n.includes("6 month") || n.includes("half")) return "amber";
  return "purple";
};

