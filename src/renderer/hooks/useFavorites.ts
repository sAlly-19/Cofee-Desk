import { useCallback, useEffect, useRef, useState } from "react";
import type { RecentSession } from "../types/app";
import { useModal } from "../context/ModalContext";
const keyFor = (server: string) => "coffee_v2_favorites:" + server;
function load(key: string): RecentSession[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(key) || "[]");
    if (!Array.isArray(saved)) return [];
    const ids = new Set<string>();
    return saved.filter((s): s is RecentSession => {
      if (
        !s ||
        typeof s.remoteId !== "string" ||
        !/^\d{3}-\d{3}-\d{3}$/.test(s.remoteId) ||
        typeof s.name !== "string" ||
        typeof s.id !== "string" ||
        typeof s.dateStr !== "string" ||
        ids.has(s.remoteId)
      )
        return false;
      ids.add(s.remoteId);
      return true;
    });
  } catch {
    return [];
  }
}
export function useFavorites() {
  const { showToast } = useModal();
  const scope = useRef(
    keyFor(
      localStorage.getItem("coffee_desk_server_url") ||
        "ws://localhost:8080/ws",
    ),
  );
  const [favorites, setFavorites] = useState<RecentSession[]>(() =>
    load(scope.current),
  );
  useEffect(() => {
    const change = (event: Event) => {
      const key = keyFor((event as CustomEvent<string>).detail);
      if (key !== scope.current) {
        scope.current = key;
        setFavorites(load(key));
      }
    };
    window.addEventListener("signaling-scope", change);
    return () => window.removeEventListener("signaling-scope", change);
  }, []);
  const save = useCallback(
    (next: RecentSession[]) => {
      try {
        localStorage.setItem(scope.current, JSON.stringify(next));
        setFavorites(next);
      } catch {
        showToast({
          type: "error",
          message: "Não foi possível salvar os favoritos.",
        });
      }
    },
    [showToast],
  );
  const toggleFavorite = useCallback(
    (session: RecentSession) => {
      save(
        favorites.some((s) => s.remoteId === session.remoteId)
          ? favorites.filter((s) => s.remoteId !== session.remoteId)
          : [...favorites, { ...session, id: "favorite:" + session.remoteId }],
      );
    },
    [favorites, save],
  );
  const renameFavorite = useCallback(
    (remoteId: string, name: string) => {
      if (favorites.some((s) => s.remoteId === remoteId))
        save(
          favorites.map((s) => (s.remoteId === remoteId ? { ...s, name } : s)),
        );
    },
    [favorites, save],
  );
  return { favorites, toggleFavorite, renameFavorite };
}
