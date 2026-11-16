const assert = require("node:assert/strict");
const { snapshotClipboard } = require("./clipboard-test-state");
(async () => {
  const created = [],
    writes = [];
  class Item {
    constructor(values) {
      assert.ok(Object.keys(values).length, "Empty ClipboardItem prohibited");
      this.values = values;
      created.push(values);
    }
  }
  const clipboard = {
    readText: async () => "original fixture",
    read: async () => [{ types: [] }],
    write: async (items) => writes.push(items),
    writeText: async (text) => writes.push(text),
  };
  let restore = await snapshotClipboard(clipboard, Item);
  assert.equal(created.length, 0);
  console.log("PASS Empty MIME item is not reconstructed");
  await restore();
  assert.equal(writes.at(-1), "original fixture");
  console.log("PASS Empty clipboard snapshot restores its text fallback");
  clipboard.read = async () => [
    { types: [] },
    { types: ["text/plain"], getType: async () => "format fixture" },
  ];
  restore = await snapshotClipboard(clipboard, Item);
  await restore();
  assert.equal(created.length, 1);
  assert.equal(writes.at(-1)[0].values["text/plain"], "format fixture");
  console.log("PASS Valid formats survive alongside empty MIME items");
  clipboard.write = async () => {
    throw Error("simulated restore rejection");
  };
  await restore();
  assert.equal(writes.at(-1), "original fixture");
  console.log("PASS Failed native restoration falls back to original text");
  const count = writes.length;
  clipboard.read = async () => {
    throw Error("simulated snapshot failure");
  };
  await assert.rejects(snapshotClipboard(clipboard, Item), /snapshot failure/);
  assert.equal(writes.length, count);
  console.log("PASS Snapshot failure propagates before clipboard is modified");
  clipboard.read = async () => [];
  restore = await snapshotClipboard(clipboard, Item);
  await restore();
  assert.equal(writes.at(-1), "original fixture");
  console.log("PASS A completely empty item list is supported");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
