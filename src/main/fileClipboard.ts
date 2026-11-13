import { clipboard, ClipboardItem, ipcMain } from "electron";
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { createHash, randomUUID } from "crypto";
import { assertTrusted } from "./ipcSecurity";
import {
  hasPermission,
  nativeSession,
  onNativeSessionChange,
} from "./sessionAuthority";
import { isReceivedFile } from "./ipcHandlers";
type Entry = {
  token: string;
  name: string;
  size: number;
  file: string;
  mtime: number;
  ino: number;
};
const states = new Map<
  number,
  { call: string; revision: string; entries: Entry[] }
>();
const marker = "web application/x.coffee-desk.received-files",
  markerValue = randomUUID();
function allowed(id: number) {
  return hasPermission(id, "clipboard") && hasPermission(id, "files");
}
export function registerFileClipboard(
  canRead: (senderId: number) => boolean = () => true,
) {
  onNativeSessionChange((id) => {
    if (!allowed(id)) states.delete(id);
  });
  ipcMain.handle("clipboard:files", async (event) => {
    assertTrusted(event);
    const id = event.sender.id;
    try {
      if (!allowed(id)) throw Error("Arquivos no clipboard não autorizados");
      const call = nativeSession(id)!.callId;
      if (!canRead(id)) return null;
      if (!(await clipboard.has("text/uri-list"))) {
        states.delete(id);
        return null;
      }
      const items = await clipboard.read();
      const item = items.find((i) => i.types.includes("text/uri-list"));
      if (!item) {
        states.delete(id);
        return null;
      }
      const blob = await item.getType("text/uri-list");
      if (blob.size > 65536) throw Error("Seleção de arquivos muito grande");
      const text = await blob.text();
      const origin = items.find((i) => i.types.includes(marker));
      if (
        origin &&
        (await (await origin.getType(marker)).text()) === markerValue
      ) {
        states.delete(id);
        return null;
      }
      if (!allowed(id) || nativeSession(id)?.callId !== call)
        throw Error("Permissão revogada");
      const urls = text.split(/\r?\n/).filter((s) => s && !s.startsWith("#"));
      if (!urls.length || urls.length > 20)
        throw Error("Copie até 20 arquivos por vez");
      let total = 0;
      const entries: Entry[] = [];
      for (const uri of urls) {
        const url = new URL(uri);
        if (url.protocol !== "file:" || url.hostname || url.search || url.hash)
          throw Error("Somente arquivos locais podem ser copiados");
        const file = fileURLToPath(url);
        if (
          process.platform === "win32" &&
          (!/^[A-Za-z]:\\/.test(file) || file.includes(":", 2))
        )
          throw Error("Caminho não permitido");
        const stat = await fs.promises.lstat(file).catch(() => {
          states.delete(id);
          throw Error("O arquivo copiado não está acessível.");
        });
        if (
          !stat.isFile() ||
          stat.isSymbolicLink() ||
          stat.size > 32 * 1024 * 1024
        )
          throw Error(
            "Copie arquivos individuais de até 32 MB; pastas não são suportadas",
          );
        total += stat.size;
        if (total > 64 * 1024 * 1024)
          throw Error("A seleção pode ter até 64 MB");
        entries.push({
          token: randomUUID(),
          file,
          name: path.basename(file),
          size: stat.size,
          mtime: stat.mtimeMs,
          ino: stat.ino,
        });
      }
      if (!allowed(id) || nativeSession(id)?.callId !== call)
        throw Error("Permissão revogada");
      const revision = createHash("sha256")
        .update(text + entries.map((e) => e.size + ":" + e.mtime).join("|"))
        .digest("hex");
      const old = states.get(id);
      if (old?.call === call && old.revision === revision)
        return {
          revision,
          files: old.entries.map(({ token, name, size }) => ({
            token,
            name,
            size,
          })),
        };
      states.set(id, { call, revision, entries });
      return {
        revision,
        files: entries.map(({ token, name, size }) => ({ token, name, size })),
      };
    } catch (error) {
      states.delete(id);
      throw error;
    }
  });
  ipcMain.handle(
    "clipboard:file-chunk",
    async (event, token: unknown, offset: unknown) => {
      assertTrusted(event);
      const id = event.sender.id,
        state = states.get(id);
      if (
        !state ||
        !allowed(id) ||
        state.call !== nativeSession(id)?.callId ||
        typeof token !== "string" ||
        !Number.isSafeInteger(offset) ||
        Number(offset) < 0
      )
        throw Error("Leitura não autorizada");
      const entry = state.entries.find((e) => e.token === token);
      if (!entry || Number(offset) > entry.size)
        throw Error("Arquivo não autorizado");
      const handle = await fs.promises.open(
        entry.file,
        fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0),
      );
      try {
        const stat = await handle.stat();
        if (
          !stat.isFile() ||
          stat.size !== entry.size ||
          stat.mtimeMs !== entry.mtime ||
          stat.ino !== entry.ino
        )
          throw Error("O arquivo mudou; copie novamente");
        const buffer = Buffer.alloc(
          Math.min(65536, entry.size - Number(offset)),
        );
        const { bytesRead } = await handle.read(
          buffer,
          0,
          buffer.length,
          Number(offset),
        );
        if (
          !allowed(id) ||
          states.get(id) !== state ||
          state.call !== nativeSession(id)?.callId
        )
          throw Error("Permissão revogada");
        return buffer.subarray(0, bytesRead).toString("base64");
      } finally {
        await handle.close();
      }
    },
  );
  ipcMain.handle("clipboard:received-files", async (event, files: unknown) => {
    assertTrusted(event);
    const id = event.sender.id,
      call = nativeSession(id)?.callId;
    if (
      !allowed(id) ||
      !Array.isArray(files) ||
      !files.length ||
      files.length > 20 ||
      !files.every((f) => typeof f === "string" && isReceivedFile(id, f))
    )
      throw Error("Arquivos recebidos não autorizados");
    const text = files.map((f) => pathToFileURL(f).href).join("\r\n");
    if (!allowed(id) || nativeSession(id)?.callId !== call)
      throw Error("Permissão revogada");
    await clipboard.write([
      new ClipboardItem({ "text/uri-list": text, [marker]: markerValue }),
    ]);
    return true;
  });
}
