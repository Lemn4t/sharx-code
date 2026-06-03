import type { TFunction } from "i18next";
import type { MonacoJsonSchemaEntry } from "@/lib/monacoJson";
import { buildXrayStreamSettingsSchema } from "@/lib/xrayStreamSettingsMonacoSchema";
import type { InboundFormProtocol } from "@/lib/inboundDefaults";

const D = (t: TFunction, key: string, defaultValue: string) =>
  t(key, { defaultValue });

function sniffingSchema(t: TFunction): object {
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
    schema: sniffingSchema(t),
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
