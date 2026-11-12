import { APP_AUTHOR } from "../../branding";
import { Monitor, Star, Settings, CircleHelp } from "lucide-react";
import { CoffeeDeskLogo } from "../icons/CoffeeDeskLogo";
import type { NavItemKey, ServerStatus } from "../../types/app";
import { StatusIndicator } from "./StatusIndicator";
const links = [
  { key: "remote", label: "Conexão Remota", icon: Monitor },
  { key: "favorites", label: "Favoritos", icon: Star },
  { key: "settings", label: "Configurações", icon: Settings },
  { key: "help", label: "Ajuda & Atalhos", icon: CircleHelp },
] as const;
export function Sidebar({
  activeNav,
  serverStatus,
  myId,
  onNavClick,
  sessionActive = false,
}: {
  sessionActive?: boolean;
  activeNav: NavItemKey;
  serverStatus: ServerStatus;
  myId: string | null;
  onNavClick: (nav: NavItemKey) => void;
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <CoffeeDeskLogo size={52} />
        <div className="brand-name">Coffee Desk</div>
        <div className="brand-tagline">REMOTE WORKSPACE</div>
      </div>
      <nav className="sidebar-nav" aria-label="Navegação principal">
        {links.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            className={[
              "sidebar-link",
              activeNav === key ? "is-active" : "",
              key === "settings" ? "nav-divider" : "",
            ].join(" ")}
            aria-current={activeNav === key ? "page" : undefined}
            onClick={() => onNavClick(key)}
          >
            <Icon size={23} strokeWidth={1.7} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <StatusIndicator
          status={serverStatus}
          connectedLabel={sessionActive ? "Em sessão" : "Sinalização ativa"}
        />
        <div className="sidebar-id font-mono">
          {myId ? "ID: " + myId : "Aguardando ID…"}
        </div>
        <div className="app-signature">{APP_AUTHOR}</div>
      </div>
    </aside>
  );
}
