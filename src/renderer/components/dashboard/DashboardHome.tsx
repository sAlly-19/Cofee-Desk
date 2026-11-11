import type { RefObject } from "react";
import { RemoteConnectCard } from "./RemoteConnectCard";
import { IdentityCard } from "./IdentityCard";
import { RecentSessionsCard } from "./RecentSessionsCard";
import { StatusIndicator } from "./StatusIndicator";
import type {
  ConnectionStatus,
  ServerStatus,
  RecentSession,
} from "../../types/app";
interface DashboardHomeProps {
  remoteSectionRef: RefObject<HTMLDivElement>;
  recentSectionRef: RefObject<HTMLDivElement>;
  remoteId: string;
  setRemoteId: (id: string) => void;
  connectionStatus: ConnectionStatus;
  serverStatus: ServerStatus;
  connectionError: string | null;
  onConnect: () => void;
  onCancelCall: () => void;
  myId: string | null;
  isCopied: boolean;
  onCopyId: () => void;
  onOpenSettings: () => void;
  recentSessions: RecentSession[];
  onConnectSession: (id: string) => void;
  onOpenOptions: (session: RecentSession) => void;
  onViewAll: () => void;
}
export function DashboardHome(props: DashboardHomeProps) {
  return (
    <div className="dashboard-home">
      <div className="dashboard-content">
        <header className="dashboard-heading">
          <StatusIndicator
            status={props.serverStatus}
            className="availability"
          />
          <h1>Sua mesa. Em qualquer lugar.</h1>
          <p>Conecte-se a outro computador com segurança.</p>
        </header>
        <div className="connection-grid">
          <RemoteConnectCard {...props} />
          <IdentityCard {...props} />
        </div>
        <RecentSessionsCard {...props} />
      </div>
    </div>
  );
}
