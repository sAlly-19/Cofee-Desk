import * as React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'error' | 'muted' | 'primary';
  className?: string;
  style?: React.CSSProperties;
}

const variantStyles: Record<string, Record<string, string>> = {
  success: {
    background: 'rgba(52, 198, 107, 0.12)',
    color: 'var(--success, #34C66B)',
    border: '1px solid rgba(52, 198, 107, 0.3)',
  },
  error: {
    background: 'rgba(239, 68, 68, 0.12)',
    color: 'var(--error, #ef4444)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
  },
  primary: {
    background: 'rgba(199, 123, 59, 0.15)',
    color: 'var(--accent-primary, #C77B3B)',
    border: '1px solid var(--accent-primary, #C77B3B)',
  },
  muted: {
    background: 'var(--bg-input, #1C110E)',
    color: 'var(--text-muted, #927C70)',
    border: '1px solid var(--border-subtle, #39241C)',
  },
};

export function Badge({
  children,
  variant = 'muted',
  className,
  style,
}: BadgeProps): JSX.Element {
  const s = variantStyles[variant];
  return (
    <span
      className={className}
      style={{
        ...style,
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.25rem 0.6rem',
        fontSize: '0.75rem',
        fontWeight: 600,
        borderRadius: '9999px',
        border: s.border,
        background: s.background,
        color: s.color,
      }}
    >
      {children}
    </span>
  );
}
