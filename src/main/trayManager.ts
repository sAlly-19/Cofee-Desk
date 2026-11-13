import {
  app,
  Tray,
  Menu,
  nativeImage,
  ipcMain,
  dialog,
  type BrowserWindow,
} from "electron";
import path from "path";
import Store from "electron-store";
import { assertTrusted } from "./ipcSecurity";
import { isNativeBusy } from "./sessionAuthority";
let tray: Tray | null = null,
  quitting = false;
const preferences = new Store<{ closeToTray: boolean }>({
  name: "window-preferences",
  defaults: { closeToTray: false },
});
export function registerTray(window: BrowserWindow) {
  const icon = nativeImage.createFromPath(
    path.join(__dirname, "../renderer/icon.png"),
  );
  if (icon.isEmpty()) throw Error("Ícone da bandeja não encontrado");
  tray = new Tray(icon.resize({ width: 20, height: 20 }));
  tray.setToolTip("Coffee Desk — acesso remoto");
  const show = () => {
    window.setSkipTaskbar(false);
    window.show();
    if (window.isMinimized()) window.restore();
    window.focus();
  };
  const hide = () => {
    window.hide();
    window.setSkipTaskbar(true);
  };
  const menu = () =>
    Menu.buildFromTemplate([
      { label: "Abrir Coffee Desk", click: show },
      { label: "Enviar para bandeja", click: hide },
      { type: "separator" },
      {
        label: "Continuar em segundo plano ao fechar",
        type: "checkbox",
        checked: preferences.get("closeToTray"),
        click: (item) => preferences.set("closeToTray", item.checked),
      },
      { type: "separator" },
      {
        label: "Sair",
        click: async () => {
          if (isNativeBusy()) {
            const answer = await dialog.showMessageBox(window, {
              type: "question",
              message: "Encerrar a sessão e sair do Coffee Desk?",
              buttons: ["Cancelar", "Encerrar e sair"],
              defaultId: 0,
              cancelId: 0,
            });
            if (answer.response !== 1) return;
          }
          quitting = true;
          app.quit();
        },
      },
    ]);
  tray.on("balloon-click", show);
  ipcMain.handle("window:incoming", (event) => {
    assertTrusted(event);
    show();
    return true;
  });
  tray.on("right-click", () => tray?.popUpContextMenu(menu()));
  tray.on("double-click", show);
  app.on("before-quit", () => {
    quitting = true;
  });
  window.on("close", (event) => {
    if (!quitting && preferences.get("closeToTray")) {
      event.preventDefault();
      hide();
    }
  });
  ipcMain.handle("window:tray", (event) => {
    assertTrusted(event);
    hide();
    return true;
  });
  window.once("closed", () => {
    tray?.destroy();
    tray = null;
    ipcMain.removeHandler("window:tray");
    ipcMain.removeHandler("window:incoming");
  });
  return { show, hide };
}
