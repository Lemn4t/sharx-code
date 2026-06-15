import { describe, expect, it } from "vitest";
import {
  extractWireGuardConfBlock,
  firstWireGuardConfFromLinks,
  hasWireGuardSubscription,
  isWireGuardOnlySubscription,
  reconstructWireGuardConfFromLinks,
} from "./wireguardConf";

const SAMPLE_PANEL =
  "WireGuard (UDP) — notes\n\n" +
  "Endpoint: 203.0.113.1:51820\n\n" +
  "[Interface]\n" +
  "PrivateKey = abc=\n" +
  "Address = 10.8.0.2/32\n\n" +
  "[Peer]\n" +
  "PublicKey = xyz=\n" +
  "AllowedIPs = 0.0.0.0/0\n";

const SPLIT_LINES = SAMPLE_PANEL.split("\n").map((l) => l.trim()).filter(Boolean);

describe("wireguardConf", () => {
  it("extracts conf from full panel text", () => {
    const conf = extractWireGuardConfBlock(SAMPLE_PANEL);
    expect(conf).toContain("[Interface]");
    expect(conf).toContain("[Peer]");
  });

  it("reconstructs conf from split subscription lines", () => {
    const conf = reconstructWireGuardConfFromLinks(SPLIT_LINES);
    expect(conf).toContain("PrivateKey = abc=");
  });

  it("detects mixed subscription with wireguard block", () => {
    const links = [
      "vless://00000000-0000-0000-0000-000000000000@example.com:443",
      SAMPLE_PANEL,
    ];
    expect(hasWireGuardSubscription(links)).toBe(true);
    expect(isWireGuardOnlySubscription(links)).toBe(false);
  });

  it("detects wg-only subscription from split lines", () => {
    expect(isWireGuardOnlySubscription(SPLIT_LINES)).toBe(true);
    expect(firstWireGuardConfFromLinks(SPLIT_LINES)).not.toBeNull();
  });
});
