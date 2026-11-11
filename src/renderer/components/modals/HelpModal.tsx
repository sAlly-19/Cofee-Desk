import { APP_AUTHOR, APP_VERSION } from "../../branding";
import { HelpCircle } from "lucide-react";
import { Modal } from "../ui/Modal";

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpModal({
  isOpen,
  onClose,
}: HelpModalProps): JSX.Element | null {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Ajuda e Suporte P2P"
      subtitle="Orientações de conexão e fluxo de permissões"
      icon={<HelpCircle size={20} color="var(--accent-primary, #C77B3B)" />}
      footer={
        <button
          onClick={onClose}
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
          }}
        >
          Entendido
        </button>
      }
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          color: "var(--text-secondary, #C4AFA0)",
          fontSize: "0.88rem",
        }}
      >
        <p style={{ margin: 0, lineHeight: 1.5 }}>
          <strong style={{ color: "var(--text-primary, #F4EAE0)" }}>
            Como conectar a outro computador?
          </strong>
          <br />
          Certifique-se de que ambas as máquinas estão com o Coffee Desk aberto
          e o status indica "Disponível". Digite o ID de 9 dígitos da máquina
          remota e clique em Conectar.
        </p>
        <p style={{ margin: 0, lineHeight: 1.5 }}>
          <strong style={{ color: "var(--text-primary, #F4EAE0)" }}>
            Como autorizar o acesso?
          </strong>
          <br />
          Quando alguém chamar o seu ID, aparecerá o modal na sua tela com opção
          de Aceitar ou Recusar em até 30 segundos.
        </p>
        <p style={{ margin: 0, lineHeight: 1.5 }}>
          <strong style={{ color: "var(--text-primary, #F4EAE0)" }}>
            Acesso Não Supervisionado:
          </strong>
          <br />
          Para acessar seu próprio computador de outro lugar sem precisar
          autorizar manualmente, ative nas Configurações a opção de senha fixa.
        </p>
        <div className="about-signature">
          <strong>Coffee Desk · v{APP_VERSION}</strong>
          <span>{APP_AUTHOR}</span>
        </div>
      </div>
    </Modal>
  );
}
