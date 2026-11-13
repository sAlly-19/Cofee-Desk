const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
if (process.platform === "win32") {
  const root = path.resolve(__dirname, ".."),
    source = path.join(root, "src/main/native/CoffeeInput.cs"),
    out = path.join(root, "dist-electron/main/native");
  fs.mkdirSync(out, { recursive: true });
  const hash = crypto
      .createHash("sha256")
      .update(fs.readFileSync(source))
    .update(fs.readFileSync(path.join(root,"src/main/native/VirtualMouse.cs")))
      .digest("hex"),
    stamp = path.join(out, ".source-sha256"),
    exe = path.join(out, "CoffeeInput-v2.exe");
  if (
    !fs.existsSync(exe) ||
    !fs.existsSync(stamp) ||
    fs.readFileSync(stamp, "utf8") !== hash
  ) {
    const compiler = path.join(
      process.env.WINDIR || "C:\Windows",
      "Microsoft.NET/Framework64/v4.0.30319/csc.exe",
    );
    execFileSync(
      compiler,
      ["/nologo", "/optimize", "/target:exe", "/out:" + exe, source,path.join(root,"src/main/native/VirtualMouse.cs")],
      { stdio: "inherit", windowsHide: true },
    );
    fs.writeFileSync(stamp, hash);
  }
  const legacy = path.join(out, "CoffeeInput.exe");
  if (!fs.existsSync(legacy))
    fs.copyFileSync(path.join(root, "src/main/native/CoffeeInput.exe"), legacy);
  console.log("Native helper compiled and up to date.");
}
