// Real React input hook with freely moving mouse. Never injects native input.
const { app, BrowserWindow } = require("electron");
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const root = path.resolve(__dirname, ".."),
  out = path.join(root, "artifacts/pointer-capture");
fs.mkdirSync(out, { recursive: true });
app.setPath("userData", path.join(out, "profile"));
const checks = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function check(name, value) {
  assert.ok(value, name);
  checks.push(name);
  console.log("PASS " + name);
}
app.whenReady().then(async () => {
  let win;
  try {
    const harness = `import React,{useRef,useState,useEffect} from 'react';import {createRoot} from 'react-dom/client';import {useRemoteInputCapture} from './src/renderer/hooks/useRemoteInputCapture';
window.fixture={messages:[],locks:0};window.electronAPI={toggleInputControl:async()=>false};const channel={readyState:'open',send:raw=>window.fixture.messages.push(JSON.parse(raw))};
function App(){const container=useRef(null),dc=useRef(channel);const [allowed,setAllowed]=useState(true);const input=useRemoteInputCapture({role:'client',allowed,dataChannelRef:dc,pointerChannelRef:dc,containerRef:container});window.fixture.input=input;window.fixture.allow=setAllowed;useEffect(()=>{const video=container.current.querySelector('video');Object.defineProperties(video,{videoWidth:{value:1000},videoHeight:{value:500}});video.getBoundingClientRect=()=>({left:100,top:100,width:400,height:400});video.requestPointerLock=async()=>{window.fixture.locks++;};},[]);return <div ref={container} tabIndex={0} onKeyDown={input.handleKeyDown} onKeyUp={input.handleKeyUp}><video onMouseMove={input.handleMouseMove} onMouseDown={input.handleMouseDown}/></div>};createRoot(document.getElementById('root')).render(<App/>);`;
    require("esbuild").buildSync({
      stdin: { contents: harness, loader: "tsx", resolveDir: root },
      bundle: true,
      platform: "browser",
      outfile: path.join(out, "harness.js"),
    });
    fs.writeFileSync(
      path.join(out, "index.html"),
      '<!doctype html><meta charset="utf-8"><div id="root"></div><script src="./harness.js"></script>',
    );
    win = new BrowserWindow({
      show: false,
      webPreferences: { contextIsolation: true, nodeIntegration: false },
    });
    const js = (code) =>
      win.webContents.executeJavaScript(
        typeof code === "function" ? "(" + code.toString() + ")()" : code,
      );
    await win.loadFile(path.join(out, "index.html"));
    await wait(150);
    await js(() => {
      const v = document.querySelector("video");
      for (let i = 0; i < 4; i++)
        v.dispatchEvent(
          new MouseEvent("mousemove", {
            bubbles: true,
            clientX: 300 + i,
            clientY: 300,
          }),
        );
    });
    await wait(80);
    check(
      "Burst of mouse events keeps final position in one frame",
      await js(
        'window.fixture.messages.filter(m=>m.type==="mouse").length===1&&window.fixture.messages.find(m=>m.type==="mouse").data.normX===.5075',
      ),
    );
    check(
      "Mouse never requests pointer lock",
      await js("window.fixture.locks===0"),
    );
    await js(() =>
      document
        .querySelector("[tabindex]")
        .dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Escape",
            code: "Escape",
            bubbles: true,
          }),
        ),
    );
    check(
      "Escape remains a remote keyboard key",
      await js(
        'window.fixture.messages.some(m=>m.type==="keyboard"&&m.data.code==="Escape")',
      ),
    );
    await js("window.fixture.allow(false)");
    await wait(40);
    const count = await js(
      'window.fixture.messages.filter(m=>m.type==="mouse").length',
    );
    await js(() =>
      document
        .querySelector("video")
        .dispatchEvent(
          new MouseEvent("mousemove", {
            bubbles: true,
            clientX: 320,
            clientY: 300,
          }),
        ),
    );
    await wait(50);
    check(
      "Revocation blocks pointer events",
      (await js(
        'window.fixture.messages.filter(m=>m.type==="mouse").length',
      )) === count,
    );
    check(
      "Revocation releases held input",
      await js('window.fixture.messages.some(m=>m.type==="release-input")'),
    );
    await js("window.fixture.allow(true)");
    await wait(40);
    const before = await js(
      'window.fixture.messages.filter(m=>m.type==="mouse").length',
    );
    await js(() => {
      document
        .querySelector("video")
        .dispatchEvent(
          new MouseEvent("mousemove", {
            bubbles: true,
            clientX: 320,
            clientY: 300,
          }),
        );
      window.dispatchEvent(new Event("blur"));
    });
    await wait(60);
    check(
      "Losing focus cancels queued movement",
      (await js(
        'window.fixture.messages.filter(m=>m.type==="mouse").length',
      )) === before,
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
