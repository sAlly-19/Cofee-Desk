const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { WebSocket } = require("../signaling-server/node_modules/ws");
const { startServer } = require("../signaling-server/dist/server");
const { configuration } = require("../signaling-server/dist/config");
const sec = require("../signaling-server/dist/security");
const checks = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function check(name, condition) {
  assert.ok(condition, name);
  checks.push({ name, passed: true });
  console.log("PASS " + name);
}
class Device {
  constructor(url, pair = crypto.generateKeyPairSync("ed25519")) {
    this.pair = pair;
    this.messages = [];
    this.ws = new WebSocket(url);
    this.ws.on("message", (raw) => {
      this.messages.push(JSON.parse(raw));
    });
    this.ws.on("error", () => {});
  }
  async opened() {
    if (this.ws.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      this.ws.once("open", resolve);
      this.ws.once("error", reject);
    });
  }
  send(data) {
    this.ws.send(JSON.stringify(data));
  }
  async take(type, predicate = () => true, timeout = 5000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      const i = this.messages.findIndex((m) => m.type === type && predicate(m));
      if (i >= 0) return this.messages.splice(i, 1)[0];
      await wait(15);
    }
    throw new Error("Timed out waiting for " + type);
  }
  async auth() {
    await this.opened();
    const publicKey = this.pair.publicKey
      .export({ format: "der", type: "spki" })
      .toString("base64");
    this.send({ type: "hello", version: 2, publicKey });
    const c = await this.take("challenge");
    this.signature = crypto
      .sign(
        null,
        Buffer.from(
          "coffee-desk:v2\n" + c.audience + "\n" + c.nonce + "\n" + publicKey,
        ),
        this.pair.privateKey,
      )
      .toString("base64");
    this.send({ type: "authenticate", signature: this.signature });
    const msg = await this.take("registered");
    this.id = msg.id;
    return this;
  }
  async closed() {
    for (let i = 0; i < 100 && this.ws.readyState !== WebSocket.CLOSED; i++)
      await wait(20);
    return this.ws.readyState === WebSocket.CLOSED;
  }
  close() {
    this.ws.close();
  }
}
async function run() {
  const { localDatabase } = await import("./local-database.mjs");
  const db = await localDatabase("security-live");
  let server, production;
  const sockets = [];
  try {
    process.env.DATABASE_URL = db.url;
    process.env.ADMIN_ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");
    process.env.PUBLIC_ORIGIN = "http://localhost:8080";
    let config = configuration();
    config.port = 0;
    config.callLimit = 100;
    config.callTimeout = 1000;
    config.publicOrigin = "http://localhost:8080";
    const { database } = require("../signaling-server/dist/database");
    const initial = database(db.url);
    await initial.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
    await initial.end();
    server = await startServer(config);
    const origin = "http://localhost:" + server.port;
    config.publicOrigin = origin;
    // API captures the configured origin at creation, so restart after allocating the port.
    await server.close();
    config.port = Number(new URL(origin).port);
    server = await startServer(config);
    const url = origin.replace("http:", "ws:") + "/ws";
    const create = () => {
      const d = new Device(url);
      sockets.push(d);
      return d;
    };
    check(
      "Health endpoint does not expose device count",
      (await (await fetch(origin + "/health")).json()).activeClients ===
        undefined,
    );
    const originDenied = await new Promise((resolve) => {
      const ws = new WebSocket(url, { origin: "https://untrusted.example" });
      ws.on("error", () => {});
      ws.on("unexpected-response", (_request, response) => {
        response.resume();
        ws.terminate();
        resolve(response.statusCode === 403);
      });
    });
    check("Untrusted browser origin rejected", originDenied);
    const bad = create();
    await bad.opened();
    bad.ws.send("null");
    check(
      "Null JSON rejected without crashing",
      (await bad.take("error")).code === "INVALID",
    );
    bad.ws.send("{");
    check(
      "Malformed JSON rejected",
      (await bad.take("error")).code === "INVALID",
    );
    bad.send({ type: "register", id: { trim: 42 } });
    check(
      "Legacy identity claim rejected",
      (await bad.take("error")).code === "UPGRADE_REQUIRED",
    );
    check("Legacy socket closed", await bad.closed());
    const noauth = create();
    await noauth.opened();
    noauth.send({ type: "connect-request", targetId: "123-456-789" });
    check(
      "Unauthenticated call rejected",
      (await noauth.take("error")).code === "UPGRADE_REQUIRED",
    );
    const invalid = create();
    await invalid.opened();
    invalid.send({ type: "hello", version: 2, publicKey: "a".repeat(60) });
    check(
      "Invalid public key rejected",
      (await invalid.take("error")).code === "AUTH",
    );
    const a = await create().auth(),
      b = await create().auth(),
      c = await create().auth();
    check(
      "Server assigns unique device IDs",
      a.id !== b.id && b.id !== c.id && /^\d{3}-\d{3}-\d{3}$/.test(a.id),
    );
    a.send({ type: "register", id: b.id });
    check(
      "Authenticated client cannot claim another ID",
      (await a.take("error")).code === "STATE",
    );
    const replay = create();
    await replay.opened();
    const pub = a.pair.publicKey
      .export({ format: "der", type: "spki" })
      .toString("base64");
    replay.send({ type: "hello", version: 2, publicKey: pub });
    await replay.take("challenge");
    replay.send({ type: "authenticate", signature: a.signature });
    check(
      "Challenge replay rejected",
      (await replay.take("error")).code === "AUTH",
    );
    a.send({ type: "connect-request", targetId: b.id, fromId: c.id });
    const ringing = await a.take("call-ringing"),
      incoming = await b.take("incoming-call");
    check(
      "Sender is derived from authenticated socket",
      incoming.fromId === a.id,
    );
    const callId = ringing.callId;
    c.send({ type: "call-accepted", targetId: a.id, callId, fromId: b.id });
    check(
      "Forged acceptance rejected",
      (await c.take("error")).code === "FORBIDDEN",
    );
    a.send({ type: "offer", targetId: b.id, callId, payload: { sdp: "test" } });
    check(
      "SDP before consent rejected",
      (await a.take("error")).code === "STATE",
    );
    b.send({ type: "call-accepted", targetId: a.id, callId });
    check(
      "Recipient may accept pending call",
      (await a.take("call-accepted")).callId === callId,
    );
    c.send({ type: "disconnect", targetId: a.id, callId });
    check(
      "Third-party disconnect rejected",
      (await c.take("error")).code === "FORBIDDEN",
    );
    c.send({
      type: "ice-candidate",
      targetId: a.id,
      callId,
      payload: { candidate: "test" },
    });
    check(
      "Third-party ICE rejected",
      (await c.take("error")).code === "FORBIDDEN",
    );
    a.send({ type: "offer", targetId: b.id, callId, payload: { sdp: "test" } });
    check("SDP role validated", (await a.take("error")).code === "INVALID");
    b.send({
      type: "offer",
      targetId: a.id,
      callId,
      payload: { sdp: "v=0\r\n" },
    });
    check("Authorized offer relayed", (await a.take("offer")).fromId === b.id);
    a.send({
      type: "answer",
      targetId: b.id,
      callId,
      payload: { sdp: "v=0\r\n" },
    });
    check(
      "Authorized answer relayed",
      (await b.take("answer")).fromId === a.id,
    );
    a.send({
      type: "ice-candidate",
      targetId: b.id,
      callId,
      payload: { candidate: 123 },
    });
    check("Malformed ICE rejected", (await a.take("error")).code === "INVALID");
    a.send({
      type: "report-device",
      targetId: b.id,
      category: "unauthorized",
      description: "Tentativa de acesso indevido durante uma sessão.",
      callId,
    });
    const report = await a.take("report-received");
    check("Authenticated report persisted", !!report.id);
    a.send({
      type: "report-device",
      targetId: a.id,
      category: "spam",
      description: "Não deve denunciar a si próprio.",
    });
    check("Self-report rejected", (await a.take("error")).code === "INVALID");
    const secret = sec.base32(crypto.randomBytes(20)),
      adminId = crypto.randomUUID(),
      password = crypto.randomBytes(24).toString("base64url");
    await server.pool.query(
      "INSERT INTO admins(id,username,password_hash,totp_encrypted) VALUES($1,$2,$3,$4)",
      [
        adminId,
        "security-test",
        await sec.hashPassword(password),
        sec.encrypt(secret, config.encryptionKey),
      ],
    );
    check(
      "TOTP RFC test vector",
      sec.totp(sec.base32(Buffer.from("12345678901234567890")), 1) === "287082",
    );
    const admin = (
      route,
      data,
      csrf = "",
      cookie = "",
      originHeader = origin,
    ) =>
      fetch(origin + "/api/admin/" + route, {
        method: data === undefined ? "GET" : "POST",
        headers: {
          Origin: originHeader,
          ...(data === undefined
            ? {}
            : { "Content-Type": "application/json", "X-CSRF-Token": csrf }),
          ...(cookie ? { Cookie: cookie } : {}),
        },
        body: data === undefined ? undefined : JSON.stringify(data),
      });
    check("Admin data requires login", (await admin("devices")).status === 401);
    check(
      "Cross-origin login rejected",
      (
        await admin(
          "login",
          { username: "security-test", password, code: sec.totp(secret) },
          "",
          "",
          "https://other.example",
        )
      ).status === 403,
    );
    check(
      "Invalid password rejected",
      (
        await admin("login", {
          username: "security-test",
          password: "wrong",
          code: sec.totp(secret),
        })
      ).status === 401,
    );
    check(
      "Invalid TOTP rejected",
      (
        await admin("login", {
          username: "security-test",
          password,
          code: "000000",
        })
      ).status === 401,
    );
    const login = await admin("login", {
      username: "security-test",
      password,
      code: sec.totp(secret),
    });
    check("Password plus TOTP authenticates", login.status === 200);
    const credentials = await login.json(),
      cookie = login.headers.get("set-cookie").split(";")[0];
    check(
      "Session cookie is HttpOnly and SameSite Strict",
      login.headers.get("set-cookie").includes("HttpOnly") &&
        login.headers.get("set-cookie").includes("SameSite=Strict"),
    );
    const storedSession = (
      await server.pool.query(
        "SELECT token_hash,csrf_hash FROM admin_sessions WHERE admin_id=$1",
        [adminId],
      )
    ).rows[0];
    check(
      "Session and CSRF tokens are stored as hashes",
      storedSession.token_hash !== cookie.split("=")[1] &&
        storedSession.csrf_hash !== credentials.csrf,
    );
    check(
      "TOTP secret is encrypted at rest",
      (
        await server.pool.query(
          "SELECT totp_encrypted FROM admins WHERE id=$1",
          [adminId],
        )
      ).rows[0].totp_encrypted !== secret,
    );
    check(
      "TOTP cannot be replayed",
      (
        await admin("login", {
          username: "security-test",
          password,
          code: sec.totp(secret),
        })
      ).status === 401,
    );
    check(
      "Sanction requires CSRF",
      (
        await admin(
          "devices/" + b.id + "/sanctions",
          { action: "ban", reason: "Teste de segurança", confirm: b.id },
          "",
          cookie,
        )
      ).status === 403,
    );
    check(
      "Ban requires explicit ID confirmation",
      (
        await admin(
          "devices/" + b.id + "/sanctions",
          { action: "ban", reason: "Teste de segurança", confirm: a.id },
          credentials.csrf,
          cookie,
        )
      ).status === 400,
    );
    check(
      "Reason is mandatory",
      (
        await admin(
          "devices/" + b.id + "/sanctions",
          { action: "block", reason: "", hours: 24 },
          credentials.csrf,
          cookie,
        )
      ).status === 400,
    );
    const review = await admin(
      "reports/" + report.id,
      {
        status: "substantiated",
        reason: "Analisado durante teste automatizado.",
      },
      credentials.csrf,
      cookie,
    );
    check("Administrator may review report", review.status === 200);
    check(
      "Review does not apply automatic sanctions",
      (
        await server.pool.query("SELECT status FROM devices WHERE id=$1", [
          b.id,
        ])
      ).rows[0].status === "active",
    );
    const blocked = await admin(
      "devices/" + b.id + "/sanctions",
      { action: "block", reason: "Bloqueio temporário de teste", hours: 24 },
      credentials.csrf,
      cookie,
    );
    check("Temporary block persisted", blocked.status === 200);
    check(
      "Caller receives forced termination",
      (await a.take("peer-disconnected")).code === "SANCTIONED",
    );
    check(
      "Sanctioned peer receives revocation",
      (await b.take("access-revoked")).code === "SANCTIONED",
    );
    check("Sanctioned socket closed", await b.closed());
    const bannedAttempt = new Device(url, b.pair);
    sockets.push(bannedAttempt);
    await bannedAttempt.opened();
    bannedAttempt.send({
      type: "hello",
      version: 2,
      publicKey: b.pair.publicKey
        .export({ format: "der", type: "spki" })
        .toString("base64"),
    });
    const chall = await bannedAttempt.take("challenge");
    bannedAttempt.send({
      type: "authenticate",
      signature: crypto
        .sign(
          null,
          Buffer.from(
            "coffee-desk:v2\n" +
              chall.audience +
              "\n" +
              chall.nonce +
              "\n" +
              b.pair.publicKey
                .export({ format: "der", type: "spki" })
                .toString("base64"),
          ),
          b.pair.privateKey,
        )
        .toString("base64"),
    });
    check(
      "Blocked device cannot reconnect",
      (await bannedAttempt.take("access-revoked")).code === "SANCTIONED",
    );
    c.send({ type: "ping" });
    check(
      "Unrelated device remains available",
      (await c.take("pong")).type === "pong",
    );
    await admin(
      "devices/" + b.id + "/sanctions",
      { action: "unblock", reason: "Reversão autorizada no teste" },
      credentials.csrf,
      cookie,
    );
    const resumed = await new Device(url, b.pair).auth();
    sockets.push(resumed);
    check("Unblock preserves original identity", resumed.id === b.id);
    const ban = await admin(
      "devices/" + b.id + "/sanctions",
      { action: "ban", reason: "Banimento confirmado em teste", confirm: b.id },
      credentials.csrf,
      cookie,
    );
    check(
      "Permanent ban stored",
      ban.status === 200 &&
        (
          await server.pool.query(
            "SELECT status,blocked_until FROM devices WHERE id=$1",
            [b.id],
          )
        ).rows[0].blocked_until === null,
    );
    await admin(
      "devices/" + b.id + "/sanctions",
      { action: "unblock", reason: "Reversão de banimento em teste" },
      credentials.csrf,
      cookie,
    );
    check(
      "Ban reversal audited",
      (
        await server.pool.query(
          "SELECT count(*)::int AS n FROM sanctions WHERE device_id=$1",
          [b.id],
        )
      ).rows[0].n === 4,
    );
    await admin(
      "devices/" + c.id + "/sanctions",
      { action: "block", reason: "Expiração de teste", hours: 1 },
      credentials.csrf,
      cookie,
    );
    await c.take("access-revoked");
    await c.closed();
    await server.pool.query(
      "UPDATE devices SET blocked_until=now()-interval '1 second' WHERE id=$1",
      [c.id],
    );
    const expired = await new Device(url, c.pair).auth();
    sockets.push(expired);
    check("Expired suspension permits reconnect", expired.id === c.id);
    a.send({ type: "connect-request", targetId: expired.id });
    const expiring = await a.take("call-ringing");
    await expired.take("incoming-call");
    check(
      "Pending calls expire",
      (await a.take("peer-disconnected", (m) => m.callId === expiring.callId))
        .code === "EXPIRED",
    );
    a.send({ type: "connect-request", targetId: expired.id });
    const afterTimeout = await a.take("call-ringing");
    check("Expired call releases participant locks", !!afterTimeout.callId);
    await expired.take("incoming-call");
    a.send({
      type: "disconnect",
      targetId: expired.id,
      callId: afterTimeout.callId,
    });
    await a.take("peer-disconnected", (m) => m.callId === afterTimeout.callId);
    for (let i = 0; i < config.passwordLimit; i++) {
      a.send({
        type: "connect-request",
        targetId: expired.id,
        password: "test-password",
      });
      const request = await a.take("call-ringing");
      await expired.take("incoming-call");
      a.send({
        type: "disconnect",
        targetId: expired.id,
        callId: request.callId,
      });
      await a.take("peer-disconnected", (m) => m.callId === request.callId);
    }
    a.send({
      type: "connect-request",
      targetId: expired.id,
      password: "test-password",
    });
    check(
      "Password guesses are limited per target",
      (await a.take("error")).code === "LIMIT",
    );
    let limitedReports = false;
    for (let i = 0; i < 12; i++) {
      a.send({
        type: "report-device",
        targetId: a.id,
        category: "spam",
        description: "Invalid self report used to test the request limit.",
      });
      const response = await a.take("error");
      if (response.code === "LIMIT") {
        limitedReports = true;
        break;
      }
    }
    check("Report flood is limited", limitedReports);
    await admin(
      "devices/" + b.id + "/sanctions",
      {
        action: "ban",
        reason: "Sanção persistente para testar reinício",
        confirm: b.id,
      },
      credentials.csrf,
      cookie,
    );
    let immutable = false;
    try {
      await server.pool.query("DELETE FROM audit");
    } catch {
      immutable = true;
    }
    check("Audit records cannot be deleted", immutable);
    const list = await (
      await admin(
        "devices?q=" + encodeURIComponent("' OR 1=1 --"),
        undefined,
        "",
        cookie,
      )
    ).json();
    check("Search uses parameterized SQL", list.items.length === 0);
    await server.pool.query(
      "UPDATE admin_sessions SET expires_at=now()-interval '1 second'",
    );
    check(
      "Expired session rejected",
      (await admin("devices", undefined, "", cookie)).status === 401,
    );
    const second = await admin("login", {
      username: "security-test",
      password,
      code: sec.totp(secret, Math.floor(Date.now() / 30000) + 1),
    });
    check("Fresh TOTP permits new session", second.status === 200);
    const again = await second.json(),
      cookie2 = second.headers.get("set-cookie").split(";")[0];
    check(
      "Revoke all sessions succeeds",
      (await admin("sessions/revoke", {}, again.csrf, cookie2)).status === 200,
    );
    check(
      "Revoked cookie rejected",
      (await admin("devices", undefined, "", cookie2)).status === 401,
    );
    const binary = create();
    await binary.opened();
    binary.ws.send(Buffer.from("binary"));
    check("Binary messages are closed", await binary.closed());
    const oversized = create();
    await oversized.opened();
    oversized.ws.send("x".repeat(config.maxPayload + 1));
    check("Oversized messages are closed", await oversized.closed());
    const flood = await create().auth();
    for (let i = 0; i < 100; i++) flood.send({ type: "ping" });
    check("Queued-message flood bounded", await flood.closed());
    for (const d of sockets) d.ws.terminate();
    await server.close();
    server = await startServer(config);
    check(
      "Reports survive restart",
      (await server.pool.query("SELECT count(*)::int AS n FROM reports"))
        .rows[0].n === 1,
    );
    check(
      "Permanent sanction survives restart",
      (
        await server.pool.query("SELECT status FROM devices WHERE id=$1", [
          b.id,
        ])
      ).rows[0].status === "banned",
    );
    check(
      "Audit survives restart",
      (await server.pool.query("SELECT count(*)::int AS n FROM audit")).rows[0]
        .n >= 8,
    );
    const persistent = new Device(url, a.pair);
    sockets.push(persistent);
    await persistent.auth();
    check("Identity survives restart", persistent.id === a.id);
    process.env.TRUSTED_PROXY_IPS = "127.0.0.1";
    const prodConfig = {
      ...config,
      port: 0,
      production: true,
      trustProxy: true,
      publicOrigin: "https://admin.example",
    };
    production = await startServer(prodConfig);
    const prodUrl = "http://127.0.0.1:" + production.port;
    check(
      "Production rejects plaintext ingress",
      (await fetch(prodUrl + "/health")).status === 403,
    );
    check(
      "Explicit trusted TLS proxy is accepted",
      (
        await fetch(prodUrl + "/health", {
          headers: { "X-Forwarded-Proto": "https" },
        })
      ).status === 200,
    );
    const prodSecret = sec.base32(crypto.randomBytes(20));
    await server.pool.query(
      "INSERT INTO admins(id,username,password_hash,totp_encrypted) VALUES($1,$2,$3,$4)",
      [
        crypto.randomUUID(),
        "production-cookie-test",
        await sec.hashPassword(password),
        sec.encrypt(prodSecret, config.encryptionKey),
      ],
    );
    const secureLogin = await fetch(prodUrl + "/api/admin/login", {
      method: "POST",
      headers: {
        Origin: "https://admin.example",
        "X-Forwarded-Proto": "https",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: "production-cookie-test",
        password,
        code: sec.totp(prodSecret),
      }),
    });
    check(
      "Production sets Secure host-only cookie",
      secureLogin.status === 200 &&
        secureLogin.headers
          .get("set-cookie")
          .startsWith("__Host-coffee_admin=") &&
        secureLogin.headers.get("set-cookie").includes("; Secure"),
    );
    await production.close();
    production = await startServer({ ...prodConfig, trustProxy: false });
    check(
      "Untrusted forwarded TLS header cannot bypass HTTPS",
      (
        await fetch("http://127.0.0.1:" + production.port + "/health", {
          headers: { "X-Forwarded-Proto": "https" },
        })
      ).status === 403,
    );
    check(
      "Server remains healthy after invalid traffic",
      (await fetch(origin + "/health")).status === 200,
    );
  } finally {
    for (const d of sockets) d.ws.terminate();
    await production?.close();
    await server?.close();
    await db.stop();
    fs.writeFileSync(
      path.join(db.root, "validation.json"),
      JSON.stringify({ passed: checks.length, checks }, null, 2),
    );
  }
}
run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
