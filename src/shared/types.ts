// Tipos compartilhados entre Main, Renderer e Signaling Server

export interface CoffeeDeskId {
  id: string; // UUID v4 gerado na primeira execução
  createdAt: string;
}

export interface SessionInfo {
  myId: string;
  isConnected: boolean;
  remoteId: string | null;
  connectionId: string | null;
  connectedAt: string | null;
}

export interface RemoteConnectionRequest {
  connectionId: string;
  fromId: string;
  toId: string;
  timestamp: string;
}

export interface ConnectionState {
  connected: boolean;
  remoteId: string | null;
  latencyMs: number;
  bandwidthKbps: number;
}

export interface MouseEventData {
  x: number;
  y: number;
  normX?: number;
  normY?: number;
  button?: "left" | "right" | "middle";
  type: "move" | "click" | "scroll" | "drag" | "down" | "up" | "double";
  scrollDelta?: { x: number; y: number };
}

export interface KeyboardEventData {
  key: string;
  code: string;
  keyCode?: number;
  type: "press" | "release" | "down" | "up" | "text";
  text?: string;
  modifiers: {
    shift: boolean;
    ctrl: boolean;
    alt: boolean;
    meta: boolean;
  };
}

export interface FileTransferMetadata {
  connectionId: string;
  fileId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  totalChunks: number;
}

export interface FileTransferChunk {
  connectionId: string;
  fileId: string;
  chunkIndex: number;
  data: ArrayBuffer;
  isLast: boolean;
}

export interface ClipboardData {
  type: "text" | "html" | "image" | "file";
  content: string; // texto ou base64
  files?: string[]; // caminhos de arquivos
}

export interface DesktopSource {
  isPrimary?: boolean;
  id: string;
  name: string;
  thumbnail: string; // URL ou base64
  displayId: string;
}

export interface AppError {
  code: string;
  message: string;
  timestamp: string;
  fatal: boolean;
}

// WebRTC
export interface WebRTCOffer {
  connectionId: string;
  sdp: string;
  type: "offer";
}

export interface WebRTCAnswer {
  connectionId: string;
  sdp: string;
  type: "answer";
}

export interface WebRTCIceCandidate {
  connectionId: string;
  candidate: {
    candidate: string;
    sdpMid: string | null;
    sdpMLineIndex: number | null;
    usernameFragment: string | null;
  };
}

// Transferência de arquivo (status)
export interface FileTransferItem {
  fileId: string;
  fileName: string;
  fileSize: number;
  status:
    "pending" | "sending" | "receiving" | "complete" | "cancelled" | "error";
  progress: number;
  direction: "upload" | "download";
  speedBytesPerSec?: number;
  transferredBytes?: number;
  savedPath?: string;
  error?: string;
}

// Clipboard (histórico sincronizado)
export interface ClipboardHistoryItem {
  id: string;
  type: "text" | "html" | "image" | "file";
  content: string;
  timestamp: string;
  sourceId: string;
}
