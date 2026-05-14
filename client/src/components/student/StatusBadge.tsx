import React from 'react';

interface StatusBadgeProps {
  status: 'good' | 'attention' | 'warning' | 'neutral' | null | undefined;
  label?: string;
}

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  good: { label: 'Good', className: 'badge badge-good' },
  attention: { label: 'Check-in', className: 'badge badge-attention' },
  warning: { label: 'Support Available', className: 'badge badge-warning' },
  risk: { label: 'Support Available', className: 'badge badge-warning' },
  neutral: { label: 'No data', className: 'badge badge-neutral' },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label }) => {
  const key = status || 'neutral';
  const config = STATUS_MAP[key] || STATUS_MAP.neutral;

  return (
    <span className={config.className}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: 'currentColor', display: 'inline-block', flexShrink: 0
      }} />
      {label || config.label}
    </span>
  );
};
