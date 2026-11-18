const assert = require("node:assert/strict"),
  vm = require("node:vm"),
  fs = require("node:fs"),
  path = require("node:path");
const code = fs.readFileSync(path.resolve("scripts/audit-gate.js"), "utf8");
const known = {
  url: "https://github.com/advisories/GHSA-fc5q-39xc-vjpf",
  name: "picomatch",
  severity: "high",
};
function run(reports, date = "2026-11-18T00:00:00Z", bad = false) {
  let index = 0;
  const process = {
    env: { npm_execpath: "fixture-npm" },
    execPath: "node",
    platform: "win32",
  };
  vm.runInNewContext(
    code,
    {
      process,
      Date: { parse: Date.parse, now: () => Date.parse(date) },
      console: { log: () => {}, error: () => {} },
      require: (id) =>
        id === "node:fs"
          ? { mkdirSync: () => {}, writeFileSync: () => {} }
          : id === "node:path"
            ? path
            : id === "node:child_process"
              ? {
                  spawnSync: () => {
                    const advisory = reports[index++];
                    return {
                      status: advisory ? 1 : 0,
                      stdout: bad
                        ? "invalid"
                        : JSON.stringify({
                            metadata: {
                              vulnerabilities: { total: advisory ? 1 : 0 },
                            },
                            vulnerabilities: advisory
                              ? { fixture: { via: [advisory] } }
                              : {},
                          }),
                    };
                  },
                }
              : null,
    },
    { timeout: 1000 },
  );
  return process.exitCode;
}
const checks = [
  ["Clean audit passes", () => run([]) === 0],
  [
    "Specific temporary tooling advisory is accepted",
    () => run([null, null, known]) === 0,
  ],
  ["Same advisory is never allowed at runtime", () => run([known]) === 1],
  [
    "Expired tooling exception fails closed",
    () => run([null, null, known], "2026-12-02T00:00:00Z") === 1,
  ],
  [
    "New advisory blocks CI",
    () =>
      run([
        null,
        null,
        { ...known, url: "https://github.com/advisories/GHSA-fixture-new" },
      ]) === 1,
  ],
  [
    "Critical severity cannot inherit high exception",
    () => run([null, null, { ...known, severity: "critical" }]) === 1,
  ],
  ["Unavailable registry blocks CI", () => run([], undefined, true) === 1],
];
for (const [name, test] of checks) {
  assert.ok(test(), name);
  console.log("PASS " + name);
}
console.log(checks.length + " advisory gate checks passed");
