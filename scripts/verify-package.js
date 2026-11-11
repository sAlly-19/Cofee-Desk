const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const net = require("net");
const root = path.resolve(__dirname, "..");
const output = path.join(root, "artifacts/package-smoke");
fs.mkdirSync(output, { recursive: true });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
(async () => {
  const port = await new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const p = server.address().port;
      server.close(() => resolve(p));
    });
  });
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const executable = path.join(root, "release/win-unpacked/Coffee-Desk.exe");
  const child = spawn(
    executable,
    [
      "--user-data-dir=" + path.join(output, "profile"),
      "--remote-debugging-port=" + port,
    ],
    { env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  let logs = "",
    ws;
  child.stdout.on("data", (data) => {
    logs += data;
  });
  child.stderr.on("data", (data) => {
    logs += data;
  });
  child.on("error", (error) => {
    logs += error.message;
  });
  const ended = new Promise((resolve) => child.once("exit", resolve));
  const timer = setTimeout(() => child.kill(), 30000);
  try {
    let page;
    for (let i = 0; i < 80; i++) {
      try {
        const pages = await (
          await fetch("http://127.0.0.1:" + port + "/json/list")
        ).json();
        page = pages.find((p) => p.type === "page");
        if (page) break;
      } catch {}
      await sleep(200);
    }
    if (!page)
      throw new Error("Packaged main window did not expose a page. " + logs);
    ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", reject, { once: true });
    });
    let sequence = 0;
    const pending = new Map();
    ws.addEventListener("message", (e) => {
      const data = JSON.parse(e.data);
      if (data.id) {
        pending.get(data.id)?.(data);
        pending.delete(data.id);
      }
    });
    const evaluate = (expression) =>
      new Promise((resolve) => {
        const id = ++sequence;
        pending.set(id, resolve);
        ws.send(
          JSON.stringify({
            id,
            method: "Runtime.evaluate",
            params: { expression, returnByValue: true, awaitPromise: true },
          }),
        );
      });
    let result;
    for (let i = 0; i < 80; i++) {
      result = await evaluate(
        '({version:document.querySelector(".version-badge")?.textContent.trim(),signature:document.querySelector(".app-signature")?.textContent.trim(),native:typeof window.electronAPI?.getInputControlStatus === "function"})',
      );
      if (result.result?.result?.value?.signature) break;
      await sleep(200);
    }
    const state = result.result?.result?.value;
    const status = await evaluate("window.electronAPI.getInputControlStatus()");
    const passed =
      state?.version === "v1.0.0 · P2P" &&
      state.signature === "Café - Sistemas & Softwares" &&
      state.native &&
      status.result?.result?.value?.ready === true &&
      !logs.includes("UnhandledPromiseRejection");
    fs.writeFileSync(
      path.join(output, "result.json"),
      JSON.stringify(
        { passed, state, input: status.result?.result?.value },
        null,
        2,
      ),
    );
    if (!passed)
      throw new Error(
        "Packaged app verification failed: " +
          JSON.stringify(state) +
          " " +
          logs,
      );
    console.log(
      "PASS Packaged 1.0.0: signature, native preload and Win32 helper",
    );
    ws.send(
      JSON.stringify({
        id: ++sequence,
        method: "Runtime.evaluate",
        params: { expression: "window.electronAPI.close()" },
      }),
    );
    await Promise.race([ended, sleep(3000)]);
  } finally {
    clearTimeout(timer);
    ws?.close();
    if (child.exitCode === null) child.kill();
    fs.writeFileSync(path.join(output, "startup.log"), logs);
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
