// Design System — 100% parity with web client (styles.css & ui.jsx)

export const BIZ_CONFIG = {
  mess: {
    label: 'Mess / Tiffin',
    desc: 'Monthly meals & food subscriptions',
    icon: 'restaurant-outline',
    badge: 'MESS',
    softLight: '#FFF7ED',
    accentLight: '#EA580C',
    softDark: 'rgba(234, 88, 12, 0.16)',
    accentDark: '#FB923C',
    gradient: ['#F97316', '#DC2626'],
  },
  tuition: {
    label: 'Tuition / Batch',
    desc: 'Academic batches & student fees',
    icon: 'school-outline',
    badge: 'TUITION',
    softLight: '#EFF6FF',
    accentLight: '#2563EB',
    softDark: 'rgba(37, 99, 235, 0.16)',
    accentDark: '#60A5FA',
    gradient: ['#3B82F6', '#6366F1'],
  },
  gym: {
    label: 'Gym & Fitness',
    desc: 'Membership passes & workout plans',
    icon: 'barbell-outline',
    badge: 'GYM & FITNESS',
    softLight: '#F0FDF4',
    accentLight: '#10B981',
    softDark: 'rgba(16, 185, 129, 0.16)',
    accentDark: '#34D399',
    gradient: ['#10B981', '#059669'],
  },
  hostel: {
    label: 'Hostel & PG',
    desc: 'Rooms, beds, properties & tenants',
    icon: 'business',
    badge: 'HOSTEL',
    softLight: '#F5F3FF',
    accentLight: '#7C3AED',
    softDark: 'rgba(124, 58, 237, 0.16)',
    accentDark: '#A78BFA',
    gradient: ['#8B5CF6', '#6D28D9'],
  },
};

