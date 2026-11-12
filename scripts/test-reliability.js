// No installer is executed. Every download and launch is simulated.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const {
  UpdateManager,
  installerName,
  releaseVersion,
  shouldCheckUpdate,
} = require("../dist-electron/main/updaterCore");
const { sanitizedDiagnostic } = require("../dist-electron/shared/diagnostics");
const { normalizedPoint } = require("../dist-electron/shared/geometry");
const checks = [];
function check(name, condition) {
  assert.ok(condition, name);
  checks.push(name);
  console.log("PASS " + name);
}
const root = path.resolve("artifacts/reliability");
fs.mkdirSync(root, { recursive: true });
const version = "1.0.2",
  name = installerName(version, "x64"),
  bytes = Buffer.from("SIMULATED INSTALLER: NEVER EXECUTE"),
  digest = crypto.createHash("sha512").update(bytes).digest("base64");
const prefix =
  "https://github.com/sAlly-19/Cofee-Desk/releases/download/v" + version + "/";
function fixture(options = {}) {
  let busy = false,
    launches = 0,
    downloads = 0,
    cancelled = 0;
  const states = [],
    requests = [];
  const deps = {
    version: "1.0.1",
    arch: "x64",
    isDev: false,
    isPortable: false,
    directory: fs.mkdtempSync(path.join(root, "updater-")),
    busy: () => busy,
    token: () => ({ cancel: () => cancelled++ }),
    broadcast: (s) => states.push(s),
    launch: async () => {
      launches++;
    },
    adapter: {
      checkForUpdates: async () => ({ updateInfo: { version } }),
      downloadUpdate: async () => {
        downloads++;
        if (options.normal) return;
        throw Error("simulated transport error");
      },
      quitAndInstall: () => {
        launches++;
      },
    },
    request: async (url, init) => {
      requests.push(url);
      if (options.request) return options.request(url, init);
      if (url.endsWith("/latest"))
        return Response.json({ tag_name: "v" + version, body: "Notes" });
      if (url.includes("/tags/"))
        return Response.json({
          tag_name: "v" + version,
          assets: [
            {
              name,
              size: bytes.length,
              browser_download_url: options.badOrigin
                ? "http://invalid/" + name
                : prefix + name,
            },
            { name: "latest.yml", browser_download_url: prefix + "latest.yml" },
          ],
        });
      if (url.endsWith("latest.yml"))
        return new Response(
          JSON.stringify({
            version,
            files: [
              {
                url: name,
                size: bytes.length,
                sha512: options.badHash
                  ? Buffer.alloc(64).toString("base64")
                  : digest,
              },
            ],
          }),
        );
      return new Response(options.badSize ? bytes.subarray(1) : bytes);
    },
  };
  Object.assign(deps, options.deps || {});
  return {
    manager: new UpdateManager(deps),
    deps,
    states,
    requests,
    busy: (v) => (busy = v),
    launches: () => launches,
    downloads: () => downloads,
    cancelled: () => cancelled,
  };
}
async function run() {
  const {matchesDevice,filterHistory}=require('../dist-electron/shared/history');
  check('Automatic checks wait 24 hours',!shouldCheckUpdate(100000,100001)&&shouldCheckUpdate(100000,86500000)&&shouldCheckUpdate(0,1));
  check('Clock rollback allows recovery check',shouldCheckUpdate(1000,999));
  check('Device search supports accents and grouped ID',matchesDevice({name:'Máquina Café',remoteId:'123-456-789'},'cafe')&&matchesDevice({name:'Device',remoteId:'123-456-789'},'123 456'));
  check('Search does not match arbitrary punctuation',!matchesDevice({name:'Device',remoteId:'123-456-789'},'---'));
  const history=[{id:'1',name:'Old name',remoteId:'123-456-789',result:'rejected'},{id:'2',name:'Other',remoteId:'987-654-321',result:'completed'}];
  check('History searches renamed aliases with result filters',filterHistory(history,'Novo','rejected',[{name:'Novo nome',remoteId:'123-456-789'}]).length===1&&filterHistory(history,'Novo','completed',[{name:'Novo nome',remoteId:'123-456-789'}]).length===0);

  const report = sanitizedDiagnostic(
    {
      stage: "webrtc",
      code: "https://secret.invalid/?token=private",
      state: "ready",
      url: "secret",
      password: "private",
      sdp: "private",
      stats: { latencyMs: 12.34, framesPerSecond: Infinity, address: "secret" },
    },
    "1.0.1",
  );
  check(
    "Diagnostics discard URLs, secrets, SDP and invalid stats",
    !JSON.stringify(report).includes("secret") &&
      !JSON.stringify(report).includes("private") &&
      report.code === "UNKNOWN" &&
      report.stats.latencyMs === 12.3 &&
      !("framesPerSecond" in report.stats),
  );
  check(
    "Monitor negative origin maps first pixel",
    JSON.stringify(
      normalizedPoint({ x: -1920, y: -100, width: 1920, height: 1080 }, 0, 0),
    ) === JSON.stringify({ x: -1920, y: -100 }),
  );
  check(
    "Monitor final pixel stays within bounds",
    normalizedPoint({ x: -1920, y: 0, width: 1920, height: 1080 }, 1, 1).x ===
      -1,
  );
  for (const point of [
    [-0.1, 0],
    [1.1, 0],
    [NaN, 0],
    [0, Infinity],
  ])
    check(
      "Out of surface input rejected " + point,
      normalizedPoint({ x: 0, y: 0, width: 100, height: 100 }, ...point) ===
        null,
    );
  assert.throws(() => releaseVersion("1.0.1", "1.0.1"));
  assert.throws(() => releaseVersion("2.0.0-beta.1", "1.0.1"));
  assert.throws(() => installerName(version, "invalid"));
  check("Equal, prerelease and unknown architecture rejected", true);
  const dev = fixture({ deps: { isDev: true } });
  await dev.manager.check();
  check(
    "Development can query releases",
    dev.manager.getState().status === "available",
  );
  await dev.manager.startDownload();
  check(
    "Development cannot download or install",
    dev.downloads() === 0 && dev.launches() === 0,
  );
  const missing = fixture({
    deps: { isDev: true },
    request: async () => new Response("", { status: 404 }),
  });
  await missing.manager.check();
  check(
    "No release is up to date",
    missing.manager.getState().status === "not-available",
  );
  const failed = fixture({
    deps: {
      adapter: {
        checkForUpdates: async () => {
          throw Error("secret endpoint");
        },
      },
    },
  });
  await failed.manager.check();
  check(
    "Network error is sanitized",
    failed.manager.getState().status === "error" &&
      !JSON.stringify(failed.manager.getState()).includes("secret endpoint"),
  );
  const normal = fixture({ normal: true });
  await normal.manager.check();
  await normal.manager.startDownload();
  check(
    "Normal download reaches downloaded",
    normal.manager.getState().status === "downloaded",
  );
  normal.busy(true);
  await normal.manager.installAndRestart();
  check(
    "Active session blocks install",
    normal.launches() === 0 && normal.manager.getState().installBlocked,
  );
  normal.busy(false);
  await normal.manager.installAndRestart();
  check("Idle install uses adapter only", normal.launches() === 1);
  const fallback = fixture();
  await fallback.manager.check();
  const first = fallback.manager.startDownload(),
    second = fallback.manager.startDownload();
  check("Duplicate downloads share one promise", first === second);
  await first;
  check(
    "Fallback requires verified GitHub metadata",
    fallback.manager.getState().status === "downloaded" &&
      fallback.requests.length === 3,
  );
  check(
    "Fallback preserves verified bytes",
    fs
      .readFileSync(
        path.join(
          fallback.deps.directory,
          fs.readdirSync(fallback.deps.directory)[0],
        ),
      )
      .equals(bytes),
  );
  await fallback.manager.installAndRestart();
  check("Verified fallback launch simulated once", fallback.launches() === 1);
  for (const option of ["badHash", "badSize", "badOrigin"]) {
    const f = fixture({ [option]: true });
    await f.manager.check();
    await f.manager.startDownload();
    await f.manager.installAndRestart();
    check(
      "Fallback rejects " + option,
      f.manager.getState().status === "error" && f.launches() === 0,
    );
    check(
      "Rejected download removes partial " + option,
      !fs.readdirSync(f.deps.directory).some((n) => n.endsWith(".part")),
    );
  }
  const tampered = fixture();
  await tampered.manager.check();
  await tampered.manager.startDownload();
  fs.appendFileSync(
    path.join(
      tampered.deps.directory,
      fs.readdirSync(tampered.deps.directory)[0],
    ),
    "tampered",
  );
  await tampered.manager.installAndRestart();
  check(
    "Changed installer blocked before launch",
    tampered.launches() === 0 && tampered.manager.getState().status === "error",
  );
  let rejectDownload;
  const cancel = fixture({
    deps: {
      adapter: {
        checkForUpdates: async () => ({ updateInfo: { version } }),
        downloadUpdate: () =>
          new Promise((_resolve, reject) => {
            rejectDownload = reject;
          }),
        quitAndInstall: () => {
          throw Error("Unexpected install");
        },
      },
    },
  });
  await cancel.manager.check();
  const pending = cancel.manager.startDownload();
  cancel.manager.cancelDownload();
  rejectDownload(Error("cancelled"));
  await pending;
  check(
    "Cancellation returns available without fallback",
    cancel.manager.getState().status === "available" &&
      cancel.cancelled() === 1 &&
      cancel.requests.length === 0,
  );
  const redirect = fixture({
    request: async () =>
      new Response("", {
        status: 302,
        headers: { location: "https://attacker.example/payload" },
      }),
  });
  await redirect.manager.check();
  await redirect.manager.startDownload();
  check(
    "Off-origin redirect blocked",
    redirect.manager.getState().status === "error",
  );
  fs.writeFileSync(
    path.join(root, "validation.json"),
    JSON.stringify({ passed: checks.length, checks }, null, 2),
  );
  console.log(checks.length + " reliability checks passed");
}
run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
