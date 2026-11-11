import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../shared/ipcChannels';
import type {
  ConnectionState,
} from '../shared/types';
import { store } from './store';
import { closeSessionWindow } from './windowManager';

// Rastreamento de conexões ativas
interface ActiveConnection {
  connectionId: string;
  remoteId: string;
  localId: string;
  // Referências WebRTC serão preenchidas na implementação completa do signaling
  signalingWs: WebSocket | null;
  isConnected: boolean;
  connectedAt: Date | null;
  latencyMs: number;
}

const connections = new Map<string, ActiveConnection>();

/**
 * Retorna a conexão ativa por connectionId.
 */
export function getConnection(connectionId: string): ActiveConnection | undefined {
  return connections.get(connectionId);
}

/**
 * Retorna todas as conexões ativas.
 */
export function getAllConnections(): ActiveConnection[] {
  return Array.from(connections.values());
}

/**
 * Cria uma nova entrada de conexão (placeholder até o signaling completo).
 */
export function createConnectionEntry(
  connectionId: string,
  remoteId: string,
  localId: string
): ActiveConnection {
  const entry: ActiveConnection = {
    connectionId,
    remoteId,
    localId,
    signalingWs: null,
    isConnected: false,
    connectedAt: null,
    latencyMs: 0,
  };
  connections.set(connectionId, entry);
  return entry;
}

/**
 * Atualiza o estado de conexão.
 */
export function updateConnectionState(
  connectionId: string,
  partial: Partial<Pick<ActiveConnection, 'isConnected' | 'latencyMs' | 'connectedAt'>>
): void {
  const conn = connections.get(connectionId);
  if (!conn) return;
  Object.assign(conn, partial);
}

/**
 * Remove uma conexão ativa.
 */
export function removeConnection(connectionId: string): void {
  connections.delete(connectionId);
}

/**
 * Registra handlers de IPC relacionados a conexão remota.
 */
export function registerConnectionIpcHandlers(): void {
  // Solicitar conexão remota
  ipcMain.handle(
    IPC_CHANNELS.CONNECT_REQUEST,
    async (_event, toId: string): Promise<{ success: boolean; connectionId?: string; error?: string }> => {
      const localId = store.get('coffeeDeskId.id') as string;
      if (!localId) {
        return { success: false, error: 'ID local não definido' };
      }
      if (localId === toId) {
        return { success: false, error: 'Não é possível conectar a si mesmo' };
      }

      const connectionId = `conn-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      createConnectionEntry(connectionId, toId, localId);

      // Atualiza store
      store.set('session.remoteId', toId);

      console.log(`[Connection] Solicitação criada: ${connectionId} -> ${toId}`);
      return { success: true, connectionId };
    }
  );

  // Aceitar conexão
  ipcMain.handle(
    IPC_CHANNELS.CONNECT_ACCEPT,
    async (_event, connectionId: string): Promise<{ success: boolean; error?: string }> => {
      const conn = connections.get(connectionId);
      if (!conn) {
        return { success: false, error: 'Conexão não encontrada' };
      }
      updateConnectionState(connectionId, { isConnected: true, connectedAt: new Date() });
      console.log(`[Connection] Aceita: ${connectionId}`);
      return { success: true };
    }
  );

  // Rejeitar conexão
  ipcMain.handle(
    IPC_CHANNELS.CONNECT_REJECT,
    async (_event, connectionId: string): Promise<{ success: boolean }> => {
      removeConnection(connectionId);
      console.log(`[Connection] Rejeitada: ${connectionId}`);
      return { success: true };
    }
  );

  // Desconectar
  ipcMain.handle(
    IPC_CHANNELS.CONNECT_DISCONNECT,
    async (_event, connectionId: string): Promise<{ success: boolean }> => {
      const conn = connections.get(connectionId);
      if (conn?.signalingWs) {
        conn.signalingWs.close();
      }
      removeConnection(connectionId);
      closeSessionWindow();
      console.log(`[Connection] Desconectado: ${connectionId}`);
      return { success: true };
    }
  );

  // Obter estado de conexão
  ipcMain.handle(
    IPC_CHANNELS.CONNECTION_STATE,
    async (_event, connectionId: string): Promise<ConnectionState | null> => {
      const conn = connections.get(connectionId);
      if (!conn) return null;
      return {
        connected: conn.isConnected,
        remoteId: conn.remoteId,
        latencyMs: conn.latencyMs,
        bandwidthKbps: 0,
      };
    }
  );
}
