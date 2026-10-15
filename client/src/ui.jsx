// Shared UI components, modern icons, and motion helpers.
import { useEffect, useRef } from 'react';
import { motion, animate, AnimatePresence } from 'framer-motion';

const icon = (children, filled) => function Icon({ size = 20, ...props }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size}
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" {...props}>{children}</svg>
  );
};

export const HomeIcon = icon(<><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>);
export const UsersIcon = icon(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>);
export const UserIcon = icon(<><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>);
export const PhoneIcon = icon(<><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></>);
export const SettingsIcon = icon(<><line x1="4" x2="4" y1="21" y2="14" /><line x1="4" x2="4" y1="10" y2="3" /><line x1="12" x2="12" y1="21" y2="12" /><line x1="12" x2="12" y1="8" y2="3" /><line x1="20" x2="20" y1="21" y2="16" /><line x1="20" x2="20" y1="12" y2="3" /><line x1="2" x2="6" y1="14" y2="14" /><line x1="10" x2="14" y1="8" y2="8" /><line x1="18" x2="22" y1="16" y2="16" /></>);
export const LogOutIcon = icon(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></>);
export const RupeeIcon = icon(<><path d="M6 3h12" /><path d="M6 8h12" /><path d="m6 13 8.5 8" /><path d="M6 13h3" /><path d="M9 13c6.667 0 6.667-10 0-10" /></>);
export const AlertIcon = icon(<><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></>);
export const CheckCircleIcon = icon(<><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>);
export const CheckIcon = icon(<polyline points="20 6 9 17 4 12" />);
export const BedIcon = icon(<><path d="M2 4v16" /><path d="M2 8h18a2 2 0 0 1 2 2v10" /><path d="M2 17h20" /><path d="M6 8v9" /></>);
export const DownloadIcon = icon(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></>);
export const PlusIcon = icon(<><path d="M5 12h14" /><path d="M12 5v14" /></>);
export const XIcon = icon(<><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>);
export const PauseIcon = icon(<><rect width="4" height="16" x="6" y="4" /><rect width="4" height="16" x="14" y="4" /></>);
export const PlayIcon = icon(<polygon points="6 3 20 12 6 21 6 3" />);
export const SearchIcon = icon(<><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>);
export const ChevronIcon = icon(<path d="m9 18 6-6-6-6" />);
export const ChevronDownIcon = icon(<path d="m6 9 6 6 6-6" />);
export const CalendarIcon = icon(<><path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" /></>);
export const SparklesIcon = icon(<><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /></>);
export const CreditCardIcon = icon(<><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" /></>);
export const TagIcon = icon(<><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" /><line x1="7" x2="7.01" y1="7" y2="7" /></>);
export const ShieldIcon = icon(<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />);
export const ClockIcon = icon(<><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>);
export const ArrowRightIcon = icon(<><line x1="5" x2="19" y1="12" y2="12" /><polyline points="12 5 19 12 12 19" /></>);
export const SunIcon = icon(<><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></>);
export const MoonIcon = icon(<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>);

export const TrendingUpIcon = icon(<><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></>);
export const TrendingDownIcon = icon(<><polyline points="22 17 13.5 8.5 8.5 13.5 2 7" /><polyline points="16 17 22 17 22 11" /></>);
export const BarChartIcon = icon(<><line x1="12" x2="12" y1="20" y2="10" /><line x1="18" x2="18" y1="20" y2="4" /><line x1="6" x2="6" y1="20" y2="16" /></>);
export const ActivityIcon = icon(<polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />);
export const PieChartIcon = icon(<><path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" /></>);
export const SendIcon = icon(<><line x1="22" x2="11" y1="2" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></>);
export const CalendarCheckIcon = icon(<><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" /><path d="m9 16 2 2 4-4" /><path d="M8 2v4" /><path d="M16 2v4" /></>);
export const FileSpreadsheetIcon = icon(<><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M8 13h2" /><path d="M14 13h2" /><path d="M8 17h2" /><path d="M14 17h2" /></>);

export const WhatsAppIcon = icon(
  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />,
  true,
);

export const UtensilsIcon = icon(<><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" /><path d="M7 2v20" /><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Z" /><path d="M21 15v7" /></>);
export const BookIcon = icon(<><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></>);
export const DumbbellIcon = icon(<><path d="m6.5 6.5 11 11" /><path d="m21 21-1-1" /><path d="m3 3 1 1" /><path d="m18 22 4-4" /><path d="m2 6 4-4" /><path d="m3 10 7-7" /><path d="m14 21 7-7" /></>);
export const BuildingIcon = icon(<><rect width="16" height="20" x="4" y="2" rx="2" /><path d="M9 22v-4h6v4" /><path d="M8 6h.01" /><path d="M16 6h.01" /><path d="M12 6h.01" /><path d="M12 10h.01" /><path d="M12 14h.01" /><path d="M16 10h.01" /><path d="M16 14h.01" /><path d="M8 10h.01" /><path d="M8 14h.01" /></>);

export const LayoutDashboardIcon = icon(<><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></>);
export const SlidersHorizontalIcon = icon(<><line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/></>);
export const FilterIcon = icon(<><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></>);
export const CalendarClockIcon = icon(<><path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h5"/><circle cx="16" cy="16" r="6"/><polyline points="16 14 16 16 18 17"/></>);
export const AlertCircleIcon = icon(<><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></>);
export const UserPlusIcon = icon(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" x2="19" y1="8" y2="14" /><line x1="22" x2="16" y1="11" y2="11" /></>);
export const BellIcon = icon(<><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>);
export const CopyIcon = icon(<><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></>);
export const LinkIcon = icon(<><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>);
export const PrinterIcon = icon(<><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></>);
export const EditIcon = icon(<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></>);
export const TrashIcon = icon(<><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>);

export const BIZ_TYPES = {
  mess:    { label: 'Mess / Tiffin', desc: 'Monthly meals & food subscriptions', icon: UtensilsIcon, badge: 'MESS', soft: '#FFF7ED', accent: '#EA580C', gradient: ['#F97316', '#DC2626'] },
  tuition: { label: 'Tuition / Batch', desc: 'Academic batches & student fees', icon: BookIcon, badge: 'TUITION', soft: '#EFF6FF', accent: '#2563EB', gradient: ['#3B82F6', '#6366F1'] },
  gym:     { label: 'Gym & Fitness', desc: 'Membership passes & workout plans', icon: DumbbellIcon, badge: 'GYM & FITNESS', soft: '#F0FDF4', accent: '#10B981', gradient: ['#10B981', '#059669'] },
  hostel:  { label: 'Hostel & PG', desc: 'Rooms, beds, properties & tenants', icon: BuildingIcon, badge: 'HOSTEL', soft: '#F5F3FF', accent: '#7C3AED', gradient: ['#8B5CF6', '#6D28D9'] },
};

// Staggered entrance animation for list items
export function Rise({ i = 0, children, ...rest }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.3), ease: [0.25, 1, 0.5, 1] }}
      {...rest}>
      {children}
    </motion.div>
  );
}

// Scale in animation
export function ScaleIn({ delay = 0, children, ...rest }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ duration: 0.25, delay, ease: [0.25, 1, 0.5, 1] }}
      {...rest}>
      {children}
    </motion.div>
  );
}

// CountUp number animation (0 -> target, 800ms)
export function CountUp({ value = 0, duration = 0.8, prefix = '', suffix = '' }) {
  const nodeRef = useRef();
  const num = typeof value === 'number' ? value : parseInt(String(value).replace(/[^0-9.-]+/g, '')) || 0;

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    const controls = animate(0, num, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate(v) {
        node.textContent = `${prefix}${Math.round(v).toLocaleString('en-IN')}${suffix}`;
      },
    });
    return () => controls.stop();
  }, [num, duration, prefix, suffix]);

  return <span ref={nodeRef}>{prefix}{num.toLocaleString('en-IN')}{suffix}</span>;
}

