// Preserve readable native formats in memory; never persist clipboard content.
async function snapshotClipboard(clipboard, ClipboardItem) {
  const previous = await clipboard.readText();
  const saved = [];
  for (const item of await clipboard.read()) {
    const values = {};
    for (const type of item.types) values[type] = await item.getType(type);
    // A fresh Windows runner can expose an item with no supported MIME types.
    if (Object.keys(values).length) saved.push(new ClipboardItem(values));
  }
  return async () => {
    try {
      if (saved.length) await clipboard.write(saved);
      else await clipboard.writeText(previous);
    } catch {
      await clipboard.writeText(previous);
    }
  };
}
module.exports = { snapshotClipboard };
