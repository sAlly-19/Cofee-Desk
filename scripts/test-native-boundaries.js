// No real shell launch, network, desktop capture or native input. Exercise production handlers.
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const Module = require("node:module"),
  { EventEmitter } = require("node:events");
const original = Module._load,
  handlers = new Map();
const out = path.resolve("artifacts/native-boundaries-" + process.pid);
fs.mkdirSync(out, { recursive: true });
let trusted = true,
  launches = 0,
  confirmations = 0,
  answer = 0,
  shellError = "";
let sourceListing = async () => [];
const display = { id: 7, bounds: { x: 0, y: 0, width: 100, height: 100 } };
const owner = Object.assign(new EventEmitter(), {
  id: 9001,
  isDestroyed: () => false,
  send: () => {},
});
Module._load = function (id, ...args) {
  if (id === "electron")
    return {
      ipcMain: { handle: (n, f) => handlers.set(n, f), on: () => {} },
      app: { getPath: () => out },
      clipboard: {},
      desktopCapturer: { getSources: () => sourceListing() },
      screen: {
        getPrimaryDisplay: () => display,
        getAllDisplays: () => [display],
        dipToScreenRect: (_window, bounds) => bounds,
      },
      BrowserWindow: { fromWebContents: () => ({}) },
      dialog: {
        showMessageBox: async () => {
          confirmations++;
          return { response: answer };
        },
      },
      shell: {
        openPath: async () => {
          launches++;
          return shellError;
        },
      },
    };
  if (id === "./ipcSecurity")
    return {
      assertTrusted: () => {
        if (!trusted) throw Error("Untrusted");
      },
    };
  if (id === "./deviceClipboard") return { registerDeviceClipboard: () => {} };
  if (id === "./store") return { store: { get: () => {}, set: () => {} } };
  if (id === "./deviceSecurity")
    return {
      deviceAuthentication: () => ({
        url: "wss://fixture.invalid/ws",
        publicKey: async () => "fixture-public",
        sign: async () => "fixture-signature",
      }),
    };
  return original.call(this, id, ...args);
};
const auth = require("../dist-electron/main/sessionAuthority");
auth.registerSessionAuthority();
require("../dist-electron/main/ipcHandlers").registerIpcHandlers();
const event = { sender: owner },
  call = crypto.randomUUID(),
  full = { control: true, clipboard: true, files: true },
  view = { control: false, clipboard: false, files: false };
