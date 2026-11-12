import { app } from "electron";
import type { IpcMainEvent, IpcMainInvokeEvent } from "electron";
import { fileURLToPath } from "url";
import path from "path";
export function assertTrusted(event: IpcMainEvent | IpcMainInvokeEvent) {
  if (event.senderFrame !== event.sender.mainFrame)
    throw new Error("Origem IPC não autorizada");
  const url = event.senderFrame?.url || "";
  let file = false;
  try {
    file =
      url.startsWith("file://") &&
      path.resolve(fileURLToPath(url)) ===
        path.resolve(__dirname, "../renderer/index.html");
  } catch {
    /* Invalid URL fails closed. */
  }
  if (
    !file &&
    !(!app.isPackaged && /^http:\/\/(localhost|127\.0\.0\.1):5173\//.test(url))
  )
    throw new Error("Origem IPC não autorizada");
}
