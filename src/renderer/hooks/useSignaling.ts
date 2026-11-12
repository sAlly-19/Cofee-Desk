import { useState, useRef, useCallback, useEffect } from "react";
import type { ServerStatus } from "../types/app";
import { useModal } from "../context/ModalContext";
export function useSignaling({
  onSignalingMessage,
}: { onSignalingMessage?: (msg: any) => void } = {}) {
  const { showToast, showConfirm } = useModal();
  const [serverStatus, setServerStatus] = useState<ServerStatus>("connecting"),
    [isRegistered, setIsRegistered] = useState(false),
    [myId, setMyId] = useState<string | null>(null),
    [serverError, setServerError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null),
    handler = useRef(onSignalingMessage),
    call = useRef<string | null>(null),
    peer = useRef<string | null>(null),
    endpoint = useRef("");
  useEffect(() => {
    handler.current = onSignalingMessage;
  }, [onSignalingMessage]);
  const sendWsMessage = useCallback((message: object) => {
    const data = message as Record<string, unknown>;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const sessionTypes = [
        "call-accepted",
        "call-rejected",
        "disconnect",
        "offer",
        "answer",
        "ice-candidate",
      ];
      wsRef.current.send(
        JSON.stringify({
          ...data,
          ...(sessionTypes.includes(String(data.type))
            ? { callId: call.current }
            : {}),
        }),
      );
    }
  }, []);
  useEffect(() => {
    let stopped = false,
      timer: ReturnType<typeof setTimeout> | undefined,
      heartbeat: ReturnType<typeof setInterval> | undefined,
      lastPong = Date.now(),
      attempt = 0,
      generation = 0,
      terminal = false;
    const closeSession = () => {
      void window.electronAPI.toggleInputControl(false).catch(() => {});
      call.current = null;
      peer.current = null;
      handler.current?.({
        type: "peer-disconnected",
        message: "Sinalização indisponível. Sessão encerrada por segurança.",
      });
    };
    async function connect() {
      if (stopped || terminal) return;
      const currentGeneration=++generation;
      try {
        const settings = await window.electronAPI.getSecuritySettings();
        if (stopped||currentGeneration!==generation) return;
        endpoint.current = settings.url;
        localStorage.setItem("coffee_desk_server_url", settings.url);
        window.dispatchEvent(
          new CustomEvent("signaling-scope", { detail: settings.url }),
        );
        setIsRegistered(false);
        setMyId(null);
        setServerStatus("connecting");
        setServerError(null);
        const publicKey = await window.electronAPI.getDevicePublicKey(
          settings.url,
        );
        if (stopped||currentGeneration!==generation) return;
        const ws = new WebSocket(settings.url);
        wsRef.current = ws;
        lastPong = Date.now();
        ws.onopen = () => {
          if (stopped||currentGeneration!==generation) {
            ws.close();
            return;
          }
          ws.send(JSON.stringify({ type: "hello", version: 2, publicKey }));
        };
        ws.onmessage = (event) => {
          void (async () => {
            if (stopped || wsRef.current !== ws) return;
            let msg: any;
            try {
              msg = JSON.parse(event.data);
            } catch {
              return;
            }
            if (msg.type === "challenge") {
              const signature = await window.electronAPI.signDeviceChallenge(
                settings.url,
                msg.nonce,
                msg.audience,
              );
              if (ws.readyState === WebSocket.OPEN)
                ws.send(JSON.stringify({ type: "authenticate", signature }));
              return;
            }
            if (msg.type === "registered") {
              if (msg.version !== 2 || !/^\d{3}-\d{3}-\d{3}$/.test(msg.id))
                return;
              setMyId(msg.id);
              setIsRegistered(true);
              setServerStatus("connected");
              setServerError(null);
              attempt = 0;
              lastPong = Date.now();
              localStorage.setItem("coffee_v2_id:" + settings.url, msg.id);
              window.electronAPI.setMyId(msg.id);
              heartbeat = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                  if (Date.now() - lastPong > 45000) {
                    ws.close();
                    return;
                  }
                  ws.send(JSON.stringify({ type: "ping" }));
                }
              }, 15000);
              return;
            }
            if (msg.type === "pong") {
              lastPong = Date.now();
              return;
            }
            if (msg.type === "access-revoked") {
              if(typeof msg.id==='string'&&/^\d{3}-\d{3}-\d{3}$/.test(msg.id))setMyId(msg.id);
              terminal = true;
              setServerError(msg.message ?? "Dispositivo suspenso");
              setIsRegistered(false);
              setServerStatus("disconnected");
              closeSession();
              return;
            }
            if (
              msg.type === "error" &&
              ["UPGRADE_REQUIRED", "AUTH"].includes(msg.code)
            ) {
              terminal = true;
              setServerError(msg.message);
              return;
            }
            if (msg.type === "call-ringing" || msg.type === "incoming-call") {
              call.current = msg.callId;
              peer.current = msg.fromId ?? msg.targetId;
            }
            if (
              [
                "offer",
                "answer",
                "ice-candidate",
                "call-accepted",
                "call-rejected",
                "peer-disconnected",
              ].includes(msg.type)
            ) {
              if (!msg.callId || msg.callId !== call.current) return;
              if (msg.fromId && msg.fromId !== peer.current) return;
            }
            if (msg.type === "offer")
              window.dispatchEvent(
                new CustomEvent("webrtc-offer", {
                  detail: { sdp: msg.payload?.sdp, fromId: msg.fromId },
                }),
              );
            if (msg.type === "answer")
              window.dispatchEvent(
                new CustomEvent("webrtc-answer", {
                  detail: { sdp: msg.payload?.sdp },
                }),
              );
            if (msg.type === "ice-candidate")
              window.dispatchEvent(
                new CustomEvent("webrtc-ice", { detail: msg.payload }),
              );
            if (msg.type === "report-received" || msg.type === "error")
              window.dispatchEvent(
                new CustomEvent("device-report-result", { detail: msg }),
              );
            handler.current?.(msg);
            if (
              msg.type === "call-rejected" ||
              msg.type === "peer-disconnected"
            ) {
              call.current = null;
              peer.current = null;
            }
          })().catch(() => {
            if(stopped||wsRef.current!==ws)return;
            setServerError(
              "Não foi possível autenticar a identidade do dispositivo",
            );
            terminal = true;
            ws.close();
          });
        };
        ws.onerror = () => {
          setServerError("Não foi possível conectar ao servidor configurado");
        };
        ws.onclose = (e) => {
          if (wsRef.current !== ws) return;
          if (heartbeat) clearInterval(heartbeat);
          wsRef.current = null;
          setIsRegistered(false);
          setServerStatus("disconnected");
          if (call.current) closeSession();
          if ([4403, 4406, 4401, 4001].includes(e.code)) terminal = true;
          if (!stopped && !terminal)
            timer = setTimeout(
              () => void connect(),
              Math.min(30000, 1000 * 2 ** Math.min(attempt++, 5)) +
                Math.random() * 500,
            );
        };
      } catch {
        if(stopped||currentGeneration!==generation)return;
        setServerError(
          "Identidade protegida ou configuração do servidor indisponível",
        );
        setServerStatus("disconnected");
      }
    }
    void connect();
    const change = () => {
      terminal = false;
      generation++;
      const old=wsRef.current;wsRef.current=null;old?.close();
      if (heartbeat) clearInterval(heartbeat);
      if (timer) clearTimeout(timer);
      if (call.current) closeSession();
      void connect();
    };
    window.addEventListener("server-changed", change);
    return () => {
      stopped = true;
      window.removeEventListener("server-changed", change);
      if (timer) clearTimeout(timer);
      if (heartbeat) clearInterval(heartbeat);
      const ws = wsRef.current;
      wsRef.current = null;
      ws?.close();
    };
  }, []);
  const handleResetIdentity = useCallback(
    async (onResetLocalData?: () => void) => {
      if (
        !(await showConfirm({
          title: "Redefinir preferências",
          message:
            "Isso limpa o histórico deste servidor e a senha de acesso. Sua identidade e eventuais sanções serão preservadas.",
          confirmText: "Redefinir preferências",
          cancelText: "Cancelar",
        }))
      )
        return;
      await window.electronAPI.resetSecurityPreferences();
      onResetLocalData?.();
      showToast({
        type: "info",
        message:
          "Preferências redefinidas. A identidade do dispositivo foi preservada.",
      });
    },
    [showToast, showConfirm],
  );
  const reportDevice = useCallback(
    (targetId: string, category: string, description: string) => {
      sendWsMessage({
        type: "report-device",
        targetId,
        category,
        description,
        ...(peer.current === targetId && call.current
          ? { callId: call.current }
          : {}),
      });
    },
    [sendWsMessage],
  );
  return {
    wsRef,
    serverStatus,
    isRegistered,
    myId,
    serverError,
    sendWsMessage,
    handleResetIdentity,
    reportDevice,
  };
}
