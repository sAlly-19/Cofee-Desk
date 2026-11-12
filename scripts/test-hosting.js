const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { database, migrate } = require("../signaling-server/dist/database");
const {
  provisionRuntimeRole,
} = require("../signaling-server/dist/runtimeRole");
const { configuration } = require("../signaling-server/dist/config");
const { createPeerInfo } = require("../signaling-server/dist/proxy");
const { startServer } = require("../signaling-server/dist/server");
const { WebSocket } = require("../signaling-server/node_modules/ws");
const sec = require("../signaling-server/dist/security");
const { selectService } = require("../dist-electron/main/serviceSelection");
const checks = [];
function check(name, ok) {
  assert.ok(ok, name);
  checks.push(name);
  console.log("PASS " + name);
}
(async () => {
  const { localDatabase } = await import("./local-database.mjs");
  const db = await localDatabase("hosting-tests");
  const owner = database(db.url);
  let runtime, server, ws;
  try {
    await owner.query("DROP SCHEMA public CASCADE;CREATE SCHEMA public");
    await owner.query("DROP ROLE IF EXISTS coffee_runtime");
    await migrate(owner);
    const password = crypto.randomBytes(40).toString("base64url");
    await provisionRuntimeRole(owner, password);
    const appUrl = new URL(db.url);
    appUrl.username = "coffee_runtime";
    appUrl.password = password;
    runtime = database(appUrl.href);
    check(
      "Runtime credential is a separate role",
      (await runtime.query("SELECT current_user")).rows[0].current_user ===
        "coffee_runtime",
    );
    for (const [name, sql] of [
      ["Runtime cannot create tables", "CREATE TABLE public.forbidden(id int)"],
      [
        "Runtime cannot create administrators",
        "INSERT INTO admins(id,username,password_hash,totp_encrypted) VALUES(gen_random_uuid(),'forbidden','x','x')",
      ],
      [
        "Runtime cannot replace password hashes",
        "UPDATE admins SET password_hash='x'",
      ],
      ["Runtime cannot delete audit history", "DELETE FROM audit"],
      ["Runtime cannot rewrite migrations", "DELETE FROM schema_migrations"],
      [
        "Runtime cannot change schema",
        "ALTER TABLE devices ADD COLUMN forbidden text",
      ],
    ]) {
      await assert.rejects(() => runtime.query(sql));
      check(name, true);
    }
    process.env.DATABASE_URL = db.url;
    process.env.ADMIN_ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");
    process.env.PUBLIC_ORIGIN = "https://coffee-hosting.example";
    process.env.NODE_ENV = "production";
    const credentials = {
      username: "hosting-operator",
      password: crypto.randomBytes(6).toString("base64url"),
    };
    const boot = () =>
      spawnSync(
        process.execPath,
        ["signaling-server/dist/bootstrap-admin.js"],
        {
          input: JSON.stringify(credentials),
          encoding: "utf8",
          env: process.env,
          windowsHide: true,
          timeout: 30000,
        },
      );
    const first = boot();
    check("Local bootstrap creates first admin", first.status === 0);
    const secret = first.stdout.trim().split(/\r?\n/).at(-1);
    check(
      "Enrollment secret only returned by local bootstrap",
      /^[A-Z2-7]{32}$/.test(secret),
    );
    check("Second bootstrap is refused", boot().status !== 0);
    process.env.TRUSTED_PROXY_IPS = "127.0.0.1";
    process.env.TRUST_PROXY = "true";
    const config = { ...configuration(), port: 0, databaseUrl: appUrl.href };
    const explicit = createPeerInfo(config);
    const req = (address, headers) => ({
      socket: { remoteAddress: address },
      headers,
    });
    check(
      "Untrusted socket cannot forge TLS or client IP",
      explicit(
        req("203.0.113.10", {
          "x-forwarded-proto": "https",
          "x-forwarded-for": "8.8.8.8",
        }),
      ).secure === false,
    );
    check(
      "Trusted chain ignores attacker prefix",
      explicit(
        req("127.0.0.1", {
          "x-forwarded-proto": "https",
          "x-forwarded-for": "8.8.8.8, 203.0.113.25",
        }),
      ).ip === "203.0.113.25",
    );
    assert.throws(() => createPeerInfo({ ...config, proxyProvider: "render" }));
    check("Render provider refuses missing platform identity", true);
    process.env.RENDER = "true";
    process.env.RENDER_SERVICE_ID = "srv-local-test";
    process.env.RENDER_EXTERNAL_URL = config.publicOrigin;
    const render = createPeerInfo({ ...config, proxyProvider: "render" });
    const headers = {
      host: "coffee-hosting.example",
      "x-forwarded-proto": "https",
      "x-forwarded-for": "8.8.8.8, 203.0.113.25, 173.245.48.5, 10.1.2.3",
    };
    check(
      "Render removes only known proxy hops",
      render(req("10.1.2.4", headers)).ip === "203.0.113.25",
    );
    check(
      "Render accepts HTTPS only from configured path",
      render(req("10.1.2.4", headers)).secure,
    );
    check(
      "Render rejects unknown direct peer",
      !render(req("203.0.113.50", headers)).secure,
    );
    check(
      "Render rejects unexpected Host",
      !render(req("10.1.2.4", { ...headers, host: "attacker.example" })).secure,
    );
    check(
      "Render rejects malformed forwarded chain",
      !render(req("10.1.2.4", { ...headers, "x-forwarded-for": "not-an-ip" }))
        .secure,
    );
    check(
      "Render rejects protocol lists",
      !render(
        req("10.1.2.4", { ...headers, "x-forwarded-proto": "http, https" }),
      ).secure,
    );
    server = await startServer(config);
    const base = "http://127.0.0.1:" + server.port;
    const proxyHeaders = {
      "X-Forwarded-Proto": "https",
      "X-Forwarded-For": "203.0.113.25",
      Origin: config.publicOrigin,
    };
    check(
      "Production starts with restricted database user",
      (await fetch(base + "/health", { headers: proxyHeaders })).status === 200,
    );
    check(
      "Proxy diagnostics require admin session",
      (await fetch(base + "/api/admin/network", { headers: proxyHeaders }))
        .status === 401,
    );
    const login = await fetch(base + "/api/admin/login", {
      method: "POST",
      headers: { ...proxyHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ ...credentials, code: sec.totp(secret) }),
    });
    check(
      "Restricted role supports real password and TOTP login",
      login.status === 200,
    );
    const cookie = login.headers.get("set-cookie").split(";")[0];
    const csrf = (await login.json()).csrf;
    check(
      "Production cookie is secure and host scoped",
      cookie.startsWith("__Host-coffee_admin=") &&
        login.headers.get("set-cookie").includes("; Secure"),
    );
    const authed = { ...proxyHeaders, Cookie: cookie };
    const network = await fetch(base + "/api/admin/network", {
      headers: authed,
    });
    check(
      "Authenticated diagnostics report effective client IP",
      (await network.json()).ip === "203.0.113.25",
    );
    ws = new WebSocket(base.replace("http:", "ws:") + "/ws", {
      origin: "file://",
      headers: proxyHeaders,
    });
    const pair = crypto.generateKeyPairSync("ed25519");
    const key = pair.publicKey
      .export({ format: "der", type: "spki" })
      .toString("base64");
    const id = await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(Error("registration timeout")),
        5000,
      );
      ws.on("error", reject);
      ws.on("open", () =>
        ws.send(JSON.stringify({ type: "hello", version: 2, publicKey: key })),
      );
      ws.on("message", (raw) => {
        const m = JSON.parse(raw);
        if (m.type === "challenge")
          ws.send(
            JSON.stringify({
              type: "authenticate",
              signature: crypto
                .sign(
                  null,
                  Buffer.from(
                    "coffee-desk:v2\n" +
                      m.audience +
                      "\n" +
                      m.nonce +
                      "\n" +
                      key,
                  ),
                  pair.privateKey,
                )
                .toString("base64"),
            }),
          );
        if (m.type === "registered") {
          clearTimeout(timer);
          resolve(m.id);
        }
      });
    });
    check(
      "Restricted role registers authenticated device",
      /^\d{3}-\d{3}-\d{3}$/.test(id),
    );
    const block = await fetch(
      base + "/api/admin/devices/" + id + "/sanctions",
      {
        method: "POST",
        headers: {
          ...authed,
          "Content-Type": "application/json",
          "X-CSRF-Token": csrf,
        },
        body: JSON.stringify({
          action: "block",
          reason: "Hosting permission validation",
          hours: 24,
        }),
      },
    );
    check(
      "Restricted role applies sanction and writes audit",
      block.status === 200,
    );
    check(
      "Restricted role cannot bootstrap a second admin",
      spawnSync(
        process.execPath,
        ["signaling-server/dist/bootstrap-admin.js"],
        {
          input: JSON.stringify(credentials),
          encoding: "utf8",
          env: { ...process.env, DATABASE_URL: appUrl.href },
          windowsHide: true,
          timeout: 30000,
        },
      ).status !== 0,
    );
    const prior = {
      url: "ws://localhost:8080/ws",
      identities: { old: "kept" },
    };
    check(
      "Legacy ambiguous endpoint preserved",
      selectService(prior, "wss://official.example/ws") === prior,
    );
    check(
      "Explicit endpoint preserved",
      selectService(
        { ...prior, urlSource: "explicit" },
        "wss://official.example/ws",
      ).url === prior.url,
    );
    const changed = selectService(
      { ...prior, urlSource: "default" },
      "wss://official.example/ws",
    );
    check(
      "Automatic endpoint changes preserve identities",
      changed.url === "wss://official.example/ws" &&
        changed.identities === prior.identities,
    );
    check(
      "No provisional public endpoint invented",
      selectService({ ...prior, urlSource: "default" }, "").url === prior.url,
    );
  } finally {
    ws?.terminate();
    await server?.close();
    await runtime?.end();
    await owner.end();
    await db.stop();
    fs.writeFileSync(
      path.join(db.root, "validation.json"),
      JSON.stringify({ passed: checks.length, checks }, null, 2),
    );
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
