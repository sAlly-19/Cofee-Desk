// Read-only protocol probe: sends hello, never authenticates or registers a device.
const { clientEndpoint } = require("./client-config");
const { WebSocket } = require("../signaling-server/node_modules/ws");
const crypto = require("node:crypto");
const endpoint = clientEndpoint();
if (!endpoint) throw Error("Private client configuration missing");
const pair = crypto.generateKeyPairSync("ed25519");
const socket = new WebSocket(endpoint);
const timer = setTimeout(() => {
  socket.terminate();
  console.log("Protocol probe: service unavailable or timed out");
  process.exitCode = 1;
}, 25000);
socket.on("open", () =>
  socket.send(
    JSON.stringify({
      type: "hello",
      version: 2,
      capabilities: ["session-permissions-v1"],
      publicKey: pair.publicKey
        .export({ format: "der", type: "spki" })
        .toString("base64"),
    }),
  ),
);
socket.on("message", (raw) => {
  try {
    const m = JSON.parse(raw);
    if (m.type === "challenge") {
      console.log(
        "Hosted server advertises session confirmation: " +
          Boolean(m.capabilities?.includes("session-permissions-v1")),
      );
      clearTimeout(timer);
      socket.close();
    } else if (m.type === "error") {
      clearTimeout(timer);
      console.log("Protocol probe rejected by service");
      socket.close();
    }
  } catch {}
});
socket.on("error", () => {
  clearTimeout(timer);
  console.log("Protocol probe: transport unavailable");
  process.exitCode = 1;
});
