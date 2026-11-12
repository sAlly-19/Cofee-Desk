import { useState, useRef, useCallback, useEffect } from "react";
import type { FileTransferItem } from "@shared/types";
import { useModal } from "../context/ModalContext";

const CHUNK_SIZE = 32 * 1024; // 32 KB por chunk
const HIGH_WATER_MARK = 256 * 1024; // 256 KB buffer max para flow-control

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i += 8192) {
    const chunk = bytes.subarray(i, Math.min(i + 8192, len));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
}

export function formatSpeed(bytesPerSec?: number): string {
  if (!bytesPerSec || bytesPerSec <= 0) return "0 KB/s";
  if (bytesPerSec >= 1024 * 1024) {
    return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
  }
  return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
}

interface IncomingTransfer {
  fileId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  totalChunks: number;
  receivedChunks: Map<number, ArrayBuffer>;
  startTime: number;
  lastProgressTime: number;
  lastBytes: number;
}

export function useFileTransfer(
  dataChannel: RTCDataChannel | null,
  allowed: boolean,
) {
  const allowedRef = useRef(allowed);
  allowedRef.current = allowed;
  const { showToast, showAlert } = useModal();
  const [transfers, setTransfers] = useState<FileTransferItem[]>([]);
  const [isSending, setIsSending] = useState(false);

  // Fila de arquivos para envio
  const sendQueueRef = useRef<File[]>([]);
  const isProcessingQueueRef = useRef<boolean>(false);
  const activeSendAbortRef = useRef<{ [fileId: string]: boolean }>({});

  // Armazenamento de arquivos recebidos em streaming
  const incomingTransfersRef = useRef<Map<string, IncomingTransfer>>(new Map());

  useEffect(() => {
    if (allowed) {
      allowedRef.current = true;
      return () => {
        allowedRef.current = false;
        sendQueueRef.current = [];
        for (const id of Object.keys(activeSendAbortRef.current))
          activeSendAbortRef.current[id] = true;
        incomingTransfersRef.current.clear();
      };
    }
    sendQueueRef.current = [];
    for (const id of Object.keys(activeSendAbortRef.current))
      activeSendAbortRef.current[id] = true;
    incomingTransfersRef.current.clear();
    setTransfers((prev) =>
      prev.map((t) =>
        ["pending", "sending", "receiving"].includes(t.status)
          ? { ...t, status: "cancelled", speedBytesPerSec: 0 }
          : t,
      ),
    );
    setIsSending(false);
    return undefined;
  }, [allowed]);
  // Configura channel de buffer
  useEffect(() => {
    if (!dataChannel) return;
    try {
      dataChannel.bufferedAmountLowThreshold = 64 * 1024;
    } catch {}
  }, [dataChannel]);

  // Listener de mensagens recebidas pelo DataChannel de arquivos
  useEffect(() => {
    if (!dataChannel) return;

    const handleMessage = async (event: MessageEvent) => {
      try {
        if (
          !allowedRef.current ||
          typeof event.data !== "string" ||
          event.data.length > 70000
        )
          return;
        const msg =
          typeof event.data === "string" ? JSON.parse(event.data) : null;
        if (!msg || !msg.type) return;

        switch (msg.type) {
          case "file-meta": {
            const { fileId, fileName, fileSize, mimeType, totalChunks } = msg;
            if (
              typeof fileId !== "string" ||
              fileId.length > 100 ||
              typeof fileName !== "string" ||
              fileName.length > 200 ||
              !Number.isSafeInteger(fileSize) ||
              fileSize < 0 ||
              fileSize > 32 * 1024 * 1024 ||
              totalChunks !== Math.ceil(fileSize / CHUNK_SIZE) ||
              incomingTransfersRef.current.size >= 4 ||
              incomingTransfersRef.current.has(fileId)
            )
              return;

            incomingTransfersRef.current.set(fileId, {
              fileId,
              fileName,
              fileSize,
              mimeType: mimeType || "application/octet-stream",
              totalChunks,
              receivedChunks: new Map(),
              startTime: Date.now(),
              lastProgressTime: Date.now(),
              lastBytes: 0,
            });

            setTransfers((prev) => [
              {
                fileId,
                fileName,
                fileSize,
                status: "receiving",
                progress: 0,
                direction: "download",
                transferredBytes: 0,
                speedBytesPerSec: 0,
              },
              ...prev.filter((t) => t.fileId !== fileId).slice(0,199),
            ]);

            showToast({
              type: "info",
              title: "Recebendo Arquivo",
              message: `Iniciando download de "${fileName}" (${formatFileSize(fileSize)})`,
            });
            break;
          }

          case "file-chunk": {
            const { fileId, chunkIndex, data } = msg;
            const incoming = incomingTransfersRef.current.get(fileId);
            if (!incoming) return;

            if (
              !Number.isSafeInteger(chunkIndex) ||
              chunkIndex < 0 ||
              chunkIndex >= incoming.totalChunks ||
              typeof data !== "string" ||
              data.length > 45000 ||
              incoming.receivedChunks.has(chunkIndex)
            )
              return;
            const chunkBuffer = base64ToArrayBuffer(data);
            if (chunkBuffer.byteLength > CHUNK_SIZE) return;
            incoming.receivedChunks.set(chunkIndex, chunkBuffer);

            const receivedCount = incoming.receivedChunks.size;
            const percent = Math.min(
              99,
              Math.round((receivedCount / incoming.totalChunks) * 100),
            );

            // Cálculo de velocidade a cada 250ms
            const now = Date.now();
            const elapsedSinceLast = (now - incoming.lastProgressTime) / 1000;
            const currentBytes = receivedCount * CHUNK_SIZE;

            let speed = 0;
            if (elapsedSinceLast >= 0.25) {
              const bytesDiff = currentBytes - incoming.lastBytes;
              speed = Math.round(bytesDiff / elapsedSinceLast);
              incoming.lastProgressTime = now;
              incoming.lastBytes = currentBytes;

              setTransfers((prev) =>
                prev.map((t) =>
                  t.fileId === fileId
                    ? {
                        ...t,
                        progress: percent,
                        transferredBytes: Math.min(t.fileSize, currentBytes),
                        speedBytesPerSec: speed,
                      }
                    : t,
                ),
              );
            }
            break;
          }

          case "file-done": {
            const { fileId } = msg;
            const incoming = incomingTransfersRef.current.get(fileId);
            if (!incoming) return;

            console.log(
              `[FileTransfer] Download concluído para: ${incoming.fileName}`,
            );

            // Reúne todos os chunks em ordem
            const sortedBuffers: ArrayBuffer[] = [];
            for (let i = 0; i < incoming.totalChunks; i++) {
              const chunk = incoming.receivedChunks.get(i);
              if (chunk) sortedBuffers.push(chunk);
            }

            const completeBytes = sortedBuffers.reduce(
              (n, b) => n + b.byteLength,
              0,
            );
            if (
              sortedBuffers.length !== incoming.totalChunks ||
              completeBytes !== incoming.fileSize ||
              !allowedRef.current
            )
              throw new Error("Arquivo incompleto");
            incomingTransfersRef.current.delete(fileId);

            // Salva o arquivo no sistema
            let savedFilePath: string | undefined;

            if (window.electronAPI?.saveFileToDownloads) {
              // Combina buffers e converte em base64
              const totalBytes = sortedBuffers.reduce(
                (acc, b) => acc + b.byteLength,
                0,
              );
              const combined = new Uint8Array(totalBytes);
              let offset = 0;
              for (const b of sortedBuffers) {
                combined.set(new Uint8Array(b), offset);
                offset += b.byteLength;
              }

              const base64Data = arrayBufferToBase64(combined.buffer);
              const result = await window.electronAPI.saveFileToDownloads(
                incoming.fileName,
                base64Data,
              );
              if (!result.success)
                throw new Error("Gravação não autorizada ou falhou");
              if (result.success && result.filePath) {
                savedFilePath = result.filePath;
              }
            } else {
              // Fallback para Web Browser: dispara download via Blob
              const blob = new Blob(sortedBuffers, { type: incoming.mimeType });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = incoming.fileName;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              setTimeout(() => URL.revokeObjectURL(url), 10000);
            }

            setTransfers((prev) =>
              prev.map((t) =>
                t.fileId === fileId
                  ? {
                      ...t,
                      status: "complete",
                      progress: 100,
                      speedBytesPerSec: 0,
                      transferredBytes: t.fileSize,
                      savedPath: savedFilePath,
                    }
                  : t,
              ),
            );

            showToast({
              type: "success",
              title: "Arquivo Recebido!",
              message: `"${incoming.fileName}" foi salvo com sucesso em Downloads.`,
            });
            break;
          }

          case "file-cancel": {
            const { fileId } = msg;
            incomingTransfersRef.current.delete(fileId);
            setTransfers((prev) =>
              prev.map((t) =>
                t.fileId === fileId
                  ? { ...t, status: "cancelled", speedBytesPerSec: 0 }
                  : t,
              ),
            );
            showToast({
              type: "warning",
              title: "Transferência Cancelada",
              message: "A transferência foi cancelada pelo outro computador.",
            });
            break;
          }
        }
      } catch (err) {
        console.error(
          "[FileTransfer] Erro ao processar mensagem do canal:",
          err,
        );
      }
    };

    dataChannel.addEventListener("message", handleMessage);
    return () => {
      dataChannel.removeEventListener("message", handleMessage);
    };
  }, [dataChannel, showToast]);

  // Aguarda drenagem do buffer do WebRTC se estiver cheio (Flow Control)
  const waitForBufferDrain = (channel: RTCDataChannel): Promise<void> => {
    return new Promise((resolve) => {
      if (channel.bufferedAmount <= HIGH_WATER_MARK) {
        resolve();
        return;
      }
      const onLow = () => {
        clearTimeout(timer);
        channel.removeEventListener("close", onLow);
        channel.removeEventListener("bufferedamountlow", onLow);
        resolve();
      };
      const timer = setTimeout(onLow, 2000);
      channel.addEventListener("close", onLow, { once: true });
      channel.addEventListener("bufferedamountlow", onLow);
    });
  };

  // Processa a fila de arquivos sequencialmente
  const processQueue = useCallback(async () => {
    if (
      !allowedRef.current ||
      isProcessingQueueRef.current ||
      sendQueueRef.current.length === 0 ||
      !dataChannel
    ) {
      return;
    }

    if (dataChannel.readyState !== "open") {
      console.warn("[FileTransfer] Canal de arquivos ainda não está aberto.");
      return;
    }

    isProcessingQueueRef.current = true;
    setIsSending(true);

    try {
      while (
        allowedRef.current &&
        dataChannel.readyState === "open" &&
        sendQueueRef.current.length > 0
      ) {
        const file = sendQueueRef.current.shift()!;
        const fileId = `f-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        activeSendAbortRef.current[fileId] = false;

        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

        // Registra como sending na lista de transfers
        setTransfers((prev) =>
          prev.map((t) =>
            t.fileName === file.name && t.status === "pending"
              ? { ...t, fileId, status: "sending", progress: 0 }
              : t,
          ),
        );

        // Envia metadados iniciais
        dataChannel.send(
          JSON.stringify({
            type: "file-meta",
            fileId,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type || "application/octet-stream",
            totalChunks,
          }),
        );

        let chunkIndex = 0;
        let offset = 0;
        let lastProgressUpdate = Date.now();
        let lastBytesSent = 0;

        while (offset < file.size) {
          // Se cancelado pelo usuário
          if (activeSendAbortRef.current[fileId]) {
            dataChannel.send(JSON.stringify({ type: "file-cancel", fileId }));
            setTransfers((prev) =>
              prev.map((t) =>
                t.fileId === fileId ? { ...t, status: "cancelled" } : t,
              ),
            );
            break;
          }

          // Aguarda esvaziamento do buffer se ultrapassou HIGH_WATER_MARK
          await waitForBufferDrain(dataChannel);

          const slice = file.slice(offset, offset + CHUNK_SIZE);
          const arrayBuffer = await slice.arrayBuffer();
          if (
            !allowedRef.current ||
            activeSendAbortRef.current[fileId] ||
            dataChannel.readyState !== "open"
          ) {
            activeSendAbortRef.current[fileId] = true;
            break;
          }
          const base64Data = arrayBufferToBase64(arrayBuffer);

          dataChannel.send(
            JSON.stringify({
              type: "file-chunk",
              fileId,
              chunkIndex,
              data: base64Data,
            }),
          );

          chunkIndex++;
          offset += slice.size;

          // Atualiza progresso e velocidade a cada 200ms
          const now = Date.now();
          const elapsed = (now - lastProgressUpdate) / 1000;
          if (elapsed >= 0.2 || offset >= file.size) {
            const bytesDiff = offset - lastBytesSent;
            const speed = elapsed > 0 ? Math.round(bytesDiff / elapsed) : 0;
            lastProgressUpdate = now;
            lastBytesSent = offset;

            const progress = Math.min(
              100,
              Math.round((offset / file.size) * 100),
            );
            setTransfers((prev) =>
              prev.map((t) =>
                t.fileId === fileId
                  ? {
                      ...t,
                      progress,
                      transferredBytes: offset,
                      speedBytesPerSec: speed,
                    }
                  : t,
              ),
            );
          }
        }

        // Se não foi abortado, finaliza
        if (
          allowedRef.current &&
          dataChannel.readyState === "open" &&
          !activeSendAbortRef.current[fileId]
        ) {
          dataChannel.send(JSON.stringify({ type: "file-done", fileId }));
          setTransfers((prev) =>
            prev.map((t) =>
              t.fileId === fileId
                ? {
                    ...t,
                    status: "complete",
                    progress: 100,
                    speedBytesPerSec: 0,
                    transferredBytes: file.size,
                  }
                : t,
            ),
          );
          showToast({
            type: "success",
            title: "Envio Concluído!",
            message: `"${file.name}" foi transferido com sucesso!`,
          });
        }

        delete activeSendAbortRef.current[fileId];
      }
    } catch {
      setTransfers((prev) =>
        prev.map((t) =>
          t.status === "sending" ? { ...t, status: "cancelled" } : t,
        ),
      );
    } finally {
      isProcessingQueueRef.current = false;
      setIsSending(false);
    }
  }, [dataChannel, showToast]);

  // Envia múltiplos arquivos adicionando à fila
  const sendFiles = useCallback(
    (files: FileList | File[]) => {
      if (
        !allowedRef.current ||
        !dataChannel ||
        dataChannel.readyState !== "open"
      ) {
        showAlert({
          type: "warning",
          title: "Canal Não Disponível",
          message:
            "Aguarde a conexão P2P ser totalmente estabelecida antes de enviar arquivos.",
          confirmText: "OK",
        });
        return;
      }

      const fileArray = Array.from(files);
      if (
        fileArray.length + sendQueueRef.current.length > 20 ||
        fileArray.some((f) => f.size > 32 * 1024 * 1024)
      ) {
        showToast({
          type: "error",
          message: "Envie até 20 arquivos, com no máximo 32 MB cada.",
        });
        return;
      }
      if (fileArray.length === 0) return;

      const newItems: FileTransferItem[] = fileArray.map((f, i) => ({
        fileId: `queue-${Date.now()}-${i}`,
        fileName: f.name,
        fileSize: f.size,
        status: "pending",
        progress: 0,
        direction: "upload",
        transferredBytes: 0,
        speedBytesPerSec: 0,
      }));

      setTransfers((prev) => [...newItems, ...prev].slice(0,200));
      sendQueueRef.current.push(...fileArray);

      processQueue();
    },
    [dataChannel, processQueue, showAlert],
  );

  // Cancela uma transferência ativa ou pendente
  const cancelTransfer = useCallback((fileId: string) => {
    activeSendAbortRef.current[fileId] = true;
    setTransfers((prev) =>
      prev.map((t) =>
        t.fileId === fileId
          ? { ...t, status: "cancelled", speedBytesPerSec: 0 }
          : t,
      ),
    );
  }, []);

  // Remove da lista do histórico
  const removeTransfer = useCallback((fileId: string) => {
    setTransfers((prev) => prev.filter((t) => t.fileId !== fileId));
  }, []);

  // Limpa transferências concluídas
  const clearCompleted = useCallback(() => {
    setTransfers((prev) =>
      prev.filter(
        (t) =>
          t.status === "sending" ||
          t.status === "receiving" ||
          t.status === "pending",
      ),
    );
  }, []);

  // Transferência ativa no momento (para exibir pill flutuante na toolbar)
  const activeTransfer = transfers.find(
    (t) => t.status === "sending" || t.status === "receiving",
  );

  return {
    transfers,
    isSending,
    activeTransfer,
    sendFiles,
    cancelTransfer,
    removeTransfer,
    clearCompleted,
  };
}
