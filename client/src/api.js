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
    location.href = '/';
  }
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
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

export async function download(path, filename) {
  const res = await fetch(`${API_BASE}/api${path}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  });
  // never save an error page as the downloaded file
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({}));
    return alert(`Download failed: ${error || `${res.status} ${res.statusText}`}`);
  }
  const url = URL.createObjectURL(await res.blob());
  Object.assign(document.createElement('a'), { href: url, download: filename }).click();
  URL.revokeObjectURL(url);
}
