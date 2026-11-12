import { Star, Monitor, Play, MoreHorizontal } from "lucide-react";
import { Modal } from "../ui/Modal";
import type { RecentSession } from "../../types/app";
export function FavoritesModal({
  isOpen,
  onClose,
  favorites,
  onConnect,
  onOptions,
  onRemove,
}: {
  isOpen: boolean;
  onClose: () => void;
  favorites: RecentSession[];
  onConnect: (id: string) => void;
  onOptions: (session: RecentSession) => void;
  onRemove: (session: RecentSession) => void;
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Favoritos"
      subtitle="Seus computadores sempre à mão para reconectar."
      icon={<Star size={20} />}
      maxWidth={680}
    >
      {favorites.length === 0 ? (
        <div className="favorites-empty">
          <Star size={30} />
          <strong>Nenhum favorito ainda</strong>
          <p>
            Nas opções de um dispositivo recente ou do histórico, escolha
            “Adicionar aos favoritos”.
          </p>
        </div>
      ) : (
        <div className="favorites-list">
          {favorites.map((session) => (
            <div className="favorite-row" key={session.remoteId}>
              <Monitor className="favorite-device-icon" size={22} />
              <div className="recent-device">
                <strong>{session.name}</strong>
                <span className="font-mono">ID: {session.remoteId}</span>
              </div>
              <div className="favorite-actions">
                <button
                  className="session-connect"
                  aria-label={"Conectar a " + session.name}
                  onClick={() => {
                    onClose();
                    onConnect(session.remoteId);
                  }}
                >
                  <Play size={14} fill="currentColor" />
                  Conectar
                </button>
                <button
                  className="secondary-button options-button"
                  aria-label={"Opções de " + session.name}
                  onClick={() => {
                    onClose();
                    onOptions(session);
                  }}
                >
                  <MoreHorizontal size={20} />
                </button>
                <button
                  className="favorite-toggle secondary-button"
                  aria-label={"Remover " + session.name + " dos favoritos"}
                  onClick={() => onRemove(session)}
                >
                  <Star size={20} fill="currentColor" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
