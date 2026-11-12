// Logical Coffee Desk backup, encrypted before writing. Never reads local operator files.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { promisify } = require("node:util");
const scrypt = promisify(crypto.scrypt);
const { database, migrate } = require("../signaling-server/dist/database");
const TABLES = [
  "schema_migrations",
  "devices",
  "admins",
  "sanctions",
  "reports",
  "audit",
];
async function seal(value, passphrase) {
  if (typeof passphrase !== "string" || passphrase.length < 14)
    throw Error("Use a backup passphrase with at least 14 characters");
  const salt = crypto.randomBytes(16),
    iv = crypto.randomBytes(12),
    key = await scrypt(passphrase, salt, 32);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return Buffer.from(
    JSON.stringify({
      format: "coffee-backup-v1",
      salt: salt.toString("base64"),
      iv: iv.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
      data: data.toString("base64"),
    }),
  );
}
async function unseal(bytes, passphrase) {
  const b = JSON.parse(bytes);
  if (b.format !== "coffee-backup-v1") throw Error("Unknown backup format");
  const key = await scrypt(passphrase, Buffer.from(b.salt, "base64"), 32),
    decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(b.iv, "base64"),
    );
  decipher.setAuthTag(Buffer.from(b.tag, "base64"));
  return JSON.parse(
    Buffer.concat([
      decipher.update(Buffer.from(b.data, "base64")),
      decipher.final(),
    ]).toString("utf8"),
  );
}
async function backup(pool, file, passphrase) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await client.query("SET LOCAL search_path TO public");
    const tables = {};
    for (const table of TABLES)
      tables[table] = (await client.query("SELECT * FROM " + table)).rows;
    await client.query("COMMIT");
    const bytes = await seal(
      { schema: 1, createdAt: new Date().toISOString(), tables },
      passphrase,
    );
    await fs.promises.mkdir(path.dirname(path.resolve(file)), {
      recursive: true,
    });
    await fs.promises.writeFile(file, bytes, { flag: "wx", mode: 0o600 });
    return Object.fromEntries(TABLES.map((t) => [t, tables[t].length]));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
async function restore(pool, file, passphrase) {
  const bytes = await fs.promises.readFile(file);
  const snapshot = await unseal(bytes, passphrase);
  if (
    snapshot.schema !== 1 ||
    !TABLES.every((t) => Array.isArray(snapshot.tables?.[t]))
  )
    throw Error("Invalid snapshot");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL search_path TO public");
    await client.query("SELECT pg_advisory_xact_lock(101001)");
    const existing = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public'",
    );
    if (existing.rowCount)
      throw Error(
        "Restore requires a fresh, empty public schema; existing databases are never overwritten",
      );
    await client.query(
      fs.readFileSync(
        path.resolve(
          __dirname,
          "../signaling-server/migrations/001_security.sql",
        ),
        "utf8",
      ),
    );
    await client.query("DELETE FROM schema_migrations");
    for (const table of TABLES) {
      if (snapshot.tables[table].length)
        await client.query(
          "INSERT INTO " +
            table +
            " SELECT * FROM json_populate_recordset(NULL::" +
            table +
            ",$1::json)",
          [JSON.stringify(snapshot.tables[table])],
        );
    }
    await client.query(
      "SELECT setval(pg_get_serial_sequence('audit','id'),GREATEST(COALESCE((SELECT MAX(id) FROM audit),0),1),EXISTS(SELECT 1 FROM audit))",
    );
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
module.exports = { backup, restore, seal, unseal };
if (require.main === module) {
  (async () => {
    const [action, file] = process.argv.slice(2);
    if (
      !["backup", "restore"].includes(action) ||
      !file ||
      !process.env.DATABASE_URL ||
      !process.env.COFFEE_BACKUP_PASSPHRASE
    )
      throw Error(
        "Usage: node scripts/database-recovery.js backup|restore FILE; DATABASE_URL and COFFEE_BACKUP_PASSPHRASE must be provided privately",
      );
    const pool = database(process.env.DATABASE_URL);
    try {
      if (action === "backup")
        await backup(pool, file, process.env.COFFEE_BACKUP_PASSPHRASE);
      else await restore(pool, file, process.env.COFFEE_BACKUP_PASSPHRASE);
      console.log(
        "Database " +
          action +
          " completed. No credentials or records were logged.",
      );
    } finally {
      await pool.end();
    }
  })().catch(() => {
    console.error(
      "Recovery failed. Check credentials, passphrase, file access and an empty restore target. No existing database was replaced.",
    );
    process.exitCode = 1;
  });
}
