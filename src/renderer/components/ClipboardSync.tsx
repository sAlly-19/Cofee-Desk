import { ClipboardCopy, Download, Send, RefreshCw } from "lucide-react";
import type { useSessionClipboard } from "../hooks/useSessionClipboard";
export function ClipboardSync({
  model,
}: {
  model: ReturnType<typeof useSessionClipboard>;
}) {
  const { local, remote, automatic, error, allowed, setLocal, setAutomatic } =
    model;
  if (!allowed) return <p>O anfitrião desativou o clipboard nesta sessão.</p>;
  return (
    <section className="clipboard-panel">
      <h3>Clipboard compartilhado</h3>
      <p className="settings-hint">
        Arquivos individuais copiados no sistema também são enviados quando
        clipboard e arquivos estão permitidos (até 32 MB por arquivo e 64 MB por
        seleção). Aguarde a transferência antes de colar. Recortar transfere uma
        cópia, preservando os originais; pastas não são suportadas.
      </p>
      <label className="clipboard-auto-toggle">
        <input
          type="checkbox"
          role="switch"
          checked={automatic}
          onChange={(e) => setAutomatic(e.target.checked)}
        />
        <span>
          <strong>Sincronizar automaticamente</strong>
          <small>Manter os clipboards atualizados durante a sessão.</small>
        </span>
      </label>
      {error && (
        <p className="settings-error" role="alert">
          {error}
        </p>
      )}
      <label className="clipboard-text-field">
        Meu clipboard
        <textarea
          aria-label="Meu clipboard"
          value={local}
          maxLength={65536}
          onChange={(e) => setLocal(e.target.value)}
        />
      </label>
      <div className="clipboard-local-actions">
        <button
          type="button"
          className="clipboard-action clipboard-action-secondary secondary-button"
          onClick={() => void model.read()}
        >
          <Download size={16} />
          Ler do sistema
        </button>
        <button
          type="button"
          className="clipboard-action clipboard-action-primary primary-button"
          disabled={!model.canSend}
          onClick={model.send}
        >
          <Send size={16} />
          Enviar ao remoto
        </button>
      </div>
      <label className="clipboard-text-field">
        Clipboard remoto
        <textarea aria-label="Clipboard remoto" readOnly value={remote} />
      </label>
      <button
        type="button"
        className="clipboard-action clipboard-action-secondary secondary-button"
        onClick={() => void model.apply()}
      >
        <ClipboardCopy size={16} />
        Aplicar no meu computador
      </button>
      <p className="clipboard-sync-state" role="status">
        <RefreshCw size={13} />
        {automatic ? "Sincronização automática ativa" : "Sincronização manual"}
      </p>
    </section>
  );
}
