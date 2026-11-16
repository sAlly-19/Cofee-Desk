const { app, BrowserWindow, clipboard } = require("electron");
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const root = path.resolve(__dirname, ".."),
  out = path.join(root, "artifacts/device-clipboard-" + process.pid);
fs.mkdirSync(out, { recursive: true });
app.setPath("userData", out);
let exitCode = 0;
const checks = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function check(name, value) {
  assert.ok(value, name);
  checks.push(name);
  console.log("PASS " + name);
}
app.whenReady().then(async () => {
  let win;
  const original = await clipboard.readText(),
    write = clipboard.writeText,
    read = clipboard.readText;
  try {
    require("../dist-electron/main/deviceClipboard").registerDeviceClipboard();
    win = new BrowserWindow({
      show: false,
      width: 760,
      height: 720,
      webPreferences: {
        preload: path.join(root, "dist-electron/main/preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        partition: "device-copy-" + process.pid,
      },
    });
    win.webContents.session.webRequest.onBeforeRequest(
      { urls: ["file:///*"] },
      (d, cb) => cb({ cancel: /\.js$/.test(d.url) }),
    );
    await win.loadFile(path.join(root, "dist-electron/renderer/index.html"));
    const js = (s) => win.webContents.executeJavaScript(s);
    check(
      "Native ID copy succeeds without focused browser",
      (await js('window.electronAPI.copyDeviceId("123-456-789")')) &&
        (await clipboard.readText()) === "123-456-789",
    );
    await js(
      'navigator.clipboard.writeText=async()=>{throw Error("Browser clipboard unavailable")};true',
    );
    check(
      "Browser clipboard refusal cannot prevent native copy",
      (await js('window.electronAPI.copyDeviceId("987-654-321")')) &&
        (await clipboard.readText()) === "987-654-321",
    );
    check(
      "Raw ID is preserved exactly",
      (await js('window.electronAPI.copyDeviceId("123456789")')) &&
        (await clipboard.readText()) === "123456789",
    );
    check(
      "Arbitrary text and malformed IDs are rejected",
      await js(
        '(async()=>{for(const x of [null,{},123,"arbitrary text","123-456-789x","123456789\\n"])if(!await window.electronAPI.copyDeviceId(x).then(()=>false,()=>true))return false;return true;})()',
      ),
    );
    clipboard.writeText = () => {
      throw Error("Simulated OS refusal");
    };
    check(
      "OS write failure rejects acknowledgment",
      await js(
        'window.electronAPI.copyDeviceId("123-456-789").then(()=>false,()=>true)',
      ),
    );
    clipboard.writeText = write;
    clipboard.readText = () => "";
    check(
      "Unconfirmed OS write never reports success",
      await js(
        'window.electronAPI.copyDeviceId("123-456-789").then(()=>false,()=>true)',
      ),
    );
    clipboard.readText = read;
    const bundle = require("esbuild").buildSync({
      stdin: {
        contents:
          'import React from "react";import {createRoot} from "react-dom/client";import {ClipboardSync} from "./src/renderer/components/ClipboardSync";window.actions=[];const m={local:"Texto local",remote:"Texto remoto",automatic:true,error:"",allowed:true,canSend:true,setLocal:()=>{},setAutomatic:v=>window.actions.push(["auto",v]),read:()=>window.actions.push(["read"]),send:()=>window.actions.push(["send"]),apply:()=>window.actions.push(["apply"])};createRoot(document.getElementById("root")).render(<ClipboardSync model={m}/>);',
        loader: "tsx",
        resolveDir: root,
      },
      bundle: true,
      platform: "browser",
      write: false,
    }).outputFiles[0].text;
    await js(bundle);
    await wait(100);
    check(
      "Synchronization switch is labelled and keyboard focusable",
      await js(
        '(()=>{const i=document.querySelector("input[role=switch]");return i&&i.checked&&i.labels[0].textContent.includes("Sincronizar automaticamente")&&getComputedStyle(i).appearance==="none";})()',
      ),
    );
    await js(
      'document.querySelector("input[role=switch]").click();[...document.querySelectorAll(".clipboard-action")].forEach(b=>b.click());true',
    );
    await wait(30);
    check(
      "Styled buttons and switch preserve their callbacks",
      await js(
        '["auto","read","send","apply"].every(k=>window.actions.some(a=>a[0]===k))',
      ),
    );
    check(
      "Clipboard action hit targets are at least 42px",
      await js(
        '[...document.querySelectorAll(".clipboard-action")].every(b=>b.getBoundingClientRect().height>=42)',
      ),
    );
    fs.writeFileSync(
      path.join(out, "validation.json"),
      JSON.stringify({ passed: checks.length, checks }, null, 2),
    );
    win.destroy();
  } catch (e) {
    console.error(e);
    win?.destroy();
    exitCode = 1;
  } finally {
    clipboard.writeText = write;
    clipboard.readText = read;
    await clipboard.writeText(original);
  }
  app.exit(exitCode);
});
