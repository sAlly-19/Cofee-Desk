import { useState, useEffect, useRef } from "react";
export function ClipboardSync({
  isConnected,
  dataChannel,
  allowed,
}: {
  connectionId: string;
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
      clearInterval(timer);
      dataChannel.removeEventListener("message", receive);
    };
  }, [dataChannel, allowed, isConnected]);
  if (!allowed) return <p>O anfitrião desativou o clipboard nesta sessão.</p>;
  return (
    <section className="clipboard-panel">
      <h3>Clipboard compartilhado</h3>
      <label>
        <input
          type="checkbox"
          checked={automatic}
          onChange={(e) => setAutomatic(e.target.checked)}
        />{" "}
        Sincronizar automaticamente
      </label>
      {error && <p role="alert">{error}</p>}
      <label>
        Meu clipboard
        <textarea
          aria-label="Meu clipboard"
          value={local}
          maxLength={65536}
          onChange={(e) => setLocal(e.target.value)}
        />
      </label>
      <button
        className="secondary-button"
        onClick={() =>
          void window.electronAPI
            .readSessionClipboard()
            .then(setLocal)
            .catch(() => setError("Não foi possível ler o clipboard."))
        }
      >
        Ler do sistema
      </button>
      <button
        className="primary-button"
        disabled={dataChannel?.readyState !== "open"}
        onClick={() => {
          if (enabled.current && dataChannel?.readyState === "open")
            dataChannel.send(
              JSON.stringify({ type: "clipboard-text", text: local }),
            );
        }}
      >
        Enviar ao remoto
      </button>
      <label>
        Clipboard remoto
        <textarea aria-label="Clipboard remoto" readOnly value={remote} />
      </label>
      <button
        className="secondary-button"
        onClick={() =>
          void window.electronAPI
            .applySessionClipboard(remote)
            .catch(() => setError("Não foi possível aplicar o clipboard."))
        }
      >
        Aplicar no meu computador
      </button>
    </section>
  );
}
