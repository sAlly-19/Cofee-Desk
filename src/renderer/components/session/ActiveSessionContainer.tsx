import { useSessionClipboard } from "../../hooks/useSessionClipboard";
import type { SessionPermissions } from "../../../shared/session";
import { SourcePicker } from "./SourcePicker";
import { PermissionsFields } from "./PermissionsFields";
import { Modal } from "../ui/Modal";
import { useState, useEffect } from "react";
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
  const [sourceError, setSourceError] = useState("");
  const [activeDrawer, setActiveDrawer] = useState<
    "clipboard" | "files" | null
  >(null);
  const [filesDataChannel, setFilesDataChannel] =
    useState<RTCDataChannel | null>(null);

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
  } = useFileTransfer(filesDataChannel, permissions.files);

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
      {role === "host" && (
        <button
          className="session-access-button secondary-button"
          onClick={() => setShowAccess(true)}
        >
          Tela e permissões
        </button>
      )}
      <Modal
        isOpen={showAccess}
        onClose={() => setShowAccess(false)}
        title="Tela e permissões"
        subtitle="Você pode revogar recursos a qualquer momento."
      >
        <PermissionsFields
          value={permissions}
          windowOnly={sourceKind === "window"}
          onChange={(p) => void onUpdatePermissions(p)}
        />
        <SourcePicker
          value={source}
          onChange={(id, kind) => {
            setSource(id);
            setNewKind(kind);
          }}
        />
        {sourceError && <p role="alert">{sourceError}</p>}
        <button
          className="primary-button"
          disabled={!source}
          onClick={async () => {
            try {
              await window.electronAPI.startDesktopStream(source);
              await onUpdatePermissions(
                {
                  ...permissions,
                  control: newKind === "screen" && permissions.control,
                },
                newKind,
              );
              window.dispatchEvent(new Event("capture-source-changed"));
              setShowAccess(false);
            } catch {
              setSourceError(
                "Não foi possível trocar a fonte. Atualize a lista e tente novamente.",
              );
            }
          }}
        >
          Compartilhar fonte selecionada
        </button>
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
