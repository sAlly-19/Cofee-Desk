import type { UpdaterState } from "../shared/updater";
import type {
  SessionPermissions,
  SessionHistoryEntry,
} from "../shared/session";
import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS } from "../shared/ipcChannels";
import type {
  MouseEventData,
  KeyboardEventData,
  AppError,
} from "../shared/types";

// Permite que o renderer invoque o main de forma tipada e segura
const electronAPI = {
  signaling: {
    open: (token: string) =>
      ipcRenderer.invoke("signaling:open", token) as Promise<boolean>,
    send: (token: string, packet: unknown) =>
      ipcRenderer.invoke("signaling:send", token, packet) as Promise<boolean>,
    close: (token: string) =>
      ipcRenderer.invoke("signaling:close", token) as Promise<boolean>,
    onEvent: (
      callback: (event: {
        connection: string;
        kind: string;
        message?: unknown;
        code?: number;
      }) => void,
    ) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        value: Parameters<typeof callback>[0],
      ) => callback(value);
      ipcRenderer.on("signaling:event", listener);
      return () => ipcRenderer.removeListener("signaling:event", listener);
    },
  },
  setMouseMode: (mode: "virtual" | "shared") =>
    ipcRenderer.invoke("remote:mouse-mode", mode) as Promise<
      "virtual" | "shared"
    >,
  releaseRemoteInput: () =>
    ipcRenderer.invoke("remote:input:release") as Promise<boolean>,
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
  ) => (state === null ? ipcRenderer.invoke("signaling:end-call") : ipcRenderer.invoke("session:confirmed", state)) as Promise<boolean>,
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

  // Controle remoto de mouse e teclado (via WebRTC data channel)
  sendMouseEvent: (data: MouseEventData) =>
    ipcRenderer.send(IPC_CHANNELS.REMOTE_INPUT_MOUSE, data),
  sendKeyEvent: (data: KeyboardEventData) =>
    ipcRenderer.send(IPC_CHANNELS.REMOTE_INPUT_KEYBOARD, data),
  toggleInputControl: (enabled?: boolean) =>
    ipcRenderer.invoke(IPC_CHANNELS.REMOTE_CONTROL_TOGGLE, enabled),
  onInputControlStatus: (callback: (state: {enabled:boolean;ready:boolean;code?:string}) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: Parameters<typeof callback>[0]) => callback(state);
    ipcRenderer.on("remote:control-state", listener);
    return () => ipcRenderer.removeListener("remote:control-state", listener);
  },
  getInputControlStatus: () =>
    ipcRenderer.invoke(IPC_CHANNELS.REMOTE_CONTROL_STATUS),

  // Arquivos recebidos: APIs específicas e autorizadas.
  saveFileToDownloads: (fileName: string, base64Data: string) =>
    ipcRenderer.invoke("file:saveToDownloads", { fileName, base64Data }),
  showItemInFolder: (filePath: string) =>
    ipcRenderer.invoke("file:showInFolder", filePath),
  openFile: (filePath: string) => ipcRenderer.invoke("file:openFile", filePath),

  copyDeviceId: (id: string) =>
    ipcRenderer.invoke("device:copy-id", id) as Promise<boolean>,

  // Captura de tela
  getDesktopSources: () => ipcRenderer.invoke(IPC_CHANNELS.DESKTOP_SOURCES),
  startDesktopStream: (sourceId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.DESKTOP_STREAM_START, sourceId),
  stopDesktopStream: () => ipcRenderer.invoke(IPC_CHANNELS.DESKTOP_STREAM_STOP),

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
