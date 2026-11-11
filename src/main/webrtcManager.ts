import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../shared/ipcChannels';
import type {
  ConnectionState,
  MouseEventData,
  KeyboardEventData,
  FileTransferMetadata,
  FileTransferChunk,
  ClipboardData,
} from '../shared/types';
import { store } from './store';
import { updateConnectionState, removeConnection } from './connectionManager';
import { getSessionWindow } from './windowManager';

// Tipos internos para WebRTC
interface WebRTCSession {
  connectionId: string;
  remoteId: string;
  localId: string;
  pc: RTCPeerConnection | null;
  dataChannel: RTCDataChannel | null;
  screenStream: MediaStream | null;
  remoteStream: MediaStream | null;
  signalingWs: WebSocket | null;
  isConnected: boolean;
  iceCandidates: RTCIceCandidate[];
  fileTransfers: Map<string, {
    fileId: string;
    fileName: string;
    fileSize: number;
    receivedChunks: number;
    totalChunks: number;
    chunks: Buffer[];
  }>;
}

// Armazenamento de sessões WebRTC ativas
const webrtcSessions = new Map<string, WebRTCSession>();

// Configuração ICE servers (STUN público para testes locais)
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

function getOrCreateSession(
  connectionId: string,
  remoteId: string,
  localId: string
): WebRTCSession {
  let session = webrtcSessions.get(connectionId);
  if (!session) {
    session = {
      connectionId,
      remoteId,
      localId,
      pc: null,
      dataChannel: null,
      screenStream: null,
      remoteStream: null,
      signalingWs: null,
      isConnected: false,
      iceCandidates: [],
      fileTransfers: new Map(),
    };
    webrtcSessions.set(connectionId, session);
  }
  return session;
}

function createPeerConnection(session: WebRTCSession): RTCPeerConnection {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

  // Trata candidatos ICE locais
  pc.onicecandidate = (event) => {
    if (event.candidate && session.signalingWs) {
      session.signalingWs.send(
        JSON.stringify({
          type: 'ice-candidate',
          fromId: session.localId,
          targetId: session.remoteId,
          payload: {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
            usernameFragment: event.candidate.usernameFragment,
          },
          timestamp: new Date().toISOString(),
        })
      );
    }
  };

  // Trata track remoto (stream de tela do peer)
  pc.ontrack = (event) => {
    console.log(`[WebRTC] Track remoto recebido: ${event.track.kind}`);
    if (event.track.kind === 'video') {
      session.remoteStream = event.streams[0] ?? null;
      // Notificar renderer via IPC
      const win = BrowserWindow.getFocusedWindow() ?? getSessionWindow();
      if (win) {
        win.webContents.send(IPC_CHANNELS.CONNECTION_STATE, {
          connected: true,
          remoteId: session.remoteId,
          latencyMs: 0,
          bandwidthKbps: 0,
        } as ConnectionState);
      }
    }
  };

  // Estado de conexão
  pc.onconnectionstatechange = () => {
    console.log(`[WebRTC] Estado da conexão ${session.connectionId}: ${pc.connectionState}`);
    session.isConnected = pc.connectionState === 'connected';
    updateConnectionState(session.connectionId, { isConnected: session.isConnected });
  };

  return pc;
}

/**
 * Cria uma oferta de conexão WebRTC (chamado pelo lado que inicia).
 */
