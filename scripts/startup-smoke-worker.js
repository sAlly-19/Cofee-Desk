// Exercise the actual main entrypoint, including every production IPC registrar.
const { app, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const output = path.resolve(__dirname, "../artifacts/startup-smoke");
fs.mkdirSync(output, { recursive: true });
app.setPath("userData", path.join(output, "profile"));
const errors = [];
let completed = false;
function finish(passed, details = {}) {
  if (completed) return;
  completed = true;
  clearTimeout(timeout);
  fs.writeFileSync(
    path.join(output, "result.json"),
    JSON.stringify({ passed, errors, ...details }, null, 2),
  );
  console.log(
    passed
      ? "PASS Production main startup and input IPC"
      : "FAIL Production main startup and input IPC",
    details,
  );
  require("../dist-electron/main/inputManager").shutdownInputManager();
  app.exit(passed ? 0 : 1);
}
process.on("unhandledRejection", (error) => {
  errors.push(String(error));
  finish(false);
});
process.on("uncaughtException", (error) => {
  errors.push(String(error));
  finish(false);
});
const timeout = setTimeout(
  () =>
    finish(false, {
      reason: "Main window did not finish loading within 20 seconds",
    }),
  20000,
);
app.once("browser-window-created", (_event, win) => {
  win.webContents.once("did-finish-load", async () => {
    try {
      const listeners = {
        mouse: ipcMain.listenerCount("remote:input:mouse"),
        keyboard: ipcMain.listenerCount("remote:input:keyboard"),
      };
      const state = await win.webContents.executeJavaScript(`(async () => {
        const api = window.electronAPI;
        await api.toggleInputControl(false);
        const paused = await api.getInputControlStatus();
        await api.toggleInputControl(true);
        const resumed = await api.getInputControlStatus();
        return { paused: paused.enabled, resumed: resumed.enabled, rendered: !!document.querySelector('.app-shell') };
      })()`);
      await win.webContents.executeJavaScript(
        "window.electronAPI.minimizeToTray()",
      );
      state.trayHidden = !win.isVisible() && !win.isDestroyed();
      await win.webContents.executeJavaScript(
        "window.electronAPI.notifyIncomingCall()",
      );
      state.incomingRevealsHost = win.isVisible();
      app.emit("second-instance");
      state.trayRestored = win.isVisible();
      finish(
        state.trayHidden &&
          state.incomingRevealsHost &&
          state.trayRestored &&
          listeners.mouse === 1 &&
          listeners.keyboard === 1 &&
          state.paused === false &&
          state.resumed === false &&
          state.rendered &&
          errors.length === 0,
        { listeners, state },
      );
    } catch (error) {
      errors.push(String(error));
      finish(false);
    }
  });
});
require("../dist-electron/main/index");
