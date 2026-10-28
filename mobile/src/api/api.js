import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const DEFAULT_PORT = '4000';
// Android emulator uses 10.0.2.2 to access host machine; iOS simulator / web uses localhost
const DEFAULT_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
export const DEFAULT_API_BASE =
  process.env.EXPO_PUBLIC_API_URL || `http://${DEFAULT_HOST}:${DEFAULT_PORT}/api`;

// Where the web app lives, for links people open in a browser (statements, gym check-in).
// Falls back to the API's own address, which is right when both are served from the same place.
export const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL || DEFAULT_API_BASE.replace(/\/api\/?$/, '')).replace(/\/$/, '');

const STORAGE_KEYS = {
  TOKEN: '@local_saas_token',
  BIZ_ID: '@local_saas_biz_id',
  API_BASE: '@local_saas_api_base',
  THEME: '@local_saas_theme',
};

// Get current API base URL
export async function getApiBaseUrl() {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEYS.API_BASE);
    return saved || DEFAULT_API_BASE;
  } catch {
    return DEFAULT_API_BASE;
  }
}

// Set custom API base URL
export async function setApiBaseUrl(url) {
  let cleaned = (url || '').trim();
  if (!cleaned) cleaned = DEFAULT_API_BASE;
  // Ensure protocol
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = `http://${cleaned}`;
  }
  // Ensure ends with /api
  if (!cleaned.endsWith('/api')) {
    cleaned = cleaned.replace(/\/+$/, '') + '/api';
  }
  await AsyncStorage.setItem(STORAGE_KEYS.API_BASE, cleaned);
  return cleaned;
}

// Core API caller
export async function api(path, opts = {}) {
  const token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
  const baseUrl = await getApiBaseUrl();

  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

  const headers = {
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...opts,
    headers,
    body: opts.body ? (typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)) : undefined,
  });

  const contentType = res.headers.get('content-type') || '';
  let body;
  if (contentType.includes('application/json')) {
    body = await res.json().catch(() => ({}));
  } else {
    body = await res.text().catch(() => '');
  }

  if (!res.ok) {
    const message = (typeof body === 'object' && body?.error) ? body.error : (typeof body === 'string' && body) || `HTTP ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.body = body;
    throw err;
  }

  return body;
}

// Decode userId from JWT token
export function parseToken(token) {
  if (!token) return null;
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

// Format numbers to INR currency
export const rupees = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

// Format date
export const formatDate = (d) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return String(d);
  }
};

// Generate WhatsApp click-to-chat URL
export function waLink(phone, text) {
  let to = (phone || '').replace(/\D/g, '');
  if (to.length === 10) to = '91' + to; // default to India country code
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
}

// Generate UPI deep link
export function upiLink(biz, balance) {
  if (!biz?.upiId || !(balance > 0)) return null;
  return `upi://pay?pa=${encodeURIComponent(biz.upiId)}&pn=${encodeURIComponent(biz?.name || '')}&am=${balance}&cu=INR`;
}

// WhatsApp reminder message template
export function remindMsg(biz, member, balance, statementUrl) {
  const upi = upiLink(biz, balance);
  const bizName = biz?.name || 'our business';
  const memberName = member?.name || 'Member';
  return (
    `Hi ${memberName}, your payment of ${rupees(balance)} for ${bizName} is pending. Please pay at the earliest. Thank you!` +
    (upi ? `\n\nPay via UPI: ${upi}` : '') +
    (statementUrl ? `\n\nView your verified statement: ${statementUrl}` : '')
  );
}

// WhatsApp payment received receipt message template
export function receiptMsg(biz, member, payment, balance, statementUrl) {
  const mode = (payment?.mode || 'cash').toUpperCase();
  const bizName = biz?.name || 'our business';
  const memberName = member?.name || 'Member';
  return (
    `Payment Received! Hi ${memberName}, we received ${rupees(payment?.amount || 0)} (${mode}) for ${bizName}. ` +
    (balance > 0 ? `Remaining balance: ${rupees(balance)}.` : 'Your balance is fully cleared!') +
    (statementUrl ? `\n\nView updated statement: ${statementUrl}` : '')
  );
}

export { STORAGE_KEYS };