export async function createOffer(
  connectionId: string,
  sourceId: string
): Promise<{ sdp: string; type: string }> {
  const session = getOrCreateSession(connectionId, '', store.get('coffeeDeskId.id') as string);
  const localId = store.get('coffeeDeskId.id') as string;
  session.remoteId = ''; // será preenchido quando o remoto responder
  session.localId = localId;

  const pc = createPeerConnection(session);
  session.pc = pc;

  // Cria data channel para arquivos e clipboard
  const dc = pc.createDataChannel('coffee-desk-data', {
    negotiated: false,
    id: 0,
  });
  session.dataChannel = dc;

  setupDataChannel(session, dc);

  // Tenta obter stream de desktop se sourceId fornecido
  if (sourceId) {
    try {
      const stream = await navigatorMediaDevicesGetDisplayMedia(sourceId);
      session.screenStream = stream;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    } catch (err) {
      console.error('[WebRTC] Erro ao capturar tela:', err);
    }
  }

  const offer = await pc.createOffer({
    offerToReceiveAudio: false,
    offerToReceiveVideo: true,
  });
  await pc.setLocalDescription(offer);

  return {
    sdp: offer.sdp ?? '',
    type: offer.type,
  };
}

/**
 * Define a descrição remota (resposta ou oferta).
 */
export async function setRemoteDescription(
  connectionId: string,
  sdp: string,
  type: 'offer' | 'answer'
): Promise<void> {
  const session = webrtcSessions.get(connectionId);
  if (!session?.pc) {
    throw new Error(`Sessão WebRTC não encontrada: ${connectionId}`);
  }

  await session.pc.setRemoteDescription({
    sdp,
    type,
  });

  // Se recebemos uma oferta, criamos resposta
  if (type === 'offer') {
    const answer = await session.pc.createAnswer();
    await session.pc.setLocalDescription(answer);

    if (session.signalingWs) {
      session.signalingWs.send(
        JSON.stringify({
          type: 'answer',
          fromId: session.localId,
          targetId: session.remoteId,
          payload: {
            sdp: answer.sdp,
            type: answer.type,
          },
          timestamp: new Date().toISOString(),
        })
      );
    }
  }
}

/**
 * Adiciona um candidato ICE remoto.
 */
export async function addIceCandidate(
  connectionId: string,
  candidate: {
    candidate: string;
    sdpMid: string | null;
    sdpMLineIndex: number | null;
    usernameFragment: string | null;
  }
): Promise<void> {
  const session = webrtcSessions.get(connectionId);
  if (!session?.pc) return;

  try {
    await session.pc.addIceCandidate({
      candidate: candidate.candidate,
      sdpMid: candidate.sdpMid,
      sdpMLineIndex: candidate.sdpMLineIndex,
      usernameFragment: candidate.usernameFragment,
    });
  } catch (err) {
    console.error('[WebRTC] Erro ao adicionar candidato ICE:', err);
  }
}

/**
 * Envia uma mensagem pelo data channel (arquivo, clipboard, controle).
 */
export function sendDataChannelMessage(
  connectionId: string,
  message: unknown
): boolean {
  const session = webrtcSessions.get(connectionId);
  if (!session?.dataChannel || session.dataChannel.readyState !== 'open') {
    return false;
  }

  try {
    session.dataChannel.send(JSON.stringify(message));
    return true;
  } catch (err) {
    console.error('[WebRTC] Erro ao enviar mensagem:', err);
    return false;
  }
}

/**
 * Configura o data channel (arquivos, clipboard, controle remoto).
 */
function setupDataChannel(session: WebRTCSession, dc: RTCDataChannel): void {
  dc.onopen = () => {
    console.log(`[WebRTC] Data channel aberto: ${session.connectionId}`);
    session.isConnected = true;
    updateConnectionState(session.connectionId, { isConnected: true });
  };

  dc.onclose = () => {
    console.log(`[WebRTC] Data channel fechado: ${session.connectionId}`);
    session.isConnected = false;
  };

  dc.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data as string);
      handleDataChannelMessage(session, message);
    } catch (err) {
      console.error('[WebRTC] Erro ao parsear mensagem do data channel:', err);
    }
  };

  dc.onerror = (err) => {
    console.error('[WebRTC] Erro no data channel:', err);
  };
}

/**
 * Processa mensagens recebidas pelo data channel.
 */
