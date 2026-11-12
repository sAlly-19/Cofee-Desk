import { useSessionHistory } from "./hooks/useSessionHistory";
import { useAutoUpdate } from "./hooks/useAutoUpdate";
import { UpdatePromptModal } from "./components/modals/UpdatePromptModal";
import { ConnectionDetails } from "./components/session/ConnectionDetails";
import { useFavorites } from "./hooks/useFavorites";
import { FavoritesModal } from "./components/modals/FavoritesModal";
import { ReportDeviceModal } from "./components/modals/ReportDeviceModal";
import { useState, useCallback, useRef, useEffect } from "react";
import { ElectronAPI } from "@main/preload";
import { useModal } from "./context/ModalContext";

// Hooks
import { useSignaling } from "./hooks/useSignaling";
import { useRecentSessions } from "./hooks/useRecentSessions";
import { useCallManager } from "./hooks/useCallManager";

// Componentes do Dashboard & Sessão
import { TitleBar } from "./components/dashboard/TitleBar";
import { Sidebar } from "./components/dashboard/Sidebar";
import { DashboardHome } from "./components/dashboard/DashboardHome";
import { ActiveSessionContainer } from "./components/session/ActiveSessionContainer";

// Modais
import { IncomingCallModal } from "./components/modals/IncomingCallModal";
import { SettingsModal } from "./components/modals/SettingsModal";
import { HelpModal } from "./components/modals/HelpModal";
import { AllRecentSessionsModal } from "./components/modals/AllRecentSessionsModal";
import { SessionOptionsModal } from "./components/modals/SessionOptionsModal";

