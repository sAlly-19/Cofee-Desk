import { useEffect, useRef, useState } from "react";
import type {
  ConnectionDiagnostic,
  SessionPermissions,
} from "../../../shared/session";
import {
  Maximize2,
  Minimize2,
  PhoneOff,
  Keyboard,
  ClipboardList,
  FolderSync,
  Monitor,
  Flag,
  MoreHorizontal,
  Settings2,
  MousePointer2,
} from "lucide-react";
import type { FileTransferItem } from "@shared/types";
import { SessionDetails } from "./SessionDetails";
import type { MonitorInfo } from "../../hooks/useRemoteMonitors";
interface Props {
  remoteId: string;
  permissions: SessionPermissions;
  role: "host" | "client";
  peerState: string;
  isKeyboardFocused: boolean;
  isFullscreen: boolean;
  hostControlEnabled: boolean;
  activeDrawer?: "clipboard" | "files" | null;
  activeTransfer?: FileTransferItem;
  monitors?: {
    monitors: MonitorInfo[];
    pending: boolean;
    request: (id: string) => void;
  };
  diagnostic: ConnectionDiagnostic;
  onFocusVideo: () => void;
  onOpenAccess?: () => void;
  onToggleFullscreen: () => void;
  onToggleHostControl: () => void;
  onToggleDrawer?: (tab: "clipboard" | "files") => void;
  onReport?: () => void;
  onDisconnect?: () => void;
}
export function RemoteToolbar(p: Props) {
  const [more, setMore] = useState(false),
    root = useRef<HTMLDivElement>(null),
    moreButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!more) return;
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setMore(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setMore(false);
        moreButton.current?.focus();
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", key, true);
    };
  }, [more]);
  const status =
    p.peerState === "connected"
      ? "Conectado"
      : p.peerState === "failed"
        ? "Falha na conexão"
        : p.peerState.startsWith("capture-")
          ? "Captura interrompida"
          : p.peerState === "disconnected"
            ? "Conexão interrompida"
            : "Conectando";
  return (
    <header className="session-toolbar" aria-label="Controles da sessão">
      <div className="session-identity">
        <span
          className={
            "session-status-dot " +
            (p.peerState === "connected" ? "is-online" : "")
          }
          aria-hidden="true"
        />
        <div>
          <strong>
            {p.role === "host" ? "Sessão recebida" : "Acesso remoto"}
          </strong>
          <span className="font-mono">{p.remoteId}</span>
        </div>
        <small role="status">{status}</small>
      </div>
      {p.role === "client" && p.monitors && p.monitors.monitors.length >= 2 && (
        <label className="toolbar-monitor">
          <Monitor size={16} />
          <span className="sr-only">Monitor remoto</span>
          <select
            aria-label="Monitor remoto"
            disabled={p.monitors.pending}
            value={p.monitors.monitors.find((m) => m.selected)?.id || ""}
            onChange={(e) => p.monitors?.request(e.target.value)}
          >
            {!p.monitors.monitors.some((m) => m.selected) && (
              <option value="">Selecione um monitor</option>
            )}
            {p.monitors.monitors.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          {p.monitors.pending && <small role="status">Trocando…</small>}
        </label>
      )}
      <div className="session-tools">
        {p.role === "client" ? (
          <button
            type="button"
            className="session-tool session-keyboard"
            disabled={!p.permissions.control}
            onClick={p.onFocusVideo}
            title="Focar o vídeo para digitar na máquina remota"
          >
            <Keyboard size={16} />
            <span>
              {p.isKeyboardFocused ? "Teclado ativo" : "Clique p/ Digitar"}
            </span>
          </button>
        ) : (
          <button
            type="button"
            className={
              "session-tool " + (p.hostControlEnabled ? "is-active" : "")
            }
            disabled={!p.permissions.control}
            aria-pressed={p.hostControlEnabled}
            onClick={p.onToggleHostControl}
            title="Pausar ou retomar a entrada remota autorizada"
          >
            <MousePointer2 size={16} />
            <span>
              {p.hostControlEnabled ? "Controle: Ativo" : "Controle: Pausado"}
            </span>
          </button>
        )}
        {p.onToggleDrawer && (
          <>
            <button
              type="button"
              className={
                "session-tool " +
                (p.activeDrawer === "clipboard" ? "is-active" : "")
              }
              title="Área de Transferência Compartilhada"
              disabled={!p.permissions.clipboard}
              onClick={() => p.onToggleDrawer?.("clipboard")}
            >
              <ClipboardList size={16} />
              <span>Clipboard</span>
            </button>
            <button
              type="button"
              className={
                "session-tool " +
                (p.activeDrawer === "files" ? "is-active" : "")
              }
              title="Transferência de Arquivos"
              disabled={!p.permissions.files}
              onClick={() => p.onToggleDrawer?.("files")}
            >
              <FolderSync size={16} />
              <span>
                Arquivos
                {p.activeTransfer
                  ? " · " + Math.round(p.activeTransfer.progress) + "%"
                  : ""}
              </span>
            </button>
          </>
        )}
        {p.role === "host" && (
          <button
            type="button"
            className="session-tool"
            onClick={p.onOpenAccess}
            title="Tela e permissões"
          >
            <Settings2 size={17} />
            <span>Tela e permissões</span>
          </button>
        )}
        <SessionDetails remoteId={p.remoteId} diagnostic={p.diagnostic} />
        <div className="session-secondary-actions" ref={root}>
          <button
            type="button"
            ref={moreButton}
            className="session-tool session-more"
            aria-label="Mais ações da sessão"
            title="Mais ações"
            aria-expanded={more}
            onClick={() => setMore(!more)}
          >
            <MoreHorizontal size={18} />
          </button>
          <div className={"session-secondary-list " + (more ? "is-open" : "")}>
            <button
              type="button"
              className="session-tool"
              title={p.isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
              onClick={() => {
                setMore(false);
                p.onToggleFullscreen();
              }}
            >
              {p.isFullscreen ? (
                <Minimize2 size={17} />
              ) : (
                <Maximize2 size={17} />
              )}
              <span className="secondary-action-label">Tela cheia</span>
            </button>
            {p.onReport && (
              <button
                type="button"
                className="session-tool session-report"
                title="Denunciar dispositivo"
                onClick={() => {
                  setMore(false);
                  p.onReport?.();
                }}
              >
                <Flag size={16} />
                <span>Denunciar</span>
              </button>
            )}
          </div>
        </div>
        <button
          type="button"
          className="session-tool session-disconnect"
          onClick={p.onDisconnect}
          title="Desconectar"
        >
          <PhoneOff size={16} />
          <span>Desconectar</span>
        </button>
      </div>
    </header>
  );
}
