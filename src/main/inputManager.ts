import { normalizedPoint } from "../shared/geometry";
import { assertTrusted } from "./ipcSecurity";
import {
  hasPermission,
  nativeSession,
  onNativeSessionChange,
} from "./sessionAuthority";
import { ipcMain } from "electron";
import { spawn, ChildProcess } from "child_process";
import path from "path";
import fs from "fs";
import { IPC_CHANNELS } from "../shared/ipcChannels";
import type { MouseEventData, KeyboardEventData } from "../shared/types";

let inputProcess: ChildProcess | null = null;
const enabledSenders = new Set<number>();
const heldKeys = new Set<number>();
const heldButtons = new Set<string>();
let isReady = false;

// Mapeamento de KeyboardEvent.code para Windows Virtual-Key (VK)
const CODE_TO_VK: Record<string, number> = {
  Backspace: 0x08,
  Tab: 0x09,
  Enter: 0x0d,
  NumpadEnter: 0x0d,
  ShiftLeft: 0x10,
  ShiftRight: 0x10,
  ControlLeft: 0x11,
  ControlRight: 0x11,
  AltLeft: 0x12,
  AltRight: 0x12,
  Pause: 0x13,
  CapsLock: 0x14,
  Escape: 0x1b,
  Space: 0x20,
  PageUp: 0x21,
  PageDown: 0x22,
  End: 0x23,
  Home: 0x24,
  ArrowLeft: 0x25,
  ArrowUp: 0x26,
  ArrowRight: 0x27,
  ArrowDown: 0x28,
  PrintScreen: 0x2c,
  Insert: 0x2d,
  Delete: 0x2e,
  MetaLeft: 0x5b,
  MetaRight: 0x5c,
  ContextMenu: 0x5d,
  F1: 0x70,
  F2: 0x71,
  F3: 0x72,
  F4: 0x73,
  F5: 0x74,
  F6: 0x75,
  F7: 0x76,
  F8: 0x77,
  F9: 0x78,
  F10: 0x79,
  F11: 0x7a,
  F12: 0x7b,
};

function getVkCode(code: string, key?: string): number {
  if (CODE_TO_VK[code]) return CODE_TO_VK[code];

  if (code.startsWith("Key") && code.length === 4) {
    return code.charCodeAt(3); // 'KeyA' -> 65 (0x41)
  }

  if (code.startsWith("Digit") && code.length === 6) {
    return code.charCodeAt(5); // 'Digit1' -> 49 (0x31)
  }

  if (code.startsWith("Numpad") && code.length === 7) {
    const digit = code.charCodeAt(6) - 48;
    if (digit >= 0 && digit <= 9) return 0x60 + digit;
  }

  if (key && key.length === 1) {
    const upper = key.toUpperCase();
    return upper.charCodeAt(0);
  }

  return 0;
}

/**
 * Localiza ou compila o helper nativo CoffeeInput.exe.
 */
function findOrCompileNativeHelper(): string | null {
  const possiblePaths = [
    path.join(process.resourcesPath, "native", "CoffeeInput-v2.exe"),
    path.join(__dirname, "native", "CoffeeInput-v2.exe"),
    path.join(process.resourcesPath, "native", "CoffeeInput.exe"),
    path.join(__dirname, "native", "CoffeeInput.exe"),
    path.join(__dirname, "..", "native", "CoffeeInput.exe"),
    path.join(process.cwd(), "src", "main", "native", "CoffeeInput.exe"),
    path.join(
      process.cwd(),
      "dist-electron",
      "main",
      "native",
      "CoffeeInput.exe",
    ),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }

  // Tenta compilar se encontrar o código fonte CoffeeInput.cs
  const csSourcePaths = [
    path.join(__dirname, "native", "CoffeeInput.cs"),
    path.join(process.cwd(), "src", "main", "native", "CoffeeInput.cs"),
  ];

  for (const csPath of csSourcePaths) {
    if (fs.existsSync(csPath)) {
      const outDir = path.dirname(csPath);
      const outExe = path.join(outDir, "CoffeeInput.exe");
      const cscPath =
        "C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe";

      if (fs.existsSync(cscPath)) {
        console.log("[Input] Compilando CoffeeInput.exe via csc.exe...");
        try {
          const { execSync } = require("child_process");
          execSync(
            `"${cscPath}" /nologo /optimize /target:exe /out:"${outExe}" "${csPath}"`,
          );
          if (fs.existsSync(outExe)) return outExe;
        } catch (err) {
          console.error("[Input] Erro ao compilar CoffeeInput.cs:", err);
        }
      }
    }
  }

  return null;
}

