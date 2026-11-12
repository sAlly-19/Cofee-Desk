import { autoUpdater, CancellationToken } from "electron-updater";
import { app, ipcMain, shell, type BrowserWindow } from "electron";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { UpdateManager, UPDATE_REPO, shouldCheckUpdate } from "./updaterCore";
import { assertTrusted } from "./ipcSecurity";
import { isNativeBusy, setInstalling } from "./sessionAuthority";
export function registerUpdater(window: BrowserWindow) {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  const stampFile = path.join(
    app.getPath("userData"),
    "last-update-check.json",
  );
  let lastCheck = 0;
  try {
    lastCheck =
      Number(JSON.parse(fs.readFileSync(stampFile, "utf8")).lastCheck) || 0;
  } catch {
    /* First launch. */
  }
  const manager = new UpdateManager({
    version: app.getVersion(),
    arch: process.arch,
    isDev: !app.isPackaged || process.env.NODE_ENV === "development",
    isPortable: !!(
      process.env.PORTABLE_EXECUTABLE_DIR ||
      process.env.PORTABLE_EXECUTABLE_FILE
    ),
    directory: path.join(app.getPath("userData"), "updates"),
    busy: isNativeBusy,
    adapter: autoUpdater,
    token: () => new CancellationToken(),
    broadcast: (state) => {
      setInstalling(state.status === "installing");
      if (!window.isDestroyed())
        window.webContents.send("updater:statusChange", state);
    },
    launch: async (file) => {
      await new Promise<void>((resolve, reject) => {
        const child = spawn(file, ["--updated"], {
          detached: true,
          stdio: "ignore",
          windowsHide: true,
        });
        child.once("error", reject);
        child.once("spawn", () => {
          child.unref();
          resolve();
        });
      });
      app.quit();
    },
  });
  const progress = (value: any) => manager.nativeProgress(value);
  const error = () => {
    /* Core owns safe error state and fallback; never log transport payloads. */
  };
  autoUpdater.on("download-progress", progress);
  autoUpdater.on("error", error);
  const check = async () => {
    const state = await manager.check();
    if (state.status !== "error") {
      lastCheck = Date.now();
      fs.writeFileSync(stampFile, JSON.stringify({ lastCheck }));
    }
    return state;
  };
  const handlers: Record<string, () => unknown> = {
    "updater:getState": () => manager.getState(),
    "updater:check": check,
    "updater:download": () => manager.startDownload(),
    "updater:cancel": () => manager.cancelDownload(),
    "updater:install": () => manager.installAndRestart(),
    "updater:openRelease": () =>
      shell.openExternal("https://github.com/" + UPDATE_REPO + "/releases"),
  };
  for (const [channel, run] of Object.entries(handlers))
    ipcMain.handle(channel, (event) => {
      assertTrusted(event);
      return run();
    });
  const timer = setTimeout(() => {
    if (
      shouldCheckUpdate(lastCheck) &&
      process.env.COFFEE_TEST_LOCAL_SIGNALING !== "1"
    )
      void check();
  }, 3000);
  window.once("closed", () => {
    clearTimeout(timer);
    manager.cancelDownload();
    autoUpdater.removeListener("download-progress", progress);
    autoUpdater.removeListener("error", error);
    for (const channel of Object.keys(handlers)) ipcMain.removeHandler(channel);
  });
  return manager;
}
