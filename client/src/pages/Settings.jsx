import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { api, userId, download } from '../api.js';
import { useBiz } from '../App.jsx';
import {
  Avatar, Field, ShieldIcon, UserIcon, PhoneIcon,
  PlusIcon, DownloadIcon, CheckCircleIcon, SettingsIcon,
  CheckIcon, BuildingIcon, FileSpreadsheetIcon, SparklesIcon,
  ConfirmDialog, BIZ_TYPES, BellIcon, AlertCircleIcon, CopyIcon,
  XIcon, TrashIcon,
} from '../ui.jsx';

export default function Settings() {
  const biz = useBiz();
  const isOwner = biz.ownerId === userId();
  const typeConfig = BIZ_TYPES[biz.type] || BIZ_TYPES.gym;

  return (
    <>
      <div className="page-header" style={{ marginBottom: 18 }}>
        <div className="page-title-wrap">
          <h1 className="page-title">
            Business Settings
          </h1>
          <p className="page-subtitle">
            Configure UPI payment collection gateway, staff permissions, notification preferences, and workspace management.
          </p>
        </div>
      </div>

      <div className="settings-grid">
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* UPI Gateway Card */}
          {isOwner && <UpiGatewaySettings />}

          {/* Notification Preferences Card */}
          <NotificationPreferencesSettings />

          {/* Business Workspace Profile Summary */}
          <div className="analytics-card">
            <div className="card-header-row" style={{ marginBottom: 12 }}>
              <div>
                <h3 className="analytics-card-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <BuildingIcon size={17} style={{ color: 'var(--primary)' }} />
                  Workspace Profile
                </h3>
                <span className="analytics-card-subtitle">
                  Active business account and configuration details
                </span>
              </div>
            </div>

            <div className="profile-meta-grid" style={{ gridTemplateColumns: '1fr 1fr', margin: 0 }}>
              <div className="meta-item">
                <div className="meta-label">Business Name</div>
                <div className="meta-value">{biz.name}</div>
              </div>
              <div className="meta-item">
                <div className="meta-label">Business Type</div>
                <div className="meta-value">{typeConfig.label}</div>
              </div>
              <div className="meta-item">
                <div className="meta-label">Workspace ID</div>
                <div className="meta-value" style={{ fontFamily: 'monospace', fontSize: 11 }}>
                  {biz._id}
                </div>
              </div>
              <div className="meta-item">
                <div className="meta-label">Account Role</div>
                <div className="meta-value">
                  <span className="badge primary">{isOwner ? 'Owner' : 'Staff Member'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Staff Accounts Card */}
          {isOwner && <StaffAccountsSettings />}

          {/* Data Backup & Export Card */}
          <div className="analytics-card">
            <div className="card-header-row" style={{ marginBottom: 12 }}>
              <div>
                <h3 className="analytics-card-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <DownloadIcon size={17} style={{ color: 'var(--primary)' }} />
                  Data Backup & Export
                </h3>
                <span className="analytics-card-subtitle">
                  Download spreadsheets for offline backup or accounting
                </span>
              </div>
            </div>

            <div className="row" style={{ gap: 8, marginTop: 8 }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ flex: 1, minWidth: 140, justifyContent: 'center' }}
                onClick={() => download(`/businesses/${biz._id}/export/payments.csv`, `${biz.name}-payments-backup.csv`)}>
                <DownloadIcon size={14} /> Payments CSV
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{ flex: 1, minWidth: 140, justifyContent: 'center' }}
                onClick={() => download(`/businesses/${biz._id}/export/balances.csv`, `${biz.name}-balances-backup.csv`)}>
                <FileSpreadsheetIcon size={14} /> Balances CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Danger Zone Section (Owner Only) */}
      {isOwner && <DangerZoneSettings />}
    </>
  );
}

