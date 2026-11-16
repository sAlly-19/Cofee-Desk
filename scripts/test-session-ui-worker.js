const { app, BrowserWindow } = require("electron");
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict"),
  { pathToFileURL } = require("node:url");
const root = path.resolve(__dirname, ".."),
  out = path.join(root, "artifacts/session-refactor");
fs.mkdirSync(out, { recursive: true });
app.setPath("userData", path.join(out, "profile-" + process.pid));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const checks = [];
function check(name, value) {
  assert.ok(value, name);
  checks.push(name);
  console.log("PASS " + name);
}
app.whenReady().then(async () => {
  let win;
  try {
    const harness = `import React,{useRef,useState} from 'react';import {createRoot} from 'react-dom/client';import {ModalProvider} from './src/renderer/context/ModalContext';import {SourcePicker} from './src/renderer/components/session/SourcePicker';import {IncomingCallModal} from './src/renderer/components/modals/IncomingCallModal';import {RemoteToolbar} from './src/renderer/components/session/RemoteToolbar';import {HostStreamView} from './src/renderer/components/session/HostStreamView';import {useRemoteMonitors} from './src/renderer/hooks/useRemoteMonitors';
const noop=()=>{},full={control:true,clipboard:true,files:true};window.fixture={sent:[],accepted:[],actions:[],sources:[{id:'screen:1',name:'Dell P2419H',isPrimary:true},{id:'screen:2',name:'LG secundário'},{id:'window:1',name:'Editor de teste'}],source:'',kind:'screen'};const f=window.fixture;window.electronAPI={getDesktopSources:async()=>f.sources,getCaptureSelection:async()=>({sourceId:'screen:1',kind:'screen',active:true})};const channel=new EventTarget();channel.readyState='open';channel.send=raw=>f.sent.push(JSON.parse(raw));f.list=m=>channel.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({type:'monitor-list',monitors:m})}));
function Content(){const [view,setView]=useState('source'),[source,setSource]=useState(''),[seconds,setSeconds]=useState(30),[sharing,setSharing]=useState(true);f.view=setView;f.expire=()=>setSeconds(0);f.pause=()=>setSharing(false);const monitors=useRemoteMonitors(channel,'client',async()=>{});return <><div id="outside">Área externa</div><div className="fixture-stage" style={{marginLeft:240,width:'calc(100% - 240px)',position:'relative',height:'90vh'}}>{view==='source'&&<SourcePicker value={source} onChange={(id,kind)=>{f.source=id;f.kind=kind;setSource(id);}}/>}{view==='incoming'&&<IncomingCallModal incomingCall={{fromId:'123-456-789',fromName:'Teste',expiresAt:9999999999999}} countdown={seconds} onAccept={(...args)=>f.accepted.push(args)} onReject={noop}/ >}{view==='toolbar'&&<RemoteToolbar remoteId="123-456-789" permissions={full} role="client" peerState="connected" isKeyboardFocused={false} isFullscreen={false} hostControlEnabled diagnostic={{stage:'webrtc',state:'ready',code:'MEDIA_CONNECTED',stats:{latencyMs:23}}} monitors={monitors} onFocusVideo={()=>f.actions.push('focus')} onToggleFullscreen={noop} onToggleHostControl={noop} onToggleDrawer={noop} onReport={noop} onDisconnect={noop}/ >}{view==='host'&&<HostStreamView remoteId="123-456-789" isSharing={sharing} permissions={full} peerState="connected" hostControlEnabled source={{name:'Dell P2419H',kind:'screen',available:true}} localVideoRef={useRef(null)} onSwitchToRealScreen={noop} onOpenAccess={()=>f.actions.push('access')} onToggleControl={()=>f.actions.push('control')} onDisconnect={()=>f.actions.push('disconnect')}/>}</div></>};function App(){return <ModalProvider><Content/></ModalProvider>};createRoot(document.getElementById('root')).render(<App/>);`;
    // Keep hooks unconditional in the fixture too.
    const content = harness.replace(
      "localVideoRef={useRef(null)}",
      "localVideoRef={{current:null}}",
    );
    require("esbuild").buildSync({
      stdin: { contents: content, loader: "tsx", resolveDir: root },
      bundle: true,
      platform: "browser",
      outfile: path.join(out, "harness.js"),
    });
    const assets = path.join(root, "dist-electron/renderer/assets"),
      css = fs.readdirSync(assets).find((x) => x.endsWith(".css"));
    fs.writeFileSync(
      path.join(out, "index.html"),
      '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><link rel="stylesheet" href="' +
        pathToFileURL(path.join(assets, css)).href +
        '"><body style="background:#140c0a;color:#eee"><div id="root"></div><script src="harness.js"></script>',
    );
    win = new BrowserWindow({
      width: 1440,
      height: 900,
      useContentSize: true,
      frame: false,
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false,
      },
    });
    const js = (code) => win.webContents.executeJavaScript(code);
    await win.loadFile(path.join(out, "index.html"));
    await wait(200);
    const click = async (text) => {
      assert.ok(
        await js(
          '(()=>{const b=[...document.querySelectorAll("button")].find(b=>b.textContent.trim().includes(' +
            JSON.stringify(text) +
            "));if(!b)return false;b.click();return true;})()",
        ),
        "Button " + text,
      );
      await wait(80);
    };
    const shot = async (name) => {
      await js("document.fonts.ready.then(()=>true)");
      win.showInactive();
      await wait(200);
      fs.writeFileSync(
        path.join(out, name + ".png"),
        (await win.webContents.capturePage()).toPNG(),
      );
      win.hide();
    };
    check(
      "Primary source is selected from actual enumeration",
      await js('fixture.source==="screen:1"'),
    );
    check(
      "Monitor cards show real names",
      await js('document.body.textContent.includes("Dell P2419H")'),
    );
    await click("Aplicativo específico");
    check(
      "Category change clears previous source",
      await js('fixture.source===""'),
    );
    await click("Editor de teste");
    check(
      "Window choice returns actual source and kind",
      await js('fixture.source==="window:1"&&fixture.kind==="window"'),
    );
    await js('fixture.sources=fixture.sources.filter(s=>s.id!=="window:1")');
    await click("Atualizar fontes");
    check(
      "Disappearing source invalidates selection",
      await js('fixture.source===""&&!!document.querySelector("[role=alert]")'),
    );
    await js('fixture.view("incoming")');
    await wait(150);
    await click("Apenas visualização");
    check(
      "View-only disables all optional permission inputs",
      await js(
        '[...document.querySelectorAll(".permission-fields input")].every(i=>i.matches(":disabled")&&!i.checked)',
      ),
    );
    await click("Aceitar e Compartilhar");
    await click("Aceitar e Compartilhar");
    check(
      "Double accept sends a single view-only authorization",
      await js(
        'fixture.accepted.length===1&&Object.values(fixture.accepted[0][1]).every(v=>v===false)&&fixture.accepted[0][2]==="screen:1"',
      ),
    );
    await js("fixture.expire()");
    await wait(60);
    check(
      "Expired request cannot be accepted",
      await js(
        '[...document.querySelectorAll("button")].find(b=>b.textContent.includes("Aceitar e Compartilhar")).disabled&&document.body.textContent.includes("Solicitação expirada")',
      ),
    );
    await shot("incoming-view-only-expired");
    await js('fixture.view("toolbar")');
    await wait(80);
    const single = [{ id: "screen:1", name: "Monitor 1", selected: true }],
      dual = [
        ...single,
        { id: "screen:2", name: "Monitor 2 · LG", selected: false },
      ];
    await js("fixture.list(" + JSON.stringify(single) + ")");
    await wait(60);
    check(
      "Single monitor selector is completely hidden",
      await js('!document.querySelector(".toolbar-monitor")'),
    );
    await js("fixture.list(" + JSON.stringify(dual) + ")");
    await wait(60);
    check(
      "Multiple monitor selector belongs to toolbar",
      await js(
        'document.querySelectorAll(".session-toolbar .toolbar-monitor option").length===2',
      ),
    );
    await js(
      '(()=>{const s=document.querySelector(".toolbar-monitor select");s.value="screen:2";s.dispatchEvent(new Event("change",{bubbles:true}));})()',
    );
    await wait(60);
    check(
      "Monitor change sends real channel request",
      await js(
        'fixture.sent.some(m=>m.type==="monitor-switch"&&m.id==="screen:2")',
      ),
    );
    check(
      "Selection waits for host confirmation",
      await js(
        'document.querySelector(".toolbar-monitor select").disabled&&document.querySelector(".toolbar-monitor select").value==="screen:1"',
      ),
    );
    await js(
      "fixture.list(" +
        JSON.stringify(
          dual.map((x) => ({ ...x, selected: x.id === "screen:2" })),
        ) +
        ")",
    );
    await wait(60);
    check(
      "Confirmed monitor selection updates UI",
      await js(
        'document.querySelector(".toolbar-monitor select").value==="screen:2"&&!document.querySelector(".toolbar-monitor select").disabled',
      ),
    );
    await js(
      'document.querySelector("button[aria-label=\\"Detalhes da conexão\\"]").click()',
    );
    await wait(50);
    check(
      "Details show available live latency",
      await js(
        'document.querySelector(".session-details-panel").textContent.includes("23")',
      ),
    );
    await js(
      'document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}))',
    );
    await wait(50);
    check(
      "Escape closes only details popover",
      await js('!document.querySelector(".session-details-panel")'),
    );
    await js(
      'document.querySelector("button[aria-label=\\"Detalhes da conexão\\"]").click()',
    );
    await wait(40);
    await js(
      'document.querySelector("#outside").dispatchEvent(new PointerEvent("pointerdown",{bubbles:true}))',
    );
    await wait(40);
    check(
      "Click outside dismisses details",
      await js('!document.querySelector(".session-details-panel")'),
    );
    for (const width of [1672, 1440, 1024]) {
      win.setContentSize(width, 941);
      await wait(80);
      check(
        "Toolbar fits available session width at " + width,
        await js(
          'document.querySelector(".session-toolbar").scrollWidth<=document.querySelector(".session-toolbar").clientWidth',
        ),
      );
      await shot("toolbar-" + width);
    }
    await js("fixture.list(" + JSON.stringify(single) + ")");
    await wait(40);
    check(
      "Removing a display hides monitor selector",
      await js('!document.querySelector(".toolbar-monitor")'),
    );
    await js('fixture.view("host")');
    await wait(80);
    check(
      "Host panel displays real selected source without video preview",
      await js(
        'document.body.textContent.includes("Dell P2419H")&&!document.querySelector("video")',
      ),
    );
    await click("Alterar fonte compartilhada");
    await click("Pausar controle remoto");
    check(
      "Host quick actions invoke session callbacks",
      await js(
        'fixture.actions.includes("access")&&fixture.actions.includes("control")',
      ),
    );
    await shot("host-panel");
    await js("fixture.pause()");
    await wait(40);
    check(
      "Paused host offers source selection without claiming transmission",
      await js(
        'document.body.textContent.includes("Compartilhamento pausado")&&document.body.textContent.includes("Sem transmissão")',
      ),
    );
    await shot("host-paused");
    fs.writeFileSync(
      path.join(out, "validation.json"),
      JSON.stringify({ passed: checks.length, checks }, null, 2),
    );
    win.destroy();
    app.exit(0);
  } catch (e) {
    console.error(e);
    win?.destroy();
    app.exit(1);
  }
});
