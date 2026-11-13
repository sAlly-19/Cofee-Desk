// Exercises real React updater hook and modal. Network and installer actions are simulated.
const { app, BrowserWindow } = require("electron");
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict"),
  { pathToFileURL } = require("node:url");
const root = path.resolve(__dirname, ".."),
  out = path.join(root, "artifacts/update-ui");
fs.mkdirSync(out, { recursive: true });
app.setPath("userData", path.join(out, "profile"));
const checks = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function check(name, value) {
  assert.ok(value, name);
  checks.push(name);
  console.log("PASS " + name);
}
async function run() {
  const harness = `import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {useAutoUpdate} from './src/renderer/hooks/useAutoUpdate';import {UpdatePromptModal} from './src/renderer/components/modals/UpdatePromptModal';
let state={status:'idle',updateInfo:{version:'1.0.2',currentVersion:'1.0.1',releaseDate:'2026-11-13',releaseNotes:'<script>window.unsafeNotes=true</script>'},progress:null,errorMessage:null,isDev:false,isPortable:false,installBlocked:false};const listeners=new Set();const counts={check:0,download:0,cancel:0,install:0,release:0};function emit(patch){state={...state,...patch};for(const callback of listeners)callback({...state});}
window.electronAPI={updater:{getState:async()=>state,onStatusChange:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},check:async()=>{counts.check++;emit({status:'checking'});return state;},download:async()=>{counts.download++;emit({status:'downloading'});},cancel:async()=>{counts.cancel++;emit({status:'available'});},install:async()=>{counts.install++;emit({status:'installing'});},openRelease:async()=>{counts.release++;}}};window.fixture={emit,counts};
function App(){const [busy,setBusy]=useState(false);window.fixture.busy=setBusy;const u=useAutoUpdate(busy);return <><button id="manual" onClick={u.checkNow}>Verificar atualizações</button><UpdatePromptModal isOpen={u.isOpen} state={u.state} busy={busy} onClose={u.close} onCheck={u.checkNow} onDownload={u.download} onCancel={u.cancel} onInstall={u.install} onRelease={u.openRelease}/></>;};createRoot(document.getElementById('root')).render(<App/>);`;
  require("esbuild").buildSync({
    stdin: { contents: harness, loader: "tsx", resolveDir: root },
    bundle: true,
    platform: "browser",
    outfile: path.join(out, "harness.js"),
  });
  const css = fs
    .readdirSync(path.join(root, "dist-electron/renderer/assets"))
    .find((n) => n.endsWith(".css"));
  fs.writeFileSync(
    path.join(out, "index.html"),
    '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><link rel="stylesheet" href="' +
      pathToFileURL(path.join(root, "dist-electron/renderer/assets", css))
        .href +
      '"><div id="root"></div><script src="./harness.js"></script></html>',
  );
  const win = new BrowserWindow({
    show: false,
    width: 1024,
    height: 680,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  const js = (code) =>
    win.webContents.executeJavaScript(
      typeof code === "function" ? "(" + code.toString() + ")()" : code,
    );
  const until = async (expression) => {
    for (let i = 0; i < 60; i++) {
      if (await js(expression)) return true;
      await wait(40);
    }
    return false;
  };
  const click = async (text) => {
    await js(
      '([...document.querySelectorAll("button")].find(b=>b.textContent.trim()===' +
        JSON.stringify(text) +
        "))?.click()",
    );
    await wait(50);
  };
  await win.loadFile(path.join(out, "index.html"));
  await until("!!window.fixture?.busy");
  await js("window.fixture.busy(true)");
  await wait(50);
  await js('window.fixture.emit({status:"available"})');
  await wait(50);
  check(
    "Automatic update notice deferred while busy",
    await js('!document.querySelector(".modal-panel")'),
  );
  await js("window.fixture.busy(false)");
  check(
    "Deferred update opens after session ends",
    await until('!!document.querySelector(".modal-panel")'),
  );
  check(
    "Release notes render as text without script execution",
    await js(
      'document.querySelector(".update-notes").textContent.includes("<script>")&&!window.unsafeNotes',
    ),
  );
  await js('document.querySelector(".modal-close").focus()');
  win.webContents.sendInputEvent({ type: "keyDown", keyCode: "Tab" });
  win.webContents.sendInputEvent({ type: "keyUp", keyCode: "Tab" });
  await wait(40);
  check(
    "Keyboard focus remains in update dialog",
    await js(
      'document.querySelector(".modal-panel").contains(document.activeElement)',
    ),
  );
  await click("Baixar Atualização");
  check(
    "Download is explicit and exposes cancel",
    await until(
      'window.fixture.counts.download===1&&document.body.textContent.includes("Cancelar")',
    ),
  );
  await js(
    "window.fixture.emit({progress:{percent:50,transferred:1048576,total:2097152,bytesPerSecond:524288}})",
  );
  await wait(50);
  check(
    "Real progress values render",
    await js(
      'document.body.textContent.includes("50.0%")&&document.body.textContent.includes("1.0 MB de 2.0 MB")',
    ),
  );
  await click("Cancelar");
  check(
    "Cancel invokes adapter and restores available actions",
    await js(
      'window.fixture.counts.cancel===1&&document.body.textContent.includes("Lembrar mais tarde")',
    ),
  );
  await click("Lembrar mais tarde");
  await js('window.fixture.emit({status:"available"})');
  await wait(50);
  check(
    "Dismissed version stays dismissed",
    await js('!document.querySelector(".modal-panel")'),
  );
  await click("Verificar atualizações");
  check(
    "Manual check opens checking state",
    await until(
      'document.body.textContent.includes("Verificando atualizações")',
    ),
  );
  await js('window.fixture.emit({status:"downloaded",installBlocked:true})');
  await wait(50);
  check(
    "Installation disabled when main process reports busy",
    await js(
      '[...document.querySelectorAll("button")].find(b=>b.textContent==="Instalar e reiniciar").disabled',
    ),
  );
  await js("window.fixture.emit({installBlocked:false})");
  await click("Instalar e reiniciar");
  check(
    "Install action simulated only on explicit click",
    await js(
      'window.fixture.counts.install===1&&document.body.textContent.includes("Preparando instalação")',
    ),
  );
  await js(
    'window.fixture.emit({status:"error",errorMessage:"Falha simulada"})',
  );
  await wait(50);
  check(
    "Error is accessible",
    await js(
      'document.querySelector("[role=alert]").textContent==="Falha simulada"',
    ),
  );
  await click("Tentar novamente");
  check("Retry checks again", await js("window.fixture.counts.check===2"));
  await js('window.fixture.emit({status:"available",isDev:true})');
  await wait(50);
  check(
    "Development cannot request download",
    await js(
      '[...document.querySelectorAll("button")].find(b=>b.textContent==="Baixar Atualização").disabled',
    ),
  );
  for (const [width, height] of [
    [1672, 941],
    [1440, 900],
    [1024, 680],
  ]) {
    win.setContentSize(width, height);
    await wait(50);
    check(
      "Update dialog fits " + width,
      await js("document.documentElement.scrollWidth<=innerWidth"),
    );
  }
  await click("Ver no GitHub");
  check(
    "Release link uses dedicated action",
    await js("window.fixture.counts.release===1"),
  );
  fs.writeFileSync(
    path.join(out, "validation.json"),
    JSON.stringify({ passed: checks.length, checks }, null, 2),
  );
  win.destroy();
}
app
  .whenReady()
  .then(run)
  .then(() => app.exit(0))
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
