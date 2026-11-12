import type { ConnectionDiagnostic } from "./session";
export const DIAGNOSTIC_LABELS = {
  signaling: "Serviço de conexão",
  authentication: "Identidade do dispositivo",
  call: "Autorização da chamada",
  capture: "Captura de tela",
  webrtc: "Vídeo e canais remotos",
};
export function sanitizedDiagnostic(
  input: ConnectionDiagnostic,
  version: string,
) {
  const stats: Record<string, number> = {};
  for (const key of [
    "latencyMs",
    "framesPerSecond",
    "bitrateKbps",
    "packetsLost",
  ] as const) {
    const n = input.stats?.[key];
    if (typeof n === "number" && Number.isFinite(n) && n >= 0 && n < 1e12)
      stats[key] = Math.round(n * 10) / 10;
  }
  return {
    version,
    stage: Object.hasOwn(DIAGNOSTIC_LABELS, input.stage)
      ? input.stage
      : "signaling",
    code: /^[A-Z_]{1,50}$/.test(input.code) ? input.code : "UNKNOWN",
    state: ["waiting", "ready", "failed"].includes(input.state)
      ? input.state
      : "failed",
    stats,
  };
}
