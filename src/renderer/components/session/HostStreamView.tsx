import type { RefObject } from "react";
export function HostStreamView({
  remoteId,
  isSharing,
  onSwitchToRealScreen,
}: {
  remoteId: string;
  isSharing: boolean;
  localVideoRef: RefObject<HTMLVideoElement | null>;
  onSwitchToRealScreen: () => void;
}) {
  return (
    <div className="host-stream">
      <h3>
        {isSharing
          ? "Compartilhando a fonte escolhida"
          : "Compartilhamento pausado"}
      </h3>
      <p>
        Computador remoto: <strong>{remoteId}</strong>
      </p>
      <p className="host-sharing-note">
        A transmissão está ativa sem pré-visualização neste computador.
      </p>
      {!isSharing && (
        <button className="primary-button" onClick={onSwitchToRealScreen}>
          Tentar captura novamente
        </button>
      )}
    </div>
  );
}
