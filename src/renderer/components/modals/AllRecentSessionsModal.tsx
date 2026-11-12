import {matchesDevice,filterHistory} from "../../../shared/history";
import { useState } from "react";
import { Clock, MoreHorizontal, Play } from "lucide-react";
import { Modal } from "../ui/Modal";
import type { RecentSession } from "../../types/app";
import type {
  SessionHistoryEntry,
  SessionResult,
} from "../../../shared/session";
const labels: Record<SessionResult, string> = {
  calling: "Chamando",
  active: "Em sessão",
  completed: "Concluída",
  rejected: "Recusada",
  cancelled: "Cancelada",
  failed: "Falhou",
  legacy: "Registro anterior",
};
export function AllRecentSessionsModal({
  isOpen,
  onClose,
  recentSessions,
  entries,
  error,
  onClearAll,
  onConnectSession,
  onOpenOptions,
}: {
  isOpen: boolean;
  onClose: () => void;
  recentSessions: RecentSession[];
  entries: SessionHistoryEntry[];
  error: string;
  onClearAll: () => void;
  onConnectSession: (id: string) => void;
  onOpenOptions: (session: RecentSession) => void;
}) {
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [page, setPage] = useState(0),
    [tab, setTab] = useState<"sessions" | "devices">("sessions");
  const matches=(s:{name:string;remoteId:string})=>matchesDevice(s,query);
  const filtered=filterHistory(entries,query,filter,recentSessions);
  const pages = Math.max(1, Math.ceil(filtered.length / 20));
  const current = Math.min(page, pages - 1);
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Histórico de sessões"
      subtitle="Tentativas e conexões deste serviço, salvas neste computador."
      icon={<Clock size={20} />}
      maxWidth={800}
      footer={
        <>
          <button className="secondary-button" onClick={onClearAll}>
            Limpar Todo o Histórico
          </button>
          <button className="secondary-button" onClick={onClose}>
            Fechar
          </button>
        </>
      }
    >
      <div className="history-controls">
        <input
          aria-label="Buscar no histórico"
          placeholder="Buscar por nome ou ID"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
        />
        <select
          aria-label="Filtrar resultado"
          value={filter}
          disabled={tab === "devices"}
          onChange={(e) => {
            setFilter(e.target.value);
            setPage(0);
          }}
        >
          <option value="all">Todos os resultados</option>
          {Object.entries(labels).map(([key, label]) => (
            <option value={key} key={key}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="history-tabs">
        <button
          className="text-button"
          aria-pressed={tab === "sessions"}
          onClick={() => setTab("sessions")}
        >
          Sessões ({entries.length})
        </button>
        <button
          className="text-button"
          aria-pressed={tab === "devices"}
          onClick={() => setTab("devices")}
        >
          Dispositivos recentes ({recentSessions.length})
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="history-list">
        {tab === "sessions"
          ? filtered.slice(current * 20, current * 20 + 20).map((e) => {
              const known = recentSessions.find(
                (s) => s.remoteId === e.remoteId,
              );
              const date = e.startedAt
                ? new Date(e.startedAt).toLocaleString("pt-BR")
                : "Horário não disponível";
              const duration =
                e.acceptedAt && e.endedAt
                  ? Math.max(
                      0,
                      Math.round(
                        (Date.parse(e.endedAt) - Date.parse(e.acceptedAt)) /
                          1000,
                      ),
                    )
                  : null;
              const session: RecentSession = {
                id: e.id,
                remoteId: e.remoteId,
                name: known?.name || e.name,
                dateStr: date,
              };
              return (
                <div className="history-row" key={e.id}>
                  <div>
                    <strong>{session.name}</strong>
                    <div className="font-mono">{e.remoteId}</div>
                    <small>
                      {e.direction === "incoming" ? "Recebida" : "Realizada"} ·{" "}
                      {date}
                      {duration !== null ? " · " + duration + " s" : ""}
                      {e.reason
                        ? " · " +
                          ({
                            ENDED: "Encerrada",
                            DISCONNECTED: "Conexão perdida",
                            EXPIRED: "Tempo esgotado",
                            REJECTED: "Recusada",
                            CANCELLED: "Cancelada",
                            SANCTIONED: "Acesso revogado",
                            APP_INTERRUPTED: "Aplicativo interrompido",
                          }[e.reason] || e.reason)
                        : ""}
                    </small>
                  </div>
                  <span>{labels[e.result]}</span>
                  <button
                    className="session-connect"
                    aria-label={"Conectar a " + session.name}
                    onClick={() => {
                      onClose();
                      onConnectSession(e.remoteId);
                    }}
                  >
                    <Play size={14} />
                    Conectar
                  </button>
                  <button
                    className="secondary-button options-button"
                    aria-label={"Opções de " + session.name}
                    onClick={() => onOpenOptions(session)}
                  >
                    <MoreHorizontal size={20} />
                  </button>
                </div>
              );
            })
          : recentSessions.filter(matches).map((s) => (
              <div className="history-row" key={s.id}>
                <div>
                  <strong>{s.name}</strong>
                  <div className="font-mono">{s.remoteId}</div>
                  <small>{s.dateStr}</small>
                </div>
                <button
                  className="session-connect"
                  onClick={() => {
                    onClose();
                    onConnectSession(s.remoteId);
                  }}
                >
                  Conectar
                </button>
                <button
                  className="secondary-button options-button"
                  aria-label={"Opções de " + s.name}
                  onClick={() => onOpenOptions(s)}
                >
                  <MoreHorizontal size={20} />
                </button>
              </div>
            ))}
      </div>
      {(tab === "sessions"
        ? filtered.length
        : recentSessions.filter(matches).length) === 0 && (
        <p className="recent-empty">Nenhum registro encontrado.</p>
      )}
      {tab === "sessions" && (
        <div className="history-pagination">
          <button
            className="text-button"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            Anterior
          </button>
          <span>
            {current + 1} de {pages}
          </span>
          <button
            className="text-button"
            disabled={current + 1 >= pages}
            onClick={() => setPage(current + 1)}
          >
            Próxima
          </button>
        </div>
      )}
    </Modal>
  );
}
