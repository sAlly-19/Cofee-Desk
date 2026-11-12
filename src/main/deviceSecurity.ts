import { app, ipcMain, safeStorage } from "electron";
import { fileURLToPath } from "url";
import { AsyncLocalStorage } from "async_hooks";
import type { WebContents } from "electron";
const profiles = new AsyncLocalStorage<string>();
import {
  generateKeyPairSync,
  createPrivateKey,
  createPublicKey,
  sign,
  randomBytes,
  scrypt,
  timingSafeEqual,
} from "crypto";
import fs from "fs";
import path from "path";
import { OFFICIAL_SIGNALING_URL } from "../shared/publicService";
import { LOCAL_SIGNALING_URL, selectService } from "./serviceSelection";
type Settings = {
  url: string;
  urlSource?: "explicit" | "default";
  enabled: boolean;
  verifier?: string;
  passwordNeedsUpgrade?: boolean;
  identities: Record<string, { privateKey: string; publicKey: string }>;
};
const endpoint = (input: string) => {
  const url = new URL(input);
  if (
    url.username ||
    url.password ||
    url.hash ||
    url.search ||
    !["ws:", "wss:"].includes(url.protocol)
  )
    throw new Error("Endereço de sinalização inválido");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "wss:" && !local)
    throw new Error("Servidores externos exigem wss://");
  url.pathname = "/ws";
  return url.href;
};
const filename = () =>
  path.join(
    profiles.getStore() ?? app.getPath("userData"),
    "device-security-v2.json",
  );
function read(): Settings {
  try {
    const stored: Settings = JSON.parse(fs.readFileSync(filename(), "utf8"));
    return selectService(stored, OFFICIAL_SIGNALING_URL);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT")
      throw new Error("Não foi possível ler a identidade protegida");
    return {
      url: OFFICIAL_SIGNALING_URL || LOCAL_SIGNALING_URL,
      urlSource: "default",
      enabled: false,
      identities: {},
    };
  }
}
function write(value: Settings) {
  const file = filename();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file + ".tmp", JSON.stringify(value), { mode: 0o600 });
  fs.renameSync(file + ".tmp", file);
}
const pendingIdentities = new Map<
  string,
  Promise<{ privateKey: string; publicKey: string }>
