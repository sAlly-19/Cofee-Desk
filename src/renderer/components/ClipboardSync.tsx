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
      <label>
        <input
          type="checkbox"
          checked={automatic}
          onChange={(e) => setAutomatic(e.target.checked)}
        />{" "}
        Sincronizar automaticamente
      </label>
      {error && <p role="alert">{error}</p>}
      <label>
        Meu clipboard
        <textarea
          aria-label="Meu clipboard"
          value={local}
          maxLength={65536}
          onChange={(e) => setLocal(e.target.value)}
        />
      </label>
      <button className="secondary-button" onClick={() => void model.read()}>
        Ler do sistema
      </button>
      <button
        className="primary-button"
        disabled={!model.canSend}
        onClick={model.send}
      >
        Enviar ao remoto
      </button>
      <label>
        Clipboard remoto
        <textarea aria-label="Clipboard remoto" readOnly value={remote} />
      </label>
      <button className="secondary-button" onClick={() => void model.apply()}>
        Aplicar no meu computador
      </button>
    </section>
  );
}
