import type { IncomingMessage } from "http";
import { BlockList, isIP } from "net";
import type { Config } from "./config";
// Cloudflare published ranges, reviewed 2026-11-12. Render routes public HTTP
// through Cloudflare and its internal load balancers. Never trust all addresses.
const renderRanges = [
  "10.0.0.0/8",
  "172.16.0.0/12",
  "192.168.0.0/16",
  "127.0.0.0/8",
  "::1/128",
  "fc00::/7",
  "173.245.48.0/20",
  "103.21.244.0/22",
  "103.22.200.0/22",
  "103.31.4.0/22",
  "141.101.64.0/18",
  "108.162.192.0/18",
  "190.93.240.0/20",
  "188.114.96.0/20",
  "197.234.240.0/22",
  "198.41.128.0/17",
  "162.158.0.0/15",
  "104.16.0.0/13",
  "104.24.0.0/14",
  "172.64.0.0/13",
  "131.0.72.0/22",
  "2400:cb00::/32",
  "2606:4700::/32",
  "2803:f800::/32",
  "2405:b500::/32",
  "2405:8100::/32",
  "2a06:98c0::/29",
  "2c0f:f248::/32",
];
export function createPeerInfo(config: Config) {
  const trusted = new BlockList();
  const render = config.proxyProvider === "render";
  if (
    render &&
    (process.env.RENDER !== "true" ||
      !process.env.RENDER_SERVICE_ID ||
      process.env.RENDER_EXTERNAL_URL !== config.publicOrigin ||
      !config.trustProxy)
  )
    throw new Error(
      "Render proxy requires verified platform environment and matching PUBLIC_ORIGIN",
    );
  const entries = render
    ? renderRanges
    : (process.env.TRUSTED_PROXY_IPS ?? "127.0.0.1,::1").split(",");
  for (const entry of entries) {
    const [address, prefix] = entry.trim().split("/");
    const family = isIP(address);
    if (!family) throw new Error("Invalid trusted proxy address");
    const kind = family === 4 ? "ipv4" : "ipv6";
    if (prefix === undefined) trusted.addAddress(address, kind);
    else {
      const bits = Number(prefix);
      if (
        !Number.isInteger(bits) ||
        bits < 1 ||
        bits > (family === 4 ? 32 : 128)
      )
        throw new Error("Invalid trusted proxy prefix");
      trusted.addSubnet(address, bits, kind);
    }
  }
  const normal = (ip: string) => ip.replace(/^::ffff:/, "");
  const allowed = (ip: string) => {
    const version = isIP(ip);
    return !!version && trusted.check(ip, version === 4 ? "ipv4" : "ipv6");
  };
  return (req: IncomingMessage) => {
    const direct = normal(req.socket.remoteAddress ?? "unknown");
    if (!config.trustProxy || !allowed(direct))
      return { ip: direct, secure: false };
    if (render && req.headers.host !== new URL(config.publicOrigin).host)
      return { ip: direct, secure: false };
    const raw = req.headers["x-forwarded-for"];
    const chain =
      typeof raw === "string"
        ? raw.split(",").map((p) => normal(p.trim()))
        : [];
    if (chain.length > 16 || chain.some((p) => !isIP(p)))
      return { ip: direct, secure: false };
    let ip = direct;
    for (let i = chain.length - 1; i >= 0 && allowed(ip); i--) ip = chain[i];
    return {
      ip,
      secure:
        req.headers["x-forwarded-proto"] === "https" &&
        (!render || chain.length > 0),
    };
  };
}
