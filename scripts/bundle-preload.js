// Sandboxed Electron preload cannot require application files at runtime.
// Bundle shared constants while retaining Electron's restricted require('electron').
const { buildSync } = require("esbuild");
const path = require("path");
const root = path.resolve(__dirname, "..");
buildSync({
  entryPoints: [path.join(root, "src/main/preload.ts")],
  outfile: path.join(root, "dist-electron/main/preload.js"),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  external: ["electron"],
});
