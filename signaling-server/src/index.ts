import { WebSocket, WebSocketServer } from "ws";
import http, { IncomingMessage } from "http";

const PORT = process.env.PORT || 8080;
const HEARTBEAT_INTERVAL = 30000;

interface Client {
  ws: WebSocket;
  coffeeDeskId: string;
  isAlive: boolean;
  connectedAt: Date;
  activePeerId?: string;
}

interface SignalingMessage {
  type:
    | "register"
    | "registered"
    | "connect-request"
    | "call-ringing"
    | "incoming-call"
    | "call-accepted"
    | "call-rejected"
    | "offer"
    | "answer"
    | "ice-candidate"
    | "peer-disconnected"
    | "disconnect"
    | "error"
    | "ping"
    | "pong";
  id?: string;
  fromId?: string;
  targetId?: string;
  fromName?: string;
  password?: string;
  reason?: string;
  payload?: unknown;
  message?: string;
  timestamp: string;
}

// Mapeamento de clientes pelo Coffee-Desk ID de 9 dígitos (XXX-XXX-XXX)
const clientsById = new Map<string, Client>();
const clientsByWs = new Map<WebSocket, Client>();

const server = http.createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      name: "Coffee-Desk Signaling Server",
      status: "online",
      activeClients: clientsById.size,
      timestamp: new Date().toISOString(),
    }),
  );
});

const wss = new WebSocketServer({ server });

/**
 * Gera um ID de 9 dígitos no formato XXX-XXX-XXX garantidamente único no servidor.
 */
function generateUniqueCoffeeDeskId(): string {
  let id = "";
  let attempts = 0;
  do {
    const digits = Math.floor(100000000 + Math.random() * 900000000).toString();
    id = digits.replace(/(\d{3})(\d{3})(\d{3})/, "$1-$2-$3");
    attempts++;
  } while (clientsById.has(id) && attempts < 100);
  return id;
}

function heartbeat(client: Client) {
  client.isAlive = true;
}

function sendToClient(targetId: string, message: SignalingMessage): boolean {
  const client = clientsById.get(targetId);
  if (client && client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify(message));
    return true;
  }
  return false;
}

