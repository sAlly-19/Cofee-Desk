export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  className?: string;
}

export function Toggle({
  checked,
  onChange,
  label,
  className,
}: ToggleProps): JSX.Element {
  return (
    <label
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.6rem',
        cursor: 'pointer',
        fontSize: '0.9rem',
        color: 'var(--text-primary, #F4EAE0)',
        userSelect: 'none',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.currentTarget.checked)}
        style={{
          width: '1rem',
          height: '1rem',
          accentColor: 'var(--accent-primary, #C77B3B)',
          cursor: 'pointer',
        }}
      />
      {label && <span>{label}</span>}
    </label>
  );
}
