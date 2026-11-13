// Real React hook, simulated browser pointer lock. Never injects native mouse input.
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
let locked=null;Object.defineProperty(document,'pointerLockElement',{configurable:true,get:()=>locked});document.exitPointerLock=()=>{locked=null;document.dispatchEvent(new Event('pointerlockchange'));};window.fixture={messages:[],fail:false};window.electronAPI={toggleInputControl:async()=>false};const channel={readyState:'open',send:raw=>window.fixture.messages.push(JSON.parse(raw))};
function App(){const container=useRef(null),dc=useRef(channel);const [allowed,setAllowed]=useState(true);const input=useRemoteInputCapture({role:'client',allowed,dataChannelRef:dc,pointerChannelRef:dc,containerRef:container});window.fixture.input=input;window.fixture.allow=setAllowed;useEffect(()=>{const video=container.current.querySelector('video');Object.defineProperties(video,{videoWidth:{value:1000},videoHeight:{value:500}});video.getBoundingClientRect=()=>({left:100,top:100,width:400,height:400});video.requestPointerLock=async()=>{if(window.fixture.fail)throw Error('Simulated refusal');locked=video;document.dispatchEvent(new Event('pointerlockchange'));};},[]);return <div ref={container} tabIndex={0} onKeyDown={input.handleKeyDown} onKeyUp={input.handleKeyUp}><video onMouseMove={input.handleMouseMove} onMouseDown={input.handleMouseDown}/><span id="state">{input.mouseCaptured?'captured':'free'}</span><span id="error">{input.captureError}</span></div>};createRoot(document.getElementById('root')).render(<App/>);`;
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
    await js("window.fixture.input.toggleMouseCapture()");
    await wait(40);
    check(
      "Capture state follows browser pointer lock",
      await js('document.querySelector("#state").textContent==="captured"'),
    );
    await js(() => {
      const e = new MouseEvent("mousemove", { bubbles: true });
      Object.defineProperties(e, {
        movementX: { value: 40 },
        movementY: { value: 20 },
      });
      document.querySelector("video").dispatchEvent(e);
    });
    await wait(80);
    check(
      "Relative movement compensates video bars and scale",
      await js(
        'Math.abs(window.fixture.messages.filter(m=>m.type==="mouse").at(-1).data.normX-.6075)<.0001&&Math.abs(window.fixture.messages.filter(m=>m.type==="mouse").at(-1).data.normY-.6)<.0001',
      ),
    );
    await js(() =>
      document.querySelector("[tabindex]").dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          code: "Escape",
          bubbles: true,
        }),
      ),
    );
    await wait(40);
    check(
      "Escape releases mouse capture",
      await js(
        'document.pointerLockElement===null&&document.querySelector("#state").textContent==="free"',
      ),
    );
    check(
      "Capture release requests remote key/button cleanup",
      await js('window.fixture.messages.some(m=>m.type==="release-input")'),
    );
    check(
      "Local Escape is not sent as remote key down",
      await js(
        '!window.fixture.messages.some(m=>m.type==="keyboard"&&m.data.type==="down"&&m.data.code==="Escape")',
      ),
    );
    await js("window.fixture.input.toggleMouseCapture()");
    await wait(40);
    await js("window.fixture.allow(false)");
    await wait(40);
    check(
      "Revoked permission releases capture",
      await js("document.pointerLockElement===null"),
    );
    const count = await js(
      'window.fixture.messages.filter(m=>m.type==="mouse").length',
    );
    await js(() =>
      document.querySelector("video").dispatchEvent(
        new MouseEvent("mousemove", {
          bubbles: true,
          clientX: 320,
          clientY: 300,
        }),
      ),
    );
    await wait(50);
    check(
      "Revoked mouse cannot send pointer events",
      (await js(
        'window.fixture.messages.filter(m=>m.type==="mouse").length',
      )) === count,
    );
    await js("window.fixture.allow(true)");
    await wait(40);
    await js(
      "window.fixture.fail=true;window.fixture.input.toggleMouseCapture()",
    );
    await wait(40);
    check(
      "Browser capture refusal has feedback",
      await js(
        'document.querySelector("#error").textContent.includes("não permitiu")',
      ),
    );
    const beforeBlur = await js(
      'window.fixture.messages.filter(m=>m.type==="mouse").length',
    );
    await js(
      "window.fixture.fail=false;window.fixture.input.toggleMouseCapture()",
    );
    await wait(40);
    await js(() => {
      const e = new MouseEvent("mousemove", { bubbles: true });
      Object.defineProperties(e, {
        movementX: { value: 10 },
        movementY: { value: 10 },
      });
      document.querySelector("video").dispatchEvent(e);
      window.dispatchEvent(new Event("blur"));
    });
    await wait(60);
    check(
      "Losing focus cancels queued movement and releases capture",
      (await js(
        'window.fixture.messages.filter(m=>m.type==="mouse").length',
      )) === beforeBlur && (await js("document.pointerLockElement===null")),
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
