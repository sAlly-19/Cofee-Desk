// Real hook with deterministic React adapters; never writes files or sends network traffic.
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  Module = require("node:module"),
  ts = require("typescript");
const original = Module._load;
let rendering;
Module._load = function (id, ...args) {
  if (id === "react")
    return {
      useRef: (value) => ({ current: value }),
      useCallback: (fn) => fn,
      useEffect: (fn) => {
        const h = rendering,
          cleanup = fn();
        if (cleanup) h.cleanups.push(cleanup);
      },
      useState: (value) => {
        const h = rendering,
          index = h.states.length;
        h.states.push(value);
        return [
          value,
          (next) => {
            h.states[index] =
              typeof next === "function" ? next(h.states[index]) : next;
          },
        ];
      },
    };
  if (id.includes("ModalContext"))
    return { useModal: () => ({ showToast: () => {}, showAlert: () => {} }) };
  return original.call(this, id, ...args);
};
const filename = path.resolve("src/renderer/hooks/useFileTransfer.ts"),
  mod = new Module(filename, module);
mod.filename = filename;
mod.paths = module.paths;
mod._compile(
  ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText,
  filename,
);
const flush = () => new Promise((resolve) => setTimeout(resolve, 15));
let passed = 0;
const check = (name, ok) => {
  assert.ok(ok, name);
  passed++;
  console.log("PASS " + name);
};
function harness(
  save = async () => ({ success: true, filePath: "simulated" }),
) {
  const h = {
    states: [],
    cleanups: [],
    messages: [],
    listeners: new Map(),
    saves: 0,
  };
  h.channel = {
    readyState: "open",
    bufferedAmount: 0,
    send: (raw) => h.messages.push(JSON.parse(raw)),
    addEventListener: (n, f) => {
      if (!h.listeners.has(n)) h.listeners.set(n, new Set());
      h.listeners.get(n).add(f);
    },
    removeEventListener: (n, f) => h.listeners.get(n)?.delete(f),
  };
  global.window = {
    electronAPI: {
      saveFileToDownloads: async (...args) => {
        h.saves++;
        return save(...args);
      },
    },
  };
  rendering = h;
  h.hook = mod.exports.useFileTransfer(h.channel, true);
  rendering = null;
  h.receive = async (m) => {
    for (const f of h.listeners.get("message") || [])
      await f({ data: JSON.stringify(m) });
  };
  h.dispose = () => h.cleanups.forEach((f) => f());
  return h;
}
const fixtures = [];
const create = (...args) => {
  const h = harness(...args);
  fixtures.push(h);
  return h;
};
const meta = (id) => ({
  type: "file-meta",
  fileId: id,
  fileName: "fixture.txt",
  fileSize: 1,
  totalChunks: 1,
});
const chunk = (id) => ({
  type: "file-chunk",
  fileId: id,
  chunkIndex: 0,
  data: "YQ==",
});
(async () => {
  let h = create();
  await h.receive(meta("cancel"));
  h.hook.cancelTransfer("cancel");
  await h.receive(chunk("cancel"));
  await h.receive({ type: "file-done", fileId: "cancel" });
  check("Cancelled incoming transfer cannot write a file", h.saves === 0);
  check(
    "Local cancellation notifies peer",
    h.messages.some((m) => m.type === "file-cancel" && m.fileId === "cancel"),
  );
  h = create();
  await h.receive(meta("valid"));
  await h.receive(chunk("valid"));
  await h.receive({ type: "file-done", fileId: "valid" });
  check(
    "Persistence success sends delivery acknowledgment",
    h.saves === 1 && h.messages.some((m) => m.type === "file-ack"),
  );
  await h.receive({ type: "file-done", fileId: "valid" });
  check("Duplicate completion cannot save twice", h.saves === 1);
  h = create(async () => ({ success: false }));
  await h.receive(meta("disk"));
  await h.receive(chunk("disk"));
  await h.receive({ type: "file-done", fileId: "disk" });
  check(
    "Disk failure notifies sender and never acknowledges delivery",
    h.messages.some((m) => m.type === "file-error") &&
      !h.messages.some((m) => m.type === "file-ack"),
  );
  h = create();
  await h.receive(meta("missing"));
  await h.receive({ type: "file-done", fileId: "missing" });
  check(
    "Incomplete payload never reaches native save",
    h.saves === 0 && h.messages.some((m) => m.type === "file-error"),
  );
  let release;
  h = create(() => new Promise((r) => (release = r)));
  await h.receive(meta("race"));
  await h.receive(chunk("race"));
  const pending = h.receive({ type: "file-done", fileId: "race" });
  await flush();
  await h.receive({ type: "file-done", fileId: "race" });
  check("Concurrent duplicate completion cannot save twice", h.saves === 1);
  release({ success: true, filePath: "simulated" });
  await pending;
  h = create();
  const large = (id) => ({
    ...meta(id),
    fileSize: 32 * 1024 * 1024,
    totalChunks: 1024,
  });
  await h.receive(large("one"));
  await h.receive(large("two"));
  await h.receive(large("three"));
  check(
    "Incoming aggregate metadata is capped at 64 MiB",
    h.states[0].length === 2,
  );
  h = create();
  const file = Object.assign(new Blob(["fixture"]), { name: "fixture.txt" });
  h.hook.sendFiles([file]);
  await flush();
  const sent = h.messages.find((m) => m.type === "file-meta");
  check(
    "Sent bytes wait for receiver acknowledgment",
    h.states[0][0].status === "sending" &&
      h.states[0][0].awaitingConfirmation === true,
  );
  await h.receive({ type: "file-ack", fileId: "unrelated" });
  await flush();
  check(
    "Unknown acknowledgment cannot complete transfer",
    h.states[0][0].status === "sending",
  );
  await h.receive({ type: "file-ack", fileId: sent.fileId });
  await flush();
  check(
    "Matching receiver acknowledgment completes transfer",
    h.states[0][0].status === "complete",
  );
  h = create();
  h.hook.sendFiles([file]);
  await flush();
  const sentError = h.messages.find((m) => m.type === "file-meta");
  await h.receive({ type: "file-error", fileId: sentError.fileId });
  await flush();
  check(
    "Remote persistence failure reaches sender error state",
    h.states[0][0].status === "error",
  );
  h = create(); h.channel.bufferedAmount = 300000; h.hook.sendFiles([file]); await flush(); const blocked = h.messages.find(m=>m.type === "file-meta"); h.hook.cancelTransfer(blocked.fileId); await new Promise(r=>setTimeout(r,150)); check("Cancel interrupts stalled buffer drain without waiting for timeout",h.states[1] === false && h.states[0][0].status === "cancelled");
  console.log(passed + " transfer protocol checks passed");
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => {
    for (const h of fixtures) h.dispose();
    Module._load = original;
  });
