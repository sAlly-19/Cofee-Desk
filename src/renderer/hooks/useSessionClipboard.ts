import { useState, useEffect, useRef } from "react";
export function useSessionClipboard({
  isConnected,
  dataChannel,
  allowed,
}: {
  isConnected: boolean;
  dataChannel: RTCDataChannel | null;
  allowed: boolean;
}) {
  const [local, setLocal] = useState(""),
    [remote, setRemote] = useState(""),
    [automatic, setAutomatic] = useState(true),
    [error, setError] = useState("");
  const enabled = useRef(false),
    auto = useRef(true),
    last = useRef("");
  enabled.current = allowed && isConnected;
  auto.current = automatic;
  useEffect(() => {
    enabled.current = allowed && isConnected;
    if (!dataChannel || !allowed || !isConnected) return;
    const receive = (event: MessageEvent) => {
      if (
        !enabled.current ||
        typeof event.data !== "string" ||
        event.data.length > 70000
      )
        return;
      try {
        const m = JSON.parse(event.data);
        if (
          m.type !== "clipboard-text" ||
          typeof m.text !== "string" ||
          m.text.length > 65536
        )
          return;
        setRemote(m.text);
        last.current = m.text;
        if (auto.current)
          void window.electronAPI
            .applySessionClipboard(m.text)
            .catch(() => setError("Não foi possível aplicar o clipboard."));
      } catch {
        /* Ignore unrelated/malformed channel messages. */
      }
    };
    dataChannel.addEventListener("message", receive);
    const timer = setInterval(() => {
      if (
        !enabled.current ||
        !auto.current ||
        dataChannel.readyState !== "open"
      )
        return;
      void window.electronAPI
        .readSessionClipboard()
        .then((text) => {
          if (
            !enabled.current ||
            !auto.current ||
            text === last.current ||
            dataChannel.readyState !== "open"
          )
            return;
          last.current = text;
          setLocal(text);
          dataChannel.send(JSON.stringify({ type: "clipboard-text", text }));
        })
        .catch(() => {});
    }, 1500);
    return () => {
      enabled.current = false;
      clearInterval(timer);
      dataChannel.removeEventListener("message", receive);
    };
  }, [dataChannel, allowed, isConnected]);
  return {
    local,
    remote,
    automatic,
    error,
    allowed,
    setLocal,
    setAutomatic,
    canSend: allowed && isConnected && dataChannel?.readyState === "open",
    read: () =>
      window.electronAPI
        .readSessionClipboard()
        .then(setLocal)
        .catch(() => setError("Não foi possível ler o clipboard.")),
    send: () => {
      if (enabled.current && dataChannel?.readyState === "open")
        dataChannel.send(
          JSON.stringify({ type: "clipboard-text", text: local }),
        );
    },
    apply: () =>
      window.electronAPI
        .applySessionClipboard(remote)
        .catch(() => setError("Não foi possível aplicar o clipboard.")),
  };
}
