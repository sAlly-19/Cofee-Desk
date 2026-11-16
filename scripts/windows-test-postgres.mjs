// pg_ctl drops Windows administrative privileges; starting postgres.exe directly does not.
// PostgreSQL itself uses this mechanism in its Windows CI:
// https://github.com/postgres/postgres/blob/master/.github/workflows/pg-ci.yml
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
// pg_ctl may leave inherited stdio open in its background server on Windows.
// Resolve on controller exit, not pipe closure (execFile's callback waits for close).
function execute(file, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "",
      settled = false,
      timer;
    const done = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.stdout?.destroy();
      child.stderr?.destroy();
      if (error) reject(error);
      else resolve();
    };
    for (const pipe of [child.stdout, child.stderr])
      pipe.on("data", (chunk) => {
        output = (output + chunk.toString()).slice(-12000);
      });
    child.once("error", done);
    child.once("exit", (code, signal) => {
      if (code === 0) done();
      else {
        const error = new Error(
          "pg_ctl " + args[0] + " failed (" + (code ?? signal) + "): " + output,
        );
        error.code = code;
        done(error);
      }
    });
    timer = setTimeout(() => {
      child.kill();
      done(new Error("pg_ctl " + args[0] + " timed out"));
    }, options.timeout);
  });
}
export function windowsPostgres(
  Base,
  {
    run = execute,
    resolveBinary = async () => {
      const binaries =
        await import("../signaling-server/node_modules/@embedded-postgres/windows-x64/dist/index.js");
      return binaries.pg_ctl;
    },
    readLog = (file) =>
      fs.existsSync(file) ? fs.readFileSync(file, "utf8").slice(-12000) : "",
  } = {},
) {
  return class extends Base {
    async start() {
      this.ctlBinary = await resolveBinary();
      this.ctlAttempted = true;
      const log = path.join(this.options.databaseDir, "startup-native.log");
      try {
        await run(
          this.ctlBinary,
          [
            "start",
            "-D",
            this.options.databaseDir,
            "-w",
            "-t",
            "30",
            "-l",
            log,
            "-o",
            [
              "-p",
              String(this.options.port),
              ...this.options.postgresFlags,
            ].join(" "),
          ],
          { windowsHide: true, timeout: 35000, maxBuffer: 1024 * 1024 },
        );
      } catch (error) {
        this.options.onError(readLog(log));
        await this.stop().catch(() => {});
        throw error;
      }
    }
    async stop() {
      if (!this.ctlAttempted) return;
      try {
        await run(this.ctlBinary, ["status", "-D", this.options.databaseDir], {
          windowsHide: true,
          timeout: 5000,
        });
      } catch (error) {
        if (error.code === 3) {
          this.ctlAttempted = false;
          return;
        }
        throw error;
      }
      await run(
        this.ctlBinary,
        [
          "stop",
          "-D",
          this.options.databaseDir,
          "-m",
          "fast",
          "-w",
          "-t",
          "10",
        ],
        { windowsHide: true, timeout: 15000 },
      );
      this.ctlAttempted = false;
    }
  };
}
