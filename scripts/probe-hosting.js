const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { WebSocket } = require("../signaling-server/node_modules/ws");
async function probePublicService(value) {
  const u = new URL(value);
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    u.pathname !== "/"
  )
    throw Error("Provide only the public HTTPS origin");
  const origin = u.origin;
  const checks = [];
  const check = (name, ok) => {
    if (!ok) throw Error(name);
    checks.push(name);
  };
  const get = (route) =>
    fetch(origin + route, {
      redirect: "manual",
      signal: AbortSignal.timeout(120000),
    });
  const health = await get("/health");
  check(
    "HTTPS health with connected database",
    health.status === 200 && (await health.json()).status === "ok",
  );
  const panel = await get("/admin/");
  check(
    "Administrative panel served",
    panel.status === 200 && (await panel.text()).includes('id="root"'),
  );
  check(
    "CSP and HSTS enabled",
    !!panel.headers.get("content-security-policy") &&
      !!panel.headers.get("strict-transport-security"),
  );
  check(
    "Administrative API requires login",
    (await get("/api/admin/devices")).status === 401,
  );
  const wsUrl = origin.replace("https:", "wss:") + "/ws";
  const pair = crypto.generateKeyPairSync("ed25519");
  const publicKey = pair.publicKey
    .export({ format: "der", type: "spki" })
    .toString("base64");
  await new Promise((resolve, reject) => {
    // Challenge only: probing never registers a device or writes test reports.
    const ws = new WebSocket(wsUrl, {
      origin: "file://",
      handshakeTimeout: 120000,
    });
    const timer = setTimeout(
      () => finish(Error("WebSocket probe timeout")),
      125000,
    );
    function finish(error) {
      clearTimeout(timer);
      ws.terminate();
      error ? reject(error) : resolve();
    }
    ws.once("error", finish);
    ws.once("open", () =>
      ws.send(JSON.stringify({ type: "hello", version: 2, publicKey })),
    );
    ws.on("message", (raw) => {
      try {
        const m = JSON.parse(raw);
        check(
          "WSS v2 challenge bound to public origin",
          m.type === "challenge" &&
            m.audience === origin &&
            /^[A-Za-z0-9_-]{43}$/.test(m.nonce),
        );
        finish();
      } catch (e) {
        finish(e);
      }
    });
  });
  return { origin, wsUrl, checkedAt: new Date().toISOString(), checks };
}
module.exports = { probePublicService };
if (require.main === module)
  probePublicService(process.argv[2])
    .then((result) => {
      const folder = path.resolve(__dirname, "../artifacts/hosting");
      fs.mkdirSync(folder, { recursive: true });
      fs.writeFileSync(
        path.join(folder, "public-probe.json"),
        JSON.stringify(result, null, 2),
      );
      console.log(
        "Public probe passed: " +
          result.checks.length +
          " checks. This does not replace two-machine or moderation tests.",
      );
    })
    .catch((error) => {
      console.error("Public probe failed: " + error.message);
      process.exitCode = 1;
    });
