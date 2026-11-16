// Public documentation images: isolated real components, synthetic data, no desktop capture or services.
const { app, BrowserWindow } = require("electron");
const fs = require("node:fs"),
  path = require("node:path"),
  { pathToFileURL } = require("node:url");
const root = path.resolve(__dirname, ".."),
  work = path.join(root, "artifacts/readme-safe-" + process.pid),
  out = path.join(root, "docs/images");
fs.mkdirSync(work, { recursive: true });
fs.mkdirSync(out, { recursive: true });
app.setPath("userData", path.join(work, "profile"));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
app.whenReady().then(async () => {
  let win;
  try {
    const harness = `import React,{useRef,useState} from 'react';import {createRoot} from 'react-dom/client';import {ModalProvider} from './src/renderer/context/ModalContext';import {Sidebar} from './src/renderer/components/dashboard/Sidebar';import {TitleBar} from './src/renderer/components/dashboard/TitleBar';import {DashboardHome} from './src/renderer/components/dashboard/DashboardHome';import {IncomingCallModal} from './src/renderer/components/modals/IncomingCallModal';import {RemoteToolbar} from './src/renderer/components/session/RemoteToolbar';import {HostStreamView} from './src/renderer/components/session/HostStreamView';import {ClipboardSync} from './src/renderer/components/ClipboardSync';
const noop=()=>{},permissions={control:true,clipboard:true,files:true};window.electronAPI={getDesktopSources:async()=>[{id:'screen:demo',name:'Monitor de demonstração',isPrimary:true,thumbnail:'',displayId:'demo'}],minimizeToTray:async()=>true};
function Demo(){const [view,setView]=useState('home'),remote=useRef(null),recent=useRef(null);window.demoView=setView;const session=view==='host'||view==='clipboard';return <div className="app-shell"><TitleBar serverStatus="connected" onMinimize={noop} onMaximize={noop} onClose={noop}/><Sidebar activeNav="remote" serverStatus="connected" myId="123-456-789" onNavClick={noop} sessionActive={session}/><main className={'app-main '+(!session?'is-home':'')}>
{!session?<DashboardHome remoteSectionRef={remote} recentSectionRef={recent} remoteId="" setRemoteId={noop} connectionStatus="idle" serverStatus="connected" connectionError={null} onConnect={noop} onCancelCall={noop} myId="123-456-789" isCopied={false} onCopyId={noop} onOpenSettings={noop} recentSessions={[]} onConnectSession={noop} onOpenOptions={noop} onViewAll={noop}/>:<div className="session-stage" style={{marginTop:56,flex:1,minHeight:0,position:'relative',display:'flex',flexDirection:'column'}}><RemoteToolbar remoteId="987-654-321" permissions={permissions} role="host" peerState="connected" isKeyboardFocused={false} isFullscreen={false} hostControlEnabled diagnostic={{stage:'webrtc',state:'ready',code:'MEDIA_CONNECTED'}} onFocusVideo={noop} onOpenAccess={noop} onToggleFullscreen={noop} onToggleHostControl={noop} onToggleDrawer={noop} onDisconnect={noop}/><div className="session-surface-host" style={{flex:1,display:'flex',overflow:'auto'}}><HostStreamView remoteId="987-654-321" isSharing permissions={permissions} peerState="connected" hostControlEnabled source={{name:'Monitor de demonstração',kind:'screen',available:true}} localVideoRef={{current:null}} onSwitchToRealScreen={noop} onOpenAccess={noop} onToggleControl={noop} onDisconnect={noop}/></div>{view==='clipboard'&&<aside className="session-drawer" style={{position:'absolute',right:0,bottom:0,width:440,maxWidth:'90%',overflow:'auto',padding:24,zIndex:40}}><ClipboardSync model={{local:'Olá! Este é um texto de demonstração.',remote:'Mensagem demonstrativa do outro computador.',automatic:true,error:'',allowed:true,canSend:true,setLocal:noop,setAutomatic:noop,read:async()=>{},send:noop,apply:async()=>{}}}/></aside>}</div>}
</main>{view==='incoming'&&<IncomingCallModal incomingCall={{fromId:'987-654-321',fromName:'Computador de demonstração',expiresAt:9999999999999}} countdown={30} onAccept={noop} onReject={noop}/>}<div style={{position:'fixed',left:16,bottom:8,zIndex:999999,font:'10px Inter,sans-serif',color:'#d2b28e',letterSpacing:1}}>DEMONSTRAÇÃO · DADOS FICTÍCIOS</div></div>};createRoot(document.getElementById('root')).render(<ModalProvider><Demo/></ModalProvider>);`;
    require("esbuild").buildSync({
      stdin: { contents: harness, loader: "tsx", resolveDir: root },
      bundle: true,
      platform: "browser",
      outfile: path.join(work, "harness.js"),
    });
    fs.mkdirSync(path.join(work, "brand"), { recursive: true });
    fs.copyFileSync(
      path.join(root, "dist-electron/renderer/brand/card-curve.svg"),
      path.join(work, "brand/card-curve.svg"),
    );
    const assets = path.join(root, "dist-electron/renderer/assets"),
      css = fs.readdirSync(assets).find((n) => n.endsWith(".css"));
    fs.writeFileSync(
      path.join(work, "index.html"),
      '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><link rel="stylesheet" href="' +
        pathToFileURL(path.join(assets, css)).href +
        '"><div id="root"></div><script src="harness.js"></script></html>',
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
        partition: "readme-safe-" + process.pid,
        backgroundThrottling: false,
      },
    });
    win.webContents.session.setPermissionCheckHandler(() => false);
    win.webContents.session.setPermissionRequestHandler((_w, _p, cb) =>
      cb(false),
    );
    win.webContents.session.setDisplayMediaRequestHandler((_r, cb) => cb(null));
    win.webContents.session.webRequest.onBeforeRequest(
      { urls: ["*://*/*"] },
      (_d, cb) => cb({ cancel: true }),
    );
    win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    win.webContents.on("console-message", (_e, details) => {
      if (details.level === "error") console.error(details.message);
    });
    await win.loadFile(path.join(work, "index.html"));
    await wait(150);
    for (const view of ["home", "incoming", "host", "clipboard"]) {
      await win.webContents.executeJavaScript(
        "window.demoView(" + JSON.stringify(view) + ")",
      );
      await win.webContents.executeJavaScript(
        "document.fonts.ready.then(()=>true)",
      );
      await win.webContents.executeJavaScript(
        "Promise.all([...document.images].map(i=>i.decode())).then(()=>true)",
      );
      await wait(300);
      const text = await win.webContents.executeJavaScript(
        "document.body.innerText",
      );
      if (!text.includes("DEMONSTRAÇÃO") || !text.includes("123-456-789"))
        throw Error("Synthetic demo markers missing");
      if (
        await win.webContents.executeJavaScript(
          '!!document.querySelector("video,iframe")',
        )
      )
        throw Error("Video/embedded surface prohibited in public captures");
      win.showInactive();
      await wait(200);
      fs.writeFileSync(
        path.join(out, "readme-" + view + ".png"),
        (await win.webContents.capturePage()).toPNG(),
      );
      win.hide();
      console.log("SAFE README IMAGE " + view);
    }
    win.destroy();
    app.exit(0);
  } catch (e) {
    console.error(e);
    win?.destroy();
    app.exit(1);
  }
});
