/**
 * RecruitFlow — Loading Component
 */

import React from 'react';

export default function Loading({ message = 'Loading data...' }) {
  return (
    <div className="d-flex flex-column align-items-center justify-content-center p-5 my-4">
      <div className="spinner-border text-primary mb-3" style={{ width: '3rem', height: '3rem' }} role="status">
        <span className="visually-hidden">Loading...</span>
      </div>
      <p className="text-muted fw-semibold mb-0">{message}</p>
    </div>
  );
}
