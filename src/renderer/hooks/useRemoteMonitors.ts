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
    [pending, setPending] = useState(false),
    [allowSwitch, setAllowSwitch] = useState(false);
  const switchRef = useRef(switchSource),
    allow = useRef(false);
  switchRef.current = switchSource;
  allow.current = allowSwitch;
  const { showConfirm, showToast } = useModal();
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
            monitors: sources
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
              message: "O anfitrião não autorizou a troca de monitor.",
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
            const sources = (
              (await window.electronAPI.getDesktopSources()) as DesktopSource[]
            ).filter((s) => s.id.startsWith("screen:"));
            const index = sources.findIndex((s) => s.id === m.id);
            if (index < 0) {
              send({ type: "monitor-result", accepted: false });
              return;
            }
            const accepted =
              allow.current ||
              (await showConfirm({
                title: "Trocar monitor compartilhado?",
                message:
                  "O computador remoto solicitou visualizar o Monitor " +
                  (index + 1) +
                  ".",
                confirmText: "Compartilhar monitor",
                cancelText: "Manter atual",
              }));
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
    channel.addEventListener("message", receive);
    channel.addEventListener("open", open);
    open();
    return () => {
      active = false;
      channel.removeEventListener("message", receive);
      channel.removeEventListener("open", open);
    };
  }, [channel, role, showConfirm, showToast]);
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
    allowSwitch,
    setAllowSwitch,
    request: (id: string) => {
      if (channel?.readyState === "open" && !pending) {
        setPending(true);
        channel.send(JSON.stringify({ type: "monitor-switch", id }));
      }
    },
  };
}
