import { randomUUID } from "crypto";
import { registerDeviceClipboard } from "./deviceClipboard";
import { assertTrusted } from "./ipcSecurity";
import {
  hasPermission,
  nativeSession,
  onNativeSessionChange,
} from "./sessionAuthority";
import { ipcMain, app, shell, dialog, BrowserWindow } from "electron";
import path from "path";
import fs from "fs";
import { store } from "./store";

const savedFiles = new Map<number, Set<string>>();
const fileOwners = new Set<number>();
const budgets = new Map<
  number,
  { callId: string; bytes: number; count: number }
>();
const MAX_SESSION_BYTES = 256 * 1024 * 1024;
const MAX_SESSION_FILES = 500;
export const isReceivedFile = (sender: number, file: string) =>
  savedFiles.get(sender)?.has(file) === true;
function getUniqueFilePath(dir: string, fileName: string): string {
  let targetPath = path.join(dir, fileName);
  if (!fs.existsSync(targetPath)) return targetPath;

  const ext = path.extname(fileName);
  const base = path.basename(fileName, ext);
  let counter = 1;
  while (fs.existsSync(targetPath)) {
    if (counter > 100)
      return path.join(dir, base + " (" + randomUUID() + ")" + ext);
    targetPath = path.join(dir, `${base} (${counter})${ext}`);
    counter++;
  }
  return targetPath;
}

/**
 * Registra todos os handlers de IPC gerais do processo Main.
 * Chamado após a inicialização do app.
 */
