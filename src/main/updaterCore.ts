import fs from "fs";
import path from "path";
import { randomUUID, createHash, timingSafeEqual } from "crypto";
import { Readable, Transform } from "stream";
import { pipeline } from "stream/promises";
import { valid, gt, prerelease } from "semver";
import { load, JSON_SCHEMA } from "js-yaml";
import type { UpdaterState, AppUpdateInfo } from "../shared/updater";
export function shouldCheckUpdate(lastCheck:number,now=Date.now()){return !Number.isFinite(lastCheck)||lastCheck<=0||now-lastCheck>=86400000||lastCheck>now;}
export const UPDATE_REPO = "sAlly-19/Cofee-Desk";
const API = "https://api.github.com/repos/" + UPDATE_REPO + "/releases";
const RELEASE = "https://github.com/" + UPDATE_REPO + "/releases";
export interface UpdateAdapter {
  checkForUpdates: () => Promise<{ updateInfo: any } | null>;
  downloadUpdate: (token: any) => Promise<unknown>;
  quitAndInstall: (silent: boolean, restart: boolean) => void;
}
interface Dependencies {
  version: string;
  arch: string;
  isDev: boolean;
  isPortable: boolean;
  directory: string;
  busy: () => boolean;
  adapter: UpdateAdapter;
  token: () => any;
  request?: typeof fetch;
  broadcast: (state: UpdaterState) => void;
  launch: (file: string) => Promise<void>;
}
export function releaseVersion(input: unknown, current: string) {
  if (typeof input !== "string") throw Error("Invalid version");
  const version = valid(input.replace(/^v/, ""));
  if (!version || prerelease(version) || !gt(version, current))
    throw Error("No newer stable release");
  return version;
}
export function installerName(version: string, arch: string) {
  if (!["x64", "arm64", "ia32"].includes(arch) || !valid(version))
    throw Error("Invalid architecture");
  return "Coffee-Desk-" + version + "-" + arch + "-Setup.exe";
}
function safeUrl(value: string, kind: "api" | "asset") {
  const u = new URL(value);
  if (u.protocol !== "https:" || u.username || u.password)
    throw Error("Invalid update origin");
  const allowed =
    kind === "api"
      ? u.hostname === "api.github.com"
      : u.hostname === "github.com" ||
        u.hostname === "release-assets.githubusercontent.com" ||
        u.hostname === "objects.githubusercontent.com";
  if (!allowed) throw Error("Invalid update origin");
  return u.href;
}
export class UpdateManager {
  private state: UpdaterState;
  private token: any;
  private abort?: AbortController;
  private file?: string;
  private digest?: string;
  private size?: number;
  private operation = 0;
  private pending?: Promise<void>;
  constructor(private deps: Dependencies) {
    this.state = {
      status: "idle",
      updateInfo: null,
      progress: null,
      errorMessage: null,
      isDev: deps.isDev,
      isPortable: deps.isPortable,
      installBlocked: false,
    };
  }
  getState(): UpdaterState {
    return {
      ...this.state,
      installBlocked: this.deps.busy(),
      updateInfo: this.state.updateInfo ? { ...this.state.updateInfo } : null,
      progress: this.state.progress ? { ...this.state.progress } : null,
    };
  }
  private publish(patch: Partial<UpdaterState>) {
    this.state = { ...this.state, ...patch };
    this.deps.broadcast(this.getState());
  }
  private async request(
    url: string,
    kind: "api" | "asset",
    signal?: AbortSignal,
  ) {
    const request = this.deps.request || fetch;
    let next = safeUrl(url, kind);
    for (let i = 0; i < 6; i++) {
      const response = await request(next, {
        headers: {
          Accept:
            kind === "api"
              ? "application/vnd.github+json"
              : "application/octet-stream",
          "User-Agent": "CoffeeDesk/" + this.deps.version,
        },
        redirect: "manual",
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(120000)])
          : AbortSignal.timeout(20000),
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location) throw Error("Missing redirect");
        next = safeUrl(new URL(location, next).href, kind);
        continue;
      }
      if (!response.ok) throw Error("Update HTTP " + response.status);
      return response;
    }
    throw Error("Too many redirects");
  }
  private async text(response: Response, max: number) {
    const reader = response.body?.getReader();
    if (!reader) throw Error("Empty response");
    let bytes = 0;
    const parts: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > max) {
        await reader.cancel();
        throw Error("Metadata too large");
      }
      parts.push(value);
    }
    return Buffer.concat(parts).toString("utf8");
  }
  private info(version: string, data: any): AppUpdateInfo {
    return {
      version,
      currentVersion: this.deps.version,
      releaseNotes:
        typeof data.body === "string"
          ? data.body.slice(0, 100000)
          : typeof data.releaseNotes === "string"
            ? data.releaseNotes.slice(0, 100000)
            : "",
      releaseDate: data.published_at || data.releaseDate,
      releaseUrl: RELEASE + "/tag/v" + version,
    };
  }
  async check() {
    if (["downloading", "installing", "checking"].includes(this.state.status))
      return this.getState();
    this.publish({ status: "checking", errorMessage: null });
    try {
      if (this.deps.isDev) {
        const response = await (this.deps.request || fetch)(API + "/latest", {
          headers: { "User-Agent": "CoffeeDesk/" + this.deps.version },
          signal: AbortSignal.timeout(20000),
        });
        if (response.status === 404) {
          this.publish({ status: "not-available", updateInfo: null });
          return this.getState();
        }
        if (!response.ok) throw Error("Check failed");
        const release = JSON.parse(await this.text(response, 1048576));
        const clean = valid(String(release.tag_name || "").replace(/^v/, ""));
        if (!clean || prerelease(clean) || release.draft || release.prerelease)
          throw Error("Invalid release");
        if (!gt(clean, this.deps.version)) {
          this.publish({ status: "not-available", updateInfo: null });
          return this.getState();
        }
        this.publish({
          status: "available",
          updateInfo: this.info(clean, release),
          progress: null,
        });
      } else {
        const result = await this.deps.adapter.checkForUpdates();
        const raw = result?.updateInfo;
        const clean = raw && valid(String(raw.version));
        if (!clean || !gt(clean, this.deps.version)) {
          this.publish({ status: "not-available", updateInfo: null });
          return this.getState();
        }
        const version = releaseVersion(clean, this.deps.version);
        this.publish({
          status: "available",
          updateInfo: this.info(version, raw),
          progress: null,
        });
      }
    } catch {
      this.publish({
        status: "error",
        errorMessage:
          "Não foi possível verificar atualizações. Tente novamente ou abra o GitHub.",
      });
    }
    return this.getState();
  }
  nativeProgress(progress: {
    percent: number;
    transferred: number;
    total: number;
    bytesPerSecond: number;
  }) {
    if (this.state.status === "downloading")
      this.publish({
        progress: {
          percent: Math.min(100, Math.max(0, progress.percent)),
          transferred: progress.transferred,
          total: progress.total,
          bytesPerSecond: progress.bytesPerSecond,
        },
      });
  }
  startDownload(): Promise<void> {
    if (this.pending) return this.pending;
    if (this.deps.isDev || this.deps.isPortable) {
      this.publish({
        status: "error",
        errorMessage: this.deps.isDev
          ? "Download desativado no desenvolvimento."
          : "Use a página de releases para a versão portátil.",
      });
      return Promise.resolve();
    }
    if (this.state.status !== "available" || !this.state.updateInfo)
      return Promise.resolve();
    const epoch = ++this.operation;
    this.publish({
      status: "downloading",
      progress: { percent: 0, transferred: 0, total: 0, bytesPerSecond: 0 },
      errorMessage: null,
    });
    this.file = undefined;
    this.pending = (async () => {
      try {
        this.token = this.deps.token();
        await this.deps.adapter.downloadUpdate(this.token);
        if (epoch !== this.operation) return;
        this.publish({
          status: "downloaded",
          progress: {
            percent: 100,
            transferred: this.state.progress?.total || 0,
            total: this.state.progress?.total || 0,
            bytesPerSecond: 0,
          },
        });
      } catch {
        if (epoch !== this.operation) return;
        try {
          await this.fallback(epoch);
        } catch {
          if (epoch === this.operation)
            this.publish({
              status: "error",
              errorMessage:
                "Não foi possível validar e baixar o instalador. Tente novamente ou use o GitHub.",
            });
        }
      }
    })().finally(() => {
      this.pending = undefined;
      this.token = undefined;
      this.abort = undefined;
    });
    return this.pending;
  }
  private async fallback(epoch: number) {
    const version = releaseVersion(
      this.state.updateInfo!.version,
      this.deps.version,
    );
    const name = installerName(version, this.deps.arch);
    this.abort = new AbortController();
    const signal = this.abort.signal;
    const release = JSON.parse(
      await this.text(
        await this.request(API + "/tags/v" + version, "api", signal),
        1048576,
      ),
    );
    if (
      release.draft ||
      release.prerelease ||
      valid(String(release.tag_name).replace(/^v/, "")) !== version
    )
      throw Error("Wrong release");
    const assets = Array.isArray(release.assets) ? release.assets : [];
    const asset = assets.find((a: any) => a.name === name),
      metadata = assets.find((a: any) => a.name === "latest.yml");
    if (
      !asset ||
      !metadata ||
      !Number.isSafeInteger(asset.size) ||
      asset.size < 1 ||
      asset.size > 1073741824
    )
      throw Error("Missing installer metadata");
    const releasePrefix = RELEASE + "/download/v" + version + "/";
    if (
      asset.browser_download_url !== releasePrefix + name ||
      metadata.browser_download_url !== releasePrefix + "latest.yml"
    )
      throw Error("Unexpected asset path");
    const manifest = load(
      await this.text(
        await this.request(metadata.browser_download_url, "asset", signal),
        65536,
      ),
      { schema: JSON_SCHEMA },
    ) as any;
    if (
      !manifest ||
      valid(String(manifest.version)) !== version ||
      !Array.isArray(manifest.files)
    )
      throw Error("Wrong manifest");
    const file = manifest.files.find((f: any) => f.url === name);
    if (
      !file ||
      file.size !== asset.size ||
      typeof file.sha512 !== "string" ||
      Buffer.from(file.sha512, "base64").length !== 64
    )
      throw Error("Invalid checksum metadata");
    const response = await this.request(
      asset.browser_download_url,
      "asset",
      signal,
    );
    if (!response.body) throw Error("Empty installer");
    await fs.promises.mkdir(this.deps.directory, { recursive: true });
    const target = path.join(this.deps.directory, randomUUID() + "-" + name),
      partial = target + ".part";
    const hash = createHash("sha512");
    let bytes = 0;
    const start = Date.now();
    try {
      const inspect = new Transform({
        transform: (chunk, _encoding, callback) => {
          bytes += chunk.length;
          if (bytes > asset.size || epoch !== this.operation) {
            callback(Error("Invalid download"));
            return;
          }
          hash.update(chunk);
          this.nativeProgress({
            percent: (bytes / asset.size) * 100,
            transferred: bytes,
            total: asset.size,
            bytesPerSecond: bytes / Math.max(0.1, (Date.now() - start) / 1000),
          });
          callback(null, chunk);
        },
      });
      await pipeline(
        Readable.fromWeb(response.body as any),
        inspect,
        fs.createWriteStream(partial, { flags: "wx" }),
        { signal },
      );
      const actual = hash.digest();
      if (
        bytes !== asset.size ||
        !timingSafeEqual(actual, Buffer.from(file.sha512, "base64")) ||
        epoch !== this.operation
      )
        throw Error("Invalid installer");
      await fs.promises.rename(partial, target);
      this.file = target;
      this.digest = file.sha512;
      this.size = asset.size;
      this.publish({
        status: "downloaded",
        progress: {
          percent: 100,
          transferred: bytes,
          total: bytes,
          bytesPerSecond: 0,
        },
      });
    } finally {
      await fs.promises.rm(partial, { force: true });
    }
  }
  cancelDownload() {
    if (this.state.status !== "downloading") return;
    this.operation++;
    this.token?.cancel();
    this.abort?.abort();
    this.publish({ status: "available", progress: null, errorMessage: null });
  }
  async installAndRestart() {
    if (this.deps.busy()) {
      this.publish({
        errorMessage: "Encerre a sessão e as transferências antes de instalar.",
      });
      return;
    }
    if (
      this.deps.isDev ||
      this.deps.isPortable ||
      this.state.status !== "downloaded"
    )
      return;
    try {
      if (this.file) {
        const hash = createHash("sha512");
        let size = 0;
        for await (const chunk of fs.createReadStream(this.file)) {
          size += chunk.length;
          hash.update(chunk);
        }
        if (size !== this.size || hash.digest("base64") !== this.digest)
          throw Error("Installer changed");
      }
      if (this.deps.busy()) throw Error("Session active");
      this.publish({ status: "installing", errorMessage: null });
      if (this.file) await this.deps.launch(this.file);
      else this.deps.adapter.quitAndInstall(false, true);
    } catch {
      this.publish({
        status: "error",
        errorMessage: "Não foi possível iniciar a instalação com segurança.",
      });
    }
  }
}
