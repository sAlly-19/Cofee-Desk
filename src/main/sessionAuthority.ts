import { ipcMain, clipboard, type WebContents } from "electron";
import type { SessionPermissions } from "../shared/session";
import { validPermissions } from "../shared/session";
import { assertTrusted } from "./ipcSecurity";
export interface NativeSession {
  callId: string;
  role: "host" | "client";
  permissions: SessionPermissions;
  captureActive?: boolean;
  sourceKind?: "screen" | "window";
  sourceId?: string;
  isPrimary?: boolean;
  bounds?: { x: number; y: number; width: number; height: number };
}
const sessions = new Map<number, NativeSession>();
const transportBusy = new Set<number>();
const pendingHosts = new Map<number, string>();
export function setPendingHost(sender: number, callId?: string) {
  if (callId) pendingHosts.set(sender, callId);
  else pendingHosts.delete(sender);
}
export const captureCallId = (sender: number) =>
  nativeSession(sender)?.callId ?? pendingHosts.get(sender);
export const maySelectSource = (sender: number) =>
  pendingHosts.has(sender) || nativeSession(sender)?.role === "host";
export function setTransportBusy(sender: number, busy: boolean) {
  if (busy) transportBusy.add(sender);
  else transportBusy.delete(sender);
}
let installing = false;
export const isInstalling = () => installing;
export const setInstalling = (value: boolean) => {
  installing = value;
};
type NativeSource = Pick<
  NativeSession,
  "sourceId" | "sourceKind" | "bounds" | "captureActive" | "isPrimary"
>;
const sources = new Map<number, NativeSource>();
export const selectedSource = (sender: number) => sources.get(sender);
export function prepareNativeSource(sender: number, source?: NativeSource) {
  if (source) source = { ...source, captureActive: false };
  if (source) sources.set(sender, source);
  else sources.delete(sender);
  const current = sessions.get(sender);
  if (current)
    setNativeSession(sender, {
      ...current,
      sourceId: source?.sourceId,
      sourceKind: source?.sourceKind,
      bounds: source?.bounds,
      captureActive: source?.captureActive,
    });
}
const listeners = new Set<(sender: number, state?: NativeSession) => void>();
export const nativeSession = (sender: number) => sessions.get(sender);
export const hasPermission = (
  sender: number,
  permission: keyof SessionPermissions,
) => {
  const s = sessions.get(sender);
  return (
    !!s &&
    s.permissions[permission] &&
    (permission !== "control" ||
      (s.role === "host" &&
        s.sourceKind === "screen" &&
        !!s.bounds &&
        s.captureActive === true))
  );
};
export function onNativeSessionChange(
  listener: (sender: number, state?: NativeSession) => void,
) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function setNativeSession(sender: number, state?: NativeSession) {
  if (state) {
    const source = state.role === "host" ? sources.get(sender) : undefined;
    state = { ...state, ...source };
    sessions.set(sender, state);
  } else {
    sessions.delete(sender);
    sources.delete(sender);
  }
  for (const listener of listeners) listener(sender, state);
}
export const isNativeBusy = () => sessions.size > 0 || transportBusy.size > 0;
const trackedOwners = new Set<number>();
function trackOwner(sender: WebContents) {
  if (trackedOwners.has(sender.id)) return;
  trackedOwners.add(sender.id);
  const revoke = () => {
    transportBusy.delete(sender.id);
    pendingHosts.delete(sender.id);
    setNativeSession(sender.id);
  };
  sender.once("destroyed", () => {
    trackedOwners.delete(sender.id);
    revoke();
  });
  sender.on("render-process-gone", revoke);
  sender.on("unresponsive", revoke);
}
export function registerSessionAuthority() {
  ipcMain.handle("capture:ready", (event) => {
    assertTrusted(event);
    const current = nativeSession(event.sender.id),
      source = selectedSource(event.sender.id);
    if (current?.role !== "host" || !source)
      throw Error("Captura não autorizada");
    sources.set(event.sender.id, { ...source, captureActive: true });
    setNativeSession(event.sender.id, current);
    return true;
  });
  ipcMain.handle("session:pending", (event, value: unknown) => {
    assertTrusted(event);
    if (typeof value !== "boolean" || installing)
      throw new Error("Instalação em andamento");
    return true;
  });
  ipcMain.handle("session:clipboard-read", async (event) => {
    assertTrusted(event);
    if (!hasPermission(event.sender.id, "clipboard"))
      throw new Error("Clipboard não autorizado");
    if (await clipboard.has("text/uri-list")) return null;
    const text = await clipboard.readText();
    if (!hasPermission(event.sender.id, "clipboard"))
      throw new Error("Clipboard revogado");
    return text.slice(0, 65536);
  });
  ipcMain.handle("session:clipboard-write", async (event, value: unknown) => {
    assertTrusted(event);
    if (
      !hasPermission(event.sender.id, "clipboard") ||
      typeof value !== "string" ||
      value.length > 65536
    )
      throw new Error("Clipboard não autorizado");
    await clipboard.writeText(value);
    return true;
  });
  ipcMain.handle("session:confirmed", (event, input: unknown) => {
    assertTrusted(event);
    if (input !== null && installing)
      throw new Error("Instalação em andamento");
    if (input === null) {
      setNativeSession(event.sender.id);
      return true;
    }
    const s = input as NativeSession;
    if (
      !s ||
      !/^[0-9a-f-]{36}$/i.test(s.callId) ||
      !["host", "client"].includes(s.role) ||
      !validPermissions(s.permissions)
    )
      throw new Error("Sessão inválida");
    const previous = sessions.get(event.sender.id);
    if (
      !previous ||
      previous.callId !== s.callId ||
      previous.role !== s.role ||
      (Object.keys(s.permissions) as (keyof SessionPermissions)[]).some(
        (key) => s.permissions[key] && !previous.permissions[key],
      )
    )
      throw new Error("Confirmação não autorizada pelo serviço");
    setNativeSession(event.sender.id, {
      ...previous,
      permissions: { ...s.permissions },
    });
    trackOwner(event.sender);
    return true;
  });
}
