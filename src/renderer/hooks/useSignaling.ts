import { useState, useRef, useCallback, useEffect } from "react";
import type { ServerStatus } from "../types/app";
import { useModal } from "../context/ModalContext";

const getSignalingWsUrl = (): string => {
  if (
    typeof window !== "undefined" &&
    window.location &&
    window.location.hostname
  ) {
    return `ws://${window.location.hostname}:8080`;
  }
  return "ws://localhost:8080";
};

interface UseSignalingProps {
  onSignalingMessage?: (msg: any) => void;
}

export function useSignaling({ onSignalingMessage }: UseSignalingProps = {}) {
  const { showConfirm, showToast } = useModal();
  const [isRegistered, setIsRegistered] = useState(false);
  const [serverStatus, setServerStatus] = useState<ServerStatus>("connecting");
  const [myId, setMyId] = useState<string | null>(() =>
    localStorage.getItem("coffee_desk_my_id"),
  );

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const onMessageRef = useRef(onSignalingMessage);

  useEffect(() => {
    onMessageRef.current = onSignalingMessage;
  }, [onSignalingMessage]);

  const sendWsMessage = useCallback((msg: object) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const connectToSignaling = useCallback(() => {
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    setIsRegistered(false);
    setServerStatus("connecting");
    const ws = new WebSocket(getSignalingWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      if (wsRef.current !== ws) {
        try {
          ws.close();
        } catch {}
        return;
      }

      console.log("[Signaling] Conectado ao servidor.");
      setServerStatus("connected");
      const savedId = localStorage.getItem("coffee_desk_my_id") || undefined;
      ws.send(
        JSON.stringify({
          type: "register",
          id: savedId,
          timestamp: new Date().toISOString(),
        }),
      );

      // Keep-alive a cada 15s
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: "ping",
              timestamp: new Date().toISOString(),
            }),
          );
        }
      }, 15000);
    };

    ws.onmessage = (event) => {
      if (wsRef.current !== ws) return;
      try {
        const msg = JSON.parse(event.data);

        // Mensagens padrão de sinalização
        if (msg.type === "registered") {
          console.log(`[Signaling] Registrado com sucesso. Meu ID: ${msg.id}`);
          if (typeof msg.id !== "string" || !/^\d{3}-\d{3}-\d{3}$/.test(msg.id))
            return;
          setIsRegistered(true);
          setMyId(msg.id);
          localStorage.setItem("coffee_desk_my_id", msg.id);
          if (window.electronAPI?.setMyId) {
            window.electronAPI.setMyId(msg.id);
          }
        } else if (msg.type === "pong") {
          setServerStatus("connected");
        } else if (msg.type === "offer") {
          window.dispatchEvent(
            new CustomEvent("webrtc-offer", {
              detail: { sdp: msg.payload?.sdp, fromId: msg.fromId },
            }),
          );
        } else if (msg.type === "answer") {
          window.dispatchEvent(
            new CustomEvent("webrtc-answer", {
              detail: { sdp: msg.payload?.sdp },
            }),
          );
        } else if (msg.type === "ice-candidate") {
          window.dispatchEvent(
            new CustomEvent("webrtc-ice", {
              detail: msg.payload,
            }),
          );
        }

        // Repassa para o handler customizado (chamadas, erros, etc.)
        if (onMessageRef.current) {
          onMessageRef.current(msg);
        }
      } catch (err) {
        console.error("[Signaling] Erro ao parsear mensagem:", err);
      }
    };

    ws.onclose = (event) => {
      if (wsRef.current !== ws) return;
      wsRef.current = null;
      setIsRegistered(false);
      setServerStatus("disconnected");

      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }

      if (event.code === 4001) {
        console.warn("[Signaling] Conexão substituída por outra aba/janela.");
        return;
      }

      console.warn("[Signaling] Desconectado. Tentando reconectar em 3s...");
      if (reconnectTimeoutRef.current)
        clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(connectToSignaling, 3000);
    };

    ws.onerror = (err) => {
      console.error("[Signaling] Erro no WebSocket:", err);
    };
  }, []);

  useEffect(() => {
    connectToSignaling();
    return () => {
      if (reconnectTimeoutRef.current)
        clearTimeout(reconnectTimeoutRef.current);
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      if (wsRef.current) {
        const ws = wsRef.current;
        wsRef.current = null;
        try {
          ws.close();
        } catch {}
      }
    };
  }, [connectToSignaling]);

  // Redefinir identidade no servidor
  const handleResetIdentity = useCallback(
    async (onResetLocalData?: () => void) => {
      const confirmed = await showConfirm({
        title: "Redefinir Dados e Identidade",
        message:
          "Isso irá limpar seu ID atual, histórico de conexões recentes e senhas de acesso, solicitando um novo registro ao servidor. Deseja prosseguir?",
        type: "warning",
        destructive: true,
        confirmText: "Sim, Redefinir Tudo",
        cancelText: "Cancelar",
      });

      if (confirmed) {
        localStorage.removeItem("coffee_desk_my_id");
        setIsRegistered(false);
        setMyId(null);
        if (onResetLocalData) onResetLocalData();

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: "register",
              timestamp: new Date().toISOString(),
            }),
          );
        }
        showToast({
          type: "success",
          title: "Dados Redefinidos",
          message: "Nova identidade solicitada ao servidor.",
        });
      }
    },
    [showConfirm, showToast],
  );

  return {
    wsRef,
    isRegistered,
    serverStatus,
    myId,
    sendWsMessage,
    handleResetIdentity,
  };
}
