import { store } from "./store";
import { app, ipcMain, BrowserWindow, type WebContents } from "electron";
import { assertTrusted } from "./ipcSecurity";
import { deviceAuthentication, unattendedPolicy } from "./deviceSecurity";
import {
  setNativeSession,
  isInstalling,
  setTransportBusy,
  setPendingHost,
  selectedSource,
} from "./sessionAuthority";
import {
  validAcceptance,
  supportsSessionConfirmation,
  SERVER_UPGRADE_MESSAGE,
} from "../shared/signalingCompatibility";
import { validPermissions, type SessionPermissions } from "../shared/session";

const validId = (v: unknown): v is string =>
  typeof v === "string" && /^\d{3}-\d{3}-\d{3}$/.test(v);
const validCall = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v,
  );
type Packet = Record<string, any>;
type PendingCall = {
  id: string;
  peer: string;
  role: "host" | "client";
  accepted: boolean;
  active: boolean;
  passwordVerifier?: string;
};
/** Owns the authenticated socket; renderer may request actions but never supply server events. */
export class NativeSignalingConnection {
  private socket?: WebSocket;
  private ended = false;
  private registered = false;
  private challenged = false;
  private call?: PendingCall;
  private requestedTarget?: string;
  private cancelRequested = false;
  private deadline?: ReturnType<typeof setTimeout>;
  private heartbeat?: ReturnType<typeof setInterval>;
  private lastPong = Date.now();
  private queued = 0;
  private tail = Promise.resolve();
  constructor(
    private owner: WebContents,
    private connection: string,
    private profile: string,
    private socketFactory: (url: string) => WebSocket = (url) =>
      new WebSocket(url),
  ) {}
  private emit(kind: string, extra: object = {}) {
    if (!this.owner.isDestroyed())
      this.owner.send("signaling:event", {
        connection: this.connection,
        kind,
        ...extra,
      });
  }
  private revoke() {
    this.call = undefined;
    this.requestedTarget = undefined;
    this.cancelRequested = false;
    setTransportBusy(this.owner.id, false);
    setPendingHost(this.owner.id);
    setNativeSession(this.owner.id);
  }
  async start() {
    const auth = deviceAuthentication(this.profile);
    const publicKey = await auth.publicKey();
    if (this.ended) return;
    const ws = this.socketFactory(auth.url);
    this.socket = ws;
    this.deadline = setTimeout(() => {
      this.emit("error");
      this.close(1006);
    }, 45000);
    ws.onopen = () => {
      if (this.ended) return;
      clearTimeout(this.deadline);
      this.deadline = setTimeout(() => this.close(4401), 10000);
      this.emit("open");
      this.write({
        type: "hello",
        version: 2,
        publicKey,
        capabilities: ["session-permissions-v1"],
      });
    };
    ws.onerror = () => {
      this.emit("error");
      this.close(1006);
    };
    ws.onclose = (e) => this.close(e.code);
    ws.onmessage = (event) => {
      if (this.ended) return;
      if (
        typeof event.data !== "string" ||
        event.data.length > 131072 ||
        this.queued >= 32
      ) {
        this.close(4408);
        return;
      }
      this.queued++;
      this.tail = this.tail
        .then(async () => {
          if (this.ended) return;
          const m: Packet = JSON.parse(event.data);
          if (
            !m ||
            typeof m !== "object" ||
            Array.isArray(m) ||
            typeof m.type !== "string"
          )
            throw Error("Invalid packet");
          if (m.type === "challenge") {
            if (this.registered || this.challenged)
              throw Error("Invalid challenge state");
            this.challenged = true;
            const signature = await auth.sign(m.nonce, m.audience);
            if (!this.ended) this.write({ type: "authenticate", signature });
            return;
          }
          if (m.type === "registered") {
            if (m.version !== 2 || !supportsSessionConfirmation(m)) {
              this.emit("message", {
                message: {
                  type: "error",
                  code: "UPGRADE_REQUIRED",
                  message: SERVER_UPGRADE_MESSAGE,
                },
              });
              this.close(4406);
              return;
            }
            if (
              !this.challenged ||
              this.registered ||
              m.version !== 2 ||
              !validId(m.id) ||
              !supportsSessionConfirmation(m)
            )
              throw Error("Invalid registration");
            store.set("coffeeDeskId.id", m.id);
            this.registered = true;
            clearTimeout(this.deadline);
            this.lastPong = Date.now();
            this.heartbeat = setInterval(() => {
              if (Date.now() - this.lastPong > 45000) this.close(1006);
              else this.write({ type: "ping" });
            }, 15000);
          } else if (m.type === "pong") this.lastPong = Date.now();
          else if (m.type === "access-revoked") this.revoke();
          else if (m.type !== "error") {
            if (!this.registered) throw Error("Unauthenticated packet");
            if (m.type === "incoming-call" || m.type === "call-ringing") {
              const peer = m.fromId ?? m.targetId;
              if (
                this.call ||
                !validCall(m.callId) ||
                !validId(peer) ||
                (m.type === "call-ringing" && peer !== this.requestedTarget)
              )
                throw Error("Invalid call");
              setTransportBusy(this.owner.id, true);
              setPendingHost(
                this.owner.id,
                m.type === "incoming-call" ? m.callId : undefined,
              );
              this.call = {
                id: m.callId,
                peer,
                role: m.type === "incoming-call" ? "host" : "client",
                accepted: false,
                active: false,
                passwordVerifier:
                  m.type === "incoming-call" && typeof m.password === "string"
                    ? unattendedPolicy(this.profile).verifier
                    : undefined,
              };
              if (this.cancelRequested) {
                this.endCall();
                return;
              }
            } else if (
              [
                "call-accepted",
                "permissions-updated",
                "call-rejected",
                "peer-disconnected",
                "offer",
                "answer",
                "ice-candidate",
              ].includes(m.type)
            ) {
              const call = this.call;
              if (!call || m.callId !== call.id || m.fromId !== call.peer)
                return;
              if (m.type === "call-accepted") {
                if (
                  call.active ||
                  !validAcceptance(m, call.role) ||
                  (call.role === "host" && !call.accepted)
                )
                  throw Error("Invalid acceptance");
                call.active = true;
                setNativeSession(this.owner.id, {
                  callId: call.id,
                  role: call.role,
                  permissions: { ...m.permissions },
                });
              } else if (m.type === "permissions-updated") {
                if (
                  !call.active ||
                  !validPermissions(m.permissions) ||
                  !["screen", "window"].includes(m.sourceKind) ||
                  (m.sourceKind === "window" && m.permissions.control)
                )
                  throw Error("Invalid permissions");
                setNativeSession(this.owner.id, {
                  callId: call.id,
                  role: call.role,
                  permissions: { ...m.permissions },
                });
              } else if (
                ["call-rejected", "peer-disconnected"].includes(m.type)
              )
                this.revoke();
              else if (!call.active) throw Error("Signaling before consent");
            }
          }
          if (m.type === "error" && !this.call) this.revoke();
          this.emit("message", { message: m });
        })
        .catch(() => {
          this.emit("error");
          this.close(4401);
        })
        .finally(() => {
          this.queued--;
        });
    };
  }
  private write(packet: object) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN || this.ended)
      return;
    const raw = JSON.stringify(packet);
    if (raw.length > 131072 || this.socket.bufferedAmount > 262144) {
      this.close(4408);
      return;
    }
    this.socket.send(raw);
  }
  send(value: unknown) {
    if (
      !this.registered ||
      this.ended ||
      !value ||
      typeof value !== "object" ||
      Array.isArray(value)
    )
      throw Error("Sinalização não autorizada");
    const m = value as Packet;
    if (JSON.stringify(m).length > 65536) throw Error("Mensagem muito grande");
    if (m.type === "ping") {
      this.write({ type: "ping" });
      return;
    }
    if (m.type === "report-device") {
      if (
        !validId(m.targetId) ||
        !["spam", "fraud", "unauthorized", "other"].includes(m.category) ||
        typeof m.description !== "string" ||
        m.description.length < 10 ||
        m.description.length > 2000
      )
        throw Error("Denúncia inválida");
      this.write({
        type: m.type,
        targetId: m.targetId,
        category: m.category,
        description: m.description,
        ...(m.callId === this.call?.id ? { callId: m.callId } : {}),
      });
      return;
    }
    if (m.type === "connect-request") {
      if (
        !validId(m.targetId) ||
        this.call ||
        this.requestedTarget ||
        (m.password !== undefined &&
          (typeof m.password !== "string" || m.password.length > 256))
      )
        throw Error("Solicitação inválida");
      this.requestedTarget = m.targetId;
      this.cancelRequested = false;
      setTransportBusy(this.owner.id, true);
      this.write({
        type: m.type,
        targetId: m.targetId,
        ...(typeof m.password === "string" ? { password: m.password } : {}),
      });
      return;
    }
    const call = this.call;
    if (!call || m.callId !== call.id || m.targetId !== call.peer)
      throw Error("Chamada não autorizada");
    const packet: Packet = {
      type: m.type,
      callId: call.id,
      targetId: call.peer,
    };
    if (["call-accepted", "call-rejected"].includes(m.type)) {
      if (call.role !== "host" || call.active) throw Error("Aceite inválido");
      if (m.type === "call-accepted") {
        if (call.accepted) return;
        if (
          !validPermissions(m.permissions) ||
          !["screen", "window"].includes(m.sourceKind)
        )
          throw Error("Permissões inválidas");
        if (m.unattended === true) {
          const policy = unattendedPolicy(this.profile);
          const source = selectedSource(this.owner.id);
          if (
            !policy.enabled ||
            !call.passwordVerifier ||
            policy.verifier !== call.passwordVerifier ||
            !source?.isPrimary ||
            source.sourceKind !== "screen" ||
            (Object.keys(m.permissions) as (keyof SessionPermissions)[]).some(
              (key) => m.permissions[key] && !policy.permissions[key],
            )
          )
            throw Error("Acesso automático não autorizado");
        }
        call.accepted = true;
        packet.permissions = m.permissions;
        packet.sourceKind = m.sourceKind;
      }
    } else if (m.type === "permissions-update") {
      if (
        !call.active ||
        call.role !== "host" ||
        !validPermissions(m.permissions) ||
        !["screen", "window"].includes(m.sourceKind)
      )
        throw Error("Permissões inválidas");
      packet.permissions = m.permissions as SessionPermissions;
      packet.sourceKind = m.sourceKind;
    } else if (["offer", "answer", "ice-candidate"].includes(m.type)) {
      if (
        !call.active ||
        (m.type === "offer" && call.role !== "host") ||
        (m.type === "answer" && call.role !== "client")
      )
        throw Error("Negociação inválida");
      packet.payload = m.payload;
    } else if (m.type !== "disconnect") throw Error("Operação não permitida");
    this.write(packet);
    if (m.type === "disconnect" || m.type === "call-rejected") this.revoke();
  }
  endCall() {
    if (this.call) {
      this.write({
        type: "disconnect",
        callId: this.call.id,
        targetId: this.call.peer,
      });
      this.revoke();
    } else if (this.requestedTarget) {
      this.cancelRequested = true;
      setNativeSession(this.owner.id);
    } else this.revoke();
  }
  close(code = 1000) {
    if (this.ended) return;
    this.ended = true;
    clearTimeout(this.deadline);
    clearInterval(this.heartbeat);
    this.revoke();
    const ws = this.socket;
    if (ws && ws.readyState < WebSocket.CLOSING) ws.close();
    this.emit("close", { code });
  }
}
export function registerSignalingTransport(
  profileForSender: (owner: WebContents) => string = () =>
    app.getPath("userData"),
  socketFactory?: (url: string) => WebSocket,
) {
  const owners = new Map<
    number,
    { token: string; socket: NativeSignalingConnection }
  >();
  const tracked = new Set<number>();
  ipcMain.handle("signaling:open", (event, token: unknown) => {
    assertTrusted(event);
    if (typeof token !== "string" || !validCall(token) || isInstalling())
      throw Error("Conexão não disponível");
    owners.get(event.sender.id)?.socket.close();
    const socket = new NativeSignalingConnection(
      event.sender,
      token,
      profileForSender(event.sender),
      socketFactory,
    );
    owners.set(event.sender.id, { token, socket });
    if (!tracked.has(event.sender.id)) {
      tracked.add(event.sender.id);
      const revoke = () => {
        owners.get(event.sender.id)?.socket.close();
        owners.delete(event.sender.id);
      };
      event.sender.once("destroyed", () => {
        revoke();
        tracked.delete(event.sender.id);
      });
      event.sender.on("render-process-gone", revoke);
      event.sender.on("unresponsive", revoke);
      BrowserWindow.fromWebContents(event.sender)?.on?.("unresponsive", revoke);
      event.sender.on(
        "did-start-navigation",
        (_event, _url, isInPlace, isMainFrame) => {
          if (
            (_event.isMainFrame ?? isMainFrame) &&
            !(_event.isSameDocument ?? isInPlace)
          )
            revoke();
        },
      );
    }
    void socket.start().catch(() => {
      if (!event.sender.isDestroyed())
        event.sender.send("signaling:event", {
          connection: token,
          kind: "message",
          message: {
            type: "error",
            code: "AUTH",
            message:
              "Não foi possível carregar a identidade protegida deste computador.",
          },
        });
      socket.close(4401);
    });
    return true;
  });
  ipcMain.handle("signaling:send", (event, token: unknown, packet: unknown) => {
    assertTrusted(event);
    const owner = owners.get(event.sender.id);
    if (!owner || owner.token !== token) throw Error("Conexão inválida");
    owner.socket.send(packet);
    return true;
  });
  ipcMain.handle("signaling:end-call", (event) => {
    assertTrusted(event);
    owners.get(event.sender.id)?.socket.endCall();
    return true;
  });
  ipcMain.handle("signaling:close", (event, token: unknown) => {
    assertTrusted(event);
    const owner = owners.get(event.sender.id);
    if (owner && owner.token === token) {
      owner.socket.close();
      owners.delete(event.sender.id);
    }
    return true;
  });
}
