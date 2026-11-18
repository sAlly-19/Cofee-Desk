// Actual scrypt verification with an isolated fixture profile, no Electron GUI or real secrets.
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  assert = require("node:assert/strict"),
  Module = require("node:module"),
  { pathToFileURL } = require("node:url");
const out = path.resolve("artifacts/password-races-" + process.pid);
fs.mkdirSync(out, { recursive: true });
const handlers = new Map(),
  original = Module._load;
Module._load = function (id, ...args) {
  if (id === "electron")
    return {
      app: { isPackaged: false, getPath: () => out },
      ipcMain: { handle: (n, f) => handlers.set(n, f) },
      safeStorage: {},
    };
  return original.call(this, id, ...args);
};
(async () => {
  const salt = crypto.randomBytes(16).toString("hex"),
    password = "fixture-only-password-2026";
  const key = await new Promise((resolve, reject) =>
    crypto.scrypt(
      password,
      salt,
      64,
      { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (e, b) => (e ? reject(e) : resolve(b)),
    ),
  );
  const state = {
    url: "ws://localhost:8080/ws",
    enabled: true,
    verifier: salt + ":" + key.toString("hex"),
    identities: {},
  };
  const file = path.join(out, "device-security-v2.json"),
    write = (s) => fs.writeFileSync(file, JSON.stringify(s));
  write(state);
  require("../dist-electron/main/deviceSecurity").registerDeviceSecurity();
  const frame = {
    url: pathToFileURL(path.resolve("dist-electron/renderer/index.html")).href,
  };
  const event = { senderFrame: frame, sender: { mainFrame: frame } };
  const verify = () =>
    handlers.get("security:verify-password")(event, password);
  const check = (n, v) => {
    assert.ok(v, n);
    console.log("PASS " + n);
  };
  const disabled = verify();
  write({ ...state, enabled: false });
  check(
    "Disabling unattended access invalidates in-flight password verification",
    (await disabled) === false,
  );
  write(state);
  const changed = verify();
  write({
    ...state,
    verifier: salt + ":" + crypto.randomBytes(64).toString("hex"),
  });
  check(
    "Password change invalidates in-flight verification",
    (await changed) === false,
  );
  write(state);
  check(
    "Unchanged authorized password still verifies",
    (await verify()) === true,
  );
  console.log("3 password race checks passed");
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => {
    Module._load = original;
  });
