import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../contexts.js';
import {
  SunIcon, MoonIcon, CheckIcon, ArrowRightIcon, CreditCardIcon, UsersIcon, BellIcon, BarChartIcon,
  BuildingIcon, CalendarCheckIcon, SlidersHorizontalIcon, ChevronDownIcon, WhatsAppIcon, RupeeIcon,
} from '../ui.jsx';
import { Logo, HeroArt, TYPES, TYPE_ART } from '../brand.jsx';

// Plans and FAQ answers live here so they're easy to change
const PLANS = [
  { name: 'Starter', for: 'For small businesses', monthly: 999, points: ['Up to 50 members', 'Payments and dues', 'WhatsApp reminders', 'Email support'] },
  { name: 'Growth', for: 'For growing businesses', monthly: 1999, popular: true, points: ['Up to 200 members', 'Everything in Starter', 'Reports and exports', 'Priority support'] },
  { name: 'Business', for: 'For more than one property', monthly: 3999, points: ['Up to 500 members', 'Several businesses', 'Attendance and staff logins', 'Priority support'] },
  { name: 'Enterprise', for: 'For large operators', custom: true, points: ['Unlimited members', 'Custom features', 'Dedicated support', 'Help moving your data'] },
];
const YEARLY_OFF = 0.2;

const FAQ = [
  ['What types of businesses can use LocalSaaS?', 'PGs and hostels, tuition and coaching centres, gyms, and mess or tiffin services. Each one gets its own words and screens: rooms and beds for a hostel, batches for tuition, plans and check-ins for a gym.'],
  ['Can I try LocalSaaS for free?', 'Yes. Create an account and set up your business; you can add members, record payments and send reminders straight away.'],
  ['Is my data safe?', 'Each business only sees its own data, every sign-in is checked, and you can download a full backup of everything at any time from Settings.'],
  ['Can I manage more than one property?', 'Yes. One account can run several businesses and switch between them from the menu. Hostels can also have several buildings, each with its floors and rooms.'],
  ['Does it support online payments?', 'Reminders carry your UPI payment link, so members can pay straight from WhatsApp. You record cash, UPI and card payments in one tap, and every member gets a statement link.'],
  ['Can my staff use it too?', 'Yes. Add staff by their mobile number; they can record payments and mark attendance, while settings, deletions and backups stay with you.'],
];

const FEATURES = [
  { key: 'pay', icon: CreditCardIcon, title: 'Payments & billing', lead: 'Collect fees, track dues and send receipts — rent, fees and plans bill themselves every cycle.',
    points: ['Record cash, UPI and card payments', 'Dues raised automatically each cycle', 'Custom rent or fee per member', 'Receipts and statements on WhatsApp', 'See what is still to collect'] },
  { key: 'members', icon: UsersIcon, title: 'Member management', lead: 'Every member with their plan, room, payments and history on one page.',
    points: ['Add members in seconds', 'Filter by plan, room or what they owe', 'Pause, move room or mark as left', 'Upcoming renewals in their own tab'] },
  { key: 'rooms', icon: BuildingIcon, title: 'Rooms & beds', lead: 'Buildings, floors and rooms as a live board: see every free bed at a glance.',
    points: ['Free, taken and overdue beds in colour', 'Add a tenant straight onto a free bed', 'Move tenants between rooms', 'Rent per bed or per tenant'] },
  { key: 'att', icon: CalendarCheckIcon, title: 'Attendance', lead: 'Mark the daily list, or let gym members check in by scanning a QR code.',
    points: ['Present / absent in one tap', 'QR check-in poster for gyms', 'Import from fingerprint machines', 'See who has stopped coming'] },
  { key: 'remind', icon: BellIcon, title: 'Reminders', lead: 'Polite WhatsApp reminders with your UPI link, one by one or to everyone who owes.',
    points: ['Remind everyone who owes in one go', 'Automatic reminder spacing', 'Renewal heads-ups before dues', 'Payment link in every message'] },
  { key: 'reports', icon: BarChartIcon, title: 'Reports', lead: 'What came in, what went out and who still owes — month by month.',
    points: ['Collected, spent and profit', 'Expenses by category', 'Who paid and who did not', 'Excel downloads and full backup'] },
];

const rupees = (n) => `₹${n.toLocaleString('en-IN')}`;

