const { app, BrowserWindow, nativeImage } = require("electron");
const fs = require("node:fs"),
  path = require("node:path"),
  { pathToFileURL } = require("node:url");
const root = path.resolve(__dirname, ".."),
  work = path.join(root, "artifacts/installer-art");
fs.mkdirSync(work, { recursive: true });
app.setPath("userData", path.join(work, "profile"));
function bmp(image) {
  const { width: w, height: h } = image.getSize(),
    raw = image.toBitmap(),
    stride = Math.ceil((w * 3) / 4) * 4,
    b = Buffer.alloc(54 + stride * h);
  b.write("BM");
  b.writeUInt32LE(b.length, 2);
  b.writeUInt32LE(54, 10);
  b.writeUInt32LE(40, 14);
  b.writeInt32LE(w, 18);
  b.writeInt32LE(h, 22);
  b.writeUInt16LE(1, 26);
  b.writeUInt16LE(24, 28);
  b.writeUInt32LE(stride * h, 34);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const p = ((h - 1 - y) * w + x) * 4,
        q = 54 + y * stride + x * 3;
      b[q] = raw[p];
      b[q + 1] = raw[p + 1];
      b[q + 2] = raw[p + 2];
    }
  return b;
}
app.whenReady().then(async () => {
  let win;
  try {
    const title = pathToFileURL(
        path.join(root, "assets/fonts/Fraunces.ttf"),
      ).href,
      text = pathToFileURL(path.join(root, "assets/fonts/Inter.ttf")).href;
    fs.writeFileSync(
      path.join(work, "index.html"),
      '<!doctype html><style>@font-face{font-family:InstallerTitle;src:url("' +
        title +
        '");font-weight:100 900}@font-face{font-family:InstallerText;src:url("' +
        text +
        '");font-weight:100 900}</style>',
    );
    win = new BrowserWindow({
      show: false,
      webPreferences: { contextIsolation: true, nodeIntegration: false },
    });
    await win.loadFile(path.join(work, "index.html"));
    const mark =
      "data:image/svg+xml;base64," +
      fs
        .readFileSync(path.join(root, "assets/brand/coffee-mark.svg"))
        .toString("base64");
    for (const name of ["sidebar", "header"]) {
      const data = await win.webContents.executeJavaScript(
        "(" +
          async function (name, mark) {
            await document.fonts.load("600 26px InstallerTitle");
            await document.fonts.load("500 10px InstallerText");
            const image = new Image();
            image.src = mark;
            await image.decode();
            const canvas = document.createElement("canvas");
            canvas.width = name === "sidebar" ? 164 : 150;
            canvas.height = name === "sidebar" ? 314 : 57;
            const c = canvas.getContext("2d");
            c.fillStyle = "#21150f";
            c.fillRect(0, 0, canvas.width, canvas.height);
            c.strokeStyle = "#674029";
            c.lineWidth = 1;
            c.beginPath();
            c.arc(190, 265, 100, 0, Math.PI * 2);
            c.stroke();
            c.fillStyle = "#f4e8d4";
            if (name === "sidebar") {
              c.drawImage(image, 49, 27, 64, 64);
              c.font = "600 27px InstallerTitle";
              c.fillText("Coffee", 22, 127);
              c.fillText("Desk", 22, 157);
              c.fillStyle = "#c39368";
              c.font = "500 9px InstallerText";
              c.fillText("ACESSO REMOTO", 22, 182);
              c.strokeStyle = "#674029";
              c.beginPath();
              c.moveTo(22, 205);
              c.lineTo(141, 205);
              c.stroke();
              c.fillStyle = "#d4baa0";
              c.font = "400 10px InstallerText";
              c.fillText("Conecte. Compartilhe.", 22, 229);
              c.fillText("Continue seu trabalho.", 22, 245);
              c.fillStyle = "#c39368";
              c.font = "500 8px InstallerText";
              c.fillText("Café - Sistemas", 22, 285);
              c.fillText("& Softwares", 22, 298);
            } else {
              c.drawImage(image, 7, 7, 43, 43);
              c.font = "600 16px InstallerTitle";
              c.fillText("Coffee Desk", 54, 27);
              c.fillStyle = "#c39368";
              c.font = "400 8px InstallerText";
              c.fillText("ACESSO REMOTO", 55, 41);
            }
            return canvas.toDataURL("image/png");
          }.toString() +
          ")(" +
          JSON.stringify(name) +
          "," +
          JSON.stringify(mark) +
          ")",
      );
      const image = nativeImage.createFromDataURL(data);
      fs.writeFileSync(
        path.join(root, "build/installer", name + ".bmp"),
        bmp(image),
      );
      fs.writeFileSync(path.join(work, name + ".png"), image.toPNG());
      console.log("Installer artwork generated: " + name);
    }
    win.destroy();
    app.exit(0);
  } catch (e) {
    console.error(e);
    win?.destroy();
    app.exit(1);
  }
});
