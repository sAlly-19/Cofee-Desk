import type { DesktopSource } from "../../../shared/types";
import type { SharedSourceInfo } from "./HostStreamView";
import { useRemoteMonitors } from "../../hooks/useRemoteMonitors";
import { useClipboardFiles } from "../../hooks/useClipboardFiles";
import { useSessionClipboard } from "../../hooks/useSessionClipboard";
import type { SessionPermissions } from "../../../shared/session";
import { SourcePicker } from "./SourcePicker";
import { PermissionsFields } from "./PermissionsFields";
import { Modal } from "../ui/Modal";
import { useRef, useState, useEffect } from "react";
import { X, ClipboardList, FolderSync } from "lucide-react";
import { RemoteStreamView } from "../RemoteStreamView";
import { ClipboardSync } from "../ClipboardSync";
import { FileTransfer } from "../FileTransfer";
import { useFileTransfer } from "../../hooks/useFileTransfer";
import type { SessionRole } from "../../types/app";

interface ActiveSessionContainerProps {
  connectionId: string;
  permissions: SessionPermissions;
  sourceKind: "screen" | "window";
  onUpdatePermissions: (
    p: SessionPermissions,
    kind?: "screen" | "window",
  ) => Promise<void>;
  remoteId: string;
  role: SessionRole;
  onRemoteInput: (input: any) => void;
  onSendSignalingMessage: (
    type: "offer" | "answer" | "ice-candidate",
    payload: unknown,
  ) => void;
  onReport?: () => void;
  onRequestDisconnect: () => void;
}