/**
 * Inicializa o processo helper Win32 em background para injeção de input via stdin.
 */
function startNativeInputProcess(): void {
  if (process.platform !== "win32") {
    console.warn("[Input] Injeção Win32 disponível apenas no Windows.");
    return;
  }

  if (inputProcess && !inputProcess.killed) return;

  const exePath = findOrCompileNativeHelper();
  if (!exePath) {
    console.error(
      "[Input] Não foi possível encontrar ou compilar CoffeeInput.exe.",
    );
    return;
  }

  try {
    console.log(`[Input] Iniciando processo helper: ${exePath}`);
    const child = spawn(exePath, [], {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    inputProcess = child;

    child.stdout?.on("data", (data) => {
      const msg = data.toString().trim();
      if (msg.includes("READY")) {
        isReady = true;
        console.log(
          "[Input] Helper nativo Win32 PRONTO para injeção de comandos.",
        );
      }
    });

    child.stderr?.on("data", (data) => {
      console.warn(`[Input Helper Err] ${data.toString().trim()}`);
    });

    child.on("exit", (code) => {
      console.warn(`[Input] Helper finalizado com código ${code}.`);
      isReady = false;
      inputProcess = null;
    });
  } catch (err) {
    console.error("[Input] Falha ao iniciar processo helper:", err);
  }
}

/**
 * Envia comando diretamente para o stdin do processo helper.
 */
function sendNativeCommand(cmd: string): void {
  if (!inputProcess || !inputProcess.stdin || inputProcess.killed) {
    startNativeInputProcess();
  }

  if (inputProcess?.stdin && !inputProcess.stdin.destroyed) {
    try {
      inputProcess.stdin.write(cmd + "\n");
    } catch (err) {
      console.error("[Input] Erro ao escrever no stdin do helper:", err);
    }
  }
}

/**
 * Registra handlers de IPC para controle remoto de mouse e teclado.
 */
function releaseHeldInput() {
  if (inputProcess?.stdin && !inputProcess.stdin.destroyed) {
    for (const key of heldKeys) inputProcess.stdin.write("KU " + key + "\n");
    for (const button of heldButtons)
      inputProcess.stdin.write("U " + button + "\n");
  }
  heldKeys.clear();
  heldButtons.clear();
}
export function registerInputIpcHandlers(): void {
  onNativeSessionChange((sender) => {
    if (!hasPermission(sender, "control")) {
      if (enabledSenders.has(sender)) releaseHeldInput();
      enabledSenders.delete(sender);
    }
  });
  // Inicializa o helper nativo em background
  startNativeInputProcess();

  // Recebe eventos de mouse do Renderer (repassados via WebRTC DataChannel)
  ipcMain.on(IPC_CHANNELS.REMOTE_INPUT_MOUSE, (event, data: MouseEventData) => {
    try {
      assertTrusted(event);
    } catch {
      return;
    }
    if (
      !enabledSenders.has(event.sender.id) ||
      !hasPermission(event.sender.id, "control") ||
      !data
    )
      return;

    const { type, normX, normY, button = "left", scrollDelta } = data;

    const bounds = nativeSession(event.sender.id)?.bounds;
    if (
      !bounds ||
      !Number.isFinite(normX) ||
      !Number.isFinite(normY) ||
      normX! < 0 ||
      normX! > 1 ||
      normY! < 0 ||
      normY! > 1 ||
      !["left", "right", "middle"].includes(button)
    )
      return;
    const point = normalizedPoint(bounds, normX!, normY!);
    if (!point) return;
    sendNativeCommand("M " + point.x + " " + point.y);
    // Coordinates are mapped to the selected monitor, including negative offsets.
    if (type === "move" && normX !== undefined && normY !== undefined) {
      // Absolute movement was mapped above.
    } else if (type === "down") {
      heldButtons.add(button);
      sendNativeCommand(`D ${button}`);
    } else if (type === "up") {
      heldButtons.delete(button);
      sendNativeCommand(`U ${button}`);
    } else if (type === "click") {
      sendNativeCommand(`C ${button}`);
    } else if (type === "double") {
      sendNativeCommand(`DC ${button}`);
    } else if (
      type === "scroll" &&
      scrollDelta &&
      Number.isFinite(scrollDelta.y)
    ) {
      // Inverte direção padrão para corresponder à roda do mouse
      sendNativeCommand(
        `W ${Math.max(-12000, Math.min(12000, Math.round(-scrollDelta.y)))}`,
      );
    }
  });

  // Recebe eventos de teclado do Renderer
  ipcMain.on(
    IPC_CHANNELS.REMOTE_INPUT_KEYBOARD,
    (event, data: KeyboardEventData) => {
      try {
        assertTrusted(event);
      } catch {
        return;
      }
      if (
        !enabledSenders.has(event.sender.id) ||
        !hasPermission(event.sender.id, "control") ||
        !data ||
        typeof data.code !== "string"
      )
        return;

      const { type, code, key, text } = data;

      if (type === "text" && text && text.length <= 4096) {
        const b64 = Buffer.from(text, "utf-8").toString("base64");
        sendNativeCommand(`TX ${b64}`);
        return;
      }

      const vk = getVkCode(code, key);
      if (!vk) return;

      if (type === "down") {
        heldKeys.add(vk);
        sendNativeCommand(`KD ${vk}`);
      } else if (type === "up") {
        heldKeys.delete(vk);
        sendNativeCommand(`KU ${vk}`);
      } else if (type === "press") {
        sendNativeCommand(`KT ${vk}`);
      }
    },
  );

  // Toggle de permissão de controle remoto no Host
  ipcMain.handle(
    IPC_CHANNELS.REMOTE_CONTROL_TOGGLE,
    (event, enabled?: boolean) => {
      assertTrusted(event);
      const requested =
        enabled !== undefined ? enabled : !enabledSenders.has(event.sender.id);
      if (requested && !hasPermission(event.sender.id, "control")) return false;
      if (!requested) releaseHeldInput();
      if (requested) enabledSenders.add(event.sender.id);
      else enabledSenders.delete(event.sender.id);
      console.log(
        `[Input] Controle remoto do Host agora está: ${requested ? "ATIVO" : "PAUSADO"}`,
      );
      return requested;
    },
  );

  // Consulta status de permissão de controle
  ipcMain.handle(IPC_CHANNELS.REMOTE_CONTROL_STATUS, (event) => {
    assertTrusted(event);
    return { enabled: enabledSenders.has(event.sender.id), ready: isReady };
  });
}

/**
 * Retorna se o helper de input está carregado e pronto.
 */
export function isInputReady(): boolean {
  return isReady;
}

/**
 * Encerra o processo helper ao fechar a aplicação.
 */
export function shutdownInputManager(): void {
  releaseHeldInput();
  if (inputProcess && !inputProcess.killed) {
    try {
      inputProcess.stdin?.write("EXIT\n");
      setTimeout(() => {
        if (inputProcess && !inputProcess.killed) {
          inputProcess.kill();
        }
      }, 500);
    } catch {}
  }
}