// 1. UPI Payment Gateway Settings Component
function UpiGatewaySettings() {
  const biz = useBiz();
  const qc = useQueryClient();
  const [upiInput, setUpiInput] = useState(biz.upiId || '');
  const [isEditing, setIsEditing] = useState(!biz.upiId);
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const save = useMutation({
    mutationFn: (newUpi) => api(`/businesses/${biz._id}`, { method: 'PATCH', body: { upiId: newUpi } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['businesses'] });
      setIsEditing(false);
      setConfirmOpen(false);
    },
  });

  const validateUpi = (v) => {
    const trimmed = v.trim();
    if (!trimmed) return 'UPI ID is required';
    if (!trimmed.includes('@')) return 'UPI ID must contain "@" (e.g. yourname@okaxis)';
    if (/\s/.test(trimmed)) return 'UPI ID cannot contain spaces';
    if (trimmed.length < 5) return 'UPI ID must be at least 5 characters';
    return null;
  };

  const handlePreSave = (e) => {
    e.preventDefault();
    const err = validateUpi(upiInput);
    if (err) {
      setError(err);
      return;
    }
    setError('');
    setConfirmOpen(true);
  };

  const testUpiUrl = `upi://pay?pa=${encodeURIComponent(biz.upiId || '')}&pn=${encodeURIComponent(biz.name || '')}&am=1&cu=INR`;

  return (
    <div className="analytics-card">
      <div className="card-header-row" style={{ marginBottom: 12 }}>
        <div>
          <h3 className="analytics-card-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <ShieldIcon size={17} style={{ color: 'var(--primary)' }} />
            UPI Payment Gateway Link
          </h3>
          <span className="analytics-card-subtitle">
            WhatsApp reminder messages will carry a 1-tap UPI payment link pointing to this VPA address.
          </span>
        </div>
      </div>

      {biz.upiId && !isEditing ? (
        <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: '12px 14px' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
              <span className="badge green" style={{ fontSize: 11 }}>
                <CheckIcon size={12} /> Active UPI
              </span>
              <span style={{ fontWeight: 600, fontSize: 13.5, fontFamily: 'monospace' }}>
                {biz.upiId}
              </span>
            </div>

            <div className="row" style={{ gap: 8 }}>
              <a
                href={testUpiUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary"
                style={{ minHeight: 26, padding: '2px 8px', fontSize: 11 }}>
                Send ₹1 test
              </a>
              <button
                type="button"
                className="btn-secondary"
                style={{ minHeight: 26, padding: '2px 8px', fontSize: 11 }}
                onClick={() => setIsEditing(true)}>
                Change
              </button>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handlePreSave}>
          <div className="field">
            <label className="input-label">
              <ShieldIcon size={14} /> Business UPI VPA Address
            </label>
            <div className="form-input-action-row">
              <input
                placeholder="e.g. fitness@ybl"
                value={upiInput}
                onChange={(e) => {
                  setUpiInput(e.target.value);
                  if (error) setError('');
                }}
                style={{ fontFamily: 'monospace' }}
              />
              <button disabled={save.isPending}>
                <CheckIcon size={15} /> Save UPI ID
              </button>
            </div>
            {error ? (
              <span className="small red-text" style={{ marginTop: 2 }}>{error}</span>
            ) : (
              <span className="small muted">e.g. payments@okaxis or yourgym@ybl (must contain @, no spaces, min 5 chars)</span>
            )}
          </div>
        </form>
      )}

      {/* Confirmation Dialog for UPI Save */}
      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => save.mutate(upiInput.trim())}
        title="Confirm Payment UPI Address"
        message={`Save "${upiInput.trim()}" as your official payment UPI address? Member WhatsApp payment links will route payments directly to this account.`}
        confirmText="Yes, Save UPI ID"
        busy={save.isPending}
      />
    </div>
  );
}

