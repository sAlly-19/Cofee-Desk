const { spawn } = require("node:child_process");
const path = require("node:path");
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.COFFEE_TEST_LOCAL_SIGNALING;
const child = spawn(
  require("electron"),
  [path.join(__dirname, "verify-client-default-worker.js")],
  { env, windowsHide: true, stdio: "inherit" },
);
child.on("error", () => {
  console.error("Could not start isolated native check");
  process.exitCode = 1;
});
child.on("exit", (code) => (process.exitCode = code ?? 1));
