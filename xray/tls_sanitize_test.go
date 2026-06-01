package xray

import "testing"

func TestSanitizeClientTLSSettings(t *testing.T) {
	in := map[string]any{
		"serverName":   "example.com",
		"allowInsecure": true,
		"alpn":         []any{"h2", "http/1.1"},
		"pinnedPeerCertificateChainSha256": []any{"abc123"},
		"settings": map[string]any{
			"fingerprint": "chrome",
			"allowInsecure": true,
		},
	}
	out := SanitizeClientTLSSettings(in)
	if _, ok := out["allowInsecure"]; ok {
		t.Fatal("allowInsecure must be removed")
	}
	if _, ok := out["settings"]; ok {
		t.Fatal("legacy settings wrapper must be removed")
	}
	if _, ok := out["pinnedPeerCertificateChainSha256"]; ok {
		t.Fatal("legacy pin key must be renamed")
	}
	if got := out["pinnedPeerCertSha256"]; got != "abc123" {
		t.Fatalf("pinnedPeerCertSha256 = %v, want abc123", got)
	}
	if got := out["fingerprint"]; got != "chrome" {
		t.Fatalf("fingerprint = %v, want chrome", got)
	}
}
