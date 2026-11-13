import type { DesktopSource } from "../../shared/types";
import { useEffect, useRef, useState } from "react";
import { useModal } from "../context/ModalContext";
interface Monitor {
  id: string;
  name: string;
  selected: boolean;
}
export function useRemoteMonitors(
  channel: RTCDataChannel | null,
  role: "host" | "client",
  switchSource: (id: string) => Promise<void>,
) {
  const [monitors, setMonitors] = useState<Monitor[]>([]),
    [pending, setPending] = useState(false);
  const switchRef = useRef(switchSource);
  switchRef.current = switchSource;
  const { showToast } = useModal();
  useEffect(() => {
    if (!channel) return;
    let active = true,
      busy = false;
    let listing = false,
      lastList = 0;
    const send = (m: object) => {
      if (active && channel.readyState === "open")
        channel.send(JSON.stringify(m));
    };
    const list = async (force = false) => {
      if (listing || (!force && Date.now() - lastList < 1000)) return;
      listing = true;
      lastList = Date.now();
      try {
        const sources: DesktopSource[] =
            await window.electronAPI.getDesktopSources(),
          selected = await window.electronAPI.getCaptureSelection();
        if (active)
          send({
            type: "monitor-list",
            monitors: (selected?.kind === "screen" ? sources : [])
              .filter((s) => s.id.startsWith("screen:"))
              .slice(0, 16)
              .map((s, i) => ({
                id: s.id,
                name:
                  "Monitor " + (i + 1) + (s.isPrimary ? " (principal)" : ""),
                selected: s.id === selected?.sourceId,
              })),
          });
      } finally {
        listing = false;
      }
    };
    const receive = (event: MessageEvent) => {
      if (typeof event.data !== "string" || event.data.length > 8192) return;
      void (async () => {
        const m = JSON.parse(event.data);
        if (role === "host" && m.type === "monitor-list-request") {
          await list();
          return;
        }
        if (
          role === "client" &&
          m.type === "monitor-list" &&
          Array.isArray(m.monitors) &&
          m.monitors.length <= 16
        ) {
          setMonitors(
            m.monitors.filter(
              (s: Monitor) =>
                typeof s.id === "string" &&
                s.id.startsWith("screen:") &&
                s.id.length <= 150 &&
                typeof s.name === "string" &&
                s.name.length <= 80 &&
                typeof s.selected === "boolean",
            ),
          );
          setPending(false);
          return;
        }
        if (role === "client" && m.type === "monitor-result") {
          setPending(false);
          if (m.accepted !== true)
            showToast({
              type: "info",
              message: "Não foi possível acessar o monitor solicitado.",
            });
          return;
        }
        if (
          role === "host" &&
          m.type === "monitor-switch" &&
          !busy &&
          typeof m.id === "string" &&
          m.id.startsWith("screen:") &&
          m.id.length <= 150
        ) {
          busy = true;
          try {
            if (
              (await window.electronAPI.getCaptureSelection())?.kind !==
              "screen"
            ) {
              send({ type: "monitor-result", accepted: false });
              return;
            }
            const sources = (
              (await window.electronAPI.getDesktopSources()) as DesktopSource[]
            ).filter((s) => s.id.startsWith("screen:"));
            const index = sources.findIndex((s) => s.id === m.id);
            if (index < 0) {
              send({ type: "monitor-result", accepted: false });
              return;
            }
            const accepted = true;
            if (!active) return;
            if (accepted) {
              await switchRef.current(m.id);
              await list(true);
            }
            send({ type: "monitor-result", accepted });
          } finally {
            busy = false;
          }
        }
      })().catch(() => {
        setPending(false);
        showToast({
          type: "error",
          message: "Não foi possível trocar o monitor.",
        });
      });
    };
    const open = () => {
      if (role === "client") send({ type: "monitor-list-request" });
      else void list().catch(() => {});
    };
    const sourceChanged = () => {
      if (role === "host") void list(true).catch(() => {});
    };
    window.addEventListener("capture-source-changed", sourceChanged);
    channel.addEventListener("message", receive);
    channel.addEventListener("open", open);
    open();
    return () => {
      active = false;
      window.removeEventListener("capture-source-changed", sourceChanged);
      channel.removeEventListener("message", receive);
      channel.removeEventListener("open", open);
    };
  }, [channel, role, showToast]);
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => {
      setPending(false);
      showToast({
        type: "warning",
        message: "A troca de monitor não foi confirmada. Tente novamente.",
      });
    }, 20000);
    return () => clearTimeout(timer);
  }, [pending, showToast]);
  return {
    monitors,
    pending,
    request: (id: string) => {
      if (channel?.readyState === "open" && !pending) {
        setPending(true);
        channel.send(JSON.stringify({ type: "monitor-switch", id }));
      }
    },
  };
}