>();
async function identity(url: string) {
  const key = endpoint(url),
    lock = filename() + key;
  const pending = pendingIdentities.get(lock);
  if (pending) return pending;
  const work = (async () => {
    if (
      !(await safeStorage.isAsyncEncryptionAvailable()) ||
      (process.platform === "linux" &&
        safeStorage.getSelectedStorageBackend() === "basic_text")
    )
      throw new Error("Armazenamento seguro do sistema indisponível");
    const existing = read().identities[key];
    if (existing) return existing;
    const pair = generateKeyPairSync("ed25519");
    const pem = pair.privateKey
      .export({ format: "pem", type: "pkcs8" })
      .toString();
    const encrypted = await safeStorage.encryptStringAsync(pem);
    const state = read();
    if (!state.identities[key]) {
      state.identities[key] = {
        privateKey: encrypted.toString("base64"),
        publicKey: pair.publicKey
          .export({ format: "der", type: "spki" })
          .toString("base64"),
      };
      write(state);
    }
    return state.identities[key];
  })().finally(() => pendingIdentities.delete(lock));
  pendingIdentities.set(lock, work);
  return work;
}
function derive(password: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(
      password,
      salt,
      64,
      { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key)),
    ),
  );
}
let derivations = 0;
export function registerDeviceSecurity(
  profileForSender: (sender: WebContents) => string = () =>
    app.getPath("userData"),
) {
  function handle(channel: string, run: (...args: any[]) => unknown) {
    ipcMain.handle(channel, async (event, ...args) => {
      const url = event.senderFrame?.url ?? "";
      let fileAllowed = false;
      try {
        fileAllowed =
          url.startsWith("file://") &&
          path.resolve(fileURLToPath(url)) ===
            path.resolve(__dirname, "../renderer/index.html");
      } catch {}
      const allowed =
        event.senderFrame === event.sender.mainFrame &&
        (fileAllowed ||
          (/^http:\/\/(localhost|127\.0\.0\.1):5173\//.test(url) &&
            !app.isPackaged));
      if (!allowed) throw new Error("Origem IPC não autorizada");
      return profiles.run(profileForSender(event.sender), () => run(...args));
    });
  }
  handle("security:settings", () => {
    const state = read();
    return {
      url: state.url,
      enabled: state.enabled,
      hasPassword: !!state.verifier,
      officialUrl: OFFICIAL_SIGNALING_URL || null,
    };
  });
  handle("security:set-url", (url: unknown) => {
    if (typeof url !== "string" || url.length > 2048)
      throw new Error("Endereço inválido");
    const state = read();
    state.url = endpoint(url);
    state.urlSource = "explicit";
    write(state);
    return state.url;
  });
  handle("security:use-official", () => {
    if (!OFFICIAL_SIGNALING_URL)
      throw new Error("O serviço oficial ainda não foi disponibilizado");
    const state = read();
    state.url = endpoint(OFFICIAL_SIGNALING_URL);
    state.urlSource = "default";
    write(state);
    return state.url;
  });
  handle("security:public-key", async (url: string) => {
    if (endpoint(url) !== read().url)
      throw new Error("Servidor não configurado");
    return (await identity(url)).publicKey;
  });
  handle(
    "security:sign",
    async (url: string, nonce: unknown, audience: unknown) => {
      const configured = read().url;
      if (
        endpoint(url) !== configured ||
        typeof nonce !== "string" ||
        !/^[A-Za-z0-9_-]{43}$/.test(nonce) ||
        typeof audience !== "string"
      )
        throw new Error("Desafio inválido");
      const server = new URL(configured);
      const expected =
        (server.protocol === "wss:" ? "https:" : "http:") + "//" + server.host;
      if (audience !== expected)
        throw new Error("Servidor de autenticação inesperado");
      const stored = await identity(url);
      const decrypted = await safeStorage.decryptStringAsync(
        Buffer.from(stored.privateKey, "base64"),
      );
      const privateKey = createPrivateKey(decrypted.result);
      if (
        createPublicKey(privateKey)
          .export({ format: "der", type: "spki" })
          .toString("base64") !== stored.publicKey
      )
        throw new Error("Identidade inválida");
      if (decrypted.shouldReEncrypt) {
        const encrypted = await safeStorage.encryptStringAsync(
          decrypted.result,
        );
        const state = read();
        state.identities[configured].privateKey = encrypted.toString("base64");
        write(state);
      }
      return sign(
        null,
        Buffer.from(
          "coffee-desk:v2\n" +
            audience +
            "\n" +
            nonce +
            "\n" +
            stored.publicKey,
        ),
        privateKey,
      ).toString("base64");
    },
  );
  handle("security:password", async (password: unknown, enabled: unknown) => {
    if (
      typeof password !== "string" ||
      password.length > 256 ||
      typeof enabled !== "boolean"
    )
      throw new Error("Configuração inválida");
    if (derivations >= 2) throw new Error("Aguarde a operação anterior");
    derivations++;
    try {
      let verifier: string | undefined;
      if (password) {
        if (password.length < 12)
          throw new Error("Use pelo menos 12 caracteres na senha");
        const salt = randomBytes(16).toString("hex");
        verifier = salt + ":" + (await derive(password, salt)).toString("hex");
      }
      const state = read();
      if (verifier) {
        state.verifier = verifier;
        delete state.passwordNeedsUpgrade;
      }
      if (enabled && state.passwordNeedsUpgrade)
        throw new Error(
          "A senha migrada precisa ser substituída por uma senha com pelo menos 12 caracteres",
        );
      if (enabled && !state.verifier)
        throw new Error("Defina uma senha antes de ativar");
      state.enabled = enabled;
      write(state);
      return { enabled: state.enabled, hasPassword: !!state.verifier };
    } finally {
      derivations--;
    }
  });
  handle(
    "security:migrate-password",
    async (password: unknown, enabled: unknown) => {
      if (
        typeof password !== "string" ||
        password.length > 256 ||
        typeof enabled !== "boolean"
      )
        throw new Error("Migração inválida");
      if (derivations >= 2) throw new Error("Aguarde");
      derivations++;
      try {
        let state = read();
        if (!state.verifier && password) {
          const salt = randomBytes(16).toString("hex");
          const verifier =
            salt + ":" + (await derive(password, salt)).toString("hex");
          state = read();
          if (!state.verifier) {
            state.verifier = verifier;
            state.passwordNeedsUpgrade = password.length < 12;
            state.enabled = enabled && !state.passwordNeedsUpgrade;
            write(state);
          }
        }
        return { enabled: state.enabled, hasPassword: !!state.verifier };
      } finally {
        derivations--;
      }
    },
  );
  handle("security:verify-password", async (password: unknown) => {
    if (
      typeof password !== "string" ||
      password.length > 256 ||
      derivations >= 2
    )
      return false;
    const state = read();
    if (!state.enabled || !state.verifier) return false;
    derivations++;
    try {
      const [salt, expected] = state.verifier.split(":");
      const actual = await derive(password, salt);
      const target = Buffer.from(expected, "hex");
      return actual.length === target.length && timingSafeEqual(actual, target);
    } finally {
      derivations--;
    }
  });
  handle("security:reset-preferences", () => {
    const state = read();
    state.enabled = false;
    delete state.verifier;
    write(state);
    return true;
  });
  // Kept separate from window lifetime: identity must never be deleted by reset preferences.
}
