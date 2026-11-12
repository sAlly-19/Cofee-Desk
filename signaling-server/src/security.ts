import {
  randomBytes,
  scrypt as derive,
  timingSafeEqual,
  createHash,
  createHmac,
  createCipheriv,
  createDecipheriv,
} from "crypto";
export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const token = () => randomBytes(32).toString("base64url");
export function equal(a: string, b: string) {
  return (
    a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))
  );
}
let activeDerivations = 0;
const scrypt = (password: string, salt: string) =>
  new Promise<Buffer>((resolve, reject) => {
    if (activeDerivations >= 2) {
      reject(new Error("Authentication capacity reached"));
      return;
    }
    activeDerivations++;
    derive(
      password,
      salt,
      64,
      { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, key) => {
        activeDerivations--;
        if (error) reject(error);
        else resolve(key);
      },
    );
  });
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + (await scrypt(password, salt)).toString("hex");
}
export async function verifyPassword(password: string, stored: string) {
  const [salt, expected] = stored.split(":");
  return equal((await scrypt(password, salt)).toString("hex"), expected);
}
export function encrypt(value: string, key: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(key, "hex"), iv);
  return [
    iv.toString("hex"),
    cipher.update(value, "utf8", "hex") + cipher.final("hex"),
    cipher.getAuthTag().toString("hex"),
  ].join(":");
}
export function decrypt(value: string, key: string) {
  const [iv, data, tag] = value.split(":");
  const cipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(key, "hex"),
    Buffer.from(iv, "hex"),
  );
  cipher.setAuthTag(Buffer.from(tag, "hex"));
  return cipher.update(data, "hex", "utf8") + cipher.final("utf8");
}
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function base32(bytes: Buffer) {
  let bits = 0,
    value = 0,
    result = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      result += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits) result += alphabet[(value << (5 - bits)) & 31];
  return result;
}
function unbase32(value: string) {
  let bits = 0,
    n = 0;
  const result: number[] = [];
  for (const ch of value) {
    const digit = alphabet.indexOf(ch);
    if (digit < 0) throw new Error("Invalid TOTP secret");
    n = (n << 5) | digit;
    bits += 5;
    if (bits >= 8) {
      result.push((n >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(result);
}
export function totp(secret: string, counter = Math.floor(Date.now() / 30000)) {
  const b = Buffer.alloc(8);
  b.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac("sha1", unbase32(secret)).update(b).digest();
  const offset = mac[19] & 15;
  return ((mac.readUInt32BE(offset) & 0x7fffffff) % 1000000)
    .toString()
    .padStart(6, "0");
}
export function verifyTotp(secret: string, code: string, last: number) {
  if (!/^\d{6}$/.test(code)) return null;
  const now = Math.floor(Date.now() / 30000);
  for (const c of [now - 1, now, now + 1])
    if (c > last && equal(totp(secret, c), code)) return c;
  return null;
}
export class Limiter {
  private buckets = new Map<string, { count: number; end: number }>();
  allow(key: string, limit: number, windowMs: number) {
    const now = Date.now();
    if (this.buckets.size > 20000)
      for (const [k, v] of this.buckets)
        if (v.end <= now) this.buckets.delete(k);
    const k = digest(key);
    let bucket = this.buckets.get(k);
    if (!bucket || bucket.end <= now) {
      if (this.buckets.size >= 25000 && !bucket) return false;
      bucket = { count: 0, end: now + windowMs };
      this.buckets.set(k, bucket);
    }
    return ++bucket.count <= limit;
  }
}
export const deviceId = (value: unknown): value is string =>
  typeof value === "string" && /^\d{3}-\d{3}-\d{3}$/.test(value);
export const uuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
export function text(
  value: unknown,
  min: number,
  max: number,
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length >= min &&
    value.length <= max &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
  );
}
