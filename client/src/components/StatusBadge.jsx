/**
 * RecruitFlow — Status Badge Component
 */

import React from 'react';

export default function StatusBadge({ status }) {
  if (!status) return null;

  const normalized = status.toUpperCase();

  let badgeClass = 'badge-draft';
  let icon = 'bi-circle';

  switch (normalized) {
    case 'PUBLISHED':
      badgeClass = 'badge-published';
      icon = 'bi-check-circle-fill';
      break;
    case 'DRAFT':
      badgeClass = 'badge-draft';
      icon = 'bi-pencil-fill';
      break;
    case 'CLOSED':
      badgeClass = 'badge-closed';
      icon = 'bi-x-circle-fill';
      break;

    case 'APPLIED':
      badgeClass = 'badge-applied';
      icon = 'bi-inbox-fill';
      break;
    case 'SCREENING':
      badgeClass = 'badge-screening';
      icon = 'bi-search';
      break;
    case 'SHORTLISTED':
      badgeClass = 'badge-shortlisted';
      icon = 'bi-star-fill';
      break;
    case 'INTERVIEW_SCHEDULED':
      badgeClass = 'badge-interview-scheduled';
      icon = 'bi-calendar-event-fill';
      break;
    case 'INTERVIEWED':
      badgeClass = 'badge-interviewed';
      icon = 'bi-chat-dots-fill';
      break;
    case 'SELECTED':
      badgeClass = 'badge-selected';
      icon = 'bi-award-fill';
      break;
    case 'OFFER_SENT':
      badgeClass = 'badge-offer-sent';
      icon = 'bi-envelope-paper-fill';
      break;
    case 'OFFER_ACCEPTED':
      badgeClass = 'badge-offer-accepted';
      icon = 'bi-check2-circle';
      break;
    case 'HIRED':
      badgeClass = 'badge-hired';
      icon = 'bi-trophy-fill';
      break;
    case 'REJECTED':
    case 'DECLINED':
      badgeClass = 'badge-rejected';
      icon = 'bi-x-octagon-fill';
      break;
    case 'EXPIRED':
      badgeClass = 'badge-closed';
      icon = 'bi-hourglass-bottom';
      break;

    // Interview results
    case 'PASS':
      badgeClass = 'badge-published';
      icon = 'bi-check-lg';
      break;
    case 'FAIL':
      badgeClass = 'badge-rejected';
      icon = 'bi-x-lg';
      break;
    case 'PENDING':
      badgeClass = 'badge-interview-scheduled';
      icon = 'bi-hourglass-split';
      break;

    default:
      badgeClass = 'badge-draft';
  }

  // Format label: replace underscores with spaces
  const label = normalized.replace(/_/g, ' ');

  return (
    <span className={`badge-rf ${badgeClass}`}>
      <i className={`bi ${icon}`}></i>
      {label}
    </span>
  );
}
