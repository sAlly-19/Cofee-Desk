const {
  app,
  BrowserWindow,
  clipboard,
  desktopCapturer,
  ipcMain,
} = require("electron");
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const out = path.join(root, "artifacts/redesign");
const verify = process.argv.includes("--verify");
app.setPath("userData", path.join(out, "electron-test-profile"));
app.commandLine.appendSwitch("disable-background-timer-throttling");
app.commandLine.appendSwitch("disable-renderer-backgrounding");
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const checks = [],
  errors = [];
const securityProfiles = new Map();
function check(name, condition, detail) {
  checks.push({ name, passed: !!condition, detail });
  console.log(
    (condition ? "PASS " : "FAIL ") +
      name +
      (detail ? ": " + JSON.stringify(detail) : ""),
  );
}
async function js(win, code) {
  if (typeof code === "function") code = "(" + code.toString() + ")()";
  let timer;
  try {
    return await Promise.race([
      win.webContents.executeJavaScript(code, true),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Renderer evaluation timed out")),
          15000,
        );
      }),
    ]);
  } catch (error) {
    throw new Error(error.message + "\nExpression: " + code);
  } finally {
    clearTimeout(timer);
  }
}
async function until(win, expression, timeout = 12000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (win.isDestroyed()) return false;
    if (await js(win, expression)) return true;
    await wait(100);
  }
  return false;
}
async function click(win, text) {
  return js(
    win,
    '(() => { const b = [...document.querySelectorAll("button")].find(b => b.textContent.trim().includes(' +
      JSON.stringify(text) +
      ")); if (!b) return false; b.click(); return true; })()",
  );
}
async function fill(win, selector, value) {
  return js(
    win,
    "(() => {const el=document.querySelector(" +
      JSON.stringify(selector) +
      '); if (!el) return false; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(el,' +
      JSON.stringify(value) +
      '); el.dispatchEvent(new Event("input",{bubbles:true})); return true;})()',
  );
}
async function ready(win) {
  await js(win, "document.fonts.ready.then(() => true)");
  await wait(100);
}
async function reload(win) {
  const loaded = new Promise((resolve) =>
    win.webContents.once("did-finish-load", resolve),
  );
  win.reload();
  await loaded;
  await ready(win);
}
async function capture(win, name) {
  const wasVisible = win.isVisible();
  if (!wasVisible) win.showInactive();
  try {
    await ready(win);
    await wait(250);
    fs.writeFileSync(
      path.join(out, name + ".png"),
      (await win.webContents.capturePage()).toPNG(),
    );
  } finally {
    if (!wasVisible) win.hide();
  }
}
async function create(partition, width = 1672, height = 941) {
  partition += "-" + process.pid;
  const win = new BrowserWindow({
    width,
    height,
    useContentSize: true,
    frame: false,
    show: false,
    backgroundColor: "#140c0a",
    webPreferences: {
      partition,
      preload: path.join(root, "dist-electron/main/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  securityProfiles.set(win.webContents.id, partition);
  win.webContents.on("console-message", (_event, ...args) => {
    const detail = args[0];
    const message = typeof detail === "object" ? detail.message : args[1];
    if (message && /Error|falhou|Falha/.test(message)) errors.push(message);
  });
  win.webContents.on("render-process-gone", (_event, details) =>
    errors.push("Renderer gone: " + details.reason),
  );
  win.webContents.session.setDisplayMediaRequestHandler(
    async (_request, callback) => {
      const authority = require("../dist-electron/main/sessionAuthority.js");
      const source = authority.selectedSource(win.webContents.id);
      const active = authority.nativeSession(win.webContents.id);
      const sources = await desktopCapturer.getSources({
        types: ["screen", "window"],
      });
      const selected = source && sources.find((s) => s.id === source.sourceId);
      callback(active?.role === "host" && selected ? { video: selected } : {});
    },
  );
  if (partition.startsWith("redesign-first"))
    require("../dist-electron/main/updater.js").registerUpdater(win);
  await win.loadFile(path.join(root, "dist-electron/renderer/index.html"));
  await ready(win);
  return win;
}
async function run() {
  fs.mkdirSync(out, { recursive: true });
  fs.rmSync(path.join(out, "validation-error.txt"), { force: true });
  fs.mkdirSync(path.join(out, "downloads"), { recursive: true });
  app.setPath("downloads", path.join(out, "downloads"));
  require(
    path.join(root, "dist-electron/main/ipcHandlers.js"),
  ).registerIpcHandlers();
  const remoteInputs = [];
  ipcMain.on("remote:input:keyboard", (_event, data) =>
    remoteInputs.push(data),
  );
  require(
    path.join(root, "dist-electron/main/deviceSecurity.js"),
  ).registerDeviceSecurity((sender) =>
    path.join(
      out,
      "secure-identities",
      securityProfiles.get(sender.id) || "default",
    ),
  );
  require(
    path.join(root, "dist-electron/main/sessionAuthority"),
  ).registerSessionAuthority();
  require(
    path.join(root, "dist-electron/main/historyManager"),
  ).registerHistoryHandlers((sender) =>
    path.join(
      out,
      "secure-identities",
      securityProfiles.get(sender.id) || "default",
    ),
  );
  require(
    path.join(root, "dist-electron/main/screenManager"),
  ).registerScreenIpcHandlers();
  require(
    path.join(root, "dist-electron/main/inputManager.js"),
  ).registerInputIpcHandlers();
  const win = await create("redesign-first");
  if (process.argv.includes("--icons")) {
    const images = await js(win, async () => {
      const mark = new Image();
      mark.src = new URL("./brand/coffee-mark.svg", location.href).href;
      await mark.decode();
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 512;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#21130f";
      ctx.beginPath();
      ctx.roundRect(0, 0, 512, 512, 108);
      ctx.fill();
      ctx.drawImage(mark, 70, 45, 372, 372);
      const icon = canvas.toDataURL("image/png").split(",")[1];
      ctx.clearRect(0, 0, 512, 512);
      ctx.drawImage(mark, 0, 0, 512, 512);
      return { icon, transparent: canvas.toDataURL("image/png").split(",")[1] };
    });
    fs.writeFileSync(
      path.join(root, "assets/icon.png"),
      Buffer.from(images.icon, "base64"),
    );
    fs.writeFileSync(
      path.join(root, "assets/brand/coffee-mark.png"),
      Buffer.from(images.transparent, "base64"),
    );
    const icon = require("electron")
      .nativeImage.createFromBuffer(Buffer.from(images.icon, "base64"))
      .resize({ width: 256, height: 256 })
      .toPNG();
    const header = Buffer.alloc(22);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(1, 4);
    header.writeUInt16LE(1, 10);
    header.writeUInt16LE(32, 12);
    header.writeUInt32LE(icon.length, 14);
    header.writeUInt32LE(22, 18);
    fs.writeFileSync(
      path.join(root, "assets/icon.ico"),
      Buffer.concat([header, icon]),
    );
    fs.writeFileSync(
      path.join(root, "assets/brand/tray.png"),
      require("electron")
        .nativeImage.createFromBuffer(Buffer.from(images.transparent, "base64"))
        .resize({ width: 32, height: 32 })
        .toPNG(),
    );
    win.destroy();
    console.log("Brand PNG, Windows ICO and tray icon generated.");
    return;
  }
  await wait(500);
  const isOnline = await until(
    win,
    '!!document.querySelector(".access-badge.is-ready")',
    verify ? 12000 : 1500,
  );
  const screenshots = [];
  for (const [width, height] of [
    [1672, 941],
    [1440, 900],
    [1024, 680],
  ]) {
    win.setContentSize(width, height);
    await wait(150);
    await capture(win, "coffee-desk-" + width + "x" + height);
    const layout = await js(
      win,
      "(" +
        (() => {
          const box = (selector) => {
            const r = document.querySelector(selector).getBoundingClientRect();
            return { x: r.x, y: r.y, width: r.width, height: r.height };
          };
          return {
            viewport: [innerWidth, innerHeight],
            sidebar: box(".sidebar"),
            connection: box(".connection-panel"),
            identity: box(".identity-panel"),
            headline: box("h1"),
            overflow:
              document.querySelector("main").scrollWidth >
              document.querySelector("main").clientWidth,
            fonts: [
              document.fonts.check("600 30px Fraunces"),
              document.fonts.check("400 20px Inter"),
              document.fonts.check('600 30px "JetBrains Mono"'),
            ],
          };
        }).toString() +
        ")()",
    );
    screenshots.push({ width, height, ...layout });
    check("No horizontal overflow at " + width, !layout.overflow);
    check(
      "Panels " + (width < 1280 ? "stack" : "align") + " at " + width,
      width < 1280
        ? layout.identity.y > layout.connection.y
        : Math.abs(layout.identity.y - layout.connection.y) < 1,
    );
    check("Bundled fonts load at " + width, layout.fonts.every(Boolean));
  }
  win.setContentSize(1672, 941);
  check(
    "Fresh history is empty",
    await js(win, '!!document.querySelector(".recent-empty")'),
  );
  if (verify) {
    check("Registered with live signaling", isOnline);
    if (!isOnline)
      throw new Error("No registered identity from local signaling.");
    const id = await js(
      win,
      'localStorage.getItem("coffee_v2_id:"+localStorage.getItem("coffee_desk_server_url"))',
    );
    const originalClipboard = await clipboard.readText();
    win.showInactive();
    win.focus();
    await js(win, 'document.querySelector(".copy-button").click()');
    check(
      "Copies real ID",
      (await until(
        win,
        'document.querySelector(".copy-button").textContent.includes("Copiado!")',
      )) && (await clipboard.readText()) === id,
    );
    await clipboard.writeText(originalClipboard);
    await js(
      win,
      'window.originalWriteText=navigator.clipboard.writeText; navigator.clipboard.writeText=async()=>{throw new Error("test denied")}; document.querySelector(".copy-button").click()',
    );
    check(
      "Clipboard failure has feedback",
      await until(
        win,
        'document.body.textContent.includes("Não foi possível copiar")',
      ),
    );
    check(
      "Clipboard failure does not claim success",
      await js(
        win,
        '!document.querySelector(".copy-button").textContent.includes("Copiado!")',
      ),
    );
    await js(
      win,
      "navigator.clipboard.writeText=window.originalWriteText; delete window.originalWriteText",
    );
    win.hide();
    await click(win, "Definir senha");
    check(
      "Password action focuses masked field",
      await until(win, 'document.activeElement?.type === "password"'),
    );
    check(
      "Password action does not enable unattended access",
      await js(
        win,
        "window.electronAPI.getSecuritySettings().then(s=>!s.enabled)",
      ),
    );
    await capture(win, "settings-password");
    await js(win, 'document.querySelector(".modal-close").click()');
    await fill(win, "#remote-id", "123");
    check(
      "Incomplete ID cannot connect",
      await js(win, 'document.querySelector(".connect-form button").disabled'),
    );
    await fill(win, "#remote-id", id);
    await js(win, 'document.querySelector(".connect-form").requestSubmit()');
    check(
      "Own ID rejected",
      await until(win, 'document.body.textContent.includes("próprio ID")'),
    );
    await click(win, "OK");
    // Reload retains real identity and clears temporary form and alert state.
    await reload(win);
    await until(win, '!!document.querySelector(".access-badge.is-ready")');
    check(
      "ID persists after reload",
      (await js(
        win,
        'localStorage.getItem("coffee_v2_id:"+localStorage.getItem("coffee_desk_server_url"))',
      )) === id,
    );
    const peer = await create("redesign-second");
    await until(peer, '!!document.querySelector(".access-badge.is-ready")');
    const peerId = await js(
      peer,
      'localStorage.getItem("coffee_v2_id:"+localStorage.getItem("coffee_desk_server_url"))',
    );
    check("Independent peer has real unique ID", !!peerId && peerId !== id);
    check(
      "Sandboxed preload exposes native APIs",
      await js(win, 'typeof window.electronAPI?.setMyId === "function"'),
    );
    await fill(win, "#remote-id", peerId);
    await js(win, 'document.querySelector(".connect-form").requestSubmit()');
    check(
      "Incoming call uses real peer",
      await until(
        peer,
        'document.body.textContent.includes("Aceitar e Compartilhar")',
      ),
    );
    check(
      "Attempt does not enter history",
      await js(win, '!!document.querySelector(".recent-empty")'),
    );
    await click(win, "Cancelar");
    check(
      "Canceled call closes incoming request",
      await until(
        peer,
        '!document.body.textContent.includes("Aceitar e Compartilhar")',
      ),
    );
    check(
      "Cancel leaves history empty",
      await js(win, '!!document.querySelector(".recent-empty")'),
    );
    await click(peer, "OK");
    await js(win, 'document.querySelector(".connect-form").requestSubmit()');
    await until(
      peer,
      'document.body.textContent.includes("Aceitar e Compartilhar")',
    );
    await click(peer, "Recusar");
    check(
      "Refusal reaches caller",
      await until(
        win,
        'document.body.textContent.includes("recusada pelo computador")',
      ),
    );
    check(
      "Refusal leaves history empty",
      await js(win, '!!document.querySelector(".recent-empty")'),
    );
    await reload(win);
    await until(win, '!!document.querySelector(".access-badge.is-ready")');
    await fill(win, "#remote-id", peerId);
    await js(win, 'document.querySelector(".connect-form").requestSubmit()');
    await until(
      peer,
      'document.body.textContent.includes("Aceitar e Compartilhar")',
    );
    await until(
      peer,
      '[...document.querySelectorAll("button")].some(b=>b.textContent.includes("Aceitar e Compartilhar")&&!b.disabled)',
    );
    await click(peer, "Aceitar e Compartilhar");
    check(
      "Accepted call opens session",
      await until(win, '!!document.querySelector(".session-stage")'),
    );
    check(
      "Accepted session enters persisted history",
      await js(
        win,
        'JSON.parse(localStorage.getItem("coffee_v2_recents:"+localStorage.getItem("coffee_desk_server_url")) || "[]").some(s=>s.remoteId===' +
          JSON.stringify(peerId) +
          ")",
      ),
    );
    const video = await until(
      win,
      '[...document.querySelectorAll("video")].some(v=>v.videoWidth>0 && v.readyState>=2)',
      15000,
    );
    check("Real WebRTC video received", video);
    check(
      "Host uses actual desktop capture",
      await js(
        peer,
        '!document.body.textContent.includes("Área de Trabalho Virtual P2P ativa")',
      ),
    );
    await js(win, () => {
      const stage = document.querySelector(".session-stage [tabindex]");
      stage.focus();
      stage.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "F24",
          code: "F24",
          bubbles: true,
        }),
      );
      stage.dispatchEvent(
        new KeyboardEvent("keyup", { key: "F24", code: "F24", bubbles: true }),
      );
    });
    await wait(400);
    check(
      "Keyboard crosses real WebRTC control channel",
      remoteInputs.some((data) => data.code === "F24"),
    );
    const fixtureName = "coffee-desk-check-" + Date.now() + ".txt";
    await js(win, "window.transferFixtureName=" + JSON.stringify(fixtureName));
    await js(win, () => {
      const dt = new DataTransfer();
      dt.items.add(
        new File(
          ["Coffee Desk real WebRTC file check"],
          window.transferFixtureName,
          { type: "text/plain" },
        ),
      );
      document
        .querySelector(".session-stage [tabindex]")
        .dispatchEvent(
          new DragEvent("drop", { dataTransfer: dt, bubbles: true }),
        );
    });
    await until(
      peer,
      'document.body.textContent.includes("Arquivo Recebido!")',
      10000,
    );
    check(
      "File crosses real WebRTC channel and saves",
      fs.existsSync(path.join(out, "downloads", fixtureName)) &&
        fs.readFileSync(path.join(out, "downloads", fixtureName), "utf8") ===
          "Coffee Desk real WebRTC file check",
    );
    await js(win, () =>
      document
        .querySelector('button[title="Área de Transferência Compartilhada"]')
        .click(),
    );
    check(
      "Clipboard drawer opens during session",
      await until(win, '!!document.querySelector(".session-drawer")'),
    );
    await js(win, () =>
      document.querySelector('button[title="Fechar painel"]').click(),
    );
    await click(peer, "Tela e permissões");
    check(
      "Host permissions editor opens",
      await until(
        peer,
        'document.querySelectorAll(".permission-fields input").length===3',
      ),
    );
    for (let i = 0; i < 3; i++) {
      await js(
        peer,
        'document.querySelectorAll(".permission-fields input")[' +
          i +
          "].click()",
      );
      await wait(250);
    }
    check(
      "Revoked control cannot be reenabled through IPC",
      await js(
        peer,
        "window.electronAPI.toggleInputControl(true).then(v=>v===false)",
      ),
    );
    for (const device of [win, peer]) {
      check(
        "Revoked clipboard read blocked in main " + device.webContents.id,
        await js(
          device,
          "window.electronAPI.readSessionClipboard().then(()=>false,()=>true)",
        ),
      );
      check(
        "Revoked clipboard write blocked in main " + device.webContents.id,
        await js(
          device,
          'window.electronAPI.applySessionClipboard("unauthorized").then(()=>false,()=>true)',
        ),
      );
      check(
        "Revoked file save blocked in main " + device.webContents.id,
        await js(
          device,
          'window.electronAPI.saveFileToDownloads("not-authorized.txt","dGVzdA==").then(r=>!r.success,()=>true)',
        ),
      );
    }
    check(
      "Viewer toolbar reflects revocation",
      await js(
        win,
        () =>
          document.querySelector(
            'button[title="Área de Transferência Compartilhada"]',
          ).disabled,
      ),
    );
    for (let i = 0; i < 3; i++) {
      await js(
        peer,
        'document.querySelectorAll(".permission-fields input")[' +
          i +
          "].click()",
      );
      await wait(250);
    }
    check(
      "Host can reauthorize control after server acknowledgment",
      await js(
        peer,
        "window.electronAPI.getInputControlStatus().then(s=>s.enabled)",
      ),
    );
    await js(
      peer,
      '[...document.querySelectorAll(".modal-panel button")].find(b=>b.getAttribute("aria-label")==="Fechar modal")?.click()',
    );
    await js(
      peer,
      'document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}))',
    );
    // Capturing a hidden surface containing a live desktop video can fail with
    // UnknownVizError on Windows. Dashboard captures below do not depend on it.
    try {
      await capture(win, "active-session");
    } catch (error) {
      errors.push("Active session screenshot: " + error.message);
    }
    await peer.close();
    check(
      "Remote disconnect ends session",
      await until(win, '!!document.querySelector(".dashboard-home")'),
    );
    await reload(win);
    await until(win, '!!document.querySelector(".access-badge.is-ready")');
    check(
      "Accepted history survives reload",
      await js(win, 'document.querySelectorAll(".recent-row").length===1'),
    );
    await capture(win, "coffee-desk-real-history");
    await js(win, 'document.querySelector(".options-button").click()');
    check(
      "Device options open",
      await until(win, '!!document.querySelector(".modal-panel")'),
    );
    check(
      "Sidebar keeps remote and favorites only",
      await js(
        win,
        '!![...document.querySelectorAll(".sidebar-link")].find(b=>b.textContent.includes("Conexão Remota")) && !![...document.querySelectorAll(".sidebar-link")].find(b=>b.textContent.includes("Favoritos")) && !document.querySelector(".sidebar-nav").textContent.includes("Minha Identidade") && !document.querySelector(".sidebar-nav").textContent.includes("Sessões Recentes")',
      ),
    );
    await click(win, "Adicionar aos favoritos");
    check(
      "Device can be favorited from recent options",
      await until(
        win,
        'document.querySelector(".favorite-option")?.getAttribute("aria-pressed")==="true"',
      ),
    );
    await capture(win, "device-options");
    await js(win, 'document.querySelector(".modal-close").click()');
    await js(win, 'document.querySelector(".options-button").click()');
    await click(win, "Renomear Máquina");
    await until(win, '!!document.querySelector("[role=alertdialog] input")');
    await fill(win, "[role=alertdialog] input", "Computador de teste");
    await click(win, "Salvar");
    check(
      "Rename persists real record",
      await until(
        win,
        'document.querySelector(".recent-device strong")?.textContent === "Computador de teste"',
      ),
    );
    // Reopen the same isolated peer partition: its ID and accepted inbound history persist.
    const passwordPeer = await create("redesign-second");
    await until(
      passwordPeer,
      '!!document.querySelector(".access-badge.is-ready")',
    );
    await click(passwordPeer, "Definir senha");
    await js(passwordPeer, () =>
      document.querySelector('input[type="checkbox"]').click(),
    );
    await fill(
      passwordPeer,
      'input[type="password"]',
      "coffee-desk-local-test",
    );
    await click(passwordPeer, "Salvar e Fechar");
    check(
      "Password save completes before reload",
      await until(passwordPeer, '!document.querySelector(".modal-panel")'),
    );
    await reload(passwordPeer);
    await until(
      passwordPeer,
      '!!document.querySelector(".access-badge.is-ready")',
    );
    check(
      "Unattended preference persists",
      await js(
        passwordPeer,
        "window.electronAPI.getSecuritySettings().then(s=>s.enabled)",
      ),
    );
    check(
      "Protected password verifier accepts saved password",
      await js(
        passwordPeer,
        'window.electronAPI.verifyAccessPassword("coffee-desk-local-test")',
      ),
    );
    await click(win, "Favoritos");
    check(
      "Favorite keeps renamed device",
      await until(
        win,
        'document.querySelector(".favorite-row .recent-device strong")?.textContent==="Computador de teste"',
      ),
    );
    await capture(win, "favorites");
    await js(
      win,
      'document.querySelector(".favorite-row .options-button").click()',
    );
    await click(win, "Conectar com Senha");
    await until(win, '!!document.querySelector("[role=alertdialog] input")');
    await fill(win, "[role=alertdialog] input", "coffee-desk-local-test");
    await js(win, () =>
      [...document.querySelectorAll('[role="alertdialog"] button')]
        .find((b) => b.textContent.trim() === "Conectar")
        .click(),
    );
    check(
      "Real password automatically accepts session",
      await until(passwordPeer, '!!document.querySelector(".session-stage")'),
    );
    check(
      "New unattended access is view only",
      await js(
        passwordPeer,
        "window.electronAPI.getSecuritySettings().then(s=>Object.values(s.unattendedPermissions).every(v=>v===false))",
      ),
    );
    check(
      "Unattended control blocked natively",
      await js(
        passwordPeer,
        "window.electronAPI.toggleInputControl(true).then(v=>v===false)",
      ),
    );
    await click(win, "Desconectar");
    await click(win, "Encerrar Sessão");
    check(
      "End session returns caller home",
      await until(win, '!!document.querySelector(".dashboard-home")'),
    );
    check(
      "End session notifies peer",
      await until(passwordPeer, '!!document.querySelector(".dashboard-home")'),
    );
    await reload(passwordPeer);
    await until(
      passwordPeer,
      '!!document.querySelector(".access-badge.is-ready")',
    );
    await js(passwordPeer, 'document.querySelector(".options-button").click()');
    await click(passwordPeer, "Excluir do Histórico");
    await click(passwordPeer, "Remover");
    check(
      "Delete removes actual inbound record",
      await until(passwordPeer, '!!document.querySelector(".recent-empty")'),
    );
    passwordPeer.destroy();
    await reload(win);
    await until(win, '!!document.querySelector(".access-badge.is-ready")');
    check(
      "Reconnect preserves renamed device",
      await js(
        win,
        'document.querySelector(".recent-device strong")?.textContent === "Computador de teste"',
      ),
    );
    await click(win, "Ver histórico");
    check(
      "Full history opens",
      await until(
        win,
        'document.body.textContent.includes("Histórico de sessões")',
      ),
    );
    await click(win, "Limpar Todo o Histórico");
    await click(win, "Limpar Tudo");
    check(
      "Clear history shows empty state",
      await until(win, '!!document.querySelector(".recent-empty")'),
    );
    await reload(win);
    await until(win, '!!document.querySelector(".access-badge.is-ready")');
    check(
      "Empty history survives reload",
      await js(win, '!!document.querySelector(".recent-empty")'),
    );
    await click(win, "Favoritos");
    check(
      "Favorite survives reload and history clearing",
      await until(win, 'document.querySelectorAll(".favorite-row").length===1'),
    );
    await js(
      win,
      'window.dispatchEvent(new CustomEvent("signaling-scope", {detail:"wss://other-test.example/ws"}))',
    );
    check(
      "Favorites isolated by server",
      await until(win, '!!document.querySelector(".favorites-empty")'),
    );
    await js(
      win,
      'window.dispatchEvent(new CustomEvent("signaling-scope", {detail:localStorage.getItem("coffee_desk_server_url")}))',
    );
    check(
      "Original server restores saved favorite",
      await until(win, 'document.querySelectorAll(".favorite-row").length===1'),
    );
    await js(win, 'document.querySelector(".favorite-toggle").click()');
    check(
      "Removing favorite leaves history unchanged",
      await until(
        win,
        '!!document.querySelector(".favorites-empty") && !!document.querySelector(".recent-empty")',
      ),
    );
    await js(win, 'document.querySelector(".modal-close").click()');
    await reload(win);
    await until(win, '!!document.querySelector(".access-badge.is-ready")');
    await click(win, "Favoritos");
    check(
      "Favorite removal persists",
      await until(win, '!!document.querySelector(".favorites-empty")'),
    );
    await js(win, 'document.querySelector(".modal-close").click()');
    // A failed registration must not keep the ready badge from a previous connection.
    win.webContents.session.webRequest.onBeforeRequest(
      { urls: ["ws://localhost:8080/*"] },
      (_details, callback) => callback({ cancel: true }),
    );
    await reload(win);
    await wait(600);
    check(
      "Offline does not claim availability",
      await js(win, '!document.querySelector(".access-badge.is-ready")'),
    );
    await capture(win, "signaling-offline");
    win.webContents.session.webRequest.onBeforeRequest(null);
    await reload(win);
    check(
      "Reconnect registers again",
      await until(win, '!!document.querySelector(".access-badge.is-ready")'),
    );
    await click(win, "Configurações");
    await click(win, "Redefinir Preferências");
    await until(win, '!!document.querySelector("[role=alertdialog]")');
    await js(win, () =>
      [...document.querySelectorAll('[role="alertdialog"] button')]
        .find((b) => b.textContent.trim() === "Redefinir preferências")
        .click(),
    );
    await until(win, '!document.querySelector(".modal-panel")');
    check(
      "Reset preserves authenticated identity",
      await until(
        win,
        '!!document.querySelector(".access-badge.is-ready") && localStorage.getItem("coffee_v2_id:"+localStorage.getItem("coffee_desk_server_url")) === ' +
          JSON.stringify(id),
      ),
    );
    check(
      "Reset keeps history empty",
      await js(win, '!!document.querySelector(".recent-empty")'),
    );
    // Exercise the production window IPC handlers against the production window factory.
    const windowManager = require(
      path.join(root, "dist-electron/main/windowManager.js"),
    );
    windowManager.registerWindowIpcHandlers();
    const nativeWindow = windowManager.createMainWindow();
    await new Promise((resolve) =>
      nativeWindow.webContents.once("did-finish-load", resolve),
    );
    await ready(nativeWindow);
    await js(nativeWindow, () =>
      document.querySelector('button[aria-label="Minimizar"]').click(),
    );
    await wait(200);
    check("Native minimize works", nativeWindow.isMinimized());
    nativeWindow.restore();
    await js(nativeWindow, () =>
      document
        .querySelector('button[aria-label="Maximizar ou restaurar"]')
        .click(),
    );
    await wait(200);
    check("Native maximize works", nativeWindow.isMaximized());
    await js(nativeWindow, () =>
      document
        .querySelector('button[aria-label="Maximizar ou restaurar"]')
        .click(),
    );
    await wait(200);
    check("Native restore works", !nativeWindow.isMaximized());
    check(
      "Drag regions exclude controls",
      await js(
        nativeWindow,
        'getComputedStyle(document.querySelector(".titlebar")).webkitAppRegion === "drag" && getComputedStyle(document.querySelector(".window-controls")).webkitAppRegion === "no-drag"',
      ),
    );
    await js(nativeWindow, () => {
      setTimeout(
        () =>
          document
            .querySelector('button[aria-label="Fechar aplicativo"]')
            .click(),
        20,
      );
      return true;
    });
    await wait(200);
    check("Native close works", nativeWindow.isDestroyed());
  }
  fs.writeFileSync(
    path.join(out, "validation.json"),
    JSON.stringify({ checks, screenshots, rendererMessages: errors }, null, 2),
  );
  win.destroy();
  if (checks.some((c) => !c.passed)) process.exitCode = 1;
}
app
  .whenReady()
  .then(run)
  .catch((err) => {
    console.error(err);
    fs.writeFileSync(path.join(out, "validation-error.txt"), err.stack);
    fs.writeFileSync(
      path.join(out, "validation.json"),
      JSON.stringify(
        { checks, rendererMessages: errors, error: err.message },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  })
  .finally(() => {
    require(
      path.join(root, "dist-electron/main/inputManager.js"),
    ).shutdownInputManager();
    app.exit(process.exitCode || 0);
  });
