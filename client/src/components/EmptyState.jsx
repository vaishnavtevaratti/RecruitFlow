/**
 * RecruitFlow — Empty State Placeholder
 */

import React from 'react';

export default function EmptyState({ icon = 'bi-inbox', title, message, action }) {
  return (
    <div className="card-rf empty-state text-center">
      <div className="empty-state-icon mx-auto mb-3">
        <i className={`bi ${icon}`}></i>
      </div>
      <h5 className="fw-semibold mb-1">{title}</h5>
      {message && <p className="text-muted small mb-3 mx-auto" style={{ maxWidth: 420 }}>{message}</p>}
      {action}
    </div>
  );
}
