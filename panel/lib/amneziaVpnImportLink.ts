/**
 * AmneziaVPN app import keys and .conf files.
 * @see https://docs.amnezia.org/documentation/instructions/connect-via-config/
 * @see https://docs.amnezia.org/documentation/instructions/connect-via-qr-code/
 */

import {
  listWireGuardConfsFromLinks,
  wireGuardConfFileName,
  wireGuardConfLabelFromPanelText,
  wgQuickConfFromPanelText,
} from "./wireguardConf";

const AMNEZIA_VPN_IMPORT_PREFIX =
  /^(?:vpn|vless|vmess|trojan|ss|ssd):\/\//i;

export type AmneziaVpnImportItem =
  | { kind: "link"; link: string }
  | { kind: "conf"; conf: string; label: string; fileName: string };

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

/** All importable items for AmneziaVPN (protocol keys + wg .conf blocks, deduped, subscription order). */
export function listAmneziaVpnImportItems(links: string[]): AmneziaVpnImportItem[] {
  const seenLinks = new Set<string>();
  const seenConfs = new Set<string>();
  const out: AmneziaVpnImportItem[] = [];

  for (const raw of links) {
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || !AMNEZIA_VPN_IMPORT_PREFIX.test(t) || seenLinks.has(t)) continue;
      seenLinks.add(t);
      out.push({ kind: "link", link: t });
    }
    const conf = wgQuickConfFromPanelText(raw);
    if (!conf || seenConfs.has(conf)) continue;
    seenConfs.add(conf);
    const wgEntries = listWireGuardConfsFromLinks([raw]);
    const entry = wgEntries[0];
    const label =
      entry?.label ??
      wireGuardConfLabelFromPanelText(raw) ??
      `AmneziaWG ${seenConfs.size}`;
    out.push({
      kind: "conf",
      conf,
      label,
      fileName: entry?.fileName ?? wireGuardConfFileName(label),
    });
  }

  return out;
}

/** All protocol import keys for AmneziaVPN (deduped, subscription order). */
export function listAmneziaVpnImportLinks(links: string[]): string[] {
  return listAmneziaVpnImportItems(links)
    .filter((item): item is Extract<AmneziaVpnImportItem, { kind: "link" }> => item.kind === "link")
    .map((item) => item.link);
}

/** First protocol key, or null when the subscription has none. */
export function firstAmneziaVpnImportLink(links: string[]): string | null {
  const all = listAmneziaVpnImportLinks(links);
  return all[0] ?? null;
}

export function hasAmneziaVpnImportLink(links: string[]): boolean {
  return listAmneziaVpnImportItems(links).length > 0;
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
