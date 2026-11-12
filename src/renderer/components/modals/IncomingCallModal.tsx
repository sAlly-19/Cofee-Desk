import { useState } from "react";
import { PhoneCall } from "lucide-react";
import { Modal } from "../ui/Modal";
import { SourcePicker } from "../session/SourcePicker";
import { PermissionsFields } from "../session/PermissionsFields";
import {
  FULL_PERMISSIONS,
  type SessionPermissions,
} from "../../../shared/session";
import type { IncomingCall } from "../../types/app";
interface Props {
  incomingCall: IncomingCall | null;
  countdown: number;
  answering?: boolean;
  error?: string | null;
  onAccept: (id: string, p: SessionPermissions, source: string) => void;
  onReject: (id: string) => void;
}
function Call({
  incomingCall,
  countdown,
  onAccept,
  onReject,
  answering,
  error,
}: Props & { incomingCall: IncomingCall }) {
  const [permissions, setPermissions] = useState({ ...FULL_PERMISSIONS }),
    [source, setSource] = useState(""),
    [kind, setKind] = useState<"screen" | "window">("screen");
  return (
    <Modal
      isOpen
      onClose={() => onReject(incomingCall.fromId)}
      closeOnBackdrop={false}
      title="Solicitação de conexão remota"
      subtitle="Você decide quem pode acessar este computador."
      icon={<PhoneCall size={23} />}
      maxWidth={560}
    >
      <p>
        O computador{" "}
        <strong className="font-mono">{incomingCall.fromId}</strong> solicita
        acesso.
      </p>
      <SourcePicker
        value={source}
        onChange={(id, k) => {
          setSource(id);
          setKind(k);
        }}
        disabled={answering}
      />
      <PermissionsFields
        value={permissions}
        onChange={setPermissions}
        windowOnly={kind === "window"}
        disabled={answering}
      />
      {error && <p role="alert">{error}</p>}
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
          disabled={!source || answering}
          onClick={() =>
            onAccept(
              incomingCall.fromId,
              {
                ...permissions,
                control: kind === "screen" && permissions.control,
              },
              source,
            )
          }
        >
          {answering ? "Confirmando…" : "Aceitar e Compartilhar"}
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
export function IncomingCallModal(props: Props) {
  return props.incomingCall ? (
    <Call
      key={props.incomingCall.expiresAt}
      {...props}
      incomingCall={props.incomingCall}
    />
  ) : null;
}
