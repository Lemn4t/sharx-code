import { describe, expect, it } from "vitest";
import {
  amneziaVpnKeyDisplayLabel,
  firstAmneziaVpnImportLink,
  hasAmneziaVpnImportLink,
  listAmneziaVpnImportLinks,
} from "./amneziaVpnImportLink";

describe("listAmneziaVpnImportLinks", () => {
  it("returns all vless/vmess keys and skips wg panel text", () => {
    const links = [
      "AmneziaWG (UDP) — notes\n\n[Interface]\nPrivateKey = x\n",
      "vless://uuid@a.com:443?security=tls#Node-A",
      "vmess://eyJ2IjoiMiJ9",
      "vless://uuid@b.com:443?security=tls#Node-B",
    ];
    expect(listAmneziaVpnImportLinks(links)).toEqual([
      "vless://uuid@a.com:443?security=tls#Node-A",
      "vmess://eyJ2IjoiMiJ9",
      "vless://uuid@b.com:443?security=tls#Node-B",
    ]);
    expect(firstAmneziaVpnImportLink(links)).toBe(
      "vless://uuid@a.com:443?security=tls#Node-A",
    );
    expect(hasAmneziaVpnImportLink(links)).toBe(true);
  });

  it("dedupes identical keys", () => {
    const key = "vless://x@y:443#dup";
    expect(listAmneziaVpnImportLinks([key, key])).toEqual([key]);
  });

  it("returns empty on wireguard-only subscription", () => {
    const links = ["[Interface]\nPrivateKey = abc\n\n[Peer]\nPublicKey = def\n"];
    expect(listAmneziaVpnImportLinks(links)).toEqual([]);
    expect(hasAmneziaVpnImportLink(links)).toBe(false);
  });
});

describe("amneziaVpnKeyDisplayLabel", () => {
  it("uses URL fragment as remark", () => {
    expect(amneziaVpnKeyDisplayLabel("vless://u@h:443#My%20Node", 0)).toBe("My Node");
  });

  it("falls back to protocol index", () => {
    expect(amneziaVpnKeyDisplayLabel("vmess://abc", 2)).toBe("VMESS 3");
  });
});