function handleDataChannelMessage(session: WebRTCSession, message: unknown): void {
  const msg = message as { type: string; [key: string]: unknown };

  switch (msg.type) {
    case 'clipboard':
      // Encaminhar para renderer via IPC
      const win = BrowserWindow.getFocusedWindow() ?? getSessionWindow();
      if (win) {
        win.webContents.send(IPC_CHANNELS.CLIPBOARD_CHANGED, msg.payload);
      }
      break;

    case 'file-metadata':
      handleFileMetadata(session, msg as unknown as FileTransferMetadata & { type: string });
      break;

    case 'file-chunk':
      handleFileChunk(session, msg as unknown as FileTransferChunk & { type: string });
      break;

    case 'mouse':
      // Eventos de mouse remoto (se o remoto estiver controlando)
      break;

    case 'keyboard':
      // Eventos de teclado remoto
      break;

    default:
      console.log(`[WebRTC] Mensagem não reconhecida: ${msg.type}`);
  }
}

/**
 * Manipula metadados de arquivo recebidos.
 */
function handleFileMetadata(
  session: WebRTCSession,
  metadata: FileTransferMetadata & { type: string }
): void {
  session.fileTransfers.set(metadata.fileId, {
    fileId: metadata.fileId,
    fileName: metadata.fileName,
    fileSize: metadata.fileSize,
    receivedChunks: 0,
    totalChunks: metadata.totalChunks,
    chunks: [],
  });

  // Notificar renderer
  const win = BrowserWindow.getFocusedWindow() ?? getSessionWindow();
  if (win) {
    win.webContents.send(IPC_CHANNELS.FILE_LIST_RESPONSE, [
      {
        fileId: metadata.fileId,
        fileName: metadata.fileName,
        fileSize: metadata.fileSize,
        status: 'receiving',
      },
    ]);
  }
}

/**
 * Manipula chunk de arquivo recebido.
 */
function handleFileChunk(
  session: WebRTCSession,
  chunk: FileTransferChunk & { type: string }
): void {
  const transfer = session.fileTransfers.get(chunk.fileId);
  if (!transfer) return;

  transfer.chunks.push(Buffer.from(chunk.data));
  transfer.receivedChunks++;

  // Notificar progresso
  const win = BrowserWindow.getFocusedWindow() ?? getSessionWindow();
  if (win) {
    const percent = Math.round((transfer.receivedChunks / transfer.totalChunks) * 100);
    win.webContents.send(IPC_CHANNELS.FILE_TRANSFER_PROGRESS, {
      fileId: chunk.fileId,
      percent,
    });
  }

  // Se último chunk, montar arquivo e salvar
  if (chunk.isLast || transfer.receivedChunks >= transfer.totalChunks) {
    const buffer = Buffer.concat(transfer.chunks);
    const fs = require('fs');
    const path = require('path');
    const downloadsPath = require('electron').app.getPath('downloads');
    const filePath = path.join(downloadsPath, transfer.fileName);

    fs.writeFileSync(filePath, buffer);

    const win2 = BrowserWindow.getFocusedWindow() ?? getSessionWindow();
    if (win2) {
      win2.webContents.send(IPC_CHANNELS.FILE_TRANSFER_COMPLETE, chunk.fileId);
    }
    session.fileTransfers.delete(chunk.fileId);
    console.log(`[WebRTC] Arquivo salvo: ${filePath}`);
  }
}

/**
 * Envia arquivo pelo data channel (dividido em chunks).
 */