function handleMessage(client: Client, rawData: string) {
  let message: SignalingMessage;
  try {
    message = JSON.parse(rawData);
  } catch {
    client.ws.send(
      JSON.stringify({
        type: "error",
        message: "JSON inválido recebido pelo servidor de sinalização.",
        timestamp: new Date().toISOString(),
      }),
    );
    return;
  }

  const { type, targetId, id, payload, fromName, password, reason } = message;

  switch (type) {
    // Registro inicial do cliente com seu ID permanente ou solicitação de um novo
    case "register": {
      let assignedId = id?.trim();

      // Se o ID informado for inválido (não segue o formato XXX-XXX-XXX), gera um novo
      if (!assignedId || !/^\d{3}-\d{3}-\d{3}$/.test(assignedId)) {
        assignedId = generateUniqueCoffeeDeskId();
      } else {
        const existing = clientsById.get(assignedId);
        if (existing && existing.ws !== client.ws) {
          console.log(
            `[Signaling] Cliente ${assignedId} reconectando. Substituindo socket anterior.`,
          );
          try {
            existing.ws.close(4001, "Substituído por nova conexão");
          } catch {}
          clientsByWs.delete(existing.ws);
        }
      }

      // Desassocia ID anterior deste socket se houver
      if (client.coffeeDeskId && client.coffeeDeskId !== assignedId) {
        clientsById.delete(client.coffeeDeskId);
      }

      client.coffeeDeskId = assignedId;
      clientsById.set(assignedId, client);

      console.log(
        `[Signaling] Cliente registrado com sucesso: ${assignedId} (${clientsById.size} ativos)`,
      );

      client.ws.send(
        JSON.stringify({
          type: "registered",
          id: assignedId,
          timestamp: new Date().toISOString(),
        }),
      );
      break;
    }

    // Solicitação de conexão da Máquina A para a Máquina B
    case "connect-request": {
      if (!targetId) {
        client.ws.send(
          JSON.stringify({
            type: "error",
            message: "O ID de destino é obrigatório.",
            timestamp: new Date().toISOString(),
          }),
        );
        break;
      }

      if (targetId === client.coffeeDeskId) {
        client.ws.send(
          JSON.stringify({
            type: "error",
            message: "Você não pode conectar ao seu próprio computador.",
            timestamp: new Date().toISOString(),
          }),
        );
        break;
      }

      const targetClient = clientsById.get(targetId);
      if (!targetClient || targetClient.ws.readyState !== WebSocket.OPEN) {
        console.log(
          `[Signaling] Tentativa de conexão para ${targetId} falhou: máquina offline`,
        );
        client.ws.send(
          JSON.stringify({
            type: "error",
            message: `O computador remoto (${targetId}) está offline ou não foi encontrado.`,
            timestamp: new Date().toISOString(),
          }),
        );
        break;
      }

      console.log(
        `[Signaling] Encaminhando solicitação de ${client.coffeeDeskId} para ${targetId}`,
      );

      // Notifica o solicitante que está chamando
      client.ws.send(
        JSON.stringify({
          type: "call-ringing",
          targetId,
          timestamp: new Date().toISOString(),
        }),
      );

      // Envia notificação de chamada recebida para a máquina destino
      targetClient.ws.send(
        JSON.stringify({
          type: "incoming-call",
          fromId: client.coffeeDeskId,
          fromName: fromName || `Computador ${client.coffeeDeskId}`,
          password,
          timestamp: new Date().toISOString(),
        }),
      );
      break;
    }

    // Resposta de aceite da Máquina B
    case "call-accepted": {
      if (!targetId) break;
      const callerClient = clientsById.get(targetId);
      if (callerClient && callerClient.ws.readyState === WebSocket.OPEN) {
        console.log(
          `[Signaling] Chamada aceita por ${client.coffeeDeskId} para ${targetId}`,
        );
        client.activePeerId = targetId;
        callerClient.activePeerId = client.coffeeDeskId;

        callerClient.ws.send(
          JSON.stringify({
            type: "call-accepted",
            fromId: client.coffeeDeskId,
            timestamp: new Date().toISOString(),
          }),
        );
      }
      break;
    }

    // Resposta de rejeição da Máquina B
    case "call-rejected": {
      if (!targetId) break;
      const callerClient = clientsById.get(targetId);
      if (callerClient && callerClient.ws.readyState === WebSocket.OPEN) {
        console.log(`[Signaling] Chamada rejeitada por ${client.coffeeDeskId}`);
        callerClient.ws.send(
          JSON.stringify({
            type: "call-rejected",
            fromId: client.coffeeDeskId,
            reason:
              reason || "A solicitação foi recusada pelo computador remoto.",
            timestamp: new Date().toISOString(),
          }),
        );
      }
      break;
    }

    // Encaminhamento de SDP Offer (WebRTC)
    case "offer": {
      if (!targetId) break;
      console.log(
        `[Signaling] Roteando offer de ${client.coffeeDeskId} para ${targetId}`,
      );
      sendToClient(targetId, {
        type: "offer",
        fromId: client.coffeeDeskId,
        targetId,
        payload,
        timestamp: new Date().toISOString(),
      });
      break;
    }

    // Encaminhamento de SDP Answer (WebRTC)
    case "answer": {
      if (!targetId) break;
      console.log(
        `[Signaling] Roteando answer de ${client.coffeeDeskId} para ${targetId}`,
      );
      sendToClient(targetId, {
        type: "answer",
        fromId: client.coffeeDeskId,
        targetId,
        payload,
        timestamp: new Date().toISOString(),
      });
      break;
    }

    // Encaminhamento de candidatos ICE (WebRTC)
    case "ice-candidate": {
      if (!targetId) break;
      sendToClient(targetId, {
        type: "ice-candidate",
        fromId: client.coffeeDeskId,
        targetId,
        payload,
        timestamp: new Date().toISOString(),
      });
      break;
    }

    // The renderer already sends this message when canceling or ending a call.
    // Forward it so the other window can close its request/session too.
    case "disconnect": {
      if (!targetId) break;
      const target = clientsById.get(targetId);
      if (client.activePeerId === targetId) client.activePeerId = undefined;
      if (target?.activePeerId === client.coffeeDeskId)
        target.activePeerId = undefined;
      sendToClient(targetId, {
        type: "peer-disconnected",
        fromId: client.coffeeDeskId,
        timestamp: new Date().toISOString(),
      });
      break;
    }

    case "ping": {
      heartbeat(client);
      client.ws.send(
        JSON.stringify({ type: "pong", timestamp: new Date().toISOString() }),
      );
      break;
    }

    case "pong": {
      heartbeat(client);
      break;
    }

    default:
      console.warn(`[Signaling] Mensagem não tratada: ${type}`);
  }
}

wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
  const client: Client = {
    ws,
    coffeeDeskId: "",
    isAlive: true,
    connectedAt: new Date(),
  };

  clientsByWs.set(ws, client);
  console.log(
    `[Signaling] Nova conexão WebSocket aberta de ${req.socket.remoteAddress}`,
  );

  ws.on("pong", () => {
    heartbeat(client);
  });

  ws.on("message", (data: Buffer) => {
    heartbeat(client);
    handleMessage(client, data.toString());
  });

  ws.on("close", () => {
    if (client.coffeeDeskId) {
      console.log(`[Signaling] Socket fechado para: ${client.coffeeDeskId}`);
      const current = clientsById.get(client.coffeeDeskId);
      // Remove do mapa apenas se o socket fechado for o socket ativo registrado
      if (current && current.ws === ws) {
        clientsById.delete(client.coffeeDeskId);
        // Se estava em chamada ativa, notifica o par
        if (client.activePeerId) {
          sendToClient(client.activePeerId, {
            type: "peer-disconnected",
            fromId: client.coffeeDeskId,
            message: "O computador remoto foi desconectado.",
            timestamp: new Date().toISOString(),
          });
        }
      }
    }
    clientsByWs.delete(ws);
  });

  ws.on("error", (err: Error) => {
    console.error(
      `[Signaling] Erro no socket do cliente (${client.coffeeDeskId || "sem ID"}):`,
      err.message,
    );
  });
});

// Heartbeat a cada 30 segundos
setInterval(() => {
  wss.clients.forEach((ws: WebSocket) => {
    const client = clientsByWs.get(ws);
    if (!client) return;
    if (!client.isAlive) {
      console.log(
        `[Signaling] Terminando conexão inativa: ${client.coffeeDeskId || "sem ID"}`,
      );
      return ws.terminate();
    }
    client.isAlive = false;
    ws.ping();
  });
}, HEARTBEAT_INTERVAL);

server.listen(PORT, () => {
  console.log(
    `[Signaling] Servidor de Sinalização Coffee-Desk ativo na porta ${PORT}`,
  );
});
