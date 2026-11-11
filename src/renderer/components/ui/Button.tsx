import * as React from 'react';

export interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  className?: string;
  btnStyle?: React.CSSProperties;
}

const variantStyles: Record<string, Record<string, string>> = {
  primary: {
    background: 'var(--accent-gradient, linear-gradient(135deg, #C77B3B 0%, #A85D26 100%))',
    color: 'var(--text-primary, #F4EAE0)',
    border: 'none',
    hover: 'var(--accent-hover, #DF9651)',
    focusRing: 'var(--accent-primary, #C77B3B)',
  },
  secondary: {
    background: 'var(--bg-surface-raised, #2C1912)',
    color: 'var(--text-primary, #F4EAE0)',
    border: '1px solid var(--border-subtle, #39241C)',
    hover: 'rgba(199, 123, 59, 0.15)',
    focusRing: 'var(--border-warm, #70432B)',
  },
  danger: {
    background: 'var(--error, #ef4444)',
    color: '#ffffff',
    border: 'none',
    hover: '#dc2626',
    focusRing: 'var(--error, #ef4444)',
  },
  success: {
    background: 'var(--success, #34C66B)',
    color: '#ffffff',
    border: 'none',
    hover: '#22c55e',
    focusRing: 'var(--success, #34C66B)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-secondary, #C4AFA0)',
    border: 'none',
    hover: 'rgba(199, 123, 59, 0.08)',
    focusRing: 'var(--border-subtle, #39241C)',
  },
};

export function Button({
  children,
  onClick,
  disabled = false,
  variant = 'primary',
  className,
  btnStyle,
}: ButtonProps): JSX.Element {
  const s = variantStyles[variant];

  return (
    <button
      className={className}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...btnStyle,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        padding: '0.625rem 1rem',
        fontSize: '0.95rem',
        fontWeight: 500,
        borderRadius: 'var(--cd-radius)',
        border: s.border,
        background: s.background,
        color: s.color,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.2s, box-shadow 0.2s',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
        ...(disabled
          ? {
              opacity: 0.5,
              cursor: 'not-allowed',
            }
          : {}),
      }}
      onMouseEnter={
        disabled
          ? undefined
          : (e: React.MouseEvent<HTMLButtonElement>) => {
              (e.currentTarget as HTMLButtonElement).style.background = s.hover;
            }
      }
      onMouseLeave={
        disabled
          ? undefined
          : (e: React.MouseEvent<HTMLButtonElement>) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                s.background;
            }
      }
    >
      {children}
    </button>
  );
}
