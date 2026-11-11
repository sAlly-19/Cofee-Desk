import {
  File,
  FileText,
  FileCode,
  Image as ImageIcon,
  Film,
  Archive,
  CheckCircle2,
  XCircle,
  Folder,
  ExternalLink,
  X,
  ArrowUpRight,
  ArrowDownLeft,
  Loader2,
} from 'lucide-react';
import type { FileTransferItem } from '@shared/types';
import { formatFileSize, formatSpeed } from '../../hooks/useFileTransfer';

interface FileTransferItemCardProps {
  transfer: FileTransferItem;
  onCancel: (fileId: string) => void;
  onRemove: (fileId: string) => void;
}

function getFileIcon(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
    return <ImageIcon size={20} color="#ff9d42" />;
  }
  if (['mp4', 'mkv', 'avi', 'mov', 'webm'].includes(ext)) {
    return <Film size={20} color="#ff7a00" />;
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return <Archive size={20} color="#f59e0b" />;
  }
  if (['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'json', 'py', 'cpp', 'rs', 'go'].includes(ext)) {
    return <FileCode size={20} color="#38bdf8" />;
  }
  if (['pdf', 'doc', 'docx', 'txt', 'md', 'xlsx'].includes(ext)) {
    return <FileText size={20} color="#10b981" />;
  }
  return <File size={20} color="#e2e8f0" />;
}

export function FileTransferItemCard({
  transfer: t,
  onCancel,
  onRemove,
}: FileTransferItemCardProps): JSX.Element {
  const isSendingThis = t.status === 'sending';
  const isReceivingThis = t.status === 'receiving';
  const isActive = isSendingThis || isReceivingThis;
  const isComplete = t.status === 'complete';
  const isCancelled = t.status === 'cancelled';
  const isPending = t.status === 'pending';

  const handleOpenFile = (path?: string) => {
    if (path && window.electronAPI?.openFile) {
      window.electronAPI.openFile(path);
    }
  };

  const handleShowInFolder = (path?: string) => {
    if (path && window.electronAPI?.showItemInFolder) {
      window.electronAPI.showItemInFolder(path);
    }
  };

  return (
    <div
      className="cd-interactive-card"
      style={{
        backgroundColor: 'rgba(22, 12, 7, 0.75)',
        border: isActive
          ? '1px solid rgba(255, 140, 26, 0.45)'
          : '1px solid rgba(255, 140, 26, 0.16)',
        borderRadius: '14px',
        padding: '0.9rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.6rem',
        boxShadow: isActive ? '0 0 16px rgba(255, 122, 0, 0.15)' : 'none',
        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Linha Superior: Ícone, Nome, Tamanho, Direção e Botões */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '10px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 140, 26, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {getFileIcon(t.fileName)}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: '0.86rem',
              fontWeight: 700,
              color: '#ffffff',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={t.fileName}
          >
            {t.fileName}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.75rem',
              color: 'rgba(255, 220, 195, 0.6)',
              marginTop: '2px',
            }}
          >
            <span>{formatFileSize(t.fileSize)}</span>
            <span>•</span>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                color: t.direction === 'upload' ? '#ff9d42' : '#38bdf8',
              }}
            >
              {t.direction === 'upload' ? (
                <>
                  <ArrowUpRight size={12} />
                  <span>Envio</span>
                </>
              ) : (
                <>
                  <ArrowDownLeft size={12} />
                  <span>Download</span>
                </>
              )}
            </span>

            {isActive && t.speedBytesPerSec !== undefined && t.speedBytesPerSec > 0 && (
              <>
                <span>•</span>
                <span style={{ color: '#22c55e', fontWeight: 600 }}>
                  {formatSpeed(t.speedBytesPerSec)}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Ações / Status à direita */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {isActive ? (
            <button
              onClick={() => onCancel(t.fileId)}
              className="cd-btn-tactile"
              title="Cancelar transferência"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                color: '#ef4444',
                padding: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={14} />
            </button>
          ) : (
            <button
              onClick={() => onRemove(t.fileId)}
              className="cd-btn-tactile"
              title="Remover do histórico"
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.35)',
                padding: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Barra de Progresso Animada */}
      {isActive && (
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.72rem',
              color: 'rgba(255, 220, 195, 0.7)',
              marginBottom: '4px',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Loader2 size={11} className="cd-spin" />
              <span>{isSendingThis ? 'Transferindo...' : 'Baixando...'}</span>
            </span>
            <span style={{ fontWeight: 700, color: '#ff7a00' }}>{t.progress}%</span>
          </div>

          <div
            style={{
              height: 5,
              width: '100%',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              borderRadius: 3,
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, Math.max(0, t.progress))}%`,
                background: 'linear-gradient(90deg, #ff851a 0%, #ff5500 100%)',
                borderRadius: 3,
                transition: 'width 0.2s ease-out',
                boxShadow: '0 0 10px rgba(255, 122, 0, 0.6)',
              }}
            />
          </div>
        </div>
      )}

      {/* Status Concluído ou Cancelado */}
      {isComplete && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.74rem',
            color: '#22c55e',
            paddingTop: '2px',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <CheckCircle2 size={13} color="#22c55e" />
            <span>Concluído</span>
          </span>

          {/* Botões para abrir arquivo ou pasta (quando baixado no Electron) */}
          {t.savedPath && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                onClick={() => handleOpenFile(t.savedPath)}
                className="cd-btn-tactile"
                title="Abrir arquivo"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: 'rgba(34, 197, 94, 0.15)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  borderRadius: '6px',
                  padding: '2px 8px',
                  fontSize: '0.72rem',
                  color: '#22c55e',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <ExternalLink size={11} />
                <span>Abrir</span>
              </button>

              <button
                onClick={() => handleShowInFolder(t.savedPath)}
                className="cd-btn-tactile"
                title="Mostrar na pasta Downloads"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '6px',
                  padding: '2px 8px',
                  fontSize: '0.72rem',
                  color: 'rgba(255, 235, 220, 0.85)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Folder size={11} />
                <span>Ver na Pasta</span>
              </button>
            </div>
          )}
        </div>
      )}

      {isCancelled && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '0.74rem',
            color: '#ef4444',
          }}
        >
          <XCircle size={13} color="#ef4444" />
          <span>Cancelado</span>
        </div>
      )}

      {isPending && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '0.74rem',
            color: 'rgba(255, 220, 195, 0.6)',
          }}
        >
          <Loader2 size={12} className="cd-spin" />
          <span>Na fila para envio...</span>
        </div>
      )}
    </div>
  );
}
