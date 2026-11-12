import { app, BrowserWindow, ipcMain } from "electron";
import { createMainWindow, registerWindowIpcHandlers } from "./windowManager";
import { registerIpcHandlers } from "./ipcHandlers";
import { registerConnectionIpcHandlers } from "./connectionManager";
import { registerScreenIpcHandlers } from "./screenManager";
import { registerWebRTCElectronHandlers } from "./webrtcManager";
import { registerInputIpcHandlers, shutdownInputManager } from "./inputManager";
import { getOrCreateCoffeeDeskId } from "./store";
import { registerDeviceSecurity } from "./deviceSecurity";
import { IPC_CHANNELS } from "../shared/ipcChannels";
import type { CoffeeDeskId, SessionInfo } from "../shared/types";

// Handle Windows Squirrel startup event
try {
  if (require("electron-squirrel-startup")) {
    app.quit();
  }
} catch {
  // Ignora se não estiver instalado ou em ambiente não-Squirrel
}

app.setName("Coffee-Desk");
app.setAppUserModelId("com.coffeedesk.app");

// Habilita permissão e aceleração de captura de tela no Electron/Chromium
app.commandLine.appendSwitch("enable-usermedia-screen-capturing");
app.commandLine.appendSwitch(
  "auto-select-desktop-capture-source",
  "Entire screen",
);

// Evita múltiplas instâncias
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (BrowserWindow.getAllWindows().length > 0) {
      const win = BrowserWindow.getAllWindows()[0];
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

app.whenReady().then(() => {
  registerDeviceSecurity();
  // Inicializa ou recupera o Coffee-Desk ID
  const coffeeDeskId: CoffeeDeskId = getOrCreateCoffeeDeskId();
  console.log(`[Coffee-Desk] ID da instância: ${coffeeDeskId.id}`);

  // Registra handlers de janela
  registerWindowIpcHandlers();

  // Registra handlers de IPC gerais
  registerIpcHandlers();

  // Registra handlers de conexão remota
  registerConnectionIpcHandlers();

  // Registra handlers de captura de tela
  registerScreenIpcHandlers();

  // Registra handlers WebRTC
  registerWebRTCElectronHandlers();

  // Registra handlers de controle de entrada (mouse e teclado Win32)
  registerInputIpcHandlers();

  // Cria janela principal
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  shutdownInputManager();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// IPC: Retorna o Coffee-Desk ID da instância local
ipcMain.handle(IPC_CHANNELS.GET_MY_ID, async () => {
  const { getOrCreateCoffeeDeskId } = await import("./store");
  return getOrCreateCoffeeDeskId().id;
});

// IPC: Retorna informações da sessão atual
ipcMain.handle(
  IPC_CHANNELS.GET_SESSION_INFO,
  async (): Promise<SessionInfo> => {
    const { store } = await import("./store");
    return {
      myId: store.get("coffeeDeskId").id,
      isConnected: false,
      remoteId: store.get("session.remoteId") ?? null,
      connectionId: null,
      connectedAt: null,
    };
  },
);
