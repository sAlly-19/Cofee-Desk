const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const net = require("net");
const { spawn } = require("child_process");
const { WebSocket } = require("../signaling-server/node_modules/ws");
const { startServer } = require("../signaling-server/dist/server");
const { configuration } = require("../signaling-server/dist/config");
const sec = require("../signaling-server/dist/security");
async function device(url) {
  const pair = crypto.generateKeyPairSync("ed25519");
  const key = pair.publicKey
    .export({ format: "der", type: "spki" })
    .toString("base64");
  const ws = new WebSocket(url);
  const messages = [];
  ws.on("error", () => {});
  const ready = new Promise((resolve, reject) => {
    ws.on("message", (raw) => {
      const msg = JSON.parse(raw);
      messages.push(msg);
      if (msg.type === "challenge")
        ws.send(
          JSON.stringify({
            type: "authenticate",
            signature: crypto
              .sign(
                null,
                Buffer.from(
                  "coffee-desk:v2\n" +
                    msg.audience +
                    "\n" +
                    msg.nonce +
                    "\n" +
                    key,
                ),
                pair.privateKey,
              )
              .toString("base64"),
          }),
        );
      if (msg.type === "registered") resolve(msg.id);
    });
    ws.on("error", reject);
  });
  ws.on("open", () =>
    ws.send(JSON.stringify({ type: "hello", version: 2, publicKey: key })),
  );
  const id = await ready;
  return { id, ws, messages, send: (data) => ws.send(JSON.stringify(data)) };
}
(async () => {
  const { localDatabase } = await import("./local-database.mjs");
  const db = await localDatabase("admin-browser");
  let server;
  const devices = [];
  try {
    process.env.DATABASE_URL = db.url;
    process.env.ADMIN_ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");
    const { database } = require("../signaling-server/dist/database");
    const pool = database(db.url);
    await pool.query("DROP SCHEMA public CASCADE;CREATE SCHEMA public");
    await pool.end();
    const port = await new Promise((r) => {
      const s = net.createServer();
      s.listen(0, "127.0.0.1", () => {
        const p = s.address().port;
        s.close(() => r(p));
      });
    });
    const origin = "http://localhost:" + port;
    const config = { ...configuration(), port, publicOrigin: origin };
    server = await startServer(config);
    const password = crypto.randomBytes(24).toString("base64url"),
      secret = sec.base32(crypto.randomBytes(20));
    await server.pool.query(
      "INSERT INTO admins(id,username,password_hash,totp_encrypted) VALUES($1,$2,$3,$4)",
      [
        crypto.randomUUID(),
        "browser-admin",
        await sec.hashPassword(password),
        sec.encrypt(secret, config.encryptionKey),
      ],
    );
    for (let i = 0; i < 3; i++)
      devices.push(await device(origin.replace("http:", "ws:") + "/ws"));
    const [a, b, c] = devices;
    a.send({ type: "connect-request", targetId: b.id });
    b.ws.on("message", (raw) => {
      const msg = JSON.parse(raw);
      if (msg.type === "incoming-call")
        b.send({
          type: "call-accepted",
          targetId: msg.fromId,
          callId: msg.callId,
        });
    });
    c.ws.on("message", (raw) => {
      const msg = JSON.parse(raw);
      if (msg.type === "incoming-call")
        c.send({
          type: "call-accepted",
          targetId: msg.fromId,
          callId: msg.callId,
        });
    });
    const pipeName =
      "\\\\.\\pipe\\coffee-admin-test-" +
      crypto.randomBytes(16).toString("hex");
    const payload = JSON.stringify({
      origin,
      username: "browser-admin",
      password,
      code: sec.totp(secret),
      target: b.id,
      peer: c.id,
    });
    const inputServer = net.createServer((socket) => {
      socket.end(payload);
      inputServer.close();
    });
    await new Promise((resolve) => inputServer.listen(pipeName, resolve));
    const env = { ...process.env, COFFEE_TEST_PIPE: pipeName };
    delete env.ELECTRON_RUN_AS_NODE;
    env.COFFEE_TEST_LOCAL_SIGNALING = "1";
    const child = spawn(
      require("electron"),
      [path.resolve("scripts/admin-browser-worker.js")],
      { env, windowsHide: true, stdio: ["pipe", "inherit", "inherit"] },
    );
    child.stdin.end();
    const result = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", resolve);
    });
    if (result !== 0) throw new Error("Administrative browser tests failed");
    const report = JSON.parse(
      fs.readFileSync(path.join(db.root, "browser.json"), "utf8"),
    );
    if (
      (
        await server.pool.query("SELECT status FROM devices WHERE id=$1", [
          report.clientId,
        ])
      ).rows[0].status !== "banned"
    )
      throw new Error("Client ban not persisted");
    if (
      !a.messages.some(
        (m) => m.type === "peer-disconnected" && m.code === "SANCTIONED",
      )
    )
      throw new Error("Other caller was not notified");
    console.log("PASS Browser decisions persisted; active peer notified");
  } finally {
    for (const d of devices) d.ws.terminate();
    await server?.close();
    await db.stop();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
