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

// Verify the Windows controller path even when this suite runs on another OS.
const { windowsPostgres } = await import("./windows-test-postgres.mjs");
const calls = [];
const Controlled = windowsPostgres(Ready, {
  resolveBinary: async () => "pg_ctl.exe",
  run: async (file, args, options) => {
    calls.push({ file, args, options });
  },
  readLog: () => "",
});
const native = new Controlled({
  databaseDir: "test directory with spaces",
  port: 55441,
  postgresFlags: ["-h", "127.0.0.1"],
  onError: () => {},
});
await native.start();
await native.stop();
check(
  "Windows starts through pg_ctl rather than postgres.exe",
  calls[0].file === "pg_ctl.exe" &&
    calls[0].args[0] === "start" &&
    calls[0].args.includes("-w"),
);
check(
  "Windows PGDATA remains a separate argument with spaces",
  calls[0].args[calls[0].args.indexOf("-D") + 1] ===
    "test directory with spaces" &&
    calls[0].options.windowsHide === true &&
    !calls[0].options.shell,
);
check(
  "Windows shutdown is scoped to its own cluster",
  calls[1].args[0] === "status" &&
    calls[2].args[0] === "stop" &&
    calls[2].args.includes("fast") &&
    calls[2].args.includes("test directory with spaces"),
);
const count = calls.length;
await native.stop();
check("Windows controller shutdown is idempotent", calls.length === count);
let startupLog = "";
const Broken = windowsPostgres(Ready, {
  resolveBinary: async () => "pg_ctl.exe",
  run: async (_file, args) => {
    const error = new Error("native failure");
    error.code = args[0] === "status" ? 3 : 1;
    throw error;
  },
  readLog: () => "FATAL: fixture Windows startup",
});
await assert.rejects(
  new Broken({
    databaseDir: "isolated fixture",
    port: 55442,
    postgresFlags: [],
    onError: (s) => {
      startupLog += s;
    },
  }).start(),
  /native failure/,
);
check(
  "Windows startup failures preserve native stderr",
  startupLog.includes("FATAL: fixture Windows startup"),
);
console.log(checks.length + " total database helper checks passed");
