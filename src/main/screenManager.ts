import {
  desktopCapturer,
  ipcMain,
  session,
  screen,
  webContents,
} from "electron";
import { IPC_CHANNELS } from "../shared/ipcChannels";
import type { DesktopSource } from "../shared/types";
import { assertTrusted } from "./ipcSecurity";
import {
  nativeSession,
  prepareNativeSource,
  selectedSource,
} from "./sessionAuthority";
export async function getDesktopSources(): Promise<DesktopSource[]> {
  const sources = await desktopCapturer.getSources({
    types: ["screen", "window"],
    thumbnailSize: { width: 240, height: 135 },
  });
  return sources.map((s) => ({
    id: s.id,
    name: s.name,
    thumbnail: s.thumbnail.toDataURL(),
    displayId: s.display_id || "",
    isPrimary: s.display_id === String(screen.getPrimaryDisplay().id),
  }));
}
export async function selectDesktopSource(sender: number, sourceId: string) {
  if (typeof sourceId !== "string" || sourceId.length > 150)
    throw new Error("Fonte inválida");
  const source = (await getDesktopSources()).find((s) => s.id === sourceId);
  if (!source) throw new Error("A tela ou janela não está mais disponível");
  const kind = source.id.startsWith("screen:") ? "screen" : "window";
  const display =
    kind === "screen"
      ? screen.getAllDisplays().find((d) => String(d.id) === source.displayId)
      : undefined;
  if (kind === "screen" && !display) throw new Error("Monitor não encontrado");
  const bounds = display
    ? process.platform === "win32"
      ? screen.dipToScreenRect(null, display.bounds)
      : display.bounds
    : undefined;
  prepareNativeSource(sender, { sourceId, sourceKind: kind, bounds });
  return { success: true, sourceId, kind };
}
export function registerScreenIpcHandlers(): void {
  ipcMain.handle("desktop:selection", (event) => {
    assertTrusted(event);
    const source = selectedSource(event.sender.id);
    return source
      ? {
          sourceId: source.sourceId,
          kind: source.sourceKind,
          active: nativeSession(event.sender.id)?.captureActive === true,
        }
      : null;
  });
  let inspecting = false;
  const invalidate = (id: number) => {
    prepareNativeSource(id);
    const owner = webContents.fromId(id);
    if (owner && !owner.isDestroyed()) owner.send("capture:unavailable");
  };
  const timer = setInterval(() => {
    if (inspecting) return;
    const hosts = webContents
      .getAllWebContents()
      .filter(
        (w) => nativeSession(w.id)?.role === "host" && selectedSource(w.id),
      );
    if (!hosts.length) return;
    inspecting = true;
    void desktopCapturer
      .getSources({
        types: ["screen", "window"],
        thumbnailSize: { width: 0, height: 0 },
      })
      .then((available) => {
        for (const owner of hosts) {
          const selected = selectedSource(owner.id);
          if (selected && !available.some((s) => s.id === selected.sourceId))
            invalidate(owner.id);
        }
      })
      .catch(() => {
        /* A transient enumeration failure does not choose another source. */
      })
      .finally(() => {
        inspecting = false;
      });
  }, 2000);
  timer.unref();
  const topology = () => {
    for (const owner of webContents.getAllWebContents())
      if (
        nativeSession(owner.id)?.role === "host" &&
        selectedSource(owner.id)?.sourceKind === "screen"
      )
        invalidate(owner.id);
  };
  screen.on("display-removed", topology);
  screen.on("display-metrics-changed", topology);

  session.defaultSession.setPermissionCheckHandler(
    (contents, permission) =>
      permission === "display-capture" ||
      permission === "media" ||
      (permission === "pointerLock" &&
        !!contents &&
        nativeSession(contents.id)?.role === "client" &&
        nativeSession(contents.id)?.permissions.control === true),
  );
  session.defaultSession.setPermissionRequestHandler(
    (contents, permission, callback) =>
      callback(
        permission === "display-capture" ||
          permission === "media" ||
          (permission === "pointerLock" &&
            nativeSession(contents.id)?.role === "client" &&
            nativeSession(contents.id)?.permissions.control === true),
      ),
  );
  session.defaultSession.setDisplayMediaRequestHandler(
    async (request, callback) => {
      try {
        const sender = request.frame?.processId;
        // Match the exact main frame, not a renderer-provided webContents id.
        const owner = webContents
          .getAllWebContents()
          .find((w) => w.mainFrame === request.frame);
        if (!owner || sender === undefined)
          throw new Error("Captura não autorizada");
        const active = nativeSession(owner.id),
          selected = selectedSource(owner.id);
        if (!active || active.role !== "host" || !selected)
          throw new Error("Aceite ainda não confirmado");
        const source = (
          await desktopCapturer.getSources({ types: ["screen", "window"] })
        ).find((s) => s.id === selected.sourceId);
        if (!source) throw new Error("Fonte encerrada");
        callback({ video: source });
      } catch {
        callback(null);
      }
    },
  );
  ipcMain.handle(IPC_CHANNELS.DESKTOP_SOURCES, async (event) => {
    assertTrusted(event);
    return getDesktopSources();
  });
  ipcMain.handle(
    IPC_CHANNELS.DESKTOP_STREAM_START,
    async (event, id: string) => {
      assertTrusted(event);
      return selectDesktopSource(event.sender.id, id);
    },
  );
  ipcMain.handle(IPC_CHANNELS.DESKTOP_STREAM_STOP, (event) => {
    assertTrusted(event);
    prepareNativeSource(event.sender.id);
    return { success: true };
  });
}
