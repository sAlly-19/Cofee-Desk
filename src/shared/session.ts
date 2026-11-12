export interface SessionPermissions {
  control: boolean;
  clipboard: boolean;
  files: boolean;
}
export const FULL_PERMISSIONS: SessionPermissions = {
  control: true,
  clipboard: true,
  files: true,
};
export const VIEW_ONLY: SessionPermissions = {
  control: false,
  clipboard: false,
  files: false,
};
export const PERMISSION_CAPABILITY = "session-permissions-v1";
export function validPermissions(value: unknown): value is SessionPermissions {
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  return (
    Object.keys(p).length === 3 &&
    ["control", "clipboard", "files"].every((k) => typeof p[k] === "boolean")
  );
}
export type SessionResult =
  | "calling"
  | "active"
  | "completed"
  | "rejected"
  | "cancelled"
  | "failed"
  | "legacy";
export interface SessionHistoryEntry {
  id: string;
  callId?: string;
  remoteId: string;
  name: string;
  direction: "incoming" | "outgoing";
  result: SessionResult;
  startedAt: string | null;
  acceptedAt?: string | null;
  endedAt?: string | null;
  reason?: string;
}
export interface DiagnosticStats {
  latencyMs?: number;
  framesPerSecond?: number;
  bitrateKbps?: number;
  packetsLost?: number;
}
export interface ConnectionDiagnostic {
  stage: "signaling" | "authentication" | "call" | "capture" | "webrtc";
  code: string;
  state: "waiting" | "ready" | "failed";
  stats?: DiagnosticStats;
}
export interface CaptureSelection {
  sourceId: string;
  kind: "screen" | "window";
}
