import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { ToastContainer, type ToastItem } from '../components/ui/ToastContainer';
import {
  AlertDialog,
  type ActiveDialog,
  type AlertOptions,
  type ConfirmOptions,
  type PromptOptions,
  type ModalVariant,
} from '../components/ui/AlertDialog';

export type { ModalVariant, AlertOptions, ConfirmOptions, PromptOptions, ToastItem };

export interface ModalContextType {
  showAlert: (options: AlertOptions | string) => Promise<void>;
  showConfirm: (options: ConfirmOptions) => Promise<boolean>;
  showPrompt: (options: PromptOptions) => Promise<string | null>;
  showToast: (options: Partial<ToastItem> | string) => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function ModalProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [dialog, setDialog] = useState<ActiveDialog | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // -------------------------------------------------------------
  // TOAST SYSTEM
  // -------------------------------------------------------------
  const showToast = useCallback((options: Partial<ToastItem> | string) => {
    const id = Math.random().toString(36).substring(2, 9);
    let item: ToastItem;

    if (typeof options === 'string') {
      item = { id, message: options, type: 'info', durationMs: 3500 };
    } else {
      item = {
        id,
        title: options.title,
        message: options.message || '',
        type: options.type || 'info',
        durationMs: options.durationMs || 3500,
      };
    }

    setToasts((prev) => [...prev, item]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, item.durationMs);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // -------------------------------------------------------------
  // IMPERATIVE MODAL CALLS (PROMISES)
  // -------------------------------------------------------------
  const showAlert = useCallback((options: AlertOptions | string): Promise<void> => {
    return new Promise((resolve) => {
      const opts: AlertOptions =
        typeof options === 'string'
          ? { title: 'Aviso', message: options, type: 'info' }
          : options;

      setDialog({
        kind: 'alert',
        options: opts,
        resolve: () => {
          setDialog(null);
          resolve();
        },
      });
    });
  }, []);

  const showConfirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialog({
        kind: 'confirm',
        options,
        resolve: (val: boolean) => {
          setDialog(null);
          resolve(val);
        },
      });
    });
  }, []);

  const showPrompt = useCallback((options: PromptOptions): Promise<string | null> => {
    return new Promise((resolve) => {
      setDialog({
        kind: 'prompt',
        options,
        currentValue: options.defaultValue || '',
        resolve: (val: string | null) => {
          setDialog(null);
          resolve(val);
        },
      });
    });
  }, []);

  // Teclado (Escape / Enter)
  useEffect(() => {
    if (!dialog) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (dialog.kind === 'alert') dialog.resolve();
        else if (dialog.kind === 'confirm') dialog.resolve(false);
        else dialog.resolve(null);
      } else if (e.key === 'Enter') {
        if (dialog.kind === 'alert') {
          e.preventDefault();
          dialog.resolve();
        } else if (dialog.kind === 'confirm') {
          e.preventDefault();
          dialog.resolve(true);
        } else if (dialog.kind === 'prompt') {
          e.preventDefault();
          dialog.resolve(dialog.currentValue);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialog]);

  const handleUpdatePromptValue = (val: string) => {
    setDialog((prev) => (prev && prev.kind === 'prompt' ? { ...prev, currentValue: val } : prev));
  };

  const handleCloseDialog = () => {
    if (!dialog) return;
    if (dialog.kind === 'alert') dialog.resolve();
    else if (dialog.kind === 'confirm') dialog.resolve(false);
    else dialog.resolve(null);
  };

  const handleConfirmDialog = () => {
    if (!dialog) return;
    if (dialog.kind === 'alert') dialog.resolve();
    else if (dialog.kind === 'confirm') dialog.resolve(true);
    else dialog.resolve(dialog.currentValue);
  };

  return (
    <ModalContext.Provider value={{ showAlert, showConfirm, showPrompt, showToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
      <AlertDialog
        dialog={dialog}
        onUpdatePromptValue={handleUpdatePromptValue}
        onClose={handleCloseDialog}
        onConfirm={handleConfirmDialog}
      />
    </ModalContext.Provider>
  );
}

export function useModal(): ModalContextType {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal deve ser utilizado dentro de um ModalProvider');
  }
  return context;
}
