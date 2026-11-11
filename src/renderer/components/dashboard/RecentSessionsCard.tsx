import type { RefObject } from "react";
import {
  Monitor,
  CalendarDays,
  Play,
  MoreHorizontal,
  ArrowRight,
} from "lucide-react";
import type { RecentSession } from "../../types/app";
interface RecentSessionsCardProps {
  recentSectionRef: RefObject<HTMLDivElement>;
  recentSessions: RecentSession[];
  onConnectSession: (remoteId: string) => void;
  onOpenOptions: (session: RecentSession) => void;
  onViewAll: () => void;
}
export function RecentSessionsCard({
  recentSectionRef,
  recentSessions,
  onConnectSession,
  onOpenOptions,
  onViewAll,
}: RecentSessionsCardProps) {
  return (
    <section
      className="recent-sessions"
      ref={recentSectionRef}
      aria-labelledby="recents-heading"
    >
      <header className="section-heading">
        <div>
          <h2 id="recents-heading">Dispositivos recentes</h2>
          <p>Reconecte-se rapidamente aos seus dispositivos frequentes.</p>
        </div>
        <button className="text-button" onClick={onViewAll}>
          Ver histórico <ArrowRight size={22} />
        </button>
      </header>
      <div className="recent-list">
        {recentSessions.length === 0 ? (
          <div className="recent-empty">
            <span className="device-icon">
              <Monitor size={25} />
            </span>
            <div>
              <strong>Seu próximo acesso começa aqui.</strong>
              <p>Os dispositivos das suas sessões aparecerão nesta lista.</p>
            </div>
          </div>
        ) : (
          recentSessions.slice(0, 5).map((session) => (
            <div className="recent-row" key={session.id}>
              <span className="device-icon">
                <Monitor size={25} strokeWidth={1.6} />
              </span>
              <div className="recent-device">
                <strong>{session.name}</strong>
                <span className="font-mono">ID: {session.remoteId}</span>
              </div>
              <div className="recent-date">
                <CalendarDays size={19} strokeWidth={1.5} />
                <span>{session.dateStr}</span>
              </div>
              <button
                className="session-connect"
                onClick={() => onConnectSession(session.remoteId)}
                aria-label={"Conectar a " + session.name}
              >
                <Play size={16} fill="currentColor" />
                Conectar
              </button>
              <button
                className="secondary-button options-button"
                onClick={() => onOpenOptions(session)}
                aria-label={"Opções de " + session.name}
                aria-haspopup="dialog"
              >
                <MoreHorizontal size={22} />
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
