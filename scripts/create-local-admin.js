// Password JSON comes from stdin; no credentials appear in command-line arguments.
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const root = path.resolve(__dirname, "..");
try {
  const info = JSON.parse(
    fs.readFileSync(
      path.join(root, "artifacts/development-server/connection.json"),
      "utf8",
    ),
  );
  const child = spawn(
    process.execPath,
    [path.join(root, "signaling-server/dist/bootstrap-admin.js")],
    {
      env: {
        ...process.env,
        NODE_ENV: "development",
        DATABASE_URL: info.databaseUrl,
        ADMIN_ENCRYPTION_KEY: fs.readFileSync(info.encryptionKeyFile, "utf8"),
      },
      stdio: "inherit",
      windowsHide: true,
    },
  );
  child.on("exit", (code) => (process.exitCode = code ?? 1));
  child.on("error", () => {
    console.error("Falha ao iniciar bootstrap.");
    process.exitCode = 1;
  });
} catch {
  console.error(
    "Inicie npm run dev:secure antes de criar o administrador local.",
  );
  process.exitCode = 1;
}
