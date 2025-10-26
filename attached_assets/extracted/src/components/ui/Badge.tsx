import React from 'react';

export function Chip({ tone='ok', children }:{ tone?: 'ok'|'warn'|'danger', children: React.ReactNode }) {
  return <span className={['chip', tone].join(' ')} role="status" aria-live="polite">{children}</span>;
}
