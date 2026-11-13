import {
  validRemoteKeyboard,
  validRemoteMouse,
} from "../../shared/remoteInput";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { SessionPermissions, DiagnosticStats } from "../../shared/session";
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];
interface Props {
  remoteId: string;
  isConnected: boolean;
  role: "host" | "client";
  permissions: SessionPermissions;
  onRemoteInput?: (input: any) => void;
  onSendSignalingMessage?: (
    type: "offer" | "answer" | "ice-candidate",
    payload: unknown,
  ) => void;
  onFilesChannelReady?: (channel: RTCDataChannel) => void;
  localVideoRef: RefObject<HTMLVideoElement | null>;
  remoteVideoRef: RefObject<HTMLVideoElement | null>;
}
export function useWebRTCPeer({
  isConnected,
  role,
  permissions,
  onRemoteInput,
  onSendSignalingMessage,
  onFilesChannelReady,
  localVideoRef,
  remoteVideoRef,
}: Props) {
  const [isSharing, setIsSharing] = useState(false),
    [isReceiving, setIsReceiving] = useState(false),
    [error, setError] = useState<string | null>(null),
    [peerState, setPeerState] = useState("connecting"),
    [stats, setStats] = useState<DiagnosticStats>({});
  const pcRef = useRef<RTCPeerConnection | null>(null),
    localStreamRef = useRef<MediaStream | null>(null),
    dataChannelRef = useRef<RTCDataChannel | null>(null),
    filesDataChannelRef = useRef<RTCDataChannel | null>(null);
  const lastPointerSequence = useRef(0);
  const pointerChannelRef = useRef<RTCDataChannel | null>(null);
  const ice = useRef<RTCIceCandidateInit[]>([]),
    policy = useRef(permissions),
    input = useRef(onRemoteInput),
    generation = useRef(0);
  policy.current = permissions;
  input.current = onRemoteInput;
  const stopSharing = useCallback(() => {
    generation.current++;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    dataChannelRef.current = null;
    pointerChannelRef.current = null;
    lastPointerSequence.current = 0;
    filesDataChannelRef.current = null;
    ice.current = [];
    setIsSharing(false);
    setIsReceiving(false);
  }, []);
  const wireControl = useCallback(
    (channel: RTCDataChannel) => {
      dataChannelRef.current = channel;
      channel.onmessage = (event) => {
        if (typeof event.data !== "string" || event.data.length > 8192) return;
        try {
          const m = JSON.parse(event.data);
          if (
            role === "client" &&
            m.type === "capture-status" &&
            typeof m.active === "boolean"
          ) {
            setIsReceiving(m.active);
            setError(
              m.active
                ? null
                : "O compartilhamento foi pausado pelo anfitrião.",
            );
            return;
          }
          if (role !== "host" || !policy.current.control) return;
          if (
            (m.type === "mouse" && validRemoteMouse(m.data)) ||
            (m.type === "keyboard" && validRemoteKeyboard(m.data))
          )
            input.current?.(m);
        } catch {
          /* Reject malformed peer input. */
        }
      };
    },
    [role],
  );
  const wirePointer = useCallback(
    (channel: RTCDataChannel) => {
      pointerChannelRef.current = channel;
      channel.onmessage = (event) => {
        if (
          role !== "host" ||
          !policy.current.control ||
          typeof event.data !== "string" ||
          event.data.length > 1024
        )
          return;
        try {
          const m = JSON.parse(event.data);
          if (
            m.type === "mouse" &&
            m.data?.type === "move" &&
            validRemoteMouse(m.data) &&
            Number.isSafeInteger(m.seq) &&
            m.seq > lastPointerSequence.current
          ) {
            lastPointerSequence.current = m.seq;
            input.current?.(m);
          }
        } catch {
          /* Ignore invalid pointer packets. */
        }
      };
    },
    [role],
  );
  const create = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;
    pc.onicecandidate = (e) => {
      if (e.candidate)
        onSendSignalingMessage?.("ice-candidate", e.candidate.toJSON());
    };
    pc.onconnectionstatechange = () => {
      setPeerState(pc.connectionState);
      if (pc.connectionState === "connected") setError(null);
      if (pc.connectionState === "failed")
        setError(
          "Não foi possível estabelecer vídeo nesta rede. Tente outra rede; esta versão não usa retransmissão TURN.",
        );
      if (pc.connectionState === "disconnected")
        setError("A conexão de mídia foi interrompida.");
    };
    pc.ontrack = (e) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject =
          e.streams[0] || new MediaStream([e.track]);
        void remoteVideoRef.current
          .play()
          .catch(() => setError("Não foi possível reproduzir o vídeo remoto."));
        setIsReceiving(true);
      }
    };
    pc.ondatachannel = (e) => {
      if (e.channel.label === "coffee-desk-pointer") wirePointer(e.channel);
      else if (e.channel.label === "coffee-desk-control")
        wireControl(e.channel);
      else if (e.channel.label === "coffee-desk-files") {
        filesDataChannelRef.current = e.channel;
        onFilesChannelReady?.(e.channel);
      }
    };
    return pc;
  }, [
    onSendSignalingMessage,
    onFilesChannelReady,
    remoteVideoRef,
    wirePointer,
    wireControl,
  ]);
  const bindStream = useCallback(
    (stream: MediaStream) => {
      localStreamRef.current = stream;
      if (role === "host")
        void window.electronAPI
          .confirmCaptureReady()
          .then(() =>
            window.electronAPI.toggleInputControl(policy.current.control),
          )
          .catch(() => {});
      if (dataChannelRef.current?.readyState === "open")
        dataChannelRef.current.send(
          JSON.stringify({ type: "capture-status", active: true }),
        );
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        void localVideoRef.current.play().catch(() => {});
      }
      setIsSharing(true);
      setPeerState(pcRef.current?.connectionState || "connecting");
      stream.getVideoTracks()[0].addEventListener("ended", () => {
        if (localStreamRef.current !== stream) return;
        if (dataChannelRef.current?.readyState === "open")
          dataChannelRef.current.send(
            JSON.stringify({ type: "capture-status", active: false }),
          );
        setIsSharing(false);
        setError(
          "A fonte compartilhada foi encerrada. Escolha outra tela ou janela.",
        );
        void window.electronAPI.stopDesktopStream();
      });
    },
    [localVideoRef, role],
  );
  const startSharing = useCallback(async () => {
    if (pcRef.current) return;
    const epoch = ++generation.current;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
          frameRate: { ideal: 30, max: 60 },
        },
        audio: false,
      });
      if (epoch !== generation.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      if (!stream.getVideoTracks().length) throw Error("No video");
      const pc = create();
      bindStream(stream);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      wireControl(
        pc.createDataChannel("coffee-desk-control", { ordered: true }),
      );
      const pointer = pc.createDataChannel("coffee-desk-pointer", {
        ordered: false,
        maxRetransmits: 0,
      });
      wirePointer(pointer);
      const files = pc.createDataChannel("coffee-desk-files", {
        ordered: true,
      });
      filesDataChannelRef.current = files;
      onFilesChannelReady?.(files);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      if (epoch !== generation.current) return;
      onSendSignalingMessage?.("offer", { sdp: offer.sdp });
    } catch {
      if (epoch === generation.current) {
        localStreamRef.current?.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
        (pcRef.current as RTCPeerConnection | null)?.close();
        pcRef.current = null;
        setIsSharing(false);
        setError(
          "Não foi possível capturar a fonte escolhida. Verifique a permissão de captura e tente novamente.",
        );
        setPeerState("capture-failed");
        void window.electronAPI.toggleInputControl(false).catch(() => {});
      }
    }
  }, [
    create,
    wirePointer,
    bindStream,
    wireControl,
    onFilesChannelReady,
    onSendSignalingMessage,
  ]);
  useEffect(
    () =>
      window.electronAPI.onCaptureUnavailable(() => {
        if (role !== "host") return;
        localStreamRef.current?.getTracks().forEach((t) => t.stop());
        setIsSharing(false);
        setPeerState("capture-ended");
        setError(
          "A fonte compartilhada não está mais disponível. Escolha outra tela ou janela.",
        );
        if (dataChannelRef.current?.readyState === "open")
          dataChannelRef.current.send(
            JSON.stringify({ type: "capture-status", active: false }),
          );
      }),
    [role],
  );
  const switchToRealScreen = useCallback(async () => {
    if (!pcRef.current) {
      await startSharing();
      return;
    }
    const epoch = ++generation.current,
      activePc = pcRef.current;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    setIsSharing(false);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
          frameRate: { ideal: 30, max: 60 },
        },
        audio: false,
      });
      if (epoch !== generation.current || activePc !== pcRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const track = stream.getVideoTracks()[0];
      if (!track) throw Error("No video");
      const sender = pcRef.current
        .getSenders()
        .find((s) => s.track?.kind === "video");
      if (!sender) {
        stream.getTracks().forEach((t) => t.stop());
        throw Error("No sender");
      }
      await sender.replaceTrack(track);
      const old = localStreamRef.current;
      bindStream(stream);
      old?.getTracks().forEach((t) => t.stop());
      setError(null);
    } catch {
      if (epoch !== generation.current) return;
      setIsSharing(false);
      setPeerState("capture-failed");
      if (dataChannelRef.current?.readyState === "open")
        dataChannelRef.current.send(
          JSON.stringify({ type: "capture-status", active: false }),
        );
      setError(
        "Não foi possível trocar a captura. Escolha uma fonte disponível e tente novamente.",
      );
    }
  }, [bindStream, startSharing]);
  const drain = async (pc: RTCPeerConnection) => {
    for (const candidate of ice.current.splice(0))
      await pc.addIceCandidate(candidate);
  };
  useEffect(() => {
    const offer = (event: Event) => {
      const sdp = (event as CustomEvent).detail?.sdp;
      if (!sdp || role !== "client") return;
      void (async () => {
        const pc = pcRef.current || create();
        await pc.setRemoteDescription({ type: "offer", sdp });
        await drain(pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        onSendSignalingMessage?.("answer", { sdp: answer.sdp });
      })().catch(() => setError("Falha na negociação do vídeo remoto."));
    };
    const answer = (event: Event) => {
      const sdp = (event as CustomEvent).detail?.sdp,
        pc = pcRef.current;
      if (pc && sdp && role === "host")
        void pc
          .setRemoteDescription({ type: "answer", sdp })
          .then(() => drain(pc))
          .catch(() => setError("Falha na confirmação do vídeo."));
    };
    const candidate = (event: Event) => {
      const value = (event as CustomEvent<RTCIceCandidateInit>).detail;
      const pc = pcRef.current;
      if (!pc?.remoteDescription) {
        if (ice.current.length < 256) ice.current.push(value);
      } else void pc.addIceCandidate(value).catch(() => {});
    };
    const sourceChanged = () => {
      if (role === "host") void switchToRealScreen();
    };
    window.addEventListener("webrtc-offer", offer);
    window.addEventListener("webrtc-answer", answer);
    window.addEventListener("webrtc-ice", candidate);
    window.addEventListener("capture-source-changed", sourceChanged);
    return () => {
      window.removeEventListener("webrtc-offer", offer);
      window.removeEventListener("webrtc-answer", answer);
      window.removeEventListener("webrtc-ice", candidate);
      window.removeEventListener("capture-source-changed", sourceChanged);
    };
  }, [role, create, onSendSignalingMessage, switchToRealScreen]);
  useEffect(() => {
    if (role === "host" && isConnected) void startSharing();
  }, [role, isConnected, startSharing]);
  useEffect(() => () => stopSharing(), [stopSharing]);
  useEffect(() => {
    let previousBytes = 0,
      previousTime = 0;
    const timer = setInterval(() => {
      const pc = pcRef.current;
      if (!pc) return;
      void pc
        .getStats()
        .then((report) => {
          const next: DiagnosticStats = {};
          let bytes = 0;
          report.forEach((s) => {
            if (
              s.type === "candidate-pair" &&
              s.state === "succeeded" &&
              s.nominated &&
              typeof s.currentRoundTripTime === "number"
            )
              next.latencyMs = Math.round(s.currentRoundTripTime * 1000);
            if (
              (s.type === "inbound-rtp" || s.type === "outbound-rtp") &&
              s.kind === "video"
            ) {
              if (typeof s.framesPerSecond === "number")
                next.framesPerSecond = s.framesPerSecond;
              if (typeof s.packetsLost === "number")
                next.packetsLost = s.packetsLost;
              bytes += s.bytesReceived || s.bytesSent || 0;
            }
          });
          const now = performance.now();
          if (previousTime && bytes >= previousBytes)
            next.bitrateKbps = Math.round(
              ((bytes - previousBytes) * 8) / (now - previousTime),
            );
          previousBytes = bytes;
          previousTime = now;
          setStats(next);
        })
        .catch(() => {});
    }, 2000);
    return () => clearInterval(timer);
  }, []);
  return {
    pcRef,
    dataChannelRef,
    pointerChannelRef,
    filesDataChannelRef,
    isSharing,
    isReceiving,
    isVirtualStream: false,
    error,
    peerState,
    stats,
    startSharing,
    switchToRealScreen,
    stopSharing,
  };
}
