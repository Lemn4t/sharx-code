import type { TFunction } from "i18next";
import type { MonacoJsonSchemaEntry } from "@/lib/monacoJson";
import { buildXrayStreamSettingsSchema } from "@/lib/xrayStreamSettingsMonacoSchema";
import type { InboundFormProtocol } from "@/lib/inboundDefaults";

const D = (t: TFunction, key: string, defaultValue: string) =>
  t(key, { defaultValue });

function sniffingSchema(): object {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      enabled: { type: "boolean" },
      destOverride: {
        type: "array",
        items: { type: "string", enum: ["http", "tls", "quic", "fakedns"] },
      },
      metadataOnly: { type: "boolean" },
      routeOnly: { type: "boolean" },
      domainsExcluded: {
        type: "array",
        items: { type: "string" },
      },
    },
  };
}

function serverSettingsSchema(protocol: InboundFormProtocol, t: TFunction): object | null {
  switch (protocol) {
    case "vless":
      return {
        type: "object",
        additionalProperties: false,
        description: D(
          t,
          "pages.inbounds.jsonSchema.settings.vless",
          "VLESS inbound server fields only. Clients are managed via Clients page.",
        ),
        properties: {
          encryption: { type: "string" },
          decryption: { type: "string" },
          fallbacks: { type: "array" },
        },
      };
    case "vmess":
      return {
        type: "object",
        additionalProperties: false,
        properties: {
          disableInsecureEncryption: { type: "boolean" },
        },
      };
    case "trojan":
      return {
        type: "object",
        additionalProperties: false,
        properties: {
          fallbacks: { type: "array" },
        },
      };
    case "shadowsocks":
      return {
        type: "object",
        additionalProperties: false,
        properties: {
          method: { type: "string" },
          password: { type: "string" },
          network: { type: "string" },
          ivCheck: { type: "boolean" },
        },
      };
    case "hysteria":
    case "hysteria2":
      return {
        type: "object",
        additionalProperties: false,
        properties: {
          version: { type: "integer", enum: protocol === "hysteria2" ? [2] : [1] },
        },
      };
    default:
      return null;
  }
}

export function inboundJsonMonacoSchemas(
  t: TFunction,
  protocol: InboundFormProtocol,
  activeDoc: "stream" | "sniffing" | "settings",
): MonacoJsonSchemaEntry[] {
  const entries: MonacoJsonSchemaEntry[] = [];
  if (protocol !== "wireguard" && protocol !== "telemt") {
    entries.push({
      uri: "inbound://stream-settings",
      fileMatch: ["inbound-stream.json"],
      schema: buildXrayStreamSettingsSchema((k, o) => t(k, o ?? {})),
    });
  }
  entries.push({
    uri: "inbound://sniffing",
    fileMatch: ["inbound-sniffing.json"],
    schema: sniffingSchema(),
  });
  const settings = serverSettingsSchema(protocol, t);
  if (settings) {
    entries.push({
      uri: "inbound://settings-server",
      fileMatch: ["inbound-settings.json"],
      schema: settings,
    });
  }
  return entries.filter((e) => {
    if (activeDoc === "stream") return e.fileMatch.includes("inbound-stream.json");
    if (activeDoc === "sniffing") return e.fileMatch.includes("inbound-sniffing.json");
    return e.fileMatch.includes("inbound-settings.json");
  });
}

export function inboundJsonMonacoPath(activeDoc: "stream" | "sniffing" | "settings"): string {
  if (activeDoc === "stream") return "inbound-stream.json";
  if (activeDoc === "sniffing") return "inbound-sniffing.json";
  return "inbound-settings.json";
}

function coreSettingsSchema(protocol: InboundFormProtocol, t: TFunction): object {
  const server = serverSettingsSchema(protocol, t);
  const base: Record<string, unknown> = {
    type: "object",
    description: D(
      t,
      "pages.inbounds.jsonSchema.core.settings",
      "Inbound settings as in Xray. You may edit clients[] / peers[] / accounts[]; unknown server fields are removed on Apply or Save.",
    ),
  };
  if (server && typeof server === "object") {
    const srv = server as { properties?: Record<string, unknown> };
    base.properties = {
      ...srv.properties,
      clients: {
        type: "array",
        description: "Xray clients (email, id, flow, …)",
      },
      peers: { type: "array", description: "WireGuard peers" },
      accounts: { type: "array", description: "Mixed inbound accounts" },
      auth: { type: "string" },
      udp: { type: "boolean" },
    };
    base.additionalProperties = true;
  } else if (protocol === "mixed") {
    base.properties = {
      auth: { type: "string" },
      udp: { type: "boolean" },
      accounts: { type: "array" },
    };
    base.additionalProperties = true;
  } else {
    base.additionalProperties = true;
  }
  return base;
}

/** Monaco schemas for the full Xray inbound object (core preview editor). */
export function inboundCoreConfigMonacoSchemas(
  t: TFunction,
  protocol: InboundFormProtocol,
): MonacoJsonSchemaEntry[] {
  const stream =
    protocol !== "wireguard" && protocol !== "telemt"
      ? buildXrayStreamSettingsSchema((k, o) => t(k, o ?? {}))
      : { type: "object" };
  return [
    {
      uri: "inbound://core-config",
      fileMatch: ["inbound-xray-core.json"],
      schema: {
        type: "object",
        required: ["listen", "port", "protocol", "tag", "settings", "streamSettings", "sniffing"],
        properties: {
          listen: {
            description: "Bind address (string or JSON string)",
          },
          port: {
            type: "integer",
            description: "Listener port (1–65535). Avoid min/max in schema — Monaco would suggest every value in range.",
          },
          protocol: { type: "string" },
          tag: { type: "string" },
          settings: coreSettingsSchema(protocol, t),
          streamSettings: stream,
          sniffing: sniffingSchema(),
          acceptProxyProtocol: { type: "boolean" },
        },
        additionalProperties: false,
      },
    },
  ];
}
