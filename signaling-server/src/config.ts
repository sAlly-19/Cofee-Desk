function integer(
  name: string,
  fallback: number,
  min = 1,
  max = 1000000,
): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value < min || value > max)
    throw new Error("Invalid configuration: " + name);
  return value;
}
export function configuration() {
  const production = process.env.NODE_ENV === "production";
  const origin = new URL(
    process.env.PUBLIC_ORIGIN ??
      process.env.RENDER_EXTERNAL_URL ??
      "http://localhost:8080",
  );
  if (production && origin.protocol !== "https:")
    throw new Error("Production requires HTTPS PUBLIC_ORIGIN");
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl)
    throw new Error(
      "DATABASE_URL is required; see signaling-server/.env.example",
    );
  const dbUrl = new URL(databaseUrl);
  if (
    production &&
    !["localhost", "127.0.0.1", "[::1]"].includes(dbUrl.hostname) &&
    dbUrl.searchParams.get("sslmode") !== "verify-full"
  )
    throw new Error(
      "Remote production PostgreSQL requires sslmode=verify-full",
    );
  const encryptionKey = process.env.ADMIN_ENCRYPTION_KEY ?? "";
  if (!/^[a-f0-9]{64}$/i.test(encryptionKey))
    throw new Error(
      "ADMIN_ENCRYPTION_KEY must contain 32 random bytes encoded as hex",
    );
  return {
    production,
    publicOrigin: origin.origin,
    databaseUrl,
    encryptionKey,
    host: process.env.HOST ?? "127.0.0.1",
    port: integer("PORT", 8080, 0, 65535),
    trustProxy: process.env.TRUST_PROXY === "true",
    proxyProvider:
      process.env.PROXY_PROVIDER === "render" ? "render" : "explicit",
    allowedOrigins: new Set(
      (
        process.env.ALLOWED_ORIGINS ??
        "http://localhost:5173,http://localhost:8080,file://,null"
      ).split(","),
    ),
    maxConnections: integer("MAX_CONNECTIONS", 250),
    maxPerIp: integer("MAX_CONNECTIONS_PER_IP", 20),
    maxDevices: integer("MAX_DEVICES", 10000),
    messageLimit: integer("MESSAGES_PER_MINUTE", 300),
    callLimit: integer("CALLS_PER_MINUTE", 10),
    registrationLimit: integer("REGISTRATIONS_PER_HOUR", 20),
    reportLimit: integer("REPORTS_PER_HOUR", 10),
    passwordLimit: integer("PASSWORD_ATTEMPTS_PER_15_MIN", 5),
    maxPayload: integer("MAX_PAYLOAD", 65536, 4096, 1048576),
    maxQueueBytes: integer("MAX_QUEUE_BYTES", 8388608, 1048576, 67108864),
    maxBuffered: integer("MAX_BUFFERED_BYTES", 262144, 4096, 1048576),
    callTimeout: integer("CALL_TIMEOUT_MS", 30000, 1000, 120000),
    authTimeout: integer("AUTH_TIMEOUT_MS", 10000, 1000, 30000),
    sessionHours: integer("ADMIN_SESSION_HOURS", 8, 1, 24),
  };
}
export type Config = ReturnType<typeof configuration>;
