const fs = require("node:fs");
const path = require("node:path");
const { parseEnv } = require("node:util");
const localFile = path.resolve(__dirname, "../.env.client.local");
function validateEndpoint(value) {
  const url = new URL(value);
  if (
    url.protocol !== "wss:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !["", "/", "/ws"].includes(url.pathname)
  )
    throw Error("Invalid official service configuration");
  url.pathname = "/ws";
  return url.href;
}
function clientEndpoint() {
  const fromEnvironment = process.env.COFFEE_OFFICIAL_SIGNALING_URL;
  const value =
    fromEnvironment !== undefined
      ? fromEnvironment
      : fs.existsSync(localFile)
        ? parseEnv(fs.readFileSync(localFile, "utf8"))
            .COFFEE_OFFICIAL_SIGNALING_URL
        : "";
  return value ? validateEndpoint(value) : "";
}
module.exports = { clientEndpoint, validateEndpoint, localFile };
