const { app, BrowserWindow } = require("electron");
const path = require("node:path"),
  fs = require("node:fs"),
  assert = require("node:assert/strict");
const root = path.resolve(__dirname, ".."),
  out = path.join(root, "artifacts/history-native-" + process.pid);
fs.mkdirSync(out, { recursive: true });
app.setPath("userData", out);
const checks = [];
function check(name, value) {
  assert.ok(value, name);
  checks.push(name);
  console.log("PASS " + name);
}
app.whenReady().then(async () => {
  let win;
  try {
    const history = require("../dist-electron/main/historyManager");
    history.registerHistoryHandlers();
    const { assertTrusted } = require("../dist-electron/main/ipcSecurity");
    assert.throws(() =>
      assertTrusted({
        senderFrame: { url: "https://invalid.example" },
        sender: { mainFrame: {} },
      }),
    );
    check("Subframe IPC rejected", true);
    const frame = { url: "https://invalid.example" };
    assert.throws(() =>
      assertTrusted({ senderFrame: frame, sender: { mainFrame: frame } }),
    );
    check("External main frame IPC rejected", true);
    win = new BrowserWindow({
      show: false,
      webPreferences: {
        preload: path.join(root, "dist-electron/main/preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        partition: "history-" + process.pid,
      },
    });
    win.webContents.session.webRequest.onBeforeRequest(
      { urls: ["file:///*"] },
      (details, callback) => callback({ cancel: /\.js$/.test(details.url) }),
    );
    await win.loadFile(path.join(root, "dist-electron/renderer/index.html"));
    const run = (code) => win.webContents.executeJavaScript(code);
    check(
      "Invalid history arguments rejected",
      await run(
        'window.electronAPI.historyWrite("wss://one.example/ws",{id:"bad"}).then(()=>false,()=>true)',
      ),
    );
    await run(
      `(async()=>{for(let i=0;i<1005;i++)await window.electronAPI.historyWrite('wss://one.example/ws',{id:'attempt-'+i,remoteId:'111-222-333',name:'Fixture',direction:'outgoing',result:i%2?'rejected':'cancelled',startedAt:new Date().toISOString()});})()`,
    );
    check(
      "History capped at 1000 entries",
      await run(
        'window.electronAPI.historyList("wss://one.example/ws").then(x=>x.length===1000&&x[0].id==="attempt-1004"&&x[999].id==="attempt-5")',
      ),
    );
    check(
      "Another server starts with empty history",
      await run(
        'window.electronAPI.historyList("wss://two.example/ws").then(x=>x.length===0)',
      ),
    );
    await run(
      'window.electronAPI.historyWrite("wss://two.example/ws",{id:"legacy",remoteId:"333-222-111",name:"Older device",direction:"incoming",result:"legacy",startedAt:null})',
    );
    check(
      "Legacy entries keep unknown date and duration",
      await run(
        'window.electronAPI.historyList("wss://two.example/ws").then(x=>x[0].startedAt===null&&!x[0].endedAt&&!x[0].acceptedAt)',
      ),
    );
    await run('window.electronAPI.historyClear("wss://one.example/ws")');
    check(
      "Clear is scoped to one server",
      await run(
        'Promise.all([window.electronAPI.historyList("wss://one.example/ws"),window.electronAPI.historyList("wss://two.example/ws")]).then(([a,b])=>a.length===0&&b.length===1)',
      ),
    );
    await win.reload();
    await new Promise((r) => win.webContents.once("did-finish-load", r));
    check(
      "History survives renderer restart",
      await run(
        'window.electronAPI.historyList("wss://two.example/ws").then(x=>x.length===1)',
      ),
    );
    const fresh = path.join(out, "interrupted");
    fs.mkdirSync(fresh);
    fs.writeFileSync(
      path.join(fresh, "session-history.json"),
      JSON.stringify({
        servers: {
          "wss://fixture.example/ws": [
            {
              id: "active",
              remoteId: "111-222-333",
              name: "Fixture",
              direction: "outgoing",
              result: "active",
              startedAt: new Date().toISOString(),
              acceptedAt: new Date().toISOString(),
            },
          ],
        },
      }),
    );
    const recovered = history.historyStore(fresh).get("servers")[
      "wss://fixture.example/ws"
    ][0];
    check(
      "Interrupted session recovered without inventing end time",
      recovered.result === "completed" &&
        recovered.reason === "APP_INTERRUPTED" &&
        !recovered.endedAt,
    );
    fs.writeFileSync(
      path.join(out, "validation.json"),
      JSON.stringify({ passed: checks.length, checks }, null, 2),
    );
    win.destroy();
    app.exit(0);
  } catch (error) {
    console.error(error);
    win?.destroy();
    app.exit(1);
  }
});
