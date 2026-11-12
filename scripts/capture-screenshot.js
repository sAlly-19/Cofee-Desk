const { spawn } = require("child_process");
const path = require("path");
const http = require("http");
const fs = require("fs");
const electron = require("electron");
const root = path.resolve(__dirname, "..");
const verify = process.argv.includes("--verify");
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
env.COFFEE_TEST_LOCAL_SIGNALING = "1";
let server;
let stopDatabase;
function online() {
  return new Promise((resolve) => {
    const req = http.get("http://localhost:8080/health", (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}
(async () => {
  fs.mkdirSync(path.join(root, "artifacts/redesign"), { recursive: true });
  if (verify && !(await online())) {
    const { localDatabase } = await import("./local-database.mjs");
    const db = await localDatabase("electron-postgres");
    stopDatabase = db.stop;
    env.DATABASE_URL = db.url;
    env.ADMIN_ENCRYPTION_KEY = require("crypto")
      .randomBytes(32)
      .toString("hex");
    server = spawn(
      process.execPath,
      [path.join(root, "signaling-server/dist/index.js")],
      {
        cwd: root,
        stdio: ["ignore", "ignore", "inherit"],
        windowsHide: true,
        env,
      },
    );
    server.on("error", (err) => console.error(err));
    for (let i = 0; i < 40 && !(await online()); i++)
      await new Promise((resolve) => setTimeout(resolve, 250));
    if (!(await online()))
      throw new Error("Local signaling server did not start.");
  }
  const child = spawn(
    electron,
    [
      path.join(__dirname, "screenshot-worker.js"),
      ...(verify ? ["--verify"] : []),
      ...(process.argv.includes("--icons") ? ["--icons"] : []),
    ],
    { cwd: root, stdio: "inherit", env, windowsHide: true },
  );
  child.on("error", (err) => {
    console.error(err);
    server?.kill();
    void stopDatabase?.();
    process.exitCode = 1;
  });
  child.on("exit", async (code) => {
    server?.kill();
    await stopDatabase?.();
    process.exitCode = code ?? 1;
  });
})().catch(async (err) => {
  console.error(err);
  server?.kill();
  await stopDatabase?.();
  process.exitCode = 1;
});
