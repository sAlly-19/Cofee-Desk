import { Trash2 } from 'lucide-react';
import type { FileTransferItem } from '@shared/types';
import { FileDropzone } from './session/FileDropzone';
import { FileTransferItemCard } from './session/FileTransferItemCard';

interface Props {
  connectionId: string;
  isConnected: boolean;
  transfers: FileTransferItem[];
  isSending: boolean;
  onSendFiles: (files: FileList | File[]) => void;
  onCancelTransfer: (fileId: string) => void;
  onRemoveTransfer: (fileId: string) => void;
  onClearCompleted: () => void;
  isChannelReady?: boolean;
}

export function FileTransfer({
  isConnected,
  transfers,
  onSendFiles,
  onCancelTransfer,
  onRemoveTransfer,
  onClearCompleted,
  isChannelReady = true,
}: Props): JSX.Element {
  const completedCount = transfers.filter(
    (t) => t.status === 'complete' || t.status === 'cancelled'
  ).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1.25rem' }}>
      {/* 1. ZONA DE DRAG & DROP / UPLOAD */}
      <FileDropzone
        isConnected={isConnected}
        isChannelReady={isChannelReady}
        onSendFiles={onSendFiles}
      />

      {/* 2. CABEÇALHO DA LISTA E BOTÃO LIMPAR */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#ffffff' }}>
            Histórico de Transferências
          </span>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              padding: '2px 8px',
              borderRadius: '12px',
              color: 'rgba(255, 235, 220, 0.7)',
            }}
          >
            {transfers.length}
          </span>
        </div>

        {completedCount > 0 && (
          <button
            onClick={onClearCompleted}
            className="cd-btn-tactile"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'rgba(255, 140, 26, 0.85)',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '6px',
            }}
          >
            <Trash2 size={13} />
            <span>Limpar concluídos</span>
          </button>
        )}
      </div>

      {/* 3. LISTA DE TRANSFERÊNCIAS */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {transfers.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '2.5rem 1rem',
              color: 'rgba(255, 220, 195, 0.45)',
              fontSize: '0.85rem',
              border: '1px dashed rgba(255, 140, 26, 0.12)',
              borderRadius: '14px',
            }}
          >
            Nenhum arquivo transferido nesta sessão.
          </div>
        ) : (
          transfers.map((t) => (
            <FileTransferItemCard
              key={t.fileId}
              transfer={t}
              onCancel={onCancelTransfer}
              onRemove={onRemoveTransfer}
            />
          ))
        )}
      </div>
    </div>
  );
}
