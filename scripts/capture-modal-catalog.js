// Captures real renderer components with isolated illustrative data; no service access.
const { app, BrowserWindow } = require("electron");
const fs = require("node:fs"),
  path = require("node:path"),
  { pathToFileURL } = require("node:url");
const root = path.resolve(__dirname, ".."),
  out = path.join(root, "artifacts/screenshots-current/modals");
fs.mkdirSync(out, { recursive: true });
app.setPath("userData", path.join(out, "profile-" + process.pid));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
app.whenReady().then(async () => {
  let win;
  try {
    const harness = `import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
 import {ModalProvider} from './src/renderer/context/ModalContext';
 import {HelpModal} from './src/renderer/components/modals/HelpModal';
 import {FavoritesModal} from './src/renderer/components/modals/FavoritesModal';
 import {AllRecentSessionsModal} from './src/renderer/components/modals/AllRecentSessionsModal';
 import {SessionOptionsModal} from './src/renderer/components/modals/SessionOptionsModal';
 import {SettingsModal} from './src/renderer/components/modals/SettingsModal';
 import {ReportDeviceModal} from './src/renderer/components/modals/ReportDeviceModal';
 import {UpdatePromptModal} from './src/renderer/components/modals/UpdatePromptModal';
 import {IncomingCallModal} from './src/renderer/components/modals/IncomingCallModal';
 import {AlertDialog} from './src/renderer/components/ui/AlertDialog';
 import {ConnectionDetails} from './src/renderer/components/session/ConnectionDetails';
 const noop=()=>{},permissions={control:true,clipboard:true,files:true};
 const device={id:'catalog',name:'Computador de demonstração',remoteId:'123-456-789',dateStr:'16/11/2026 · 10:30'};
 window.electronAPI={getDesktopSources:async()=>[{id:'screen:0:0',name:'Principal',isPrimary:true,displayId:'1',kind:'screen'}],getAppVersion:async()=>'1.0.1'};
 function App(){const [view,setView]=useState('help');window.catalog=setView;let modal=null;
 if(view==='help')modal=<HelpModal isOpen onClose={noop}/>;
 if(view.startsWith('favorites'))modal=<FavoritesModal isOpen onClose={noop} favorites={view.endsWith('empty')?[]:[device]} onConnect={noop} onOptions={noop} onRemove={noop}/>;
 if(view.startsWith('history'))modal=<AllRecentSessionsModal isOpen onClose={noop} recentSessions={view.endsWith('empty')?[]:[device]} entries={view.endsWith('empty')?[]:[{id:'history',remoteId:device.remoteId,name:device.name,direction:'outgoing',result:'completed',startedAt:'2026-11-16T13:30:00Z',acceptedAt:'2026-11-16T13:30:02Z',endedAt:'2026-11-16T13:32:00Z'}]} error="" onClearAll={noop} onConnectSession={noop} onOpenOptions={noop}/>;
 if(view.startsWith('options'))modal=<SessionOptionsModal selectedSession={device} onClose={noop} onConnectDirect={noop} onConnectWithPassword={noop} onRename={noop} onReport={noop} onDelete={noop} isFavorite onToggleFavorite={noop} canDeleteFromHistory/>;
 if(view.startsWith('settings'))modal=<SettingsModal isOpen onClose={noop} unattendedEnabled={view==='settings-enabled'} setUnattendedEnabled={noop} unattendedPassword="" setUnattendedPassword={noop} unattendedPermissions={permissions} setUnattendedPermissions={noop} onResetIdentity={noop} onSave={noop} onCheckUpdates={noop}/>;
 if(view==='report')modal=<ReportDeviceModal targetId={device.remoteId} onClose={noop} onSend={noop}/>;
 if(view.startsWith('incoming'))modal=<IncomingCallModal incomingCall={{fromId:device.remoteId,fromName:device.name,expiresAt:Date.now()+45000}} countdown={30} answering={view==='incoming-confirming'} error={view==='incoming-error'?'Não foi possível iniciar a captura. Selecione outra fonte.':null} onAccept={noop} onReject={noop}/>;
 if(view.startsWith('update-'))modal=<UpdatePromptModal isOpen busy={false} state={{status:view.slice(7),updateInfo:{version:'1.0.2',currentVersion:'1.0.1',releaseDate:'2026-11-16T15:00:00Z',releaseNotes:'Exemplo visual: melhorias de conexão e estabilidade.'},progress:{percent:42,transferred:44040192,total:104857600,bytesPerSecond:2097152},errorMessage:view==='update-error'?'Exemplo visual: não foi possível consultar atualizações.':null,isDev:false,isPortable:false,installBlocked:false}} onClose={noop} onCheck={noop} onDownload={noop} onCancel={noop} onInstall={noop} onRelease={noop}/>;
 if(view.startsWith('alert-'))modal=<AlertDialog dialog={{kind:'alert',options:{title:'Aviso',message:'Exemplo visual de feedback do aplicativo.',type:view.slice(6)},resolve:noop}} onUpdatePromptValue={noop} onClose={noop} onConfirm={noop}/>;
 if(view==='diagnostic')modal=<div style={{position:'absolute',right:40,top:40,background:'#21150f',padding:24}}><ConnectionDetails diagnostic={{stage:'webrtc',state:'failed',code:'ICE_FAILED',message:'Não foi possível estabelecer a conexão.'}}/></div>;
 return <ModalProvider key={view}>{modal}</ModalProvider>;
 };createRoot(document.getElementById('root')).render(<App/>);`;
    require("esbuild").buildSync({
      stdin: { contents: harness, loader: "tsx", resolveDir: root },
      bundle: true,
      platform: "browser",
      outfile: path.join(out, "harness.js"),
    });
    const assets = path.join(root, "dist-electron/renderer/assets"),
      css = fs.readdirSync(assets).find((x) => x.endsWith(".css"));
    const bg = pathToFileURL(
      path.join(root, "artifacts/redesign/coffee-desk-1672x941.png"),
    ).href;
    fs.writeFileSync(
      path.join(out, "index.html"),
      '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><link rel="stylesheet" href="' +
        pathToFileURL(path.join(assets, css)).href +
        '"><style>body{margin:0;background:#140c0a url("' +
        bg +
        '") center/cover no-repeat;height:100vh}</style><div id="root"></div><script src="./harness.js"></script></html>',
    );
    win = new BrowserWindow({
      width: 1672,
      height: 941,
      useContentSize: true,
      frame: false,
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false,
      },
    });
    await win.loadFile(path.join(out, "index.html"));
    await wait(300);
    const views = [
      "help",
      "favorites-empty",
      "favorites-filled",
      "history-empty",
      "history-filled",
      "options",
      "options-rename",
      "options-password",
      "options-delete",
      "settings",
      "settings-enabled",
      "report",
      "incoming",
      "incoming-sources",
      "incoming-confirming",
      "incoming-error",
      "update-idle",
      "update-checking",
      "update-available",
      "update-not-available",
      "update-downloading",
      "update-downloaded",
      "update-installing",
      "update-error",
      "alert-info",
      "alert-warning",
      "alert-error",
      "alert-success",
      "alert-question",
      "diagnostic",
    ];
    for (const view of views) {
      await win.webContents.executeJavaScript(
        "window.catalog(" + JSON.stringify(view) + ")",
      );
      await wait(150);
      await win.webContents.executeJavaScript(
        "document.fonts.ready.then(()=>true)",
      );
      if (view.startsWith("options-")) {
        const label = {
          "options-rename": "Renomear Máquina",
          "options-password": "Conectar com Senha",
          "options-delete": "Excluir do Histórico",
        }[view];
        await win.webContents.executeJavaScript(
          '([...document.querySelectorAll("button")].find(b=>b.textContent.trim().includes(' +
            JSON.stringify(label) +
            "))) ?.click()",
        );
        await wait(150);
      }
      if (view === "incoming-sources")
        await win.webContents.executeJavaScript(
          '(()=>{const d=document.querySelector("details");if(d)d.open=true;})()',
        );
      if (view === "diagnostic")
        await win.webContents.executeJavaScript(
          'document.querySelector("details").open=true',
        );
      win.showInactive();
      await wait(250);
      fs.writeFileSync(
        path.join(out, view + ".png"),
        (await win.webContents.capturePage()).toPNG(),
      );
      win.hide();
      console.log("CAPTURE " + view);
    }
    win.destroy();
    app.exit(0);
  } catch (e) {
    console.error(e);
    win?.destroy();
    app.exit(1);
  }
});
