import { useRef, useState } from "react";
import {
  PhoneIncoming,
  Monitor,
  ShieldCheck,
  Eye,
  Check,
  Clock,
} from "lucide-react";
import { Modal } from "../ui/Modal";
import { SourcePicker } from "../session/SourcePicker";
import { PermissionsFields } from "../session/PermissionsFields";
import {
  FULL_PERMISSIONS,
  VIEW_ONLY,
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
    [kind, setKind] = useState<"screen" | "window">("screen"),
    [viewOnly, setViewOnly] = useState(false);
  const clicked = useRef(false);
  if (!answering && error) clicked.current = false;
  const [sourceValid, setSourceValid] = useState(false);
  const expired = countdown <= 0 && !answering,
    locked = answering || expired;
  return (
    <Modal
      isOpen
      onClose={() => {
        if (!answering) onReject(incomingCall.fromId);
      }}
      closeOnBackdrop={false}
      title="Solicitação de acesso"
      subtitle="Um computador deseja se conectar a este dispositivo."
      icon={<PhoneIncoming size={22} />}
      maxWidth={760}
      footer={
        <div className="access-request-footer">
          <span className="request-time" role="status">
            <Clock size={15} />
            {expired
              ? "Solicitação expirada"
              : answering
                ? "Confirmando…"
                : Math.max(0, countdown) + " s restantes"}
          </span>
          <button
            className="secondary-button"
            disabled={answering}
            onClick={() => onReject(incomingCall.fromId)}
          >
            {expired ? "Fechar" : "Recusar"}
          </button>
          <button
            className="primary-button"
            disabled={!source || !sourceValid || locked}
            onClick={() => {
              if (clicked.current) return;
              clicked.current = true;
              onAccept(
                incomingCall.fromId,
                viewOnly
                  ? { ...VIEW_ONLY }
                  : {
                      ...permissions,
                      control: kind === "screen" && permissions.control,
                    },
                source,
              );
            }}
          >
            <Check size={17} />
            {answering ? "Confirmando…" : "Aceitar e Compartilhar"}
          </button>
        </div>
      }
    >
      <section className="access-request">
        <div className="access-request-device">
          <Monitor size={24} />
          <div>
            <span>Computador solicitante</span>
            <strong className="font-mono">{incomingCall.fromId}</strong>
          </div>
          <small>
            {expired
              ? "Expirada"
              : answering
                ? "Em confirmação"
                : "Aguardando autorização"}
          </small>
        </div>
        <div
          className="request-profiles"
          role="group"
          aria-label="Nível de acesso"
        >
          <button
            type="button"
            aria-pressed={!viewOnly}
            disabled={locked}
            onClick={() => {
              setViewOnly(false);
              setPermissions({
                ...FULL_PERMISSIONS,
                control: kind === "screen",
              });
            }}
          >
            <ShieldCheck size={19} />
            <span>
              Acesso completo<small>Escolha os recursos permitidos</small>
            </span>
          </button>
          <button
            type="button"
            aria-pressed={viewOnly}
            disabled={locked}
            onClick={() => {
              setViewOnly(true);
              setPermissions({ ...VIEW_ONLY });
            }}
          >
            <Eye size={19} />
            <span>
              Apenas visualização
              <small>Sem controle, clipboard ou arquivos</small>
            </span>
          </button>
        </div>
        <PermissionsFields
          value={permissions}
          onChange={setPermissions}
          windowOnly={kind === "window"}
          disabled={locked || viewOnly}
        />
        <SourcePicker
          onValidityChange={setSourceValid}
          value={source}
          disabled={locked}
          onChange={(id, k) => {
            setSource(id);
            setKind(k);
            if (k === "window")
              setPermissions((p) => ({ ...p, control: false }));
          }}
        />
        <p className="access-request-note">
          {kind === "screen"
            ? "O acesso permite alternar entre seus monitores, sem novas confirmações."
            : "Somente a janela escolhida será transmitida, sem controle remoto."}{" "}
          Você pode revogar recursos ou encerrar o acesso durante a sessão.
        </p>
        {error && (
          <p role="alert" className="settings-error">
            {error}
          </p>
        )}
        {expired && (
          <p role="status" className="settings-error">
            O tempo de resposta terminou. Peça uma nova solicitação.
          </p>
        )}
      </section>
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
