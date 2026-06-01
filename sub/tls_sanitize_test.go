package sub

import (
	"encoding/json"
	"testing"
)

func TestSubJsonService_tlsData(t *testing.T) {
	s := &SubJsonService{}
	in := map[string]any{
		"serverName": "example.com",
		"allowInsecure": true,
		"alpn": []any{"h2", "http/1.1"},
		"pinnedPeerCertificateChainSha256": []any{"deadbeef"},
		"settings": map[string]any{
			"fingerprint": "firefox",
			"allowInsecure": true,
		},
	}
	out := s.tlsData(in)
	if _, ok := out["allowInsecure"]; ok {
		t.Fatal("allowInsecure must not appear in subscription TLS")
	}
	if got := out["pinnedPeerCertSha256"]; got != "deadbeef" {
		t.Fatalf("pinnedPeerCertSha256 = %v", got)
	}
	if got := out["fingerprint"]; got != "firefox" {
		t.Fatalf("fingerprint = %v", got)
	}
	raw, err := json.Marshal(out)
	if err != nil {
		t.Fatal(err)
	}
	if string(raw) == "" {
		t.Fatal("empty marshal")
	}
}
