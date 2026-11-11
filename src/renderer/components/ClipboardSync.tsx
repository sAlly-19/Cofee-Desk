import { useState, useEffect, useCallback } from 'react';
import { ElectronAPI } from '@main/preload';
import type { ClipboardData } from '@shared/types';
import { Button } from './ui/Button';
import { Toggle } from './ui/Toggle';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

interface Props {
  connectionId: string;
  isConnected: boolean;
}

export function ClipboardSync({ connectionId, isConnected }: Props) {
  const [localClipboard, setLocalClipboard] = useState<string>('');
  const [remoteClipboard, setRemoteClipboard] = useState<string | null>(null);
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [lastSync, setLastSync] = useState<string | null>(null);

  // Escuta mudanças de clipboard remoto
  useEffect(() => {
    if (!window.electronAPI || !isConnected) return;

    window.electronAPI.onClipboardChanged((data: ClipboardData) => {
      if (data.type === 'text' && data.content) {
        setRemoteClipboard(data.content);
        setLastSync(new Date().toLocaleTimeString());
      }
    });
  }, [isConnected, connectionId]);

  const handleCopyLocal = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setLocalClipboard(text);
    } catch {
      // Permissão negada ou clipboard vazio
    }
  }, []);

  const handleSendToRemote = useCallback(async () => {
    if (!window.electronAPI || !syncEnabled || !localClipboard) return;

    try {
      await window.electronAPI.setClipboard({
        type: 'text',
        content: localClipboard,
      });
      setLastSync(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Erro ao enviar clipboard:', err);
    }
  }, [localClipboard, syncEnabled, connectionId, window.electronAPI]);

  const handleApplyRemote = useCallback(() => {
    if (remoteClipboard) {
      navigator.clipboard.writeText(remoteClipboard);
      setLocalClipboard(remoteClipboard);
    }
  }, [remoteClipboard]);

  return (
    <Card>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: '0.95rem',
            color: 'var(--cd-text)',
          }}
        >
          Clipboard Compartilhado
        </h3>
        <Toggle
          checked={syncEnabled}
          onChange={setSyncEnabled}
          label='Sincronizar automaticamente'
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '0.8rem',
              color: 'var(--cd-text-muted)',
              marginBottom: '0.5rem',
            }}
          >
            Meu Clipboard
          </label>
          <div
            style={{
              border: `1px solid var(--cd-border)`,
              borderRadius: 'var(--cd-radius)',
              padding: '0.75rem',
              minHeight: '120px',
              fontFamily: 'monospace',
              fontSize: '0.85rem',
              color: 'var(--cd-text)',
              background: 'var(--cd-surface)',
              overflowY: 'auto',
            }}
          >
            {localClipboard || '(vazio)'}
          </div>
          <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
            <Button
              onClick={handleCopyLocal}
              variant='secondary'
              btnStyle={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem' }}
            >
              Ler do Sistema
            </Button>
            <Button
              onClick={handleSendToRemote}
              disabled={!localClipboard || !syncEnabled}
              variant='primary'
              btnStyle={{
                flex: 1,
                padding: '0.5rem',
                fontSize: '0.8rem',
                opacity: !localClipboard || !syncEnabled ? 0.5 : 1,
              }}
            >
              Enviar ao Remoto
            </Button>
          </div>
        </div>

        <div>
          <label
            style={{
              display: 'block',
              fontSize: '0.8rem',
              color: 'var(--cd-text-muted)',
              marginBottom: '0.5rem',
            }}
          >
            Clipboard Remoto
          </label>
          <div
            style={{
              border: `1px solid var(--cd-border)`,
              borderRadius: 'var(--cd-radius)',
              padding: '0.75rem',
              minHeight: '120px',
              fontFamily: 'monospace',
              fontSize: '0.85rem',
              color: 'var(--cd-text)',
              background: 'var(--cd-surface)',
              overflowY: 'auto',
            }}
          >
            {remoteClipboard || '(vazio)'}
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <Button
              onClick={handleApplyRemote}
              disabled={!remoteClipboard}
              variant='success'
              btnStyle={{
                width: '100%',
                padding: '0.5rem',
                fontSize: '0.8rem',
                opacity: !remoteClipboard ? 0.5 : 1,
              }}
            >
              Aplicar ao Meu Sistema
            </Button>
          </div>
        </div>
      </div>

      {lastSync && (
        <div
          style={{
            marginTop: '0.75rem',
            fontSize: '0.75rem',
            color: 'var(--cd-text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <Badge variant='success' style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem' }}>
            Sincronizado
          </Badge>
          <span>Última sincronização: {lastSync}</span>
        </div>
      )}
    </Card>
  );
}
