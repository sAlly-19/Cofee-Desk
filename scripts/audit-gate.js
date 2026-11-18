// Read-only advisory gate. Never upgrades packages or prints npm configuration.
const { spawnSync } = require("node:child_process"),
  path = require("node:path"),
  fs = require("node:fs");
const cli =
  process.env.npm_execpath ||
  path.join(
    path.dirname(process.execPath),
    process.platform === "win32"
      ? "node_modules/npm/bin/npm-cli.js"
      : "../lib/node_modules/npm/bin/npm-cli.js",
  );
const exception = "https://github.com/advisories/GHSA-fc5q-39xc-vjpf";
const expires = Date.parse("2026-12-02T00:00:00Z");
let failed = false;
const out = path.resolve("artifacts/advisory-gate");
fs.mkdirSync(out, { recursive: true });
for (const [scope, args] of [
  ["client-runtime", ["--omit=dev"]],
  ["server-runtime", ["--omit=dev", "--prefix", "signaling-server"]],
  ["client-tooling", []],
  ["server-tooling", ["--prefix", "signaling-server"]],
]) {
  const r = spawnSync(process.execPath, [cli, "audit", "--json", ...args], {
    encoding: "utf8",
    timeout: 90000,
    windowsHide: true,
  });
  let report;
  try {
    report = JSON.parse(r.stdout);
    if (
      !report.metadata ||
      report.error ||
      r.error ||
      ![0, 1].includes(r.status)
    )
      throw Error();
  } catch {
    console.error(scope + ": advisory lookup failed");
    failed = true;
    continue;
  }
  fs.writeFileSync(
    path.join(out, scope + ".json"),
    JSON.stringify(report, null, 2),
  );
  const advisories = [
    ...new Map(
      Object.values(report.vulnerabilities || {})
        .flatMap((v) => v.via || [])
        .filter((v) => typeof v === "object")
        .map((v) => [v.url, v]),
    ).values(),
  ];
  const runtime = scope.endsWith("-runtime");
  let rejected = 0;
  for (const advisory of advisories) {
    const excepted =
      !runtime &&
      scope === "client-tooling" &&
      advisory.url === exception &&
      advisory.name === "picomatch" &&
      advisory.severity === "high" &&
      Date.now() < expires;
    if (!excepted) rejected++;
    console.log(
      scope +
        ": " +
        advisory.severity +
        " " +
        advisory.url +
        (excepted ? " (temporary tooling exception, expires 2026-12-02)" : ""),
    );
  }
  if (
    (report.metadata.vulnerabilities.total > 0 && !advisories.length) ||
    rejected
  )
    failed = true;
  console.log(
    scope +
      ": " +
      report.metadata.vulnerabilities.total +
      " affected packages, " +
      rejected +
      " unapproved advisories",
  );
}
process.exitCode = failed ? 1 : 0;
