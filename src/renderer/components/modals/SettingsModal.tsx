import { PermissionsFields } from "../session/PermissionsFields";
import type { SessionPermissions } from "../../../shared/session";
import { useEffect, useRef, useState } from "react";
import {
  Settings,
  Trash2,
  KeyRound,
  RefreshCw,
  ChevronRight,
} from "lucide-react";
import { Modal } from "../ui/Modal";

interface SettingsModalProps {
  isOpen: boolean;
  focusPassword?: boolean;
  onClose: () => void;
  unattendedEnabled: boolean;
  setUnattendedEnabled: (enabled: boolean) => void;
  unattendedPassword: string;
  setUnattendedPassword: (password: string) => void;
  onResetIdentity: () => void;
  onSave: () => void;
  unattendedPermissions: SessionPermissions;
  setUnattendedPermissions: (p: SessionPermissions) => void;
  onCheckUpdates: () => void;
}

export function SettingsModal({
  isOpen,
  focusPassword = false,
  onClose,
  unattendedEnabled,
  setUnattendedEnabled,
  unattendedPassword,
  setUnattendedPassword,
  onResetIdentity,
  onSave,
  unattendedPermissions,
  setUnattendedPermissions,
  onCheckUpdates,
}: SettingsModalProps): JSX.Element | null {
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (isOpen) {
      setSaveError("");
    }
  }, [isOpen]);
  const passwordRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (isOpen && focusPassword) passwordRef.current?.focus();
  }, [isOpen, focusPassword]);
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Configurações do Coffee Desk"
      subtitle="Segurança, identidade e preferências de conexão remota"
      icon={<Settings size={20} color="var(--accent-primary, #C77B3B)" />}
      footer={
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            width: "100%",
            alignItems: "center",
          }}
        >
          <button
            onClick={onResetIdentity}
            style={{
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#f87171",
              borderRadius: "8px",
              padding: "0.65rem 1rem",
              fontSize: "0.85rem",
              fontWeight: 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Trash2 size={15} />
            <span>Redefinir Preferências</span>
          </button>

          <button
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              setSaveError("");
              try {
                await window.electronAPI.setAccessPassword(
                  unattendedPassword,
                  unattendedEnabled,
                  unattendedPermissions,
                );
                setUnattendedPassword("");
                onSave();
              } catch (e) {
                setSaveError((e as Error).message);
              } finally {
                setSaving(false);
              }
            }}
            style={{
              padding: "0.65rem 1.4rem",
              background:
                "var(--accent-gradient, linear-gradient(135deg, #C77B3B 0%, #A85D26 100%))",
              border: "none",
              borderRadius: "8px",
              color: "var(--text-primary, #F4EAE0)",
              fontWeight: 600,
              fontSize: "0.88rem",
              cursor: "pointer",
              boxShadow:
                "var(--shadow-button, 0 4px 14px rgba(199, 123, 59, 0.3))",
            }}
          >
            Salvar e Fechar
          </button>
        </div>
      }
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem",
          color: "var(--text-primary, #F4EAE0)",
          fontSize: "0.9rem",
        }}
      >
        {saveError && (
          <div role="alert" className="settings-error">
            {saveError}
          </div>
        )}
        <button
          type="button"
          className="settings-update-button"
          onClick={onCheckUpdates}
        >
          <span className="settings-update-icon">
            <RefreshCw size={20} aria-hidden="true" />
          </span>
          <span className="settings-update-copy">
            <strong>Verificar atualizações</strong>
            <span>Mantenha seu Coffee Desk em dia.</span>
          </span>
          <ChevronRight
            size={20}
            aria-hidden="true"
            className="settings-update-arrow"
          />
        </button>
        {/* Opção: Acesso Não Supervisionado */}
        <div
          style={{
            backgroundColor: "var(--bg-input, #1C110E)",
            border: "1px solid var(--border-subtle, #39241C)",
            borderRadius: "10px",
            padding: "1rem",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0.65rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <KeyRound size={18} color="var(--accent-primary, #C77B3B)" />
              <strong>Acesso Não Supervisionado com Senha</strong>
            </div>
            <input
              aria-label="Ativar acesso não supervisionado"
              type="checkbox"
              checked={unattendedEnabled}
              onChange={(e) => {
                const val = e.target.checked;
                setUnattendedEnabled(val);
              }}
            />
          </div>
          <p
            style={{
              margin: "0 0 0.75rem 0",
              fontSize: "0.82rem",
              color: "var(--text-secondary, #C4AFA0)",
              lineHeight: 1.4,
            }}
          >
            Permite conexões automáticas entre suas próprias máquinas utilizando
            uma senha pré-definida sem necessidade de confirmação manual na
            tela.
          </p>

          <p className="settings-hint">
            Confira os recursos permitidos ao acesso por senha. Configurações
            anteriores preservam as permissões que já estavam habilitadas.
          </p>
          <PermissionsFields
            value={unattendedPermissions}
            onChange={setUnattendedPermissions}
          />
          {(unattendedEnabled || focusPassword) && (
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input
                ref={passwordRef}
                aria-label="Senha de acesso não supervisionado"
                type="password"
                placeholder="Nova senha (mínimo 12 caracteres)"
                value={unattendedPassword}
                onChange={(e) => {
                  setUnattendedPassword(e.target.value);
                }}
                style={{
                  flex: 1,
                  padding: "0.65rem 0.85rem",
                  backgroundColor: "var(--bg-surface, #21130F)",
                  border: "1px solid var(--border-subtle, #39241C)",
                  borderRadius: "8px",
                  color: "var(--text-primary, #F4EAE0)",
                  fontSize: "0.88rem",
                  outline: "none",
                }}
              />
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0.5rem 0",
            borderBottom: "1px solid var(--border-subtle, #39241C)",
          }}
        >
          <span style={{ color: "var(--text-secondary, #C4AFA0)" }}>
            Qualidade da Transmissão
          </span>
          <span
            style={{ color: "var(--accent-soft, #E5A96D)", fontWeight: 600 }}
          >
            Adaptativa (WebRTC)
          </span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0.5rem 0",
          }}
        >
          <span style={{ color: "var(--text-secondary, #C4AFA0)" }}>
            Sincronização de Área de Transferência
          </span>
          <span style={{ color: "var(--success, #34C66B)", fontWeight: 600 }}>
            Disponível na sessão
          </span>
        </div>
      </div>
    </Modal>
  );
}
