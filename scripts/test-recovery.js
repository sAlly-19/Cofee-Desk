const assert = require("node:assert/strict"),
  crypto = require("node:crypto"),
  fs = require("node:fs"),
  path = require("node:path");
const { database, migrate } = require("../signaling-server/dist/database");
const { backup, restore } = require("./database-recovery");
(async () => {
  const { localDatabase } = await import("./local-database.mjs");
  const db = await localDatabase("recovery-drill");
  const pool = database(db.url);
  let target;
  const checks = [];
  const check = (name, value) => {
    assert.ok(value, name);
    checks.push(name);
    console.log("PASS " + name);
  };
  try {
    await pool.query("DROP SCHEMA public CASCADE;CREATE SCHEMA public");
    await migrate(pool);
    const admin = crypto.randomUUID(),
      sanction = crypto.randomUUID(),
      report = crypto.randomUUID(),
      sec = require("../signaling-server/dist/security"),
      key = crypto.randomBytes(32).toString("hex"),
      totp = sec.base32(crypto.randomBytes(20));
    await pool.query(
      "INSERT INTO devices(id,public_key,status,reason) VALUES ('111-222-333','fixture-key','banned','Fixture sanction')",
    );
    await pool.query(
      "INSERT INTO admins(id,username,password_hash,totp_encrypted) VALUES($1,$2,$3,$4)",
      [
        admin,
        "recovery-test",
        await sec.hashPassword("fixture-only-passphrase"),
        sec.encrypt(totp, key),
      ],
    );
    await pool.query(
      "INSERT INTO sanctions(id,device_id,admin_id,action,reason) VALUES($1,'111-222-333',$2,'ban','Fixture sanction')",
      [sanction, admin],
    );
    await pool.query(
      "INSERT INTO reports(id,reporter_id,device_id,category,description) VALUES($1,'111-222-333','111-222-333','other','Isolated fixture report')",
      [report],
    );
    await pool.query(
      "INSERT INTO audit(admin_id,action,target,reason) VALUES($1,'ban','111-222-333','Fixture audit')",
      [admin],
    );
    const file = path.join(
        db.root,
        "recovery-" + crypto.randomUUID() + ".encrypted",
      ),
      phrase = crypto.randomBytes(32).toString("base64url");
    await backup(pool, file, phrase);
    check(
      "Backup file encrypts device and report content",
      !fs.readFileSync(file, "utf8").includes("111-222-333"),
    );
    const targetName = "restore_" + crypto.randomBytes(6).toString("hex");
    await pool.query("CREATE DATABASE " + targetName);
    const targetUrl = new URL(db.url);
    targetUrl.pathname = "/" + targetName;
    target = database(targetUrl.href);
    await assert.rejects(restore(target, file, "wrong-passphrase"));
    check("Incorrect backup passphrase rejected", true);
    await restore(target, file, phrase);
    for (const table of ["devices", "admins", "sanctions", "reports", "audit"])
      check(
        "Restored " + table,
        (await target.query("SELECT COUNT(*)::int AS n FROM " + table)).rows[0]
          .n === 1,
      );
    check(
      "Administrative key separately restores TOTP",
      sec.decrypt(
        (await target.query("SELECT totp_encrypted FROM admins")).rows[0]
          .totp_encrypted,
        key,
      ) === totp,
    );
    await target.end();
    target = database(targetUrl.href);
    check(
      "Sanction persists after reconnect",
      (await target.query("SELECT status FROM devices")).rows[0].status ===
        "banned",
    );
    await assert.rejects(restore(target, file, phrase));
    check("Existing restore target protected from overwrite", true);
    await assert.rejects(target.query("UPDATE audit SET reason='changed'"));
    check("Restored audit remains append-only", true);
    check(
      "Administrative sessions are revoked on recovery",
      (await target.query("SELECT COUNT(*)::int AS n FROM admin_sessions"))
        .rows[0].n === 0,
    );
    fs.writeFileSync(
      path.join(db.root, "validation.json"),
      JSON.stringify({ passed: checks.length, checks }, null, 2),
    );
    await target.end();
    target = null;
    await pool.query("DROP DATABASE " + targetName);
  } finally {
    await target?.end();
    await pool.end();
    await db.stop();
  }
})().catch((error) => {
  console.error(
    error.name + ": recovery drill failed (sensitive error details omitted)",
  );
  process.exitCode = 1;
});
