import { useEffect, useRef } from "react";
import { useModal } from "../context/ModalContext";
export function useClipboardFiles(
  channel: RTCDataChannel | null,
  allowed: boolean,
  sendFiles: (files: File[]) => void,
) {
  const last = useRef(""),
    send = useRef(sendFiles);
  send.current = sendFiles;
  const { showToast } = useModal();
  useEffect(() => {
    let active = allowed;
    let busy = false,
      error = "";
    if (!allowed || !channel) return;
    const run = async () => {
      if (busy || !active || channel.readyState !== "open") return;
      busy = true;
      try {
        const snapshot = await window.electronAPI.readClipboardFiles();
        if (!active) return;
        if (!snapshot) {
          last.current = "";
          return;
        }
        if (snapshot.revision === last.current) return;
        last.current = snapshot.revision;
        const pending: File[] = [];
        for (const item of snapshot.files) {
          const bytes = new Uint8Array(item.size);
          let offset = 0;
          while (offset < item.size) {
            if (!active) return;
            const data = atob(
              await window.electronAPI.readClipboardFileChunk(
                item.token,
                offset,
              ),
            );
            if (!data.length) throw Error("Arquivo alterado; copie novamente");
            for (let i = 0; i < data.length; i++)
              bytes[offset + i] = data.charCodeAt(i);
            offset += data.length;
          }
          if (!active) return;
          const file = new File([bytes], item.name);
          Object.assign(file, {
            coffeeClipboard: {
              batchId: snapshot.revision,
              count: snapshot.files.length,
            },
          });
          pending.push(file);
        }
        if (active) {
          send.current(pending);
          showToast({
            type: "info",
            message:
              "Enviando arquivos copiados. Aguarde a conclusão antes de colar no outro computador.",
          });
        }
        error = "";
      } catch (e) {
        const message =
          e instanceof Error
            ? e.message
            : "Não foi possível sincronizar arquivos copiados.";
        if (active && message !== error) {
          error = message;
          showToast({ type: "warning", message });
        }
      } finally {
        busy = false;
      }
    };
    const timer = setInterval(() => void run(), 1500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [allowed, channel, showToast]);
}