// 2. Staff Accounts Settings Component
function StaffAccountsSettings() {
  const biz = useBiz();
  const qc = useQueryClient();
  const [phone, setPhone] = useState('');
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState(null);

  const { data: staff } = useQuery({
    queryKey: ['staff', biz._id],
    queryFn: () => api(`/businesses/${biz._id}/staff`),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['staff', biz._id] });

  const add = useMutation({
    mutationFn: () => api(`/businesses/${biz._id}/staff`, { method: 'POST', body: { phone: phone.replace(/\D/g, '') } }),
    onSuccess: () => { setPhone(''); invalidate(); },
  });

  const remove = useMutation({
    mutationFn: (uid) => api(`/businesses/${biz._id}/staff/${uid}`, { method: 'DELETE' }),
    onSuccess: () => { setRevokeTarget(null); invalidate(); },
  });

  const handleCopyInvite = () => {
    const inviteLink = `${window.location.origin}/login?inviteBiz=${encodeURIComponent(biz.name)}`;
    navigator.clipboard.writeText(inviteLink);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
  };

  return (
    <div className="analytics-card">
      <div className="card-header-row" style={{ marginBottom: 12 }}>
        <div>
          <h3 className="analytics-card-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <UserIcon size={17} style={{ color: 'var(--primary)' }} />
            Staff Accounts & Access Controls
          </h3>
          <span className="analytics-card-subtitle">
            Authorized staff can manage members and record dues, but cannot modify UPI ID or remove other staff.
          </span>
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }} style={{ marginBottom: 12 }}>
        <div className="field">
          <label className="input-label">
            <PhoneIcon size={14} /> Staff Mobile Number
          </label>
          <div className="form-input-action-row">
            <input
              type="tel"
              inputMode="numeric"
              placeholder="10-digit registered phone"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            />
            <button disabled={add.isPending || phone.length !== 10}>
              <PlusIcon size={15} /> {add.isPending ? 'Authorizing…' : 'Authorize Staff'}
            </button>
          </div>

          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 4, flexWrap: 'wrap', gap: 6 }}>
            <span className="small muted">
              Staff must have a {biz.name} account. Share the invite link to get them started.
            </span>
            <button
              type="button"
              className="btn-secondary"
              style={{ minHeight: 24, padding: '2px 8px', fontSize: 11 }}
              onClick={handleCopyInvite}>
              <CopyIcon size={12} /> {copiedInvite ? '✓ Copied invite link' : 'Copy invite link'}
            </button>
          </div>
        </div>
      </form>
      {add.error && <p className="small red-text" role="alert" style={{ marginBottom: 8 }}>{add.error.message}</p>}

      {(staff || []).map((s) => (
        <div className="card row" key={s._id} style={{ alignItems: 'center', margin: '6px 0', padding: '10px 12px', border: '1px solid var(--border)' }}>
          <Avatar name={s.name} />
          <div className="grow" style={{ minWidth: 0, marginLeft: 8 }}>
            <b style={{ fontSize: 13.5 }}>{s.name}</b>
            <div className="muted small">📞 +91 {s.phone}</div>
          </div>
          <button
            type="button"
            className="btn-secondary red-text"
            style={{ minHeight: 26, padding: '2px 8px', fontSize: 11 }}
            onClick={() => setRevokeTarget(s)}>
            Revoke Access
          </button>
        </div>
      ))}

      {staff && staff.length === 0 && (
        <p className="muted small" style={{ margin: '4px 2px' }}>No additional staff accounts authorized yet.</p>
      )}

      <ConfirmDialog
        isOpen={!!revokeTarget}
        onClose={() => setRevokeTarget(null)}
        onConfirm={() => revokeTarget && remove.mutate(revokeTarget._id)}
        title={`Revoke staff access for ${revokeTarget?.name}?`}
        message="This staff member will no longer be able to log in to view members or record payments for this business."
        confirmText="Revoke Access"
        danger
        busy={remove.isPending}
      />
    </div>
  );
}

// 3. Notification Preferences Settings Component
function NotificationPreferencesSettings() {
  const biz = useBiz();
  const qc = useQueryClient();

  const [prefs, setPrefs] = useState({
    renewalReminders: biz.notifications?.renewalReminders ?? true,
    dailySummary: biz.notifications?.dailySummary ?? false,
    welcomeMessage: biz.notifications?.welcomeMessage ?? true,
    overdueAlerts: biz.notifications?.overdueAlerts ?? true,
  });

  const save = useMutation({
    mutationFn: (newPrefs) => api(`/businesses/${biz._id}`, { method: 'PATCH', body: { notifications: newPrefs } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['businesses'] }),
  });

  const handleToggle = (key) => {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    save.mutate(updated);
  };

  return (
    <div className="analytics-card">
      <div className="card-header-row" style={{ marginBottom: 12 }}>
        <div>
          <h3 className="analytics-card-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <BellIcon size={17} style={{ color: 'var(--primary)' }} />
            Notification Preferences
          </h3>
          <span className="analytics-card-subtitle">
            Configure automated WhatsApp notifications and staff payment alerts
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Toggle 1: Renewal reminders */}
        <div className="switch-wrap">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>Renewal reminders (3 days before)</div>
            <div className="small muted" style={{ marginTop: 1 }}>Send automated expiry reminders to upcoming members</div>
          </div>
          <button
            type="button"
            className={`switch-toggle ${prefs.renewalReminders ? 'active' : ''}`}
            aria-checked={prefs.renewalReminders}
            onClick={() => handleToggle('renewalReminders')}>
            <span className="switch-thumb" />
          </button>
        </div>

        {/* Toggle 2: Daily revenue summary */}
        <div className="switch-wrap">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>Daily revenue summary (9 AM WhatsApp)</div>
            <div className="small muted" style={{ marginTop: 1 }}>Receive daily collection report on owner's phone</div>
          </div>
          <button
            type="button"
            className={`switch-toggle ${prefs.dailySummary ? 'active' : ''}`}
            aria-checked={prefs.dailySummary}
            onClick={() => handleToggle('dailySummary')}>
            <span className="switch-thumb" />
          </button>
        </div>

        {/* Toggle 3: New member welcome message */}
        <div className="switch-wrap">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>New member welcome message</div>
            <div className="small muted" style={{ marginTop: 1 }}>Send receipt and welcome pack when a member joins</div>
          </div>
          <button
            type="button"
            className={`switch-toggle ${prefs.welcomeMessage ? 'active' : ''}`}
            aria-checked={prefs.welcomeMessage}
            onClick={() => handleToggle('welcomeMessage')}>
            <span className="switch-thumb" />
          </button>
        </div>

        {/* Toggle 4: Overdue payment alerts */}
        <div className="switch-wrap">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>Overdue payment alerts</div>
            <div className="small muted" style={{ marginTop: 1 }}>Alert staff when a subscription has elapsed overdue</div>
          </div>
          <button
            type="button"
            className={`switch-toggle ${prefs.overdueAlerts ? 'active' : ''}`}
            aria-checked={prefs.overdueAlerts}
            onClick={() => handleToggle('overdueAlerts')}>
            <span className="switch-thumb" />
          </button>
        </div>
      </div>
    </div>
  );
}

