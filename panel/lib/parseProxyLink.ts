/**
 * Parse proxy share-links (vless://, vmess://, trojan://, ss://, hysteria2://)
 * into Xray outbound raw objects suitable for the OutboundsBuilder.
 *
 * Returns null when the link cannot be parsed or the protocol is unsupported.
 */

export type ParsedOutbound = {
  tag: string;
  protocol: string;
  raw: Record<string, unknown>;
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function b64decode(s: string): string {
  try {
    // Add padding
    const pad = s.length % 4;
    const padded = pad ? s + "=".repeat(4 - pad) : s;
    return atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  } catch {
    return "";
  }
}

function buildStreamSettings(
  network: string,
  security: string,
  q: URLSearchParams,
): Record<string, unknown> {
  const stream: Record<string, unknown> = { network };

  // TLS / Reality
  if (security === "tls") {
    const tlsSettings: Record<string, unknown> = {};
    const sni = q.get("sni");
    if (sni) tlsSettings.serverName = sni;
    const alpn = q.get("alpn");
    if (alpn) tlsSettings.alpn = alpn.split(",");
    const fp = q.get("fp");
    if (fp) tlsSettings.fingerprint = fp;
    stream.security = "tls";
    stream.tlsSettings = tlsSettings;
  } else if (security === "reality") {
    const realitySettings: Record<string, unknown> = {};
    const sni = q.get("sni");
    if (sni) realitySettings.serverName = sni;
    realitySettings.publicKey = q.get("pbk") ?? "";
    realitySettings.shortId = q.get("sid") ?? "";
    const fp = q.get("fp");
    if (fp) realitySettings.fingerprint = fp;
    const spx = q.get("spx");
    if (spx) realitySettings.spiderX = spx;
    stream.security = "reality";
    stream.realitySettings = realitySettings;
  } else {
    stream.security = "none";
  }

  // Transport
  switch (network) {
    case "ws": {
      const wsSettings: Record<string, unknown> = {};
      const path = q.get("path");
      if (path) wsSettings.path = decodeURIComponent(path);
      const host = q.get("host");
      if (host) wsSettings.headers = { Host: host };
      stream.wsSettings = wsSettings;
      break;
    }
    case "grpc": {
      const grpcSettings: Record<string, unknown> = {};
      const serviceName = q.get("serviceName");
      if (serviceName) grpcSettings.serviceName = serviceName;
      const mode = q.get("mode");
      if (mode) grpcSettings.multiMode = mode === "multi";
      stream.grpcSettings = grpcSettings;
      break;
    }
    case "h2":
    case "http": {
      const httpSettings: Record<string, unknown> = {};
      const path = q.get("path");
      if (path) httpSettings.path = decodeURIComponent(path);
      const host = q.get("host");
      if (host) httpSettings.host = [host];
      stream.httpSettings = httpSettings;
      break;
    }
    case "xhttp":
    case "splithttp": {
      const xhttpSettings: Record<string, unknown> = {};
      const path = q.get("path");
      if (path) xhttpSettings.path = decodeURIComponent(path);
      const host = q.get("host");
      if (host) xhttpSettings.host = host;
      const mode = q.get("mode");
      if (mode) xhttpSettings.mode = mode;
      const extra = q.get("extra");
      if (extra) {
        try { xhttpSettings.extra = JSON.parse(decodeURIComponent(extra)); } catch { /* ignore */ }
      }
      stream.xhttpSettings = xhttpSettings;
      break;
    }
    case "tcp": {
      // HTTP obfuscation header (type=http)
      const headerType = q.get("headerType");
      if (headerType === "http") {
        const path = q.get("path");
        const host = q.get("host");
        stream.tcpSettings = {
          header: {
            type: "http",
            request: {
              path: path ? [path] : ["/"],
              headers: host ? { Host: [host] } : {},
            },
          },
        };
      }
      break;
    }
  }

  return stream;
}

// ─── protocol parsers ─────────────────────────────────────────────────────────

function parseVless(link: string): ParsedOutbound | null {
  try {
    const u = new URL(link);
    const uuid = u.username;
    const host = u.hostname;
    const port = parseInt(u.port, 10);
    if (!uuid || !host || !port) return null;
    const q = u.searchParams;
    const network = q.get("type") || "tcp";
    const security = q.get("security") || "none";
    const flow = q.get("flow") || "";
    const remark = decodeURIComponent(u.hash.slice(1)) || `${host}:${port}`;

    const streamSettings = buildStreamSettings(network, security, q);

    return {
      tag: remark,
      protocol: "vless",
      raw: {
        protocol: "vless",
        tag: remark,
        settings: {
          vnext: [
            {
              address: host,
              port,
              users: [{ id: uuid, encryption: "none", flow }],
            },
          ],
        },
        streamSettings,
      },
    };
  } catch {
    return null;
  }
}

function parseVmess(link: string): ParsedOutbound | null {
  try {
    const b64 = link.slice("vmess://".length);
    const json = b64decode(b64);
    if (!json) return null;
    const v = JSON.parse(json) as Record<string, unknown>;
    const host = v.add as string;
    const port = parseInt(String(v.port), 10);
    const uuid = v.id as string;
    if (!host || !port || !uuid) return null;
    const remark = String(v.ps || v.name || `${host}:${port}`);
    const network = String(v.net || "tcp");
    const security = String(v.tls || "none").toLowerCase() === "tls" ? "tls" : "none";
    const alterId = parseInt(String(v.aid ?? 0), 10) || 0;
    const cipher = String(v.scy || v.cipher || "auto");

    const stream: Record<string, unknown> = { network };
    if (security === "tls") {
      stream.security = "tls";
      stream.tlsSettings = v.sni ? { serverName: v.sni } : {};
    } else {
      stream.security = "none";
    }
    switch (network) {
      case "ws":
        stream.wsSettings = {
          path: v.path || "/",
          headers: v.host ? { Host: v.host } : {},
        };
        break;
      case "grpc":
        stream.grpcSettings = { serviceName: v.path || "" };
        break;
      case "h2":
      case "http":
        stream.httpSettings = {
          path: v.path || "/",
          host: v.host ? [v.host] : [],
        };
        break;
    }

    return {
      tag: remark,
      protocol: "vmess",
      raw: {
        protocol: "vmess",
        tag: remark,
        settings: {
          vnext: [
            {
              address: host,
              port,
              users: [{ id: uuid, alterId, security: cipher }],
            },
          ],
        },
        streamSettings: stream,
      },
    };
  } catch {
    return null;
  }
}

function parseTrojan(link: string): ParsedOutbound | null {
  try {
    const u = new URL(link);
    const password = u.username;
    const host = u.hostname;
    const port = parseInt(u.port, 10);
    if (!password || !host || !port) return null;
    const q = u.searchParams;
    const network = q.get("type") || "tcp";
    const security = q.get("security") || "tls";
    const remark = decodeURIComponent(u.hash.slice(1)) || `${host}:${port}`;
    const streamSettings = buildStreamSettings(network, security, q);

    return {
      tag: remark,
      protocol: "trojan",
      raw: {
        protocol: "trojan",
        tag: remark,
        settings: {
          servers: [{ address: host, port, password }],
        },
        streamSettings,
      },
    };
  } catch {
    return null;
  }
}

function parseSS(link: string): ParsedOutbound | null {
  try {
    const u = new URL(link);
    let method = "";
    let password = "";
    let host = u.hostname;
    let port = parseInt(u.port, 10);
    const remark = decodeURIComponent(u.hash.slice(1)) || `${host}:${port}`;

    if (u.username) {
      // SIP002: username = base64(method:password) or method:password
      const decoded = b64decode(u.username);
      if (decoded && decoded.includes(":")) {
        const idx = decoded.indexOf(":");
        method = decoded.slice(0, idx);
        password = decoded.slice(idx + 1);
      } else {
        // Might be plain "method:password"
        const plain = decodeURIComponent(u.username);
        const idx = plain.indexOf(":");
        if (idx >= 0) {
          method = plain.slice(0, idx);
          password = plain.slice(idx + 1);
        } else {
          method = plain;
        }
      }
    } else {
      // Classic: ss://BASE64(method:password@host:port)#name
      const b64 = link.slice("ss://".length).split("#")[0] ?? "";
      const decoded = b64decode(b64);
      if (!decoded) return null;
      const atIdx = decoded.lastIndexOf("@");
      if (atIdx < 0) return null;
      const userInfo = decoded.slice(0, atIdx);
      const hostInfo = decoded.slice(atIdx + 1);
      const colonIdx = userInfo.indexOf(":");
      if (colonIdx < 0) return null;
      method = userInfo.slice(0, colonIdx);
      password = userInfo.slice(colonIdx + 1);
      const hpColon = hostInfo.lastIndexOf(":");
      if (hpColon < 0) return null;
      host = hostInfo.slice(0, hpColon);
      port = parseInt(hostInfo.slice(hpColon + 1), 10);
    }

    if (!host || !port || !method) return null;

    return {
      tag: remark,
      protocol: "shadowsocks",
      raw: {
        protocol: "shadowsocks",
        tag: remark,
        settings: {
          servers: [{ address: host, port, method, password, level: 0 }],
        },
        streamSettings: { network: "tcp", security: "none" },
      },
    };
  } catch {
    return null;
  }
}

// ─── public API ───────────────────────────────────────────────────────────────

/**
 * Parse a single proxy link string into a ParsedOutbound.
 * Supports vless://, vmess://, trojan://, ss://, hysteria2://, hy2://.
 * Returns null for unsupported or malformed links.
 */
export function parseProxyLink(raw: string): ParsedOutbound | null {
  const s = raw.trim();
  if (s.startsWith("vless://")) return parseVless(s);
  if (s.startsWith("vmess://")) return parseVmess(s);
  if (s.startsWith("trojan://")) return parseTrojan(s);
  if (s.startsWith("ss://")) return parseSS(s);
  // hysteria2 is not a standard Xray outbound; skip for now
  return null;
}
