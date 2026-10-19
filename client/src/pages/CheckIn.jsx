import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { CheckCircleIcon } from '../ui.jsx';

const API_BASE = import.meta.env.VITE_API_URL || '';
const PHONE_KEY = 'checkin-phone';
const remembered = () => { try { return localStorage.getItem(PHONE_KEY) || ''; } catch { return ''; } };
const remember = (phone) => { try { localStorage.setItem(PHONE_KEY, phone); } catch { /* private mode */ } };

async function call(path, opts) {
  const res = await fetch(`${API_BASE}/api/public${path}`, opts);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'something went wrong');
  return body;
}

// Public page behind the gym's QR poster: a member enters their mobile number and is checked in.
// No login and no app; the phone is remembered on this device so next time it's one tap.
export default function CheckIn() {
  const { token } = useParams();
  const [phone, setPhone] = useState(remembered);
  const { data: info, error: linkError, isLoading } = useQuery({
    queryKey: ['checkin', token],
    queryFn: () => call(`/checkin/${token}`),
    retry: false,
  });
  const checkin = useMutation({
    mutationFn: (memberId) => call(`/checkin/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, memberId }),
    }),
    onSuccess: (d) => { if (!d.choose) remember(phone); },
  });

  if (isLoading) return <p className="center">Loading…</p>;
  if (linkError) {
    return (
      <main className="checkin">
        <div className="analytics-card checkin-card">
          <h1>Check-in unavailable</h1>
          <p className="muted">{linkError.message}. Please ask the front desk.</p>
        </div>
      </main>
    );
  }

  const done = checkin.data?.choose ? null : checkin.data;
  const choose = checkin.data?.choose;
  return (
    <main className="checkin">
      <div className="analytics-card checkin-card">
        <div className="muted small">{info.business.name}</div>
        {done ? (
          <div className="checkin-done" role="status">
            <CheckCircleIcon size={56} />
            <h1>Welcome, {done.name}!</h1>
            <p className="muted">
              {done.already ? 'Already checked in today at ' : 'Checked in at '}
              <b>{new Date(done.at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</b>
            </p>
            <p className="muted small">Have a great workout.</p>
          </div>
        ) : choose ? (
          <div className="checkin-choose">
            <h1>Who's checking in?</h1>
            <p className="muted small">This number belongs to more than one member.</p>
            {choose.map((c) => (
              <button key={c.id} type="button" className="checkin-btn" disabled={checkin.isPending} onClick={() => checkin.mutate(c.id)}>
                {c.name}
              </button>
            ))}
            <button type="button" className="btn-link small" onClick={() => checkin.reset()}>Use a different number</button>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); checkin.mutate(undefined); }}>
            <h1>Check in</h1>
            <label className="input-label" htmlFor="checkin-phone">Your mobile number</label>
            <input
              id="checkin-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              autoFocus={!phone}
              placeholder="10-digit mobile number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            {checkin.error && <p className="error" role="alert">{checkin.error.message}</p>}
            <button type="submit" className="checkin-btn" disabled={checkin.isPending || phone.replace(/\D/g, '').length < 10}>
              {checkin.isPending ? 'Checking in…' : 'Check in'}
            </button>
            {remembered() && <p className="muted small" style={{ textAlign: 'center' }}>Number remembered on this phone.</p>}
          </form>
        )}
      </div>
    </main>
  );
}
