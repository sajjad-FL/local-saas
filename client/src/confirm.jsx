import { useEffect, useState } from 'react';
import { ConfirmDialog } from './ui.jsx';

// Ask before anything destructive, from anywhere:
//   if (await confirmAction({ title: 'Delete room 101?', message: '…', confirmText: 'Delete', danger: true })) { … }
// <ConfirmHost /> (mounted once in App.jsx) shows the dialog. Resolves true on confirm, false on cancel.
let show = null;

export function confirmAction(options) {
  return new Promise((resolve) => {
    if (show) show({ ...options, resolve });
    else resolve(window.confirm(options.title)); // host not mounted yet: still never skip the question
  });
}

export function ConfirmHost() {
  const [request, setRequest] = useState(null);
  useEffect(() => {
    show = setRequest;
    return () => { show = null; };
  }, []);
  const answer = (ok) => {
    request?.resolve(ok);
    setRequest(null);
  };
  return (
    <ConfirmDialog
      isOpen={!!request}
      onClose={() => answer(false)}
      onConfirm={() => answer(true)}
      title={request?.title}
      message={request?.message}
      confirmText={request?.confirmText || 'Confirm'}
      danger={request?.danger}
      icon={request?.icon}
    />
  );
}