export function Avatar({ name, lg }) {
  const initials = (name || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  let h = 0;
  for (const c of name || '') h = (h * 31 + c.charCodeAt(0)) % 360;
  return (
    <span className={`avatar${lg ? ' lg' : ''}`} aria-hidden="true"
      style={{
        background: `linear-gradient(135deg, hsl(${h} 75% 94%) 0%, hsl(${h} 65% 86%) 100%)`,
        color: `hsl(${h} 65% 26%)`,
        border: `1px solid hsl(${h} 60% 80%)`,
      }}>
      {initials}
    </span>
  );
}

export function Field({ label, icon: FieldIcon, children, hint }) {
  return (
    <div className="field">
      {label && (
        <label className="input-label">
          {FieldIcon && <FieldIcon size={14} style={{ color: 'var(--text-3)', flex: 'none' }} />}
          <span>{label}</span>
        </label>
      )}
      {children}
      {hint && <span className="small muted" style={{ marginTop: 2, display: 'block' }}>{hint}</span>}
    </div>
  );
}

export function Empty({ icon: Ic, title, hint, action }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="card empty">
      <div className="empty-icon-wrap">
        {Ic ? <Ic size={32} /> : <UsersIcon size={32} />}
      </div>
      <b>{title}</b>
      {hint && <span>{hint}</span>}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </motion.div>
  );
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = false,
  icon: DialogIcon,
  busy = false,
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="modal-overlay" onClick={onClose}>
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ duration: 0.18, ease: [0.25, 1, 0.5, 1] }}
            className="modal-content"
            style={{ maxWidth: 440, padding: 24, borderRadius: 'var(--radius-xl)' }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: danger ? 'var(--red-soft)' : 'var(--primary-soft)',
                  color: danger ? 'var(--red)' : 'var(--primary)',
                  display: 'grid',
                  placeItems: 'center',
                  flex: 'none',
                }}>
                {DialogIcon ? <DialogIcon size={20} /> : danger ? <AlertIcon size={20} /> : <CheckCircleIcon size={20} />}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                  {title}
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.45, margin: 0 }}>
                  {message}
                </p>
              </div>
            </div>

            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 20, gap: 8 }}>
              <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={onClose}>
                {cancelText}
              </button>
              <button
                type="button"
                className={danger ? 'btn-secondary red-text' : ''}
                style={danger ? { borderColor: 'var(--red-border)', background: 'var(--red-soft)' } : {}}
                disabled={busy}
                onClick={onConfirm}>
                {busy ? 'Please wait…' : confirmText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
