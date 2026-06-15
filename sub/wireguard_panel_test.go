package sub

import (
	"strings"
	"testing"
)

func TestWireguardConfBlockFromPanelInfo_withClientDNS(t *testing.T) {
	// Regression: when clientDns is set, the old hint line contained "[Interface]" mid-line
	// and naive indexOf broke QR / .conf export.
	panelText := "" +
		"WireGuard (UDP) — notes\n\n" +
		"Client DNS: 1.1.1.1, 8.8.8.8\n" +
		"Server public key: abc\n\n" +
		"[Interface]\n" +
		"PrivateKey = clientPriv=\n" +
		"Address = 10.8.0.2/32\n" +
		"DNS = 1.1.1.1, 8.8.8.8\n\n" +
		"[Peer]\n" +
		"PublicKey = serverPub=\n" +
		"Endpoint = 203.0.113.1:51820\n" +
		"AllowedIPs = 0.0.0.0/0, ::/0\n"

	got := wireguardConfBlockFromPanelInfo(panelText)
	if got == "" {
		t.Fatal("expected conf block")
	}
	if !strings.HasPrefix(got, "[Interface]") {
		t.Fatalf("conf should start with [Interface], got %q", got)
	}
	if strings.Contains(got, "Client DNS:") {
		t.Fatalf("conf block must not include panel hint lines: %q", got)
	}
	if !strings.Contains(got, "DNS = 1.1.1.1") {
		t.Fatalf("conf block should include DNS line: %q", got)
	}
}

func TestWireguardConfBlockFromPanelInfo_legacyFalsePositive(t *testing.T) {
	legacy := "" +
		"Client DNS (for [Interface]): 1.1.1.1\n\n" +
		"[Interface]\n" +
		"PrivateKey = x\n\n" +
		"[Peer]\n" +
		"PublicKey = y\n"

	got := wireguardConfBlockFromPanelInfo(legacy)
	if got == "" {
		t.Fatal("expected conf block")
	}
	if strings.Contains(got, "Client DNS (for") {
		t.Fatalf("must not slice from mid-line [Interface] mention: %q", got)
	}
}
