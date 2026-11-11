import { Minus, Square, X } from "lucide-react";
import type { ServerStatus } from "../../types/app";
import { APP_VERSION } from "../../branding";
export function TitleBar({
  serverStatus,
  onMinimize,
  onMaximize,
  onClose,
}: {
  serverStatus: ServerStatus;
  onMinimize: () => void;
  onMaximize: () => void;
  onClose: () => void;
}) {
  return (
    <header className="titlebar app-drag-region">
      <span className="version-badge" title={"Sinalização: " + serverStatus}>
        v{APP_VERSION} · P2P
      </span>
      <div className="window-controls app-no-drag">
        <button onClick={onMinimize} aria-label="Minimizar">
          <Minus size={19} strokeWidth={1.4} />
        </button>
        <button onClick={onMaximize} aria-label="Maximizar ou restaurar">
          <Square size={16} strokeWidth={1.4} />
        </button>
        <button
          onClick={onClose}
          aria-label="Fechar aplicativo"
          className="window-close"
        >
          <X size={21} strokeWidth={1.4} />
        </button>
      </div>
    </header>
  );
}
