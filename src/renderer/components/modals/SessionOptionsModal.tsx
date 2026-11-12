import {
  Monitor,
  Play,
  KeyRound,
  Edit3,
  Copy,
  Trash2,
  Star,
} from "lucide-react";
import { Modal } from "../ui/Modal";
import { useModal } from "../../context/ModalContext";
import type { RecentSession } from "../../types/app";

interface SessionOptionsModalProps {
  selectedSession: RecentSession | null;
  onClose: () => void;
  onConnectDirect: (remoteId: string) => void;
  onConnectWithPassword: (remoteId: string, password: string) => void;
  onRename: (id: string, newName: string) => void;
  onReport: (remoteId: string) => void;
  onDelete: (id: string) => void;
  isFavorite: boolean;
  onToggleFavorite: (session: RecentSession) => void;
  canDeleteFromHistory: boolean;
}

export function SessionOptionsModal({
  selectedSession,
  onClose,
  onConnectDirect,
  onConnectWithPassword,
  onRename,
  onReport,
  onDelete,
  isFavorite,
  onToggleFavorite,
  canDeleteFromHistory,
}: SessionOptionsModalProps): JSX.Element | null {
  const { showPrompt, showConfirm, showToast } = useModal();

  if (!selectedSession) return null;

  return (
    <Modal
      isOpen={!!selectedSession}
      onClose={onClose}
      title={selectedSession.name || "Opções da Máquina"}
      subtitle={`ID Remoto: ${selectedSession.remoteId}`}
      icon={<Monitor size={20} color="var(--accent-primary, #C77B3B)" />}
      maxWidth={460}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
        <button
          className="secondary-button favorite-option"
          aria-pressed={isFavorite}
          onClick={() => onToggleFavorite(selectedSession)}
        >
          <Star size={18} fill={isFavorite ? "currentColor" : "none"} />
          {isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        </button>
        <button
          className="secondary-button report-button"
          onClick={() => {
            onReport(selectedSession.remoteId);
            onClose();
          }}
        >
          Denunciar dispositivo
        </button>
        <button
          onClick={() => {
            const id = selectedSession.remoteId;
            onClose();
            onConnectDirect(id);
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            width: "100%",
            padding: "0.8rem 1rem",
            background:
              "var(--accent-gradient, linear-gradient(135deg, #C77B3B 0%, #A85D26 100%))",
            border: "none",
            borderRadius: "10px",
            color: "var(--text-primary, #F4EAE0)",
            fontSize: "0.9rem",
            fontWeight: 600,
            cursor: "pointer",
            textAlign: "left",
            boxShadow:
              "var(--shadow-button, 0 4px 14px rgba(199, 123, 59, 0.25))",
          }}
        >
          <Play size={14} fill="currentColor" />
          <span>Conectar Diretamente</span>
        </button>

        <button
          onClick={async () => {
            const s = selectedSession;
            onClose();
            const pwd = await showPrompt({
              title: "Acesso Não Supervisionado",
              message: `Informe a senha pré-definida de ${s.name}:`,
              inputType: "password",
              placeholder: "Senha de acesso fixo",
              confirmText: "Conectar",
              cancelText: "Cancelar",
            });
            if (pwd) {
              onConnectWithPassword(s.remoteId, pwd);
            }
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            width: "100%",
            padding: "0.8rem 1rem",
            backgroundColor: "var(--bg-input, #1C110E)",
            border: "1px solid var(--border-subtle, #39241C)",
            borderRadius: "10px",
            color: "var(--text-primary, #F4EAE0)",
            fontSize: "0.88rem",
            fontWeight: 500,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <KeyRound size={16} color="var(--accent-primary, #C77B3B)" />
          <span>Conectar com Senha (Não Supervisionado)</span>
        </button>

        <button
          onClick={async () => {
            const s = selectedSession;
            onClose();
            const newName = await showPrompt({
              title: "Renomear Máquina",
              message:
                "Novo nome para identificar este computador no histórico:",
              defaultValue: s.name,
              confirmText: "Salvar",
              cancelText: "Cancelar",
            });
            if (newName && newName.trim()) {
              onRename(s.remoteId, newName.trim());
            }
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            width: "100%",
            padding: "0.8rem 1rem",
            backgroundColor: "var(--bg-input, #1C110E)",
            border: "1px solid var(--border-subtle, #39241C)",
            borderRadius: "10px",
            color: "var(--text-primary, #F4EAE0)",
            fontSize: "0.88rem",
            fontWeight: 500,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <Edit3 size={16} color="var(--accent-soft, #E5A96D)" />
          <span>Renomear Máquina</span>
        </button>

        <button
          onClick={async () => {
            const s = selectedSession;
            onClose();
            try {
              await navigator.clipboard.writeText(s.remoteId);
              showToast({ type: "success", message: "ID remoto copiado!" });
            } catch {
              showToast({
                type: "error",
                message: "Não foi possível copiar o ID remoto.",
              });
            }
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            width: "100%",
            padding: "0.8rem 1rem",
            backgroundColor: "var(--bg-input, #1C110E)",
            border: "1px solid var(--border-subtle, #39241C)",
            borderRadius: "10px",
            color: "var(--text-primary, #F4EAE0)",
            fontSize: "0.88rem",
            fontWeight: 500,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <Copy size={16} color="var(--accent-soft, #E5A96D)" />
          <span>Copiar ID Remoto</span>
        </button>

        {canDeleteFromHistory && (
          <button
            onClick={async () => {
              const s = selectedSession;
              onClose();
              const confirmed = await showConfirm({
                title: "Remover do Histórico",
                message: `Deseja remover "${s.name}" (${s.remoteId}) do histórico de sessões recentes?`,
                type: "warning",
                destructive: true,
                confirmText: "Remover",
                cancelText: "Cancelar",
              });
              if (confirmed) {
                onDelete(s.remoteId);
              }
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              width: "100%",
              padding: "0.8rem 1rem",
              backgroundColor: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              borderRadius: "10px",
              color: "#f87171",
              fontSize: "0.88rem",
              fontWeight: 500,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <Trash2 size={16} color="#f87171" />
            <span>Excluir do Histórico</span>
          </button>
        )}
      </div>
    </Modal>
  );
}
