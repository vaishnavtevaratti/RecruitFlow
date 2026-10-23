/**
 * RecruitFlow — Status Badge Component
 * audience="candidate" swaps internal pipeline wording for candidate-friendly labels.
 */

import React from 'react';

const STYLES = {
  PUBLISHED: ['badge-published', 'bi-check-circle-fill'],
  DRAFT: ['badge-draft', 'bi-pencil-fill'],
  CLOSED: ['badge-closed', 'bi-x-circle-fill'],

  APPLIED: ['badge-applied', 'bi-inbox-fill'],
  SCREENING: ['badge-screening', 'bi-search'],
  SHORTLISTED: ['badge-shortlisted', 'bi-star-fill'],
  INTERVIEW_SCHEDULED: ['badge-interview-scheduled', 'bi-calendar-event-fill'],
  INTERVIEWED: ['badge-interviewed', 'bi-chat-dots-fill'],
  SELECTED: ['badge-selected', 'bi-award-fill'],
  OFFER_SENT: ['badge-offer-sent', 'bi-envelope-paper-fill'],
  OFFER_ACCEPTED: ['badge-offer-accepted', 'bi-check2-circle'],
  HIRED: ['badge-hired', 'bi-trophy-fill'],
  REJECTED: ['badge-rejected', 'bi-x-octagon-fill'],
  DECLINED: ['badge-rejected', 'bi-x-octagon-fill'],

  // Offer states
  SENT: ['badge-offer-sent', 'bi-send-fill'],
  ACCEPTED: ['badge-offer-accepted', 'bi-check2-circle'],
  EXPIRED: ['badge-closed', 'bi-hourglass-bottom'],

  // Interview results
  PASS: ['badge-published', 'bi-check-lg'],
  FAIL: ['badge-rejected', 'bi-x-lg'],
  PENDING: ['badge-interview-scheduled', 'bi-hourglass-split']
};

const CANDIDATE_LABELS = {
  APPLIED: 'Applied',
  SCREENING: 'Under Review',
  SHORTLISTED: 'Shortlisted',
  INTERVIEW_SCHEDULED: 'Interview Scheduled',
  INTERVIEWED: 'Interview Completed',
  SELECTED: 'Selected',
  OFFER_SENT: 'Offer Received',
  OFFER_ACCEPTED: 'Offer Accepted',
  HIRED: 'Hired',
  REJECTED: 'Not Selected',
  SENT: 'Awaiting Response',
  ACCEPTED: 'Accepted',
  EXPIRED: 'Expired',
  PASS: 'Passed',
  FAIL: 'Not Passed',
  PENDING: 'Scheduled'
};

export default function StatusBadge({ status, audience = 'staff', label: labelOverride }) {
  if (!status) return null;

  const normalized = String(status).toUpperCase();
  const [badgeClass, icon] = STYLES[normalized] || ['badge-draft', 'bi-circle'];

  let label = normalized.replace(/_/g, ' ');
  if (normalized === 'REJECTED' && audience === 'offer') label = 'DECLINED';
  if (audience === 'candidate' && CANDIDATE_LABELS[normalized]) label = CANDIDATE_LABELS[normalized];
  if (labelOverride) label = labelOverride;

  return (
    <span className={`badge-rf ${badgeClass} ${audience === 'candidate' ? 'badge-rf-soft-case' : ''}`}>
      <i className={`bi ${icon}`} aria-hidden="true"></i>
      {label}
    </span>
  );
}
