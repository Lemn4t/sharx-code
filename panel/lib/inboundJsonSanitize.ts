import {
  buildSniffingFromForm,
  buildStreamSettingsFromForm,
  parseFirstClientFromSettings,
  parseSniffingToForm,
  parseStreamSettingsToForm,
  type InboundFormProtocol,
} from "@/lib/inboundDefaults";

export type InboundJsonRoundTripResult =
  | { ok: true; json: string; strippedKeys: string[] }
  | { ok: false; message: string };

function collectKeyPaths(value: unknown, prefix = ""): Set<string> {
  const out = new Set<string>();
  if (value === null || typeof value !== "object") {
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => {
      for (const p of collectKeyPaths(item, `${prefix}[${i}]`)) {
        out.add(p);
      }
    });
    return out;
  }
  const obj = value as Record<string, unknown>;
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    out.add(path);
    for (const p of collectKeyPaths(v, path)) {
      out.add(p);
    }
  }
  return out;
}

function diffStrippedPaths(before: unknown, after: unknown): string[] {
  const a = collectKeyPaths(before);
  const b = collectKeyPaths(after);
  const stripped: string[] = [];
  for (const p of a) {
    if (!b.has(p)) stripped.push(p);
  }
  stripped.sort();
  return stripped;
}

function parseJsonObject(json: string, label: string): InboundJsonRoundTripResult & { value?: Record<string, unknown> } {
  const trimmed = json.trim();
  if (!trimmed) {
    return { ok: false, message: `${label}: empty JSON` };
  }
  let value: unknown;
  try {
    value = JSON.parse(trimmed);
  } catch {
    return { ok: false, message: `${label}: invalid JSON` };
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, message: `${label}: must be a JSON object` };
  }
  return { ok: true, json: trimmed, strippedKeys: [], value: value as Record<string, unknown> };
}

/** Drop unknown stream/sniffing fields by parsing into the form model and rebuilding. */
export function roundTripInboundStreamSettings(
  json: string,
  protocol: InboundFormProtocol,
): InboundJsonRoundTripResult {
  if (protocol === "wireguard" || protocol === "telemt") {
    return { ok: true, json: "{}", strippedKeys: [] };
  }
  const parsed = parseJsonObject(json, "streamSettings");
  if (!parsed.ok || !parsed.value) {
    return parsed;
  }
  const before = parsed.value;
  const form = parseStreamSettingsToForm(JSON.stringify(before), protocol);
  const rebuilt = buildStreamSettingsFromForm(form, protocol);
  let after: Record<string, unknown>;
  try {
    after = JSON.parse(rebuilt) as Record<string, unknown>;
  } catch {
    return { ok: false, message: "streamSettings: rebuild failed" };
  }
  return {
    ok: true,
    json: rebuilt,
    strippedKeys: diffStrippedPaths(before, after),
  };
}

export function roundTripInboundSniffing(json: string): InboundJsonRoundTripResult {
  const parsed = parseJsonObject(json, "sniffing");
  if (!parsed.ok || !parsed.value) {
    return parsed;
  }
  const before = parsed.value;
  const form = parseSniffingToForm(JSON.stringify(before));
  const rebuilt = buildSniffingFromForm(form);
  let after: Record<string, unknown>;
  try {
    after = JSON.parse(rebuilt) as Record<string, unknown>;
  } catch {
    return { ok: false, message: "sniffing: rebuild failed" };
  }
  return {
    ok: true,
    json: rebuilt,
    strippedKeys: diffStrippedPaths(before, after),
  };
}

const SERVER_SETTINGS_KEYS: Partial<Record<InboundFormProtocol, readonly string[]>> = {
  vless: ["encryption", "decryption", "fallbacks"],
  vmess: ["disableInsecureEncryption"],
  trojan: ["fallbacks"],
  shadowsocks: ["method", "password", "network", "ivCheck"],
  hysteria: ["version"],
  hysteria2: ["version"],
};

export function inboundSettingsJsonEditorSupported(protocol: InboundFormProtocol): boolean {
  return Boolean(SERVER_SETTINGS_KEYS[protocol]);
}

/** Server-only settings slice (no `clients` / panel-managed accounts). */
export function extractInboundServerSettingsJson(
  settingsStr: string,
  protocol: InboundFormProtocol,
): string {
  const allowed = SERVER_SETTINGS_KEYS[protocol];
  if (!allowed) {
    return "{}";
  }
  let root: Record<string, unknown> = {};
  try {
    root = JSON.parse(settingsStr) as Record<string, unknown>;
  } catch {
    root = {};
  }
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in root) {
      out[key] = root[key];
    }
  }
  return JSON.stringify(out, null, 2);
}

export function mergeInboundServerSettingsJson(
  baselineSettings: string,
  editedServerJson: string,
  protocol: InboundFormProtocol,
): InboundJsonRoundTripResult {
  const allowed = SERVER_SETTINGS_KEYS[protocol];
  if (!allowed) {
    return { ok: true, json: baselineSettings, strippedKeys: [] };
  }
  const parsed = parseJsonObject(editedServerJson, "settings");
  if (!parsed.ok || !parsed.value) {
    return parsed;
  }
  const before = parsed.value;
  let baseline: Record<string, unknown> = {};
  try {
    baseline = JSON.parse(baselineSettings) as Record<string, unknown>;
  } catch {
    baseline = {};
  }
  const merged: Record<string, unknown> = { ...baseline };
  const picked: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in before) {
      picked[key] = before[key];
      merged[key] = before[key];
    }
  }
  // Re-apply known client-related fields from baseline only (never from JSON editor).
  if (Array.isArray(baseline.clients)) {
    merged.clients = baseline.clients;
  }
  if (protocol === "mixed") {
    if (typeof baseline.auth === "string") merged.auth = baseline.auth;
    if (typeof baseline.udp === "boolean") merged.udp = baseline.udp;
    if (Array.isArray(baseline.accounts)) merged.accounts = baseline.accounts;
  }
  if (protocol === "shadowsocks" && !Array.isArray(merged.clients)) {
    merged.clients = [];
  }
  const rebuilt = JSON.stringify(merged);
  let afterPick: Record<string, unknown>;
  try {
    afterPick = JSON.parse(JSON.stringify(picked)) as Record<string, unknown>;
  } catch {
    return { ok: false, message: "settings: merge failed" };
  }
  return {
    ok: true,
    json: rebuilt,
    strippedKeys: diffStrippedPaths(before, afterPick),
  };
}

/** Parse server settings JSON into form patch fields (flow, fallbacks, SS method, …). */
export function serverSettingsJsonToFormPatch(
  serverJson: string,
  protocol: InboundFormProtocol,
): ReturnType<typeof parseFirstClientFromSettings> {
  let server: Record<string, unknown> = {};
  try {
    server = JSON.parse(serverJson || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
  const wrapped =
    protocol === "vless"
      ? JSON.stringify({ ...server, clients: [{ flow: "" }] })
      : protocol === "trojan"
        ? JSON.stringify({ ...server, clients: [{ password: "" }] })
        : JSON.stringify(server);
  try {
    return parseFirstClientFromSettings(wrapped, protocol);
  } catch {
    return {};
  }
}
