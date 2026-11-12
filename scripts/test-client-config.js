const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync, execFileSync } = require("node:child_process");
const { validateEndpoint } = require("./client-config");
const root = path.resolve(__dirname, "..");
fs.mkdirSync(path.join(root, "artifacts"), { recursive: true });
const dir = fs.mkdtempSync(path.join(root, "artifacts/client-config-check-"));
fs.mkdirSync(path.join(dir, "scripts"));
fs.mkdirSync(path.join(dir, "dist-electron/shared"), { recursive: true });
for (const file of [
  "client-config.js",
  "configure-client-build.js",
  "assert-client-config.js",
])
  fs.copyFileSync(path.join(__dirname, file), path.join(dir, "scripts", file));
const checks = [];
function check(name, condition) {
  assert.ok(condition, name);
  checks.push(name);
  console.log("PASS " + name);
}
const base = { ...process.env };
delete base.COFFEE_OFFICIAL_SIGNALING_URL;
function run(script, env = base) {
  return spawnSync(process.execPath, [path.join(dir, "scripts", script)], {
    cwd: dir,
    env,
    encoding: "utf8",
    windowsHide: true,
  });
}
function output() {
  return fs.readFileSync(
    path.join(dir, "dist-electron/shared/publicService.js"),
    "utf8",
  );
}
check(
  "Packaging fails without private configuration",
  run("assert-client-config.js").status !== 0,
);
check(
  "Local development works without deployment configuration",
  run("configure-client-build.js").status === 0 && output().includes('= "";'),
);
fs.writeFileSync(
  path.join(dir, ".env.client.local"),
  "COFFEE_OFFICIAL_SIGNALING_URL=wss://local-config.example/ws\n",
);
let result = run("configure-client-build.js");
check(
  "Ignored local file supplies build endpoint",
  result.status === 0 && output().includes("wss://local-config.example/ws"),
);
check(
  "Build logs omit address",
  !result.stdout.includes("local-config.example"),
);
check(
  "Configured release passes guard",
  run("assert-client-config.js").status === 0,
);
result = run("configure-client-build.js", {
  ...base,
  COFFEE_OFFICIAL_SIGNALING_URL: "wss://ci-config.example/ws",
});
check(
  "CI secret takes precedence over local file",
  result.status === 0 &&
    output().includes("ci-config.example") &&
    !output().includes("local-config.example"),
);
for (const url of [
  "ws://plain.example/ws",
  "wss://user:password@private.example/ws",
  "wss://query.example/ws?token=x",
  "wss://fragment.example/ws#x",
  "wss://path.example/other",
]) {
  assert.throws(() => validateEndpoint(url));
}
check("Unsafe endpoints are rejected", true);
result = run("configure-client-build.js", {
  ...base,
  COFFEE_OFFICIAL_SIGNALING_URL:
    "wss://secret-user:secret-pass@invalid.example/ws",
});
check(
  "Invalid config fails without exposing values",
  result.status !== 0 &&
    !result.stderr.includes("secret-pass") &&
    !result.stderr.includes("invalid.example"),
);
check(
  "Endpoint normalized to signaling route",
  validateEndpoint("wss://normalize.example") === "wss://normalize.example/ws",
);
check(
  "Private config is ignored by Git",
  execFileSync("git", ["check-ignore", ".env.client.local"], {
    cwd: root,
    encoding: "utf8",
  }).trim() === ".env.client.local",
);
check(
  "Tracked source contains placeholder only",
  fs
    .readFileSync(path.join(root, "src/shared/publicService.ts"), "utf8")
    .includes('= "";'),
);
fs.writeFileSync(
  path.join(dir, "validation.json"),
  JSON.stringify({ passed: checks.length, checks }, null, 2),
);
