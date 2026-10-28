import { useState, Fragment } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { api, rupees } from '../api.js';
import { useBiz } from '../App.jsx';
import { words } from '../wording.js';
import HostelProperty from './HostelProperty.jsx';
import {
  Field, PlusIcon, XIcon,
  CreditCardIcon, BuildingIcon, CheckIcon, CalendarIcon,
  SparklesIcon, TagIcon,
} from '../ui.jsx';

export default function Setup() {
  const biz = useBiz();
  const w = words(biz.type);

  // smallest first, and room 2 before room 10
  const natural = (x, y) => String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: 'base' });

  const plansStep = (step) => (
      <Section
          step={step}
          sort={(x, y) => x.amount - y.amount || natural(x.name, y.name)}
          title={w.plans}
          icon={CreditCardIcon}
          hint={w.plansHint}
          path={`/businesses/${biz._id}/plans`}
          addLabel={`Add ${w.plan.toLowerCase()}`}
          emptyTitle={`No ${w.plans.toLowerCase()} yet`}
          emptyHint={`Add what you charge, for example ${w.planExample}. You pick a plan when you add each ${w.member}.`}
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
  );

  const groupsStep = (step) => (
      <Section
          step={step}
          optional
          sort={(x, y) => natural(x.name, y.name)}
          title={w.groups}
          icon={BuildingIcon}
          hint={w.groupsHint}
          path={`/businesses/${biz._id}/groups`}
          addLabel={`Add ${w.group.toLowerCase()}`}
          emptyTitle={`No ${w.groups.toLowerCase()} yet`}
          emptyHint={`Optional. ${w.groupsHint}`}
          renderItem={(g) => (
            <div className="card row" key={g._id} style={{ alignItems: 'center', marginBottom: 8, padding: '12px 14px' }}>
              <span className="tx-icon due" style={{ width: 34, height: 34 }}>
                <TagIcon size={16} />
              </span>
              <div className="grow">
                <b style={{ fontSize: 14.5 }}>{g.name}</b>
              </div>
              <span className="badge gray">Active</span>
            </div>
          )}
          Form={GroupForm}
        />
  );

  // the order an owner sets things up: a hostel's rooms sit in buildings and plans price the beds;
  // everyone else starts with what they charge
  const propertyStep = (step) => <HostelProperty biz={biz} step={step} />;
  const steps = biz.type === 'hostel' ? [propertyStep, plansStep] : [plansStep, groupsStep];

  return (
    <>
      <div className="page-header" style={{ marginBottom: 18 }}>
        <div className="page-title-wrap">
          <h1 className="page-title">Setup</h1>
          <p className="page-subtitle">{w.setupHint}</p>
        </div>
      </div>

      {steps.map((makeStep, i) => <Fragment key={i}>{makeStep(i + 1)}</Fragment>)}
    </>
  );
}

function Section({ step, optional, sort, title, icon: SectionIcon, hint, path, addLabel, emptyTitle, emptyHint, renderItem, Form }) {
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
          <h3 className="analytics-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {step ? (
              <span className={`setup-step ${items?.length ? 'done' : ''}`} aria-label={items?.length ? `Step ${step}, done` : `Step ${step}`}>
                {items?.length ? <CheckIcon size={13} /> : step}
              </span>
            ) : SectionIcon && <SectionIcon size={17} style={{ color: 'var(--primary)' }} />}
            {title}
            {optional && <span className="muted small" style={{ fontWeight: 400 }}>(optional)</span>}
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

      {(sort ? [...(items || [])].sort(sort) : items || []).map(renderItem)}

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
  const w = words(useBiz().type);
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
          <span>New {w.plan.toLowerCase()}</span>
        </div>
      </div>
      <div className="form-grid two-col">
        <Field label="Plan Name *" icon={CreditCardIcon}>
          <input placeholder={w.planPlaceholder} required value={form.name} onChange={set('name')} />
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
  const w = words(useBiz().type);
  const [name, setName] = useState('');
  return (
    <form className="card form-panel" style={{ padding: '16px 14px', margin: 0 }} onSubmit={(e) => { e.preventDefault(); onSubmit({ name }); setName(''); }}>
      <div className="form-header" style={{ marginBottom: 12 }}>
        <div className="form-title">
          <BuildingIcon size={16} style={{ color: 'var(--primary)' }} />
          <span>New {w.group.toLowerCase()}</span>
        </div>
      </div>
      <div className="form-grid">
        <Field label={`${w.group} name *`}>
          <input placeholder={w.groupPlaceholder} required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
        <button disabled={busy}>
          <CheckIcon size={15} />
          {busy ? 'Saving…' : `Save ${w.group.toLowerCase()}`}
        </button>
      </div>
    </form>
  );
}
