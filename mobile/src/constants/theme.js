export const COLORS = {
  // Brand
  primary: '#10B981',      // Emerald green
  primaryDark: '#059669',
  primaryLight: '#D1FAE5',
  primarySoft: '#ECFDF5',

  // Status Colors
  success: '#10B981',
  successSoft: '#D1FAE5',
  successDark: '#065F46',

  warning: '#F59E0B',
  warningSoft: '#FEF3C7',
  warningDark: '#92400E',

  danger: '#EF4444',
  dangerSoft: '#FEE2E2',
  dangerDark: '#991B1B',

  info: '#3B82F6',
  infoSoft: '#DBEAFE',
  infoDark: '#1E40AF',

  purple: '#8B5CF6',
  purpleSoft: '#EDE9FE',
  purpleDark: '#6D28D9',

  // WhatsApp
  whatsapp: '#25D366',
  whatsappSoft: '#DCF8C6',
  whatsappDark: '#128C7E',

  // UPI
  upi: '#5A31F4',

  // Business Types
  biz: {
    gym: {
      accent: '#EF4444',
      soft: '#FEE2E2',
      label: 'Gym & Fitness',
      desc: 'Memberships, workout batches & renewals',
      icon: 'barbell-outline',
      badge: 'Gym Studio',
    },
    mess: {
      accent: '#F59E0B',
      soft: '#FEF3C7',
      label: 'Mess & Tiffin',
      desc: 'Meal subscriptions & shift tracking',
      icon: 'restaurant-outline',
      badge: 'Mess / Tiffin',
    },
    tuition: {
      accent: '#6366F1',
      soft: '#EEF2FF',
      label: 'Tuition & Academy',
      desc: 'Student fees, class batches & subjects',
      icon: 'school-outline',
      badge: 'Tuition / Classes',
    },
    hostel: {
      accent: '#10B981',
      soft: '#ECFDF5',
      label: 'Hostel & PG',
      desc: 'Rooms, bed capacity & rent collection',
      icon: 'bed-outline',
      badge: 'Hostel / PG',
    },
  },
};

export const getTheme = (isDark = false) => ({
  isDark,
  colors: {
    ...COLORS,
    background: isDark ? '#0B0F19' : '#F8FAFC',
    card: isDark ? '#111827' : '#FFFFFF',
    cardSubtle: isDark ? '#1F2937' : '#F1F5F9',
    surface: isDark ? '#1E293B' : '#FFFFFF',
    border: isDark ? '#374151' : '#E2E8F0',
    borderSubtle: isDark ? '#1F2937' : '#EDF2F7',
    text: isDark ? '#F9FAFB' : '#0F172A',
    textSecondary: isDark ? '#9CA3AF' : '#64748B',
    textMuted: isDark ? '#6B7280' : '#94A3B8',
    inputBg: isDark ? '#1F2937' : '#FFFFFF',
    inputBorder: isDark ? '#374151' : '#CBD5E1',
    tabBarBg: isDark ? '#0B0F19' : '#FFFFFF',
    tabBarBorder: isDark ? '#1F2937' : '#E2E8F0',
    tabActive: '#10B981',
    tabInactive: isDark ? '#6B7280' : '#94A3B8',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
  },
  radius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 9999,
  },
});

