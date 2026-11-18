const { spawn } = require("node:child_process"),
  path = require("node:path");
const env = { ...process.env, COFFEE_TEST_LOCAL_SIGNALING: "1" };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(
  require("electron"),
  [path.join(__dirname, "test-capture-policy-worker.js")],
  { env, stdio: "inherit", windowsHide: true },
);
const timer = setTimeout(() => {
  child.kill();
  process.exitCode = 1;
}, 30000);
child.on("error", () => {
  clearTimeout(timer);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  clearTimeout(timer);
  process.exitCode = code || 0;
});