// 4. Danger Zone Settings Component
function DangerZoneSettings() {
  const biz = useBiz();
  const qc = useQueryClient();
  const [modalType, setModalType] = useState(null); // 'clear' | 'delete'
  const [confirmInput, setConfirmInput] = useState('');

  const clearData = useMutation({
    mutationFn: () => api(`/businesses/${biz._id}/clear-data`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries();
      setModalType(null);
      setConfirmInput('');
      window.location.href = '/';
    },
  });

  const deleteBiz = useMutation({
    mutationFn: () => api(`/businesses/${biz._id}`, { method: 'DELETE' }),
    onSuccess: () => {
      localStorage.removeItem('bizId');
      window.location.href = '/';
    },
  });

  return (
    <div className="danger-zone-card">
      <div className="card-header-row" style={{ marginBottom: 10 }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 7 }}>
            <AlertCircleIcon size={17} /> Danger Zone
          </h3>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
            Irreversible actions for {biz.name}. Please exercise extreme caution.
          </span>
        </div>
      </div>

      <div className="danger-action-row">
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>Clear all member data</div>
          <div className="small muted">Permanently purge all members, payment transactions, dues, and subscription logs.</div>
        </div>
        <button
          type="button"
          className="btn-danger"
          style={{ minHeight: 30, padding: '4px 12px', fontSize: 12 }}
          onClick={() => { setModalType('clear'); setConfirmInput(''); }}>
          Clear All Data
        </button>
      </div>

      <div className="danger-action-row">
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>Delete workspace</div>
          <div className="small muted">Permanently delete this entire business workspace and all related configurations.</div>
        </div>
        <button
          type="button"
          className="btn-danger"
          style={{ minHeight: 30, padding: '4px 12px', fontSize: 12 }}
          onClick={() => { setModalType('delete'); setConfirmInput(''); }}>
          Delete Workspace
        </button>
      </div>

      {/* Confirmation Modal for Clear or Delete */}
      <AnimatePresence>
        {modalType && (
          <div className="modal-overlay" onClick={() => setModalType(null)} style={{ zIndex: 120 }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="modal-content"
              style={{ maxWidth: 440, border: '1px solid var(--red-border)' }}
              onClick={(e) => e.stopPropagation()}>
              <div className="form-header" style={{ marginBottom: 14 }}>
                <h3 className="form-title" style={{ color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertCircleIcon size={18} />
                  <span>
                    {modalType === 'clear' ? 'Clear All Member Data?' : `Delete "${biz.name}" Workspace?`}
                  </span>
                </h3>
                <button type="button" className="icon-btn" onClick={() => setModalType(null)}>
                  <XIcon size={14} />
                </button>
              </div>

              <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.45, marginBottom: 14 }}>
                {modalType === 'clear' ? (
                  <>
                    This will <b>permanently erase</b> all members, payments, and billing records for <b>{biz.name}</b>. This action cannot be undone.
                  </>
                ) : (
                  <>
                    This will <b>permanently destroy</b> the entire <b>{biz.name}</b> workspace, plans, and all member data.
                  </>
                )}
              </p>

              <div style={{ marginBottom: 16 }}>
                <label className="input-label" style={{ fontWeight: 600 }}>
                  Type <span style={{ color: 'var(--red)', fontFamily: 'monospace', fontWeight: 700 }}>DELETE</span> to confirm:
                </label>
                <input
                  placeholder="DELETE"
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  style={{ borderColor: confirmInput === 'DELETE' ? 'var(--red)' : 'var(--border)' }}
                />
              </div>

              <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn-secondary" onClick={() => setModalType(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={confirmInput !== 'DELETE' || clearData.isPending || deleteBiz.isPending}
                  className="btn-danger"
                  style={{ minHeight: 34, padding: '6px 14px', fontSize: 12.5 }}
                  onClick={() => {
                    if (modalType === 'clear') clearData.mutate();
                    else deleteBiz.mutate();
                  }}>
                  <TrashIcon size={14} />
                  {clearData.isPending || deleteBiz.isPending ? 'Processing…' : modalType === 'clear' ? 'Erase All Data' : 'Delete Workspace'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
