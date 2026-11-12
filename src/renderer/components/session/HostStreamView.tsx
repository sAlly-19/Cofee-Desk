import type { RefObject } from "react";
export function HostStreamView({
  remoteId,
  isSharing,
  localVideoRef,
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
      <video
        ref={(el) => {
          (localVideoRef as { current: HTMLVideoElement | null }).current = el;
        }}
        autoPlay
        playsInline
        muted
        style={{
          width: 340,
          maxWidth: "100%",
          height: 190,
          objectFit: "contain",
          background: "#000",
          borderRadius: 12,
        }}
      />
      {!isSharing && (
        <button className="primary-button" onClick={onSwitchToRealScreen}>
          Tentar captura novamente
        </button>
      )}
    </div>
  );
}
