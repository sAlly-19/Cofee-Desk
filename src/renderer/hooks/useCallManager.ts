import { useState, useRef, useCallback, useEffect } from "react";
import type {
  View,
  SessionRole,
  ConnectionStatus,
  ServerStatus,
  IncomingCall,
} from "../types/app";
import { useModal } from "../context/ModalContext";

interface UseCallManagerProps {
  myId: string | null;
  serverStatus: ServerStatus;
  sendWsMessage: (msg: object) => void;
  onCallEstablished?: (targetId: string) => void;
}

export function useCallManager({
  myId,
  serverStatus,
  sendWsMessage,
  onCallEstablished,
}: UseCallManagerProps) {
  const { showAlert, showConfirm, showToast } = useModal();

  const [view, setView] = useState<View>("home");
  const [sessionRole, setSessionRole] = useState<SessionRole>("client");
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("idle");
  const [remoteId, setRemoteId] = useState<string>("");
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [countdown, setCountdown] = useState<number>(30);

  // Configurações de Acesso Não Supervisionado
  const [unattendedEnabled, setUnattendedEnabled] = useState<boolean>(() => {
    return localStorage.getItem("coffee_unattended_enabled") === "true";
  });
  const [unattendedPassword, setUnattendedPassword] = useState<string>(() => {
    return localStorage.getItem("coffee_unattended_password") || "";
  });

  const callTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Iniciar chamada para ID remoto
  const handleConnectWithId = useCallback(
    (targetId: string, customPassword?: string) => {
      const digits = targetId.replace(/\D/g, "");
      const cleanTargetId =
        digits.length === 9 ? digits.match(/.{3}/g)!.join("-") : "";
      if (!cleanTargetId) {
        setConnectionError("Informe os 9 dígitos do ID do computador remoto.");
        return;
      }

      if (cleanTargetId === myId) {
        showAlert({
          title: "ID Inválido",
          message: "Você não pode conectar ao seu próprio computador.",
          type: "warning",
        });
        setConnectionError("Você não pode conectar ao seu próprio ID.");
        setConnectionStatus("error");
        return;
      }

      if (serverStatus !== "connected") {
        showAlert({
          title: "Servidor Desconectado",
          message:
            "Você precisa estar conectado ao servidor de sinalização para iniciar uma chamada.",
          type: "error",
        });
        setConnectionError("Servidor de sinalização desconectado.");
        setConnectionStatus("error");
        return;
      }

      setConnectionError(null);
      setConnectionStatus("calling");
      setRemoteId(cleanTargetId);

      // Envia requisição de conexão ao Signaling Server
      sendWsMessage({
        type: "connect-request",
        targetId: cleanTargetId,
        fromId: myId,
        fromName: `Computador ${myId}`,
        password: customPassword,
        timestamp: new Date().toISOString(),
      });

      // Timeout de 30 segundos
      if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = setTimeout(() => {
        setConnectionStatus("error");
        setConnectionError(
          "Tempo esgotado. O computador remoto não respondeu.",
        );
        showAlert({
          title: "Tempo Esgotado",
          message:
            "O computador remoto não atendeu à solicitação de conexão a tempo.",
          type: "warning",
        });
      }, 30000);
    },
    [myId, serverStatus, showAlert, sendWsMessage, onCallEstablished],
  );

  const handleConnect = useCallback(() => {
    handleConnectWithId(remoteId);
  }, [remoteId, handleConnectWithId]);

  // Cancelar chamada em andamento
  const handleCancelCall = useCallback(() => {
    if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
    sendWsMessage({
      type: "disconnect",
      targetId: remoteId,
      fromId: myId,
      timestamp: new Date().toISOString(),
    });
    setConnectionStatus("idle");
    setConnectionError(null);
    showToast({
      type: "info",
      message: "Chamada cancelada.",
    });
  }, [remoteId, myId, sendWsMessage, showToast]);

  // Aceitar chamada recebida
  const acceptIncomingCall = useCallback(
    (callerId: string) => {
      setIncomingCall(null);
      setRemoteId(callerId);
      onCallEstablished?.(callerId);
      setSessionRole("host");
      setConnectionId(`conn-${Date.now()}`);
      setConnectionStatus("connected");
      setView("session");

      sendWsMessage({
        type: "call-accepted",
        targetId: callerId,
        fromId: myId,
        timestamp: new Date().toISOString(),
      });
    },
    [myId, sendWsMessage, onCallEstablished],
  );

  // Rejeitar chamada recebida
  const rejectIncomingCall = useCallback(
    (callerId: string, reason?: string) => {
      setIncomingCall(null);
      sendWsMessage({
        type: "call-rejected",
        targetId: callerId,
        fromId: myId,
        reason: reason || "Conexão rejeitada pelo usuário.",
        timestamp: new Date().toISOString(),
      });
      showToast({
        type: "info",
        message: "Chamada recebida rejeitada.",
      });
    },
    [myId, sendWsMessage, showToast],
  );

  // Desconectar da sessão
  const handleDisconnect = useCallback(
    (notifyPeer = true) => {
      if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
      if (notifyPeer)
        sendWsMessage({
          type: "disconnect",
          targetId: remoteId,
          fromId: myId,
          timestamp: new Date().toISOString(),
        });
      setConnectionStatus("idle");
      setIncomingCall(null);
      setConnectionError(null);
      setConnectionId(null);
      setView("home");
    },
    [remoteId, myId, sendWsMessage],
  );

  const requestDisconnect = useCallback(async () => {
    const confirmed = await showConfirm({
      title: "Encerrar Sessão Remota",
      message: `Tem certeza que deseja encerrar a conexão com o computador ${remoteId}?`,
      type: "warning",
      destructive: true,
      confirmText: "Encerrar Sessão",
      cancelText: "Continuar Conectado",
    });
    if (confirmed) {
      handleDisconnect();
      showToast({ type: "info", message: "Sessão remota encerrada." });
    }
  }, [remoteId, showConfirm, handleDisconnect, showToast]);

  // Processa mensagens de sinalização recebidas relevantes a chamadas
  const handleCallSignalingMessage = useCallback(
    (msg: any) => {
      const { type, fromId, message, reason } = msg;

      switch (type) {
        case "call-ringing": {
          console.log(
            "[Signaling] Chamada em andamento, aguardando resposta...",
          );
          setConnectionStatus("ringing");
          break;
        }

        case "incoming-call": {
          console.log(`[Signaling] Chamada recebida de: ${fromId}`);

          // Se acesso não supervisionado estiver ativo e senha conferir, auto-aceita
          if (
            unattendedEnabled &&
            unattendedPassword &&
            msg.password === unattendedPassword
          ) {
            console.log(
              "[Signaling] Acesso não supervisionado autorizado por senha!",
            );
            acceptIncomingCall(fromId);
            return;
          }

          setIncomingCall({
            fromId,
            fromName: msg.fromName || `Computador ${fromId}`,
            password: msg.password,
            expiresAt: Date.now() + 30000,
          });
          setCountdown(30);
          break;
        }

        case "call-accepted": {
          console.log(`[Signaling] Chamada aceita por: ${fromId}`);
          if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
          if (fromId) {
            setRemoteId(fromId);
            onCallEstablished?.(fromId);
          }
          setConnectionStatus("connected");
          setSessionRole("client");
          setConnectionId(`conn-${Date.now()}`);
          setView("session");
          showToast({
            type: "success",
            title: "Solicitação aceita",
            message: "Preparando a sessão remota…",
          });
          break;
        }

        case "call-rejected": {
          console.log(`[Signaling] Chamada rejeitada: ${reason}`);
          if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
          setConnectionStatus("error");
          const errText =
            reason ||
            "A solicitação de conexão foi recusada pelo computador remoto.";
          setConnectionError(errText);
          showAlert({
            title: "Conexão Recusada",
            message: errText,
            type: "warning",
            confirmText: "Entendido",
          });
          break;
        }

        case "peer-disconnected": {
          console.log("[Signaling] O par foi desconectado.");
          handleDisconnect(false);
          showAlert({
            title: "Sessão Finalizada",
            message: "A conexão remota foi encerrada pelo outro computador.",
            type: "info",
            confirmText: "OK",
          });
          break;
        }

        case "error": {
          console.warn("[Signaling] Erro recebido:", message);
          if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
          setConnectionStatus("error");
          const errText =
            message || "Erro de comunicação no servidor de sinalização.";
          setConnectionError(errText);
          showAlert({
            title: "Erro de Conexão",
            message: errText,
            type: "error",
            confirmText: "Fechar",
          });
          break;
        }
      }
    },
    [
      onCallEstablished,
      unattendedEnabled,
      unattendedPassword,
      acceptIncomingCall,
      handleDisconnect,
      showAlert,
      showToast,
    ],
  );

  // Timer do modal de chamada recebida (30 segundos)
  useEffect(() => {
    if (!incomingCall) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          rejectIncomingCall(incomingCall.fromId, "Tempo esgotado.");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [incomingCall, rejectIncomingCall]);

  const resetUnattendedSettings = useCallback(() => {
    localStorage.removeItem("coffee_unattended_enabled");
    localStorage.removeItem("coffee_unattended_password");
    setUnattendedEnabled(false);
    setUnattendedPassword("");
  }, []);

  return {
    view,
    setView,
    sessionRole,
    connectionStatus,
    remoteId,
    setRemoteId,
    connectionId,
    connectionError,
    incomingCall,
    countdown,
    unattendedEnabled,
    setUnattendedEnabled,
    unattendedPassword,
    setUnattendedPassword,
    handleConnectWithId,
    handleConnect,
    handleCancelCall,
    acceptIncomingCall,
    rejectIncomingCall,
    handleDisconnect,
    requestDisconnect,
    handleCallSignalingMessage,
    resetUnattendedSettings,
  };
}
