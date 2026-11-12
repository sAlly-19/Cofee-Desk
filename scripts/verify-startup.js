const { spawn } = require("child_process");
const path = require("path");
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
env.COFFEE_TEST_LOCAL_SIGNALING = "1";
const child = spawn(
  require("electron"),
  [path.join(__dirname, "startup-smoke-worker.js")],
  {
    env,
    stdio: "inherit",
    windowsHide: true,
  },
);
child.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
