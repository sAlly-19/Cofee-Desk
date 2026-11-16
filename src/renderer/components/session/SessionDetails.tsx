import { useEffect, useId, useRef, useState } from "react";
import { Activity, X } from "lucide-react";
import { ConnectionDetails } from "./ConnectionDetails";
import type { ConnectionDiagnostic } from "../../../shared/session";
export function SessionDetails({
  remoteId,
  diagnostic,
}: {
  remoteId: string;
  diagnostic: ConnectionDiagnostic;
}) {
  const [open, setOpen] = useState(false),
    root = useRef<HTMLDivElement>(null),
    button = useRef<HTMLButtonElement>(null),
    id = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", key, true);
    };
  }, [open]);
  return (
    <div className="session-details" ref={root}>
      <button
        type="button"
        ref={button}
        className="session-tool"
        aria-label="Detalhes da conexão"
        title="Detalhes da conexão"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <Activity size={17} />
      </button>
      {open && (
        <section
          id={id}
          className="session-details-panel"
          aria-label="Informações da sessão"
        >
          <div className="session-details-heading">
            <strong>Detalhes da conexão</strong>
            <button
              type="button"
              className="session-tool"
              aria-label="Fechar detalhes"
              onClick={() => {
                setOpen(false);
                button.current?.focus();
              }}
            >
              <X size={15} />
            </button>
          </div>
          <p>
            Computador <span className="font-mono">{remoteId}</span>
          </p>
          <ConnectionDetails diagnostic={diagnostic} expanded />
        </section>
      )}
    </div>
  );
}
