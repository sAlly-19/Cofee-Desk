// Native virtual-mouse proof against a real Chromium button. No shared-cursor commands.
const { app, BrowserWindow, screen } = require("electron");
const path = require("node:path"),
  fs = require("node:fs"),
  { spawn } = require("node:child_process"),
  assert = require("node:assert/strict");
const out = path.resolve("artifacts/virtual-mouse");
fs.mkdirSync(out, { recursive: true });
app.setPath("userData", path.join(out, "profile"));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
app.whenReady().then(async () => {
  let win, helper;
  try {
    win = new BrowserWindow({
      x: 500,
      y: 350,
      width: 420,
      height: 240,
      frame: false,
      show: false,
      alwaysOnTop: true,
      webPreferences: { contextIsolation: true, nodeIntegration: false },
    });
    await win.loadURL(
      "data:text/html;charset=utf-8," +
        encodeURIComponent(
          '<body style="background:#2b1b10;color:white"><button style="margin:35px;width:260px;height:80px" onclick="this.textContent=\'VIRTUAL CLICKED\'">Coffee Desk virtual input test</button></body>',
        ),
    );
    win.showInactive();
    await wait(120);
    const target = await win.webContents.executeJavaScript(
      '(()=>{const b=document.querySelector("button").getBoundingClientRect();return {x:b.left+b.width/2,y:b.top+b.height/2};})()',
    );
    const bounds = win.getContentBounds(),
      point = screen.dipToScreenPoint({
        x: Math.round(bounds.x + target.x),
        y: Math.round(bounds.y + target.y),
      });
    helper = spawn(
      path.resolve("dist-electron/main/native/CoffeeInput-v2.exe"),
      [],
      { stdio: ["pipe", "pipe", "pipe"], windowsHide: true },
    );
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error("Helper timeout")), 4000);
      helper.stdout.on("data", (raw) => {
        if (String(raw).includes("VIRTUAL_MOUSE_V1")) {
          clearTimeout(timer);
          resolve();
        }
      });
      helper.once("error", reject);
    });
    const cursorSamples = [];
    require("node:readline")
      .createInterface({ input: helper.stdout })
      .on("line", (line) => {
        if (line.startsWith("CURSOR "))
          cursorSamples.push(line.split(" ").slice(1).map(Number));
      });
    helper.stdin.write(
      "CURSOR\nVM " +
        point.x +
        " " +
        point.y +
        "\nCURSOR\nVD left\nVU left\nCURSOR\n",
    );
    await wait(300);
    const clicked = await win.webContents.executeJavaScript(
      'document.querySelector("button").textContent==="VIRTUAL CLICKED"',
    );
    assert.ok(clicked, "Virtual mouse must click a real Chromium button");
    assert.ok(
      !/SetCursorPos|mouse_event|SendInput/.test(
        fs.readFileSync(
          path.resolve("src/main/native/VirtualMouse.cs"),
          "utf8",
        ),
      ),
      "Virtual backend cannot call cursor movement APIs",
    );
    console.log(
      "PASS Virtual mouse clicks real Chromium control through window messages",
    );
    assert.ok(
      cursorSamples.length === 3 &&
        !(cursorSamples[1][0] === point.x && cursorSamples[1][1] === point.y),
      "Virtual movement cannot warp OS cursor to its target",
    );
    console.log("PASS Windows cursor stays separate from virtual target");
    console.log(
      "PASS Virtual backend contains no global cursor injection calls",
    );
    fs.writeFileSync(
      path.join(out, "validation.json"),
      JSON.stringify(
        {
          passed: 3,
          checks: [
            "Real Chromium virtual click",
            "Windows cursor separate from virtual target",
            "No global cursor movement API in virtual backend",
          ],
        },
        null,
        2,
      ),
    );
    helper.stdin.write("EXIT\n");
    win.destroy();
    app.exit(0);
  } catch (error) {
    console.error(error);
    helper?.kill();
    win?.destroy();
    app.exit(1);
  }
});
