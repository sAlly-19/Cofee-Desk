import { Clock, Trash2, Monitor, Play, MoreVertical } from 'lucide-react';
import { Modal } from '../ui/Modal';
import type { RecentSession } from '../../types/app';

interface AllRecentSessionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  recentSessions: RecentSession[];
  onClearAll: () => void;
  onConnectSession: (remoteId: string) => void;
  onOpenOptions: (session: RecentSession) => void;
}

export function AllRecentSessionsModal({
  isOpen,
  onClose,
  recentSessions,
  onClearAll,
  onConnectSession,
  onOpenOptions,
}: AllRecentSessionsModalProps): JSX.Element | null {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Todas as Sessões Recentes"
      subtitle={`${recentSessions.length} computadores conectados recentemente`}
      icon={<Clock size={20} color="var(--accent-primary, #C77B3B)" />}
      maxWidth={620}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          {recentSessions.length > 0 && (
            <button
              onClick={onClearAll}
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                borderRadius: '8px',
                padding: '0.55rem 1rem',
                fontSize: '0.85rem',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Trash2 size={15} />
              <span>Limpar Todo o Histórico</span>
            </button>
          )}

          <button
            onClick={onClose}
            style={{
              marginLeft: 'auto',
              padding: '0.55rem 1.25rem',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-subtle, #39241C)',
              borderRadius: '8px',
              color: 'var(--text-secondary, #C4AFA0)',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Fechar
          </button>
        </div>
      }
    >
      {recentSessions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted, #927C70)' }}>
          Nenhuma sessão recente registrada.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
          {recentSessions.map((session) => (
            <div
              key={session.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.85rem 1rem',
                backgroundColor: 'var(--bg-input, #1C110E)',
                border: '1px solid var(--border-subtle, #39241C)',
                borderRadius: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flex: 1 }}>
                <Monitor size={18} color="var(--accent-soft, #E5A96D)" />
                <div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary, #F4EAE0)' }}>
                    {session.name}
                  </div>
                  <div className="font-mono" style={{ fontSize: '0.78rem', color: 'var(--text-muted, #927C70)' }}>
                    ID: {session.remoteId}
                  </div>
                </div>
              </div>

              <div
                className="font-mono"
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--text-muted, #927C70)',
                  marginRight: '1rem',
                }}
              >
                {session.dateStr}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  onClick={() => {
                    onClose();
                    onConnectSession(session.remoteId);
                  }}
                  style={{
                    background: 'var(--accent-gradient, linear-gradient(135deg, #C77B3B 0%, #A85D26 100%))',
                    border: 'none',
                    color: 'var(--text-primary, #F4EAE0)',
                    borderRadius: '8px',
                    padding: '0.45rem 1rem',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Play size={12} fill="currentColor" />
                  <span>Conectar</span>
                </button>

                <button
                  onClick={() => onOpenOptions(session)}
                  title="Mais opções"
                  style={{
                    backgroundColor: 'transparent',
                    border: '1px solid var(--border-subtle, #39241C)',
                    color: 'var(--text-muted, #927C70)',
                    borderRadius: '8px',
                    padding: '0.45rem',
                    cursor: 'pointer',
                  }}
                >
                  <MoreVertical size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
