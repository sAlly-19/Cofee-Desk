import http, { IncomingMessage } from "http";
import { WebSocket, WebSocketServer } from "ws";
import { randomInt, randomUUID, createPublicKey, verify } from "crypto";
import { createPeerInfo } from "./proxy";
import fs from "fs";
import path from "path";
import { Config } from "./config";
import { database, migrate, activeDevice, transaction } from "./database";
import { Limiter, token, text, deviceId, uuid } from "./security";
import { createAdminApi, HttpError, json } from "./admin";
type Client = {
  ws: WebSocket;
  ip: string;
  id?: string;
  alive: boolean;
  challenge?: string;
  key?: string;
  deadline: ReturnType<typeof setTimeout>;
  queued: number;
  queuedBytes: number;
  tail: Promise<void>;
};
type Call = {
  id: string;
  caller: string;
  target: string;
  state: "pending" | "active";
  timer?: ReturnType<typeof setTimeout>;
};
export async function startServer(config: Config) {
  const peerIp = createPeerInfo(config);
  const pool = database(config.databaseUrl);
  pool.on("error", () => console.error("[Database] Connection error"));
  try {
    if (config.production) {
      const result = await pool.query(
        "SELECT max(version) AS version FROM schema_migrations",
      );
      if (Number(result.rows[0].version) < 1)
        throw new Error("Database migration required");
    } else await migrate(pool);
  } catch (error) {
    await pool.end();
    throw error;
  }
  const limiter = new Limiter(),
    clients = new Set<Client>(),
    byId = new Map<string, Client>(),
    calls = new Map<string, Call>(),
    byCall = new Map<string, string>();
  function send(client: Client | undefined, value: object) {
    if (!client || client.ws.readyState !== WebSocket.OPEN) return;
    if (client.ws.bufferedAmount > config.maxBuffered) {
      client.ws.terminate();
      return;
    }
    client.ws.send(
      JSON.stringify({ ...value, timestamp: new Date().toISOString() }),
    );
  }
  function error(client: Client, code: string, message: string) {
    send(client, { type: "error", code, message });
  }
  function endCall(call: Call, reason = "Sessão encerrada", code = "ENDED") {
    if (call.timer) clearTimeout(call.timer);
    calls.delete(call.id);
    if (byCall.get(call.caller) === call.id) byCall.delete(call.caller);
    if (byCall.get(call.target) === call.id) byCall.delete(call.target);
    for (const [id, other] of [
      [call.caller, call.target],
      [call.target, call.caller],
    ])
      send(byId.get(id), {
        type: "peer-disconnected",
        callId: call.id,
        fromId: other,
        message: reason,
        code,
      });
  }
  async function sanction(id: string) {
    const callId = byCall.get(id);
    if (callId && calls.has(callId))
      endCall(
        calls.get(callId)!,
        "Acesso revogado pela administração",
        "SANCTIONED",
      );
    const client = byId.get(id);
    if (client) {
      send(client, {
        type: "access-revoked",
        id,
        code: "SANCTIONED",
        message: "Este dispositivo está suspenso. Contate o administrador.",
      });
      client.ws.close(4403, "Access revoked");
    }
  }
  const admin = await createAdminApi(pool, config, limiter, sanction, (id) =>
    byId.has(id),
  );
  const server = http.createServer((req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    );
    if (config.production)
      res.setHeader("Strict-Transport-Security", "max-age=31536000");
    const { ip, secure } = peerIp(req);
    void (async () => {
      if (
        config.production &&
        !secure &&
        !(
          config.proxyProvider === "render" &&
          req.method === "GET" &&
          req.url === "/health"
        )
      )
        throw new HttpError(403, "HTTPS required");
      if (req.method === "GET" && req.url === "/health") {
        await pool.query("SELECT 1");
        return json(res, 200, { status: "ok", version: "1.0.1" });
      }
      if (req.url?.startsWith("/api/admin/")) return admin(req, res, ip);
      if (req.method !== "GET") throw new HttpError(405, "Method not allowed");
      const url = new URL(req.url ?? "/", config.publicOrigin);
      if (!url.pathname.startsWith("/admin"))
        throw new HttpError(404, "Not found");
      const root = path.resolve(__dirname, "../admin-dist");
      const relative = url.pathname.replace(/^\/admin\/?/, "") || "index.html";
      const filename = path.resolve(root, relative);
      if (!filename.startsWith(root + path.sep))
        throw new HttpError(404, "Not found");
      if (!fs.existsSync(filename) || !fs.statSync(filename).isFile())
        throw new HttpError(404, "Build the administrative panel first");
      const types: Record<string, string> = {
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".png": "image/png",
        ".svg": "image/svg+xml",
        ".ttf": "font/ttf",
      };
      res.setHeader(
        "Content-Type",
        types[path.extname(filename)] ?? "application/octet-stream",
      );
      fs.createReadStream(filename)
        .on("error", () => res.destroy())
        .pipe(res);
    })().catch((e) => {
      if (!res.headersSent)
        json(res, e instanceof HttpError ? e.status : 503, {
          error:
            e instanceof HttpError
              ? e.message
              : "Serviço temporariamente indisponível",
        });
      else res.destroy();
    });
  });
  server.maxConnections = config.maxConnections * 2;
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;
  server.maxHeadersCount = 50;
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: config.maxPayload,
    perMessageDeflate: false,
    clientTracking: false,
  });
  server.on("upgrade", (req, socket, head) => {
    const { ip, secure } = peerIp(req),
      origin = req.headers.origin;
    if (
      req.url !== "/ws" ||
      (config.production && !secure) ||
      (origin && !config.allowedOrigins.has(origin)) ||
      clients.size >= config.maxConnections ||
      [...clients].filter((c) => c.ip === ip).length >= config.maxPerIp ||
      !limiter.allow("upgrade:" + ip, 60, 60000)
    ) {
      socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) =>
      wss.emit("connection", ws, req),
    );
  });
  async function register(client: Client, key: string) {
    return transaction(pool, async (db) => {
      await db.query("SELECT pg_advisory_xact_lock(101003)");
      let device = (
        await db.query("SELECT * FROM devices WHERE public_key=$1", [key])
      ).rows[0];
      if (!device) {
        if (
          !limiter.allow(
            "register:" + client.ip,
            config.registrationLimit,
            3600000,
          )
        )
          throw new HttpError(429, "Cadastro temporariamente limitado");
        const count = Number(
          (await db.query("SELECT count(*) FROM devices")).rows[0].count,
        );
        if (count >= config.maxDevices)
          throw new HttpError(503, "Capacidade de dispositivos atingida");
        for (let i = 0; i < 100; i++) {
          const raw = String(randomInt(100000000, 1000000000));
          const id =
            raw.slice(0, 3) + "-" + raw.slice(3, 6) + "-" + raw.slice(6);
          const inserted = await db.query(
            "INSERT INTO devices(id,public_key) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING *",
            [id, key],
          );
          if (inserted.rowCount) {
            device = inserted.rows[0];
            break;
          }
        }
        if (!device) throw new Error("ID allocation failed");
      }
      return device;
    });
  }
  async function message(client: Client, raw: string) {
    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      error(client, "INVALID", "JSON inválido");
      return;
    }
    if (
      !data ||
      typeof data !== "object" ||
      Array.isArray(data) ||
      !text(data.type, 1, 32)
    ) {
      error(client, "INVALID", "Mensagem inválida");
      return;
    }
    if (!client.id) {
      if (
        data.type === "hello" &&
        data.version === 2 &&
        !client.challenge &&
        text(data.publicKey, 40, 100)
      ) {
        try {
          const key = createPublicKey({
            key: Buffer.from(data.publicKey, "base64"),
            format: "der",
            type: "spki",
          });
          if (
            key.asymmetricKeyType !== "ed25519" ||
            key.export({ format: "der", type: "spki" }).toString("base64") !==
              data.publicKey
          )
            throw new Error();
        } catch {
          error(client, "AUTH", "Chave inválida");
          client.ws.close(4401);
          return;
        }
        client.key = data.publicKey;
        client.challenge = token();
        send(client, {
          type: "challenge",
          nonce: client.challenge,
          audience: config.publicOrigin,
          version: 2,
        });
        return;
      }
      if (
        data.type === "authenticate" &&
        client.challenge &&
        client.key &&
        text(data.signature, 80, 100)
      ) {
        const nonce = client.challenge;
        client.challenge = undefined;
        const key = createPublicKey({
          key: Buffer.from(client.key, "base64"),
          format: "der",
          type: "spki",
        });
        const signed =
          "coffee-desk:v2\n" +
          config.publicOrigin +
          "\n" +
          nonce +
          "\n" +
          client.key;
        if (
          !verify(
            null,
            Buffer.from(signed),
            key,
            Buffer.from(data.signature, "base64"),
          )
        ) {
          error(client, "AUTH", "Autenticação inválida");
          client.ws.close(4401);
          return;
        }
        const device = await register(client, client.key);
        const current = await activeDevice(pool, device.id);
        if (current.status !== "active") {
          send(client, {
            type: "access-revoked",
            id: device.id,
            code: "SANCTIONED",
            message: "Este dispositivo está suspenso",
          });
          client.ws.close(4403);
          return;
        }
        if (client.ws.readyState !== WebSocket.OPEN) return;
        const previous = byId.get(device.id);
        if (previous) {
          const callId = byCall.get(device.id);
          if (callId && calls.has(callId)) endCall(calls.get(callId)!);
          previous.ws.close(4001, "Authenticated reconnect");
        }
        client.id = device.id;
        byId.set(device.id, client);
        clearTimeout(client.deadline);
        await pool.query("UPDATE devices SET last_seen=now() WHERE id=$1", [
          device.id,
        ]);
        send(client, { type: "registered", id: device.id, version: 2 });
        return;
      }
      error(client, "UPGRADE_REQUIRED", "Atualize o Coffee Desk para 1.0.1");
      client.ws.close(4406, "Protocol v2 required");
      return;
    }
    if (["hello", "authenticate", "register"].includes(data.type)) {
      error(client, "STATE", "Identidade já autenticada");
      return;
    }
    const device = await activeDevice(pool, client.id);
    if (!device || device.status !== "active") {
      await sanction(client.id);
      return;
    }
    if (client.ws.readyState !== WebSocket.OPEN) return;
    if (data.type === "ping") {
      send(client, { type: "pong" });
      return;
    }
    if (data.type === "report-device") {
      if (
        !limiter.allow("reports:" + client.id, config.reportLimit, 3600000) ||
        !limiter.allow(
          "reports-ip:" + client.ip,
          config.reportLimit * 2,
          3600000,
        )
      ) {
        error(client, "LIMIT", "Limite de denúncias atingido");
        return;
      }
      if (
        !deviceId(data.targetId) ||
        data.targetId === client.id ||
        !["spam", "fraud", "unauthorized", "other"].includes(data.category) ||
        !text(data.description, 10, 2000) ||
        (data.callId !== undefined && !uuid(data.callId))
      ) {
        error(client, "INVALID", "Denúncia inválida");
        return;
      }
      if (
        !(
          await pool.query("SELECT 1 FROM devices WHERE id=$1", [data.targetId])
        ).rowCount
      ) {
        error(client, "INVALID", "Dispositivo não encontrado");
        return;
      }
      if (data.callId) {
        const call = calls.get(data.callId);
        if (
          !call ||
          ![call.caller, call.target].includes(client.id) ||
          ![call.caller, call.target].includes(data.targetId)
        ) {
          error(client, "INVALID", "Sessão inválida");
          return;
        }
      }
      const id = randomUUID();
      await pool.query(
        "INSERT INTO reports(id,reporter_id,device_id,category,description,call_id) VALUES($1,$2,$3,$4,$5,$6)",
        [
          id,
          client.id,
          data.targetId,
          data.category,
          data.description,
          data.callId ?? null,
        ],
      );
      send(client, { type: "report-received", id });
      return;
    }
    if (!deviceId(data.targetId)) {
      error(client, "INVALID", "ID de destino inválido");
      return;
    }
    if (data.type === "connect-request") {
      if (
        !limiter.allow("call:" + client.id, config.callLimit, 60000) ||
        !limiter.allow("call-ip:" + client.ip, config.callLimit * 2, 60000)
      ) {
        error(client, "LIMIT", "Muitas chamadas. Aguarde.");
        return;
      }
      if (
        data.password !== undefined &&
        (!text(data.password, 1, 256) ||
          !limiter.allow(
            "pwd:" + client.id + ":" + data.targetId,
            config.passwordLimit,
            900000,
          ) ||
          !limiter.allow(
            "pwd-ip:" + client.ip + ":" + data.targetId,
            config.passwordLimit,
            900000,
          ))
      ) {
        error(client, "LIMIT", "Tentativas de acesso limitadas");
        return;
      }
      if (data.fromName !== undefined && !text(data.fromName, 1, 80)) {
        error(client, "INVALID", "Nome inválido");
        return;
      }
      const target = byId.get(data.targetId);
      const targetDevice = await activeDevice(pool, data.targetId);
      if (
        data.targetId === client.id ||
        !target ||
        target.ws.readyState !== WebSocket.OPEN ||
        targetDevice?.status !== "active" ||
        byCall.has(client.id) ||
        byCall.has(data.targetId)
      ) {
        error(client, "UNAVAILABLE", "Dispositivo indisponível ou ocupado");
        return;
      }
      const call: Call = {
        id: randomUUID(),
        caller: client.id,
        target: data.targetId,
        state: "pending",
      };
      calls.set(call.id, call);
      byCall.set(call.caller, call.id);
      byCall.set(call.target, call.id);
      call.timer = setTimeout(
        () => endCall(call, "Solicitação expirada", "EXPIRED"),
        config.callTimeout,
      );
      send(client, {
        type: "call-ringing",
        callId: call.id,
        targetId: call.target,
      });
      send(target, {
        type: "incoming-call",
        callId: call.id,
        fromId: client.id,
        fromName: data.fromName ?? "Computador remoto",
        ...(data.password ? { password: data.password } : {}),
      });
      return;
    }
    if (!uuid(data.callId)) {
      error(client, "STATE", "Sessão inválida");
      return;
    }
    const call = calls.get(data.callId);
    if (
      !call ||
      ![call.caller, call.target].includes(client.id) ||
      ![call.caller, call.target].includes(data.targetId) ||
      data.targetId === client.id
    ) {
      error(client, "FORBIDDEN", "Operação não autorizada");
      return;
    }
    if (data.type === "call-accepted" || data.type === "call-rejected") {
      if (call.state !== "pending" || client.id !== call.target) {
        error(client, "STATE", "Solicitação inválida");
        return;
      }
      if (data.type === "call-rejected") {
        send(byId.get(call.caller), {
          type: "call-rejected",
          callId: call.id,
          fromId: client.id,
          reason: "Solicitação recusada",
        });
        if (call.timer) clearTimeout(call.timer);
        calls.delete(call.id);
        byCall.delete(call.caller);
        byCall.delete(call.target);
        return;
      }
      clearTimeout(call.timer);
      call.state = "active";
      send(byId.get(call.caller), {
        type: "call-accepted",
        callId: call.id,
        fromId: client.id,
      });
      return;
    }
    if (data.type === "disconnect") {
      endCall(call);
      return;
    }
    if (call.state !== "active") {
      error(client, "STATE", "Sessão não autorizada");
      return;
    }
    if (["offer", "answer"].includes(data.type)) {
      const expected = data.type === "offer" ? call.target : call.caller;
      if (
        client.id !== expected ||
        !data.payload ||
        typeof data.payload !== "object" ||
        !text(data.payload.sdp, 1, 100000)
      ) {
        error(client, "INVALID", "SDP inválido");
        return;
      }
      send(byId.get(data.targetId), {
        type: data.type,
        callId: call.id,
        fromId: client.id,
        targetId: data.targetId,
        payload: { sdp: data.payload.sdp },
      });
      return;
    }
    if (data.type === "ice-candidate") {
      const p = data.payload;
      if (
        !p ||
        typeof p !== "object" ||
        typeof p.candidate !== "string" ||
        p.candidate.length > 4096 ||
        (p.sdpMid !== null &&
          p.sdpMid !== undefined &&
          !text(p.sdpMid, 0, 128)) ||
        (p.sdpMLineIndex !== null &&
          p.sdpMLineIndex !== undefined &&
          (!Number.isInteger(p.sdpMLineIndex) ||
            p.sdpMLineIndex < 0 ||
            p.sdpMLineIndex > 100))
      ) {
        error(client, "INVALID", "Candidato ICE inválido");
        return;
      }
      send(byId.get(data.targetId), {
        type: data.type,
        callId: call.id,
        fromId: client.id,
        payload: {
          candidate: p.candidate,
          sdpMid: p.sdpMid ?? null,
          sdpMLineIndex: p.sdpMLineIndex ?? null,
          usernameFragment:
            typeof p.usernameFragment === "string"
              ? p.usernameFragment.slice(0, 256)
              : null,
        },
      });
      return;
    }
    error(client, "INVALID", "Mensagem não suportada");
  }
  let queuedBytes = 0;
  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const ip = peerIp(req).ip;
    const client: Client = {
      ws,
      ip,
      alive: true,
      queued: 0,
      queuedBytes: 0,
      tail: Promise.resolve(),
      deadline: setTimeout(
        () => ws.close(4401, "Authentication timed out"),
        config.authTimeout,
      ),
    };
    clients.add(client);
    ws.on("pong", () => {
      client.alive = true;
    });
    ws.on("message", (raw, isBinary) => {
      const bytes = Buffer.isBuffer(raw)
        ? raw.length
        : Buffer.byteLength(raw.toString());
      if (
        isBinary ||
        client.queued >= 32 ||
        client.queuedBytes + bytes > config.maxPayload * 4 ||
        queuedBytes + bytes > config.maxQueueBytes ||
        !limiter.allow(
          "msg:" + ip,
          config.messageLimit * config.maxPerIp,
          60000,
        ) ||
        !limiter.allow(
          "msg-device:" + (client.id ?? client.ip),
          config.messageLimit,
          60000,
        )
      ) {
        ws.close(4408, "Rate or payload limit");
        return;
      }
      client.queued++;
      client.queuedBytes += bytes;
      queuedBytes += bytes;
      client.tail = client.tail
        .then(() => message(client, raw.toString()))
        .catch((e) => {
          error(
            client,
            e instanceof HttpError ? "LIMIT" : "UNAVAILABLE",
            e instanceof HttpError
              ? e.message
              : "Serviço temporariamente indisponível",
          );
          if (!client.id) ws.close(4401);
        })
        .finally(() => {
          client.queued--;
          client.queuedBytes -= bytes;
          queuedBytes -= bytes;
        });
    });
    ws.on("error", () => {});
    ws.on("close", () => {
      clearTimeout(client.deadline);
      clients.delete(client);
      if (client.id && byId.get(client.id) === client) {
        byId.delete(client.id);
        const callId = byCall.get(client.id);
        if (callId && calls.has(callId))
          endCall(calls.get(callId)!, "Computador desconectado");
        void pool
          .query("UPDATE devices SET last_seen=now() WHERE id=$1", [client.id])
          .catch(() => {});
      }
    });
  });
  const heartbeat = setInterval(() => {
    for (const client of clients) {
      if (!client.alive) {
        client.ws.terminate();
        continue;
      }
      client.alive = false;
      client.ws.ping();
    }
  }, 15000);
  heartbeat.unref();
  const cleanup = setInterval(
    () =>
      void pool
        .query("DELETE FROM admin_sessions WHERE expires_at<=now()")
        .catch(() => {}),
    60000,
  );
  cleanup.unref();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.port, config.host, () => {
      server.off("error", reject);
      resolve();
    });
  });
  return {
    port: (server.address() as any).port,
    pool,
    close: async () => {
      clearInterval(heartbeat);
      clearInterval(cleanup);
      for (const call of [...calls.values()])
        endCall(call, "Servidor reiniciando");
      for (const client of clients) client.ws.terminate();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      wss.close();
      await pool.end();
    },
  };
}
