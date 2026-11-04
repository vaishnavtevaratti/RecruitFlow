/**
 * RecruitFlow — Toast notifications
 * useToast().success('Saved') / .error('Failed') shows a dismissible toast for a few seconds.
 */

import React, { createContext, useCallback, useContext, useState } from 'react';

const ToastContext = createContext(null);
let nextId = 1;

const ICONS = { success: 'bi-check-circle-fill', danger: 'bi-exclamation-octagon-fill', info: 'bi-info-circle-fill' };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const show = useCallback((type, message) => {
    const id = nextId++;
    setToasts((t) => [...t.slice(-3), { id, type, message }]);
    setTimeout(() => dismiss(id), type === 'danger' ? 7000 : 4500);
  }, [dismiss]);

  const api = React.useMemo(() => ({
    success: (m) => show('success', m),
    error: (m) => show('danger', m),
    info: (m) => show('info', m)
  }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast-rf toast-${t.type}`} role={t.type === 'danger' ? 'alert' : 'status'}>
            <i className={`bi ${ICONS[t.type]}`} aria-hidden="true"></i>
            <div className="flex-grow-1">{t.message}</div>
            <button type="button" className="btn-close btn-close-sm" aria-label="Dismiss" onClick={() => dismiss(t.id)}></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
