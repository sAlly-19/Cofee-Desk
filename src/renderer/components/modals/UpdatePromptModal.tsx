import { Modal } from "../ui/Modal";
import type { UpdaterState } from "../../../shared/updater";
const titles = {
  idle: "Atualizações",
  checking: "Verificando atualizações",
  available: "Nova versão disponível",
  "not-available": "Tudo em dia!",
  downloading: "Baixando atualização",
  downloaded: "Atualização pronta",
  installing: "Preparando instalação",
  error: "Atualização indisponível",
};
const bytes = (n: number) =>
  n >= 1048576
    ? (n / 1048576).toFixed(1) + " MB"
    : Math.round(n / 1024) + " KB";
export function UpdatePromptModal({
  isOpen,
  state,
  busy,
  onClose,
  onCheck,
  onDownload,
  onCancel,
  onInstall,
  onRelease,
}: {
  isOpen: boolean;
  state: UpdaterState;
  busy: boolean;
  onClose: () => void;
  onCheck: () => void;
  onDownload: () => unknown;
  onCancel: () => unknown;
  onInstall: () => unknown;
  onRelease: () => unknown;
}) {
  const info = state.updateInfo,
    p = state.progress;
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={titles[state.status]}
      maxWidth={580}
      footer={
        <div className="update-footer">
          <button className="text-button" onClick={onRelease}>
            Ver no GitHub
          </button>
          <div>
            {state.status === "available" && (
              <>
                <button className="secondary-button" onClick={onClose}>
                  Lembrar mais tarde
                </button>
                <button
                  className="primary-button"
                  disabled={state.isDev || state.isPortable}
                  onClick={onDownload}
                >
                  Baixar Atualização
                </button>
              </>
            )}
            {state.status === "downloading" && (
              <button className="secondary-button" onClick={onCancel}>
                Cancelar
              </button>
            )}
            {state.status === "downloaded" && (
              <>
                <button className="secondary-button" onClick={onClose}>
                  Depois
                </button>
                <button
                  className="primary-button"
                  disabled={busy || state.installBlocked}
                  onClick={onInstall}
                >
                  Instalar e reiniciar
                </button>
              </>
            )}
            {["idle", "error", "not-available"].includes(state.status) && (
              <>
                <button className="secondary-button" onClick={onCheck}>
                  Tentar novamente
                </button>
                <button className="primary-button" onClick={onClose}>
                  Fechar
                </button>
              </>
            )}
          </div>
        </div>
      }
    >
      {info && (
        <div className="update-version">
          <span>
            Versão instalada <strong>{info.currentVersion}</strong>
          </span>
          <span>
            Nova versão <strong>{info.version}</strong>
          </span>
        </div>
      )}
      {state.status === "checking" && (
        <p role="status">Consultando as releases oficiais no GitHub…</p>
      )}
      {state.status === "not-available" && (
        <p>Você já está usando a versão mais recente disponível.</p>
      )}
      {state.status === "available" && info && (
        <>
          <p>
            {info.releaseDate
              ? new Date(info.releaseDate).toLocaleDateString("pt-BR")
              : ""}
          </p>
          <h4>O que há de novo</h4>
          <pre className="update-notes">
            {info.releaseNotes || "Sem notas nesta release."}
          </pre>
        </>
      )}
      {state.status === "downloading" && (
        <div role="status">
          <progress max={100} value={p?.percent || 0} />
          <p>
            {(p?.percent || 0).toFixed(1)}% · {bytes(p?.transferred || 0)} de{" "}
            {bytes(p?.total || 0)} · {bytes(p?.bytesPerSecond || 0)}/s
          </p>
          <p>Você pode continuar usando o aplicativo durante o download.</p>
        </div>
      )}
      {state.status === "downloaded" && (
        <p>
          Download concluído. A instalação só começa quando você escolher
          “Instalar e reiniciar”.
        </p>
      )}
      {state.status === "installing" && (
        <p role="status">
          O aplicativo será encerrado para executar o instalador NSIS.
        </p>
      )}
      {state.isDev && (
        <p className="settings-hint">
          Ambiente de desenvolvimento: consulta disponível; download e
          instalação desativados.
        </p>
      )}
      {state.isPortable && (
        <p>Versão portátil: utilize o download manual no GitHub.</p>
      )}
      {(busy || state.installBlocked) && state.status === "downloaded" && (
        <p>Encerre a sessão e as transferências antes de instalar.</p>
      )}
      {state.errorMessage && <p role="alert">{state.errorMessage}</p>}
    </Modal>
  );
}
