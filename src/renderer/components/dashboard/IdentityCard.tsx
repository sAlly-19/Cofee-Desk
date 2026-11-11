import { UserRound, Check, Copy, KeyRound, CircleCheck } from "lucide-react";
import type { ServerStatus } from "../../types/app";
interface IdentityCardProps {
  myId: string | null;
  serverStatus: ServerStatus;
  isCopied: boolean;
  onCopyId: () => void;
  onOpenSettings?: () => void;
}
export function IdentityCard({
  myId,
  serverStatus,
  isCopied,
  onCopyId,
  onOpenSettings,
}: IdentityCardProps) {
  const ready = serverStatus === "connected" && !!myId;
  return (
    <section
      className="identity-panel surface"
      aria-labelledby="identity-heading"
    >
      <header className="identity-heading">
        <div>
          <UserRound size={29} strokeWidth={1.6} />
          <h2 id="identity-heading">Este computador</h2>
        </div>
        <span
          className={"access-badge " + (ready ? "is-ready" : "")}
          role="status"
        >
          <CircleCheck size={15} />
          {ready
            ? "Pronto para acesso"
            : serverStatus === "connecting"
              ? "Registrando…"
              : "Indisponível"}
        </span>
      </header>
      <div className="local-id-box">
        <span className="local-id font-mono" aria-label="Seu ID">
          {myId ? myId.replace(/-/g, " ") : "— — —"}
        </span>
        <button
          className={
            "secondary-button copy-button " + (isCopied ? "is-copied" : "")
          }
          onClick={onCopyId}
          disabled={!myId}
          aria-label="Copiar ID"
        >
          {isCopied ? <Check size={21} /> : <Copy size={21} />}
          <span aria-live="polite">{isCopied ? "Copiado!" : "Copiar"}</span>
        </button>
      </div>
      <p>Compartilhe seu ID para receber uma conexão.</p>
      <div className="identity-footer">
        <button className="text-button" onClick={onOpenSettings}>
          <KeyRound size={24} />
          <span>Definir senha</span>
        </button>
      </div>
    </section>
  );
}
