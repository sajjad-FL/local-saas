import { useEffect, useState } from 'react';
import { downloadNow } from './api.js';
import { ConfirmDialog, DownloadIcon } from './ui.jsx';

// What each export holds, so the owner knows before saving it. Every export is
// all-time: say so, because the Reports screen may be showing a single month.
const EXPORTS = {
  'sales.csv': { title: 'Download sales?', text: 'Every sale in the period you picked: member, items, total, paid or on dues, and who sold it.' },
  'payments.csv': {
    title: 'Download all payments?',
    text: 'Every payment recorded since you started (date, member, amount, mode, note), not only the period on screen.',
  },
  'dues.csv': {
    title: 'Download unpaid fees?',
    text: 'Every fee not yet fully paid, oldest first, with the amount still owed and days overdue.',
  },
  'balances.csv': {
    title: 'Download the member list?',
    text: 'Everyone, one row each: phone, plan and fee, joined, status, next due date, total paid, what they owe and since when, last payment and last visit. People who owe are at the top.',
  },
  'expenses.csv': {
    title: 'Download all expenses?',
    text: 'Every expense recorded (date, category, amount, note), not only the period on screen.',
  },
  'backup.json': {
    title: 'Download a full backup?',
    text: "Members, plans, fees, payments and expenses in one file. It includes members' phone numbers, so keep it private.",
  },
};

// Listens for download() calls (api.js) and asks before saving the file.
export default function DownloadConfirm() {
  const [request, setRequest] = useState(null); // { path, filename }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onRequest = (e) => { setError(''); setRequest(e.detail); };
    window.addEventListener('download-request', onRequest);
    return () => window.removeEventListener('download-request', onRequest);
  }, []);

  const info = request && (EXPORTS[request.path.split('?')[0].split('/').pop()] || { title: 'Download this file?', text: '' });

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      await downloadNow(request.path, request.filename);
      setRequest(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ConfirmDialog
      isOpen={!!request}
      onClose={() => !busy && setRequest(null)}
      onConfirm={confirm}
      title={info?.title}
      message={
        <>
          {info?.text}
          <span className="download-file">{request?.filename}</span>
          {error && <span className="error" role="alert" style={{ display: 'block', marginTop: 8 }}>Download failed: {error}</span>}
        </>
      }
      confirmText={busy ? 'Downloading…' : error ? 'Try again' : 'Download'}
      icon={DownloadIcon}
      busy={busy}
    />
  );
}
