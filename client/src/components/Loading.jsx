/**
 * RecruitFlow — Loading skeleton (shared by every page while data loads)
 */

import React from 'react';

export default function Loading({ message = 'Loading data...', rows = 5 }) {
  return (
    <div className="card-rf p-3 mb-4" role="status" aria-busy="true">
      <span className="visually-hidden">{message}</span>
      <div className="skeleton skeleton-title mb-3"></div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="d-flex gap-3 align-items-center py-2">
          <div className="skeleton skeleton-avatar"></div>
          <div className="flex-grow-1">
            <div className="skeleton skeleton-line mb-2" style={{ width: `${70 - i * 7}%` }}></div>
            <div className="skeleton skeleton-line" style={{ width: `${40 - i * 4}%` }}></div>
          </div>
        </div>
      ))}
    </div>
  );
}
