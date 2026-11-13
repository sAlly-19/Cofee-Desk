import { useState } from "react";
import {
  PhoneIncoming,
  Monitor,
  ShieldCheck,
  Eye,
  Check,
  ArrowUpRight,
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
    [kind, setKind] = useState<"screen" | "window">("screen");
  const full =
      permissions.control && permissions.clipboard && permissions.files,
    viewOnly =
      !permissions.control && !permissions.clipboard && !permissions.files;
  return (
    <Modal
      isOpen
      onClose={() => onReject(incomingCall.fromId)}
      closeOnBackdrop={false}
      title="Solicitação de sessão"
      subtitle="Um computador está solicitando acesso remoto."
      icon={<PhoneIncoming size={24} />}
      maxWidth={620}
      footer={
        <div className="request-actions">
          <button
            className="secondary-button request-reject"
            onClick={() => onReject(incomingCall.fromId)}
          >
            Recusar
          </button>
          <button
            className="primary-button request-accept"
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
            {answering ? (
              "Confirmando…"
            ) : !source ? (
              "Preparando fontes…"
            ) : (
              <>
                <Check size={18} />
                Aceitar e Compartilhar
                <ArrowUpRight size={17} />
              </>
            )}
          </button>
        </div>
      }
    >
      <section className="session-request">
        <p className="request-access-note">Mouse independente experimental: não move o cursor do Windows. Alguns programas podem não aceitar esse controle.</p>
        <div className="request-device">
          <span className="request-device-icon">
            <Monitor size={28} />
          </span>
          <div>
            <span className="request-eyebrow">COMPUTADOR SOLICITANTE</span>
            <strong className="font-mono">{incomingCall.fromId}</strong>
            <span>Deseja se conectar a este computador</span>
          </div>
          <span className="request-live-dot" aria-hidden="true" />
        </div>
        <div className="request-section-title">
          <ShieldCheck size={17} />
          <strong>Você escolhe o acesso</strong>
        </div>
        <div className="request-profiles">
          <button
            type="button"
            aria-pressed={Boolean(full)}
            disabled={answering}
            onClick={() => setPermissions({ ...FULL_PERMISSIONS })}
          >
            <ShieldCheck size={18} />
            <span>
              Acesso completo<small>Controle, clipboard e arquivos</small>
            </span>
          </button>
          <button
            type="button"
            aria-pressed={viewOnly}
            disabled={answering}
            onClick={() => setPermissions({ ...VIEW_ONLY })}
          >
            <Eye size={18} />
            <span>
              Apenas visualização<small>Sem controlar este computador</small>
            </span>
          </button>
        </div>
        <PermissionsFields
          value={permissions}
          onChange={setPermissions}
          windowOnly={kind === "window"}
          disabled={answering}
        />
        <details className="request-source">
          <summary>
            <Monitor size={17} />
            <span>O que compartilhar</span>
            <strong>
              {!source
                ? "Carregando fontes…"
                : kind === "window"
                  ? "Janela selecionada"
                  : "Monitor selecionado"}
            </strong>
          </summary>
          <SourcePicker
            value={source}
            onChange={(id, k) => {
              setSource(id);
              setKind(k);
            }}
            disabled={answering}
          />
        </details>
        <p className="request-access-note">
          Ao aceitar uma sessão de monitor, o acesso inclui alternar entre seus
          monitores, sem novas confirmações. Você pode ajustar permissões ou
          encerrar a sessão a qualquer momento.
        </p>
        {error && (
          <p role="alert" className="settings-error">
            {error}
          </p>
        )}
        <div className="request-expiration">
          <span>
            {answering
              ? "Aguardando confirmação segura do servidor…"
              : "Aguardando sua autorização"}
          </span>
          <strong>{Math.max(0, countdown)} s</strong>
        </div>
        <div
          className="call-countdown"
          role="progressbar"
          aria-label="Tempo para responder"
          aria-valuenow={countdown}
          aria-valuemin={0}
          aria-valuemax={30}
        >
          <span
            style={{
              width: Math.max(0, Math.min(100, (countdown / 30) * 100)) + "%",
            }}
          />
        </div>
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
