import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: number | string;
  closeOnBackdrop?: boolean;
}
export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  maxWidth = 560,
  closeOnBackdrop = true,
}: ModalProps) {
  const titleId = useId();
  const subtitleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"], a[href]',
        ) ?? [],
      ).filter((el) => el.getClientRects().length);
    focusable()[0]?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      const dialogs = document.querySelectorAll(
        '[role="dialog"], [role="alertdialog"]',
      );
      if (dialogs[dialogs.length - 1] !== dialog) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
      }
      if (event.key === "Tab") {
        const elements = focusable();
        const first = elements[0],
          last = elements[elements.length - 1];
        if (!first) {
          event.preventDefault();
          dialog?.focus();
        } else if (
          event.shiftKey &&
          (document.activeElement === first ||
            !dialog?.contains(document.activeElement))
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last ||
            !dialog?.contains(document.activeElement))
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      previous?.focus();
    };
  }, [isOpen]);
  if (!isOpen) return null;
  return (
    <div
      className="modal-backdrop"
      onClick={() => {
        if (closeOnBackdrop) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={subtitle ? subtitleId : undefined}
        style={{ width: maxWidth }}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-heading">
          <div className="modal-heading-label">
            {icon && <span className="device-icon">{icon}</span>}
            <div>
              {title && <h3 id={titleId}>{title}</h3>}
              {subtitle && <p id={subtitleId}>{subtitle}</p>}
            </div>
          </div>
          <button
            className="secondary-button modal-close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={19} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </div>
  );
}
