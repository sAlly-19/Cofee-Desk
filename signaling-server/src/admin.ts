import { IncomingMessage, ServerResponse } from "http";
import { Pool } from "pg";
import { randomUUID } from "crypto";
import { Config } from "./config";
import { transaction, activeDevice } from "./database";
import {
  Limiter,
  digest,
  token,
  equal,
  verifyPassword,
  verifyTotp,
  decrypt,
  text,
  deviceId,
  uuid,
} from "./security";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function json(res: ServerResponse, status: number, value: unknown) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value));
}
export async function body(req: IncomingMessage) {
  if (req.headers["content-type"]?.split(";")[0] !== "application/json")
    throw new HttpError(415, "Use application/json");
  const parts: Buffer[] = [];
  let size = 0;
  for await (const part of req) {
    size += part.length;
    if (size > 16384) throw new HttpError(413, "Request too large");
    parts.push(part);
  }
  try {
    const parsed = JSON.parse(Buffer.concat(parts).toString());
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error();
    return parsed as Record<string, unknown>;
  } catch {
    throw new HttpError(400, "Invalid JSON object");
  }
}
export async function createAdminApi(
  pool: Pool,
  config: Config,
  limiter: Limiter,
  onSanction: (id: string) => Promise<void>,
  online: (id: string) => boolean,
) {
  const cookieName = config.production ? "__Host-coffee_admin" : "coffee_admin";
  const cookie = (value: string, age: number) =>
    cookieName +
    "=" +
    value +
    "; HttpOnly; SameSite=Strict; Path=/; Max-Age=" +
    age +
    (config.production ? "; Secure" : "");
  return async (req: IncomingMessage, res: ServerResponse, ip: string) => {
    const url = new URL(req.url ?? "/", config.publicOrigin);
    const route = url.pathname;
    if (!limiter.allow("http:" + ip, 120, 60000))
      throw new HttpError(429, "Muitas solicitações. Aguarde.");
    if (!["GET", "POST"].includes(req.method ?? ""))
      throw new HttpError(405, "Método não permitido");
    if (req.method === "POST" && req.headers.origin !== config.publicOrigin)
      throw new HttpError(403, "Origem não permitida");
    if (route === "/api/admin/login" && req.method === "POST") {
      if (!limiter.allow("login-global", 30, 60000))
        throw new HttpError(429, "Autenticação temporariamente limitada");
      if (!limiter.allow("login:" + ip, 10, 900000))
        throw new HttpError(429, "Aguarde antes de tentar novamente.");
      const data = await body(req);
      if (
        !text(data.username, 3, 80) ||
        !text(data.password, 1, 256) ||
        !text(data.code, 6, 6)
      )
        throw new HttpError(401, "Credenciais inválidas");
      if (
        !limiter.allow("login-user:" + data.username.toLowerCase(), 10, 900000)
      )
        throw new HttpError(429, "Aguarde antes de tentar novamente.");
      const row = (
        await pool.query("SELECT * FROM admins WHERE username=$1", [
          data.username.toLowerCase(),
        ])
      ).rows[0];
      // Use a real scrypt operation even when the username does not exist.
      const stored =
        row?.password_hash ??
        "00000000000000000000000000000000:" + "00".repeat(64);
      if (!(await verifyPassword(data.password, stored)) || !row)
        throw new HttpError(401, "Credenciais inválidas");
      const counter = verifyTotp(
        decrypt(row.totp_encrypted, config.encryptionKey),
        data.code,
        Number(row.last_totp_counter),
      );
      if (counter === null) throw new HttpError(401, "Credenciais inválidas");
      const sessionToken = token(),
        csrf = token();
      const ok = await transaction(pool, async (db) => {
        const updated = await db.query(
          "UPDATE admins SET last_totp_counter=$1 WHERE id=$2 AND last_totp_counter<$1 RETURNING id",
          [counter, row.id],
        );
        if (!updated.rowCount) return false;
        await db.query(
          "DELETE FROM admin_sessions WHERE expires_at<=now() OR admin_id=$1",
          [row.id],
        );
        await db.query(
          "INSERT INTO admin_sessions(token_hash,admin_id,csrf_hash,expires_at) VALUES($1,$2,$3,now()+($4::int * interval '1 hour'))",
          [digest(sessionToken), row.id, digest(csrf), config.sessionHours],
        );
        await db.query(
          "INSERT INTO audit(admin_id,action,target,reason) VALUES($1,'login',$2,'Autenticação administrativa')",
          [row.id, row.id],
        );
        return true;
      });
      if (!ok) throw new HttpError(401, "Credenciais inválidas");
      res.setHeader(
        "Set-Cookie",
        cookie(sessionToken, config.sessionHours * 3600),
      );
      return json(res, 200, { username: row.username, csrf });
    }
    const rawCookie = (req.headers.cookie ?? "")
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith(cookieName + "="))
      ?.slice(cookieName.length + 1);
    if (!rawCookie || !/^[A-Za-z0-9_-]{43}$/.test(rawCookie))
      throw new HttpError(401, "Faça login");
    const session = (
      await pool.query(
        "SELECT s.*,a.username FROM admin_sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token_hash=$1 AND s.expires_at>now()",
        [digest(rawCookie)],
      )
    ).rows[0];
    if (!session) throw new HttpError(401, "Sessão expirada");
    if (
      req.method === "POST" &&
      (!text(req.headers["x-csrf-token"], 43, 43) ||
        !equal(digest(req.headers["x-csrf-token"]), session.csrf_hash))
    )
      throw new HttpError(403, "Token CSRF inválido");
    if (route === "/api/admin/network" && req.method === "GET") {
      return json(res, 200, { ip });
    }
    if (route === "/api/admin/session" && req.method === "GET") {
      const csrf = token();
      await pool.query(
        "UPDATE admin_sessions SET csrf_hash=$1 WHERE token_hash=$2",
        [digest(csrf), session.token_hash],
      );
      return json(res, 200, { username: session.username, csrf });
    }
    if (route === "/api/admin/logout" && req.method === "POST") {
      await pool.query("DELETE FROM admin_sessions WHERE token_hash=$1", [
        session.token_hash,
      ]);
      res.setHeader("Set-Cookie", cookie("", 0));
      return json(res, 200, { ok: true });
    }
    if (route === "/api/admin/sessions/revoke" && req.method === "POST") {
      await transaction(pool, async (db) => {
        await db.query("DELETE FROM admin_sessions WHERE admin_id=$1", [
          session.admin_id,
        ]);
        await db.query(
          "INSERT INTO audit(admin_id,action,target,reason) VALUES($1,'revoke-sessions',$2,'Encerramento de todas as sessões')",
          [session.admin_id, session.admin_id],
        );
      });
      res.setHeader("Set-Cookie", cookie("", 0));
      return json(res, 200, { ok: true });
    }
    const page = Math.max(
      0,
      Math.min(10000, Number(url.searchParams.get("page")) || 0),
    );
    if (route === "/api/admin/devices" && req.method === "GET") {
      const q = (url.searchParams.get("q") ?? "").slice(0, 80);
      const rows = (
        await pool.query(
          "SELECT d.id,d.created_at,d.last_seen,CASE WHEN d.status='blocked' AND d.blocked_until<=now() THEN 'active' ELSE d.status END AS status,d.blocked_until,d.reason,(SELECT count(*)::int FROM reports r WHERE r.device_id=d.id) AS reports FROM devices d WHERE d.id LIKE $1 ORDER BY d.last_seen DESC LIMIT 50 OFFSET $2",
          ["%" + q + "%", page * 50],
        )
      ).rows;
      return json(res, 200, {
        items: rows.map((r) => ({ ...r, online: online(r.id) })),
        page,
      });
    }
    const detail = route.match(/^\/api\/admin\/devices\/([0-9-]+)$/);
    if (detail && req.method === "GET") {
      const id = detail[1];
      if (!deviceId(id)) throw new HttpError(400, "ID inválido");
      const device = await activeDevice(pool, id);
      if (!device) throw new HttpError(404, "Dispositivo não encontrado");
      delete device.public_key;
      const sanctions = (
        await pool.query(
          "SELECT s.*,a.username FROM sanctions s JOIN admins a ON a.id=s.admin_id WHERE device_id=$1 ORDER BY created_at DESC LIMIT 100",
          [id],
        )
      ).rows;
      const audit = (
        await pool.query(
          "SELECT e.*,a.username FROM audit e JOIN admins a ON a.id=e.admin_id WHERE target=$1 ORDER BY e.id DESC LIMIT 100",
          [id],
        )
      ).rows;
      return json(res, 200, {
        device: { ...device, online: online(id) },
        sanctions,
        audit,
      });
    }
    const sanction = route.match(
      /^\/api\/admin\/devices\/([0-9-]+)\/sanctions$/,
    );
    if (sanction && req.method === "POST") {
      const id = sanction[1],
        data = await body(req);
      if (
        !deviceId(id) ||
        !["block", "ban", "unblock"].includes(String(data.action)) ||
        !text(data.reason, 5, 1000)
      )
        throw new HttpError(400, "Ação e motivo são obrigatórios");
      const hours = data.hours === undefined ? 24 : Number(data.hours);
      if (
        data.action === "block" &&
        (!Number.isFinite(hours) || hours < 1 || hours > 8760)
      )
        throw new HttpError(400, "Duração deve ser de 1 a 8760 horas");
      if (data.action === "ban" && data.confirm !== id)
        throw new HttpError(400, "Confirme o ID para banir");
      await transaction(pool, async (db) => {
        const before = (
          await db.query(
            "SELECT id,status,blocked_until,reason FROM devices WHERE id=$1 FOR UPDATE",
            [id],
          )
        ).rows[0];
        if (!before) throw new HttpError(404, "Dispositivo não encontrado");
        const status =
          data.action === "ban"
            ? "banned"
            : data.action === "block"
              ? "blocked"
              : "active";
        const expiry =
          data.action === "block"
            ? new Date(Date.now() + hours * 3600000)
            : null;
        const after = (
          await db.query(
            "UPDATE devices SET status=$1,blocked_until=$2,reason=$3 WHERE id=$4 RETURNING id,status,blocked_until,reason",
            [status, expiry, data.reason, id],
          )
        ).rows[0];
        await db.query(
          "INSERT INTO sanctions(id,device_id,admin_id,action,reason,expires_at) VALUES($1,$2,$3,$4,$5,$6)",
          [
            randomUUID(),
            id,
            session.admin_id,
            data.action,
            data.reason,
            expiry,
          ],
        );
        await db.query(
          "INSERT INTO audit(admin_id,action,target,reason,before_state,after_state) VALUES($1,$2,$3,$4,$5,$6)",
          [
            session.admin_id,
            data.action,
            id,
            data.reason,
            JSON.stringify(before),
            JSON.stringify(after),
          ],
        );
      });
      if (data.action !== "unblock") await onSanction(id);
      return json(res, 200, { ok: true });
    }
    if (route === "/api/admin/reports" && req.method === "GET") {
      const status = url.searchParams.get("status") ?? "";
      if (
        status &&
        !["open", "reviewing", "substantiated", "dismissed"].includes(status)
      )
        throw new HttpError(400, "Situação inválida");
      const rows = (
        await pool.query(
          "SELECT r.*,a.username AS reviewer FROM reports r LEFT JOIN admins a ON a.id=r.reviewed_by WHERE ($1='' OR r.status=$1) ORDER BY r.created_at DESC LIMIT 50 OFFSET $2",
          [status, page * 50],
        )
      ).rows;
      return json(res, 200, { items: rows, page });
    }
    const review = route.match(/^\/api\/admin\/reports\/([0-9a-f-]+)$/);
    if (review && req.method === "POST") {
      const data = await body(req);
      if (
        !uuid(review[1]) ||
        !["reviewing", "substantiated", "dismissed"].includes(
          String(data.status),
        ) ||
        !text(data.reason, 5, 1000)
      )
        throw new HttpError(400, "Situação e justificativa são obrigatórias");
      await transaction(pool, async (db) => {
        const before = (
          await db.query(
            "SELECT id,status,device_id FROM reports WHERE id=$1 FOR UPDATE",
            [review[1]],
          )
        ).rows[0];
        if (!before) throw new HttpError(404, "Denúncia não encontrada");
        await db.query(
          "UPDATE reports SET status=$1,decision=$2,reviewed_by=$3,updated_at=now() WHERE id=$4",
          [data.status, data.reason, session.admin_id, review[1]],
        );
        await db.query(
          "INSERT INTO audit(admin_id,action,target,reason,before_state,after_state) VALUES($1,$2,$3,$4,$5,$6)",
          [
            session.admin_id,
            "review-report",
            before.device_id,
            data.reason,
            JSON.stringify(before),
            JSON.stringify({ reportId: review[1], status: data.status }),
          ],
        );
      });
      return json(res, 200, { ok: true });
    }
    if (route === "/api/admin/audit" && req.method === "GET") {
      return json(res, 200, {
        items: (
          await pool.query(
            "SELECT e.*,a.username FROM audit e JOIN admins a ON a.id=e.admin_id ORDER BY e.id DESC LIMIT 50 OFFSET $1",
            [page * 50],
          )
        ).rows,
        page,
      });
    }
    throw new HttpError(404, "Rota não encontrada");
  };
}
