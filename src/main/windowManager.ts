import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { IPC_CHANNELS } from "../shared/ipcChannels";

let mainWindow: BrowserWindow | null = null;
let sessionWindow: BrowserWindow | null = null;

export function createMainWindow(): BrowserWindow {
  if (mainWindow) {
    mainWindow.focus();
    return mainWindow;
  }

  const isDev = !app.isPackaged || process.env.NODE_ENV === "development";

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    frame: false,
    backgroundColor: "#140C0A",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      backgroundThrottling: false,
      nodeIntegration: false,
      devTools: isDev,
    },
    icon: app.isPackaged
      ? path.join(__dirname, "../renderer/icon.png")
      : path.join(__dirname, "../../assets/icon.png"),
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, target) => {
    if (target !== mainWindow?.webContents.getURL()) event.preventDefault();
  });
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Carrega o renderer em dev ou produção
  if (isDev && process.env.COFFEE_TEST_LOCAL_SIGNALING !== "1") {
    mainWindow.loadURL("http://localhost:5173").catch(() => {
      mainWindow?.loadFile(path.join(__dirname, "../renderer/index.html"));
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  return mainWindow;
}

export function createSessionWindow(remoteId: string): BrowserWindow {
  if (sessionWindow) {
    sessionWindow.focus();
    return sessionWindow;
  }

  sessionWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    title: `Coffee-Desk - Sessão com ${remoteId}`,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  sessionWindow.on("closed", () => {
    sessionWindow = null;
  });

  if (process.env.NODE_ENV === "development") {
    sessionWindow.loadURL(`http://localhost:5173/session?remote=${remoteId}`);
  } else {
    sessionWindow.loadFile(path.join(__dirname, "../renderer/index.html"), {
      hash: `session?remote=${remoteId}`,
    });
  }

  return sessionWindow;
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export function getSessionWindow(): BrowserWindow | null {
  return sessionWindow;
}

export function closeSessionWindow(): void {
  if (sessionWindow) {
    sessionWindow.close();
    sessionWindow = null;
  }
}

/**
 * Registra handlers de IPC relacionados a janelas.
 */
export function registerWindowIpcHandlers(): void {
  ipcMain.on(IPC_CHANNELS.WINDOW_MINIMIZE, () => {
    mainWindow?.minimize();
  });

  ipcMain.on(IPC_CHANNELS.WINDOW_MAXIMIZE, () => {
    if (mainWindow?.isMaximized()) {
      mainWindow?.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.on(IPC_CHANNELS.WINDOW_CLOSE, () => {
    mainWindow?.close();
  });
}
