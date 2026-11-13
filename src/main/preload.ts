import type { UpdaterState } from "../shared/updater";
import type {
  SessionPermissions,
  SessionHistoryEntry,
} from "../shared/session";
import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS } from "../shared/ipcChannels";
import type {
  ConnectionState,
  MouseEventData,
  KeyboardEventData,
  ClipboardData,
  AppError,
  RemoteConnectionRequest,
} from "../shared/types";

// Permite que o renderer invoque o main de forma tipada e segura
const electronAPI = {
  notifyIncomingCall: () =>
    ipcRenderer.invoke("window:incoming") as Promise<boolean>,
  getCaptureSelection: () =>
    ipcRenderer.invoke("desktop:selection") as Promise<{
      sourceId: string;
      kind: "screen" | "window";
      active: boolean;
    } | null>,
  readClipboardFiles: () =>
    ipcRenderer.invoke("clipboard:files") as Promise<{
      revision: string;
      files: { token: string; name: string; size: number }[];
    } | null>,
  readClipboardFileChunk: (token: string, offset: number) =>
    ipcRenderer.invoke(
      "clipboard:file-chunk",
      token,
      offset,
    ) as Promise<string>,
  setReceivedFilesClipboard: (files: string[]) =>
    ipcRenderer.invoke("clipboard:received-files", files) as Promise<boolean>,
  minimizeToTray: () => ipcRenderer.invoke("window:tray") as Promise<boolean>,
  confirmCaptureReady: () =>
    ipcRenderer.invoke("capture:ready") as Promise<boolean>,
  onCaptureUnavailable: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on("capture:unavailable", listener);
    return () => {
      ipcRenderer.removeListener("capture:unavailable", listener);
    };
  },
  updater: {
    getState: () =>
      ipcRenderer.invoke("updater:getState") as Promise<UpdaterState>,
    check: () => ipcRenderer.invoke("updater:check") as Promise<UpdaterState>,
    download: () => ipcRenderer.invoke("updater:download"),
    cancel: () => ipcRenderer.invoke("updater:cancel"),
    install: () => ipcRenderer.invoke("updater:install"),
    openRelease: () => ipcRenderer.invoke("updater:openRelease"),
    onStatusChange: (callback: (s: UpdaterState) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, s: UpdaterState) =>
        callback(s);
      ipcRenderer.on("updater:statusChange", listener);
      return () => {
        ipcRenderer.removeListener("updater:statusChange", listener);
      };
    },
  },
  setSessionPending: (value: boolean) =>
    ipcRenderer.invoke("session:pending", value),
  readSessionClipboard: () =>
    ipcRenderer.invoke("session:clipboard-read") as Promise<string | null>,
  applySessionClipboard: (text: string) =>
    ipcRenderer.invoke("session:clipboard-write", text) as Promise<boolean>,
  confirmSession: (
    state: {
      callId: string;
      role: "host" | "client";
      permissions: SessionPermissions;
    } | null,
  ) => ipcRenderer.invoke("session:confirmed", state) as Promise<boolean>,
  historyList: (url: string) =>
    ipcRenderer.invoke("history:list", url) as Promise<SessionHistoryEntry[]>,
  historyWrite: (url: string, entry: SessionHistoryEntry) =>
    ipcRenderer.invoke(
      "history:write",
      url,
      entry,
    ) as Promise<SessionHistoryEntry>,
  historyClear: (url: string) =>
    ipcRenderer.invoke("history:clear", url) as Promise<boolean>,
  getSecuritySettings: () =>
    ipcRenderer.invoke("security:settings") as Promise<{
      url: string;
      enabled: boolean;
      hasPassword: boolean;
      officialUrl: string | null;
      unattendedPermissions: SessionPermissions;
    }>,
  setSignalingUrl: (url: string) =>
    ipcRenderer.invoke("security:set-url", url) as Promise<string>,
  useOfficialSignaling: () =>
    ipcRenderer.invoke("security:use-official") as Promise<string>,
  getDevicePublicKey: (url: string) =>
    ipcRenderer.invoke("security:public-key", url) as Promise<string>,
  signDeviceChallenge: (url: string, nonce: string, audience: string) =>
    ipcRenderer.invoke(
      "security:sign",
      url,
      nonce,
      audience,
    ) as Promise<string>,
  setUnattendedPermissions: (permissions: SessionPermissions) =>
    ipcRenderer.invoke(
      "security:permissions",
      permissions,
    ) as Promise<SessionPermissions>,
  setAccessPassword: (
    password: string,
    enabled: boolean,
    permissions?: SessionPermissions,
  ) =>
    ipcRenderer.invoke(
      "security:password",
      password,
      enabled,
      permissions,
    ) as Promise<{
      enabled: boolean;
      hasPassword: boolean;
    }>,
  migrateAccessPassword: (password: string, enabled: boolean) =>
    ipcRenderer.invoke(
      "security:migrate-password",
      password,
      enabled,
    ) as Promise<{ enabled: boolean; hasPassword: boolean }>,
  verifyAccessPassword: (password: string) =>
    ipcRenderer.invoke(
      "security:verify-password",
      password,
    ) as Promise<boolean>,
  resetSecurityPreferences: () =>
    ipcRenderer.invoke("security:reset-preferences") as Promise<boolean>,
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
    ipcRenderer.on(IPC_CHANNELS.CONNECTION_STATE, (_event, state) =>
      callback(state),
    ),
  onConnectRequest: (callback: (req: RemoteConnectionRequest) => void) =>
    ipcRenderer.on(IPC_CHANNELS.CONNECT_REQUEST, (_event, req) =>
      callback(req),
    ),

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
    ipcRenderer.invoke(IPC_CHANNELS.FILE_TRANSFER_REQUEST, {
      connectionId,
      filePath,
    }),
  onFileTransferProgress: (
    callback: (progress: { fileId: string; percent: number }) => void,
  ) =>
    ipcRenderer.on(IPC_CHANNELS.FILE_TRANSFER_PROGRESS, (_event, progress) =>
      callback(progress),
    ),
  onFileTransferComplete: (callback: (fileId: string) => void) =>
    ipcRenderer.on(IPC_CHANNELS.FILE_TRANSFER_COMPLETE, (_event, fileId) =>
      callback(fileId),
    ),
  saveFileToDownloads: (fileName: string, base64Data: string) =>
    ipcRenderer.invoke("file:saveToDownloads", { fileName, base64Data }),
  showItemInFolder: (filePath: string) =>
    ipcRenderer.invoke("file:showInFolder", filePath),
  openFile: (filePath: string) => ipcRenderer.invoke("file:openFile", filePath),

  // Clipboard
  setClipboard: (data: ClipboardData) =>
    ipcRenderer.send(IPC_CHANNELS.CLIPBOARD_SET, data),
  getClipboard: () => ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_GET),
  onClipboardChanged: (callback: (data: ClipboardData) => void) =>
    ipcRenderer.on(IPC_CHANNELS.CLIPBOARD_CHANGED, (_event, data) =>
      callback(data),
    ),

  // Captura de tela
  getDesktopSources: () => ipcRenderer.invoke(IPC_CHANNELS.DESKTOP_SOURCES),
  startDesktopStream: (sourceId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.DESKTOP_STREAM_START, sourceId),
  stopDesktopStream: () => ipcRenderer.invoke(IPC_CHANNELS.DESKTOP_STREAM_STOP),

  // WebRTC (sinalização e conexão peer-to-peer)
  createWebRTCOffer: (connectionId: string, sourceId: string) =>
    ipcRenderer.invoke("webrtc:createOffer", connectionId, sourceId),
  setWebRTCRemoteDescription: (
    connectionId: string,
    sdp: string,
    type: "offer" | "answer",
  ) =>
    ipcRenderer.invoke("webrtc:setRemoteDescription", connectionId, sdp, type),
  addWebRTCIceCandidate: (
    connectionId: string,
    candidate: {
      candidate: string;
      sdpMid: string | null;
      sdpMLineIndex: number | null;
      usernameFragment: string | null;
    },
  ) => ipcRenderer.invoke("webrtc:addIceCandidate", connectionId, candidate),

  // Erros
  onError: (callback: (err: AppError) => void) =>
    ipcRenderer.on(IPC_CHANNELS.ERROR_OCCURRED, (_event, err) => callback(err)),
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);

// Exporta tipos para uso no renderer
export type ElectronAPI = typeof electronAPI;

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
