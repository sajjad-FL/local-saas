import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { api, rupees } from '../api.js';
import { useBiz } from '../App.jsx';
import {
  Field, PlusIcon, XIcon, BedIcon,
  CreditCardIcon, BuildingIcon, CheckIcon, CalendarIcon,
  SparklesIcon, TagIcon,
} from '../ui.jsx';

const GROUP_LABEL = {
  mess: 'Meal Shifts & Mess Groups',
  tuition: 'Batches & Class Slots',
  gym: 'Workout Batches & Time Slots',
  hostel: 'Properties & Buildings',
};

const GROUP_HINT = {
  mess: 'Group members into breakfast, lunch, or dinner meal shifts.',
  tuition: 'Categorize students into morning or evening batches.',
  gym: 'Organize gym members into morning, afternoon, or evening workout slots.',
  hostel: 'Hostel buildings and properties — rooms are organized within each building.',
};

export default function Setup() {
  const biz = useBiz();

  return (
    <>
      <div className="page-header" style={{ marginBottom: 18 }}>
        <div className="page-title-wrap">
          <h1 className="page-title">
            Plans & Batch Setup
          </h1>
          <p className="page-subtitle">
            Configure recurring membership tiers, workout batches, time slots, and room bed capacities.
          </p>
        </div>
      </div>
      
      {/* Membership Plans Section */}
      <Section
        title="Membership Plans"
        icon={CreditCardIcon}
        hint="Create membership packages with recurring billing durations."
        path={`/businesses/${biz._id}/plans`}
        addLabel="Add Plan"
        emptyTitle="No membership plans created yet"
        emptyHint="Define your gym packages (e.g. Monthly ₹1,500 or Quarterly ₹4,000) to assign to members."
        renderItem={(p) => (
          <div className="card row" key={p._id} style={{ alignItems: 'center', marginBottom: 8, padding: '12px 14px' }}>
            <span className="tx-icon in" style={{ width: 34, height: 34 }}>
              <CreditCardIcon size={16} />
            </span>
            <div className="grow">
              <b style={{ fontSize: 14.5 }}>{p.name}</b>
              <div className="muted small">{p.cycleDays} days recurring cycle</div>
            </div>
            <span className="badge primary" style={{ fontSize: 12, padding: '4px 10px' }}>
              {rupees(p.amount)}
            </span>
          </div>
        )}
        Form={PlanForm}
      />

      {/* Batches / Groups Section */}
      <Section
        title={GROUP_LABEL[biz.type] || 'Workout Batches & Slots'}
        icon={BuildingIcon}
        hint={GROUP_HINT[biz.type] || 'Organize and categorize members into batches or shifts.'}
        path={`/businesses/${biz._id}/groups`}
        addLabel="Add Batch / Slot"
        emptyTitle="No batches or workout slots added"
        emptyHint="Create slots like 'Morning Batch 6AM-8AM' or 'Evening Batch 6PM-8PM' to categorize members."
        renderItem={(g) => (
          <div className="card row" key={g._id} style={{ alignItems: 'center', marginBottom: 8, padding: '12px 14px' }}>
            <span className="tx-icon due" style={{ width: 34, height: 34 }}>
              <TagIcon size={16} />
            </span>
            <div className="grow">
              <b style={{ fontSize: 14.5 }}>{g.name}</b>
              <div className="muted small">Active Slot</div>
            </div>
            <span className="badge gray">Slot Active</span>
          </div>
        )}
        Form={GroupForm}
      />

      {/* Hostel Rooms & Bed Capacities (If Hostel) */}
      {biz.type === 'hostel' && (
        <Section
          title="Rooms & Bed Capacities"
          icon={BedIcon}
          hint="Track maximum bed limits per room — assignments stop when a room is fully occupied."
          path={`/businesses/${biz._id}/rooms`}
          addLabel="Add Room"
          emptyTitle="No rooms added yet"
          emptyHint="Create room numbers and bed capacity limits for tenant check-ins."
          renderItem={(r) => {
            const free = Math.max(0, r.capacity - r.occupied);
            return (
              <div className="card" key={r._id} style={{ marginBottom: 8, padding: '12px 14px' }}>
                <div className="row" style={{ marginBottom: 6 }}>
                  <div className="grow">
                    <b style={{ fontSize: 14.5 }}>Room {r.roomNo}</b>
                    {r.groupId && <span className="muted small"> · {r.groupId.name}</span>}
                  </div>
                  <span className={`badge ${r.occupied >= r.capacity ? 'red' : 'green'}`}>
                    {r.occupied >= r.capacity ? 'Full' : `${free} bed${free > 1 ? 's' : ''} free`}
                  </span>
                </div>
                <div className="bed-grid">
                  {Array.from({ length: r.occupied }).map((_, idx) => (
                    <span key={`occ-${idx}`} className="bed-chip occupied">
                      <BedIcon size={11} /> Bed {idx + 1} (Occupied)
                    </span>
                  ))}
                  {Array.from({ length: free }).map((_, idx) => (
                    <span key={`free-${idx}`} className="bed-chip available">
                      <BedIcon size={11} /> Bed {r.occupied + idx + 1} (Free)
                    </span>
                  ))}
                </div>
              </div>
            );
          }}
          Form={RoomForm}
        />
      )}
    </>
  );
}

