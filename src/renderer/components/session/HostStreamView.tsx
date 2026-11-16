import type { RefObject } from "react";
import type { SessionPermissions } from "../../../shared/session";
import {
  Monitor,
  AppWindow,
  ShieldCheck,
  MousePointer2,
  Settings2,
  PhoneOff,
  Radio,
} from "lucide-react";
export interface SharedSourceInfo {
  name: string;
  kind: "screen" | "window";
  available: boolean;
}
export function HostStreamView({
  remoteId,
  isSharing,
  permissions,
  peerState,
  hostControlEnabled,
  source,
  onOpenAccess,
  onToggleControl,
  onDisconnect,
}: {
  remoteId: string;
  isSharing: boolean;
  localVideoRef: RefObject<HTMLVideoElement | null>;
  onSwitchToRealScreen: () => void;
  permissions: SessionPermissions;
  peerState: string;
  hostControlEnabled: boolean;
  source: SharedSourceInfo | null;
  onOpenAccess: () => void;
  onToggleControl: () => void;
  onDisconnect?: () => void;
}) {
  const connected = peerState === "connected",
    status = isSharing
      ? connected
        ? "Compartilhamento ativo"
        : "Preparando conexão"
      : peerState.startsWith("capture-")
        ? "Compartilhamento interrompido"
        : "Compartilhamento pausado";
  return (
    <section
      className="host-session-panel"
      aria-label="Painel da sessão recebida"
    >
      <div className="host-session-heading">
        <span className="host-session-symbol">
          <Radio size={26} />
        </span>
        <div>
          <p className="session-eyebrow">SESSÃO REMOTA</p>
          <h2>{status}</h2>
          <p>
            {isSharing
              ? "Você mantém o controle sobre o acesso a este computador."
              : "Escolha uma fonte disponível para continuar compartilhando."}
          </p>
        </div>
        <span className={"host-live-state " + (isSharing ? "is-live" : "")}>
          {isSharing ? "Transmitindo" : "Sem transmissão"}
        </span>
      </div>
      <div className="host-session-summary">
        <section className="host-source-summary">
          <div className="host-section-title">
            {source?.kind === "window" ? (
              <AppWindow size={20} />
            ) : (
              <Monitor size={20} />
            )}
            <h3>Fonte compartilhada</h3>
          </div>
          <strong className="host-source-name">
            {source?.name || "Verificando fonte…"}
          </strong>
          <p>
            {source?.kind === "window"
              ? "Aplicativo específico · uma janela"
              : "Monitor · uma tela por vez"}
          </p>
          {source && !source.available && (
            <p role="status" className="settings-error">
              Esta fonte não está mais disponível.
            </p>
          )}
          <button
            type="button"
            className="secondary-button"
            onClick={onOpenAccess}
          >
            Alterar fonte compartilhada
          </button>
        </section>
        <section>
          <div className="host-section-title">
            <ShieldCheck size={20} />
            <h3>Computador conectado</h3>
          </div>
          <strong className="host-peer-id font-mono">{remoteId}</strong>
          <p>
            {connected
              ? "Conexão estabelecida"
              : peerState === "failed"
                ? "Falha na conexão"
                : "Aguardando conexão de mídia"}
          </p>
          <ul className="host-permission-summary">
            <li>
              <span>Mouse e teclado</span>
              <strong>
                {permissions.control
                  ? hostControlEnabled
                    ? "Ativo"
                    : "Pausado"
                  : "Não autorizado"}
              </strong>
            </li>
            <li>
              <span>Clipboard</span>
              <strong>
                {permissions.clipboard ? "Permitido" : "Desativado"}
              </strong>
            </li>
            <li>
              <span>Arquivos</span>
              <strong>{permissions.files ? "Permitido" : "Desativado"}</strong>
            </li>
          </ul>
        </section>
      </div>
      <div className="host-quick-actions">
        <button
          type="button"
          className="secondary-button"
          disabled={!permissions.control || !isSharing}
          onClick={onToggleControl}
        >
          <MousePointer2 size={17} />
          {hostControlEnabled
            ? "Pausar controle remoto"
            : "Retomar controle autorizado"}
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={onOpenAccess}
        >
          <Settings2 size={17} />
          Tela e permissões
        </button>
        <button
          type="button"
          className="text-button host-end-sharing"
          onClick={onDisconnect}
        >
          <PhoneOff size={17} />
          Encerrar compartilhamento
        </button>
      </div>
      <p className="host-privacy-note">
        <ShieldCheck size={16} />
        Sem pré-visualização local. Apenas a fonte escolhida é transmitida; uma
        sessão de monitor permite alternar entre os monitores disponíveis. Você
        pode revogar recursos ou encerrar o acesso a qualquer momento.
      </p>
    </section>
  );
}
