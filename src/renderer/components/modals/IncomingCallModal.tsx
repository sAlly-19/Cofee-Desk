import { PhoneCall } from "lucide-react";
import { Modal } from "../ui/Modal";
import type { IncomingCall } from "../../types/app";
interface IncomingCallModalProps {
  incomingCall: IncomingCall | null;
  countdown: number;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}
export function IncomingCallModal({
  incomingCall,
  countdown,
  onAccept,
  onReject,
}: IncomingCallModalProps) {
  if (!incomingCall) return null;
  return (
    <Modal
      isOpen
      onClose={() => onReject(incomingCall.fromId)}
      closeOnBackdrop={false}
      title="Solicitação de conexão remota"
      subtitle="Você decide quem pode acessar este computador."
      icon={<PhoneCall size={23} />}
      maxWidth={520}
    >
      <p className="incoming-description">
        O computador{" "}
        <strong className="font-mono">{incomingCall.fromId}</strong> solicita
        visualização e controle remoto da sua tela.
      </p>
      <div
        className="call-countdown"
        role="progressbar"
        aria-label="Tempo para responder"
        aria-valuenow={countdown}
        aria-valuemin={0}
        aria-valuemax={30}
      >
        <span style={{ width: (countdown / 30) * 100 + "%" }} />
      </div>
      <div className="incoming-actions">
        <button
          className="primary-button"
          onClick={() => onAccept(incomingCall.fromId)}
        >
          Aceitar e Compartilhar
        </button>
        <button
          className="secondary-button"
          onClick={() => onReject(incomingCall.fromId)}
        >
          Recusar ({countdown}s)
        </button>
      </div>
    </Modal>
  );
}
