import type { SessionPermissions } from "../../../shared/session";
import {
  Maximize2,
  Minimize2,
  PhoneOff,
  Keyboard,
  ClipboardList,
  FolderSync,
  MousePointer2,
} from "lucide-react";
import type { FileTransferItem } from "@shared/types";
import { formatSpeed } from "../../hooks/useFileTransfer";

interface RemoteToolbarProps {
  mouseCaptured?: boolean;
  onToggleMouseCapture?: () => void;
  remoteId: string;
  permissions: SessionPermissions;
  role: "host" | "client";
  peerState: string;
  isKeyboardFocused: boolean;
  isFullscreen: boolean;
  hostControlEnabled: boolean;
  activeDrawer?: "clipboard" | "files" | null;
  activeTransfer?: FileTransferItem;
  onToggleFullscreen: () => void;
  onToggleHostControl: () => void;
  onToggleDrawer?: (tab: "clipboard" | "files") => void;
  onReport?: () => void;
  onDisconnect?: () => void;
}

export function RemoteToolbar({
  mouseCaptured,
  onToggleMouseCapture,
  remoteId,
  permissions,
  role,
  peerState,
  isKeyboardFocused,
  isFullscreen,
  hostControlEnabled,
  activeDrawer,
  activeTransfer,
  onToggleFullscreen,
  onToggleHostControl,
  onToggleDrawer,
  onReport,
  onDisconnect,
}: RemoteToolbarProps): JSX.Element {
  return (
    <div
      className="session-toolbar"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 48,
        backgroundColor: "rgba(12, 7, 4, 0.85)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid rgba(255, 140, 26, 0.15)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 1rem",
        zIndex: 20,
      }}
    >
      {/* Lado Esquerdo: Identificação e Status da Sessão */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "3px 10px",
            borderRadius: "20px",
            backgroundColor: "var(--accent-subtle)",
            border: "1px solid var(--border-warm)",
            fontSize: "0.75rem",
            color: "var(--text-primary)",
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              backgroundColor:
                peerState === "connected" ? "#22c55e" : "#f59e0b",
              boxShadow:
                peerState === "connected"
                  ? "0 0 8px #22c55e"
                  : "0 0 8px #f59e0b",
            }}
          />
          <span>
            {role === "host"
              ? "Compartilhando sua tela"
              : `Controlando: ${remoteId}`}{" "}
            • {peerState}
          </span>
        </div>
      </div>

      {/* Lado Direito: Ações e Ferramentas */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        {/* Toggle de permissão de controle remoto pelo Host */}
        {role === "host" && (
          <button
            disabled={!permissions.control}
            onClick={onToggleHostControl}
            title={
              hostControlEnabled
                ? "Clique para pausar o controle remoto do visitante"
                : "Clique para reativar o controle remoto"
            }
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              backgroundColor: hostControlEnabled
                ? "rgba(34, 197, 94, 0.15)"
                : "rgba(239, 68, 68, 0.15)",
              border: `1px solid ${hostControlEnabled ? "#22c55e" : "#ef4444"}`,
              color: hostControlEnabled ? "#22c55e" : "#ef4444",
              borderRadius: "8px",
              padding: "0.4rem 0.75rem",
              fontSize: "0.78rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <span>
              {hostControlEnabled ? "Controle: Ativo" : "Controle: Pausado"}
            </span>
          </button>
        )}

        {role === "client" && (
          <button
            className="mouse-capture-button"
            disabled={!permissions.control}
            aria-pressed={mouseCaptured}
            title="Prender o mouse à sessão. Pressione Esc para liberar."
            onClick={onToggleMouseCapture}
          >
            <MousePointer2 size={15} />
            <span>
              {mouseCaptured ? "Mouse capturado · Esc" : "Capturar mouse"}
            </span>
          </button>
        )}
        {/* Indicador de foco de teclado no Client */}
        {role === "client" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "0.4rem 0.75rem",
              borderRadius: "8px",
              backgroundColor: isKeyboardFocused
                ? "rgba(34, 197, 94, 0.15)"
                : "var(--accent-subtle)",
              border: `1px solid ${
                isKeyboardFocused ? "#22c55e" : "rgba(255, 140, 26, 0.3)"
              }`,
              fontSize: "0.78rem",
              color: isKeyboardFocused ? "#22c55e" : "var(--accent-soft)",
              fontWeight: 600,
            }}
          >
            <Keyboard size={14} />
            <span>
              {isKeyboardFocused ? "Teclado Ativo" : "Clique p/ Digitar"}
            </span>
          </div>
        )}

        {/* Pill flutuante de progresso de arquivo ativo na barra */}
        {activeTransfer && (
          <button
            onClick={() => onToggleDrawer?.("files")}
            className="cd-btn-tactile"
            title="Clique para ver o painel de transferência de arquivos"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              backgroundColor: "var(--accent-subtle)",
              border: "1px solid var(--border-warm)",
              color: "var(--text-primary)",
              borderRadius: "8px",
              padding: "0.4rem 0.75rem",
              fontSize: "0.76rem",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "none",
            }}
          >
            <FolderSync
              size={13}
              color="var(--accent-soft)"
              className="cd-spin"
            />
            <span
              style={{
                maxWidth: 110,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {activeTransfer.fileName}
            </span>
            <span style={{ color: "var(--accent-primary)", fontWeight: 800 }}>
              {activeTransfer.progress}%
            </span>
            {activeTransfer.speedBytesPerSec !== undefined &&
              activeTransfer.speedBytesPerSec > 0 && (
                <span style={{ color: "#22c55e", fontSize: "0.7rem" }}>
                  ({formatSpeed(activeTransfer.speedBytesPerSec)})
                </span>
              )}
          </button>
        )}

        {/* Botões para Gavetas Flutuantes de Clipboard e Arquivos */}
        {onToggleDrawer && (
          <>
            <button
              disabled={!permissions.clipboard}
              onClick={() => onToggleDrawer("clipboard")}
              title="Área de Transferência Compartilhada"
              className="cd-btn-tactile"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                backgroundColor:
                  activeDrawer === "clipboard"
                    ? "var(--accent-subtle)"
                    : "rgba(255, 255, 255, 0.08)",
                border: `1px solid ${
                  activeDrawer === "clipboard"
                    ? "var(--accent-primary)"
                    : "rgba(255, 255, 255, 0.14)"
                }`,
                color: "var(--text-primary)",
                borderRadius: "8px",
                padding: "0.4rem 0.75rem",
                fontSize: "0.78rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <ClipboardList
                size={14}
                color={
                  activeDrawer === "clipboard"
                    ? "var(--accent-soft)"
                    : "var(--text-primary)"
                }
              />
              <span>Clipboard</span>
            </button>

            <button
              disabled={!permissions.files}
              onClick={() => onToggleDrawer("files")}
              title="Transferência de Arquivos"
              className="cd-btn-tactile"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                backgroundColor:
                  activeDrawer === "files"
                    ? "var(--accent-subtle)"
                    : "rgba(255, 255, 255, 0.08)",
                border: `1px solid ${
                  activeDrawer === "files"
                    ? "var(--accent-primary)"
                    : "rgba(255, 255, 255, 0.14)"
                }`,
                color: "var(--text-primary)",
                borderRadius: "8px",
                padding: "0.4rem 0.75rem",
                fontSize: "0.78rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <FolderSync
                size={14}
                color={
                  activeDrawer === "files"
                    ? "var(--accent-soft)"
                    : "var(--text-primary)"
                }
              />
              <span>Arquivos</span>
            </button>
          </>
        )}

        <button
          onClick={onToggleFullscreen}
          title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.08)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            color: "var(--text-primary)",
            borderRadius: "8px",
            padding: "0.4rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
          }}
        >
          {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>

        {onReport && (
          <button
            className="secondary-button session-report"
            onClick={onReport}
          >
            Denunciar
          </button>
        )}
        {onDisconnect && (
          <button
            onClick={onDisconnect}
            className="cd-btn-tactile"
            style={{
              backgroundColor: "#ef4444",
              border: "none",
              color: "var(--text-primary)",
              borderRadius: "8px",
              padding: "0.4rem 0.75rem",
              fontWeight: 700,
              fontSize: "0.78rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              backdropFilter: "blur(8px)",
              boxShadow: "0 2px 10px rgba(239, 68, 68, 0.4)",
            }}
          >
            <PhoneOff size={14} />
            <span>Desconectar</span>
          </button>
        )}
      </div>
    </div>
  );
}
