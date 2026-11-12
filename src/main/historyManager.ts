import { app, ipcMain } from "electron";
import type { WebContents } from "electron";
import Store from "electron-store";
import type { SessionHistoryEntry } from "../shared/session";
import { assertTrusted } from "./ipcSecurity";
const MAX_HISTORY = 1000;
const stores = new Map<
  string,
  Store<{ servers: Record<string, SessionHistoryEntry[]> }>
>();
export function historyStore(cwd: string) {
  let store = stores.get(cwd);
  if (!store) {
    store = new Store({
      name: "session-history",
      cwd,
      defaults: { servers: {} },
    });
    const saved = store.get("servers");
    for (const key of Object.keys(saved))
      saved[key] = saved[key].map((e) =>
        ["active", "calling"].includes(e.result)
          ? {
              ...e,
              result: e.result === "active" ? "completed" : "failed",
              reason: "APP_INTERRUPTED",
              endedAt: undefined,
            }
          : e,
      );
    store.set("servers", saved);
    stores.set(cwd, store);
  }
  return store;
}
const scope = (value: string) => {
  if (typeof value !== "string" || value.length > 2048)
    throw Error("Escopo inválido");
  const url = new URL(value);
  if (
    !["ws:", "wss:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error("Escopo inválido");
  return url.href;
};
export function validateHistoryEntry(e: SessionHistoryEntry) {
  if (
    !e ||
    typeof e.id !== "string" ||
    e.id.length > 100 ||
    !/^\d{3}-\d{3}-\d{3}$/.test(e.remoteId) ||
    typeof e.name !== "string" ||
    e.name.length > 100 ||
    !["incoming", "outgoing"].includes(e.direction) ||
    ![
      "calling",
      "active",
      "completed",
      "rejected",
      "cancelled",
      "failed",
      "legacy",
    ].includes(e.result)
  )
    throw new Error("Registro inválido");
  for (const key of ["startedAt", "acceptedAt", "endedAt"] as const)
    if (
      e[key] != null &&
      (typeof e[key] !== "string" ||
        !Number.isFinite(Date.parse(e[key]!)) ||
        e[key]!.length > 40)
    )
      throw new Error("Horário inválido");
  if (e.reason && !/^[A-Z_]{1,50}$/.test(e.reason))
    throw new Error("Motivo inválido");
  return {
    id: e.id,
    remoteId: e.remoteId,
    name: e.name,
    direction: e.direction,
    result: e.result,
    startedAt: e.startedAt,
    acceptedAt: e.acceptedAt,
    endedAt: e.endedAt,
    reason: e.reason,
    callId: typeof e.callId === "string" ? e.callId.slice(0, 36) : undefined,
  };
}
export function registerHistoryHandlers(
  profileForSender: (sender: WebContents) => string = () =>
    app.getPath("userData"),
) {
  ipcMain.handle("history:list", (event, url: string) => {
    assertTrusted(event);
    return (
      historyStore(profileForSender(event.sender)).get("servers")[scope(url)] ||
      []
    );
  });
  ipcMain.handle(
    "history:write",
    (event, url: string, input: SessionHistoryEntry) => {
      assertTrusted(event);
      const store = historyStore(profileForSender(event.sender)),
        key = scope(url),
        entry = validateHistoryEntry(input),
        all = store.get("servers");
      const current = all[key] || [];
      all[key] = [entry, ...current.filter((e) => e.id !== entry.id)].slice(
        0,
        MAX_HISTORY,
      );
      store.set("servers", all);
      return entry;
    },
  );
  ipcMain.handle("history:clear", (event, url: string) => {
    assertTrusted(event);
    const store = historyStore(profileForSender(event.sender)),
      all = store.get("servers");
    all[scope(url)] = [];
    store.set("servers", all);
    return true;
  });
}
