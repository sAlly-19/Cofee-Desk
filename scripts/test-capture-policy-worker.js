// Hidden fixture, production policy and default Electron session; never saves screen content.
const { app, BrowserWindow, session } = require("electron"),
  fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict"),
  crypto = require("node:crypto");
const out = path.resolve("artifacts/capture-policy");
fs.mkdirSync(out, { recursive: true });
app.setPath("userData", path.join(out, "profile"));
app.whenReady().then(async () => {
  let win;
  try {
    const auth = require("../dist-electron/main/sessionAuthority");
    require("../dist-electron/main/screenManager").registerScreenIpcHandlers();
    win = new BrowserWindow({
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    session.defaultSession.webRequest.onBeforeRequest(
      { urls: ["file:///*"] },
      (details, done) => done({ cancel: /\.js$/.test(details.url) }),
    );
    await win.loadFile(path.resolve("dist-electron/renderer/index.html"));
    const js = (code) => win.webContents.executeJavaScript(code);
    const check = (name, ok) => {
      assert.ok(ok, name);
      console.log("PASS " + name);
    };
    check(
      "Production renderer has an explicit CSP",
      await js(
        '!!document.querySelector("meta[http-equiv=Content-Security-Policy]")',
      ),
    );
    await js(
      'window.fixtureExecuted=false;const script=document.createElement("script");script.textContent="window.fixtureExecuted=true";document.head.append(script)',
    );
    check(
      "Production CSP blocks injected inline script",
      await js("window.fixtureExecuted===false"),
    );
    check(
      "Production renderer cannot access Node require",
      await js('typeof require === "undefined"'),
    );
    check(
      "Production CSP blocks arbitrary fetch",
      await js('fetch("https://fixture.invalid").then(()=>false,()=>true)'),
    );
    auth.setNativeSession(win.webContents.id, {
      callId: crypto.randomUUID(),
      role: "host",
      permissions: { control: false, clipboard: false, files: false },
    });
    const screen = require("../dist-electron/main/screenManager");
    const sources = await screen.getDesktopSources();
    const source =
      sources.find((s) => s.isPrimary) ||
      sources.find((s) => s.id.startsWith("screen:"));
    assert.ok(source, "A physical display is needed for capture policy check");
    await screen.selectDesktopSource(win.webContents.id, source.id);
    check(
      "Hardened default permission policy still permits authorized display capture",
      await js(
        "(async()=>{const stream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false});const ok=stream.getVideoTracks().length===1;stream.getTracks().forEach(t=>t.stop());return ok})()",
      ),
    );
    auth.setNativeSession(win.webContents.id);
    win.destroy();
    app.exit(0);
  } catch (error) {
    console.error(error);
    win?.destroy();
    app.exit(1);
  }
});
