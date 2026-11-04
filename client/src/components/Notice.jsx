/**
 * RecruitFlow — Dismissible Success/Info Notice
 */

import React from 'react';

const ICONS = {
  success: 'bi-check-circle-fill',
  info: 'bi-info-circle-fill',
  warning: 'bi-exclamation-triangle-fill',
  danger: 'bi-exclamation-octagon-fill'
};

export default function Notice({ type = 'success', message, onClose }) {
  if (!message) return null;
  return (
    <div className={`alert alert-${type} d-flex align-items-start gap-2 rounded-3 mb-4`} role={type === 'danger' ? 'alert' : 'status'}>
      <i className={`bi ${ICONS[type] || ICONS.info} mt-1`} aria-hidden="true"></i>
      <div className="flex-grow-1">{message}</div>
      {onClose && <button type="button" className="btn-close" aria-label="Dismiss" onClick={onClose}></button>}
    </div>
  );
}
