const fs = require("node:fs");
const path = require("node:path");
const { probePublicService } = require("./probe-hosting");
(async () => {
  const result = await probePublicService(process.argv[2]);
  fs.writeFileSync(
    path.resolve(__dirname, "../src/shared/publicService.ts"),
    "// Public service checked at " +
      result.checkedAt +
      "\nexport const OFFICIAL_SIGNALING_URL: string = " +
      JSON.stringify(result.wsUrl) +
      ";\n",
  );
  const folder = path.resolve(__dirname, "../artifacts/hosting");
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(
    path.join(folder, "public-probe.json"),
    JSON.stringify(result, null, 2),
  );
  console.log("Official endpoint configured. No installer was built.");
})().catch((error) => {
  console.error("Endpoint was not changed: " + error.message);
  process.exitCode = 1;
});