function Section({ title, icon: SectionIcon, hint, path, addLabel, emptyTitle, emptyHint, renderItem, Form }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: items } = useQuery({ queryKey: [path], queryFn: () => api(path) });
  const add = useMutation({
    mutationFn: (body) => api(path, { method: 'POST', body }),
    onSuccess: () => {
      qc.invalidateQueries();
      setOpen(false);
    },
  });

  return (
    <div className="analytics-card" style={{ marginBottom: 18 }}>
      <div className="card-header-row">
        <div>
          <h3 className="analytics-card-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            {SectionIcon && <SectionIcon size={17} style={{ color: 'var(--primary)' }} />}
            {title}
          </h3>
          {hint && <span className="analytics-card-subtitle">{hint}</span>}
        </div>
        <div className="row" style={{ gap: 6 }}>
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={() => setOpen(!open)}
            className={`btn-secondary${open ? ' active' : ''}`}
            style={{ minHeight: 30, padding: '4px 10px', fontSize: 12 }}>
            {open ? <XIcon size={13} /> : <PlusIcon size={13} />}
            {open ? 'Cancel' : addLabel || 'Add New'}
          </motion.button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
            style={{ overflow: 'hidden', marginBottom: 14 }}>
            <Form onSubmit={(body) => add.mutate(body)} busy={add.isPending} />
          </motion.div>
        )}
      </AnimatePresence>

      {add.error && <p className="error" role="alert">{add.error.message}</p>}

      {(items || []).map(renderItem)}

      {items && items.length === 0 && !open && (
        <div className="empty" style={{ padding: '24px 12px' }}>
          <b>{emptyTitle}</b>
          <span>{emptyHint}</span>
          <button
            type="button"
            onClick={() => setOpen(true)}
            style={{ marginTop: 10, minHeight: 30, padding: '4px 10px', fontSize: 12 }}>
            <PlusIcon size={13} /> {addLabel || 'Add First'}
          </button>
        </div>
      )}
    </div>
  );
}

