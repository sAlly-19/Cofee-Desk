import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/ipcChannels';
import type {
  ConnectionState,
  MouseEventData,
  KeyboardEventData,
  ClipboardData,
  AppError,
  RemoteConnectionRequest,
} from '../shared/types';

// Permite que o renderer invoque o main de forma tipada e segura
const electronAPI = {
  // Janela
  minimize: () => ipcRenderer.send(IPC_CHANNELS.WINDOW_MINIMIZE),
  maximize: () => ipcRenderer.send(IPC_CHANNELS.WINDOW_MAXIMIZE),
  close: () => ipcRenderer.send(IPC_CHANNELS.WINDOW_CLOSE),

  // Identidade
  getMyId: () => ipcRenderer.invoke(IPC_CHANNELS.GET_MY_ID),
  setMyId: (id: string) => ipcRenderer.send(IPC_CHANNELS.SET_MY_ID, id),

  // Sessão
  getSessionInfo: () => ipcRenderer.invoke(IPC_CHANNELS.GET_SESSION_INFO),

  // Conexão remota
  sendConnectRequest: (toId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.CONNECT_REQUEST, toId),
  acceptConnection: (connectionId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.CONNECT_ACCEPT, connectionId),
  rejectConnection: (connectionId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.CONNECT_REJECT, connectionId),
  disconnect: (connectionId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.CONNECT_DISCONNECT, connectionId),
  onConnectionState: (callback: (state: ConnectionState) => void) =>
    ipcRenderer.on(IPC_CHANNELS.CONNECTION_STATE, (_event, state) => callback(state)),
  onConnectRequest: (callback: (req: RemoteConnectionRequest) => void) =>
    ipcRenderer.on(IPC_CHANNELS.CONNECT_REQUEST, (_event, req) => callback(req)),

  // Controle remoto de mouse e teclado (via WebRTC data channel)
  sendMouseEvent: (data: MouseEventData) =>
    ipcRenderer.send(IPC_CHANNELS.REMOTE_INPUT_MOUSE, data),
  sendKeyEvent: (data: KeyboardEventData) =>
    ipcRenderer.send(IPC_CHANNELS.REMOTE_INPUT_KEYBOARD, data),
  toggleInputControl: (enabled?: boolean) =>
    ipcRenderer.invoke(IPC_CHANNELS.REMOTE_CONTROL_TOGGLE, enabled),
  getInputControlStatus: () =>
    ipcRenderer.invoke(IPC_CHANNELS.REMOTE_CONTROL_STATUS),

  // Transferência de arquivos
  requestFileList: () => ipcRenderer.invoke(IPC_CHANNELS.FILE_LIST_REQUEST),
  acceptFileTransfer: (fileId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.FILE_TRANSFER_ACCEPT, fileId),
  sendFile: (connectionId: string, filePath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.FILE_TRANSFER_REQUEST, { connectionId, filePath }),
  onFileTransferProgress: (callback: (progress: { fileId: string; percent: number }) => void) =>
    ipcRenderer.on(
      IPC_CHANNELS.FILE_TRANSFER_PROGRESS,
      (_event, progress) => callback(progress)
    ),
  onFileTransferComplete: (callback: (fileId: string) => void) =>
    ipcRenderer.on(IPC_CHANNELS.FILE_TRANSFER_COMPLETE, (_event, fileId) => callback(fileId)),
  saveFileToDownloads: (fileName: string, base64Data: string) =>
    ipcRenderer.invoke('file:saveToDownloads', { fileName, base64Data }),
  showItemInFolder: (filePath: string) =>
    ipcRenderer.invoke('file:showInFolder', filePath),
  openFile: (filePath: string) =>
    ipcRenderer.invoke('file:openFile', filePath),

  // Clipboard
  setClipboard: (data: ClipboardData) =>
    ipcRenderer.send(IPC_CHANNELS.CLIPBOARD_SET, data),
  getClipboard: () => ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_GET),
  onClipboardChanged: (callback: (data: ClipboardData) => void) =>
    ipcRenderer.on(IPC_CHANNELS.CLIPBOARD_CHANGED, (_event, data) => callback(data)),

  // Captura de tela
  getDesktopSources: () => ipcRenderer.invoke(IPC_CHANNELS.DESKTOP_SOURCES),
  startDesktopStream: (sourceId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.DESKTOP_STREAM_START, sourceId),
  stopDesktopStream: () => ipcRenderer.invoke(IPC_CHANNELS.DESKTOP_STREAM_STOP),

  // WebRTC (sinalização e conexão peer-to-peer)
  createWebRTCOffer: (connectionId: string, sourceId: string) =>
    ipcRenderer.invoke('webrtc:createOffer', connectionId, sourceId),
  setWebRTCRemoteDescription: (connectionId: string, sdp: string, type: 'offer' | 'answer') =>
    ipcRenderer.invoke('webrtc:setRemoteDescription', connectionId, sdp, type),
  addWebRTCIceCandidate: (connectionId: string, candidate: {
    candidate: string;
    sdpMid: string | null;
    sdpMLineIndex: number | null;
    usernameFragment: string | null;
  }) =>
    ipcRenderer.invoke('webrtc:addIceCandidate', connectionId, candidate),

  // Erros
  onError: (callback: (err: AppError) => void) =>
    ipcRenderer.on(IPC_CHANNELS.ERROR_OCCURRED, (_event, err) => callback(err)),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Exporta tipos para uso no renderer
export type ElectronAPI = typeof electronAPI;

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
