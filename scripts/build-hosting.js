// The hosting build deliberately excludes Electron packaging and native helpers.
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const cli =
  process.env.npm_execpath ||
  (process.platform === "win32"
    ? path.join(
        path.dirname(process.execPath),
        "node_modules/npm/bin/npm-cli.js",
      )
    : path.resolve(
        path.dirname(process.execPath),
        "../lib/node_modules/npm/bin/npm-cli.js",
      ));
for (const args of [
  ["ci", "--ignore-scripts", "--include=dev"],
  ["ci", "--ignore-scripts", "--include=dev", "--prefix", "signaling-server"],
  ["run", "build:server"],
  ["run", "build:admin"],
]) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    stdio: "inherit",
    windowsHide: true,
    env: { ...process.env, ELECTRON_SKIP_BINARY_DOWNLOAD: "1" },
  });
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}
