import { useState, useEffect } from "react";
import { Flag } from "lucide-react";
import { Modal } from "../ui/Modal";
export function ReportDeviceModal({
  targetId,
  onClose,
  onSend,
}: {
  targetId: string | null;
  onClose: () => void;
  onSend: (id: string, category: string, description: string) => void;
}) {
  const [category, setCategory] = useState("unauthorized"),
    [description, setDescription] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [received, setReceived] = useState(false);
  useEffect(() => {
    setDescription("");
    setError("");
    setBusy(false);
    setReceived(false);
  }, [targetId]);
  useEffect(() => {
    if (!busy) return;
    const done = (event: Event) => {
      const data = (event as CustomEvent).detail;
      setBusy(false);
      if (data.type === "report-received") setReceived(true);
      else setError(data.message || "Não foi possível enviar a denúncia.");
    };
    window.addEventListener("device-report-result", done);
    const timer = setTimeout(() => {
      setBusy(false);
      setError(
        "Servidor não respondeu. Verifique a conexão antes de tentar novamente.",
      );
    }, 12000);
    return () => {
      window.removeEventListener("device-report-result", done);
      clearTimeout(timer);
    };
  }, [busy]);
  return (
    <Modal
      isOpen={!!targetId}
      onClose={onClose}
      title="Denunciar dispositivo"
      subtitle={targetId ?? ""}
      icon={<Flag size={20} />}
    >
      {received ? (
        <div role="status">
          <p>Denúncia recebida. A administração analisará o relato.</p>
          <button className="primary-button" onClick={onClose}>
            Concluir
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!targetId || busy) return;
            setError("");
            setBusy(true);
            onSend(targetId, category, description);
          }}
        >
          <p className="settings-hint">
            Descreva o ocorrido sem incluir senhas, documentos ou outros dados
            pessoais. Denúncias não geram banimento automático.
          </p>
          <label className="settings-label">
            Categoria
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="unauthorized">Tentativa de acesso indevido</option>
              <option value="spam">Spam</option>
              <option value="fraud">Fraude</option>
              <option value="other">Outro</option>
            </select>
          </label>
          <label className="settings-label">
            O que aconteceu?
            <textarea
              required
              minLength={10}
              maxLength={2000}
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <p className="settings-hint">{description.length}/2000 caracteres</p>
          {error && (
            <p role="alert" className="settings-error">
              {error}
            </p>
          )}
          <button className="primary-button" disabled={busy}>
            {busy ? "Enviando…" : "Enviar denúncia"}
          </button>
        </form>
      )}
    </Modal>
  );
}
