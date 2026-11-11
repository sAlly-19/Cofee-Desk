import type { RefObject } from "react";
import {
  Monitor,
  Zap,
  ArrowRight,
  Loader2,
  Shield,
  Lock,
  X,
} from "lucide-react";
import { CurvedGlowDetail } from "./CurvedGlowDetail";
import type { ConnectionStatus, ServerStatus } from "../../types/app";
interface RemoteConnectCardProps {
  remoteSectionRef: RefObject<HTMLDivElement>;
  remoteId: string;
  setRemoteId: (id: string) => void;
  connectionStatus: ConnectionStatus;
  serverStatus: ServerStatus;
  connectionError: string | null;
  onConnect: () => void;
  onCancelCall: () => void;
}
export function RemoteConnectCard({
  remoteSectionRef,
  remoteId,
  setRemoteId,
  connectionStatus,
  serverStatus,
  connectionError,
  onConnect,
  onCancelCall,
}: RemoteConnectCardProps) {
  const isCalling =
    connectionStatus === "calling" || connectionStatus === "ringing";
  const canConnect =
    serverStatus === "connected" &&
    !isCalling &&
    remoteId.replace(/\D/g, "").length === 9;
  function formatId(value: string) {
    const raw = value.replace(/\D/g, "").slice(0, 9);
    setRemoteId(raw.match(/.{1,3}/g)?.join("-") ?? "");
  }
  return (
    <section
      className="connection-panel surface"
      ref={remoteSectionRef}
      aria-labelledby="connect-heading"
    >
      <CurvedGlowDetail />
      <div className="connection-panel-heading">
        <span className="device-icon hero-device">
          <Monitor size={32} strokeWidth={1.7} />
        </span>
        <h2 id="connect-heading">Iniciar conexão</h2>
      </div>
      <form
        className="connect-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (canConnect) onConnect();
        }}
      >
        <input
          id="remote-id"
          aria-label="ID do dispositivo remoto"
          placeholder="Digite o ID do dispositivo"
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          value={remoteId}
          onChange={(e) => formatId(e.target.value)}
          disabled={isCalling}
          aria-invalid={!!connectionError}
          aria-describedby={connectionError ? "connection-error" : undefined}
        />
        {isCalling ? (
          <button
            type="button"
            className="primary-button"
            onClick={onCancelCall}
          >
            <Loader2 className="cd-spin" size={20} />
            <span>Cancelar</span>
            <X size={18} />
          </button>
        ) : (
          <button
            type="submit"
            className="primary-button"
            disabled={!canConnect}
          >
            Conectar <ArrowRight size={25} strokeWidth={1.6} />
          </button>
        )}
      </form>
      <div className="connection-feedback" aria-live="polite">
        {connectionError ? (
          <span id="connection-error" role="alert">
            {connectionError}
          </span>
        ) : isCalling ? (
          "Aguardando resposta do computador remoto…"
        ) : null}
      </div>
      <div className="connection-features">
        <span>
          <Shield size={23} />
          Conexão P2P
        </span>
        <span>
          <Zap size={22} />
          Vídeo WebRTC
        </span>
        <span>
          <Lock size={22} />
          Mídia criptografada
        </span>
      </div>
    </section>
  );
}
