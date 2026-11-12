const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
(async () => {
  const { localDatabase } = await import("./local-database.mjs");
  const db = await localDatabase("development-server");
  let server;
  try {
    const keyFile = path.join(db.root, "admin-encryption.key");
    if (!fs.existsSync(keyFile))
      fs.writeFileSync(keyFile, crypto.randomBytes(32).toString("hex"), {
        mode: 0o600,
      });
    process.env.DATABASE_URL = db.url;
    process.env.ADMIN_ENCRYPTION_KEY = fs.readFileSync(keyFile, "utf8");
    process.env.NODE_ENV = "development";
    process.env.HOST = "127.0.0.1";
    process.env.PUBLIC_ORIGIN =
      "http://localhost:" + (process.env.PORT || 8080);
    const { configuration } = require("../signaling-server/dist/config");
    const { startServer } = require("../signaling-server/dist/server");
    server = await startServer(configuration());
    fs.writeFileSync(
      path.join(db.root, "connection.json"),
      JSON.stringify({ databaseUrl: db.url, encryptionKeyFile: keyFile }),
      { mode: 0o600 },
    );
    console.log("Painel local: " + process.env.PUBLIC_ORIGIN + "/admin/");
    console.log("Cliente local: ws://localhost:" + server.port + "/ws");
    console.log(
      "Primeiro administrador: leia docs/ADMIN.md e use npm run admin:create:local. Nenhuma conta padrão é criada.",
    );
    let stopping = false;
    const stop = async () => {
      if (stopping) return;
      stopping = true;
      await server.close();
      await db.stop();
      process.exit(0);
    };
    process.on("SIGINT", () => void stop());
    process.on("SIGTERM", () => void stop());
  } catch (error) {
    await server?.close();
    await db.stop();
    throw error;
  }
})().catch(() => {
  console.error(
    "Falha ao iniciar. Verifique os builds, a porta e os dados locais.",
  );
  process.exitCode = 1;
});
