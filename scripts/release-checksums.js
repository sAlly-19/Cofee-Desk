const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const version = require("../package.json").version;
const output = path.resolve(__dirname, "../release");
(async () => {
  const files = fs
    .readdirSync(output)
    .filter(
      (name) =>
        name.startsWith("Coffee-Desk-" + version + "-") &&
        /\.(exe|zip|blockmap)$/.test(name),
    )
    .sort();
  if (!files.length) throw new Error("Nenhum arquivo de release encontrado.");
  const lines = [];
  for (const name of files) {
    const hash = crypto.createHash("sha256");
    for await (const chunk of fs.createReadStream(path.join(output, name)))
      hash.update(chunk);
    lines.push(hash.digest("hex") + "  " + name);
  }
  fs.writeFileSync(
    path.join(output, "SHA256SUMS.txt"),
    lines.join("\n") + "\n",
  );
  console.log("SHA256SUMS.txt gerado para " + files.length + " arquivos.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
