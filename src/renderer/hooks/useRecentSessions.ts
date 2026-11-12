import { useState, useCallback, useEffect, useRef } from "react";
import type { RecentSession } from "../types/app";
import { useModal } from "../context/ModalContext";

const DEFAULT_RECENT_SESSIONS: RecentSession[] = [];

export function useRecentSessions() {
  const { showConfirm, showToast } = useModal();
  const scope = useRef(
    "coffee_v2_recents:" +
      (localStorage.getItem("coffee_desk_server_url") ||
        "ws://localhost:8080/ws"),
  );
  useEffect(() => {
    const change = (event: Event) => {
      const key = "coffee_v2_recents:" + (event as CustomEvent<string>).detail;
      if (key === scope.current) return;
      scope.current = key;
      try {
        const saved = JSON.parse(localStorage.getItem(key) || "[]");
        setRecentSessions(
          Array.isArray(saved)
            ? saved.filter(
                (s) =>
                  s &&
                  typeof s.id === "string" &&
                  typeof s.name === "string" &&
                  typeof s.remoteId === "string" &&
                  typeof s.dateStr === "string",
              )
            : [],
        );
      } catch {
        setRecentSessions([]);
      }
    };
    window.addEventListener("signaling-scope", change);
    return () => window.removeEventListener("signaling-scope", change);
  }, []);

  const [recentSessions, setRecentSessions] = useState<RecentSession[]>(() => {
    try {
      const saved = localStorage.getItem(scope.current);
      if (saved) {
        const entries: unknown = JSON.parse(saved);
        if (Array.isArray(entries))
          return entries.filter(
            (entry): entry is RecentSession =>
              !!entry &&
              typeof entry.id === "string" &&
              typeof entry.name === "string" &&
              typeof entry.remoteId === "string" &&
              typeof entry.dateStr === "string",
          );
      }
    } catch {}
    return DEFAULT_RECENT_SESSIONS;
  });

  const addRecentSession = useCallback((cleanTargetId: string) => {
    const now = new Date();
    const dateFormatted = `${now.toLocaleDateString("pt-BR")} • ${now.toLocaleTimeString("pt-BR")}`;
    const newEntry: RecentSession = {
      id: Date.now().toString(),
      name: `Computador ${cleanTargetId.substring(0, 3)}`,
      remoteId: cleanTargetId,
      dateStr: dateFormatted,
    };
    setRecentSessions((prev) => {
      const existing = prev.find((s) => s.remoteId === cleanTargetId);
      const updated = [
        { ...newEntry, name: existing?.name ?? newEntry.name },
        ...prev.filter((s) => s.remoteId !== cleanTargetId),
      ].slice(0, 10);
      try {
        localStorage.setItem(scope.current, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  const renameSession = useCallback(
    (id: string, newName: string) => {
      setRecentSessions((prev) => {
        const updated = prev.map((s) =>
          s.id === id ? { ...s, name: newName } : s,
        );
        try {
          localStorage.setItem(scope.current, JSON.stringify(updated));
        } catch {}
        return updated;
      });
      showToast({ type: "success", message: "Nome da máquina atualizado!" });
    },
    [showToast],
  );

  const deleteSession = useCallback(
    (id: string) => {
      setRecentSessions((prev) => {
        const updated = prev.filter((s) => s.id !== id);
        try {
          localStorage.setItem(scope.current, JSON.stringify(updated));
        } catch {}
        return updated;
      });
      showToast({ type: "info", message: "Sessão removida do histórico." });
    },
    [showToast],
  );

  const handleClearAllRecents = useCallback(async () => {
    const confirmed = await showConfirm({
      title: "Limpar Todo o Histórico",
      message:
        "Tem certeza que deseja apagar todas as sessões recentes salvas?",
      type: "warning",
      destructive: true,
      confirmText: "Limpar Tudo",
      cancelText: "Cancelar",
    });
    if (confirmed) {
      setRecentSessions([]);
      try {
        localStorage.setItem(scope.current, "[]");
      } catch {}
      showToast({ type: "info", message: "Histórico de sessões esvaziado." });
      return true;
    }
    return false;
  }, [showConfirm, showToast]);

  const resetRecentsToDefault = useCallback(() => {
    setRecentSessions(DEFAULT_RECENT_SESSIONS);
    try {
      localStorage.setItem(scope.current, "[]");
    } catch {}
  }, []);

  return {
    recentSessions,
    addRecentSession,
    renameSession,
    deleteSession,
    handleClearAllRecents,
    resetRecentsToDefault,
  };
}
