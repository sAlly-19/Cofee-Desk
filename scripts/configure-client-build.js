// Only compiled, ignored output receives the deployment address.
const fs = require("node:fs");
const path = require("node:path");
const { clientEndpoint } = require("./client-config");
try {
  const endpoint = clientEndpoint();
  fs.writeFileSync(
    path.resolve(__dirname, "../dist-electron/shared/publicService.js"),
    '"use strict";\nObject.defineProperty(exports, "__esModule", { value: true });\nexports.OFFICIAL_SIGNALING_URL = ' +
      JSON.stringify(endpoint) +
      ";\n",
  );
  console.log(
    endpoint
      ? "Official service injected into local build (address omitted)."
      : "Development build uses local signaling.",
  );
} catch {
  console.error(
    "Invalid private client configuration; build stopped without exposing the address.",
  );
  process.exitCode = 1;
}
