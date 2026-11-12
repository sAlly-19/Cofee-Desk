import { useState, useRef, useCallback, useEffect } from "react";
import type {
  View,
  SessionRole,
  ConnectionStatus,
  ServerStatus,
  IncomingCall,
} from "../types/app";
import {
  FULL_PERMISSIONS,
  VIEW_ONLY,
  validPermissions,
  type SessionPermissions,
  type SessionHistoryEntry,
  type ConnectionDiagnostic,
} from "../../shared/session";
import { useModal } from "../context/ModalContext";
interface Props {
  myId: string | null;
  serverStatus: ServerStatus;
  sendWsMessage: (msg: object) => void;
  onCallEstablished?: (id: string) => void;
}
export function useCallManager({
  myId,
  serverStatus,
  sendWsMessage,
  onCallEstablished,
}: Props) {
  const { showConfirm, showToast } = useModal();
  const [view, setView] = useState<View>("home"),
    [sessionRole, setSessionRole] = useState<SessionRole>("client");
  const [connectionStatus, setConnectionStatus] =
      useState<ConnectionStatus>("idle"),
    [remoteId, setRemoteId] = useState("");
  const [connectionId, setConnectionId] = useState<string | null>(null),
    [connectionError, setConnectionError] = useState<string | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null),
    [countdown, setCountdown] = useState(30),
    [answering, setAnswering] = useState(false);
  const [permissions, setPermissions] = useState<SessionPermissions>({
      ...VIEW_ONLY,
    }),
    [sourceKind, setSourceKind] = useState<"screen" | "window">("screen");
  const [diagnostic, setDiagnostic] = useState<ConnectionDiagnostic>({
    stage: "call",
    code: "IDLE",
    state: "waiting",
  });
  const [unattendedEnabled, setUnattendedEnabled] = useState(false),
    [unattendedPassword, setUnattendedPassword] = useState("");
  const [unattendedPermissions, setUnattendedPermissions] =
    useState<SessionPermissions>({ ...VIEW_ONLY });
  const current = useRef<{
    callId?: string;
    remoteId: string;
    role: SessionRole;
    entry: SessionHistoryEntry;
  } | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persist = useCallback(
    (entry: SessionHistoryEntry) => {
      const scope = localStorage.getItem("coffee_desk_server_url");
      if (!scope) return;
      void window.electronAPI
        .historyWrite(scope, entry)
        .then(() => window.dispatchEvent(new Event("history-changed")))
        .catch(() =>
          showToast({
            type: "error",
            message: "Não foi possível salvar o histórico.",
          }),
        );
    },
    [showToast],
  );
  const begin = useCallback(
    (id: string, role: SessionRole) => {
      const entry: SessionHistoryEntry = {
        id: crypto.randomUUID(),
        remoteId: id,
        name: "Computador " + id.slice(0, 3),
        direction: role === "host" ? "incoming" : "outgoing",
        result: "calling",
        startedAt: new Date().toISOString(),
      };
      current.current = { remoteId: id, role, entry };
      void window.electronAPI.setSessionPending(true).catch(() => {});
      persist(entry);
      return current.current;
    },
    [persist],
  );
  const finish = useCallback(
    (
      result: "completed" | "failed" | "rejected" | "cancelled",
      reason: string,
    ) => {
      if (current.current) {
        const c = current.current;
        persist({
          ...c.entry,
          callId: c.callId,
          result,
          reason,
          endedAt: new Date().toISOString(),
        });
        current.current = null;
      }
      if (timeout.current) clearTimeout(timeout.current);
      void window.electronAPI.setSessionPending(false).catch(() => {});
      void window.electronAPI.confirmSession(null).catch(() => {});
      void window.electronAPI.toggleInputControl(false).catch(() => {});
      setIncomingCall(null);
      setAnswering(false);
      setConnectionId(null);
      setPermissions({ ...VIEW_ONLY });
      setView("home");
    },
    [persist],
  );
  useEffect(() => {
    void (async () => {
      const legacy = localStorage.getItem("coffee_unattended_password");
      if (legacy)
        await window.electronAPI.migrateAccessPassword(
          legacy,
          localStorage.getItem("coffee_unattended_enabled") === "true",
        );
      const s = await window.electronAPI.getSecuritySettings();
      setUnattendedEnabled(s.enabled);
      setUnattendedPermissions(s.unattendedPermissions);
      localStorage.removeItem("coffee_unattended_password");
      localStorage.removeItem("coffee_unattended_enabled");
    })().catch(() =>
      setConnectionError(
        "Não foi possível carregar as preferências de acesso.",
      ),
    );
  }, []);
  const handleConnectWithId = useCallback(
    (id: string, password?: string) => {
      const digits = id.replace(/\D/g, "");
      const target =
        digits.length === 9 ? digits.match(/.{3}/g)!.join("-") : "";
      if (!target || target === myId) {
        setConnectionError(
          !target
            ? "Informe os 9 dígitos do ID do computador remoto."
            : "Você não pode conectar ao seu próprio ID.",
        );
        return;
      }
      if (serverStatus !== "connected") {
        setConnectionError("Conecte ao serviço antes de iniciar uma chamada.");
        return;
      }
      if (current.current) return;
      begin(target, "client");
      setRemoteId(target);
      setConnectionError(null);
      setConnectionStatus("calling");
      setDiagnostic({ stage: "call", code: "REQUESTING", state: "waiting" });
      sendWsMessage({
        type: "connect-request",
        targetId: target,
        fromName: "Computador remoto",
        ...(password ? { password } : {}),
      });
      timeout.current = setTimeout(() => {
        sendWsMessage({ type: "disconnect", targetId: target });
        finish("failed", "EXPIRED");
        setConnectionStatus("error");
        setConnectionError(
          "Tempo esgotado. O computador remoto não respondeu.",
        );
      }, 35000);
    },
    [myId, serverStatus, begin, finish, sendWsMessage],
  );
  const handleCancelCall = useCallback(() => {
    sendWsMessage({ type: "disconnect", targetId: current.current?.remoteId });
    finish("cancelled", "CANCELLED");
    setConnectionStatus("idle");
    setConnectionError(null);
  }, [finish, sendWsMessage]);
  const acceptIncomingCall = useCallback(
    async (
      id: string,
      chosen: SessionPermissions = FULL_PERMISSIONS,
      sourceId?: string,
    ) => {
      if (answering || current.current?.role !== "host") return;
      setAnswering(true);
      setConnectionError(null);
      try {
        const sources = await window.electronAPI.getDesktopSources();
        const selected = sourceId
          ? sources.find((s: any) => s.id === sourceId)
          : sources.find(
              (s: any) => s.id.startsWith("screen:") && s.isPrimary,
            ) || sources.find((s: any) => s.id.startsWith("screen:"));
        if (!selected)
          throw Error("Escolha uma tela ou janela para compartilhar.");
        const capture = await window.electronAPI.startDesktopStream(
          selected.id,
        );
        if (!current.current || current.current.remoteId !== id) return;
        setSourceKind(capture.kind);
        sendWsMessage({
          type: "call-accepted",
          targetId: id,
          permissions: {
            ...chosen,
            control: capture.kind === "screen" && chosen.control,
          },
          sourceKind: capture.kind,
        });
        setDiagnostic({ stage: "call", code: "CONFIRMING", state: "waiting" });
      } catch {
        setAnswering(false);
        setConnectionError(
          "Não foi possível preparar a captura. Escolha uma fonte disponível e tente novamente.",
        );
      }
    },
    [answering, sendWsMessage],
  );
  const rejectIncomingCall = useCallback(
    (id: string, reason?: string) => {
      sendWsMessage({ type: "call-rejected", targetId: id });
      finish("rejected", reason === "Tempo esgotado." ? "EXPIRED" : "REJECTED");
      setConnectionStatus("idle");
    },
    [finish, sendWsMessage],
  );
  const handleDisconnect = useCallback(
    (notify = true) => {
      if (notify)
        sendWsMessage({
          type: "disconnect",
          targetId: current.current?.remoteId,
        });
      finish("completed", "ENDED");
      setConnectionStatus("idle");
      setConnectionError(null);
    },
    [finish, sendWsMessage],
  );
  const requestDisconnect = useCallback(async () => {
    if (
      await showConfirm({
        title: "Encerrar Sessão Remota",
        message: "Deseja encerrar esta conexão?",
        type: "warning",
        destructive: true,
        confirmText: "Encerrar Sessão",
        cancelText: "Continuar Conectado",
      })
    )
      handleDisconnect();
  }, [showConfirm, handleDisconnect]);
  const updatePermissions = useCallback(
    async (next: SessionPermissions, kind = sourceKind) => {
      if (sessionRole !== "host" || !current.current?.callId) return;
      // Revoke locally immediately; granting still waits for server confirmation.
      const restricted = {
        control: permissions.control && next.control && kind === "screen",
        clipboard: permissions.clipboard && next.clipboard,
        files: permissions.files && next.files,
      };
      await window.electronAPI.confirmSession({
        callId: current.current.callId,
        role: "host",
        permissions: restricted,
      });
      setPermissions(restricted);
      setSourceKind(kind);
      sendWsMessage({
        type: "permissions-update",
        targetId: current.current.remoteId,
        permissions: next,
        sourceKind: kind,
      });
    },
    [sessionRole, permissions, sourceKind, sendWsMessage],
  );
  const handleCallSignalingMessage = useCallback(
    async (msg: any) => {
      if (msg.type === "call-ringing" && current.current) {
        current.current.callId = msg.callId;
        setConnectionStatus("ringing");
        setDiagnostic({
          stage: "call",
          code: "AWAITING_CONSENT",
          state: "waiting",
        });
        return;
      }
      if (msg.type === "incoming-call") {
        if (current.current) return;
        const c = begin(msg.fromId, "host");
        c.callId = msg.callId;
        setRemoteId(msg.fromId);
        setIncomingCall({
          fromId: msg.fromId,
          fromName: msg.fromName || "Computador remoto",
          expiresAt: Date.now() + 30000,
        });
        setCountdown(30);
        if (
          typeof msg.password === "string" &&
          (await window.electronAPI.verifyAccessPassword(msg.password))
        ) {
          const settings = await window.electronAPI.getSecuritySettings();
          await acceptIncomingCall(msg.fromId, settings.unattendedPermissions);
        }
        return;
      }
      if (msg.type === "call-accepted") {
        const c = current.current;
        if (
          !c ||
          c.callId !== msg.callId ||
          c.role !== msg.role ||
          !validPermissions(msg.permissions)
        )
          return;
        if (timeout.current) clearTimeout(timeout.current);
        await window.electronAPI.confirmSession({
          callId: c.callId!,
          role: c.role,
          permissions: msg.permissions,
        });
        if (current.current !== c) return;
        setPermissions(msg.permissions);
        setSourceKind(msg.sourceKind);
        setSessionRole(c.role);
        setRemoteId(c.remoteId);
        setConnectionId(c.callId!);
        setIncomingCall(null);
        setAnswering(false);
        c.entry = {
          ...c.entry,
          callId: c.callId,
          result: "active",
          acceptedAt: new Date().toISOString(),
        };
        persist(c.entry);
        onCallEstablished?.(c.remoteId);
        setView("session");
        setConnectionStatus("connected");
        setDiagnostic({
          stage: "capture",
          code: "PREPARING_MEDIA",
          state: "waiting",
        });
        if (c.role === "host")
          await window.electronAPI.toggleInputControl(msg.permissions.control);
        return;
      }
      if (
        msg.type === "permissions-updated" &&
        current.current &&
        current.current.callId === msg.callId &&
        validPermissions(msg.permissions)
      ) {
        const active = current.current;
        await window.electronAPI.confirmSession({
          callId: msg.callId,
          role: active.role,
          permissions: msg.permissions,
        });
        setPermissions(msg.permissions);
        setSourceKind(msg.sourceKind);
        if (active.role === "host")
          await window.electronAPI.toggleInputControl(msg.permissions.control);
        return;
      }
      if (msg.type === "call-rejected") {
        finish("rejected", "REJECTED");
        setConnectionError(
          "A solicitação foi recusada pelo computador remoto.",
        );
        setConnectionStatus("error");
        return;
      }
      if (msg.type === "peer-disconnected") {
        const wasActive = current.current?.entry.result === "active";
        finish(
          wasActive ? "completed" : "failed",
          msg.code === "SANCTIONED"
            ? "SANCTIONED"
            : msg.code === "EXPIRED"
              ? "EXPIRED"
              : "DISCONNECTED",
        );
        setConnectionStatus("idle");
        if (!wasActive)
          setConnectionError(
            msg.code === "EXPIRED"
              ? "O computador remoto não respondeu a tempo."
              : "A conexão foi encerrada.",
          );
        return;
      }
      if (msg.type === "error" && current.current) {
        const code = /^[A-Z_]{1,50}$/.test(msg.code)
          ? msg.code
          : "SERVER_ERROR";
        finish("failed", code);
        setConnectionStatus("error");
        setDiagnostic({ stage: "call", code, state: "failed" });
        setConnectionError(
          msg.message || "Não foi possível iniciar a conexão.",
        );
      }
    },
    [begin, acceptIncomingCall, persist, onCallEstablished, finish],
  );
  useEffect(() => {
    if (!incomingCall) return;
    const timer = setInterval(() => {
      const seconds = Math.max(
        0,
        Math.ceil((incomingCall.expiresAt - Date.now()) / 1000),
      );
      setCountdown(seconds);
      if (seconds === 0)
        rejectIncomingCall(incomingCall.fromId, "Tempo esgotado.");
    }, 500);
    return () => clearInterval(timer);
  }, [incomingCall, rejectIncomingCall]);
  useEffect(
    () => () => {
      if (timeout.current) clearTimeout(timeout.current);
      void window.electronAPI.confirmSession(null).catch(() => {});
    },
    [],
  );
  const resetUnattendedSettings = useCallback(() => {
    void window.electronAPI.resetSecurityPreferences();
    setUnattendedEnabled(false);
    setUnattendedPassword("");
    setUnattendedPermissions({ ...VIEW_ONLY });
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
    answering,
    permissions,
    sourceKind,
    diagnostic,
    updatePermissions,
    unattendedEnabled,
    setUnattendedEnabled,
    unattendedPassword,
    setUnattendedPassword,
    unattendedPermissions,
    setUnattendedPermissions,
    handleConnectWithId,
    handleConnect: () => handleConnectWithId(remoteId),
    handleCancelCall,
    acceptIncomingCall,
    rejectIncomingCall,
    handleDisconnect,
    requestDisconnect,
    handleCallSignalingMessage,
    resetUnattendedSettings,
  };
}
