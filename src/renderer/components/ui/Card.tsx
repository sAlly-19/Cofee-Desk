import * as React from 'react';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: string;
}

export function Card({
  children,
  className,
  padding = '1rem',
}: CardProps): JSX.Element {
  return (
    <div
      className={className}
      style={{
        border: '1px solid var(--border-subtle, #39241C)',
        borderRadius: '14px',
        background: 'var(--bg-surface, #21130F)',
        boxShadow: 'var(--shadow-card, 0 10px 30px rgba(0, 0, 0, 0.6))',
        padding,
      }}
    >
      {children}
    </div>
  );
}
