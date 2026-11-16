import type { SessionPermissions } from "../../shared/session";
import type { MonitorInfo } from "../hooks/useRemoteMonitors";
import type { SharedSourceInfo } from "./session/HostStreamView";
import { useEffect, useState, useRef } from "react";
import type {
  MouseEventData,
  KeyboardEventData,
  FileTransferItem,
} from "@shared/types";
import { AlertTriangle } from "lucide-react";
import { useWebRTCPeer } from "../hooks/useWebRTCPeer";
import { useRemoteInputCapture } from "../hooks/useRemoteInputCapture";
import { RemoteToolbar } from "./session/RemoteToolbar";
import { HostStreamView } from "./session/HostStreamView";
import { ClientStreamView } from "./session/ClientStreamView";

interface Props {
  monitors?: {
    monitors: MonitorInfo[];
    pending: boolean;
    request: (id: string) => void;
  };
  sourceInfo?: SharedSourceInfo | null;
  onOpenAccess?: () => void;
  connectionId: string;
  permissions: SessionPermissions;
  remoteId: string;
  isConnected: boolean;
  role?: "host" | "client";
  onRemoteInput?: (input: {
    type: "mouse" | "keyboard";
    data: MouseEventData | KeyboardEventData;
  }) => void;
  onSendSignalingMessage?: (
    type: "offer" | "answer" | "ice-candidate",
    payload: unknown,
  ) => void;
  onReport?: () => void;
  onDisconnect?: () => void;
  onToggleDrawer?: (tab: "clipboard" | "files") => void;
  activeDrawer?: "clipboard" | "files" | null;
  onFilesChannelReady?: (channel: RTCDataChannel) => void;
  onFilesDropped?: (files: FileList) => void;
  activeTransfer?: FileTransferItem;
}

export function RemoteStreamView({
  remoteId,
  monitors,
  sourceInfo,
  onOpenAccess,
  permissions,
  isConnected,
  role = "client",
  onRemoteInput,
  onSendSignalingMessage,
  onReport,
  onDisconnect,
  onToggleDrawer,
  activeDrawer,
  onFilesChannelReady,
  onFilesDropped,
  activeTransfer,
}: Props): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);

  // Hook WebRTC
  const {
    dataChannelRef,
    pointerChannelRef,
    isReceiving,
    isSharing,
    stats,
    error,
    peerState,
    switchToRealScreen,
  } = useWebRTCPeer({
    remoteId,
    isConnected,
    role,
    permissions,
    onRemoteInput,
    onSendSignalingMessage,
    onFilesChannelReady,
    localVideoRef,
    remoteVideoRef,
  });

  // Hook de captura de mouse e teclado
  const {
    releaseInput,
    isKeyboardFocused,
    setIsKeyboardFocused,
    hostControlEnabled,
    toggleHostControl,
    handleMouseMove,
    handleMouseDown,
    handleMouseUp,
    handleDoubleClick,
    handleContextMenu,
    handleWheel,
    handleKeyDown,
    handleKeyUp,
  } = useRemoteInputCapture({
    role,
    allowed: permissions.control,
    pointerChannelRef,
    dataChannelRef,
    containerRef,
  });

  useEffect(() => {
    const sync = () =>
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      void containerRef.current.requestFullscreen?.().catch(() => {});
    } else {
      void document.exitFullscreen?.().catch(() => {});
    }
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onFocus={(e) => setIsKeyboardFocused(e.target === e.currentTarget)}
      onBlur={() => {
        setIsKeyboardFocused(false);
        releaseInput();
      }}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget) handleKeyDown(e);
      }}
      onKeyUp={(e) => {
        if (e.target === e.currentTarget) handleKeyUp(e);
      }}
      onDragEnter={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setIsDraggingFiles(true);
        }
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setIsDraggingFiles(true);
        }
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsDraggingFiles(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDraggingFiles(false);
        if (
          permissions.files &&
          e.dataTransfer.files &&
          e.dataTransfer.files.length > 0 &&
          onFilesDropped
        ) {
          onFilesDropped(e.dataTransfer.files);
        }
      }}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 520,
        backgroundColor: "#040201",
        borderRadius: isFullscreen ? 0 : "16px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        outline: "none",
        border: isFullscreen ? "none" : "1px solid rgba(255, 140, 26, 0.2)",
      }}
    >
      {/* Barra fora da área de vídeo: controles não encobrem a captura. */}
      <RemoteToolbar
        monitors={monitors}
        diagnostic={{
          stage: peerState.startsWith("capture-") ? "capture" : "webrtc",
          code:
            peerState === "capture-failed"
              ? "CAPTURE_FAILED"
              : peerState === "connected"
                ? "MEDIA_CONNECTED"
                : peerState === "failed"
                  ? "ICE_FAILED"
                  : "MEDIA_CONNECTING",
          state:
            peerState === "connected" ? "ready" : error ? "failed" : "waiting",
          stats,
        }}
        onOpenAccess={onOpenAccess}
        onFocusVideo={() => containerRef.current?.focus()}
        remoteId={remoteId}
        role={role}
        peerState={peerState}
        isKeyboardFocused={isKeyboardFocused}
        isFullscreen={isFullscreen}
        hostControlEnabled={hostControlEnabled && permissions.control}
        permissions={permissions}
        activeDrawer={activeDrawer}
        activeTransfer={activeTransfer}
        onToggleFullscreen={toggleFullscreen}
        onToggleHostControl={toggleHostControl}
        onToggleDrawer={onToggleDrawer}
        onReport={onReport}
        onDisconnect={onDisconnect}
      />

      {/* 2. ERRO SOBREPOSTO */}
      {error && (
        <div
          style={{
            position: "absolute",
            top: 60,
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "rgba(239, 68, 68, 0.92)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            borderRadius: "10px",
            color: "#ffffff",
            padding: "8px 16px",
            fontSize: "0.85rem",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            zIndex: 30,
            backdropFilter: "blur(10px)",
          }}
        >
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* 3. ÁREA CENTRAL DE VÍDEO (CLIENT OU HOST) */}
      <div
        className={
          role === "host" ? "session-surface-host" : "session-surface-client"
        }
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          width: "100%",
          minHeight: 0,
          overflow: "auto",
        }}
      >
        {role === "client" ? (
          <ClientStreamView
            remoteId={remoteId}
            isReceiving={isReceiving}
            isFullscreen={isFullscreen}
            isDraggingFiles={isDraggingFiles}
            remoteVideoRef={remoteVideoRef}
            onMouseMove={handleMouseMove}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onDoubleClick={handleDoubleClick}
            onContextMenu={handleContextMenu}
            onWheel={handleWheel}
          />
        ) : (
          <HostStreamView
            permissions={permissions}
            peerState={peerState}
            hostControlEnabled={hostControlEnabled && permissions.control}
            source={sourceInfo || null}
            onOpenAccess={() => onOpenAccess?.()}
            onToggleControl={() => void toggleHostControl()}
            onDisconnect={onDisconnect}
            remoteId={remoteId}
            isSharing={isSharing}
            localVideoRef={localVideoRef}
            onSwitchToRealScreen={switchToRealScreen}
          />
        )}
      </div>
    </div>
  );
}
