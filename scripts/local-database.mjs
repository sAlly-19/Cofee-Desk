// Development/test only: isolated PostgreSQL on loopback. Never uses production credentials.
import EmbeddedPostgres from "../signaling-server/node_modules/embedded-postgres/dist/index.js";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import net from "node:net";
import { windowsPostgres } from "./windows-test-postgres.mjs";
const PlatformPostgres =
  process.platform === "win32"
    ? windowsPostgres(EmbeddedPostgres)
    : EmbeddedPostgres;

export function sanitizedDatabaseLog(value, password) {
  return String(value ?? "PostgreSQL encerrou sem informar o motivo")
    .split(password)
    .join("[REDACTED]")
    .replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, "[REDACTED_DATABASE_URL]")
    .replace(
      /((?:password|token|secret|ADMIN_ENCRYPTION_KEY)\s*[=:]\s*)[^\s,;]+/gi,
      "$1[REDACTED]",
    )
    .slice(-6000);
}

export async function localDatabase(
  name = "security",
  { Postgres = PlatformPostgres, startupTimeoutMs = 30000 } = {},
) {
  if (!/^[a-z0-9-]+$/i.test(name))
    throw new Error("Nome inválido para banco de testes");
  const parent = path.resolve("artifacts", name);
  fs.mkdirSync(parent, { recursive: true });
  // Old forced exits and concurrent jobs must never share a PGDATA directory.
  const root = fs.mkdtempSync(path.join(parent, "run-"));
  const password = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(path.join(root, "db-password"), password, { mode: 0o600 });
  const port = await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
  const logs = [];
  const remember = (value) => {
    logs.push(sanitizedDatabaseLog(value, password));
    if (logs.length > 24) logs.shift();
  };
  const pg = new Postgres({
    databaseDir: path.join(root, "postgres"),
    user: "coffee",
    password,
    port,
    persistent: true,
    authMethod: "scram-sha-256",
    autoRehydrateSymlinks: true,
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    postgresFlags: [
      "-h",
      "127.0.0.1",
      "-c",
      "lc_messages=C",
      "-c",
      "log_destination=stderr",
      "-c",
      "logging_collector=off",
    ],
    onLog: remember,
    onError: remember,
  });
  const stop = async () => {
    // embedded-postgres.stop() waits forever when the child already emitted exit.
    const child = pg.process;
    if (child && (child.exitCode !== null || child.signalCode !== null)) {
      pg.process = undefined;
      return;
    }
    await pg.stop();
  };
  let phase = "initdb",
    timer;
  try {
    await pg.initialise();
    phase = "start";
    await Promise.race([
      pg.start(),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Tempo limite ao iniciar PostgreSQL")),
          startupTimeoutMs,
        );
      }),
    ]);
  } catch (error) {
    const child = pg.process;
    if (child && (child.exitCode !== null || child.signalCode !== null))
      pg.process = undefined;
    if (child && child.exitCode === null && child.signalCode === null) {
      let cleanupTimer;
      try {
        await Promise.race([
          stop(),
          new Promise((resolve) => {
            cleanupTimer = setTimeout(() => {
              child.kill();
              resolve();
            }, 5000);
          }),
        ]);
      } catch {
        /* Preserve the original startup failure. */
      } finally {
        clearTimeout(cleanupTimer);
      }
    }
    const reason = sanitizedDatabaseLog(
      error instanceof Error ? error.message : error,
      password,
    );
    const diagnostic = sanitizedDatabaseLog(
      [
        "PostgreSQL de testes falhou na etapa " +
          phase +
          " (" +
          process.platform +
          "/" +
          process.arch +
          ").",
        reason,
        ...logs,
      ].join("\n"),
      password,
    );
    fs.writeFileSync(path.join(root, "startup-error.log"), diagnostic);
    // Report the native stderr that embedded-postgres discards when rejecting undefined.
    throw new Error(diagnostic);
  } finally {
    clearTimeout(timer);
  }
  return {
    url: "postgres://coffee:" + password + "@127.0.0.1:" + port + "/postgres",
    stop,
    root,
  };
}
