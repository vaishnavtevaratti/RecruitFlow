/**
 * RecruitFlow — Error Message Component
 */

import React from 'react';

export default function ErrorMessage({ message, onRetry }) {
  if (!message) return null;

  return (
    <div className="alert alert-danger d-flex align-items-center justify-content-between my-3 shadow-sm rounded-3" role="alert">
      <div className="d-flex align-items-center gap-2">
        <i className="bi bi-exclamation-triangle-fill fs-5 text-danger" aria-hidden="true"></i>
        <div>{message}</div>
      </div>
      {onRetry && (
        <button className="btn btn-sm btn-outline-danger ms-3" onClick={onRetry}>
          <i className="bi bi-arrow-clockwise me-1" aria-hidden="true"></i> Retry
        </button>
      )}
    </div>
  );
}
