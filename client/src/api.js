const API_BASE = import.meta.env.VITE_API_URL || '';

export async function api(path, opts = {}) {
  const res = await fetch(`${API_BASE}/api${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('token')}`,
      ...opts.headers,
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 401 && !path.startsWith('/auth')) {
    localStorage.removeItem('token');
    location.href = '/login';
  }
  if (!res.ok) {
    // some hosts send no status text (HTTP/2), so always fall back to the code
    const message = (await res.json().catch(() => ({}))).error || res.statusText || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export const waLink = (phone, msg) =>
  `https://wa.me/${(phone || '').replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;

export const rupees = (n) => `₹${(n || 0).toLocaleString('en-IN')}`;

export const remindMsg = (biz, name, balance) =>
  `Hi ${name}, your payment of ${rupees(balance)} for ${biz.name} is pending. Please pay at the earliest. Thank you!` +
  (biz.upiId ? ` Pay via UPI: upi://pay?pa=${biz.upiId}&pn=${encodeURIComponent(biz.name)}&am=${balance}&cu=INR` : '');

export const userId = () => {
  try { return JSON.parse(atob(localStorage.getItem('token').split('.')[1])).userId; } catch { return null; }
};

// Every download asks first: DownloadConfirm (mounted in App.jsx) says what the file holds,
// then calls downloadNow.
export function download(path, filename) {
  window.dispatchEvent(new CustomEvent('download-request', { detail: { path, filename } }));
}

export async function downloadNow(path, filename) {
  const res = await fetch(`${API_BASE}/api${path}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  });
  // never save an error page as the downloaded file
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({}));
    throw new Error(error || `${res.status} ${res.statusText}`);
  }
  const blob = await res.blob();
  // phones: open the share sheet (Save to Files, WhatsApp, Sheets…) instead of a bare preview page
  const file = typeof File === 'function' && new File([blob], filename, { type: blob.type || 'text/csv' });
  if (file && matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return; // they closed the sheet
      // NotAllowedError etc.: fall back to a normal download
    }
  }
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), { href: url, download: filename }).click();
  URL.revokeObjectURL(url);
}

// What the signed-in person may do in this business (the server checks it too).
// 0 see only · 1 add members/payments · 2 also edit · 3 also delete. Owners are 3.
export const ADD = 1, EDIT = 2, DELETE = 3;
export const can = (biz, need) => (biz?.access ? biz.access.level : 3) >= need;
export const ACCESS_LEVELS = [
  { name: 'See only', short: 'Look up members, dues and payments. Changes nothing.', long: 'Look up members, dues and payments. Can’t change anything.', verb: 'look up members and payments', tone: 'grey' },
  { name: 'Add', short: 'Also add members and record payments.', long: 'Also add members, record payments and mark attendance.', verb: 'add members and record payments', tone: 'blue' },
  { name: 'Add & edit', short: 'Also edit members, plans and payments.', long: 'Also edit members and plans, pause or move members.', verb: 'add and edit members and payments', tone: 'amber' },
  { name: 'Full', short: 'Also delete members and payments.', long: 'Also delete members, payments and expenses. Give this only to a manager.', verb: 'add, edit and delete members and payments', tone: 'red' },
];
