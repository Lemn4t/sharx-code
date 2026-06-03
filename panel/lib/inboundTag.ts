/** Suggested auto tag (matches backend generateInboundTag). */
export function suggestInboundTag(
  port: number,
  listen: string,
  multiNode: boolean,
  inboundId?: number,
): string {
  if (multiNode && inboundId != null && inboundId > 0) {
    return `inbound-${inboundId}`;
  }
  const lip = listen.trim();
  const wild =
    lip === "" || lip === "0.0.0.0" || lip === "::" || lip === "::0";
  if (wild) {
    return `inbound-${port}`;
  }
  return `inbound-${lip}:${port}`;
}

const INBOUND_TAG_RE = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,63}$/;

export function validateInboundTagInput(tag: string): string | null {
  const t = tag.trim();
  if (!t) {
    return null;
  }
  if (t.toLowerCase() === "api") {
    return "Tag \"api\" is reserved";
  }
  if (!INBOUND_TAG_RE.test(t)) {
    return "Use letters, digits, . _ : - (max 64, start with letter or digit)";
  }
  return null;
}
