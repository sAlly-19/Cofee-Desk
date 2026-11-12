// Development/test only: real PostgreSQL, loopback binding, random per-cluster password.
import EmbeddedPostgres from "../signaling-server/node_modules/embedded-postgres/dist/index.js";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import net from "node:net";
export async function localDatabase(name = "security") {
  const root = path.resolve("artifacts", name);
  fs.mkdirSync(root, { recursive: true });
  const port = await new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
  });
  const secretFile = path.join(root, "db-password");
  let password;
  try {
    password = fs.readFileSync(secretFile, "utf8");
  } catch {
    password = crypto.randomBytes(32).toString("hex");
    fs.writeFileSync(secretFile, password, { mode: 0o600 });
  }
  const pg = new EmbeddedPostgres({
    databaseDir: path.join(root, "postgres"),
    user: "coffee",
    password,
    port,
    persistent: true,
    authMethod: "scram-sha-256",
    autoRehydrateSymlinks: true,
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    postgresFlags: ["-h", "127.0.0.1"],
    onLog: () => {},
    onError: () => {},
  });
  if (!fs.existsSync(path.join(root, "postgres", "PG_VERSION")))
    await pg.initialise();
  await pg.start();
  return {
    url: "postgres://coffee:" + password + "@127.0.0.1:" + port + "/postgres",
    stop: () => pg.stop(),
    root,
  };
}