let passed = 0;
const check = (name, value) => {
  assert.ok(value, name);
  passed++;
  console.log("PASS " + name);
};
(async () => {
  assert.throws(() =>
    handlers.get("session:confirmed")(event, {
      callId: call,
      role: "host",
      permissions: full,
    }),
  );
  check(
    "Renderer cannot create native authority",
    !auth.nativeSession(owner.id),
  );
  auth.setNativeSession(owner.id, {
    callId: call,
    role: "host",
    permissions: full,
  });
  handlers.get("session:confirmed")(event, {
    callId: call,
    role: "host",
    permissions: view,
  });
  assert.throws(() =>
    handlers.get("session:confirmed")(event, {
      callId: call,
      role: "host",
      permissions: full,
    }),
  );
  check(
    "Renderer cannot restore revoked permissions",
    !auth.hasPermission(owner.id, "files"),
  );
  assert.throws(() =>
    handlers.get("session:confirmed")(event, {
      callId: call,
      role: "client",
      permissions: view,
    }),
  );
  check(
    "Renderer cannot switch native role",
    auth.nativeSession(owner.id).role === "host",
  );
  auth.setNativeSession(owner.id, {
    callId: call,
    role: "client",
    permissions: full,
  });
  let r = await handlers.get("file:openFile")(event, "package.json");
  check(
    "Opening unrelated path is denied before dialog or shell",
    !r.success && launches === 0 && confirmations === 0,
  );
  r = await handlers.get("file:saveToDownloads")(event, {
    fileName: "fixture.txt",
    base64Data: Buffer.from("fixture").toString("base64"),
  });
  assert.ok(r.success);
  const file = r.filePath;
  r = await handlers.get("file:openFile")(event, file);
  check(
    "Native cancel prevents opening received file",
    !r.success && launches === 0 && confirmations === 1,
  );
  answer = 1;
  shellError = "Simulated OS failure";
  r = await handlers.get("file:openFile")(event, file);
  check(
    "Shell failure never reports successful opening",
    !r.success && launches === 1,
  );
  trusted = false;
  r = await handlers.get("file:openFile")(event, file);
  check(
    "Untrusted frame cannot open received file",
    !r.success && launches === 1,
  );
  trusted = true;
  r = await handlers.get("file:saveToDownloads")(event, {
    fileName: "fixture.exe",
    base64Data: "YQ==",
  });
  assert.ok(r.success);
  r = await handlers.get("file:openFile")(event, r.filePath);
  check(
    "Executable received cannot launch through bridge",
    !r.success && launches === 1,
  );
  const {
    NativeSignalingConnection,
  } = require("../dist-electron/main/signalingTransport");
  let socket;
  const make = () =>
    (socket = {
      readyState: 1,
      bufferedAmount: 0,
      sent: [],
      send(raw) {
        this.sent.push(JSON.parse(raw));
      },
      close() {
        this.readyState = 3;
      },
    });
  auth.setNativeSession(owner.id);
  const connection = new NativeSignalingConnection(
    owner,
    crypto.randomUUID(),
    out,
    make,
  );
  await connection.start();
  socket.onopen();
  const receive = async (m) => {
    socket.onmessage({ data: JSON.stringify(m) });
    await connection.tail;
  };
  await receive({ type: "challenge", nonce: "fixture", audience: "fixture" });
  await receive({
    type: "registered",
    version: 2,
    id: "111-222-333",
    capabilities: ["session-permissions-v1"],
  });
  connection.send({ type: "connect-request", targetId: "444-555-666" });
  check("Main owns pending-call busy state", auth.isNativeBusy());
  handlers.get("session:confirmed")(event, null);
  check("Renderer cannot clear transport busy state", auth.isNativeBusy());
  await receive({
    type: "call-ringing",
    callId: call,
    targetId: "444-555-666",
  });
  check(
    "Pending real socket call does not authorize files",
    !auth.hasPermission(owner.id, "files"),
  );
  await receive({
    type: "call-accepted",
    callId: call,
    fromId: "777-888-999",
    role: "client",
    sourceKind: "screen",
    permissions: full,
  });
  check(
    "Wrong participant cannot grant native authority",
    !auth.nativeSession(owner.id),
  );
  await receive({
    type: "call-accepted",
    callId: call,
    fromId: "444-555-666",
    role: "client",
    sourceKind: "screen",
    permissions: full,
  });
  check(
    "Socket acceptance authorizes matching call and role",
    auth.hasPermission(owner.id, "files") &&
      auth.nativeSession(owner.id).role === "client",
  );
  assert.throws(() =>
    connection.send({
      type: "permissions-update",
      callId: call,
      targetId: "444-555-666",
      sourceKind: "screen",
      permissions: full,
    }),
  );
  check("Viewer cannot grant permissions via signaling IPC", true);
  await receive({
    type: "permissions-updated",
    callId: call,
    fromId: "444-555-666",
    sourceKind: "screen",
    permissions: view,
  });
  check(
    "Socket revocation reaches main before UI",
    !auth.hasPermission(owner.id, "files"),
  );
  connection.close();
  check("Socket close clears native authority", !auth.nativeSession(owner.id));
  const hostConnection = new NativeSignalingConnection(
    owner,
    crypto.randomUUID(),
    out,
    make,
  );
  await hostConnection.start();
  socket.onopen();
  const hostReceive = async (m) => {
    socket.onmessage({ data: JSON.stringify(m) });
    await hostConnection.tail;
  };
  await hostReceive({
    type: "challenge",
    nonce: "fixture",
    audience: "fixture",
  });
  await hostReceive({
    type: "registered",
    version: 2,
    id: "111-222-333",
    capabilities: ["session-permissions-v1"],
  });
  const hostCall = crypto.randomUUID();
  await hostReceive({
    type: "incoming-call",
    callId: hostCall,
    fromId: "444-555-666",
  });
  hostConnection.send({
    type: "call-accepted",
    callId: hostCall,
    targetId: "444-555-666",
    sourceKind: "screen",
    permissions: full,
  });
  check(
    "Host intent alone cannot enable native resources",
    !auth.nativeSession(owner.id),
  );
  const sentCount = socket.sent.length;
  hostConnection.send({
    type: "call-accepted",
    callId: hostCall,
    targetId: "444-555-666",
    sourceKind: "screen",
    permissions: full,
  });
  check(
    "Duplicate host acceptance is idempotent",
    socket.sent.length === sentCount,
  );
  await hostReceive({
    type: "call-accepted",
    callId: hostCall,
    fromId: "444-555-666",
    role: "host",
    sourceKind: "screen",
    permissions: full,
  });
  check(
    "Server confirmation activates accepted host session",
    auth.nativeSession(owner.id)?.role === "host" &&
      auth.hasPermission(owner.id, "files"),
  );
  hostConnection.close();
  const {
    verifiedNativeHelper,
  } = require("../dist-electron/main/nativeIntegrity");
  fs.mkdirSync(path.join(out, "native"), { recursive: true });
  const helper = path.join(out, "native", "CoffeeInput-v2.exe");
  fs.writeFileSync(helper, "fixture executable - never launched");
  const manifest = {
    version: 1,
    files: {
      "CoffeeInput-v2.exe": crypto
        .createHash("sha256")
        .update(fs.readFileSync(helper))
        .digest("hex"),
    },
  };
  check(
    "Expected helper digest is accepted",
    verifiedNativeHelper(out, manifest) === helper,
  );
  fs.appendFileSync(helper, "tampered");
  check(
    "Tampered helper is rejected before launch",
    verifiedNativeHelper(out, manifest) === null,
  );
  check(
    "Missing helper manifest fails closed",
    verifiedNativeHelper(out, {}) === null,
  );
  auth.setNativeSession(owner.id, {
    callId: crypto.randomUUID(),
    role: "client",
    permissions: full,
  });
  const savedLog = console.log;
  console.log = (...args) => {
    if (!String(args[0]).startsWith("[FileTransfer]")) savedLog(...args);
  };
  for (let i = 0; i < 500; i++) {
    const r = await handlers.get("file:saveToDownloads")(event, {
      fileName: "empty-" + i + ".txt",
      base64Data: "",
    });
    assert.ok(r.success);
  }
  console.log = savedLog;
  const bounded = await handlers.get("file:saveToDownloads")(event, {
    fileName: "excess.txt",
    base64Data: "",
  });
  check(
    "Received-file ledger has a per-session count ceiling",
    !bounded.success && /Limite/.test(bounded.error),
  );
  check(
    "Viewer cannot enumerate local capture sources",
    !auth.maySelectSource(owner.id),
  );
  auth.setNativeSession(owner.id, {
    callId: crypto.randomUUID(),
    role: "host",
    permissions: full,
  });
  let resolveSources;
  sourceListing = () => new Promise((resolve) => (resolveSources = resolve));
  const screens = require("../dist-electron/main/screenManager");
  const sourceRequest = screens.selectDesktopSource(owner.id, "screen:fixture");
  auth.setNativeSession(owner.id, {
    callId: crypto.randomUUID(),
    role: "host",
    permissions: full,
  });
  const sourceFixture = [
    {
      id: "screen:fixture",
      display_id: "7",
      name: "Fixture monitor",
      thumbnail: { toDataURL: () => "data:" },
    },
  ];
  resolveSources(sourceFixture);
  await assert.rejects(sourceRequest);
  check(
    "Source enumeration cannot commit into a replacement call",
    !auth.selectedSource(owner.id),
  );
  sourceListing = async () => sourceFixture;
  await screens.selectDesktopSource(owner.id, "screen:fixture");
  check(
    "Current authorized host can select its source",
    auth.selectedSource(owner.id)?.sourceId === "screen:fixture",
  );
  const activeState = auth.nativeSession(owner.id);
  handlers.get("session:confirmed")(event, activeState);
  owner.emit("render-process-gone");
  check(
    "Renderer process loss revokes native permissions",
    !auth.hasPermission(owner.id, "files"),
  );
  console.log(passed + " native boundary checks passed");
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => {
    Module._load = original;
  });
