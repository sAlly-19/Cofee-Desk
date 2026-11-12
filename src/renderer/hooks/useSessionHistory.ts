import { useState, useEffect, useRef, useCallback } from "react";
import type { SessionHistoryEntry } from "../../shared/session";
export function useSessionHistory() {
  const [entries, setEntries] = useState<SessionHistoryEntry[]>([]),
    [error, setError] = useState("");
  const scope = useRef(
      localStorage.getItem("coffee_desk_server_url") ||
        "ws://localhost:8080/ws",
    ),
    generation = useRef(0);
  const refresh = useCallback(async () => {
    const url = scope.current,
      epoch = ++generation.current;
    try {
      let list = await window.electronAPI.historyList(url);
      const marker = "coffee_history_migrated:" + url;
      if (!localStorage.getItem(marker)) {
        if (list.length === 0)
          for (const s of (() => {
            try {
              const records = JSON.parse(
                localStorage.getItem("coffee_v2_recents:" + url) || "[]",
              );
              return Array.isArray(records)
                ? records.filter(
                    (r) =>
                      r &&
                      typeof r.remoteId === "string" &&
                      typeof r.name === "string",
                  )
                : [];
            } catch {
              return [];
            }
          })())
            await window.electronAPI.historyWrite(url, {
              id: "legacy:" + s.remoteId,
              remoteId: s.remoteId,
              name: s.name,
              direction: "outgoing",
              result: "legacy",
              startedAt: null,
            });
        localStorage.setItem(marker, "1");
        list = await window.electronAPI.historyList(url);
      }
      if (epoch === generation.current) {
        setEntries(list);
        setError("");
      }
    } catch {
      if (epoch === generation.current)
        setError("Não foi possível carregar o histórico.");
    }
  }, []);
  useEffect(() => {
    const change = (event: Event) => {
      scope.current = (event as CustomEvent<string>).detail;
      void refresh();
    };
    const updated = () => void refresh();
    void refresh();
    window.addEventListener("signaling-scope", change);
    window.addEventListener("history-changed", updated);
    return () => {
      generation.current++;
      window.removeEventListener("signaling-scope", change);
      window.removeEventListener("history-changed", updated);
    };
  }, [refresh]);
  const clear = useCallback(async () => {
    await window.electronAPI.historyClear(scope.current);
    localStorage.setItem("coffee_history_migrated:" + scope.current, "1");
    setEntries([]);
  }, []);
  return { entries, error, clear, refresh };
}
