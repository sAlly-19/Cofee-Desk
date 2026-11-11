import * as React from 'react';

export interface InputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  type?: 'text' | 'password';
  className?: string;
}

export function Input({
  value,
  onChange,
  placeholder,
  disabled = false,
  type = 'text',
  className,
}: InputProps): JSX.Element {
  return (
    <input
      className={className}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      style={{
        width: '100%',
        padding: '0.65rem 0.85rem',
        fontSize: '0.92rem',
        borderRadius: '8px',
        border: '1px solid var(--border-subtle, #39241C)',
        background: 'var(--bg-input, #1C110E)',
        color: 'var(--text-primary, #F4EAE0)',
        outline: 'none',
        fontFamily: 'inherit',
        transition: 'border-color 0.15s ease',
        ...(disabled ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
      }}
      onFocus={
        disabled
          ? undefined
          : (e: React.FocusEvent<HTMLInputElement>) => {
              (e.currentTarget as HTMLInputElement).style.borderColor =
                'var(--accent-primary, #C77B3B)';
            }
      }
      onBlur={
        disabled
          ? undefined
          : (e: React.FocusEvent<HTMLInputElement>) => {
              (e.currentTarget as HTMLInputElement).style.borderColor =
                'var(--border-subtle, #39241C)';
            }
      }
    />
  );
}
