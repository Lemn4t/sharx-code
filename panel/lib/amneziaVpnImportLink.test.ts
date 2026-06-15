import { describe, expect, it } from "vitest";
import {
  amneziaVpnKeyDisplayLabel,
  firstAmneziaVpnImportLink,
  hasAmneziaVpnImportLink,
  listAmneziaVpnImportItems,
  listAmneziaVpnImportLinks,
} from "./amneziaVpnImportLink";

describe("listAmneziaVpnImportItems", () => {
  it("returns protocol keys and wg conf blocks in subscription order", () => {
    const awg =
      "AmneziaWG (UDP) — Node-A\n\n[Interface]\nPrivateKey = x\n\n[Peer]\nPublicKey = y\n";
    const links = [
      awg,
      "vless://uuid@a.com:443?security=tls#Node-A",
      "vmess://eyJ2IjoiMiJ9",
      "vless://uuid@b.com:443?security=tls#Node-B",
    ];
    expect(listAmneziaVpnImportItems(links)).toEqual([
      {
        kind: "conf",
        conf: "[Interface]\nPrivateKey = x\n\n[Peer]\nPublicKey = y",
        label: "Node-A",
        fileName: "Node-A.conf",
      },
      { kind: "link", link: "vless://uuid@a.com:443?security=tls#Node-A" },
      { kind: "link", link: "vmess://eyJ2IjoiMiJ9" },
      { kind: "link", link: "vless://uuid@b.com:443?security=tls#Node-B" },
    ]);
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

  it("dedupes identical keys and conf blocks", () => {
    const key = "vless://x@y:443#dup";
    const conf = "[Interface]\nPrivateKey = abc\n\n[Peer]\nPublicKey = def\n";
    expect(listAmneziaVpnImportItems([key, key, conf, conf])).toEqual([
      { kind: "link", link: key },
      {
        kind: "conf",
        conf: "[Interface]\nPrivateKey = abc\n\n[Peer]\nPublicKey = def",
        label: "WireGuard 1",
        fileName: "WireGuard-1.conf",
      },
    ]);
  });

  it("returns conf-only on wireguard-only subscription", () => {
    const conf = "[Interface]\nPrivateKey = abc\n\n[Peer]\nPublicKey = def\n";
    const links = [conf];
    expect(listAmneziaVpnImportLinks(links)).toEqual([]);
    expect(listAmneziaVpnImportItems(links)).toEqual([
      {
        kind: "conf",
        conf: "[Interface]\nPrivateKey = abc\n\n[Peer]\nPublicKey = def",
        label: "WireGuard 1",
        fileName: "WireGuard-1.conf",
      },
    ]);
    expect(hasAmneziaVpnImportLink(links)).toBe(true);
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
