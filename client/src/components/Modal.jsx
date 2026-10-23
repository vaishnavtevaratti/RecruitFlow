/**
 * RecruitFlow — Generic Accessible Modal Component
 */

import React, { useEffect, useId } from 'react';

export default function Modal({ title, isOpen, onClose, children, size = 'lg' }) {
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    document.body.classList.add('modal-open-rf');
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.classList.remove('modal-open-rf');
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClass = size === 'sm' ? '' : `modal-${size}`;

  return (
    <div
      className="modal fade show d-block modal-rf-backdrop"
      tabIndex="-1"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`modal-dialog modal-dialog-centered modal-dialog-scrollable ${sizeClass}`}>
        <div className="modal-content border-0 rounded-4 shadow-lg">
          <div className="modal-header px-4 py-3">
            <h5 className="modal-title fw-bold" id={titleId}>{title}</h5>
            <button type="button" className="btn-close" aria-label="Close" onClick={onClose}></button>
          </div>
          <div className="modal-body p-4">{children}</div>
        </div>
      </div>
    </div>
  );
}
