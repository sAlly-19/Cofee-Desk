import { type RefObject } from "react";
import { Radio, Monitor } from "lucide-react";

interface HostStreamViewProps {
  remoteId: string;
  isVirtualStream: boolean;
  localVideoRef: RefObject<HTMLVideoElement | null>;
  onSwitchToRealScreen: () => void;
}

export function HostStreamView({
  remoteId,
  isVirtualStream,
  localVideoRef,
  onSwitchToRealScreen,
}: HostStreamViewProps): JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1.25rem",
        color: "var(--text-primary)",
        padding: "2rem",
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          backgroundColor: "rgba(34, 197, 94, 0.15)",
          border: "2px solid #22c55e",
          boxShadow: "0 0 25px rgba(34, 197, 94, 0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Radio size={34} color="#22c55e" />
      </div>

      <div style={{ textAlign: "center" }}>
        <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>
          Compartilhando sua Área de Trabalho
        </h3>
        <p
          style={{
            margin: "0.4rem 0 0 0",
            fontSize: "0.88rem",
            color: "rgba(255,215,185,0.7)",
          }}
        >
          O computador com ID <strong>{remoteId}</strong> está conectado e
          visualizando sua transmissão.
        </p>
      </div>

      {/* Miniatura da tela local compartilhada */}
      <div
        style={{
          width: 340,
          height: 190,
          borderRadius: "12px",
          border: "2px solid rgba(255, 140, 26, 0.4)",
          overflow: "hidden",
          backgroundColor: "#000000",
          boxShadow: "0 10px 25px rgba(0,0,0,0.6)",
        }}
      >
        <video
          ref={localVideoRef as any}
          autoPlay
          playsInline
          muted
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </div>

      {/* Opção de alternar para tela real se estiver em desktop virtual */}
      {isVirtualStream && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.6rem",
            marginTop: "0.25rem",
          }}
        >
          <div
            style={{
              fontSize: "0.8rem",
              color: "var(--accent-soft)",
              backgroundColor: "rgba(255, 140, 26, 0.12)",
              padding: "4px 14px",
              borderRadius: "12px",
              border: "1px solid rgba(255, 140, 26, 0.3)",
            }}
          >
            Área de Trabalho Virtual P2P ativa
          </div>

          <button
            onClick={onSwitchToRealScreen}
            className="cd-btn-tactile cd-btn-gradient-amber"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "0.65rem 1.4rem",
              borderRadius: "12px",
              fontSize: "0.88rem",
              fontWeight: 700,
              cursor: "pointer",
              border: "none",
              color: "var(--text-primary)",
              boxShadow: "0 6px 20px rgba(255, 122, 0, 0.35)",
            }}
          >
            <Monitor size={16} />
            <span>Transmitir Minha Tela Real</span>
          </button>
        </div>
      )}
    </div>
  );
}
