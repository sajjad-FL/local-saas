export function formatINR(val = 0) {
  return `₹${Number(val || 0).toLocaleString('en-IN')}`;
}

export function formatRupees(val = 0) {
  return formatINR(val);
}

export function getPlanColor(name = '', idx = 0) {
  const n = (name || '').toLowerCase();
  if (n.includes('month') || n.includes('1m') || n.includes('basic')) return '#3B82F6';
  if (n.includes('quarter') || n.includes('3m') || n.includes('standard')) return '#8B5CF6';
  if (n.includes('half') || n.includes('6m') || n.includes('premium')) return '#F59E0B';
  if (n.includes('year') || n.includes('12m') || n.includes('annual')) return '#10B981';

  const palette = ['#3B82F6', '#8B5CF6', '#F59E0B', '#10B981', '#EC4899', '#06B6D4'];
  return palette[idx % palette.length];
}

// Same rule as the web's plan pills: monthly blue, quarterly green, half-yearly amber, the rest purple
export function getPlanPillClass(name = '') {
  const n = (name || '').toLowerCase();
  const pill = (color, bg) => ({ bg, text: color, border: bg, color });
  if (n.includes('month') && !n.includes('3') && !n.includes('6') && !n.includes('12')) return pill('#3B82F6', '#EFF6FF');
  if (n.includes('3 month') || n.includes('quarter')) return pill('#10B981', '#ECFDF5');
  if (n.includes('6 month') || n.includes('half')) return pill('#F59E0B', '#FFFBEB');
  return pill('#8B5CF6', '#F5F3FF');
}

export function getRenewalThreshold(daysLeft) {
  if (daysLeft === null || daysLeft === undefined) {
    return {
      color: 'gray',
      badgeClass: 'gray',
      bgSoft: '#F1F5F9',
      textColor: '#64748B',
      borderColor: '#E2E8F0',
      label: 'No renewal date',
      pulse: false,
    };
  }

  if (daysLeft < 0) {
    return {
      color: 'red',
      badgeClass: 'danger',
      bgSoft: '#FEE2E2',
      textColor: '#991B1B',
      borderColor: '#EF4444',
      label: `Overdue by ${Math.abs(daysLeft)}d`,
      pulse: true,
    };
  }

  if (daysLeft === 0) {
    return {
      color: 'red',
      badgeClass: 'danger',
      bgSoft: '#FEE2E2',
      textColor: '#991B1B',
      borderColor: '#EF4444',
      label: 'Renews Today',
      pulse: true,
    };
  }

  if (daysLeft <= 3) {
    return {
      color: 'red',
      badgeClass: 'danger',
      bgSoft: '#FEE2E2',
      textColor: '#991B1B',
      borderColor: '#EF4444',
      label: `${daysLeft}d left`,
      pulse: true,
    };
  }

  if (daysLeft <= 14) {
    return {
      color: 'amber',
      badgeClass: 'warning',
      bgSoft: '#FEF3C7',
      textColor: '#92400E',
      borderColor: '#F59E0B',
      label: `${daysLeft}d left`,
      pulse: false,
    };
  }

  return {
    color: 'green',
    badgeClass: 'success',
    bgSoft: '#D1FAE5',
    textColor: '#065F46',
    borderColor: '#10B981',
    label: `${daysLeft}d left`,
    pulse: false,
  };
}