export default function Landing() {
  const { theme, toggleTheme } = useTheme();
  const [yearly, setYearly] = useState(false);
  const [feature, setFeature] = useState(FEATURES[0].key);
  const [open, setOpen] = useState(0);
  const f = FEATURES.find((x) => x.key === feature);

  return (
    <div className="landing">
      <nav className="lp-nav">
        <Link to="/" aria-label="LocalSaaS home"><Logo /></Link>
        <div className="lp-links">
          <a href="#features">Features</a>
          <a href="#solutions">Solutions</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
        </div>
        <div className="lp-nav-actions">
          <button type="button" className="theme-toggle-btn" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'dark' ? <SunIcon size={16} /> : <MoonIcon size={16} />}
          </button>
          <Link to="/login" className="lp-login">Log in</Link>
          <Link to="/signup" className="lp-btn sm">Sign up</Link>
        </div>
      </nav>

      {/* hero */}
      <header className="lp-hero lp-wrap">
        <div className="lp-hero-text">
          <span className="brand-chip">All-in-one management for your business</span>
          <h1>A calmer way to run <em>your business.</em></h1>
          <p>Manage rooms, members, payments and daily operations for PGs, hostels, tuition centres, gyms and mess — all in one simple platform.</p>
          <div className="lp-cta-row">
            <Link to="/signup" className="lp-btn">Get started free <ArrowRightIcon size={16} /></Link>
            <a href="#features" className="lp-btn ghost">See how it works</a>
          </div>
          <ul className="lp-ticks">
            {['Easy setup', 'Save time', 'Grow your business'].map((t) => <li key={t}><CheckIcon size={14} />{t}</li>)}
          </ul>
        </div>
        <HeroArt className="lp-hero-art" />
      </header>

      {/* who it's for */}
      <section id="solutions" className="lp-wrap lp-types">
        {TYPES.map((t) => {
          const Art = TYPE_ART[t.key];
          return (
            <Link key={t.key} to={`/signup?type=${t.key}`} className="lp-type">
              <Art />
              <b>{t.title}</b>
              <span>{t.blurb}</span>
              <i className="lp-type-go" aria-hidden="true"><ArrowRightIcon size={15} /></i>
            </Link>
          );
        })}
      </section>

      <section className="lp-wrap lp-strip">
        {[
          [CreditCardIcon, 'Payments & billing', 'Collect fees, track dues and send receipts.'],
          [UsersIcon, 'Member management', 'Keep member records organised.'],
          [BellIcon, 'Reminders & notifications', 'Timely WhatsApp nudges for overdue payments.'],
          [BarChartIcon, 'Reports & insights', 'Understand how your business is doing.'],
        ].map(([Icon, t, d]) => (
          <div key={t} className="lp-strip-item">
            <span className="lp-icon"><Icon size={18} /></span>
            <div><b>{t}</b><span>{d}</span></div>
          </div>
        ))}
      </section>

      {/* product band */}
      <section className="lp-wrap">
        <div className="lp-band">
          <div className="lp-band-text">
            <h2>Built for real businesses</h2>
            <p>Simple, powerful and flexible for your daily operations.</p>
            <Link to="/signup" className="lp-btn light">Start now for free <ArrowRightIcon size={16} /></Link>
          </div>
          <div className="lp-mock" aria-label="Example of the dashboard" role="img">
            <div className="lp-mock-side">
              <Logo size={20} />
              {['Dashboard', 'Members', 'Rooms', 'Reports', 'Settings'].map((x, i) => <span key={x} className={i === 0 ? 'on' : ''}>{x}</span>)}
            </div>
            <div className="lp-mock-main">
              <small>Example · this month</small>
              <div className="lp-mock-hero"><span>Collected this month</span><b>₹1,82,500</b><small>↑ 12% vs last month</small></div>
              <div className="lp-mock-two">
                <div><span>Outstanding</span><b>₹27,500</b></div>
                <div><span>Overdue</span><b>₹12,500</b></div>
              </div>
              <div className="lp-mock-bar"><span>42 of 48 beds occupied</span><i><em style={{ width: '87%' }} /></i></div>
            </div>
            <div className="lp-mock-list">
              <b>Recent payments</b>
              {[['Room 101', '₹5,000'], ['Room 104', '₹3,000'], ['Room 202', '₹5,000'], ['Room 305', '₹1,500']].map(([r, a]) => (
                <div key={r}><span className="lp-mock-dot" /><span>{r}</span><em>{a}</em></div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* steps */}
      <section className="lp-wrap lp-section">
        <span className="brand-chip">How it works</span>
        <h2 className="lp-h2">Get started in 3 simple steps</h2>
        <p className="lp-sub">Set up your business and start managing in minutes.</p>
        <div className="lp-steps">
          {[
            [SlidersHorizontalIcon, 'Create your account', 'Sign up and choose your business type.'],
            [BuildingIcon, 'Set up your place', 'Add rooms, batches or plans and what they cost.'],
            [BarChartIcon, 'Start managing', 'Track payments, members and attendance in one place.'],
          ].map(([Icon, t, d], i) => (
            <div key={t} className="lp-step">
              <div className="lp-step-head"><span className="lp-step-no">0{i + 1}</span><span className="lp-icon"><Icon size={18} /></span></div>
              <b>{t}</b><span>{d}</span>
            </div>
          ))}
        </div>
      </section>

      {/* features */}
      <section id="features" className="lp-wrap lp-section">
        <span className="brand-chip">Everything you need</span>
        <h2 className="lp-h2">Powerful features for everyday operations</h2>
        <div className="lp-features">
          <div className="lp-feature-tabs" role="tablist" aria-label="Features">
            {FEATURES.map((x) => {
              const Icon = x.icon;
              return (
                <button key={x.key} type="button" role="tab" aria-selected={feature === x.key}
                  className={feature === x.key ? 'on' : ''} onClick={() => setFeature(x.key)}>
                  <Icon size={16} /> {x.title}
                </button>
              );
            })}
          </div>
          <div className="lp-feature-body" role="tabpanel">
            <h3>{f.title}</h3>
            <p>{f.lead}</p>
            <ul>{f.points.map((p) => <li key={p}><CheckIcon size={15} />{p}</li>)}</ul>
            <Link to="/signup" className="lp-btn sm">Try it free <ArrowRightIcon size={15} /></Link>
          </div>
          <div className="lp-feature-card" aria-hidden="true">
            <div className="lp-paid"><span className="lp-paid-ok"><CheckIcon size={16} /></span><div><b>Payment received</b><span>UPI payment</span></div><em>₹5,000</em></div>
            {[['Rent payment', '₹5,000', 'Today'], ['Monthly fee', '₹3,000', 'Yesterday'], ['Registration', '₹1,000', 'This week']].map(([t, a, d]) => (
              <div key={t} className="lp-pay-row"><span className="lp-icon sm"><RupeeIcon size={14} /></span><span>{t}</span><b>{a}</b><small>{d}</small></div>
            ))}
            <div className="lp-wa"><WhatsAppIcon size={15} /> Receipt sent on WhatsApp</div>
          </div>
        </div>
      </section>

      {/* pricing */}
      <section id="pricing" className="lp-wrap lp-section">
        <span className="brand-chip">Simple and transparent</span>
        <div className="lp-price-head">
          <h2 className="lp-h2">Choose a plan that fits your business</h2>
          <div className="lp-billing" role="group" aria-label="Billing period">
            <button type="button" className={!yearly ? 'on' : ''} aria-pressed={!yearly} onClick={() => setYearly(false)}>Monthly</button>
            <button type="button" className={yearly ? 'on' : ''} aria-pressed={yearly} onClick={() => setYearly(true)}>
              Yearly <small>save {YEARLY_OFF * 100}%</small>
            </button>
          </div>
        </div>
        <div className="lp-plans">
          {PLANS.map((p) => (
            <div key={p.name} className={`lp-plan${p.popular ? ' popular' : ''}`}>
              {p.popular && <span className="lp-popular">Most popular</span>}
              <b className="lp-plan-name">{p.name}</b>
              <span className="lp-plan-for">{p.for}</span>
              <div className="lp-price">
                {p.custom ? <b>Custom pricing</b> : <><b>{rupees(Math.round(p.monthly * (yearly ? 1 - YEARLY_OFF : 1)))}</b><span>/month{yearly ? ', billed yearly' : ''}</span></>}
              </div>
              <ul>{p.points.map((x) => <li key={x}><CheckIcon size={14} />{x}</li>)}</ul>
              <Link to="/signup" className={`lp-btn ${p.custom ? 'ghost' : ''} block`}>{p.custom ? 'Talk to us' : 'Get started'}</Link>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="lp-wrap lp-section">
        <span className="brand-chip">Frequently asked questions</span>
        <h2 className="lp-h2">Got questions? We've got answers.</h2>
        <div className="lp-faq">
          {FAQ.map(([q, a], i) => (
            <div key={q} className={`lp-q${open === i ? ' open' : ''}`}>
              <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)}>
                <span>{q}</span><ChevronDownIcon size={16} />
              </button>
              {open === i && <p>{a}</p>}
            </div>
          ))}
        </div>
      </section>

      <section className="lp-wrap">
        <div className="lp-final">
          <div>
            <h2>Ready to simplify your business management?</h2>
            <p>Set up in minutes. No app to install for your members.</p>
          </div>
          <Link to="/signup" className="lp-btn light">Get started free <ArrowRightIcon size={16} /></Link>
        </div>
      </section>

      <footer className="lp-wrap lp-footer">
        <div>
          <Logo size={26} />
          <p>All-in-one management for PGs, hostels, tuition centres, gyms and mess.</p>
        </div>
        <div className="lp-foot-links">
          <div><b>Product</b><a href="#features">Features</a><a href="#solutions">Solutions</a><a href="#pricing">Pricing</a></div>
          <div><b>Help</b><a href="#faq">FAQ</a></div>
          <div><b>Account</b><Link to="/login">Log in</Link><Link to="/signup">Sign up</Link></div>
        </div>
        <small className="lp-copy">© {new Date().getFullYear()} LocalSaaS. All rights reserved.</small>
      </footer>
    </div>
  );
}
