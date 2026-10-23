/**
 * RecruitFlow — Confirmation Dialog
 * Styled replacement for window.confirm used before important workflow actions.
 */

import React from 'react';
import Modal from './Modal';

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  variant = 'primary',
  busy = false,
  onConfirm,
  onCancel
}) {
  return (
    <Modal title={title} isOpen={isOpen} onClose={busy ? () => {} : onCancel} size="sm">
      <div className="text-secondary mb-4">{message}</div>
      <div className="d-flex justify-content-end gap-2">
        <button type="button" className="btn btn-light border" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="button" className={`btn btn-${variant}`} onClick={onConfirm} disabled={busy} autoFocus>
          {busy && <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>}
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
