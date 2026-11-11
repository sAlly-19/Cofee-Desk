import { desktopCapturer, ipcMain, session } from 'electron';
import { IPC_CHANNELS } from '../shared/ipcChannels';
import type { DesktopSource } from '../shared/types';

// Sessão de captura ativa
let activeSourceId: string | null = null;
let activeStream: MediaStream | null = null;

/**
 * Lista fontes de desktop disponíveis (telas e janelas).
 */
export async function getDesktopSources(): Promise<DesktopSource[]> {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 160, height: 120 },
  });

  return sources.map((source) => ({
    id: source.id,
    name: source.name,
    thumbnail: source.thumbnail.toDataURL(),
    displayId: source.display_id ?? '',
  }));
}

/**
 * Inicia captura da fonte especificada.
 * Retorna o ID da fonte para o renderer iniciar o getDisplayMedia.
 */
export async function startDesktopCapture(sourceId: string): Promise<{ success: boolean; sourceId: string }> {
  if (activeStream) {
    activeStream.getTracks().forEach((track) => track.stop());
    activeStream = null;
  }

  activeSourceId = sourceId;
  console.log(`[Screen] Captura iniciada: ${sourceId}`);
  return { success: true, sourceId };
}

/**
 * Para a captura de tela ativa.
 */
export async function stopDesktopCapture(): Promise<{ success: boolean }> {
  if (activeStream) {
    activeStream.getTracks().forEach((track) => track.stop());
    activeStream = null;
  }
  activeSourceId = null;
  console.log('[Screen] Captura parada');
  return { success: true };
}

/**
 * Retorna a fonte ativa atualmente.
 */
export function getActiveSourceId(): string | null {
  return activeSourceId;
}

/**
 * Registra handlers de IPC de captura de tela e handler nativo de getDisplayMedia.
 */
export function registerScreenIpcHandlers(): void {
  // Configura interceptador nativo de getDisplayMedia para o Electron
  try {
    if (session.defaultSession) {
      // Concede permissões para captura de tela e mídia sem bloqueios
      session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
        if (permission === 'display-capture' || permission === 'media') {
          return true;
        }
        return true;
      });

      session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
        if (permission === 'display-capture' || permission === 'media') {
          return callback(true);
        }
        return callback(true);
      });

      session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
        desktopCapturer
          .getSources({ types: ['screen', 'window'] })
          .then((sources) => {
            const primary =
              sources.find((s) => s.id.startsWith('screen:0')) ||
              sources.find((s) => s.id.startsWith('screen')) ||
              sources[0];

            if (primary) {
              console.log(`[Screen] setDisplayMediaRequestHandler selecionou: ${primary.name} (${primary.id})`);
              callback({ video: { id: primary.id, name: primary.name } });
            } else {
              console.warn('[Screen] Nenhuma fonte de tela encontrada');
              callback(null);
            }
          })
          .catch((err) => {
            console.error('[Screen] Erro no setDisplayMediaRequestHandler:', err);
            callback(null);
          });
      });
    }
  } catch (err) {
    console.warn('[Screen] Não foi possível configurar setDisplayMediaRequestHandler:', err);
  }

  ipcMain.handle(IPC_CHANNELS.DESKTOP_SOURCES, async () => {
    try {
      return await getDesktopSources();
    } catch (err) {
      console.error('[Screen] Erro ao listar fontes:', err);
      return [];
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.DESKTOP_STREAM_START,
    async (_event, sourceId: string) => {
      try {
        return await startDesktopCapture(sourceId);
      } catch (err) {
        console.error('[Screen] Erro ao iniciar captura:', err);
        return { success: false, sourceId: '' };
      }
    }
  );

  ipcMain.handle(IPC_CHANNELS.DESKTOP_STREAM_STOP, async () => {
    try {
      return await stopDesktopCapture();
    } catch (err) {
      console.error('[Screen] Erro ao parar captura:', err);
      return { success: false };
    }
  });
}
