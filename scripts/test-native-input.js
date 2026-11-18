// Production input registrar with fake child streams: never injects input into Windows.
const assert = require("node:assert/strict"),
  Module = require("node:module"),
  { EventEmitter } = require("node:events"),
  path = require("node:path");
if (process.platform !== "win32") {
  console.log("SKIP Win32 registrar fixture on non-Windows");
  process.exit(0);
}
const original = Module._load,
  handles = new Map(),
  listeners = new Map(),
  commands = [];
let queued = 0;
const stream = Object.assign(new EventEmitter(), {
  destroyed: false,
  write: (line) => {
    commands.push(line);
    return queued < 65536;
  },
});
Object.defineProperty(stream, "writableLength", { get: () => queued });
const child = Object.assign(new EventEmitter(), {
  stdin: stream,
  stdout: new EventEmitter(),
  stderr: new EventEmitter(),
  killed: false,
});
const previous = process.resourcesPath;
process.resourcesPath = path.resolve("artifacts/native-input-fixture");
Module._load = function (id, ...args) {
  if (id === "electron")
    return {
      app: { isPackaged: false },
      ipcMain: {
        handle: (n, f) => handles.set(n, f),
        on: (n, f) => listeners.set(n, f),
      },
    };
  if (id === "child_process") return { spawn: () => child };
  if (id === "./ipcSecurity") return { assertTrusted: () => {} };
  return original.call(this, id, ...args);
};
let passed = 0;
const check = (n, v) => {
  assert.ok(v, n);
  passed++;
  console.log("PASS " + n);
};
try {
  const auth = require("../dist-electron/main/sessionAuthority"),
    input = require("../dist-electron/main/inputManager");
  input.registerInputIpcHandlers();
  child.stdout.emit("data", Buffer.from("READY VIRTUAL_MOUSE_V1"));
  const event = { sender: { id: 777 } };
  auth.setNativeSession(777, {
    callId: "11111111-1111-4111-8111-111111111111",
    role: "host",
    permissions: { control: true, clipboard: false, files: false },
    sourceKind: "screen",
    captureActive: true,
    bounds: { x: 0, y: 0, width: 100, height: 100 },
  });
  check(
    "Authorized input enables only ready native helper",
    handles.get("remote:control:toggle")(event, true) === true,
  );
  const mouse = listeners.get("remote:input:mouse");
  mouse(event, { type: "move", normX: 0.5, normY: 0.5 });
  check(
    "Authorized normalized pointer reaches fake child",
    commands.some((x) => x.startsWith("VM ")),
  );
  queued = 70000;
  const before = commands.length;
  mouse(event, { type: "move", normX: 0.6, normY: 0.6 });
  check(
    "Saturated pipe pauses control instead of growing movement queue",
    commands.length === before &&
      handles.get("remote:control:status")(event).enabled === false,
  );
  check(
    "Saturated helper cannot be reenabled by renderer",
    handles.get("remote:control:toggle")(event, true) === false,
  );
  queued = 0;
  handles.get("remote:control:toggle")(event, true);
  child.emit("error", new Error("simulated spawn failure"));
  check(
    "Async child error fails closed without throwing",
    handles.get("remote:control:status")(event).enabled === false,
  );
  stream.emit("error", new Error("simulated EPIPE"));
  check(
    "Pipe error is handled without uncaught exception",
    handles.get("remote:control:status")(event).ready === false,
  );
  console.log(passed + " native input checks passed");
} finally {
  Module._load = original;
  process.resourcesPath = previous;
}