export function ActiveSessionContainer({
  connectionId,
  permissions,
  sourceKind,
  onUpdatePermissions,
  remoteId,
  role,
  onRemoteInput,
  onSendSignalingMessage,
  onReport,
  onRequestDisconnect,
}: ActiveSessionContainerProps): JSX.Element {
  const [showAccess, setShowAccess] = useState(false),
    [source, setSource] = useState("");
  const [newKind, setNewKind] = useState<"screen" | "window">(sourceKind);
  const [sourceValid, setSourceValid] = useState(false);
  const [sourceError, setSourceError] = useState("");
  const [sourceBusy, setSourceBusy] = useState(false),
    [permissionBusy, setPermissionBusy] = useState(false);
  const [sourceInfo, setSourceInfo] = useState<SharedSourceInfo | null>(null);
  useEffect(() => {
    if (role !== "host") return;
    let active = true;
    const refresh = async () => {
      try {
        const selected = await window.electronAPI.getCaptureSelection();
        const sources: DesktopSource[] =
          await window.electronAPI.getDesktopSources();
        if (!active) return;
        const actual = sources.find((s) => s.id === selected?.sourceId);
        setSourceInfo((previous) =>
          selected
            ? {
                name: actual?.name || "Fonte indisponível",
                kind: selected.kind,
                available: !!actual,
              }
            : previous
              ? { ...previous, available: false }
              : null,
        );
      } catch {
        /* No fabricated source on enumeration errors. */
      }
    };
    void refresh();
    window.addEventListener("capture-source-changed", refresh);
    const timer = setInterval(() => void refresh(), 5000);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("capture-source-changed", refresh);
    };
  }, [role, showAccess]);
  const [mouseMode, setMouseMode] = useState<"virtual" | "shared">("virtual");
  const [activeDrawer, setActiveDrawer] = useState<
    "clipboard" | "files" | null
  >(null);
  const [filesDataChannel, setFilesDataChannel] =
    useState<RTCDataChannel | null>(null);

  const openAccess = async () => {
    setSourceValid(false);
    setSourceError("");
    try {
      const selected = await window.electronAPI.getCaptureSelection();
      setSource(selected?.sourceId || "");
      setNewKind(selected?.kind || sourceKind);
      setShowAccess(true);
    } catch {
      setSourceError("Não foi possível consultar a fonte atual.");
      setShowAccess(true);
    }
  };
  const applyCaptureChange = () =>
    new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("A captura não confirmou a troca.")),
        20000,
      );
      window.dispatchEvent(
        new CustomEvent("capture-source-change-request", {
          detail: {
            resolve: () => {
              clearTimeout(timer);
              window.dispatchEvent(new Event("capture-source-changed"));
              resolve();
            },
            reject: () => {
              clearTimeout(timer);
              reject(new Error("Falha na captura selecionada."));
            },
          },
        }),
      );
    });
  const changingSource = useRef(false);
  const changeSource = async (id: string, kind: "screen" | "window") => {
    if (changingSource.current)
      throw new Error("Uma troca de fonte já está em andamento.");
    changingSource.current = true;
    setSourceBusy(true);
    let prepared = false;
    try {
      await window.electronAPI.startDesktopStream(id);
      prepared = true;
      await onUpdatePermissions(
        { ...permissions, control: kind === "screen" && permissions.control },
        kind,
      );
      await applyCaptureChange();
    } catch (error) {
      if (prepared) {
        window.dispatchEvent(new Event("capture-pause-request"));
        await window.electronAPI.stopDesktopStream().catch(() => {});
      }
      throw error;
    } finally {
      changingSource.current = false;
      setSourceBusy(false);
    }
  };
  const monitors = useRemoteMonitors(filesDataChannel, role, (id) =>
    changeSource(id, "screen"),
  );
  const clipboard = useSessionClipboard({
    isConnected: true,
    dataChannel: filesDataChannel,
    allowed: permissions.clipboard,
  });
  // Hook central de transferência de arquivos P2P com fila e flow control
  const {
    transfers,
    isSending,
    activeTransfer,
    sendFiles,
    cancelTransfer,
    removeTransfer,
    clearCompleted,
  } = useFileTransfer(
    filesDataChannel,
    permissions.files,
    permissions.clipboard && clipboard.automatic,
  );

  useClipboardFiles(
    filesDataChannel,
    permissions.files &&
      permissions.clipboard &&
      clipboard.automatic &&
      !isSending,
    sendFiles,
  );
  useEffect(() => {
    if (activeDrawer && !permissions[activeDrawer]) setActiveDrawer(null);
  }, [permissions, activeDrawer]);
  const toggleDrawer = (tab: "clipboard" | "files") => {
    if (!permissions[tab]) return;
    setActiveDrawer((prev) => (prev === tab ? null : tab));
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#040201",
      }}
    >
      <Modal
        isOpen={showAccess}
        onClose={() => setShowAccess(false)}
        title="Tela e permissões"
        subtitle="Escolha a fonte e gerencie o acesso a este computador."
        maxWidth={700}
        footer={
          <button
            className="primary-button"
            disabled={!source || !sourceValid || sourceBusy || permissionBusy}
            onClick={async () => {
              if (sourceBusy) return;
              setSourceBusy(true);
              setSourceError("");
              try {
                await changeSource(source, newKind);
                setShowAccess(false);
              } catch {
                setSourceError(
                  "Não foi possível atualizar o compartilhamento. Verifique a fonte e tente novamente.",
                );
              } finally {
                setSourceBusy(false);
              }
            }}
          >
            {sourceBusy ? "Atualizando…" : "Atualizar compartilhamento"}
          </button>
        }
      >
        <SourcePicker
          onValidityChange={setSourceValid}
          value={source}
          disabled={sourceBusy || permissionBusy}
          onChange={(id, kind) => {
            setSource(id);
            setNewKind(kind);
            setSourceError("");
          }}
        />
        <PermissionsFields
          value={permissions}
          disabled={permissionBusy || sourceBusy}
          windowOnly={newKind === "window"}
          onChange={async (p) => {
            setPermissionBusy(true);
            setSourceError("");
            try {
              await onUpdatePermissions(p);
            } catch {
              setSourceError(
                "Não foi possível confirmar as permissões. Tente novamente.",
              );
            } finally {
              setPermissionBusy(false);
            }
          }}
        />
        <details className="session-advanced">
          <summary>Compatibilidade do mouse</summary>
          <label className="mouse-mode-choice">
            Mouse do anfitrião
            <select
              aria-label="Modo do mouse remoto"
              value={mouseMode}
              onChange={async (e) => {
                try {
                  const mode = e.target.value as "virtual" | "shared";
                  await window.electronAPI.setMouseMode(mode);
                  setMouseMode(mode);
                } catch {
                  setSourceError("Não foi possível alterar o modo do mouse.");
                }
              }}
            >
              <option value="virtual">
                Ponteiro independente (experimental)
              </option>
              <option value="shared">Cursor compartilhado do Windows</option>
            </select>
            <small>
              O modo independente envia mensagens às janelas sem mover o cursor
              do Windows. Alguns programas não aceitam esse tipo de controle. O
              teclado continua usando o foco da área de trabalho.
            </small>
          </label>
        </details>
        {sourceError && (
          <p role="alert" className="settings-error">
            {sourceError}
          </p>
        )}
      </Modal>
      {/* 100% Immersive Remote Stream Viewport */}
      <div
        style={{
          flex: 1,
          width: "100%",
          height: "100%",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <RemoteStreamView
          sourceInfo={sourceInfo}
          monitors={monitors}
          onOpenAccess={() => void openAccess()}
          connectionId={connectionId}
          permissions={permissions}
          remoteId={remoteId}
          isConnected={true}
          role={role}
          onRemoteInput={onRemoteInput}
          onSendSignalingMessage={onSendSignalingMessage}
          onReport={onReport}
          onDisconnect={onRequestDisconnect}
          onToggleDrawer={toggleDrawer}
          activeDrawer={activeDrawer}
          onFilesChannelReady={setFilesDataChannel}
          onFilesDropped={sendFiles}
          activeTransfer={activeTransfer}
        />
      </div>

      {/* Slide-over Glass Drawer (Clipboard e Arquivos sem espremer o vídeo) */}
      {activeDrawer && (
        <div
          className="session-drawer"
          style={{
            position: "absolute",
            top: 48,
            right: 0,
            bottom: 0,
            width: 480,
            maxWidth: "92%",
            backgroundColor: "rgba(10, 5, 3, 0.92)",
            backdropFilter: "blur(30px)",
            borderLeft: "1px solid var(--border-subtle)",
            boxShadow: "-16px 0 50px rgba(0, 0, 0, 0.85)",
            zIndex: 40,
            display: "flex",
            flexDirection: "column",
            animation: "cd-slide-drawer 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          {/* Header da Gaveta */}
          <div
            style={{
              padding: "0.85rem 1.25rem",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: "rgba(18, 10, 6, 0.75)",
            }}
          >
            <div
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              <button
                disabled={!permissions.clipboard}
                onClick={() => setActiveDrawer("clipboard")}
                className="cd-btn-tactile"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "0.45rem 0.95rem",
                  borderRadius: "10px",
                  backgroundColor:
                    activeDrawer === "clipboard"
                      ? "var(--cd-primary)"
                      : "rgba(255, 255, 255, 0.06)",
                  color:
                    activeDrawer === "clipboard"
                      ? "var(--text-primary)"
                      : "rgba(255, 235, 220, 0.7)",
                  fontWeight: 700,
                  fontSize: "0.82rem",
                  cursor: "pointer",
                  border: "none",
                }}
              >
                <ClipboardList size={14} />
                <span>Clipboard</span>
              </button>

              <button
                disabled={!permissions.files}
                onClick={() => setActiveDrawer("files")}
                className="cd-btn-tactile"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "0.45rem 0.95rem",
                  borderRadius: "10px",
                  backgroundColor:
                    activeDrawer === "files"
                      ? "var(--cd-primary)"
                      : "rgba(255, 255, 255, 0.06)",
                  color:
                    activeDrawer === "files"
                      ? "var(--text-primary)"
                      : "rgba(255, 235, 220, 0.7)",
                  fontWeight: 700,
                  fontSize: "0.82rem",
                  cursor: "pointer",
                  border: "none",
                }}
              >
                <FolderSync
                  size={14}
                  className={activeTransfer ? "cd-spin" : undefined}
                />
                <span>Arquivos</span>
                {transfers.length > 0 && (
                  <span
                    style={{
                      fontSize: "0.7rem",
                      padding: "1px 6px",
                      borderRadius: "10px",
                      backgroundColor: activeTransfer
                        ? "var(--accent-primary)"
                        : "rgba(255, 255, 255, 0.15)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {transfers.length}
                  </span>
                )}
              </button>
            </div>

            <button
              onClick={() => setActiveDrawer(null)}
              className="cd-btn-tactile"
              title="Fechar painel"
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.08)",
                border: "none",
                color: "var(--text-primary)",
                padding: "6px",
                borderRadius: "8px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Conteúdo Rolável da Gaveta */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "1.25rem",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {activeDrawer === "clipboard" ? (
              <ClipboardSync model={clipboard} />
            ) : (
              <FileTransfer
                connectionId={connectionId}
                isConnected={true}
                transfers={transfers}
                isSending={isSending}
                onSendFiles={sendFiles}
                onCancelTransfer={cancelTransfer}
                onRemoveTransfer={removeTransfer}
                onClearCompleted={clearCompleted}
                isChannelReady={!!filesDataChannel}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
