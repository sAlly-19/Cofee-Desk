const { spawn } = require("node:child_process");
const path = require("node:path");
const env = { ...process.env, COFFEE_TEST_LOCAL_SIGNALING: "1" };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(
  require("electron"),
  [path.join(__dirname, "test-history-worker.js")],
  { env, stdio: "inherit", windowsHide: true },
);
const timer = setTimeout(() => {
  child.kill();
  process.exitCode = 1;
}, 120000);
child.once("exit", (code) => {
  clearTimeout(timer);
  process.exitCode = code ?? 1;
});
child.once("error", () => {
  clearTimeout(timer);
  process.exitCode = 1;
});