function PlanForm({ onSubmit, busy }) {
  const [form, setForm] = useState({ name: '', amount: '', cycleDays: 30 });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <form className="card form-panel" style={{ padding: '16px 14px', margin: 0 }} onSubmit={(e) => {
      e.preventDefault();
      onSubmit({ ...form, amount: Number(form.amount), cycleDays: Number(form.cycleDays) });
      setForm({ name: '', amount: '', cycleDays: 30 });
    }}>
      <div className="form-header" style={{ marginBottom: 12 }}>
        <div className="form-title">
          <CreditCardIcon size={16} style={{ color: 'var(--primary)' }} />
          <span>New Membership Plan</span>
        </div>
      </div>
      <div className="form-grid two-col">
        <Field label="Plan Name *" icon={CreditCardIcon}>
          <input placeholder="e.g. Monthly Standard" required value={form.name} onChange={set('name')} />
        </Field>
        <Field label="Amount (₹) *" icon={CreditCardIcon}>
          <input type="number" inputMode="decimal" min="1" placeholder="1500" required value={form.amount} onChange={set('amount')} />
        </Field>
        <Field label="Billing Cycle Length" icon={CalendarIcon}>
          <select value={form.cycleDays} onChange={set('cycleDays')}>
            <option value={7}>7 days (Weekly)</option>
            <option value={15}>15 days (Fortnightly)</option>
            <option value={30}>30 days (Monthly / 1 Month)</option>
            <option value={60}>60 days (2 Months / Bi-Monthly)</option>
            <option value={90}>90 days (Quarterly / 3 Months)</option>
            <option value={180}>180 days (Half-Yearly / 6 Months)</option>
            <option value={365}>365 days (Yearly / 12 Months)</option>
          </select>
        </Field>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
        <button disabled={busy}>
          <CheckIcon size={15} />
          {busy ? 'Saving Plan…' : 'Save Plan'}
        </button>
      </div>
    </form>
  );
}

function GroupForm({ onSubmit, busy }) {
  const [name, setName] = useState('');
  return (
    <form className="card form-panel" style={{ padding: '16px 14px', margin: 0 }} onSubmit={(e) => { e.preventDefault(); onSubmit({ name }); setName(''); }}>
      <div className="form-header" style={{ marginBottom: 12 }}>
        <div className="form-title">
          <BuildingIcon size={16} style={{ color: 'var(--primary)' }} />
          <span>New Workout Batch / Slot</span>
        </div>
      </div>
      <div className="form-grid">
        <Field label="Batch Name *">
          <input placeholder="e.g. Morning Batch 6AM-8AM" required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
        <button disabled={busy}>
          <CheckIcon size={15} />
          {busy ? 'Saving…' : 'Save Batch'}
        </button>
      </div>
    </form>
  );
}

function RoomForm({ onSubmit, busy }) {
  const biz = useBiz();
  const { data: groups } = useQuery({ queryKey: [`/businesses/${biz._id}/groups`], queryFn: () => api(`/businesses/${biz._id}/groups`) });
  const [form, setForm] = useState({ groupId: '', roomNo: '', capacity: 3 });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <form className="card form-panel" style={{ padding: '16px 14px', margin: 0 }} onSubmit={(e) => {
      e.preventDefault();
      onSubmit({ ...form, capacity: Number(form.capacity) });
      setForm({ ...form, roomNo: '' });
    }}>
      <div className="form-header" style={{ marginBottom: 12 }}>
        <div className="form-title">
          <BedIcon size={16} style={{ color: 'var(--primary)' }} />
          <span>New Room & Bed Capacity</span>
        </div>
      </div>
      <div className="form-grid two-col">
        {(groups || []).length > 0 && (
          <Field label="Property / Building">
            <select value={form.groupId} onChange={set('groupId')}>
              <option value="">No property</option>
              {groups.map((g) => <option key={g._id} value={g._id}>{g.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="Room Number *">
          <input placeholder="e.g. 101" required value={form.roomNo} onChange={set('roomNo')} />
        </Field>
        <Field label="Total Bed Capacity *">
          <select value={form.capacity} onChange={set('capacity')}>
            {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
              <option key={n} value={n}>{n} bed{n > 1 ? 's' : ''}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
        <button disabled={busy}>
          <CheckIcon size={15} />
          {busy ? 'Saving Room…' : 'Save Room'}
        </button>
      </div>
    </form>
  );
}
