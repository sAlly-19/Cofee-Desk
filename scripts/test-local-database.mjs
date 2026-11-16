import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { localDatabase } from "./local-database.mjs";
const checks = [];
function check(name, value) {
  assert.ok(value, name);
  checks.push(name);
  console.log("PASS " + name);
}
class Ready {
  constructor(options) {
    this.options = options;
    Ready.instances.push(this);
  }
  static instances = [];
  async initialise() {}
  async start() {}
  async stop() {
    this.stopped = true;
  }
}
const [a, b] = await Promise.all([
  localDatabase("helper-regression", { Postgres: Ready }),
  localDatabase("helper-regression", { Postgres: Ready }),
]);
check("Concurrent test clusters use different PGDATA", a.root !== b.root);
check(
  "Startup logs always use stderr and C locale",
  Ready.instances.every((x) =>
    ["lc_messages=C", "log_destination=stderr", "logging_collector=off"].every(
      (flag) => x.options.postgresFlags.includes(flag),
    ),
  ),
);
await a.stop();
await b.stop();
check(
  "Successful databases still stop normally",
  Ready.instances.every((x) => x.stopped),
);
class Failed extends Ready {
  async start() {
    Failed.last = this;
    this.process = { exitCode: 1, signalCode: null };
    this.options.onLog(
      "FATAL: fixture startup failure password=" +
        this.options.password +
        " postgres://coffee:" +
        this.options.password +
        "@127.0.0.1/test",
    );
    throw undefined;
  }
}
let failure;
try {
  await localDatabase("helper-failure", { Postgres: Failed });
} catch (e) {
  failure = e;
}
check(
  "Undefined dependency rejection becomes an actionable Error",
  failure instanceof Error &&
    failure.message.includes("etapa start") &&
    failure.message.includes("FATAL: fixture startup failure"),
);
check(
  "Startup diagnostics redact credentials and database URLs",
  !failure.message.includes(Failed.last.options.password) &&
    !failure.message.includes("postgres://"),
);
const report = fs.readFileSync(
  path.join(path.dirname(Failed.last.options.databaseDir), "startup-error.log"),
  "utf8",
);
check(
  "Only sanitized diagnostics are persisted",
  report === failure.message && !report.includes(Failed.last.options.password),
);
class Timeout extends Ready {
  async start() {
    Timeout.last = this;
    this.process = {
      exitCode: null,
      signalCode: null,
      kill: () => {
        this.process.exitCode = 0;
      },
    };
    return new Promise(() => {});
  }
  async stop() {
    this.stopped = true;
    this.process.exitCode = 0;
  }
}
await assert.rejects(
  localDatabase("helper-timeout", { Postgres: Timeout, startupTimeoutMs: 20 }),
  /Tempo limite/,
);
check("Readiness timeout shuts down its own child", Timeout.last.stopped);
check(
  "Diagnostics never dump raw configuration",
  !report.includes('"password"') && !report.includes('"databaseDir"'),
);
console.log(checks.length + " local database helper checks passed");
