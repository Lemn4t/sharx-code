/** Form state for protocol `amneziawg` sidecar inbound (future UI). */
export type AmneziaWgFormState = {
  mtu: number;
  secretKey: string;
  address: string;
  clientDns: string;
  listenPort: number;
  jc: string;
  jmin: string;
  jmax: string;
  s1: string;
  s2: string;
  h1: string;
  h2: string;
  h3: string;
  h4: string;
};

export function defaultAmneziaWgInboundForm(): AmneziaWgFormState {
  return {
    mtu: 1420,
    secretKey: "",
    address: "10.8.0.1/24",
    clientDns: "1.1.1.1",
    listenPort: 51820,
    jc: "4",
    jmin: "40",
    jmax: "70",
    s1: "",
    s2: "",
    h1: "",
    h2: "",
    h3: "",
    h4: "",
  };
}

export function randomAmneziaWgObfuscationFields(): Pick<
  AmneziaWgFormState,
  "jc" | "jmin" | "jmax" | "s1" | "s2" | "h1" | "h2" | "h3" | "h4"
> {
  const rand = () => Math.floor(Math.random() * 0x7fffffff) + 1;
  return {
    jc: "4",
    jmin: "40",
    jmax: "70",
    s1: String(50 + Math.floor(Math.random() * 70)),
    s2: String(Math.floor(Math.random() * 40)),
    h1: String(rand()),
    h2: String(rand()),
    h3: String(rand()),
    h4: String(rand()),
  };
}

function splitListLinesOrCommas(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function pickNum(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseInt(v, 10);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

export function parseAmneziaWgSettingsToForm(settingsStr: string): AmneziaWgFormState {
  const base = defaultAmneziaWgInboundForm();
  try {
    const root = JSON.parse(settingsStr || "{}") as Record<string, unknown>;
    if (typeof root.mtu === "number" && root.mtu > 0) base.mtu = root.mtu;
    if (typeof root.secretKey === "string") base.secretKey = root.secretKey;
    const addr = root.address;
    if (Array.isArray(addr)) {
      const lines = addr
        .map((a) => (typeof a === "string" ? a.trim() : ""))
        .filter(Boolean);
      if (lines.length) base.address = lines.join("\n");
    }
    const cd = root.clientDns;
    if (Array.isArray(cd)) {
      const lines = cd
        .map((a) => (typeof a === "string" ? a.trim() : ""))
        .filter(Boolean);
      if (lines.length) base.clientDns = lines.join("\n");
    }
    const obf =
      root.obfuscation != null && typeof root.obfuscation === "object" && !Array.isArray(root.obfuscation)
        ? (root.obfuscation as Record<string, unknown>)
        : null;
    if (obf) {
      const jc = pickNum(obf.jc);
      if (jc > 0) base.jc = String(jc);
      const jmin = pickNum(obf.jmin);
      if (jmin > 0) base.jmin = String(jmin);
      const jmax = pickNum(obf.jmax);
      if (jmax > 0) base.jmax = String(jmax);
      for (const k of ["s1", "s2", "h1", "h2", "h3", "h4"] as const) {
        const n = pickNum(obf[k]);
        if (n > 0) base[k] = String(n);
      }
    }
  } catch {
    /* use base */
  }
  return base;
}

export type AmneziaWgInboundApiPayload = {
  mtu: number;
  secretKey: string;
  address: string[];
  clientDns: string[];
  obfuscation: {
    jc: number;
    jmin: number;
    jmax: number;
    s1: number;
    s2: number;
    h1: number;
    h2: number;
    h3: number;
    h4: number;
  };
};

export function buildAmneziaWgInboundApiPayload(
  w: AmneziaWgFormState,
): AmneziaWgInboundApiPayload {
  const addrs = splitListLinesOrCommas(w.address);
  const mtu = Number.isFinite(w.mtu) && w.mtu > 0 ? w.mtu : 1420;
  const num = (s: string) => {
    const n = parseInt(s.trim(), 10);
    return Number.isFinite(n) ? n : 0;
  };
  return {
    mtu,
    secretKey: w.secretKey.trim(),
    address: addrs.length > 0 ? addrs : ["10.8.0.1/24"],
    clientDns: splitListLinesOrCommas(w.clientDns),
    obfuscation: {
      jc: num(w.jc) || 4,
      jmin: num(w.jmin) || 40,
      jmax: num(w.jmax) || 70,
      s1: num(w.s1),
      s2: num(w.s2),
      h1: num(w.h1),
      h2: num(w.h2),
      h3: num(w.h3),
      h4: num(w.h4),
    },
  };
}
