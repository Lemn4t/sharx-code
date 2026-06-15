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

  const start =
    match.index + (match[0].startsWith("\n") ? 1 : 0);
  return trimmed.slice(start).trim();
}

/** First wg-quick block found in subscription link lines. */
export function firstWireGuardConfFromLinks(links: string[]): string | null {
  for (const link of links) {
    const conf = extractWireGuardConfBlock(link);
    if (conf) return conf;
  }
  return null;
}

function isNonWireGuardSubscriptionLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (extractWireGuardConfBlock(trimmed)) return false;
  if (trimmed.toLowerCase().startsWith("tg://proxy")) return false;
  return true;
}

/** True when every non-empty link is WireGuard panel info (no vless/vmess/etc.). */
export function isWireGuardOnlySubscription(links: string[]): boolean {
  if (!links.length) return false;
  let hasWg = false;
  for (const link of links) {
    if (extractWireGuardConfBlock(link)) {
      hasWg = true;
      continue;
    }
    if (isNonWireGuardSubscriptionLine(link)) return false;
  }
  return hasWg;
}
