const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, ".."),
  out = path.join(root, "artifacts/admin-browser");
fs.mkdirSync(out, { recursive: true });
app.setPath("userData", path.join(out, "electron-profile"));
const checks = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const input = new Promise((resolve, reject) => {
  let raw = "";
  const socket = require("net").createConnection(process.env.COFFEE_TEST_PIPE);
  socket.on("data", (data) => (raw += data));
  socket.on("end", () => {
    try {
      resolve(JSON.parse(raw));
    } catch (error) {
      reject(error);
    }
  });
  socket.on("error", reject);
});
function check(name, ok) {
  checks.push({ name, passed: !!ok });
  console.log((ok ? "PASS " : "FAIL ") + name);
  if (!ok) throw new Error(name);
}
async function js(win, expression) {
  return win.webContents.executeJavaScript(
    typeof expression === "function"
      ? "(" + expression.toString() + ")()"
      : expression,
    true,
  );
}
async function until(win, expression) {
  for (let i = 0; i < 150; i++) {
    if (await js(win, expression)) return true;
    await sleep(100);
  }
  return false;
}
async function fill(win, selector, value) {
  if (
    !(await until(
      win,
      "!!document.querySelector(" + JSON.stringify(selector) + ")",
    ))
  )
    throw new Error("Field not found: " + selector);
  await js(
    win,
    "(()=>{const el=document.querySelector(" +
      JSON.stringify(selector) +
      ');const proto=el.tagName==="TEXTAREA"?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,"value").set.call(el,' +
      JSON.stringify(value) +
      ');el.dispatchEvent(new Event("input",{bubbles:true}));})()',
  );
}
async function click(win, text) {
  if (
    !(await until(
      win,
      '[...document.querySelectorAll("button")].some(b=>b.textContent.trim()===' +
        JSON.stringify(text) +
        ")",
    ))
  )
    throw new Error("Button not found: " + text);
  await js(
    win,
    '(()=>{const b=[...document.querySelectorAll("button")].find(b=>b.textContent.trim()===' +
      JSON.stringify(text) +
      ");b.click();})()",
  );
}
async function capture(win, name) {
  win.showInactive();
  await js(win, "document.fonts.ready.then(()=>true)");
  await sleep(250);
  fs.writeFileSync(
    path.join(out, name + ".png"),
    (await win.webContents.capturePage()).toPNG(),
  );
  win.hide();
}
async function run() {
  const data = await input;
  const {
    registerDeviceSecurity,
  } = require("../dist-electron/main/deviceSecurity");
  registerDeviceSecurity();
  require("../dist-electron/main/inputManager").registerInputIpcHandlers();
  require("../dist-electron/main/ipcHandlers").registerIpcHandlers();
  const settingsPath = path.join(
    app.getPath("userData"),
    "device-security-v2.json",
  );
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(
    settingsPath,
    JSON.stringify({
      url: data.origin.replace("http:", "ws:") + "/ws",
      enabled: false,
      identities: {},
    }),
  );
  const client = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    frame: false,
    webPreferences: {
      preload: path.join(root, "dist-electron/main/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  await client.loadFile(path.join(root, "dist-electron/renderer/index.html"));
  check(
    "Updated client authenticates against configured server",
    await until(client, '!!document.querySelector(".access-badge.is-ready")'),
  );
  const clientId = await js(
    client,
    'document.querySelector(".local-id").textContent.trim().replaceAll(" ","-")',
  );
  await fill(client, "#remote-id", data.peer);
  await js(client, 'document.querySelector(".connect-form").requestSubmit()');
  check(
    "Client opens authorized session",
    await until(client, '!!document.querySelector(".session-stage")'),
  );
  await click(client, "Denunciar");
  check(
    "Report action available during session",
    await until(client, '!!document.querySelector("textarea")'),
  );
  await fill(
    client,
    "textarea",
    "Solicitação suspeita observada no teste de administração.",
  );
  await js(
    client,
    'document.querySelector(".modal-body form").requestSubmit()',
  );
  check(
    "In-app report receives server acknowledgment",
    await until(
      client,
      'document.body.textContent.includes("Denúncia recebida")',
    ),
  );
  await capture(client, "client-report");
  await click(client, "Concluir");
  const admin = new BrowserWindow({
    width: 1440,
    height: 980,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  await admin.loadURL(data.origin + "/admin/");
  await until(admin, '!!document.querySelector(".login-card")');
  await capture(admin, "login");
  await fill(admin, "input[autocomplete=username]", data.username);
  await fill(admin, "input[type=password]", data.password);
  await fill(admin, "input[autocomplete=one-time-code]", data.code);
  await js(admin, 'document.querySelector("form").requestSubmit()');
  check(
    "Panel login with password and TOTP",
    await until(admin, '!!document.querySelector(".admin-shell")'),
  );
  check(
    "Panel renders real device records",
    await until(admin, 'document.querySelectorAll("tbody tr").length===4'),
  );
  await capture(admin, "devices");
  await fill(admin, ".search input", data.target);
  check(
    "Device search filters real records",
    await until(admin, 'document.querySelectorAll("tbody tr").length===1'),
  );
  await click(admin, "Detalhes");
  await click(admin, "Bloquear temporariamente");
  await fill(admin, "textarea", "Bloqueio aplicado pelo teste do painel.");
  await click(admin, "Confirmar decisão");
  check(
    "Temporary block displayed after server save",
    await until(admin, '!!document.querySelector(".detail-id .blocked")'),
  );
  await click(admin, "Desbloquear / reverter");
  await fill(admin, "textarea", "Reversão autorizada pelo teste do painel.");
  await click(admin, "Confirmar decisão");
  check(
    "Unblock displayed after server save",
    await until(admin, '!!document.querySelector(".detail-id .active")'),
  );
  await js(admin, () =>
    document.querySelector('.dialog button[aria-label="Fechar"]').click(),
  );
  await click(admin, "Denúncias");
  check(
    "Report from app appears in panel",
    await until(admin, 'document.querySelectorAll("tbody tr").length===1'),
  );
  await click(admin, "Analisar");
  await capture(admin, "review-report");
  await js(admin, () => {
    const select = document.querySelector(".dialog select");
    select.value = "substantiated";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await fill(admin, "textarea", "Relato analisado pelo teste administrativo.");
  await click(admin, "Confirmar decisão");
  check(
    "Manual report decision updates list",
    await until(admin, '!!document.querySelector("tbody .substantiated")'),
  );
  await click(admin, "Dispositivos");
  await fill(admin, ".search input", clientId);
  await until(admin, 'document.querySelectorAll("tbody tr").length===1');
  await click(admin, "Detalhes");
  await click(admin, "Banir");
  check(
    "Ban button disabled until explicit ID confirmation",
    await js(
      admin,
      'document.querySelectorAll(".dialog")[1].querySelector("button.danger").disabled',
    ),
  );
  await fill(
    admin,
    ".dialog textarea",
    "Banimento de teste para validar revogação real.",
  );
  await fill(admin, ".dialog form input", clientId);
  await capture(admin, "ban-confirmation");
  await click(admin, "Confirmar decisão");
  check(
    "Ban displayed after persistence",
    await until(admin, '!!document.querySelector(".detail-id .banned")'),
  );
  check(
    "Official client closes revoked active session",
    await until(
      client,
      '!!document.querySelector(".dashboard-home") && !!document.querySelector(".server-alert")',
    ),
  );
  check(
    "Official client native control is paused after revocation",
    await js(
      client,
      "window.electronAPI.getInputControlStatus().then(s=>!s.enabled)",
    ),
  );
  await capture(client, "client-banned");
  await js(admin, () =>
    document.querySelector('.dialog button[aria-label="Fechar"]').click(),
  );
  await click(admin, "Auditoria");
  check(
    "Decisions visible in audit trail",
    await until(admin, 'document.querySelectorAll("tbody tr").length>=5'),
  );
  await capture(admin, "audit");
  await js(admin, () => {
    document.querySelector(".admin-shell main").scrollIntoView();
  });
  for (const [width, height] of [
    [1440, 980],
    [1024, 768],
    [600, 900],
  ]) {
    admin.setContentSize(width, height);
    await sleep(150);
    check(
      "Panel body has no horizontal overflow at " + width,
      await js(admin, "document.documentElement.scrollWidth<=innerWidth"),
    );
    await capture(admin, "panel-" + width);
  }
  await js(admin, () => document.querySelector("button").focus());
  admin.webContents.sendInputEvent({ type: "keyDown", keyCode: "Tab" });
  admin.webContents.sendInputEvent({ type: "keyUp", keyCode: "Tab" });
  check(
    "Panel supports keyboard focus",
    await js(admin, 'document.activeElement.tagName === "BUTTON"'),
  );
  await click(admin, "Sair da sessão");
  check(
    "Logout returns to restricted login",
    await until(admin, '!!document.querySelector(".login-card")'),
  );
  fs.writeFileSync(
    path.join(out, "browser.json"),
    JSON.stringify({ clientId, checks }, null, 2),
  );
  admin.destroy();
  client.destroy();
  require("../dist-electron/main/inputManager").shutdownInputManager();
}
app
  .whenReady()
  .then(run)
  .catch((error) => {
    console.error(error);
    fs.writeFileSync(path.join(out, "browser-error.txt"), String(error));
    fs.writeFileSync(
      path.join(out, "browser.json"),
      JSON.stringify({ checks, error: String(error) }, null, 2),
    );
    process.exitCode = 1;
  })
  .finally(() => app.exit(process.exitCode || 0));