// Tipos
import type { NavItemKey, RecentSession } from "./types/app";

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export default function App(): JSX.Element {
  const { showToast } = useModal();

  // Navegação da sidebar e feedback
  const [activeNav, setActiveNav] = useState<NavItemKey>("remote");
  const [isCopied, setIsCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    },
    [],
  );
  const [reportTarget, setReportTarget] = useState<string | null>(null);
  const [focusPassword, setFocusPassword] = useState(false);

  // Modais
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showAllRecentModal, setShowAllRecentModal] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const { favorites, toggleFavorite, renameFavorite } = useFavorites();
  const [selectedSessionOptions, setSelectedSessionOptions] =
    useState<RecentSession | null>(null);

  // Referências para auto-scroll
  const remoteSectionRef = useRef<HTMLDivElement>(null);
  const recentSectionRef = useRef<HTMLDivElement>(null);

  // 1. Histórico de Sessões Recentes
  const {
    recentSessions,
    addRecentSession,
    renameSession,
    deleteSession,
    handleClearAllRecents,
    resetRecentsToDefault,
  } = useRecentSessions();
  const history = useSessionHistory();

  // Forward ref para conectar o handler de mensagens com useCallManager
  const callSignalingHandlerRef = useRef<((msg: any) => void) | null>(null);

  // 2. Conexão WebSocket / Sinalização
  const {
    serverStatus,
    serverError,
    diagnostic: serverDiagnostic,
    reportDevice,
    isRegistered,
    myId,
    sendWsMessage,
    handleResetIdentity,
  } = useSignaling({
    onSignalingMessage: (msg) => {
      callSignalingHandlerRef.current?.(msg);
    },
  });

  const availabilityStatus =
    serverStatus === "connected" && !isRegistered ? "connecting" : serverStatus;

  // 3. Gerenciamento de Chamadas (P2P Call Lifecycle)
  const {
    view,
    sessionRole,
    connectionStatus,
    remoteId,
    setRemoteId,
    connectionId,
    connectionError,
    incomingCall,
    countdown,
    unattendedEnabled,
    setUnattendedEnabled,
    unattendedPassword,
    setUnattendedPassword,
    handleConnectWithId,
    handleConnect,
    handleCancelCall,
    acceptIncomingCall,
    rejectIncomingCall,
    requestDisconnect,
    handleCallSignalingMessage,
    resetUnattendedSettings,
    permissions,
    sourceKind,
    updatePermissions,
    answering,
    diagnostic,
    unattendedPermissions,
    setUnattendedPermissions,
  } = useCallManager({
    myId,
    serverStatus: availabilityStatus,
    sendWsMessage,
    onCallEstablished: addRecentSession,
  });

  const updater = useAutoUpdate(
    view === "session" ||
      !!incomingCall ||
      ["calling", "ringing"].includes(connectionStatus),
  );

  // Atualiza a referência de sinalização do gerenciador de chamadas
  callSignalingHandlerRef.current = (msg) => {
    if (
      msg.type === "report-received" ||
      (reportTarget && msg.type === "error")
    )
      return;
    void handleCallSignalingMessage(msg);
  };

  // Copiar ID do usuário
  const handleCopyId = useCallback(async () => {
    if (!myId) return;
    try {
      await navigator.clipboard.writeText(myId);
      setIsCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setIsCopied(false), 2000);
    } catch {
      setIsCopied(false);
      showToast({
        type: "error",
        message: "Não foi possível copiar o ID. Tente novamente.",
      });
    }
  }, [myId, showToast]);

  // Mensagens WebRTC para o par conectado
  const handleSendSignalingMessage = useCallback(
    (type: "offer" | "answer" | "ice-candidate", payload: unknown) => {
      sendWsMessage({
        type,
        targetId: remoteId,
        fromId: myId,
        payload,
        timestamp: new Date().toISOString(),
      });
    },
    [remoteId, myId, sendWsMessage],
  );

  // Tratar eventos remotos de input (mouse/teclado)
  const handleRemoteInput = useCallback((input: any) => {
    if (input.type === "mouse" && window.electronAPI) {
      window.electronAPI.sendMouseEvent(input.data);
    } else if (input.type === "keyboard" && window.electronAPI) {
      window.electronAPI.sendKeyEvent(input.data);
    }
  }, []);

  // Navegação da sidebar
  const handleNavClick = (nav: NavItemKey) => {
    setActiveNav(nav);
    if (nav === "remote") {
      remoteSectionRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "center",
      });
    } else if (nav === "favorites") {
      setShowFavorites(true);
    } else if (nav === "settings") {
      setFocusPassword(false);
      setShowSettingsModal(true);
    } else if (nav === "help") {
      setShowHelpModal(true);
    }
  };

  // Redefinir identidade completa (dados locais + WebSocket)
  const onFullResetIdentity = useCallback(() => {
    handleResetIdentity(() => {
      resetRecentsToDefault();
      void history
        .clear()
        .catch(() =>
          showToast({
            type: "error",
            message: "Não foi possível limpar o histórico completo.",
          }),
        );
      resetUnattendedSettings();
      setShowSettingsModal(false);
    });
  }, [
    handleResetIdentity,
    resetRecentsToDefault,
    resetUnattendedSettings,
    history.clear,
    showToast,
  ]);

  // Limpeza de todas as sessões recentes com fechamento de modal
  const onClearAllRecents = useCallback(async () => {
    const cleared = await handleClearAllRecents();
    if (cleared) {
      try {
        await history.clear();
      } catch {
        showToast({
          type: "error",
          message: "Não foi possível limpar o histórico completo.",
        });
      }
      setShowAllRecentModal(false);
    }
  }, [handleClearAllRecents]);

  // Controles de Janela Frameless
  const handleMinimize = useCallback(() => {
    window.electronAPI?.minimize();
  }, []);

  const handleMaximize = useCallback(() => {
    window.electronAPI?.maximize();
  }, []);

  const handleClose = useCallback(() => {
    window.electronAPI?.close();
  }, []);

  return (
    <div className="app-shell">
      {/* 1. BARRA DE TÍTULO CUSTOMIZADA (DRAGGABLE + STATUS + BOTÕES DE JANELA) */}
      <TitleBar
        serverStatus={availabilityStatus}
        onMinimize={handleMinimize}
        onMaximize={handleMaximize}
        onClose={handleClose}
      />

      {/* 2. ÁREA DE CONTEÚDO PRINCIPAL (SIDEBAR + CONTEÚDO) */}
      <>
        {/* SIDEBAR COM NAVEGAÇÃO E STATUS P2P */}
        <Sidebar
          sessionActive={view === "session"}
          activeNav={activeNav}
          onNavClick={handleNavClick}
          serverStatus={availabilityStatus}
          myId={myId}
        />

        {/* CONTAINER DO DASHBOARD OU SESSÃO REMOTA */}
        <main className={view === "home" ? "app-main is-home" : "app-main"}>
          {serverError && (
            <div role="alert" className="server-alert">
              <span>{serverError}</span>
              <button
                className="text-button"
                onClick={() =>
                  window.dispatchEvent(new Event("server-changed"))
                }
              >
                Reconectar
              </button>
            </div>
          )}
          {view === "home" && (
            <ConnectionDetails
              diagnostic={
                availabilityStatus === "connected"
                  ? diagnostic
                  : serverDiagnostic
              }
            />
          )}
          {view === "home" ? (
            <DashboardHome
              remoteSectionRef={remoteSectionRef}
              recentSectionRef={recentSectionRef}
              remoteId={remoteId}
              setRemoteId={setRemoteId}
              connectionStatus={connectionStatus}
              serverStatus={availabilityStatus}
              connectionError={connectionError}
              onConnect={handleConnect}
              onCancelCall={handleCancelCall}
              myId={myId}
              isCopied={isCopied}
              onCopyId={handleCopyId}
              onOpenSettings={() => {
                setFocusPassword(true);
                setShowSettingsModal(true);
              }}
              recentSessions={recentSessions}
              onConnectSession={handleConnectWithId}
              onOpenOptions={setSelectedSessionOptions}
              onViewAll={() => setShowAllRecentModal(true)}
            />
          ) : (
            /* SESSÃO REMOTA ATIVA P2P - OCUPA 100% DO VIEWPORT */
            <div className="session-stage">
              <ActiveSessionContainer
                key={connectionId}
                connectionId={connectionId ?? ""}
                permissions={permissions}
                sourceKind={sourceKind}
                onUpdatePermissions={updatePermissions}
                remoteId={remoteId ?? ""}
                role={sessionRole}
                onRemoteInput={handleRemoteInput}
                onSendSignalingMessage={handleSendSignalingMessage}
                onReport={() => setReportTarget(remoteId)}
                onRequestDisconnect={requestDisconnect}
              />
            </div>
          )}
        </main>
      </>

      {/* 3. MODAIS */}
      <IncomingCallModal
        incomingCall={incomingCall}
        countdown={countdown}
        answering={answering}
        error={connectionError}
        onAccept={acceptIncomingCall}
        onReject={rejectIncomingCall}
      />

      <SettingsModal
        unattendedPermissions={unattendedPermissions}
        setUnattendedPermissions={setUnattendedPermissions}
        onCheckUpdates={() => {
          setShowSettingsModal(false);
          void updater.checkNow();
        }}
        focusPassword={focusPassword}
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        unattendedEnabled={unattendedEnabled}
        setUnattendedEnabled={setUnattendedEnabled}
        unattendedPassword={unattendedPassword}
        setUnattendedPassword={setUnattendedPassword}
        onResetIdentity={onFullResetIdentity}
        onSave={() => {
          setShowSettingsModal(false);
          showToast({
            type: "success",
            message: "Configurações salvas com sucesso!",
          });
        }}
      />

      <UpdatePromptModal
        isOpen={updater.isOpen}
        state={updater.state}
        busy={view === "session" || !!incomingCall}
        onClose={updater.close}
        onCheck={() => void updater.checkNow()}
        onDownload={updater.download}
        onCancel={updater.cancel}
        onInstall={updater.install}
        onRelease={updater.openRelease}
      />
      <HelpModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
      />

      <AllRecentSessionsModal
        entries={history.entries}
        error={history.error}
        isOpen={showAllRecentModal}
        onClose={() => setShowAllRecentModal(false)}
        recentSessions={recentSessions}
        onClearAll={onClearAllRecents}
        onConnectSession={handleConnectWithId}
        onOpenOptions={setSelectedSessionOptions}
      />

      <FavoritesModal
        isOpen={showFavorites}
        onClose={() => {
          setShowFavorites(false);
          setActiveNav("remote");
        }}
        favorites={favorites}
        onConnect={handleConnectWithId}
        onOptions={setSelectedSessionOptions}
        onRemove={toggleFavorite}
      />
      <ReportDeviceModal
        targetId={reportTarget}
        onClose={() => setReportTarget(null)}
        onSend={reportDevice}
      />
      <SessionOptionsModal
        selectedSession={selectedSessionOptions}
        onClose={() => setSelectedSessionOptions(null)}
        onConnectDirect={handleConnectWithId}
        onConnectWithPassword={handleConnectWithId}
        onRename={(remoteId, name) => {
          const recent = recentSessions.find((s) => s.remoteId === remoteId);
          if (recent) renameSession(recent.id, name);
          else
            showToast({
              type: "success",
              message: "Nome da máquina atualizado!",
            });
          renameFavorite(remoteId, name);
        }}
        isFavorite={
          !!selectedSessionOptions &&
          favorites.some((s) => s.remoteId === selectedSessionOptions.remoteId)
        }
        onToggleFavorite={toggleFavorite}
        canDeleteFromHistory={
          !!selectedSessionOptions &&
          recentSessions.some(
            (s) => s.remoteId === selectedSessionOptions.remoteId,
          )
        }
        onReport={setReportTarget}
        onDelete={(remoteId) => {
          const recent = recentSessions.find((s) => s.remoteId === remoteId);
          if (recent) deleteSession(recent.id);
        }}
      />
    </div>
  );
}