export function registerIpcHandlers(): void {
  registerDeviceClipboard();
  onNativeSessionChange((sender, state) => {
    if (!state || budgets.get(sender)?.callId !== state.callId) {
      budgets.delete(sender);
      savedFiles.delete(sender);
    }
  });
  ipcMain.on("session:setRemoteId", (event, remoteId: unknown) => {
    try {
      assertTrusted(event);
    } catch {
      return;
    }
    if (
      remoteId === null ||
      (typeof remoteId === "string" && /^\d{3}-\d{3}-\d{3}$/.test(remoteId))
    )
      store.set("session.remoteId", remoteId);
  });
  const validSetting = (key: unknown, value?: unknown) =>
    typeof key === "string" &&
    ((key === "quality" && ["low", "medium", "high"].includes(String(value))) ||
      (key === "frameRate" &&
        [15, 30, 60].includes(Number(value)) &&
        typeof value === "number") ||
      (["enableClipboardSync", "enableFileTransfer"].includes(key) &&
        typeof value === "boolean"));
  ipcMain.on("settings:set", (event, key: unknown, value: unknown) => {
    try {
      assertTrusted(event);
    } catch {
      return;
    }
    if (validSetting(key, value)) store.set("settings." + key, value);
  });
  ipcMain.handle("settings:get", (event, key: unknown) => {
    assertTrusted(event);
    if (
      typeof key !== "string" ||
      ![
        "quality",
        "frameRate",
        "enableClipboardSync",
        "enableFileTransfer",
      ].includes(key)
    )
      throw Error("Preferência inválida");
    return store.get("settings." + key);
  });

  // Salvar arquivo recebido na pasta Downloads nativa
  ipcMain.handle(
    "file:saveToDownloads",
    async (
      event,
      { fileName, base64Data }: { fileName: string; base64Data: string },
    ) => {
      try {
        assertTrusted(event);
        if (!hasPermission(event.sender.id, "files"))
          throw new Error("Transferência não autorizada");
        if (
          typeof fileName !== "string" ||
          !fileName ||
          fileName.length > 200 ||
          path.basename(fileName) !== fileName ||
          /[. ]$/.test(fileName) ||
          /[<>:"/\\|?*\x00-\x1f]/.test(fileName) ||
          /^(CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])(\.|$)/i.test(fileName) ||
          typeof base64Data !== "string" ||
          base64Data.length > 44739244
        )
          throw new Error("Arquivo inválido");
        const downloadsDir = app.getPath("downloads");
        const targetPath = getUniqueFilePath(downloadsDir, fileName);
        const buffer = Buffer.from(base64Data, "base64");
        if (buffer.length > 32 * 1024 * 1024)
          throw new Error("Arquivo excede 32 MB");
        const callId = nativeSession(event.sender.id)!.callId;
        const budget = budgets.get(event.sender.id) ?? {
          callId,
          bytes: 0,
          count: 0,
        };
        if (
          budget.count >= MAX_SESSION_FILES ||
          budget.bytes + buffer.length > MAX_SESSION_BYTES
        )
          throw new Error(
            "Limite de recebimento desta sessão atingido (256 MB ou 500 arquivos)",
          );
        fs.writeFileSync(targetPath, buffer, { flag: "wx", flush: true });
        budgets.set(event.sender.id, {
          callId,
          bytes: budget.bytes + buffer.length,
          count: budget.count + 1,
        });
        if (!savedFiles.has(event.sender.id)) {
          savedFiles.set(event.sender.id, new Set());
          if (!fileOwners.has(event.sender.id)) {
            fileOwners.add(event.sender.id);
            event.sender.once("destroyed", () => {
            savedFiles.delete(event.sender.id);
            budgets.delete(event.sender.id);
            fileOwners.delete(event.sender.id);
          });
          }
        }
        savedFiles.get(event.sender.id)!.add(targetPath);
        console.log("[FileTransfer] Arquivo recebido salvo");
        return { success: true, filePath: targetPath };
      } catch (err: any) {
        console.error("[FileTransfer] Falha ao salvar arquivo recebido");
        return {
          success: false,
          error:
            err instanceof Error &&
            [
              "Arquivo inválido",
              "Arquivo excede 32 MB",
              "Transferência não autorizada",
              "Limite de recebimento desta sessão atingido (256 MB ou 500 arquivos)",
            ].includes(err.message)
              ? err.message
              : "Falha ao salvar arquivo",
        };
      }
    },
  );

  // Revelar arquivo salvo no Windows Explorer
  ipcMain.handle("file:showInFolder", async (event, filePath: string) => {
    try {
      assertTrusted(event);
      if (
        typeof filePath !== "string" ||
        !savedFiles.get(event.sender.id)?.has(filePath)
      )
        return { success: false, error: "Arquivo não autorizado" };
      if (fs.existsSync(filePath)) {
        shell.showItemInFolder(filePath);
        return { success: true };
      }
      return { success: false, error: "Arquivo não encontrado" };
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  });

  // Abrir arquivo com o aplicativo padrão
  ipcMain.handle("file:openFile", async (event, filePath: unknown) => {
    try {
      assertTrusted(event);
      if (
        typeof filePath !== "string" ||
        !hasPermission(event.sender.id, "files") ||
        !isReceivedFile(event.sender.id, filePath)
      )
        return { success: false, error: "Arquivo não autorizado" };
      const extension = path.extname(filePath).toLowerCase();
      if (
        !new Set([
          ".txt",
          ".pdf",
          ".png",
          ".jpg",
          ".jpeg",
          ".gif",
          ".webp",
          ".csv",
          ".log",
          ".docx",
          ".xlsx",
          ".pptx",
          ".odt",
          ".ods",
          ".rtf",
          ".md",
          ".zip",
        ]).has(extension)
      )
        return {
          success: false,
          error: "Use a pasta de Downloads para abrir este tipo de arquivo.",
        };
      const owner = BrowserWindow.fromWebContents(event.sender);
      if (!owner) return { success: false, error: "Janela não disponível" };
      const answer = await dialog.showMessageBox(owner, {
        type: "question",
        title: "Abrir arquivo recebido",
        message: "Abrir este arquivo no aplicativo padrão?",
        detail: path.basename(filePath),
        buttons: ["Cancelar", "Abrir arquivo"],
        defaultId: 0,
        cancelId: 0,
      });
      if (
        answer.response !== 1 ||
        !hasPermission(event.sender.id, "files") ||
        !isReceivedFile(event.sender.id, filePath)
      )
        return { success: false, error: "Abertura cancelada" };
      if (fs.existsSync(filePath) && !fs.lstatSync(filePath).isSymbolicLink()) {
        const error = await shell.openPath(filePath);
        if (error)
          return { success: false, error: "Não foi possível abrir o arquivo" };
        return { success: true };
      }
      return { success: false, error: "Arquivo não encontrado" };
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  });
}
