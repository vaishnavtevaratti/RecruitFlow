/**
 * RecruitFlow — Client-side pagination controls.
 * shortcut: lists are fetched whole and paged in the browser; add LIMIT/OFFSET to the
 * list endpoints if a table grows past a few thousand rows.
 */

import React from 'react';

export const PAGE_SIZE = 10;

export function paginate(items, page, size = PAGE_SIZE) {
  return items.slice((page - 1) * size, page * size);
}

export default function Pagination({ page, total, onChange, size = PAGE_SIZE }) {
  const pages = Math.ceil(total / size);
  if (pages <= 1) return null;
  const from = (page - 1) * size + 1;
  const to = Math.min(page * size, total);

  return (
    <nav className="pagination-rf" aria-label="Pagination">
      <span className="small text-muted">{from}–{to} of {total}</span>
      <div className="d-flex gap-1">
        <button type="button" className="btn btn-sm btn-light border" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
          <i className="bi bi-chevron-left"></i>
        </button>
        <span className="small align-self-center px-2">Page {page} of {pages}</span>
        <button type="button" className="btn btn-sm btn-light border" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Next page">
          <i className="bi bi-chevron-right"></i>
        </button>
      </div>
    </nav>
  );
}
