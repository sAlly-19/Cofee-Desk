const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");
const out = path.join(root, "artifacts/client-default-" + process.pid);
fs.mkdirSync(out, { recursive: true });
app.setPath("userData", out);
const checks = [];
function check(name, condition) {
  assert.ok(condition, name);
  checks.push(name);
  console.log("PASS " + name);
}
app.whenReady().then(async () => {
  let win;
  try {
    const official =
      require("../dist-electron/shared/publicService").OFFICIAL_SIGNALING_URL;
    assert.ok(
      official && official.startsWith("wss://"),
      "A private official configuration is required for this check",
    );
    require("../dist-electron/main/deviceSecurity").registerDeviceSecurity();
    const preload = path.join(out, "preload.js");
    fs.writeFileSync(
      preload,
      'const {contextBridge,ipcRenderer}=require("electron");contextBridge.exposeInMainWorld("settingsCheck",{read:()=>ipcRenderer.invoke("security:settings"),custom:url=>ipcRenderer.invoke("security:set-url",url),official:()=>ipcRenderer.invoke("security:use-official")});',
    );
    win = new BrowserWindow({
      show: false,
      webPreferences: {
        preload,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    // Do not execute the renderer or contact the real service. Only native settings IPC is exercised.
    win.webContents.session.webRequest.onBeforeRequest((details, callback) =>
      callback({
        cancel:
          details.url.includes("/assets/") ||
          /^(https?|wss?):/.test(details.url),
      }),
    );
    await win.loadFile(path.join(root, "dist-electron/renderer/index.html"));
    const js = (code) => win.webContents.executeJavaScript(code, true);
    const fresh = await js("window.settingsCheck.read()");
    check(
      "Fresh native profile selects official service automatically",
      fresh.url === official,
    );
    check(
      "Native settings identify official service without user input",
      fresh.officialUrl === official,
    );
    check(
      "Reading default settings creates no device identity",
      !fs.existsSync(path.join(out, "device-security-v2.json")),
    );
    await js('window.settingsCheck.custom("wss://custom.example/ws")');
    check(
      "Explicit custom server remains available",
      (await js("window.settingsCheck.read()")).url ===
        "wss://custom.example/ws",
    );
    const file = path.join(out, "device-security-v2.json");
    const state = JSON.parse(fs.readFileSync(file));
    state.identities = {
      "wss://custom.example/ws": {
        privateKey: "opaque-test-value",
        publicKey: "test-value",
      },
    };
    fs.writeFileSync(file, JSON.stringify(state));
    await js("window.settingsCheck.official()");
    const saved = JSON.parse(fs.readFileSync(file));
    check(
      "One-click official selection preserves prior identity",
      saved.url === official &&
        saved.identities["wss://custom.example/ws"].privateKey ===
          "opaque-test-value",
    );
    check(
      "Official preference is recorded as automatic",
      saved.urlSource === "default",
    );
    fs.writeFileSync(
      path.join(out, "validation.json"),
      JSON.stringify({ passed: checks.length, checks }, null, 2),
    );
    win.destroy();
    app.exit(0);
  } catch (error) {
    console.error("Client default verification failed: " + error.message);
    win?.destroy();
    app.exit(1);
  }
});
