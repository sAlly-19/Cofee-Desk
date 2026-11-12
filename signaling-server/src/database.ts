import { Pool, PoolClient } from "pg";
import fs from "fs";
import path from "path";
export function database(url: string) {
  return new Pool({
    connectionString: url,
    max: 10,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    statement_timeout: 10000,
  });
}
export async function migrate(pool: Pool) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(101001)");
    await client.query(
      fs.readFileSync(
        path.join(__dirname, "../migrations/001_security.sql"),
        "utf8",
      ),
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function transaction<T>(
  pool: Pool,
  run: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await run(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function activeDevice(pool: Pool, id: string) {
  const row = (await pool.query("SELECT * FROM devices WHERE id=$1", [id]))
    .rows[0];
  if (
    row?.status === "blocked" &&
    row.blocked_until &&
    new Date(row.blocked_until).getTime() <= Date.now()
  ) {
    await pool.query(
      "UPDATE devices SET status='active',blocked_until=NULL WHERE id=$1 AND status='blocked' AND blocked_until<=now()",
      [id],
    );
    return (await pool.query("SELECT * FROM devices WHERE id=$1", [id]))
      .rows[0];
  }
  return row;
}
