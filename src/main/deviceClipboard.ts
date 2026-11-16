import { clipboard, ipcMain } from "electron";
import { assertTrusted } from "./ipcSecurity";
// Local, explicit ID copying only. Remote clipboard remains session-authorized.
export async function copyDeviceId(id: unknown): Promise<true> {
  if (
    typeof id !== "string" ||
    (id.length !== 9 && id.length !== 11) ||
    !/^(?:\d{9}|\d{3}-\d{3}-\d{3})$/.test(id)
  )
    throw new Error("ID inválido");
  await clipboard.writeText(id);
  if ((await clipboard.readText()) !== id)
    throw new Error("Não foi possível confirmar a cópia do ID");
  return true;
}
export function registerDeviceClipboard(): void {
  ipcMain.handle("device:copy-id", (event, id: unknown) => {
    assertTrusted(event);
    return copyDeviceId(id);
  });
}
