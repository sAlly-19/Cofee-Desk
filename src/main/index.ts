import { assertTrusted } from "./ipcSecurity";
import { registerSignalingTransport } from "./signalingTransport";
import { registerFileClipboard } from "./fileClipboard";
import { registerTray } from "./trayManager";
import { registerUpdater } from "./updater";
import { registerSessionAuthority } from "./sessionAuthority";
import { registerHistoryHandlers } from "./historyManager";
import { app, BrowserWindow, ipcMain } from "electron";
import { createMainWindow, registerWindowIpcHandlers } from "./windowManager";
import { registerIpcHandlers } from "./ipcHandlers";
import { registerScreenIpcHandlers } from "./screenManager";
import { registerInputIpcHandlers, shutdownInputManager } from "./inputManager";
import { getOrCreateCoffeeDeskId } from "./store";
import { registerDeviceSecurity } from "./deviceSecurity";
import { IPC_CHANNELS } from "../shared/ipcChannels";

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
      win.setSkipTaskbar(false);
      win.show();
      win.focus();
    }
  });
}

app.whenReady().then(() => {
  registerDeviceSecurity();
  registerSignalingTransport();
  registerSessionAuthority();
  registerHistoryHandlers();
  // Inicializa ou recupera o Coffee-Desk ID
  getOrCreateCoffeeDeskId();
  console.log("[Coffee-Desk] Identidade local inicializada");

  // Registra handlers de janela
  registerWindowIpcHandlers();

  // Registra handlers de IPC gerais
  registerIpcHandlers();
  registerFileClipboard();

  // Registra handlers de captura de tela
  registerScreenIpcHandlers();

  // Registra handlers de controle de entrada (mouse e teclado Win32)
  registerInputIpcHandlers();

  // Cria janela principal
  const mainWindow = createMainWindow();
  registerUpdater(mainWindow);
  registerTray(mainWindow);

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
ipcMain.handle(IPC_CHANNELS.GET_MY_ID, async (event) => {
  assertTrusted(event);
  const { getOrCreateCoffeeDeskId } = await import("./store");
  return getOrCreateCoffeeDeskId().id;
});
