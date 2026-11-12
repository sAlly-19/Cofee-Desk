// Credentials arrive exclusively through stdin. Output never contains credentials.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { database, migrate } = require("../signaling-server/dist/database");
const {
  provisionRuntimeRole,
} = require("../signaling-server/dist/runtimeRole");
(async () => {
  const folder = path.resolve(__dirname, "../artifacts/hosting");
  if (
    fs.existsSync(path.join(folder, ".env.operator")) ||
    fs.existsSync(path.join(folder, ".env.render"))
  )
    throw Error(
      "Hosting configuration already exists; preserve it and follow rotation instructions.",
    );
  let raw = "";
  for await (const chunk of process.stdin) {
    raw += chunk;
    if (raw.length > 16384) throw Error("Input too large");
  }
  const input = JSON.parse(raw);
  const owner = new URL(input.databaseUrl);
  if (
    !owner.hostname.endsWith(".neon.tech") ||
    owner.hostname.includes("-pooler") ||
    owner.searchParams.get("sslmode") !== "verify-full" ||
    !["postgres:", "postgresql:"].includes(owner.protocol)
  )
    throw Error("Use a direct Neon connection with sslmode=verify-full");
  const pool = database(owner.href);
  try {
    for (const table of ["devices", "admins", "reports", "audit"]) {
      const present = (
        await pool.query("SELECT to_regclass($1) AS name", ["public." + table])
      ).rows[0].name;
      if (
        present &&
        (await pool.query("SELECT 1 FROM public." + table + " LIMIT 1"))
          .rowCount
      )
        throw Error(
          "Use a new empty database; existing application data found",
        );
    }
    if (
      (
        await pool.query(
          "SELECT 1 FROM pg_roles WHERE rolname='coffee_runtime'",
        )
      ).rowCount
    )
      throw Error("Runtime role already exists");
    await migrate(pool);
    const runtimePassword = crypto.randomBytes(48).toString("base64url");
    const key = crypto.randomBytes(32).toString("hex");
    fs.mkdirSync(folder, { recursive: true, mode: 0o700 });
    // Save locally before changing the database, so an interrupted setup retains recovery data.
    const app = new URL(owner.href);
    app.username = "coffee_runtime";
    app.password = runtimePassword;
    const operatorEnv =
      "NODE_ENV=production\nPUBLIC_ORIGIN=https://deployment-pending.invalid\nDATABASE_URL=" +
      owner.href +
      "\nADMIN_ENCRYPTION_KEY=" +
      key +
      "\n";
    const runtimeEnv =
      "DATABASE_URL=" + app.href + "\nADMIN_ENCRYPTION_KEY=" + key + "\n";
    fs.writeFileSync(path.join(folder, ".env.operator"), operatorEnv, {
      mode: 0o600,
    });
    fs.writeFileSync(path.join(folder, ".env.render"), runtimeEnv, {
      mode: 0o600,
    });
    await provisionRuntimeRole(pool, runtimePassword);
    fs.writeFileSync(
      path.join(folder, "setup.json"),
      JSON.stringify(
        {
          prepared: true,
          host: owner.hostname,
          createdAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
    console.log(
      "Banco preparado. Segredos salvos somente em artifacts/hosting/.env.operator e .env.render. Não envie esses arquivos ao GitHub ou ao chat.",
    );
  } finally {
    await pool.end();
  }
})().catch(() => {
  console.error(
    "Preparação falhou. Confira a conexão direta e os arquivos locais de recuperação; nenhum segredo foi impresso.",
  );
  process.exitCode = 1;
});
