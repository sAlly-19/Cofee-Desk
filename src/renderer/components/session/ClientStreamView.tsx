import { type RefObject, type MouseEvent, type WheelEvent } from "react";
import { FolderSync } from "lucide-react";

interface ClientStreamViewProps {
  remoteId: string;
  isReceiving: boolean;
  isFullscreen: boolean;
  isDraggingFiles: boolean;
  remoteVideoRef: RefObject<HTMLVideoElement | null>;
  onMouseMove: (e: MouseEvent<HTMLVideoElement>) => void;
  onMouseDown: (e: MouseEvent<HTMLVideoElement>) => void;
  onMouseUp: (e: MouseEvent<HTMLVideoElement>) => void;
  onDoubleClick: (e: MouseEvent<HTMLVideoElement>) => void;
  onContextMenu: (e: MouseEvent<HTMLVideoElement>) => void;
  onWheel: (e: WheelEvent<HTMLVideoElement>) => void;
}

export function ClientStreamView({
  remoteId,
  isReceiving,
  isFullscreen,
  isDraggingFiles,
  remoteVideoRef,
  onMouseMove,
  onMouseDown,
  onMouseUp,
  onDoubleClick,
  onContextMenu,
  onWheel,
}: ClientStreamViewProps): JSX.Element {
  return (
    <>
      {/* Overlay de Drag & Drop de Arquivos sobre a Tela */}
      {isDraggingFiles && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(10, 5, 2, 0.78)",
            backdropFilter: "blur(12px)",
            border: "3px dashed var(--accent-primary)",
            borderRadius: isFullscreen ? 0 : "14px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 45,
            pointerEvents: "none",
            animation: "fadeIn 0.2s ease",
          }}
        >
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              backgroundColor: "rgba(255, 122, 0, 0.2)",
              border: "2px solid var(--accent-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 35px rgba(255, 122, 0, 0.5)",
              marginBottom: "1.25rem",
            }}
          >
            <FolderSync
              size={40}
              color="var(--accent-primary)"
              className="cd-spin"
            />
          </div>

          <span
            style={{
              fontSize: "1.35rem",
              fontWeight: 800,
              color: "var(--text-primary)",
            }}
          >
            Solte os arquivos aqui para transferir
          </span>
          <span
            style={{
              fontSize: "0.9rem",
              color: "rgba(255, 220, 195, 0.75)",
              marginTop: "6px",
            }}
          >
            Transferência P2P direta via WebRTC
          </span>
        </div>
      )}

      {/* Vídeo remoto */}
      <video
        ref={remoteVideoRef as any}
        autoPlay
        playsInline
        muted
        onMouseMove={onMouseMove}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu}
        onWheel={onWheel}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          cursor: "default",
        }}
      />

      {/* Estado sem vídeo ainda carregado no Client */}
      {!isReceiving && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            textAlign: "center",
            color: "rgba(255, 215, 185, 0.7)",
          }}
        >
          <div style={{ width: 50, height: 50, margin: "0 auto 1rem auto" }}>
            <div
              style={{
                width: "100%",
                height: "100%",
                borderRadius: "50%",
                border: "3px solid rgba(255, 140, 26, 0.2)",
                borderTopColor: "var(--accent-primary)",
                animation: "cd-spin 1s linear infinite",
              }}
            />
          </div>
          <h4
            style={{
              margin: "0 0 0.5rem 0",
              color: "var(--text-primary)",
              fontSize: "1.05rem",
              fontWeight: 700,
            }}
          >
            Estabelecendo transmissão de vídeo P2P com {remoteId}...
          </h4>
          <p style={{ margin: 0, fontSize: "0.85rem" }}>
            Aguardando fluxo de tela da máquina host
          </p>
        </div>
      )}
    </>
  );
}
