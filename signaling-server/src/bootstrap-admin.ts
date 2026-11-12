import { randomBytes, randomUUID } from "crypto";
import { configuration } from "./config";
import { database, migrate, transaction } from "./database";
import { hashPassword, base32, encrypt, text } from "./security";
async function main() {
  const config = configuration(),
    pool = database(config.databaseUrl);
  try {
    await migrate(pool);
    let raw = "";
    for await (const part of process.stdin) {
      raw += part;
      if (raw.length > 8192) throw new Error("Input too large");
    }
    const input = JSON.parse(raw);
    if (
      !text(input.username, 3, 80) ||
      !/^[a-zA-Z0-9._-]+$/.test(input.username) ||
      !text(input.password, 8, 256)
    )
      throw new Error(
        "Use username (3–80 characters) and password (8–256 characters) via JSON on stdin.",
      );
    const secret = base32(randomBytes(20)),
      hash = await hashPassword(input.password);
    await transaction(pool, async (db) => {
      await db.query("SELECT pg_advisory_xact_lock(101002)");
      if (
        Number((await db.query("SELECT count(*) FROM admins")).rows[0].count) >
        0
      )
        throw new Error("Administrator already exists; bootstrap is one-time.");
      const id = randomUUID();
      await db.query(
        "INSERT INTO admins(id,username,password_hash,totp_encrypted) VALUES($1,$2,$3,$4)",
        [
          id,
          input.username.toLowerCase(),
          hash,
          encrypt(secret, config.encryptionKey),
        ],
      );
      await db.query(
        "INSERT INTO audit(admin_id,action,target,reason) VALUES($1,'bootstrap',$2,'Criação local do primeiro administrador')",
        [id, id],
      );
    });
    // Enrollment output is intentionally shown once to the local operator, never by the server.
    console.log(
      "Administrator created. Enroll this secret in your authenticator and do not save it in logs:",
    );
    console.log(secret);
  } finally {
    await pool.end();
  }
}
main().catch(() => {
  console.error(
    "Bootstrap failed. Verify input, database and whether an administrator already exists.",
  );
  process.exitCode = 1;
});
