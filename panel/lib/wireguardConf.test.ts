import { describe, expect, it } from "vitest";
import {
  extractWireGuardConfBlock,
  firstWireGuardConfFromLinks,
  hasWireGuardSubscription,
  isWgQuickConfProtocol,
  isWireGuardOnlySubscription,
  reconstructWireGuardConfFromLinks,
  wgQuickConfFromPanelText,
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

  it("recognizes amneziawg as wg-quick protocol", () => {
    expect(isWgQuickConfProtocol("amneziawg")).toBe(true);
    expect(isWgQuickConfProtocol("wireguard")).toBe(true);
    expect(isWgQuickConfProtocol("vless")).toBe(false);
  });

  it("extracts conf from amneziawg panel text for QR", () => {
    const panel =
      "AmneziaWG (UDP) — notes\n\nEndpoint: example.com:51820\n\n" +
      "[Interface]\nPrivateKey = abc=\nJc = 4\n\n[Peer]\nPublicKey = xyz=\n";
    const conf = wgQuickConfFromPanelText(panel);
    expect(conf).toContain("[Interface]");
    expect(conf).not.toContain("AmneziaWG (UDP)");
  });

  it("detects awg-only subscription with obfuscation lines", () => {
    const awgPanel =
      "AmneziaWG (UDP) — notes\n\n" +
      "[Interface]\n" +
      "PrivateKey = abc=\n" +
      "Jc = 4\n" +
      "H1 = 1\n\n" +
      "[Peer]\n" +
      "PublicKey = xyz=\n" +
      "AllowedIPs = 0.0.0.0/0\n";
    const lines = awgPanel.split("\n").map((l) => l.trim()).filter(Boolean);
    expect(isWireGuardOnlySubscription(lines)).toBe(true);
    expect(firstWireGuardConfFromLinks(lines)).toContain("Jc = 4");
  });
});
