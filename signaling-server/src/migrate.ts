import { database, migrate } from "./database";
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const pool = database(url);
migrate(pool)
  .then(() => console.log("Security schema ready."))
  .catch(() => {
    console.error("Database migration failed.");
    process.exitCode = 1;
  })
  .finally(() => pool.end());
