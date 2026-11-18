const { spawnSync } = require("node:child_process"),
  fs = require("node:fs"),
  path = require("node:path");
const cli =
  process.env.npm_execpath ||
  path.join(
    path.dirname(process.execPath),
    process.platform === "win32"
      ? "node_modules/npm/bin/npm-cli.js"
      : "../lib/node_modules/npm/bin/npm-cli.js",
  );
const out = path.resolve("artifacts/sbom");
fs.mkdirSync(out, { recursive: true });
for (const [name, extra] of [
  ["client-and-tooling", []],
  ["server", ["--prefix", "signaling-server"]],
]) {
  const r = spawnSync(
    process.execPath,
    [cli, "sbom", "--sbom-format", "cyclonedx", ...extra],
    { encoding: "utf8", timeout: 60000, windowsHide: true },
  );
  if (r.status !== 0) throw Error("SBOM generation failed: " + name);
  const j = JSON.parse(r.stdout);
  fs.writeFileSync(path.join(out, name + ".json"), JSON.stringify(j, null, 2));
  console.log(
    "SBOM generated: " +
      name +
      " (" +
      (j.components || []).length +
      " components)",
  );
}
