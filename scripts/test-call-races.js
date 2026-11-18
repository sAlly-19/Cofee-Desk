// Real call hook, mocked UI/native adapters. No capture, clipboard or real server.
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  Module = require("node:module"),
  ts = require("typescript"),
  crypto = require("node:crypto");
const original = Module._load;
Module._load = function (id, ...args) {
  if (id === "react")
    return {
      useState: (x) => [x, () => {}],
      useRef: (x) => ({ current: x }),
      useEffect: () => {},
      useCallback: (f) => f,
    };
  if (id.includes("ModalContext"))
    return {
      useModal: () => ({ showToast: () => {}, showConfirm: async () => true }),
    };
  return original.call(this, id, ...args);
};
const filename = path.resolve("src/renderer/hooks/useCallManager.ts"),
  m = new Module(filename, module);
m.filename = filename;
m.paths = module.paths;
// The hook's shared imports are compiled separately to preserve the actual validators.
Module._load = function (id, ...args) {
  if (id === "../../shared/session")
    return require("../dist-electron/shared/session");
  if (id === "../../shared/signalingCompatibility")
    return require("../dist-electron/shared/signalingCompatibility");
  if (id === "react")
    return {
      useState: (x) => [x, () => {}],
      useRef: (x) => ({ current: x }),
      useEffect: () => {},
      useCallback: (f) => f,
    };
  if (id.includes("ModalContext"))
    return {
      useModal: () => ({ showToast: () => {}, showConfirm: async () => true }),
    };
  return original.call(this, id, ...args);
};
m._compile(
  ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText,
  filename,
);
let passed = 0;
const check = (n, v) => {
  assert.ok(v, n);
  passed++;
  console.log("PASS " + n);
};
global.localStorage = {
  getItem: () => "wss://fixture.invalid/ws",
  removeItem: () => {},
};
function harness({ sources, verify } = {}) {
  const h = { sent: [], selections: 0 };
  global.window = {
    dispatchEvent: () => {},
    electronAPI: {
      historyWrite: async (_scope, e) => e,
      setSessionPending: async () => true,
      confirmSession: async () => true,
      toggleInputControl: async () => false,
      notifyIncomingCall: async () => true,
      verifyAccessPassword: verify || (async () => false),
      getSecuritySettings: async () => ({
        unattendedPermissions: {
          control: false,
          clipboard: false,
          files: false,
        },
      }),
      getDesktopSources:
        sources || (async () => [{ id: "screen:fixture", isPrimary: true }]),
      startDesktopStream: async () => {
        h.selections++;
        return { kind: "screen" };
      },
    },
  };
  h.hook = m.exports.useCallManager({
    myId: "111-222-333",
    serverStatus: "connected",
    sendWsMessage: (msg) => h.sent.push(msg),
  });
  return h;
}
const incoming = (callId, password) => ({
  type: "incoming-call",
  fromId: "444-555-666",
  callId,
  password,
});
(async () => {
  let release;
  let h = harness({ sources: () => new Promise((r) => (release = r)) });
  const old = crypto.randomUUID(),
    fresh = crypto.randomUUID();
  await h.hook.handleCallSignalingMessage(incoming(old));
  const stale = h.hook.acceptIncomingCall("444-555-666");
  await h.hook.handleCallSignalingMessage({ type: "call-rejected" });
  await h.hook.handleCallSignalingMessage(incoming(fresh));
  release([{ id: "screen:fixture", isPrimary: true }]);
  await stale;
  check(
    "Delayed source selection cannot accept a newer call from same peer",
    h.selections === 0 && !h.sent.some((m) => m.type === "call-accepted"),
  );
  await h.hook.handleCallSignalingMessage({ type: "peer-disconnected" });
  let verified;
  h = harness({ verify: () => new Promise((r) => (verified = r)) });
  const pending = h.hook.handleCallSignalingMessage(
    incoming(crypto.randomUUID(), "fixture-only"),
  );
  await h.hook.handleCallSignalingMessage({ type: "call-rejected" });
  await h.hook.handleCallSignalingMessage(incoming(crypto.randomUUID()));
  verified(true);
  await pending;
  check(
    "Old password verification cannot authorize replacement call",
    h.selections === 0 && !h.sent.some((m) => m.type === "call-accepted"),
  );
  await h.hook.handleCallSignalingMessage({ type: "peer-disconnected" });
  h = harness();
  const valid = crypto.randomUUID();
  await h.hook.handleCallSignalingMessage(incoming(valid));
  await h.hook.acceptIncomingCall("444-555-666");
  check(
    "Acceptance carries the original immutable call identifier",
    h.sent.some((m) => m.type === "call-accepted" && m.callId === valid),
  );
  await h.hook.handleCallSignalingMessage({ type: "peer-disconnected" });
  console.log(passed + " call race checks passed");
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => {
    Module._load = original;
  });
