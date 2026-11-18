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
  maySelectSource,
  captureCallId,
  prepareNativeSource,
  selectedSource,
} from "./sessionAuthority";
export async function getDesktopSources(): Promise<DesktopSource[]> {
  const sources = await desktopCapturer.getSources({
    types: ["screen", "window"],
    thumbnailSize: { width: 240, height: 135 },
    fetchWindowIcons: true,
  });
  return sources.map((s) => ({
    id: s.id,
    name: s.name,
    appIcon: s.appIcon?.isEmpty() === false ? s.appIcon.toDataURL() : undefined,
    thumbnail: s.thumbnail.toDataURL(),
    displayId: s.display_id || "",
    isPrimary: s.display_id === String(screen.getPrimaryDisplay().id),
  }));
}
export async function selectDesktopSource(sender: number, sourceId: string) {
  if (typeof sourceId !== "string" || sourceId.length > 150)
    throw new Error("Fonte inválida");
  const callId = captureCallId(sender);
  const source = (await getDesktopSources()).find((s) => s.id === sourceId);
  if (!callId || captureCallId(sender) !== callId)
    throw new Error("A solicitação de compartilhamento foi encerrada");
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
  prepareNativeSource(sender, {
    sourceId,
    sourceKind: kind,
    bounds,
    isPrimary: source.isPrimary,
  });
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

  const mayCapture = (
    owner: Electron.WebContents | null,
    permission: string,
  ) => {
    if (!owner || permission !== "display-capture" || owner.isDestroyed())
      return false;
    try {
      assertTrusted({
        sender: owner,
        senderFrame: owner.mainFrame,
      } as Electron.IpcMainInvokeEvent);
    } catch {
      return false;
    }
    return (
      nativeSession(owner.id)?.role === "host" && !!selectedSource(owner.id)
    );
  };
  session.defaultSession.setPermissionCheckHandler((owner, permission) =>
    mayCapture(owner, permission),
  );
  session.defaultSession.setPermissionRequestHandler(
    (owner, permission, callback) => callback(mayCapture(owner, permission)),
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
        assertTrusted({
          sender: owner,
          senderFrame: owner.mainFrame,
        } as Electron.IpcMainInvokeEvent);
        const active = nativeSession(owner.id),
          selected = selectedSource(owner.id);
        if (!active || active.role !== "host" || !selected)
          throw new Error("Aceite ainda não confirmado");
        const source = (
          await desktopCapturer.getSources({ types: ["screen", "window"] })
        ).find((s) => s.id === selected.sourceId);
        if (
          !source ||
          nativeSession(owner.id)?.callId !== active.callId ||
          selectedSource(owner.id)?.sourceId !== selected.sourceId
        )
          throw new Error("Fonte encerrada");
        callback({ video: source });
      } catch {
        callback(null);
      }
    },
  );
  ipcMain.handle(IPC_CHANNELS.DESKTOP_SOURCES, async (event) => {
    assertTrusted(event);
    if (!maySelectSource(event.sender.id))
      throw Error("Seleção de tela não autorizada");
    return getDesktopSources();
  });
  ipcMain.handle(
    IPC_CHANNELS.DESKTOP_STREAM_START,
    async (event, id: string) => {
      assertTrusted(event);
      if (!maySelectSource(event.sender.id))
        throw Error("Seleção de tela não autorizada");
      return selectDesktopSource(event.sender.id, id);
    },
  );
  ipcMain.handle(IPC_CHANNELS.DESKTOP_STREAM_STOP, (event) => {
    assertTrusted(event);
    prepareNativeSource(event.sender.id);
    return { success: true };
  });
}
