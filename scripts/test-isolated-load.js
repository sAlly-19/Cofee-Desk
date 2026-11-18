// Bounded local capacity probe. Always creates its own loopback server and PostgreSQL cluster.
const assert = require("node:assert/strict"),
  crypto = require("node:crypto"),
  fs = require("node:fs"),
  path = require("node:path");
const { performance, monitorEventLoopDelay } = require("node:perf_hooks");
const { WebSocket } = require("../signaling-server/node_modules/ws");
const { startServer } = require("../signaling-server/dist/server"),
  { configuration } = require("../signaling-server/dist/config");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
class Device {
  constructor(url) {
    this.pair = crypto.generateKeyPairSync("ed25519");
    this.messages = [];
    this.ws = new WebSocket(url);
    this.ws.on("error", () => {});
    this.ws.on("message", (raw) => this.messages.push(JSON.parse(raw)));
  }
  send(m) {
    this.ws.send(JSON.stringify(m));
  }
  async take(type) {
    const until = Date.now() + 15000;
    while (Date.now() < until) {
      const i = this.messages.findIndex((m) => m.type === type);
      if (i >= 0) return this.messages.splice(i, 1)[0];
      await wait(5);
    }
    throw Error("Timed out: " + type);
  }
  async auth() {
    const start = performance.now();
    if (this.ws.readyState !== 1)
      await new Promise((r, j) => {
        this.ws.once("open", r);
        this.ws.once("error", j);
      });
    const publicKey = this.pair.publicKey
      .export({ format: "der", type: "spki" })
      .toString("base64");
    this.send({
      type: "hello",
      version: 2,
      publicKey,
      capabilities: ["session-permissions-v1"],
    });
    const c = await this.take("challenge");
    const text =
      "coffee-desk:v2\n" + c.audience + "\n" + c.nonce + "\n" + publicKey;
    this.send({
      type: "authenticate",
      signature: crypto
        .sign(null, Buffer.from(text), this.pair.privateKey)
        .toString("base64"),
    });
    this.id = (await this.take("registered")).id;
    return performance.now() - start;
  }
}
(async () => {
  const clients = Number(process.env.COFFEE_LOAD_CLIENTS || 50);
  assert.ok(
    Number.isInteger(clients) &&
      clients >= 10 &&
      clients <= 100 &&
      clients % 2 === 0,
    "Use even client count 10–100",
  );
  const { localDatabase } = await import("./local-database.mjs");
  const db = await localDatabase("bounded-load");
  let server;
  const devices = [];
  const lag = monitorEventLoopDelay({ resolution: 10 });
  try {
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL = db.url;
    process.env.ADMIN_ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");
    process.env.PUBLIC_ORIGIN = "http://localhost:8080";
    const config = {
      ...configuration(),
      host: "127.0.0.1",
      port: 0,
      maxConnections: clients,
      maxPerIp: clients + 1,
      registrationLimit: clients + 1,
      callLimit: clients,
      authTimeout: 30000,
      callTimeout: 15000,
    };
    server = await startServer(config);
    config.publicOrigin = "http://localhost:" + server.port;
    const url = config.publicOrigin.replace("http:", "ws:") + "/ws";
    const baseline = process.memoryUsage().rss;
    lag.enable();
    for (let i = 0; i < clients; i++) devices.push(new Device(url));
    const auth = await Promise.all(devices.map((d) => d.auth()));
    assert.equal(new Set(devices.map((d) => d.id)).size, clients);
    console.log(
      "PASS " + clients + " local authenticated identities remain distinct",
    );
    const call = await Promise.all(
      Array.from({ length: clients / 2 }, async (_, i) => {
        const a = devices[i * 2],
          b = devices[i * 2 + 1],
          start = performance.now();
        a.send({ type: "connect-request", targetId: b.id });
        const ringing = await a.take("call-ringing"),
          incoming = await b.take("incoming-call");
        assert.equal(incoming.callId, ringing.callId);
        assert.equal(incoming.fromId, a.id);
        b.send({
          type: "call-accepted",
          targetId: a.id,
          callId: incoming.callId,
          sourceKind: "screen",
          permissions: { control: false, clipboard: false, files: false },
        });
        const [left, right] = await Promise.all([
          a.take("call-accepted"),
          b.take("call-accepted"),
        ]);
        assert.equal(left.role, "client");
        assert.equal(right.role, "host");
        assert.equal(left.fromId, b.id);
        assert.equal(right.fromId, a.id);
        assert.equal(left.callId, incoming.callId);
        return { ms: performance.now() - start, id: incoming.callId };
      }),
    );
    console.log(
      "PASS " +
        call.length +
        " concurrent calls preserve participant, UUID and role isolation",
    );
    const excess = new WebSocket(url);
    const denied = await new Promise((resolve) => {
      excess.once("unexpected-response", (_q, r) => {
        r.resume();
        excess.terminate();
        resolve(r.statusCode === 403);
      });
      excess.once("error", () => resolve(true));
      excess.once("open", () => {
        excess.terminate();
        resolve(false);
      });
    });
    assert.ok(denied);
    console.log(
      "PASS Connection ceiling rejects excess client without evicting active calls",
    );
    const peak = process.memoryUsage().rss;
    await Promise.all(
      call.map(async (c, i) => {
        const a = devices[i * 2],
          b = devices[i * 2 + 1];
        a.send({ type: "disconnect", targetId: b.id, callId: c.id });
        const [l, r] = await Promise.all([
          a.take("peer-disconnected"),
          b.take("peer-disconnected"),
        ]);
        assert.equal(l.callId, c.id);
        assert.equal(r.callId, c.id);
      }),
    );
    console.log("PASS All concurrent calls terminate their own participants");
    for (const d of devices) d.ws.close();
    await wait(1000);
    lag.disable();
    const summary = (values) => {
      const sorted = [...values].sort((a, b) => a - b);
      return {
        p50Ms: sorted[Math.floor((sorted.length - 1) * 0.5)],
        p95Ms: sorted[Math.floor((sorted.length - 1) * 0.95)],
        maxMs: sorted.at(-1),
      };
    };
    const report = {
      passed: true,
      clientCount: clients,
      callCount: call.length,
      authentication: summary(auth),
      callAcceptance: summary(call.map((c) => c.ms)),
      rssBytes: { baseline, peak, after: process.memoryUsage().rss },
      eventLoopP95Ms: lag.percentile(95) / 1e6,
      scope:
        "loopback server plus load harness in one Node process; database child excluded; not production capacity",
    };
    fs.writeFileSync(
      path.join(db.root, "load-results.json"),
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report));
  } finally {
    lag.disable();
    for (const d of devices) d.ws.terminate();
    await server?.close();
    await db.stop();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
