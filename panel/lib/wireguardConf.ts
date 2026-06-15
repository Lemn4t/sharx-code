/**
 * Extract the wg-quick `[Interface]` / `[Peer]` block from panel WireGuard info text.
 * Must not match descriptive lines like "Client DNS (for [Interface]):" — only a
 * section header at the start of a line.
 */
export function extractWireGuardConfBlock(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const lineStart = /(?:^|\n)\[Interface\]\r?\n/;
  const match = trimmed.match(lineStart);
  if (!match || match.index == null) return null;

  const start = match.index + (match[0].startsWith("\n") ? 1 : 0);
  return trimmed.slice(start).trim();
}

/** Join split subscription lines and extract a wg-quick block (GetSubs splits WG panel text by `\n`). */
export function reconstructWireGuardConfFromLinks(links: string[]): string | null {
  for (const link of links) {
    const conf = extractWireGuardConfBlock(link);
    if (conf) return conf;
  }
  if (!links.length) return null;
  return extractWireGuardConfBlock(links.join("\n"));
}

/** First wg-quick block found in subscription link lines. */
export function firstWireGuardConfFromLinks(links: string[]): string | null {
  return reconstructWireGuardConfFromLinks(links);
}

/** Panel WireGuard info lines that are not the wg-quick conf block itself. */
function isWireGuardPanelMetadataLine(line: string): boolean {
  const t = line.trim();
  if (!t) return true;
  if (extractWireGuardConfBlock(t)) return false;
  if (t.toLowerCase().startsWith("tg://proxy")) return false;
  if (/^\[Interface\]$/.test(t) || /^\[Peer\]$/.test(t)) return true;
  if (/^(PrivateKey|Address|DNS|MTU|PublicKey|Endpoint|PresharedKey|PersistentKeepalive|AllowedIPs|Jc|Jmin|Jmax|S1|S2|S3|S4|H1|H2|H3|H4)\s*=/.test(t)) {
    return true;
  }
  if (
    t.startsWith("WireGuard (UDP)") ||
    t.startsWith("AmneziaWG (UDP)") ||
    t.startsWith("Endpoint:") ||
    t.startsWith("MTU:") ||
    t.startsWith("noKernelTun:") ||
    t.startsWith("workers:") ||
    t.startsWith("Server tunnel:") ||
    t.startsWith("Client DNS:") ||
    t.startsWith("Server public key:") ||
    t.startsWith("---") ||
    t.startsWith("Peers on the server") ||
    t.startsWith("Configured:") ||
    t.startsWith("No peers in settings") ||
    t.startsWith("Row linked to this client") ||
    t.startsWith("Device public key") ||
    t.startsWith("AllowedIPs:") ||
    t.startsWith("Pre-shared key:") ||
    t.startsWith("PersistentKeepalive:") ||
    t.startsWith("Client private key") ||
    t.startsWith("No peer row is tagged") ||
    t.startsWith("No peers yet") ||
    t.startsWith("No peer row tagged for client") ||
    t.startsWith("(Assign an email")
  ) {
    return true;
  }
  return false;
}

function isNonWireGuardSubscriptionLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (extractWireGuardConfBlock(trimmed)) return false;
  if (trimmed.toLowerCase().startsWith("tg://proxy")) return false;
  if (isWireGuardPanelMetadataLine(trimmed)) return false;
  return true;
}

/** True when subscription includes an extractable WireGuard .conf block. */
export function hasWireGuardSubscription(links: string[]): boolean {
  return firstWireGuardConfFromLinks(links) != null;
}

/** True when every non-empty link is WireGuard panel info (no vless/vmess/etc.). */
export function isWireGuardOnlySubscription(links: string[]): boolean {
  if (!links.length) return false;
  if (hasWireGuardSubscription(links)) {
    return !links.some((line) => isNonWireGuardSubscriptionLine(line));
  }
  return false;
}
