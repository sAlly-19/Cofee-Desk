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
  clipboardBatch?: string;
  clipboardCount?: number;
  fileId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  totalChunks: number;
  receivedChunks: Map<number, ArrayBuffer>;
  startTime: number;
  lastProgressTime: number;
  lastBytes: number;
  lastActivity: number;
  finishing?: boolean;
}

export function useFileTransfer(
  dataChannel: RTCDataChannel | null,
  allowed: boolean,
  clipboardAllowed = false,
) {
  const allowedRef = useRef(allowed);
  allowedRef.current = allowed;
  const { showToast, showAlert } = useModal();
  const [transfers, setTransfers] = useState<FileTransferItem[]>([]);
  const [isSending, setIsSending] = useState(false);

  // Fila de arquivos para envio
  const sendQueueRef = useRef<{ file: File; fileId: string }[]>([]);
  const isProcessingQueueRef = useRef<boolean>(false);
  const activeSendAbortRef = useRef<{ [fileId: string]: boolean }>({});

  const acknowledgments = useRef(
    new Map<string, { resolve: () => void; reject: (error: Error) => void }>(),
  );

  // Recebimentos limitados em memória; streaming para disco será tratado separadamente.
  const clipboardPolicy = useRef(clipboardAllowed);
  clipboardPolicy.current = clipboardAllowed;
  const clipboardResults = useRef<{ batch: string; path: string }[]>([]);
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
        for (const ack of acknowledgments.current.values())
          ack.reject(new Error("Permissão revogada"));
        acknowledgments.current.clear();
      };
    }
    sendQueueRef.current = [];
    for (const id of Object.keys(activeSendAbortRef.current))
      activeSendAbortRef.current[id] = true;
    incomingTransfersRef.current.clear();
    for (const ack of acknowledgments.current.values())
      ack.reject(new Error("Permissão revogada"));
    acknowledgments.current.clear();
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
      let currentFile: string | undefined;
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
        currentFile = typeof msg.fileId === "string" ? msg.fileId : undefined;

        switch (msg.type) {
          case "file-ack": {
            if (typeof msg.fileId !== "string") return;
            acknowledgments.current.get(msg.fileId)?.resolve();
            return;
          }
          case "file-error": {
            if (
              typeof msg.fileId !== "string" ||
              !Object.hasOwn(activeSendAbortRef.current, msg.fileId)
            )
              return;
            acknowledgments.current
              .get(msg.fileId)
              ?.reject(
                new Error("O destino não confirmou a gravação do arquivo."),
              );
            activeSendAbortRef.current[msg.fileId] = true;
            setTransfers((prev) =>
              prev.map((t) =>
                t.fileId === msg.fileId
                  ? {
                      ...t,
                      status: "error",
                      awaitingConfirmation: false,
                      error: "O destino não conseguiu gravar o arquivo.",
                      speedBytesPerSec: 0,
                    }
                  : t,
              ),
            );
            return;
          }
          case "file-meta": {
            const { fileId, fileName, fileSize, mimeType, totalChunks } = msg;
            if (
              typeof fileId !== "string" ||
              !fileId ||
              fileId.length > 100 ||
              typeof fileName !== "string" ||
              fileName.length > 200 ||
              !Number.isSafeInteger(fileSize) ||
              fileSize < 0 ||
              fileSize > 32 * 1024 * 1024 ||
              totalChunks !== Math.ceil(fileSize / CHUNK_SIZE) ||
              incomingTransfersRef.current.size >= 4 ||
              [...incomingTransfersRef.current.values()].reduce(
                (sum, t) => sum + t.fileSize,
                0,
              ) +
                fileSize >
                64 * 1024 * 1024 ||
              incomingTransfersRef.current.has(fileId)
            )
              return;

            incomingTransfersRef.current.set(fileId, {
              fileId,
              fileName,
              fileSize,
              mimeType: mimeType || "application/octet-stream",
              clipboardBatch:
                typeof msg.clipboardBatch === "string" &&
                /^[a-f0-9]{64}$/.test(msg.clipboardBatch)
                  ? msg.clipboardBatch
                  : undefined,
              clipboardCount:
                Number.isInteger(msg.clipboardCount) &&
                msg.clipboardCount >= 1 &&
                msg.clipboardCount <= 20
                  ? msg.clipboardCount
                  : undefined,
              totalChunks,
              receivedChunks: new Map(),
              startTime: Date.now(),
              lastActivity: Date.now(),
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
              ...prev.filter((t) => t.fileId !== fileId).slice(0, 199),
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
            if (!incoming || incoming.finishing) return;

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
            incoming.lastActivity = Date.now();

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
            if (!incoming || incoming.finishing) return;

            incoming.finishing = true;

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
            // Mantém identidade do recebimento até confirmar a gravação.

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
              if (
                !allowedRef.current ||
                incomingTransfersRef.current.get(fileId) !== incoming
              )
                return;
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
              throw new Error(
                "Gravação nativa indisponível; recebimento não confirmado",
              );
            }

            if (
              !allowedRef.current ||
              incomingTransfersRef.current.get(fileId) !== incoming
            )
              return;
            incomingTransfersRef.current.delete(fileId);
            if (dataChannel.readyState === "open")
              dataChannel.send(JSON.stringify({ type: "file-ack", fileId }));
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

            if (
              incoming.clipboardBatch &&
              incoming.clipboardCount &&
              savedFilePath &&
              clipboardPolicy.current &&
              allowedRef.current
            ) {
              clipboardResults.current = [
                ...clipboardResults.current,
                { batch: incoming.clipboardBatch, path: savedFilePath },
              ].slice(-20);
              const paths = clipboardResults.current
                .filter((e) => e.batch === incoming.clipboardBatch)
                .map((e) => e.path);
              if (paths.length === incoming.clipboardCount) {
                try {
                  await window.electronAPI.setReceivedFilesClipboard(paths);
                  if (allowedRef.current && clipboardPolicy.current)
                    showToast({
                      type: "success",
                      message:
                        "Arquivos prontos para colar no Explorador (Ctrl+V). Os originais foram preservados.",
                    });
                } catch {
                  showToast({
                    type: "warning",
                    message:
                      "Arquivos recebidos, mas não foi possível preparar o clipboard.",
                  });
                }
              }
            }
            showToast({
              type: "success",
              title: "Arquivo Recebido!",
              message: `"${incoming.fileName}" foi salvo com sucesso em Downloads.`,
            });
            break;
          }

          case "file-cancel": {
            const { fileId } = msg;
            if (
              !incomingTransfersRef.current.has(fileId) &&
              !Object.hasOwn(activeSendAbortRef.current, fileId)
            )
              return;
            incomingTransfersRef.current.delete(fileId);
            if (Object.hasOwn(activeSendAbortRef.current, fileId))
              activeSendAbortRef.current[fileId] = true;
            acknowledgments.current
              .get(fileId)
              ?.reject(new Error("Transferência cancelada pelo destino"));
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
      } catch {
        if (currentFile && incomingTransfersRef.current.has(currentFile)) {
          incomingTransfersRef.current.delete(currentFile);
          if (dataChannel.readyState === "open")
            dataChannel.send(
              JSON.stringify({ type: "file-error", fileId: currentFile }),
            );
          setTransfers((prev) =>
            prev.map((t) =>
              t.fileId === currentFile
                ? {
                    ...t,
                    status: "error",
                    error: "Não foi possível concluir o recebimento.",
                    speedBytesPerSec: 0,
                  }
                : t,
            ),
          );
          showToast({
            type: "error",
            message:
              "Não foi possível receber o arquivo. O remetente foi informado.",
          });
        }
      }
    };

    const expire = setInterval(() => {
      for (const [fileId, incoming] of incomingTransfersRef.current) {
        if (Date.now() - incoming.lastActivity < 60000) continue;
        incomingTransfersRef.current.delete(fileId);
        if (dataChannel.readyState === "open")
          dataChannel.send(JSON.stringify({ type: "file-cancel", fileId }));
        setTransfers((prev) =>
          prev.map((t) =>
            t.fileId === fileId
              ? {
                  ...t,
                  status: "error",
                  error: "Recebimento expirou sem atividade.",
                  speedBytesPerSec: 0,
                }
              : t,
          ),
        );
      }
    }, 5000);
    const closed = () => {
      incomingTransfersRef.current.clear();
      for (const ack of acknowledgments.current.values())
        ack.reject(new Error("Canal encerrado"));
      acknowledgments.current.clear();
    };
    dataChannel.addEventListener("close", closed);
    dataChannel.addEventListener("message", handleMessage);
    return () => {
      clearInterval(expire);
      closed();
      dataChannel.removeEventListener("close", closed);
      dataChannel.removeEventListener("message", handleMessage);
    };
  }, [dataChannel, showToast]);

  // Aguarda drenagem do buffer do WebRTC se estiver cheio (Flow Control)
  const waitForBufferDrain = (
    channel: RTCDataChannel,
    fileId: string,
  ): Promise<void> =>
    new Promise((resolve, reject) => {
      if (channel.readyState !== "open") {
        reject(new Error("Canal encerrado"));
        return;
      }
      if (channel.bufferedAmount <= HIGH_WATER_MARK) {
        resolve();
        return;
      }
      const cleanup = () => {
        clearTimeout(timer);
        clearInterval(cancellation);
        channel.removeEventListener("close", closed);
        channel.removeEventListener("bufferedamountlow", low);
      };
      const low = () => {
        if (channel.bufferedAmount > HIGH_WATER_MARK) return;
        cleanup();
        resolve();
      };
      const closed = () => {
        cleanup();
        reject(new Error("Canal encerrado"));
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("Canal sem capacidade para enviar"));
      }, 15000);
      const cancellation = setInterval(() => {
        if (!allowedRef.current || activeSendAbortRef.current[fileId]) {
          cleanup();
          reject(new Error("Transferência cancelada"));
        }
      }, 100);
      channel.addEventListener("close", closed, { once: true });
      channel.addEventListener("bufferedamountlow", low);
    });

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
        const { file, fileId } = sendQueueRef.current.shift()!;
        activeSendAbortRef.current[fileId] = false;

        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

        // Registra como sending na lista de transfers
        setTransfers((prev) =>
          prev.map((t) =>
            t.fileId === fileId && t.status === "pending"
              ? { ...t, fileId, status: "sending", progress: 0 }
              : t,
          ),
        );

        // Envia metadados iniciais
        dataChannel.send(
          JSON.stringify({
            type: "file-meta",
            acknowledgment: 1,
            clipboardBatch: (
              file as File & { coffeeClipboard?: { batchId: string } }
            ).coffeeClipboard?.batchId,
            clipboardCount: (
              file as File & { coffeeClipboard?: { count: number } }
            ).coffeeClipboard?.count,
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
          await waitForBufferDrain(dataChannel, fileId);

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
              99,
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
          const acknowledged = new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => {
              acknowledgments.current.delete(fileId);
              reject(
                new Error(
                  "O destino não confirmou a gravação. Verifique a conexão e a versão do outro aplicativo.",
                ),
              );
            }, 20000);
            acknowledgments.current.set(fileId, {
              resolve: () => {
                clearTimeout(timer);
                acknowledgments.current.delete(fileId);
                resolve();
              },
              reject: (error) => {
                clearTimeout(timer);
                acknowledgments.current.delete(fileId);
                reject(error);
              },
            });
          });
          void acknowledged.catch(() => {});
          dataChannel.send(JSON.stringify({ type: "file-done", fileId }));
          setTransfers((prev) =>
            prev.map((t) =>
              t.fileId === fileId
                ? { ...t, progress: 99, awaitingConfirmation: true }
                : t,
            ),
          );
          await acknowledged;
          if (!allowedRef.current || activeSendAbortRef.current[fileId]) break;
          setTransfers((prev) =>
            prev.map((t) =>
              t.fileId === fileId
                ? {
                    ...t,
                    status: "complete",
                    awaitingConfirmation: false,
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
    } catch (error) {
      const cancelled =
        error instanceof Error &&
        /cancelada|revogada|encerrado/i.test(error.message);
      setTransfers((prev) =>
        prev.map((t) =>
          t.status === "sending"
            ? {
                ...t,
                status: cancelled ? "cancelled" : "error",
                awaitingConfirmation: false,
                error: cancelled
                  ? undefined
                  : "O destino não confirmou a gravação.",
                speedBytesPerSec: 0,
              }
            : t,
        ),
      );
      if (!cancelled)
        showToast({
          type: "error",
          message:
            "O envio não foi confirmado pelo destino. Verifique a conexão e se os dois aplicativos estão atualizados.",
        });
    } finally {
      for (const ack of acknowledgments.current.values())
        ack.reject(new Error("Canal encerrado"));
      acknowledgments.current.clear();
      activeSendAbortRef.current = {};
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
        sendQueueRef.current.reduce(
          (bytes, item) => bytes + item.file.size,
          0,
        ) +
          fileArray.reduce((bytes, file) => bytes + file.size, 0) >
        64 * 1024 * 1024
      ) {
        showToast({
          type: "warning",
          message:
            "A fila pode ter até 64 MB. Aguarde as transferências em andamento.",
        });
        return;
      }
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

      const newItems: FileTransferItem[] = fileArray.map((f) => ({
        fileId: crypto.randomUUID(),
        fileName: f.name,
        fileSize: f.size,
        status: "pending",
        progress: 0,
        direction: "upload",
        transferredBytes: 0,
        speedBytesPerSec: 0,
      }));

      setTransfers((prev) => [...newItems, ...prev].slice(0, 200));
      sendQueueRef.current.push(
        ...fileArray.map((file, i) => ({ file, fileId: newItems[i].fileId })),
      );

      processQueue();
    },
    [dataChannel, processQueue, showAlert],
  );

  // Cancela uma transferência ativa ou pendente
  const cancelTransfer = useCallback(
    (fileId: string) => {
      incomingTransfersRef.current.delete(fileId);
      sendQueueRef.current = sendQueueRef.current.filter(
        (item) => item.fileId !== fileId,
      );
      if (Object.hasOwn(activeSendAbortRef.current, fileId))
        activeSendAbortRef.current[fileId] = true;
      acknowledgments.current
        .get(fileId)
        ?.reject(new Error("Transferência cancelada"));
      if (dataChannel?.readyState === "open")
        dataChannel.send(JSON.stringify({ type: "file-cancel", fileId }));
      setTransfers((prev) =>
        prev.map((t) =>
          t.fileId === fileId
            ? { ...t, status: "cancelled", speedBytesPerSec: 0 }
            : t,
        ),
      );
    },
    [dataChannel],
  );

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
