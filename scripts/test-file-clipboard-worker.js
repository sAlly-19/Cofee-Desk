const { app, BrowserWindow, clipboard, ClipboardItem } = require("electron");
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  assert = require("node:assert/strict"),
  { pathToFileURL } = require("node:url"),
  { promisify } = require("node:util"),
  exec = promisify(require("node:child_process").execFile);
const root = path.resolve(__dirname, ".."),
  out = path.join(root, "artifacts/file-clipboard-" + process.pid);
fs.mkdirSync(out, { recursive: true });
app.setPath("userData", out);
app.setPath("downloads", out);
const checks = [];
function check(name, value) {
  assert.ok(value, name);
  checks.push(name);
  console.log("PASS " + name);
}
app.whenReady().then(async () => {
  let win;
  const previous = await clipboard.readText();
  const previousItems = [];
  for (const item of await clipboard.read()) {
    const values = {};
    for (const type of item.types) values[type] = await item.getType(type);
    previousItems.push(new ClipboardItem(values));
  }
  const restore = async () => {
    try {
      await clipboard.write(previousItems);
    } catch {
      await clipboard.writeText(previous);
    }
  };
  try {
    require("../dist-electron/main/ipcHandlers").registerIpcHandlers();
    const auth = require("../dist-electron/main/sessionAuthority");
    auth.registerSessionAuthority();
    require("../dist-electron/main/fileClipboard").registerFileClipboard();
    win = new BrowserWindow({
      show: false,
      webPreferences: {
        preload: path.join(root, "dist-electron/main/preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        partition: "clipboard-native-" + process.pid,
      },
    });
    win.webContents.session.webRequest.onBeforeRequest(
      { urls: ["file:///*"] },
      (d, cb) => cb({ cancel: /\.js$/.test(d.url) }),
    );
    await win.loadFile(path.join(root, "dist-electron/renderer/index.html"));
    const js = (code) => win.webContents.executeJavaScript(code);
    const id = win.webContents.id,
      call = crypto.randomUUID(),
      policy = { control: false, clipboard: true, files: true };
    auth.setNativeSession(id, {
      callId: call,
      role: "client",
      permissions: policy,
    });
    const source = path.join(out, "origem café.txt");
    fs.writeFileSync(source, "Native clipboard file fixture");
    await clipboard.write([
      new ClipboardItem({ "text/uri-list": pathToFileURL(source).href }),
    ]);
    const snapshot = await js("window.electronAPI.readClipboardFiles()");
    check(
      "Copied native file yields bounded metadata and opaque token",
      snapshot.files.length === 1 &&
        snapshot.files[0].name === "origem café.txt" &&
        !JSON.stringify(snapshot).includes(source),
    );
    const token = snapshot.files[0].token;
    check(
      "Authorized clipboard file bytes read correctly",
      await js(
        "window.electronAPI.readClipboardFileChunk(" +
          JSON.stringify(token) +
          ',0).then(b=>atob(b)==="Native clipboard file fixture")',
      ),
    );
    check(
      "Unknown token cannot read arbitrary path",
      await js(
        'window.electronAPI.readClipboardFileChunk("../unknown",0).then(()=>false,()=>true)',
      ),
    );
    check(
      "Invalid chunk offset rejected",
      await js(
        "window.electronAPI.readClipboardFileChunk(" +
          JSON.stringify(token) +
          ",-1).then(()=>false,()=>true)",
      ),
    );
    auth.setNativeSession(id, {
      callId: call,
      role: "client",
      permissions: { ...policy, files: false },
    });
    check(
      "Clipboard alone cannot transfer files",
      await js(
        "window.electronAPI.readClipboardFiles().then(()=>false,()=>true)",
      ),
    );
    check(
      "Revoked file token cannot read bytes",
      await js(
        "window.electronAPI.readClipboardFileChunk(" +
          JSON.stringify(token) +
          ",0).then(()=>false,()=>true)",
      ),
    );
    auth.setNativeSession(id, {
      callId: call,
      role: "client",
      permissions: policy,
    });
    check(
      "Arbitrary clipboard file destinations rejected",
      await js(
        "window.electronAPI.setReceivedFilesClipboard([" +
          JSON.stringify(source) +
          "]).then(()=>false,()=>true)",
      ),
    );
    const received = await js(
      'window.electronAPI.saveFileToDownloads("received.txt","dGVzdA==")',
    );
    assert.ok(received.success);
    await js(
      "window.electronAPI.setReceivedFilesClipboard([" +
        JSON.stringify(received.filePath) +
        "])",
    );
    check(
      "Received files exposed through OS file clipboard",
      await clipboard.has("text/uri-list"),
    );
    check(
      "Received file clipboard does not echo to sender",
      (await js("window.electronAPI.readClipboardFiles()")) === null,
    );
    if (process.platform === "win32") {
      const cs = path.join(out, "Probe.cs"),
        exe = path.join(out, "Probe.exe");
      fs.writeFileSync(
        cs,
        'using System;using System.Windows.Forms;class Probe{[STAThread]static void Main(){var files=Clipboard.GetFileDropList();Console.WriteLine(files.Count+":"+(files.Count>0?System.IO.Path.GetFileName(files[0]):""));}}',
      );
      await exec(
        path.join(
          process.env.WINDIR,
          "Microsoft.NET/Framework64/v4.0.30319/csc.exe",
        ),
        ["/nologo", "/r:System.Windows.Forms.dll", "/out:" + exe, cs],
        { windowsHide: true },
      );
      const result = await exec(exe, [], { windowsHide: true });
      check(
        "Windows native FileDropList sees received file ready to paste",
        result.stdout.trim() === "1:received.txt",
      );
    }
    await clipboard.write([
      new ClipboardItem({ "text/uri-list": pathToFileURL(out).href }),
    ]);
    check(
      "Directory clipboard is rejected explicitly",
      await js(
        "window.electronAPI.readClipboardFiles().then(()=>false,()=>true)",
      ),
    );
    const oversized = path.join(out, "oversized.bin");
    fs.closeSync(fs.openSync(oversized, "w"));
    fs.truncateSync(oversized, 33 * 1024 * 1024);
    await clipboard.write([
      new ClipboardItem({ "text/uri-list": pathToFileURL(oversized).href }),
    ]);
    check(
      "Oversized file rejected before reading bytes",
      await js(
        "window.electronAPI.readClipboardFiles().then(()=>false,()=>true)",
      ),
    );
    await clipboard.write([
      new ClipboardItem({
        "text/uri-list": Array(21)
          .fill(pathToFileURL(source).href)
          .join("\r\n"),
      }),
    ]);
    check(
      "Clipboard selection count is bounded",
      await js(
        "window.electronAPI.readClipboardFiles().then(()=>false,()=>true)",
      ),
    );
    check(
      "Source files remain intact after clipboard synchronization",
      fs.existsSync(source) &&
        fs.readFileSync(source, "utf8") === "Native clipboard file fixture",
    );
    fs.writeFileSync(
      path.join(out, "validation.json"),
      JSON.stringify({ passed: checks.length, checks }, null, 2),
    );
    await restore();
    win.destroy();
    app.exit(0);
  } catch (error) {
    console.error(error);
    await restore();
    win?.destroy();
    app.exit(1);
  }
});
