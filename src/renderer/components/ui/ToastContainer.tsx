import { Check, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export interface ToastItem {
  id: string;
  title?: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  durationMs: number;
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onRemoveToast: (id: string) => void;
}

export function ToastContainer({ toasts, onRemoveToast }: ToastContainerProps): JSX.Element {
  if (toasts.length === 0) return <></>;

  return (
    <div
      style={{
        position: 'fixed',
        top: 20,
        right: 20,
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            pointerEvents: 'auto',
            minWidth: 280,
            maxWidth: 380,
            backgroundColor: 'var(--bg-surface, #21130F)',
            border: `1px solid ${
              t.type === 'error'
                ? 'rgba(239, 68, 68, 0.4)'
                : t.type === 'success'
                ? 'rgba(52, 198, 107, 0.4)'
                : 'var(--border-warm, #70432B)'
            }`,
            borderRadius: '10px',
            padding: '0.85rem 1.15rem',
            boxShadow: 'var(--shadow-card, 0 10px 30px rgba(0, 0, 0, 0.6))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            animation: 'cd-toast-in 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
            {t.type === 'success' && <Check size={18} color="var(--success, #34C66B)" />}
            {t.type === 'error' && <AlertCircle size={18} color="var(--error, #ef4444)" />}
            {t.type === 'warning' && <AlertTriangle size={18} color="var(--warning, #eab308)" />}
            {t.type === 'info' && <Info size={18} color="var(--accent-primary, #C77B3B)" />}
            <div>
              {t.title && (
                <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary, #F4EAE0)' }}>
                  {t.title}
                </div>
              )}
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #C4AFA0)' }}>
                {t.message}
              </div>
            </div>
          </div>
          <button
            onClick={() => onRemoveToast(t.id)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.5)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '4px',
            }}
          >
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}