export const getTheme = (isDark = false) => {
  return {
    isDark,
    colors: {
      // Primary brand green
      primary: '#10B981',
      primaryHover: '#059669',
      primaryDark: isDark ? '#34D399' : '#059669',
      primarySoft: isDark ? 'rgba(16, 185, 129, 0.14)' : '#ECFDF5',
      primaryBorder: isDark ? 'rgba(16, 185, 129, 0.3)' : '#A7F3D0',

      // Amber / Warning / Due soon
      warning: '#F59E0B',
      warningDark: isDark ? '#FBBF24' : '#D97706',
      warningSoft: isDark ? 'rgba(245, 158, 11, 0.14)' : '#FFFBEB',
      warningBorder: isDark ? 'rgba(245, 158, 11, 0.3)' : '#FDE68A',

      // Red / Danger / Overdue
      danger: '#EF4444',
      dangerDark: isDark ? '#F87171' : '#DC2626',
      dangerSoft: isDark ? 'rgba(239, 68, 68, 0.14)' : '#FEF2F2',
      dangerBorder: isDark ? 'rgba(239, 68, 68, 0.3)' : '#FECACA',

      // Success
      success: '#10B981',
      successDark: isDark ? '#34D399' : '#059669',
      successSoft: isDark ? 'rgba(16, 185, 129, 0.14)' : '#ECFDF5',
      successBorder: isDark ? 'rgba(16, 185, 129, 0.3)' : '#A7F3D0',

      // Blue / Info
      info: '#3B82F6',
      infoDark: isDark ? '#60A5FA' : '#2563EB',
      infoSoft: isDark ? 'rgba(59, 130, 246, 0.14)' : '#EFF6FF',
      infoBorder: isDark ? 'rgba(59, 130, 246, 0.3)' : '#BFDBFE',

      // Purple
      purple: '#8B5CF6',
      purpleDark: isDark ? '#A78BFA' : '#7C3AED',
      purpleSoft: isDark ? 'rgba(139, 92, 246, 0.14)' : '#F5F3FF',
      purpleBorder: isDark ? 'rgba(139, 92, 246, 0.3)' : '#DDD6FE',

      // WhatsApp
      whatsapp: '#25D366',
      whatsappDark: isDark ? '#4ADE80' : '#128C7E',
      whatsappSoft: isDark ? 'rgba(37, 211, 102, 0.14)' : '#DCF8C6',

      // UPI
      upi: '#5A31F4',

      // Surfaces & Backgrounds matching web styles.css
      // Web Light: --bg: #F8FAFC, --card-bg: #FFFFFF, --bg-subtle: #F1F5F9
      // Web Dark:  --bg: #0B0F19, --card-bg: #1E293B, --bg-subtle: #131B2E
      background: isDark ? '#0B0F19' : '#F1F5F9',
      card: isDark ? '#1E293B' : '#FFFFFF',
      cardSubtle: isDark ? '#131B2E' : '#F6F8FB',
      surface: isDark ? '#1E293B' : '#FFFFFF',
      surfaceHover: isDark ? '#26334D' : '#F8FAFC',

      // Borders (Strictly 1px, no heavy shadows)
      border: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
      borderSubtle: isDark ? 'rgba(255, 255, 255, 0.05)' : '#EEF2F6',
      borderSolid: isDark ? '#334155' : '#E2E8F0',

      // Typography Colors matching web styles.css
      // Web Light: --text: #0F172A, --text-2: #334155, --text-3: #64748B, --text-muted: #94A3B8
      // Web Dark:  --text: #F8FAFC, --text-2: #E2E8F0, --text-3: #94A3B8, --text-muted: #64748B
      text: isDark ? '#F8FAFC' : '#0F172A',
      textSecondary: isDark ? '#E2E8F0' : '#334155',
      textMuted: isDark ? '#94A3B8' : '#5B6B80',
      textSubtle: isDark ? '#64748B' : '#8492A6',

      // Form inputs
      inputBg: isDark ? '#131B2E' : '#FFFFFF',
      inputBorder: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',

      // Bottom Navigation Tab Bar matching web .tabs
      tabBarBg: isDark ? '#1E293B' : '#FFFFFF',
      tabBarBorder: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
      tabActive: '#10B981',
      tabInactive: isDark ? '#94A3B8' : '#64748B',

      // Business Types dictionary configured for current theme
      biz: {
        gym: {
          accent: isDark ? BIZ_CONFIG.gym.accentDark : BIZ_CONFIG.gym.accentLight,
          soft: isDark ? BIZ_CONFIG.gym.softDark : BIZ_CONFIG.gym.softLight,
          label: BIZ_CONFIG.gym.label,
          desc: BIZ_CONFIG.gym.desc,
          icon: BIZ_CONFIG.gym.icon,
          badge: BIZ_CONFIG.gym.badge,
          gradient: BIZ_CONFIG.gym.gradient,
        },
        mess: {
          accent: isDark ? BIZ_CONFIG.mess.accentDark : BIZ_CONFIG.mess.accentLight,
          soft: isDark ? BIZ_CONFIG.mess.softDark : BIZ_CONFIG.mess.softLight,
          label: BIZ_CONFIG.mess.label,
          desc: BIZ_CONFIG.mess.desc,
          icon: BIZ_CONFIG.mess.icon,
          badge: BIZ_CONFIG.mess.badge,
          gradient: BIZ_CONFIG.mess.gradient,
        },
        tuition: {
          accent: isDark ? BIZ_CONFIG.tuition.accentDark : BIZ_CONFIG.tuition.accentLight,
          soft: isDark ? BIZ_CONFIG.tuition.softDark : BIZ_CONFIG.tuition.softLight,
          label: BIZ_CONFIG.tuition.label,
          desc: BIZ_CONFIG.tuition.desc,
          icon: BIZ_CONFIG.tuition.icon,
          badge: BIZ_CONFIG.tuition.badge,
          gradient: BIZ_CONFIG.tuition.gradient,
        },
        hostel: {
          accent: isDark ? BIZ_CONFIG.hostel.accentDark : BIZ_CONFIG.hostel.accentLight,
          soft: isDark ? BIZ_CONFIG.hostel.softDark : BIZ_CONFIG.hostel.softLight,
          label: BIZ_CONFIG.hostel.label,
          desc: BIZ_CONFIG.hostel.desc,
          icon: BIZ_CONFIG.hostel.icon,
          badge: BIZ_CONFIG.hostel.badge,
          gradient: BIZ_CONFIG.hostel.gradient,
        },
      },
    },
    spacing: {
      xs: 4,
      sm: 8,
      md: 12,
      lg: 16,
      xl: 20,
      xxl: 24,
    },
    // Exact radii matching web styles.css
    radius: {
      input: 6,
      btn: 8,
      sm: 6,
      md: 8,
      card: 12,
      lg: 12,
      xl: 16,
      pill: 9999,
      full: 9999,
    },
  };
};

export const COLORS = getTheme(false).colors;

// A colour mixed into a background: the soft card tints the web makes with color-mix().
// tint('#10B981', 0.08, theme.colors.card) -> a card colour with 8% green in it.
export function tint(hex, amount, base) {
  const parse = (c) => {
    if (c.startsWith('#')) return [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
    const m = c.match(/\d+(\.\d+)?/g) || [255, 255, 255];
    return m.slice(0, 3).map(Number);
  };
  const [r1, g1, b1] = parse(hex);
  const [r2, g2, b2] = parse(base);
  const mix = (a, b) => Math.round(a * amount + b * (1 - amount));
  return `rgb(${mix(r1, r2)}, ${mix(g1, g2)}, ${mix(b1, b2)})`;
}

// the card style for a tinted card: soft background, tinted border
export const tinted = (theme, hex, strength = 1) => ({
  backgroundColor: tint(hex, (theme.isDark ? 0.1 : 0.06) * strength, theme.colors.card),
  borderColor: tint(hex, 0.28, theme.colors.card),
});
