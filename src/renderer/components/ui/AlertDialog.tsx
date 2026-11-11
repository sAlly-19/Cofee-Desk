import React, { useRef, useEffect, useId } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Info,
  X,
} from "lucide-react";

export type ModalVariant =
  "info" | "warning" | "error" | "success" | "question";

export interface AlertOptions {
  title: string;
  message: React.ReactNode;
  type?: ModalVariant;
  confirmText?: string;
  icon?: React.ReactNode;
}

export interface ConfirmOptions {
  title: string;
  message: React.ReactNode;
  type?: ModalVariant;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  icon?: React.ReactNode;
}

export interface PromptOptions {
  title: string;
  message?: React.ReactNode;
  placeholder?: string;
  defaultValue?: string;
  inputType?: "text" | "password";
  type?: ModalVariant;
  confirmText?: string;
  cancelText?: string;
  icon?: React.ReactNode;
}

export type ActiveDialog =
  | {
      kind: "alert";
      options: AlertOptions;
      resolve: () => void;
    }
  | {
      kind: "confirm";
      options: ConfirmOptions;
      resolve: (value: boolean) => void;
    }
  | {
      kind: "prompt";
      options: PromptOptions;
      resolve: (value: string | null) => void;
      currentValue: string;
    };

interface AlertDialogProps {
  dialog: ActiveDialog | null;
  onUpdatePromptValue: (val: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

const getIcon = (type: ModalVariant = "info", customIcon?: React.ReactNode) => {
  if (customIcon) return customIcon;
  switch (type) {
    case "success":
      return <CheckCircle2 size={32} color="#22c55e" />;
    case "warning":
      return <AlertTriangle size={32} color="#f59e0b" />;
    case "error":
      return <AlertCircle size={32} color="#ef4444" />;
    case "question":
      return <HelpCircle size={32} color="var(--accent-soft)" />;
    case "info":
    default:
      return <Info size={32} color="var(--accent-soft)" />;
  }
};

const getGlow = (type: ModalVariant = "info") => {
  switch (type) {
    case "success":
      return "rgba(34, 197, 94, 0.4)";
    case "warning":
      return "rgba(245, 158, 11, 0.4)";
    case "error":
      return "rgba(239, 68, 68, 0.45)";
    case "question":
    case "info":
    default:
      return "rgba(199, 123, 59, 0.12)";
  }
};

export function AlertDialog({
  dialog,
  onUpdatePromptValue,
  onClose,
  onConfirm,
}: AlertDialogProps): JSX.Element {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const promptInputRef = useRef<HTMLInputElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!dialog) return;

    if (dialog.kind === "prompt") {
      setTimeout(() => promptInputRef.current?.focus(), 50);
    } else {
      setTimeout(() => confirmBtnRef.current?.focus(), 50);
    }
  }, [dialog]);

  useEffect(() => {
    if (!dialog) return;
    function trap(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const items = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input:not(:disabled)",
        ) ?? [],
      );
      const first = items[0],
        last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", trap);
    return () => document.removeEventListener("keydown", trap);
  }, [!!dialog]);
  if (!dialog) return <></>;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.78)",
        backdropFilter: "blur(10px)",
        zIndex: 9000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        animation: "cd-fade-in 0.2s ease-out",
      }}
      onClick={() => {
        if (dialog.kind === "alert") {
          onConfirm();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="alert-dialog-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 460,
          maxWidth: "92vw",
          backgroundColor: "var(--bg-surface, #21130F)",
          background:
            "linear-gradient(145deg, var(--bg-surface, #21130F) 0%, #1A0E0B 100%)",
          border: "1px solid var(--border-warm, #70432B)",
          borderRadius: "16px",
          padding: "1.85rem",
          boxShadow: "var(--shadow-card, 0 20px 50px rgba(0, 0, 0, 0.8))",
          position: "relative",
          animation: "cd-zoom-in 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Botão fechar (X) */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "1.25rem",
            right: "1.25rem",
            background: "transparent",
            border: "none",
            color: "rgba(255, 255, 255, 0.5)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            padding: "4px",
          }}
        >
          <X size={18} />
        </button>

        {/* Cabeçalho com Ícone e Título */}
        <div style={{ textAlign: "center", marginBottom: "1.25rem" }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              backgroundColor: "var(--accent-subtle)",
              border: "1px solid var(--border-warm)",
              boxShadow: `0 0 24px ${getGlow(dialog.options.type)}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1rem auto",
            }}
          >
            {getIcon(dialog.options.type, dialog.options.icon)}
          </div>

          <h3
            id={titleId}
            style={{
              margin: 0,
              fontSize: "1.3rem",
              fontWeight: 800,
              color: "var(--text-primary)",
              letterSpacing: "-0.02em",
            }}
          >
            {dialog.options.title}
          </h3>
        </div>

        {/* Mensagem descritiva */}
        {dialog.options.message && (
          <div
            style={{
              fontSize: "0.92rem",
              color: "rgba(255, 225, 205, 0.8)",
              lineHeight: 1.55,
              textAlign: "center",
              marginBottom: "1.5rem",
            }}
          >
            {dialog.options.message}
          </div>
        )}

        {/* Se for Prompt: Campo de Texto / Senha */}
        {dialog.kind === "prompt" && (
          <div style={{ marginBottom: "1.5rem" }}>
            <input
              ref={promptInputRef}
              type={dialog.options.inputType || "text"}
              placeholder={dialog.options.placeholder || "Digite aqui..."}
              value={dialog.currentValue}
              onChange={(e) => onUpdatePromptValue(e.target.value)}
              style={{
                width: "100%",
                padding: "0.85rem 1rem",
                backgroundColor: "#0a0503",
                border: "1px solid var(--border-warm)",
                borderRadius: "12px",
                color: "var(--text-primary)",
                fontSize: "0.95rem",
                outline: "none",
                boxShadow: "inset 0 2px 6px rgba(0,0,0,0.6)",
              }}
            />
          </div>
        )}

        {/* Ações / Botões */}
        <div style={{ display: "flex", gap: "0.85rem" }}>
          {dialog.kind !== "alert" && (
            <button
              onClick={onClose}
              style={{
                flex: 1,
                padding: "0.8rem 1rem",
                backgroundColor: "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                borderRadius: "12px",
                color: "rgba(255, 255, 255, 0.85)",
                fontWeight: 600,
                fontSize: "0.9rem",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {dialog.options.cancelText || "Cancelar"}
            </button>
          )}

          <button
            ref={confirmBtnRef}
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: "0.8rem 1rem",
              background:
                dialog.kind === "confirm" && dialog.options.destructive
                  ? "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)"
                  : "var(--accent-gradient)",
              border: "none",
              borderRadius: "12px",
              color: "var(--text-primary)",
              fontWeight: 700,
              fontSize: "0.9rem",
              cursor: "pointer",
              boxShadow:
                dialog.kind === "confirm" && dialog.options.destructive
                  ? "0 4px 18px rgba(239, 68, 68, 0.45)"
                  : "var(--shadow-button)",
              transition: "all 0.15s ease",
            }}
          >
            {dialog.options.confirmText ||
              (dialog.kind === "alert" ? "OK" : "Confirmar")}
          </button>
        </div>
      </div>
    </div>
  );
}
