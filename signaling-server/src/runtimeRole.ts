import type { Pool } from "pg";
import { transaction } from "./database";
export async function provisionRuntimeRole(pool: Pool, password: string) {
  if (password.length < 32 || password.length > 256)
    throw new Error("Strong runtime password required");
  await transaction(pool, async (db) => {
    // SQL identifiers are fixed; password is quoted as a SQL literal, never logged.
    const exists = await db.query(
      "SELECT 1 FROM pg_roles WHERE rolname='coffee_runtime'",
    );
    if (exists.rowCount)
      throw new Error(
        "Runtime role already exists; use the documented rotation procedure",
      );
    const quoted = "'" + password.replace(/'/g, "''") + "'";
    await db.query(
      "CREATE ROLE coffee_runtime LOGIN PASSWORD " +
        quoted +
        " NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT",
    );
    await db.query("REVOKE CREATE ON SCHEMA public FROM PUBLIC");
    await db.query("GRANT USAGE ON SCHEMA public TO coffee_runtime");
    await db.query(
      "GRANT SELECT ON schema_migrations,devices,admins,admin_sessions,sanctions,reports,audit TO coffee_runtime",
    );
    await db.query("GRANT INSERT,UPDATE ON devices,reports TO coffee_runtime");
    await db.query(
      "GRANT INSERT,UPDATE,DELETE ON admin_sessions TO coffee_runtime",
    );
    await db.query(
      "GRANT UPDATE(last_totp_counter) ON admins TO coffee_runtime",
    );
    await db.query("GRANT INSERT ON sanctions,audit TO coffee_runtime");
    await db.query("GRANT USAGE ON SEQUENCE audit_id_seq TO coffee_runtime");
  });
}
