const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { path7za } = require("7zip-bin");
const root = path.resolve(__dirname, "..");
const version = require("../package.json").version;
const files = execFileSync("git", ["ls-files", "--cached", "-z"], {
  cwd: root,
  encoding: "utf8",
})
  .split("\0")
  .filter(Boolean);
if (!files.length)
  throw new Error("Prepare os arquivos com git add . antes de gerar o ZIP.");
if (
  files.some(
    (p) =>
      /^(node_modules|release|artifacts|dist-electron|signaling-server\/(node_modules|dist))\//.test(
        p,
      ) || /(^|\/)\.env($|\.)/.test(p),
  )
)
  throw new Error(
    "O índice inclui arquivos locais que não devem ser publicados.",
  );
const output = path.join(root, "release");
fs.mkdirSync(output, { recursive: true });
const zip = path.join(output, "Coffee-Desk-" + version + "-source.zip");
const list = path.join(output, "source-files.txt");
fs.writeFileSync(list, files.join("\n"), "utf8");
if (fs.existsSync(zip)) fs.unlinkSync(zip);
execFileSync(path7za, ["a", "-tzip", "-mx=7", "-scsUTF-8", zip, "@" + list], {
  cwd: root,
  stdio: "inherit",
});
fs.unlinkSync(list);
console.log("Código-fonte preparado: " + zip);
