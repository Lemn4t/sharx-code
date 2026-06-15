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
