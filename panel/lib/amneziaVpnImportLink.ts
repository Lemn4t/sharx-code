/**
 * AmneziaVPN app import keys (not AmneziaWG .conf).
 * @see https://docs.amnezia.org/documentation/instructions/connect-via-config/
 * @see https://docs.amnezia.org/documentation/instructions/connect-via-qr-code/
 */

const AMNEZIA_VPN_IMPORT_PREFIX =
  /^(?:vpn|vless|vmess|trojan|ss|ssd):\/\//i;

function splitImportLines(links: string[]): string[] {
  const out: string[] = [];
  for (const raw of links) {
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (t && AMNEZIA_VPN_IMPORT_PREFIX.test(t)) out.push(t);
    }
  }
  return out;
}

/** All import keys for AmneziaVPN (deduped, subscription order). */
export function listAmneziaVpnImportLinks(links: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of splitImportLines(links)) {
    if (seen.has(line)) continue;
    seen.add(line);
    out.push(line);
  }
  return out;
}

/** First key, or null when the subscription has none. */
export function firstAmneziaVpnImportLink(links: string[]): string | null {
  const all = listAmneziaVpnImportLinks(links);
  return all[0] ?? null;
}

export function hasAmneziaVpnImportLink(links: string[]): boolean {
  return listAmneziaVpnImportLinks(links).length > 0;
}

/** Short label for a connection key (fragment #remark or protocol + index). */
export function amneziaVpnKeyDisplayLabel(link: string, index: number): string {
  const trimmed = link.trim();
  const hash = trimmed.indexOf("#");
  if (hash >= 0 && hash < trimmed.length - 1) {
    try {
      const remark = decodeURIComponent(trimmed.slice(hash + 1)).trim();
      if (remark) return remark;
    } catch {
      const remark = trimmed.slice(hash + 1).trim();
      if (remark) return remark;
    }
  }
  const proto = trimmed.match(/^([a-z0-9+.-]+):\/\//i)?.[1]?.toUpperCase() ?? "KEY";
  return `${proto} ${index + 1}`;
}
