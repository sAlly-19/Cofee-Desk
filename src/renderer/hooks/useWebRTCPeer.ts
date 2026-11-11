import { useState, useRef, useCallback, useEffect, type RefObject } from 'react';
import { createVirtualDesktopStream } from '../utils/virtualDesktopStream';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

interface UseWebRTCPeerProps {
  remoteId: string;
  isConnected: boolean;
  role: 'host' | 'client';
  onRemoteInput?: (input: any) => void;
  onSendSignalingMessage?: (type: 'offer' | 'answer' | 'ice-candidate', payload: unknown) => void;
  onFilesChannelReady?: (channel: RTCDataChannel) => void;
  localVideoRef: RefObject<HTMLVideoElement | null>;
  remoteVideoRef: RefObject<HTMLVideoElement | null>;
}

export function useWebRTCPeer({
  remoteId,
  isConnected,
  role,
  onRemoteInput,
  onSendSignalingMessage,
  onFilesChannelReady,
  localVideoRef,
  remoteVideoRef,
}: UseWebRTCPeerProps) {
  const [isSharing, setIsSharing] = useState(false);
  const [isReceiving, setIsReceiving] = useState(false);
  const [isVirtualStream, setIsVirtualStream] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [peerState, setPeerState] = useState<string>('connecting');

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const filesDataChannelRef = useRef<RTCDataChannel | null>(null);
  const iceCandidateQueue = useRef<any[]>([]);

  const sendSignaling = useCallback(
    (type: 'offer' | 'answer' | 'ice-candidate', payload: unknown) => {
      if (onSendSignalingMessage) {
        onSendSignalingMessage(type, payload);
      }
    },
    [onSendSignalingMessage]
  );

  const stopSharing = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    dataChannelRef.current = null;
    filesDataChannelRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    setIsSharing(false);
    setIsReceiving(false);
    setError(null);
  }, [localVideoRef, remoteVideoRef]);

  const drainIceCandidates = async (pc: RTCPeerConnection) => {
    while (iceCandidateQueue.current.length > 0) {
      const cand = iceCandidateQueue.current.shift();
      if (cand) {
        try {
          await pc.addIceCandidate(cand);
        } catch (e) {
          console.warn('[WebRTC] Erro ao aplicar candidato ICE enfileirado:', e);
        }
      }
    }
  };

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignaling('ice-candidate', {
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] PeerConnection State: ${pc.connectionState}`);
      setPeerState(pc.connectionState);
      if (pc.connectionState === 'connected') {
        setError(null);
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        setPeerState('desconectado');
      }
    };

    pc.ontrack = (event) => {
      console.log('[WebRTC] Track remoto recebido:', event.track.kind);
      const remoteStream = event.streams[0] || new MediaStream([event.track]);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.play().catch((err) => {
          console.warn('[WebRTC] Erro ao reproduzir vídeo:', err);
        });
        setIsReceiving(true);
      }
    };

    return pc;
  }, [sendSignaling, remoteVideoRef]);

  const startSharing = useCallback(async () => {
    try {
      setError(null);
      let stream: MediaStream | null = null;
      let usingVirtual = false;

      // 1. Tenta getDisplayMedia
      try {
        if (typeof navigator !== 'undefined' && navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function') {
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: false,
          });
        }
      } catch (dispErr) {
        console.warn('[WebRTC] getDisplayMedia direto falhou:', dispErr);
      }

      // 2. Se falhou e está no Electron, tenta via getUserMedia com sourceId
      if (!stream && window.electronAPI?.getDesktopSources) {
        try {
          const sources = await window.electronAPI.getDesktopSources();
          const primarySource =
            sources.find((s: any) => s.id?.startsWith('screen:0')) ||
            sources.find((s: any) => s.id?.startsWith('screen')) ||
            sources[0];

          if (primarySource && navigator.mediaDevices && typeof (navigator.mediaDevices as any).getUserMedia === 'function') {
            stream = await (navigator.mediaDevices as any).getUserMedia({
              audio: false,
              video: {
                mandatory: {
                  chromeMediaSource: 'desktop',
                  chromeMediaSourceId: primarySource.id,
                  minWidth: 1280,
                  maxWidth: 1920,
                  minHeight: 720,
                  maxHeight: 1080,
                },
              },
            });
          }
        } catch (gumErr) {
          console.warn('[WebRTC] getUserMedia com sourceId falhou:', gumErr);
        }
      }

      // 3. Fallback: stream animada virtual
      if (!stream) {
        try {
          console.log('[WebRTC] Iniciando Área de Trabalho Virtual para conexão imediata...');
          stream = createVirtualDesktopStream(`Área de Trabalho Virtual • Host (${remoteId || 'Local'})`);
          usingVirtual = true;
        } catch (vErr) {
          console.warn('[WebRTC] Falha ao criar stream virtual:', vErr);
        }
      }

      if (!stream || stream.getVideoTracks().length === 0) {
        console.warn('[WebRTC] Nenhuma track de vídeo inicial disponível. Aguardando ação do usuário.');
        setIsVirtualStream(true);
        setIsSharing(true);
        return;
      }

      setIsVirtualStream(usingVirtual);
      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }

      const pc = createPeerConnection();
      stream.getTracks().forEach((track) => pc.addTrack(track, stream!));

      // Cria DataChannel para controle remoto
      const dc = pc.createDataChannel('coffee-desk-control');
      dataChannelRef.current = dc;

      dc.onopen = () => {
        console.log('[WebRTC Host] Data channel de controle aberto com sucesso!');
      };

      dc.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (onRemoteInput) {
            onRemoteInput(msg);
          }
        } catch (err) {
          console.error('[WebRTC Host] Erro ao processar comando remoto:', err);
        }
      };

      // Cria DataChannel para arquivos
      const filesDc = pc.createDataChannel('coffee-desk-files');
      filesDataChannelRef.current = filesDc;
      filesDc.onopen = () => {
        console.log('[WebRTC Host] Data channel de arquivos conectado!');
        if (onFilesChannelReady) onFilesChannelReady(filesDc);
      };
      if (onFilesChannelReady) {
        onFilesChannelReady(filesDc);
      }

      // Cria oferta SDP
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      sendSignaling('offer', {
        sdp: offer.sdp,
        type: offer.type,
      });

      setIsSharing(true);
    } catch (err) {
      console.error('[WebRTC] Erro ao iniciar compartilhamento:', err);
      const msg = err instanceof Error ? err.message : 'Falha ao iniciar compartilhamento';
      if (!msg.toLowerCase().includes('not supported') && !msg.toLowerCase().includes('permission')) {
        setError(msg);
      } else {
        setIsVirtualStream(true);
      }
    }
  }, [createPeerConnection, sendSignaling, onRemoteInput, onFilesChannelReady, remoteId, localVideoRef]);

  const switchToRealScreen = async () => {
    try {
      const realStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      const newTrack = realStream.getVideoTracks()[0];
      const pc = pcRef.current;
      if (pc) {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(newTrack);
        }
      }

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      localStreamRef.current = realStream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = realStream;
        localVideoRef.current.play().catch(() => {});
      }

      setIsVirtualStream(false);
      setError(null);

      newTrack.addEventListener('ended', () => {
        startSharing();
      });
    } catch (err) {
      console.warn('[WebRTC] Seleção de tela real cancelada:', err);
    }
  };

  const handleOfferReceived = useCallback(
    async (sdp: string) => {
      try {
        console.log('[WebRTC Client] Oferta SDP recebida, configurando resposta...');
        const pc = createPeerConnection();

        pc.ondatachannel = (event) => {
          const ch = event.channel;
          if (ch.label === 'coffee-desk-control') {
            dataChannelRef.current = ch;
            ch.onopen = () => console.log('[WebRTC Client] DataChannel de controle conectado!');
            ch.onmessage = (e) => {
              try {
                const msg = JSON.parse(e.data);
                if (onRemoteInput) onRemoteInput(msg);
              } catch {}
            };
          } else if (ch.label === 'coffee-desk-files') {
            filesDataChannelRef.current = ch;
            ch.onopen = () => {
              console.log('[WebRTC Client] DataChannel de arquivos conectado!');
              if (onFilesChannelReady) onFilesChannelReady(ch);
            };
            if (onFilesChannelReady) {
              onFilesChannelReady(ch);
            }
          }
        };

        await pc.setRemoteDescription({ sdp, type: 'offer' });
        await drainIceCandidates(pc);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        sendSignaling('answer', {
          sdp: answer.sdp,
          type: answer.type,
        });
      } catch (err) {
        console.error('[WebRTC] Erro ao processar oferta:', err);
        setError('Erro ao processar oferta de vídeo do computador remoto');
      }
    },
    [createPeerConnection, sendSignaling, onRemoteInput, onFilesChannelReady]
  );

  const handleAnswerReceived = useCallback(async (sdp: string) => {
    const pc = pcRef.current;
    if (!pc) return;
    try {
      console.log('[WebRTC Host] Resposta SDP recebida, definindo remoteDescription...');
      await pc.setRemoteDescription({ sdp, type: 'answer' });
      await drainIceCandidates(pc);
    } catch (err) {
      console.error('[WebRTC] Erro ao definir resposta remota:', err);
    }
  }, []);

  const handleIceReceived = useCallback(
    async (candidate: { candidate: string; sdpMid: string | null; sdpMLineIndex: number | null }) => {
      const pc = pcRef.current;
      if (!pc || !pc.remoteDescription) {
        iceCandidateQueue.current.push(candidate);
        return;
      }
      try {
        await pc.addIceCandidate(candidate);
      } catch (err) {
        console.error('[WebRTC] Erro ao adicionar candidato ICE:', err);
      }
    },
    []
  );

  // Inicia compartilhamento automático no Host
  useEffect(() => {
    if (role === 'host' && isConnected && !isSharing) {
      startSharing();
    }
  }, [role, isConnected, isSharing, startSharing]);

  // Ouvintes de eventos customizados de sinalização
  useEffect(() => {
    const onOffer = (e: CustomEvent<{ sdp?: string }>) => {
      if (e.detail?.sdp) handleOfferReceived(e.detail.sdp);
    };

    const onAnswer = (e: CustomEvent<{ sdp?: string }>) => {
      if (e.detail?.sdp) handleAnswerReceived(e.detail.sdp);
    };

    const onIce = (e: CustomEvent<{ candidate?: string; sdpMid?: string; sdpMLineIndex?: number }>) => {
      if (e.detail?.candidate) {
        handleIceReceived({
          candidate: e.detail.candidate,
          sdpMid: e.detail.sdpMid ?? null,
          sdpMLineIndex: e.detail.sdpMLineIndex ?? null,
        });
      }
    };

    window.addEventListener('webrtc-offer' as any, onOffer);
    window.addEventListener('webrtc-answer' as any, onAnswer);
    window.addEventListener('webrtc-ice' as any, onIce);

    return () => {
      window.removeEventListener('webrtc-offer' as any, onOffer);
      window.removeEventListener('webrtc-answer' as any, onAnswer);
      window.removeEventListener('webrtc-ice' as any, onIce);
    };
  }, [handleOfferReceived, handleAnswerReceived, handleIceReceived]);

  // Cleanup on unmount
  useEffect(() => {
    if (!isConnected) stopSharing();
    return () => stopSharing();
  }, [isConnected, stopSharing]);

  return {
    pcRef,
    dataChannelRef,
    filesDataChannelRef,
    isSharing,
    isReceiving,
    isVirtualStream,
    error,
    peerState,
    startSharing,
    switchToRealScreen,
    stopSharing,
  };
}
