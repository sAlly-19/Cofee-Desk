import { useEffect, useRef, useState, useCallback } from "react";
import type { UpdaterState } from "../../shared/updater";
const initial: UpdaterState = {
  status: "idle",
  updateInfo: null,
  progress: null,
  errorMessage: null,
  isDev: true,
  isPortable: false,
  installBlocked: false,
};
export function useAutoUpdate(busy: boolean) {
  const [state, setState] = useState(initial),
    [isOpen, setIsOpen] = useState(false);
  const busyRef = useRef(busy),
    dismissed = useRef("");
  busyRef.current = busy;
  useEffect(() => {
    const receive = (s: UpdaterState) => {
      setState(s);
      if (
        ["available", "downloaded"].includes(s.status) &&
        !busyRef.current &&
        dismissed.current !== s.updateInfo?.version
      )
        setIsOpen(true);
    };
    void window.electronAPI.updater
      .getState()
      .then(receive)
      .catch(() => {});
    return window.electronAPI.updater.onStatusChange(receive);
  }, []);
  useEffect(() => {
    if (
      !busy &&
      ["available", "downloaded"].includes(state.status) &&
      dismissed.current !== state.updateInfo?.version
    )
      setIsOpen(true);
  }, [busy, state.status, state.updateInfo?.version]);
  const checkNow = useCallback(async () => {
    setIsOpen(true);
    try {
      setState(await window.electronAPI.updater.check());
    } catch {
      setState((s) => ({
        ...s,
        status: "error",
        errorMessage: "Não foi possível consultar atualizações.",
      }));
    }
  }, []);
  const close = () => {
    dismissed.current = state.updateInfo?.version || "";
    setIsOpen(false);
  };
  return {
    state,
    isOpen,
    checkNow,
    close,
    download: () => window.electronAPI.updater.download(),
    cancel: () => window.electronAPI.updater.cancel(),
    install: () => window.electronAPI.updater.install(),
    openRelease: () => window.electronAPI.updater.openRelease(),
  };
}
