/** Shadowsocks inbound / client key helpers (classic vs AEAD 2022). */

function randomBytesBase64(byteLength: number): string {
  const arr = new Uint8Array(byteLength);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < arr.length; i += 1) arr[i] = Math.floor(Math.random() * 256);
  }
  let bin = "";
  for (let i = 0; i < arr.length; i += 1) bin += String.fromCharCode(arr[i]!);
  return btoa(bin);
}

function randomClassicPassword(bytes = 16): string {
  const arr = new Uint8Array(bytes);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < arr.length; i += 1) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function isShadowsocks2022Method(method: string): boolean {
  return method.trim().startsWith("2022");
}

export function shadowsocksServerKeyBytes(method: string): number {
  if (!isShadowsocks2022Method(method)) return 0;
  return method.includes("128") ? 16 : 32;
}

/** Server `settings.password` for inbound JSON. */
export function randomShadowsocksServerPassword(method: string): string {
  const m = method.trim() || "aes-256-gcm";
  const n = shadowsocksServerKeyBytes(m);
  if (n > 0) return randomBytesBase64(n);
  return randomClassicPassword(16);
}

/** Client secret when assigning to a Shadowsocks inbound (mirrors backend). */
export function randomShadowsocksUserPassword(method: string): string {
  return randomShadowsocksServerPassword(method);
}

export function parseShadowsocksFromSettings(root: Record<string, unknown>): {
  ssMethod?: string;
  ssPassword?: string;
} {
  const out: { ssMethod?: string; ssPassword?: string } = {};
  if (typeof root.method === "string") out.ssMethod = root.method;
  if (typeof root.password === "string") out.ssPassword = root.password;
  return out;
}

export function stripShadowsocksClientMethods(
  method: string,
  clients: unknown,
): unknown {
  if (!isShadowsocks2022Method(method) || !Array.isArray(clients)) return clients;
  return clients.map((c) => {
    if (!c || typeof c !== "object") return c;
    const row = { ...(c as Record<string, unknown>) };
    delete row.method;
    return row;
  });
}