export async function sendFile(
  connectionId: string,
  filePath: string
): Promise<{ success: boolean; fileId?: string; error?: string }> {
  const session = webrtcSessions.get(connectionId);
  if (!session?.dataChannel || session.dataChannel.readyState !== 'open') {
    return { success: false, error: 'Data channel não disponível' };
  }

  const fs = require('fs');
  const path = require('path');

  if (!fs.existsSync(filePath)) {
    return { success: false, error: 'Arquivo não encontrado' };
  }

  const fileName = path.basename(filePath);
  const fileSize = fs.statSync(filePath).size;
  const fileId = `file-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const chunkSize = 16384; // 16 KB por chunk
  const totalChunks = Math.ceil(fileSize / chunkSize);

  const fileStream = fs.createReadStream(filePath);

  // Enviar metadados
  const metadata = {
    type: 'file-metadata',
    connectionId: session.connectionId,
    fileId,
    fileName,
    fileSize,
    mimeType: 'application/octet-stream',
    totalChunks,
  };
  session.dataChannel.send(JSON.stringify(metadata));

  let chunkIndex = 0;
  for await (const chunk of fileStream) {
    const chunkMsg = {
      type: 'file-chunk',
      connectionId: session.connectionId,
      fileId,
      chunkIndex,
      data: Buffer.from(chunk).toString('base64'),
      isLast: chunkIndex === totalChunks - 1,
    };
    session.dataChannel.send(JSON.stringify(chunkMsg));
    chunkIndex++;
  }

  fileStream.close();

  return { success: true, fileId };
}

/**
 * Envia dados de clipboard pelo data channel.
 */
export function sendClipboardData(
  connectionId: string,
  data: ClipboardData
): boolean {
  return sendDataChannelMessage(connectionId, {
    type: 'clipboard',
    connectionId,
    payload: data,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Envia evento de mouse pelo data channel.
 */
export function sendMouseEvent(
  connectionId: string,
  data: MouseEventData
): boolean {
  return sendDataChannelMessage(connectionId, {
    type: 'mouse',
    connectionId,
    payload: data,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Envia evento de teclado pelo data channel.
 */
export function sendKeyboardEvent(
  connectionId: string,
  data: KeyboardEventData
): boolean {
  return sendDataChannelMessage(connectionId, {
    type: 'keyboard',
    connectionId,
    payload: data,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Encerra uma sessão WebRTC.
 */
export function closeSession(connectionId: string): void {
  const session = webrtcSessions.get(connectionId);
  if (!session) return;

  if (session.screenStream) {
    session.screenStream.getTracks().forEach((track) => track.stop());
    session.screenStream = null;
  }

  if (session.pc) {
    session.pc.close();
    session.pc = null;
  }

  if (session.dataChannel) {
    session.dataChannel.close();
    session.dataChannel = null;
  }

  if (session.signalingWs) {
    session.signalingWs.close();
    session.signalingWs = null;
  }

  webrtcSessions.delete(connectionId);
  removeConnection(connectionId);
  console.log(`[WebRTC] Sessão encerrada: ${connectionId}`);
}

/**
 * Retorna a sessão WebRTC por connectionId.
 */
export function getWebRTCHession(connectionId: string): WebRTCSession | undefined {
  return webrtcSessions.get(connectionId);
}

/**
 * Simulação de navigator.mediaDevices.getDisplayMedia para Electron (processo Main não tem acesso direto).
 * No renderer, isso será chamado via desktopCapturer + getDisplayMedia.
 */
async function navigatorMediaDevicesGetDisplayMedia(_sourceId: string): Promise<MediaStream> {
  // Esta função é um placeholder — a captura real acontece no renderer via IPC
  // e o stream é repassado para o Main através de uma API bridge
  throw new Error('Captura de tela deve ser iniciada pelo renderer via getDisplayMedia');
}

/**
 * Registra handlers de IPC relacionados a WebRTC.
 */
export function registerWebRTCElectronHandlers(): void {
  // Enviar arquivo
  ipcMain.handle(
    IPC_CHANNELS.FILE_TRANSFER_REQUEST,
    async (_event, { connectionId, filePath }: { connectionId: string; filePath: string }) => {
      return await sendFile(connectionId, filePath);
    }
  );

  // Clipboard
  ipcMain.on(IPC_CHANNELS.CLIPBOARD_SET, (_event, { connectionId, data }: { connectionId: string; data: ClipboardData }) => {
    sendClipboardData(connectionId, data);
  });

}
