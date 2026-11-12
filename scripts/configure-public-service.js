const fs = require("node:fs");
const path = require("node:path");
const { probePublicService } = require("./probe-hosting");
(async () => {
  const result = await probePublicService(process.argv[2]);
  const { localFile } = require("./client-config");
  fs.writeFileSync(
    localFile,
    "COFFEE_OFFICIAL_SIGNALING_URL=" + result.wsUrl + "\n",
    { mode: 0o600 },
  );
  const folder = path.resolve(__dirname, "../artifacts/hosting");
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(
    path.join(folder, "public-probe.json"),
    JSON.stringify(result, null, 2),
  );
  console.log(
    "Official service saved in ignored local configuration. No source URL or installer generated.",
  );
})().catch((error) => {
  console.error("Endpoint was not changed: " + error.message);
  process.exitCode = 1;
});
